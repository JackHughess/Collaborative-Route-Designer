import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { FIELD_WIDTH, MAX_PLAYER_Y, MIN_Y } from "@/lib/field/constants";
import {
  addOptionRoute,
  addPlayer,
  addRoute,
  addRoutePoint,
  applyFormation,
  createPlayDoc,
  deletePlayer,
  deleteRoute,
  deleteRoutePoint,
  movePlayer,
  moveRoutePoint,
  setNotes,
  setPlayName,
  setRouteOption,
  setRoutePointType,
  setRouteStyle,
  setRouteTiming,
  updatePlayer,
} from "./commands";
import { getFormation } from "./formations";
import { LOCAL_ORIGIN, fromByteaHex, toByteaHex } from "./schema";
import { readPlayModel } from "./snapshot";

function blankDoc() {
  return createPlayDoc({ name: "Test", formation: "blank" });
}

function withPlayer(doc = blankDoc()) {
  const id = addPlayer(doc, { label: "X", position: "WR", x: 5, y: -1 });
  return { doc, id };
}

const model = (doc: Y.Doc) => readPlayModel(doc);

/** Two docs that start from the same state, like two connected clients. */
function forkedDocs() {
  const a = createPlayDoc({ name: "Shared", formation: "shotgun-2x2" });
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return { a, b };
}

function sync(a: Y.Doc, b: Y.Doc) {
  const toB = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b));
  const toA = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a));
  Y.applyUpdate(b, toB);
  Y.applyUpdate(a, toA);
}

describe("play", () => {
  it("creates a play with metadata and a formation", () => {
    const doc = createPlayDoc({ name: "Mesh", formation: "i-form" });
    const m = model(doc);
    expect(m.meta).toEqual({ name: "Mesh", formation: "i-form" });
    expect(Object.keys(m.players)).toHaveLength(
      getFormation("i-form")!.players.length,
    );
    expect(Object.values(m.players).map((p) => p.label)).toContain("FB");
  });

  it("renames, ignoring blank names", () => {
    const doc = blankDoc();
    setPlayName(doc, "  Smash  ");
    setPlayName(doc, "   ");
    expect(model(doc).meta.name).toBe("Smash");
  });

  it("sets notes", () => {
    const doc = blankDoc();
    setNotes(doc, "Hot vs blitz");
    expect(model(doc).meta.notes).toBe("Hot vs blitz");
  });

  it("applying a formation replaces players and routes", () => {
    const { doc, id } = withPlayer();
    addRoute(doc, id, { points: [{ x: 5, y: 10, type: "line" }] });
    applyFormation(doc, "empty");
    const m = model(doc);
    expect(m.meta.formation).toBe("empty");
    expect(Object.keys(m.routes)).toHaveLength(0);
    expect(Object.values(m.players).some((p) => p.id === id)).toBe(false);
    expect(() => applyFormation(doc, "nope")).toThrow();
  });
});

describe("players", () => {
  it("adds a player with a colour for its position", () => {
    const { doc, id } = withPlayer();
    expect(model(doc).players[id]).toMatchObject({
      label: "X",
      position: "WR",
      x: 5,
      y: -1,
      color: "#2563eb",
    });
  });

  it("moves a player and clamps to the field", () => {
    const { doc, id } = withPlayer();
    movePlayer(doc, id, 10.123, -3.456);
    expect(model(doc).players[id]).toMatchObject({ x: 10.12, y: -3.46 });
    movePlayer(doc, id, -5, 999);
    expect(model(doc).players[id]).toMatchObject({ x: 0, y: MAX_PLAYER_Y });
    movePlayer(doc, id, 999, -999);
    expect(model(doc).players[id]).toMatchObject({ x: FIELD_WIDTH, y: MIN_Y });
  });

  it("updates label, position and colour", () => {
    const { doc, id } = withPlayer();
    updatePlayer(doc, id, { label: "SLOT1", position: "TE", color: "#000000" });
    expect(model(doc).players[id]).toMatchObject({
      label: "SLOT",
      position: "TE",
      color: "#000000",
    });
  });

  it("deleting a player deletes their routes in one transaction", () => {
    const { doc, id } = withPlayer();
    const other = addPlayer(doc, { label: "Z", position: "WR", x: 40, y: -1 });
    addRoute(doc, id);
    addRoute(doc, id, { option: true });
    const keep = addRoute(doc, other)!;

    let updates = 0;
    doc.on("update", () => updates++);
    deletePlayer(doc, id);

    expect(updates).toBe(1);
    const m = model(doc);
    expect(m.players[id]).toBeUndefined();
    expect(Object.keys(m.routes)).toEqual([keep]);
  });

  it("ignores unknown ids", () => {
    const doc = blankDoc();
    expect(() => movePlayer(doc, "missing", 1, 1)).not.toThrow();
    expect(addRoute(doc, "missing")).toBeUndefined();
  });
});

