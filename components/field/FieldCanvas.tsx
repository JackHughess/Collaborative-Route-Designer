"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { DragPhase, Selection, Tool } from "@/components/editor/types";
import { PLAYER_RADIUS } from "@/lib/field/constants";
import { routeSegments, segmentsToPath, svgY } from "@/lib/field/geometry";
import { pan, viewBox, zoomAt, type Viewport } from "@/lib/field/viewport";
import type { Peer } from "@/lib/play/presence";
import type { PlayModel, Point } from "@/lib/play/types";
import { FieldBackground } from "./FieldBackground";
import { PlayerToken } from "./PlayerToken";
import { RemoteCursors } from "./RemoteCursors";
import { RouteShape } from "./RouteShape";

interface Props {
  model: PlayModel;
  /** Playback positions; when set, players are drawn here and editing is paused. */
  positions: Record<string, Point> | null;
  viewport: Viewport;
  onViewportChange: (vp: Viewport) => void;
  tool: Tool;
  selection: Selection;
  readOnly: boolean;
  peers: readonly Peer[];
  onSelect: (selection: Selection) => void;
  onPlayerDrag: (id: string, at: Point, phase: DragPhase) => void;
  onPointDrag: (
    routeId: string,
    index: number,
    at: Point,
    phase: DragPhase,
  ) => void;
  /** A click (not a drag) on empty field in the player or route tool. */
  onFieldClick: (at: Point) => void;
  onFinishRoute: () => void;
  onCursorMove: (at: Point | null) => void;
}

type Gesture =
  | {
      kind: "pan";
      startClient: Point;
      startVp: Viewport;
      unitsPerPx: number;
      moved: boolean;
    }
  | { kind: "player"; id: string; offset: Point; moved: boolean }
  | { kind: "point"; routeId: string; index: number; moved: boolean }
  | { kind: "pinch"; startDist: number; startVp: Viewport; center: Point };

const TAP_SLOP_PX = 5;

