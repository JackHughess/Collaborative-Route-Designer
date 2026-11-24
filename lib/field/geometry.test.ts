import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  addPlayer,
  addRoute,
  createPlayDoc,
  movePlayer,
} from "@/lib/play/commands";
import { readPlayModel } from "@/lib/play/snapshot";
import type { PlayModel, Route } from "@/lib/play/types";
import {
  endAngle,
  playDuration,
  pointAtDistance,
  primaryRoute,
  routeSegments,
  samplePath,
  segmentsToPath,
  simulate,
} from "./geometry";

function route(
  partial: Partial<Route> & Pick<Route, "id" | "playerId">,
): Route {
  return {
    points: [],
    style: "solid",
    endCap: "arrow",
    speed: 5,
    delay: 0,
    option: false,
    ...partial,
  };
}

/** One player at (10, 0) running 10 yards straight downfield at 5 yd/s. */
function goRouteModel(overrides: Partial<Route> = {}): PlayModel {
  return {
    meta: { name: "Go", formation: "blank" },
    players: {
      p1: { id: "p1", label: "X", position: "WR", x: 10, y: 0, color: "#000" },
      p2: { id: "p2", label: "C", position: "OL", x: 26, y: -1, color: "#000" },
    },
    routes: {
      r1: route({
        id: "r1",
        playerId: "p1",
        points: [{ x: 10, y: 10, type: "line" }],
        ...overrides,
      }),
    },
  };
}

describe("route geometry", () => {
  it("builds straight and curved segments from the player's spot", () => {
    const segs = routeSegments({ x: 0, y: 0 }, [
      { x: 0, y: 5, type: "line" },
      { x: 5, y: 10, type: "curve" },
    ]);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ from: { x: 0, y: 0 }, to: { x: 0, y: 5 } });
    expect(segs[0].c1).toBeUndefined();
    expect(segs[1].c1).toBeDefined();
    expect(segs[1].c2).toBeDefined();
  });

  it("draws an SVG path with y flipped", () => {
    const segs = routeSegments({ x: 1, y: 0 }, [{ x: 1, y: 5, type: "line" }]);
    expect(segmentsToPath(segs)).toBe("M 1 0 L 1 -5");
    expect(segmentsToPath([])).toBe("");
  });

  it("reports the direction at the end of the route", () => {
    const up = routeSegments({ x: 0, y: 0 }, [{ x: 0, y: 5, type: "line" }]);
    expect(endAngle(up)).toBeCloseTo(Math.PI / 2);
    expect(endAngle([])).toBeUndefined();
  });
});

describe("path sampling", () => {
  it("measures straight paths exactly", () => {
    const start = { x: 0, y: 0 };
    const path = samplePath(
      start,
      routeSegments(start, [
        { x: 0, y: 5, type: "line" },
        { x: 3, y: 9, type: "line" },
      ]),
    );
    expect(path.length).toBeCloseTo(10);
    expect(pointAtDistance(path, 2.5)).toEqual({ x: 0, y: 2.5 });
    expect(pointAtDistance(path, 7.5)).toEqual({ x: 1.5, y: 7 });
  });

  it("clamps to the ends of the path", () => {
    const start = { x: 2, y: 2 };
    const path = samplePath(
      start,
      routeSegments(start, [{ x: 2, y: 4, type: "line" }]),
    );
    expect(pointAtDistance(path, -1)).toEqual({ x: 2, y: 2 });
    expect(pointAtDistance(path, 100)).toEqual({ x: 2, y: 4 });
  });

  it("curves are at least as long as the straight line between their ends", () => {
    const start = { x: 0, y: 0 };
    const curve = samplePath(
      start,
      routeSegments(start, [
        { x: 0, y: 5, type: "line" },
        { x: 5, y: 8, type: "curve" },
      ]),
    );
    expect(curve.length).toBeGreaterThan(5 + Math.hypot(5, 3) - 1e-9);
    expect(pointAtDistance(curve, curve.length)).toEqual({ x: 5, y: 8 });
  });
});

describe("simulate", () => {
  it("holds players still until their delay, then runs speed × (t − delay)", () => {
    const model = goRouteModel({ delay: 0.5 });
    expect(simulate(model, 0).p1).toEqual({ x: 10, y: 0 });
    expect(simulate(model, 0.5).p1).toEqual({ x: 10, y: 0 });
    expect(simulate(model, 1.5).p1).toEqual({ x: 10, y: 5 });
    expect(simulate(model, 100).p1).toEqual({ x: 10, y: 10 });
  });

  it("leaves players without a route at their spot", () => {
    expect(simulate(goRouteModel(), 3).p2).toEqual({ x: 26, y: -1 });
  });

  it("ignores option branches and picks the main route", () => {
    const model = goRouteModel();
    const withOption: PlayModel = {
      ...model,
      routes: {
        ...model.routes,
        a0: route({
          id: "a0",
          playerId: "p1",
          option: true,
          points: [{ x: 0, y: 0, type: "line" }],
        }),
      },
    };
    expect(primaryRoute(withOption, "p1")?.id).toBe("r1");
    expect(simulate(withOption, 1).p1).toEqual({ x: 10, y: 5 });
  });

  it("is deterministic: the same model and t give the same output", () => {
    const doc = createPlayDoc({ name: "D", formation: "shotgun-2x2" });
    for (const [i, id] of Object.keys(readPlayModel(doc).players).entries()) {
      addRoute(doc, id, {
        points: [
          { x: 5 + i, y: 6, type: "line" },
          { x: 10 + i * 2, y: 12, type: "curve" },
        ],
        delay: i * 0.1,
      });
    }
    const model = readPlayModel(doc);

    // A second client with the same state, built from the encoded document.
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    const otherModel = readPlayModel(other);

    for (const t of [0, 0.37, 1, 1.5, 2.25, 10]) {
      const a = simulate(model, t);
      expect(simulate(model, t)).toEqual(a);
      expect(simulate(otherModel, t)).toEqual(a);
      expect(simulate(structuredClone(model), t)).toEqual(a);
    }
  });

  it("uses the player's new spot when they move", () => {
    const doc = createPlayDoc({ name: "M", formation: "blank" });
    const id = addPlayer(doc, { label: "X", position: "WR", x: 10, y: -5 });
    addRoute(doc, id, { points: [{ x: 10, y: 10, type: "line" }], speed: 5 });
    const before = readPlayModel(doc);
    expect(simulate(before, 1)[id]).toEqual({ x: 10, y: 0 });
    movePlayer(doc, id, 10, -2);
    const after = readPlayModel(doc, before);
    expect(simulate(after, 0.5)[id]).toEqual({ x: 10, y: 0.5 });
  });
});

describe("playDuration", () => {
  it("is when the last player finishes", () => {
    expect(playDuration(goRouteModel({ delay: 0.5 }))).toBeCloseTo(2.5);
  });

  it("is zero with no routes", () => {
    expect(playDuration({ ...goRouteModel(), routes: {} })).toBe(0);
  });
});
