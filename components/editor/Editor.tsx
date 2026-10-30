"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Y from "yjs";
import { FieldCanvas } from "@/components/field/FieldCanvas";
import { FIELD_CENTER_X } from "@/lib/field/constants";
import { distance } from "@/lib/field/geometry";
import {
  DEFAULT_VIEWPORT,
  pan,
  zoomCenter,
  type Viewport,
} from "@/lib/field/viewport";
import {
  addPlayer,
  addRoute,
  addRoutePoint,
  deletePlayer,
  deleteRoute,
  deleteRoutePoint,
  movePlayer,
  moveRoutePoint,
} from "@/lib/play/commands";
import type { Peer } from "@/lib/play/presence";
import {
  LOCAL_ORIGIN,
  getMeta,
  getPlayers,
  getRoutes,
} from "@/lib/play/schema";
import type { PlayModel, Point, SegmentType } from "@/lib/play/types";
import { usePlayModel } from "@/lib/play/usePlayModel";
import { throttle } from "@/lib/throttle";
import { Inspector } from "./Inspector";
import { PlaybackBar } from "./PlaybackBar";
import { Toolbar } from "./Toolbar";
import {
  EMPTY_SELECTION,
  type DragPhase,
  type Selection,
  type Tool,
} from "./types";
import { usePlayback } from "./usePlayback";

export interface PresenceUpdate {
  cursor: Point | null;
  selectedIds: string[];
}

interface Props {
  doc: Y.Doc;
  readOnly: boolean;
  canRename: boolean;
  peers?: readonly Peer[];
  onPresence?: (update: Partial<PresenceUpdate>) => void;
  /** Top bar: title, connection status, avatars, share button. */
  header: ReactNode;
  /** Shown above the field, e.g. offline or read-only notices. */
  banner?: ReactNode;
}

/** Writes from drags go out at about 30 per second. */
const DRAG_WRITE_MS = 33;

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/** Drop parts of the selection that no longer exist (e.g. deleted by someone else). */
function validSelection(model: PlayModel, s: Selection): Selection {
  const playerId = s.playerId && model.players[s.playerId] ? s.playerId : null;
  const route = s.routeId ? model.routes[s.routeId] : undefined;
  const routeId = route && route.playerId === playerId ? route.id : null;
  const pointIndex =
    route &&
    routeId &&
    s.pointIndex !== null &&
    s.pointIndex < route.points.length
      ? s.pointIndex
      : null;
  if (
    playerId === s.playerId &&
    routeId === s.routeId &&
    pointIndex === s.pointIndex
  ) {
    return s;
  }
  return { playerId, routeId, pointIndex };
}

