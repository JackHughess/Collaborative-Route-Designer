"use client";

import { useId } from "react";
import type * as Y from "yjs";
import {
  addOptionRoute,
  applyFormation,
  deletePlayer,
  deleteRoute,
  deleteRoutePoint,
  setNotes,
  setPlayName,
  setRouteOption,
  setRoutePointType,
  setRouteStyle,
  setRouteTiming,
  updatePlayer,
} from "@/lib/play/commands";
import { FORMATIONS, POSITION_COLORS } from "@/lib/play/formations";
import type { PlayModel, Route } from "@/lib/play/types";
import {
  button,
  buttonDanger,
  input,
  label as labelClass,
  toggle,
} from "@/components/ui";
import { CommitInput, CommitTextarea } from "./CommitInput";
import type { Selection, Tool } from "./types";

interface Props {
  doc: Y.Doc;
  model: PlayModel;
  selection: Selection;
  readOnly: boolean;
  canRename: boolean;
  onSelect: (selection: Selection) => void;
  onTool: (tool: Tool) => void;
}

const POSITIONS = Object.keys(POSITION_COLORS);

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-zinc-200 p-4 last:border-b-0 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Inspector(props: Props) {
  const { model, selection } = props;
  const player = selection.playerId
    ? model.players[selection.playerId]
    : undefined;

  return (
    <div className="text-sm">
      {player ? <PlayerPanel {...props} /> : <PlayPanel {...props} />}
    </div>
  );
}

function PlayPanel({ doc, model, readOnly, canRename }: Props) {
  const id = useId();
  return (
    <>
      <Section title="Play">
        <div className="space-y-1">
          <label htmlFor={`${id}-name`} className={labelClass}>
            Name
          </label>
          <CommitInput
            id={`${id}-name`}
            className={input}
            value={model.meta.name}
            maxLength={120}
            disabled={readOnly || !canRename}
            title={canRename ? undefined : "Only the owner can rename the play"}
            onCommit={(v) => setPlayName(doc, v)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-formation`} className={labelClass}>
            Starting formation
          </label>
          <select
            id={`${id}-formation`}
            className={input}
            value={model.meta.formation}
            disabled={readOnly}
            onChange={(e) => {
              if (
                window.confirm(
                  "Replace every player and route with this formation? You can undo this.",
                )
              ) {
                applyFormation(doc, e.target.value);
              }
            }}
          >
            {!FORMATIONS.some((f) => f.id === model.meta.formation) && (
              <option value={model.meta.formation}>Custom</option>
            )}
            {FORMATIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-notes`} className={labelClass}>
            Notes
          </label>
          <CommitTextarea
            id={`${id}-notes`}
            className={input}
            rows={3}
            value={model.meta.notes ?? ""}
            disabled={readOnly}
            placeholder="Reads, adjustments, coaching points…"
            onCommit={(v) => setNotes(doc, v)}
          />
        </div>
      </Section>
      <Section title="Getting started">
        <ul className="list-disc space-y-1 pl-4 text-zinc-600 dark:text-zinc-400">
          <li>Click a player to select them, then drag to move.</li>
          <li>
            With a player selected, pick <strong>Draw route</strong> (R) and
            click the field to add points. Double-click or press Esc to finish.
          </li>
          <li>Scroll or pinch to zoom; drag the field to pan.</li>
          <li>Press Space to run the play.</li>
        </ul>
      </Section>
    </>
  );
}

function PlayerPanel(props: Props) {
  const { doc, model, selection, readOnly, onSelect, onTool } = props;
  const id = useId();
  const player = model.players[selection.playerId!];
  const routes = Object.values(model.routes)
    .filter((r) => r.playerId === player.id)
    .sort(
      (a, b) => Number(a.option) - Number(b.option) || a.id.localeCompare(b.id),
    );

  return (
    <>
      <Section title={`Player ${player.label}`}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor={`${id}-label`} className={labelClass}>
              Label
            </label>
            <CommitInput
              id={`${id}-label`}
              className={input}
              value={player.label}
              maxLength={4}
              disabled={readOnly}
              onCommit={(v) => updatePlayer(doc, player.id, { label: v })}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-position`} className={labelClass}>
              Position
            </label>
            <select
              id={`${id}-position`}
              className={input}
              value={player.position}
              disabled={readOnly}
              onChange={(e) =>
                updatePlayer(doc, player.id, { position: e.target.value })
              }
            >
              {!POSITIONS.includes(player.position) && (
                <option value={player.position}>
                  {player.position || "—"}
                </option>
              )}
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-color`} className={labelClass}>
              Colour
            </label>
            <input
              id={`${id}-color`}
              type="color"
              className="h-9 w-full cursor-pointer rounded-md border border-zinc-300 bg-white p-1 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
              value={player.color}
              disabled={readOnly}
              onChange={(e) =>
                updatePlayer(doc, player.id, { color: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <span className={labelClass}>Spot (yards)</span>
            <p className="py-1.5 text-zinc-600 tabular-nums dark:text-zinc-400">
              {player.x.toFixed(1)} across, {player.y >= 0 ? "+" : ""}
              {player.y.toFixed(1)}
            </p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              onClick={() => {
                onSelect({
                  playerId: player.id,
                  routeId: null,
                  pointIndex: null,
                });
                onTool("route");
              }}
            >
              New route
            </button>
            <button
              type="button"
              className={buttonDanger}
              onClick={() => {
                deletePlayer(doc, player.id);
                onSelect({ playerId: null, routeId: null, pointIndex: null });
              }}
            >
              Delete player
            </button>
          </div>
        )}
      </Section>

      {routes.length === 0 ? (
        <Section title="Routes">
          <p className="text-zinc-600 dark:text-zinc-400">
            No route yet.{" "}
            {!readOnly &&
              "Choose New route, then click the field to add points."}
          </p>
        </Section>
      ) : (
        routes.map((route, i) => (
          <RoutePanel
            key={route.id}
            {...props}
            route={route}
            title={
              route.option
                ? `Option branch ${i}`
                : routes.length > 1
                  ? `Route ${i + 1}`
                  : "Route"
            }
          />
        ))
      )}
    </>
  );
}