describe("routes", () => {
  it("adds a route with defaults", () => {
    const { doc, id } = withPlayer();
    const routeId = addRoute(doc, id)!;
    expect(model(doc).routes[routeId]).toEqual({
      id: routeId,
      playerId: id,
      points: [],
      style: "solid",
      endCap: "arrow",
      speed: 7,
      delay: 0,
      option: false,
    });
  });

  it("adds, inserts, moves, retypes and deletes points", () => {
    const { doc, id } = withPlayer();
    const r = addRoute(doc, id)!;
    expect(addRoutePoint(doc, r, { x: 5, y: 5, type: "line" })).toBe(0);
    expect(addRoutePoint(doc, r, { x: 15, y: 12, type: "line" })).toBe(1);
    expect(addRoutePoint(doc, r, { x: 10, y: 8, type: "curve" }, 1)).toBe(1);
    expect(model(doc).routes[r].points.map((p) => p.x)).toEqual([5, 10, 15]);

    moveRoutePoint(doc, r, 0, 6, 7);
    setRoutePointType(doc, r, 2, "curve");
    deleteRoutePoint(doc, r, 1);
    deleteRoutePoint(doc, r, 99);

    expect(model(doc).routes[r].points).toEqual([
      { x: 6, y: 7, type: "line" },
      { x: 15, y: 12, type: "curve" },
    ]);
  });

  it("sets style, end cap, timing and option flag", () => {
    const { doc, id } = withPlayer();
    const r = addRoute(doc, id)!;
    setRouteStyle(doc, r, { style: "dashed" });
    setRouteStyle(doc, r, { endCap: "block" });
    setRouteTiming(doc, r, { speed: 8.5, delay: 0.25 });
    setRouteOption(doc, r, true);
    expect(model(doc).routes[r]).toMatchObject({
      style: "dashed",
      endCap: "block",
      speed: 8.5,
      delay: 0.25,
      option: true,
    });

    setRouteTiming(doc, r, { speed: 100, delay: -1 });
    setRouteTiming(doc, r, { speed: Number.NaN });
    expect(model(doc).routes[r]).toMatchObject({ speed: 15, delay: 0 });
  });

  it("adds an option branch sharing the stem", () => {
    const { doc, id } = withPlayer();
    const r = addRoute(doc, id, {
      points: [
        { x: 5, y: 6, type: "line" },
        { x: 12, y: 10, type: "curve" },
      ],
      speed: 8,
    })!;
    const branch = addOptionRoute(doc, r, 0)!;
    expect(model(doc).routes[branch]).toMatchObject({
      playerId: id,
      points: [{ x: 5, y: 6, type: "line" }],
      style: "dashed",
      speed: 8,
      option: true,
    });
  });

  it("deletes a route", () => {
    const { doc, id } = withPlayer();
    const r = addRoute(doc, id)!;
    deleteRoute(doc, r);
    expect(model(doc).routes[r]).toBeUndefined();
  });
});

