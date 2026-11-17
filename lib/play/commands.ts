import * as Y from "yjs";
import { FIELD_WIDTH, MAX_Y, MIN_Y } from "@/lib/field/constants";
import { colorForPosition, getFormation } from "./formations";
import {
  DEFAULT_DELAY,
  DEFAULT_SPEED,
  LOCAL_ORIGIN,
  getMeta,
  getPlayers,
  getRoutePoints,
  getRoutes,
  newId,
  type YField,
  type YPoints,
} from "./schema";
import type { EndCap, RoutePoint, RouteStyle, SegmentType } from "./types";

// The only code that writes to a play document. Every command runs in one
// transaction tagged LOCAL_ORIGIN so it is a single undo step and a single update.

function transact<T>(doc: Y.Doc, fn: () => T): T {
  let result!: T;
  doc.transact(() => {
    result = fn();
  }, LOCAL_ORIGIN);
  return result;
}

const round = (n: number) => Math.round(n * 100) / 100;

function clampX(x: number) {
  return round(Math.min(FIELD_WIDTH, Math.max(0, x)));
}

function clampY(y: number) {
  return round(Math.min(MAX_Y, Math.max(MIN_Y, y)));
}

function makePoint(point: RoutePoint): YField {
  const map = new Y.Map<unknown>();
  map.set("x", clampX(point.x));
  map.set("y", clampY(point.y));
  map.set("type", point.type);
  return map;
}

function routePoints(doc: Y.Doc, routeId: string): YPoints | undefined {
  const route = getRoutes(doc).get(routeId);
  return route ? getRoutePoints(route) : undefined;
}

// ── Play ────────────────────────────────────────────────────────────

export interface NewPlayOptions {
  name: string;
  formation: string;
}

/** Fill an empty document with metadata and a starting formation. */
export function initPlay(doc: Y.Doc, { name, formation }: NewPlayOptions) {
  transact(doc, () => {
    const meta = getMeta(doc);
    meta.set("name", name);
    applyFormationInner(doc, formation);
  });
}

/** A new document for a play, ready to encode and save. */
export function createPlayDoc(options: NewPlayOptions): Y.Doc {
  const doc = new Y.Doc();
  initPlay(doc, options);
  return doc;
}

export function setPlayName(doc: Y.Doc, name: string) {
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return;
  transact(doc, () => getMeta(doc).set("name", trimmed));
}

export function setNotes(doc: Y.Doc, notes: string) {
  transact(doc, () => getMeta(doc).set("notes", notes));
}

/** Replace every player and route with a preset formation. */
export function applyFormation(doc: Y.Doc, formationId: string) {
  transact(doc, () => applyFormationInner(doc, formationId));
}

function applyFormationInner(doc: Y.Doc, formationId: string) {
  const formation = getFormation(formationId);
  if (!formation) throw new Error(`Unknown formation: ${formationId}`);
  getRoutes(doc).clear();
  getPlayers(doc).clear();
  getMeta(doc).set("formation", formation.id);
  for (const p of formation.players) {
    addPlayerInner(doc, { ...p, color: colorForPosition(p.position) });
  }
}

// ── Players ─────────────────────────────────────────────────────────

export interface NewPlayer {
  label: string;
  position: string;
  x: number;
  y: number;
  color?: string;
}

export function addPlayer(doc: Y.Doc, player: NewPlayer): string {
  return transact(doc, () => addPlayerInner(doc, player));
}

function addPlayerInner(doc: Y.Doc, player: NewPlayer): string {
  const id = newId();
  const map = new Y.Map<unknown>();
  map.set("label", player.label);
  map.set("position", player.position);
  map.set("x", clampX(player.x));
  map.set("y", clampY(player.y));
  map.set("color", player.color ?? colorForPosition(player.position));
  getPlayers(doc).set(id, map);
  return id;
}

export function movePlayer(doc: Y.Doc, id: string, x: number, y: number) {
  // TODO(exercise 1a): move player `id` to (x, y), kept on the field.
  // Look at updatePlayer just below for the shape of a command.
}

export interface PlayerPatch {
  label?: string;
  position?: string;
  color?: string;
}

export function updatePlayer(doc: Y.Doc, id: string, patch: PlayerPatch) {
  const player = getPlayers(doc).get(id);
  if (!player) return;
  transact(doc, () => {
    if (patch.label !== undefined) player.set("label", patch.label.slice(0, 4));
    if (patch.position !== undefined) player.set("position", patch.position);
    if (patch.color !== undefined) player.set("color", patch.color);
  });
}

