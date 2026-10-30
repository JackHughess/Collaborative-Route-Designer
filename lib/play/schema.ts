import * as Y from "yjs";

// Yjs layout of a play document (see CLAUDE.md "Data model"):
//   meta:    Y.Map { name, formation, notes? }
//   players: Y.Map<playerId, Y.Map { label, position, x, y, color }>
//   routes:  Y.Map<routeId, Y.Map { playerId, points: Y.Array<Y.Map { x, y, type }>,
//                                   style, endCap, speed, delay, option }>
// Route points are Y.Maps (not plain objects) so two people dragging the same
// point merge field by field instead of duplicating it.

export type YField = Y.Map<unknown>;
export type YPoints = Y.Array<YField>;

export function getMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("meta");
}

export function getPlayers(doc: Y.Doc): Y.Map<YField> {
  return doc.getMap<YField>("players");
}

export function getRoutes(doc: Y.Doc): Y.Map<YField> {
  return doc.getMap<YField>("routes");
}

export function getRoutePoints(route: YField): YPoints | undefined {
  const points = route.get("points");
  return points instanceof Y.Array ? (points as YPoints) : undefined;
}

/** Transaction origin for edits made by this client, tracked by the UndoManager. */
export const LOCAL_ORIGIN = Symbol("local-edit");

export const DEFAULT_SPEED = 7;
export const DEFAULT_DELAY = 0;

/** Random id that works outside secure contexts (unlike crypto.randomUUID). */
export function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
}

export function encodeDoc(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

/** Postgres bytea literal accepted by PostgREST. */
export function toByteaHex(bytes: Uint8Array): string {
  return (
    "\\x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

/** Decode a bytea value as returned by PostgREST ("\x..." hex). */
export function fromByteaHex(value: string): Uint8Array {
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