function RoutePanel({
  doc,
  route,
  title,
  selection,
  readOnly,
  onSelect,
  onTool,
}: Props & { route: Route; title: string }) {
  const id = useId();
  const selected = selection.routeId === route.id;
  const pointIndex = selected ? selection.pointIndex : null;
  const point = pointIndex !== null ? route.points[pointIndex] : undefined;
  const select = (pointIndex: number | null = null) =>
    onSelect({ playerId: route.playerId, routeId: route.id, pointIndex });

  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={toggle(selected)}
          aria-pressed={selected}
          onClick={() => select()}
        >
          {selected ? "Selected" : "Select"}
        </button>
        {!readOnly && (
          <button
            type="button"
            className={button}
            onClick={() => {
              select();
              onTool("route");
            }}
          >
            Add points
          </button>
        )}
        <span className="self-center text-zinc-500">
          {route.points.length} point{route.points.length === 1 ? "" : "s"}
        </span>
      </div>

      <fieldset className="space-y-1" disabled={readOnly}>
        <legend className={labelClass}>Line</legend>
        <div className="flex flex-wrap gap-1">
          {(["solid", "dashed"] as const).map((style) => (
            <button
              key={style}
              type="button"
              className={toggle(route.style === style)}
              aria-pressed={route.style === style}
              onClick={() => setRouteStyle(doc, route.id, { style })}
            >
              {style === "solid" ? "Solid" : "Dashed"}
            </button>
          ))}
          {(["arrow", "block"] as const).map((endCap) => (
            <button
              key={endCap}
              type="button"
              className={toggle(route.endCap === endCap)}
              aria-pressed={route.endCap === endCap}
              onClick={() => setRouteStyle(doc, route.id, { endCap })}
            >
              {endCap === "arrow" ? "Arrow" : "Block"}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor={`${id}-speed`} className={labelClass}>
            Speed (yd/s)
          </label>
          <input
            id={`${id}-speed`}
            type="number"
            className={input}
            min={0.5}
            max={15}
            step={0.5}
            value={route.speed}
            disabled={readOnly}
            onChange={(e) =>
              e.target.value !== "" &&
              setRouteTiming(doc, route.id, { speed: e.target.valueAsNumber })
            }
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-delay`} className={labelClass}>
            Delay (s)
          </label>
          <input
            id={`${id}-delay`}
            type="number"
            className={input}
            min={0}
            max={10}
            step={0.1}
            value={route.delay}
            disabled={readOnly}
            onChange={(e) =>
              e.target.value !== "" &&
              setRouteTiming(doc, route.id, { delay: e.target.valueAsNumber })
            }
          />
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-emerald-600"
          checked={route.option}
          disabled={readOnly}
          onChange={(e) => setRouteOption(doc, route.id, e.target.checked)}
        />
        Option branch (drawn, not run in playback)
      </label>

      {point && pointIndex !== null && (
        <div className="space-y-2 rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
          <p className="font-medium">Point {pointIndex + 1}</p>
          <fieldset className="flex flex-wrap gap-1" disabled={readOnly}>
            <legend className="sr-only">Segment into this point</legend>
            {(["line", "curve"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={toggle(point.type === type)}
                aria-pressed={point.type === type}
                onClick={() =>
                  setRoutePointType(doc, route.id, pointIndex, type)
                }
              >
                {type === "line" ? "Straight" : "Curved"}
              </button>
            ))}
          </fieldset>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() => {
                  const branch = addOptionRoute(doc, route.id, pointIndex);
                  if (branch) {
                    onSelect({
                      playerId: route.playerId,
                      routeId: branch,
                      pointIndex: null,
                    });
                    onTool("route");
                  }
                }}
              >
                Branch option from here
              </button>
              <button
                type="button"
                className={buttonDanger}
                onClick={() => {
                  deleteRoutePoint(doc, route.id, pointIndex);
                  select();
                }}
              >
                Delete point
              </button>
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {route.points.length > 0 && !point && (
            <button
              type="button"
              className={button}
              onClick={() => {
                const branch = addOptionRoute(
                  doc,
                  route.id,
                  route.points.length - 2,
                );
                if (branch) {
                  onSelect({
                    playerId: route.playerId,
                    routeId: branch,
                    pointIndex: null,
                  });
                  onTool("route");
                }
              }}
              title="New branch sharing this route's stem up to its last break"
            >
              Add option branch
            </button>
          )}
          <button
            type="button"
            className={buttonDanger}
            onClick={() => {
              deleteRoute(doc, route.id);
              onSelect({
                playerId: route.playerId,
                routeId: null,
                pointIndex: null,
              });
            }}
          >
            Delete route
          </button>
        </div>
      )}
    </Section>
  );
}