/** Delete a player and all of their routes. */
export function deletePlayer(doc: Y.Doc, id: string) {
  // TODO(exercise 1b): remove the player and every route that belongs to them,
  // as a single change. (Careful deleting from a map while looping over it.)
}

// ── Routes ──────────────────────────────────────────────────────────

export interface NewRoute {
  points?: readonly RoutePoint[];
  style?: RouteStyle;
  endCap?: EndCap;
  speed?: number;
  delay?: number;
  option?: boolean;
}

export function addRoute(
  doc: Y.Doc,
  playerId: string,
  route: NewRoute = {},
): string | undefined {
  if (!getPlayers(doc).has(playerId)) return undefined;
  return transact(doc, () => {
    const id = newId();
    const map = new Y.Map<unknown>();
    const points: YPoints = new Y.Array<YField>();
    points.push((route.points ?? []).map(makePoint));
    map.set("playerId", playerId);
    map.set("points", points);
    map.set("style", route.style ?? "solid");
    map.set("endCap", route.endCap ?? "arrow");
    map.set("speed", route.speed ?? DEFAULT_SPEED);
    map.set("delay", route.delay ?? DEFAULT_DELAY);
    map.set("option", route.option ?? false);
    getRoutes(doc).set(id, map);
    return id;
  });
}

/**
 * Add an option branch that shares `route`'s stem up to and including
 * point `fromIndex`. Returns the new route id.
 */
export function addOptionRoute(
  doc: Y.Doc,
  routeId: string,
  fromIndex: number,
): string | undefined {
  const route = getRoutes(doc).get(routeId);
  const points = route && getRoutePoints(route);
  if (!route || !points) return undefined;
  const stem = points
    .toArray()
    .slice(0, Math.max(0, fromIndex + 1))
    .map((p) => ({
      x: p.get("x") as number,
      y: p.get("y") as number,
      type: p.get("type") as SegmentType,
    }));
  return addRoute(doc, route.get("playerId") as string, {
    points: stem,
    style: "dashed",
    endCap: route.get("endCap") as EndCap,
    speed: route.get("speed") as number,
    delay: route.get("delay") as number,
    option: true,
  });
}

export function deleteRoute(doc: Y.Doc, routeId: string) {
  transact(doc, () => getRoutes(doc).delete(routeId));
}

export function setRouteStyle(
  doc: Y.Doc,
  routeId: string,
  patch: { style?: RouteStyle; endCap?: EndCap },
) {
  const route = getRoutes(doc).get(routeId);
  if (!route) return;
  transact(doc, () => {
    if (patch.style) route.set("style", patch.style);
    if (patch.endCap) route.set("endCap", patch.endCap);
  });
}

export function setRouteTiming(
  doc: Y.Doc,
  routeId: string,
  patch: { speed?: number; delay?: number },
) {
  const route = getRoutes(doc).get(routeId);
  if (!route) return;
  transact(doc, () => {
    if (patch.speed !== undefined && Number.isFinite(patch.speed)) {
      route.set("speed", Math.min(15, Math.max(0.5, round(patch.speed))));
    }
    if (patch.delay !== undefined && Number.isFinite(patch.delay)) {
      route.set("delay", Math.min(10, Math.max(0, round(patch.delay))));
    }
  });
}

export function setRouteOption(doc: Y.Doc, routeId: string, option: boolean) {
  const route = getRoutes(doc).get(routeId);
  if (!route) return;
  transact(doc, () => route.set("option", option));
}

// ── Route points ────────────────────────────────────────────────────

/** Insert a point at `index` (default: the end). Returns the index used. */
export function addRoutePoint(
  doc: Y.Doc,
  routeId: string,
  point: RoutePoint,
  index?: number,
): number | undefined {
  const points = routePoints(doc, routeId);
  if (!points) return undefined;
  const at = Math.min(points.length, Math.max(0, index ?? points.length));
  transact(doc, () => points.insert(at, [makePoint(point)]));
  return at;
}

export function moveRoutePoint(
  doc: Y.Doc,
  routeId: string,
  index: number,
  x: number,
  y: number,
) {
  const point = routePoints(doc, routeId)?.get(index);
  if (!point) return;
  transact(doc, () => {
    point.set("x", clampX(x));
    point.set("y", clampY(y));
  });
}

export function setRoutePointType(
  doc: Y.Doc,
  routeId: string,
  index: number,
  type: SegmentType,
) {
  const point = routePoints(doc, routeId)?.get(index);
  if (!point) return;
  transact(doc, () => point.set("type", type));
}

export function deleteRoutePoint(doc: Y.Doc, routeId: string, index: number) {
  const points = routePoints(doc, routeId);
  if (!points || index < 0 || index >= points.length) return;
  transact(doc, () => points.delete(index, 1));
}