export function Editor({
  doc,
  readOnly,
  canRename,
  peers = [],
  onPresence,
  header,
  banner,
}: Props) {
  const model = usePlayModel(doc);
  const [tool, setTool] = useState<Tool>("select");
  const [segmentType, setSegmentType] = useState<SegmentType>("line");
  const [rawSelection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [rawHint, setHint] = useState<string | null>(null);
  const selection = validSelection(model, rawSelection);
  const playback = usePlayback(model);

  // ── Undo ──────────────────────────────────────────────────────────
  const undoManager = useMemo(
    () =>
      new Y.UndoManager([getMeta(doc), getPlayers(doc), getRoutes(doc)], {
        trackedOrigins: new Set([LOCAL_ORIGIN]),
        captureTimeout: 400,
      }),
    [doc],
  );
  const [undoState, setUndoState] = useState({
    canUndo: false,
    canRedo: false,
  });
  useEffect(() => {
    const update = () =>
      setUndoState({
        canUndo: undoManager.canUndo(),
        canRedo: undoManager.canRedo(),
      });
    undoManager.on("stack-item-added", update);
    undoManager.on("stack-item-popped", update);
    undoManager.on("stack-cleared", update);
    // Only detach listeners: StrictMode re-runs effects, and destroying the
    // manager here would stop it tracking. It goes away with the doc.
    return () => {
      undoManager.off("stack-item-added", update);
      undoManager.off("stack-item-popped", update);
      undoManager.off("stack-cleared", update);
    };
  }, [undoManager]);

  const undo = useCallback(
    () => !readOnly && undoManager.undo(),
    [readOnly, undoManager],
  );
  const redo = useCallback(
    () => !readOnly && undoManager.redo(),
    [readOnly, undoManager],
  );

  // ── Presence ──────────────────────────────────────────────────────
  const selectedIds = useMemo(
    () =>
      [selection.playerId, selection.routeId].filter(
        (id): id is string => !!id,
      ),
    [selection.playerId, selection.routeId],
  );
  useEffect(() => {
    onPresence?.({ selectedIds });
  }, [onPresence, selectedIds]);

  // ── Drags (throttled writes) ──────────────────────────────────────
  const playerWriter = useMemo(
    () =>
      throttle(
        (id: string, at: Point) => movePlayer(doc, id, at.x, at.y),
        DRAG_WRITE_MS,
      ),
    [doc],
  );
  const pointWriter = useMemo(
    () =>
      throttle(
        (routeId: string, index: number, at: Point) =>
          moveRoutePoint(doc, routeId, index, at.x, at.y),
        DRAG_WRITE_MS,
      ),
    [doc],
  );

  const onPlayerDrag = useCallback(
    (id: string, at: Point, phase: DragPhase) => {
      if (readOnly) return;
      if (phase === "start") undoManager.stopCapturing();
      playerWriter.call(id, at);
      if (phase === "end") {
        playerWriter.flush();
        undoManager.stopCapturing();
      }
    },
    [readOnly, playerWriter, undoManager],
  );

  const onPointDrag = useCallback(
    (routeId: string, index: number, at: Point, phase: DragPhase) => {
      if (readOnly) return;
      if (phase === "start") undoManager.stopCapturing();
      pointWriter.call(routeId, index, at);
      if (phase === "end") {
        pointWriter.flush();
        undoManager.stopCapturing();
      }
    },
    [readOnly, pointWriter, undoManager],
  );

  // ── Clicks on the field ───────────────────────────────────────────
  const onFieldClick = useCallback(
    (at: Point) => {
      if (readOnly) return;
      if (tool === "player") {
        const count = Object.keys(model.players).length;
        const id = addPlayer(doc, {
          label: `P${count + 1}`,
          position: "WR",
          x: at.x,
          y: at.y,
        });
        setSelection({ playerId: id, routeId: null, pointIndex: null });
        setTool("select");
        return;
      }
      if (tool === "route") {
        const playerId = selection.playerId;
        if (!playerId) {
          setHint("Select a player first, then click to draw their route.");
          return;
        }
        const route = selection.routeId
          ? model.routes[selection.routeId]
          : undefined;
        if (route) {
          // Ignore the second click of a double-click (which finishes the route).
          const last =
            route.points[route.points.length - 1] ?? model.players[playerId];
          if (last && distance(last, at) < 0.35) return;
          const index = addRoutePoint(doc, route.id, {
            ...at,
            type: segmentType,
          });
          setSelection({
            playerId,
            routeId: route.id,
            pointIndex: index ?? null,
          });
        } else {
          const routeId = addRoute(doc, playerId, {
            points: [{ ...at, type: segmentType }],
          });
          setSelection({ playerId, routeId: routeId ?? null, pointIndex: 0 });
        }
      }
    },
    [doc, model, readOnly, segmentType, selection, tool],
  );

  const finishRoute = useCallback(() => {
    setTool("select");
    setSelection((s) => ({ ...s, pointIndex: null }));
  }, []);

  const deleteSelection = useCallback(() => {
    if (readOnly) return;
    const s = selection;
    if (s.routeId && s.pointIndex !== null) {
      deleteRoutePoint(doc, s.routeId, s.pointIndex);
      setSelection({ ...s, pointIndex: null });
    } else if (s.routeId) {
      deleteRoute(doc, s.routeId);
      setSelection({ ...s, routeId: null, pointIndex: null });
    } else if (s.playerId) {
      deletePlayer(doc, s.playerId);
      setSelection(EMPTY_SELECTION);
    }
  }, [doc, readOnly, selection]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const s = selection;
      if (readOnly || playback.active) return;
      if (s.routeId && s.pointIndex !== null) {
        const p = model.routes[s.routeId]?.points[s.pointIndex];
        if (p) moveRoutePoint(doc, s.routeId, s.pointIndex, p.x + dx, p.y + dy);
      } else if (s.playerId) {
        const p = model.players[s.playerId];
        if (p) movePlayer(doc, p.id, p.x + dx, p.y + dy);
      } else {
        // Nothing selected: arrows pan the view.
        setViewport((vp) => pan(vp, dx * 2, -dy * 2));
      }
    },
    [doc, model, playback.active, readOnly, selection],
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod || e.altKey) return;

      const step = e.shiftKey ? 2.5 : 0.5;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          return nudge(-step, 0);
        case "ArrowRight":
          e.preventDefault();
          return nudge(step, 0);
        case "ArrowUp":
          e.preventDefault();
          return nudge(0, step);
        case "ArrowDown":
          e.preventDefault();
          return nudge(0, -step);
        case "Delete":
        case "Backspace":
          e.preventDefault();
          return deleteSelection();
        case "Escape":
          if (tool !== "select") return finishRoute();
          return setSelection(EMPTY_SELECTION);
        case " ":
          // Let Space activate a focused button instead of toggling playback.
          if (e.target instanceof HTMLButtonElement) return;
          e.preventDefault();
          return playback.toggle();
        case "+":
        case "=":
          return setViewport((vp) => zoomCenter(vp, 1.25));
        case "-":
        case "_":
          return setViewport((vp) => zoomCenter(vp, 0.8));
        case "0":
          return setViewport(DEFAULT_VIEWPORT);
      }
      switch (key) {
        case "v":
          return setTool("select");
        case "p":
          return !readOnly && setTool("player");
        case "r":
          return !readOnly && setTool("route");
        case "l":
          return setSegmentType("line");
        case "c":
          return setSegmentType("curve");
        case "k":
          return playback.restart();
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const onCursorMove = useCallback(
    (at: Point | null) => onPresence?.({ cursor: at }),
    [onPresence],
  );

  // The "select a player first" hint goes away once they do.
  const hint = selection.playerId ? null : rawHint;
  const routeHint =
    tool === "route" && !readOnly
      ? selection.playerId
        ? "Click the field to add points. Double-click or press Esc to finish."
        : "Select a player to draw their route."
      : tool === "player"
        ? "Click the field to place a player."
        : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {header}
      <Toolbar
        tool={tool}
        segmentType={segmentType}
        readOnly={readOnly}
        canUndo={undoState.canUndo}
        canRedo={undoState.canRedo}
        onTool={setTool}
        onSegmentType={setSegmentType}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={() => setViewport((vp) => zoomCenter(vp, 1.25))}
        onZoomOut={() => setViewport((vp) => zoomCenter(vp, 0.8))}
        onZoomReset={() => setViewport(DEFAULT_VIEWPORT)}
      />
      {banner}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 flex-1 bg-emerald-900">
          <FieldCanvas
            model={model}
            positions={playback.positions}
            viewport={viewport}
            onViewportChange={setViewport}
            tool={readOnly ? "select" : tool}
            selection={selection}
            readOnly={readOnly}
            peers={peers}
            onSelect={setSelection}
            onPlayerDrag={onPlayerDrag}
            onPointDrag={onPointDrag}
            onFieldClick={onFieldClick}
            onFinishRoute={finishRoute}
            onCursorMove={onCursorMove}
          />
          {(hint ?? routeHint) && (
            <p
              role="status"
              className="pointer-events-none absolute top-2 left-1/2 max-w-[90%] -translate-x-1/2 rounded-md bg-black/70 px-3 py-1.5 text-center text-sm text-white"
            >
              {hint ?? routeHint}
            </p>
          )}
          {Object.keys(model.players).length === 0 && !readOnly && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <button
                type="button"
                className="rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-zinc-900 shadow hover:bg-white"
                onClick={() => {
                  const id = addPlayer(doc, {
                    label: "QB",
                    position: "QB",
                    x: FIELD_CENTER_X,
                    y: -5,
                  });
                  setSelection({
                    playerId: id,
                    routeId: null,
                    pointIndex: null,
                  });
                }}
              >
                The field is empty. Add a quarterback
              </button>
            </div>
          )}
        </div>
        <aside
          aria-label="Selection details"
          className="max-h-[40vh] shrink-0 overflow-y-auto border-t border-zinc-200 md:max-h-none md:w-80 md:border-t-0 md:border-l dark:border-zinc-800"
        >
          <Inspector
            doc={doc}
            model={model}
            selection={selection}
            readOnly={readOnly}
            canRename={canRename}
            onSelect={setSelection}
            onTool={(t) => !readOnly && setTool(t)}
          />
        </aside>
      </div>
      <PlaybackBar playback={playback} />
    </div>
  );
}
