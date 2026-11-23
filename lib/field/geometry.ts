import type { PlayModel, Point, Route, RoutePoint } from "@/lib/play/types";
import { continueDynamicHTMLResumeNode } from "next/dist/server/app-render/stream-ops.web";

// Pure route geometry in yards. A route starts at its player's spot and runs
// through its points. A "curve" point makes the segment ending there a smooth
// Catmull-Rom curve (drawn as a cubic Bézier); a "line" point makes it straight.

export interface Segment {
  from: Point;
  to: Point;
  /** Bézier control points; absent for straight segments. */
  c1?: Point;
  c2?: Point;
}

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const distance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);

export function routeSegments(
  start: Point,
  points: readonly RoutePoint[],
): Segment[] {
  const all: Point[] = [start, ...points];
  const segments: Segment[] = [];
  for (let k = 0; k < points.length; k++) {
    const p1 = all[k];
    const p2 = all[k + 1];
    if (points[k].type === "curve") {
      const p0 = all[k - 1] ?? p1;
      const p3 = all[k + 2] ?? p2;
      segments.push({
        from: p1,
        to: p2,
        c1: add(p1, scale(sub(p2, p0), 1 / 6)),
        c2: sub(p2, scale(sub(p3, p1), 1 / 6)),
      });
    } else {
      segments.push({ from: p1, to: p2 });
    }
  }
  return segments;
}

/** Field y (downfield is positive) to SVG y (down the screen is positive). */
export const svgY = (y: number) => -y;

const fmt = (n: number) => Number(n.toFixed(3));

export function segmentsToPath(segments: readonly Segment[]): string {
  if (segments.length === 0) return "";
  const parts = [
    `M ${fmt(segments[0].from.x)} ${fmt(svgY(segments[0].from.y))}`,
  ];
  for (const s of segments) {
    if (s.c1 && s.c2) {
      parts.push(
        `C ${fmt(s.c1.x)} ${fmt(svgY(s.c1.y))} ${fmt(s.c2.x)} ${fmt(svgY(s.c2.y))} ${fmt(s.to.x)} ${fmt(svgY(s.to.y))}`,
      );
    } else {
      parts.push(`L ${fmt(s.to.x)} ${fmt(svgY(s.to.y))}`);
    }
  }
  return parts.join(" ");
}

function cubicAt(s: Segment, t: number): Point {
  const { from: p0, c1, c2, to: p3 } = s;
  if (!c1 || !c2) return add(p0, scale(sub(p3, p0), t));
  const u = 1 - t;
  return {
    x:
      u * u * u * p0.x +
      3 * u * u * t * c1.x +
      3 * u * t * t * c2.x +
      t * t * t * p3.x,
    y:
      u * u * u * p0.y +
      3 * u * u * t * c1.y +
      3 * u * t * t * c2.y +
      t * t * t * p3.y,
  };
}

/** Direction of travel at the end of the route, in radians (field coordinates). */
export function endAngle(segments: readonly Segment[]): number | undefined {
  const last = segments[segments.length - 1];
  if (!last) return undefined;
  let d = sub(last.to, last.c2 ?? last.from);
  if (Math.hypot(d.x, d.y) < 1e-9) d = sub(last.to, last.from);
  if (Math.hypot(d.x, d.y) < 1e-9) return undefined;
  return Math.atan2(d.y, d.x);
}

// ── Sampling ────────────────────────────────────────────────────────

/** Samples per curved segment. Straight segments need only their endpoints. */
export const CURVE_SAMPLES = 32;

export interface SampledPath {
  points: Point[];
  /** cumulative[i] is the distance along the path to points[i]. */
  cumulative: number[];
  length: number;
}