export function FieldCanvas(props: Props) {
  const {
    model,
    positions,
    viewport,
    onViewportChange,
    tool,
    selection,
    readOnly,
    peers,
  } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const [grabbing, setGrabbing] = useState(false);
  const playing = positions !== null;
  const canEdit = !readOnly && !playing;

  /** Client pixels to SVG user units (yards, SVG y). */
  function toSvg(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function toField(clientX: number, clientY: number): Point {
    const p = toSvg(clientX, clientY);
    return { x: p.x, y: svgY(p.y) };
  }

  function unitsPerPx() {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? 1 / ctm.a : 0.1;
  }

  function startPinch() {
    const [a, b] = Array.from(pointers.current.values());
    endGesture(false);
    gesture.current = {
      kind: "pinch",
      startDist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      startVp: viewport,
      center: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  }

  /** Finish whatever gesture is running; `commit` is false when a pinch interrupts it. */
  function endGesture(commit: boolean, e?: PointerEvent) {
    const g = gesture.current;
    gesture.current = null;
    setGrabbing(false);
    if (!g || !e) {
      if (g?.kind === "player" && g.moved)
        props.onPlayerDrag(g.id, positionOf(g.id), "end");
      return;
    }
    const at = toField(e.clientX, e.clientY);
    if (g.kind === "player" && g.moved) {
      props.onPlayerDrag(
        g.id,
        { x: at.x + g.offset.x, y: at.y + g.offset.y },
        "end",
      );
    } else if (g.kind === "point" && g.moved) {
      props.onPointDrag(g.routeId, g.index, at, "end");
    } else if (g.kind === "pan" && !g.moved && commit) {
      if (tool === "select") {
        props.onSelect({ playerId: null, routeId: null, pointIndex: null });
      } else if (canEdit) {
        props.onFieldClick(at);
      }
    }
  }

  function positionOf(id: string): Point {
    const p = model.players[id];
    return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  }

  function capture(e: PointerEvent) {
    svgRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  // ── Pointer handlers ──────────────────────────────────────────────

  function onBackgroundDown(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    capture(e);
    if (pointers.current.size === 2) return startPinch();
    gesture.current = {
      kind: "pan",
      startClient: { x: e.clientX, y: e.clientY },
      startVp: viewport,
      unitsPerPx: unitsPerPx(),
      moved: false,
    };
  }

  function onPlayerDown(e: PointerEvent, id: string) {
    e.stopPropagation();
    capture(e);
    if (pointers.current.size === 2) return startPinch();
    props.onSelect({
      playerId: id,
      routeId: selection.playerId === id ? selection.routeId : null,
      pointIndex: null,
    });
    if (!canEdit) {
      // Still allow panning from a player while playing or read-only.
      gesture.current = {
        kind: "pan",
        startClient: { x: e.clientX, y: e.clientY },
        startVp: viewport,
        unitsPerPx: unitsPerPx(),
        moved: true,
      };
      return;
    }
    const at = toField(e.clientX, e.clientY);
    const p = positionOf(id);
    gesture.current = {
      kind: "player",
      id,
      offset: { x: p.x - at.x, y: p.y - at.y },
      moved: false,
    };
  }

  function onRouteDown(e: PointerEvent, routeId: string, playerId: string) {
    e.stopPropagation();
    if (tool === "route" && canEdit && selection.routeId === routeId) {
      // Clicking your own route while drawing adds a point there instead.
      onBackgroundDown(e as PointerEvent<SVGSVGElement>);
      return;
    }
    capture(e);
    props.onSelect({ playerId, routeId, pointIndex: null });
  }

  function onHandleDown(e: PointerEvent, routeId: string, index: number) {
    e.stopPropagation();
    capture(e);
    if (pointers.current.size === 2) return startPinch();
    props.onSelect({
      playerId: selection.playerId,
      routeId,
      pointIndex: index,
    });
    if (canEdit)
      gesture.current = { kind: "point", routeId, index, moved: false };
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const at = toField(e.clientX, e.clientY);
    props.onCursorMove(at);

    const g = gesture.current;
    if (!g) return;
    switch (g.kind) {
      case "pinch": {
        const [a, b] = Array.from(pointers.current.values());
        if (!a || !b) return;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        onViewportChange(zoomAt(g.startVp, dist / g.startDist, g.center));
        return;
      }
      case "pan": {
        const dx = e.clientX - g.startClient.x;
        const dy = e.clientY - g.startClient.y;
        if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
        g.moved = true;
        setGrabbing(true);
        onViewportChange(
          pan(g.startVp, -dx * g.unitsPerPx, -dy * g.unitsPerPx),
        );
        return;
      }
      case "player": {
        const to = { x: at.x + g.offset.x, y: at.y + g.offset.y };
        if (!g.moved) props.onPlayerDrag(g.id, to, "start");
        g.moved = true;
        props.onPlayerDrag(g.id, to, "move");
        return;
      }
      case "point": {
        if (!g.moved) props.onPointDrag(g.routeId, g.index, at, "start");
        g.moved = true;
        props.onPointDrag(g.routeId, g.index, at, "move");
        return;
      }
    }
  }

  function onPointerUp(e: PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    endGesture(e.type === "pointerup", e);
  }

  // React wheel listeners are passive, so attach one that can stop the page
  // from scrolling or browser-zooming (trackpad pinch sends ctrl+wheel).
  const onWheel = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    onWheel.current = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      onViewportChange(zoomAt(viewport, factor, toSvg(e.clientX, e.clientY)));
    };
  });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const listener = (e: WheelEvent) => onWheel.current(e);
    svg.addEventListener("wheel", listener, { passive: false });
    return () => svg.removeEventListener("wheel", listener);
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  const players = Object.values(model.players);
  const routes = Object.values(model.routes).filter(
    (r) => model.players[r.playerId],
  );
  const selectedRoute = selection.routeId
    ? model.routes[selection.routeId]
    : undefined;
  const selectedRoutePlayer =
    selectedRoute && model.players[selectedRoute.playerId];

  const remoteByPlayer = new Map<string, string[]>();
  for (const peer of peers) {
    for (const id of peer.selectedIds) {
      remoteByPlayer.set(id, [
        ...(remoteByPlayer.get(id) ?? []),
        peer.user.color,
      ]);
    }
  }

  const cursor = grabbing
    ? "cursor-grabbing"
    : tool === "select" || !canEdit
      ? "cursor-grab"
      : "cursor-crosshair";

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox(viewport)}
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full touch-none select-none ${cursor}`}
      role="application"
      aria-label="Football field. Use the toolbar or keyboard shortcuts to edit."
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => props.onCursorMove(null)}
      onDoubleClick={() => tool === "route" && props.onFinishRoute()}
    >
      <FieldBackground />

      {routes.map((route) => {
        const player = model.players[route.playerId];
        const selected = route.id === selection.routeId;
        return (
          <g key={route.id}>
            <RouteShape
              route={route}
              player={player}
              selected={selected}
              muted={playing || (route.option && !selected)}
            />
            {/* Wide invisible stroke so thin routes are easy to click. */}
            <path
              d={segmentsToPath(routeSegments(player, route.points))}
              fill="none"
              stroke="transparent"
              strokeWidth={1.2}
              pointerEvents="stroke"
              className="cursor-pointer"
              onPointerDown={(e) => onRouteDown(e, route.id, route.playerId)}
            />
          </g>
        );
      })}

      {players.map((player) => (
        <g
          key={player.id}
          onPointerDown={(e) => onPlayerDown(e, player.id)}
          onFocus={() => {
            if (selection.playerId !== player.id) {
              props.onSelect({
                playerId: player.id,
                routeId: null,
                pointIndex: null,
              });
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Player ${player.label}, ${player.position}`}
          aria-pressed={player.id === selection.playerId}
          className={`outline-none focus-visible:[&>g>circle:last-of-type]:stroke-yellow-300 ${canEdit ? "cursor-move" : "cursor-pointer"}`}
          data-player-id={player.id}
        >
          <PlayerToken
            player={player}
            at={positions?.[player.id] ?? player}
            selected={player.id === selection.playerId}
            remoteColors={remoteByPlayer.get(player.id)}
          />
          {/* Larger touch target than the drawn circle. */}
          <circle
            cx={(positions?.[player.id] ?? player).x}
            cy={svgY((positions?.[player.id] ?? player).y)}
            r={PLAYER_RADIUS + 0.6}
            fill="transparent"
          />
        </g>
      ))}

      {selectedRoute && selectedRoutePlayer && !playing && (
        <g>
          {selectedRoute.points.map((p, i) => {
            const active = selection.pointIndex === i;
            return (
              <g
                key={i}
                onPointerDown={(e) => onHandleDown(e, selectedRoute.id, i)}
                className={canEdit ? "cursor-move" : "cursor-pointer"}
                data-point-index={i}
              >
                <circle cx={p.x} cy={svgY(p.y)} r={0.9} fill="transparent" />
                {p.type === "curve" ? (
                  <circle
                    cx={p.x}
                    cy={svgY(p.y)}
                    r={active ? 0.5 : 0.38}
                    fill="white"
                    stroke={selectedRoutePlayer.color}
                    strokeWidth={0.14}
                  />
                ) : (
                  <rect
                    x={p.x - (active ? 0.45 : 0.34)}
                    y={svgY(p.y) - (active ? 0.45 : 0.34)}
                    width={active ? 0.9 : 0.68}
                    height={active ? 0.9 : 0.68}
                    fill="white"
                    stroke={selectedRoutePlayer.color}
                    strokeWidth={0.14}
                  />
                )}
              </g>
            );
          })}
        </g>
      )}

      <RemoteCursors peers={peers} />
    </svg>
  );
}