describe("transactions and undo", () => {
  it("each command is one local transaction", () => {
    const { doc, id } = withPlayer();
    const origins: unknown[] = [];
    doc.on("afterTransaction", (tr: Y.Transaction) => origins.push(tr.origin));
    movePlayer(doc, id, 20, 2);
    updatePlayer(doc, id, { label: "Y", color: "#111111" });
    expect(origins).toEqual([LOCAL_ORIGIN, LOCAL_ORIGIN]);
  });

  it("undo and redo with an UndoManager tracking local edits", () => {
    const { doc, id } = withPlayer();
    const undo = new Y.UndoManager(
      [doc.getMap("meta"), doc.getMap("players"), doc.getMap("routes")],
      { trackedOrigins: new Set([LOCAL_ORIGIN]), captureTimeout: 0 },
    );
    movePlayer(doc, id, 30, -4);
    deletePlayer(doc, id);
    undo.undo();
    expect(model(doc).players[id]).toMatchObject({ x: 30, y: -4 });
    undo.undo();
    expect(model(doc).players[id]).toMatchObject({ x: 5, y: -1 });
    undo.redo();
    expect(model(doc).players[id]).toMatchObject({ x: 30, y: -4 });
  });
});

describe("concurrent edits", () => {
  it("edits to different players both survive", () => {
    const { a, b } = forkedDocs();
    const [p1, p2] = Object.keys(model(a).players);
    movePlayer(a, p1, 10, -3);
    movePlayer(b, p2, 20, -4);
    sync(a, b);
    expect(model(a)).toEqual(model(b));
    expect(model(a).players[p1]).toMatchObject({ x: 10, y: -3 });
    expect(model(a).players[p2]).toMatchObject({ x: 20, y: -4 });
  });

  it("edits to different fields of one player merge", () => {
    const { a, b } = forkedDocs();
    const id = Object.keys(model(a).players)[0];
    updatePlayer(a, id, { label: "Q" });
    updatePlayer(b, id, { color: "#123456" });
    sync(a, b);
    expect(model(a).players[id]).toMatchObject({
      label: "Q",
      color: "#123456",
    });
    expect(model(a)).toEqual(model(b));
  });

  it("two people dragging the same route point converge without duplicating it", () => {
    const { a, b } = forkedDocs();
    const player = Object.keys(model(a).players)[0];
    const r = addRoute(a, player, { points: [{ x: 5, y: 5, type: "line" }] })!;
    sync(a, b);
    moveRoutePoint(a, r, 0, 8, 9);
    moveRoutePoint(b, r, 0, 12, 14);
    sync(a, b);
    expect(model(a).routes[r].points).toHaveLength(1);
    expect(model(a)).toEqual(model(b));
  });

  it("points added concurrently to one route are both kept", () => {
    const { a, b } = forkedDocs();
    const player = Object.keys(model(a).players)[0];
    const r = addRoute(a, player)!;
    sync(a, b);
    addRoutePoint(a, r, { x: 1, y: 1, type: "line" });
    addRoutePoint(b, r, { x: 2, y: 2, type: "line" });
    sync(a, b);
    expect(model(a).routes[r].points).toHaveLength(2);
    expect(model(a)).toEqual(model(b));
  });

  it("deleting a player while someone edits their route leaves no orphans after sync", () => {
    const { a, b } = forkedDocs();
    const player = Object.keys(model(a).players)[0];
    const r = addRoute(a, player, { points: [{ x: 5, y: 5, type: "line" }] })!;
    sync(a, b);
    deletePlayer(a, player);
    moveRoutePoint(b, r, 0, 6, 6);
    sync(a, b);
    expect(model(a).routes[r]).toBeUndefined();
    expect(model(a)).toEqual(model(b));
  });
});

describe("snapshot encoding", () => {
  it("round-trips through a bytea hex string", () => {
    const doc = createPlayDoc({ name: "Hex", formation: "shotgun-2x2" });
    const copy = new Y.Doc();
    Y.applyUpdate(copy, fromByteaHex(toByteaHex(Y.encodeStateAsUpdate(doc))));
    expect(model(copy)).toEqual(model(doc));
  });

  it("keeps unchanged elements' identity between snapshots", () => {
    const { doc, id } = withPlayer();
    const other = addPlayer(doc, { label: "Z", position: "WR", x: 40, y: -1 });
    const before = readPlayModel(doc);
    movePlayer(doc, id, 9, 9);
    const after = readPlayModel(doc, before);
    expect(after.players[other]).toBe(before.players[other]);
    expect(after.players[id]).not.toBe(before.players[id]);
    expect(after.meta).toBe(before.meta);
  });
});