export function samplePath(
  start: Point,
  segments: readonly Segment[],
): SampledPath {
  const points: Point[] = [start];
  const cumulative = [0];
  for (const s of segments) {
    const steps = s.c1 && s.c2 ? CURVE_SAMPLES : 1;
    for (let i = 1; i <= steps; i++) {
      const p = cubicAt(s, i / steps);
      cumulative.push(
        cumulative[cumulative.length - 1] +
          distance(points[points.length - 1], p),
      );
      points.push(p);
    }
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

/** Position after travelling `d` yards along the path (clamped to its ends). */
export function pointAtDistance(path: SampledPath, d: number): Point {
  const { points, cumulative, length } = path;
  if (d <= 0 || points.length === 1) return points[0];
  if (d >= length) return points[points.length - 1];

  // TODO(exercise 1a): d is somewhere strictly inside the path.
  // Find the two neighbouring samples whose cumulative distances surround d,
  // then return the point that fraction of the way between them.
  // (add, sub and scale above are handy. Bonus: cumulative is sorted.)
  let lowIndex = 0;
  let highIndex = cumulative.length - 1;
  let midIndex = (lowIndex + highIndex) >> 1;
  while (lowIndex < highIndex) {
    midIndex = (lowIndex + highIndex) >> 1;
    const above = d > cumulative[midIndex];
    if (above) lowIndex = midIndex + 1;
    else highIndex = midIndex;
  }
  const p1Index = lowIndex - 1;
  const p2Index = lowIndex;

  const p1Dist = Math.abs(d - cumulative[p1Index]);
  const p2Dist = Math.abs(d - cumulative[p2Index]);
  const distProp = p1Dist / (p2Dist + p1Dist);

  const p1 = points[p1Index];
  const p2 = points[p2Index];

  const xDiff = p2.x - p1.x;
  const yDiff = p2.y - p1.y;

  const p: Point = {x: p1.x + xDiff*distProp, y: p1.y + yDiff*distProp};
  return p;
}

// ── Simulation ──────────────────────────────────────────────────────

interface CachedPath {
  start: Point;
  path: SampledPath;
}

// Memoized per route object. PlayModel keeps unchanged routes' identity, so this
// only recomputes routes that changed. It's a cache, not state: results are the
// same with or without it.
const pathCache = new WeakMap<Route, CachedPath>();

export function routePath(route: Route, start: Point): SampledPath {
  const cached = pathCache.get(route);
  if (cached && cached.start.x === start.x && cached.start.y === start.y) {
    return cached.path;
  }
  const path = samplePath(start, routeSegments(start, route.points));
  pathCache.set(route, { start, path });
  return path;
}

/**
 * The route a player runs in playback: their first non-option route by id
 * (ids give a stable order on every client), or their first route of any kind.
 */
export function primaryRoute(
  model: PlayModel,
  playerId: string,
): Route | undefined {
  let best: Route | undefined;
  for (const route of Object.values(model.routes)) {
    if (route.playerId !== playerId) continue;
    if (
      !best ||
      (best.option && !route.option) ||
      (best.option === route.option && route.id < best.id)
    ) {
      best = route;
    }
  }
  return best;
}

/**
 * Every player's position `t` seconds after the snap. A player stands still
 * until their route's delay, then covers speed × (t − delay) yards along it.
 * Pure and deterministic: same model and t, same result.
 */
export function simulate(model: PlayModel, t: number): Record<string, Point> {
  const positions: Record<string, Point> = {};
  for (const player of Object.values(model.players)) {

    positions[player.id] = { x: player.x, y: player.y };
    const route = primaryRoute(model, player.id);
    if (!route) {
      continue;
    }
    const spd = route.speed;
    const path = routePath(route, player);
    const dly = route.delay;
    const x = spd * Math.max((t - dly), 0);
    const p = pointAtDistance(path, x);
    positions[player.id] = { x: p.x, y: p.y };
  }
  return positions;
}

/** Seconds until the last player finishes their route. */
export function playDuration(model: PlayModel): number {
  let end = 0;
  for (const player of Object.values(model.players)) {
    const route = primaryRoute(model, player.id);
    if (!route || route.speed <= 0) continue;
    const length = routePath(route, player).length;
    if (length > 0) end = Math.max(end, route.delay + length / route.speed);
  }
  return end;
}
