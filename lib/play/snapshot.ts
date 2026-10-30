import type * as Y from "yjs";
import {
  DEFAULT_DELAY,
  DEFAULT_SPEED,
  getMeta,
  getPlayers,
  getRoutePoints,
  getRoutes,
  type YField,
} from "./schema";
import type {
  EndCap,
  PlayMeta,
  PlayModel,
  Player,
  Route,
  RoutePoint,
  RouteStyle,
  SegmentType,
} from "./types";

const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;

function readMeta(doc: Y.Doc): PlayMeta {
  const meta = getMeta(doc);
  const notes = meta.get("notes");
  return {
    name: str(meta.get("name"), "Untitled play"),
    formation: str(meta.get("formation")),
    ...(typeof notes === "string" ? { notes } : {}),
  };
}

function readPlayer(id: string, map: YField): Player {
  return {
    id,
    label: str(map.get("label")),
    position: str(map.get("position")),
    x: num(map.get("x")),
    y: num(map.get("y")),
    color: str(map.get("color"), "#0f766e"),
  };
}

function readPoint(map: YField): RoutePoint {
  const type = map.get("type");
  return {
    x: num(map.get("x")),
    y: num(map.get("y")),
    type: (type === "curve" ? "curve" : "line") satisfies SegmentType,
  };
}

function readRoute(id: string, map: YField): Route {
  const style = map.get("style");
  const endCap = map.get("endCap");
  return {
    id,
    playerId: str(map.get("playerId")),
    points: getRoutePoints(map)?.map(readPoint) ?? [],
    style: (style === "dashed" ? "dashed" : "solid") satisfies RouteStyle,
    endCap: (endCap === "block" ? "block" : "arrow") satisfies EndCap,
    speed: num(map.get("speed"), DEFAULT_SPEED),
    delay: num(map.get("delay"), DEFAULT_DELAY),
    option: map.get("option") === true,
  };
}

function samePlayer(a: Player, b: Player) {
  return (
    a.label === b.label &&
    a.position === b.position &&
    a.x === b.x &&
    a.y === b.y &&
    a.color === b.color
  );
}

function sameRoute(a: Route, b: Route) {
  return (
    a.playerId === b.playerId &&
    a.style === b.style &&
    a.endCap === b.endCap &&
    a.speed === b.speed &&
    a.delay === b.delay &&
    a.option === b.option &&
    a.points.length === b.points.length &&
    a.points.every(
      (p, i) =>
        p.x === b.points[i].x &&
        p.y === b.points[i].y &&
        p.type === b.points[i].type,
    )
  );
}

/**
 * Read the document into an immutable PlayModel. Elements that are unchanged
 * since `prev` keep their identity, so per-route memoization keeps working.
 */
export function readPlayModel(doc: Y.Doc, prev?: PlayModel): PlayModel {
  const players: Record<string, Player> = {};
  getPlayers(doc).forEach((map, id) => {
    const next = readPlayer(id, map);
    const old = prev?.players[id];
    players[id] = old && samePlayer(old, next) ? old : next;
  });

  const routes: Record<string, Route> = {};
  getRoutes(doc).forEach((map, id) => {
    const next = readRoute(id, map);
    const old = prev?.routes[id];
    routes[id] = old && sameRoute(old, next) ? old : next;
  });

  const meta = readMeta(doc);
  return {
    meta:
      prev &&
      prev.meta.name === meta.name &&
      prev.meta.formation === meta.formation &&
      prev.meta.notes === meta.notes
        ? prev.meta
        : meta,
    players,
    routes,
  };
}

/** External store over a Y.Doc for useSyncExternalStore. */
export class PlayStore {
  private model: PlayModel;
  private listeners = new Set<() => void>();

  constructor(private readonly doc: Y.Doc) {
    this.model = readPlayModel(doc);
  }

  private onChange = (transaction: Y.Transaction) => {
    if (transaction.changed.size === 0) return;
    this.model = readPlayModel(this.doc, this.model);
    for (const listener of this.listeners) listener();
  };

  subscribe = (listener: () => void) => {
    if (this.listeners.size === 0) {
      // Re-read in case the doc changed while nobody was listening.
      this.model = readPlayModel(this.doc, this.model);
      this.doc.on("afterTransaction", this.onChange);
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0)
        this.doc.off("afterTransaction", this.onChange);
    };
  };

  getSnapshot = () => this.model;
}
