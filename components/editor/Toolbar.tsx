"use client";

import type { SegmentType } from "@/lib/play/types";
import { button, toggle } from "@/components/ui";
import type { Tool } from "./types";

interface Props {
  tool: Tool;
  segmentType: SegmentType;
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (tool: Tool) => void;
  onSegmentType: (type: SegmentType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "V" },
  { id: "player", label: "Add player", key: "P" },
  { id: "route", label: "Draw route", key: "R" },
];

export function Toolbar(props: Props) {
  const { tool, segmentType, readOnly } = props;
  return (
    <div
      role="toolbar"
      aria-label="Editor tools"
      className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div role="group" aria-label="Tool" className="flex gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={toggle(tool === t.id)}
            aria-pressed={tool === t.id}
            aria-keyshortcuts={t.key}
            title={`${t.label} (${t.key})`}
            disabled={readOnly && t.id !== "select"}
            onClick={() => props.onTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tool === "route" && !readOnly && (
        <div role="group" aria-label="Segment type" className="flex gap-1">
          <button
            type="button"
            className={toggle(segmentType === "line")}
            aria-pressed={segmentType === "line"}
            aria-keyshortcuts="L"
            title="Straight segments (L)"
            onClick={() => props.onSegmentType("line")}
          >
            Line
          </button>
          <button
            type="button"
            className={toggle(segmentType === "curve")}
            aria-pressed={segmentType === "curve"}
            aria-keyshortcuts="C"
            title="Curved segments (C)"
            onClick={() => props.onSegmentType("curve")}
          >
            Curve
          </button>
        </div>
      )}

      <div className="ml-auto flex gap-1">
        {!readOnly && (
          <>
            <button
              type="button"
              className={button}
              disabled={!props.canUndo}
              onClick={props.onUndo}
              aria-keyshortcuts="Control+Z"
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              className={button}
              disabled={!props.canRedo}
              onClick={props.onRedo}
              aria-keyshortcuts="Control+Shift+Z"
              title="Redo (Ctrl+Shift+Z)"
            >
              Redo
            </button>
          </>
        )}
        <button
          type="button"
          className={button}
          onClick={props.onZoomOut}
          aria-label="Zoom out"
          aria-keyshortcuts="-"
          title="Zoom out (-)"
        >
          −
        </button>
        <button
          type="button"
          className={button}
          onClick={props.onZoomReset}
          aria-keyshortcuts="0"
          title="Reset view (0)"
        >
          Fit
        </button>
        <button
          type="button"
          className={button}
          onClick={props.onZoomIn}
          aria-label="Zoom in"
          aria-keyshortcuts="+"
          title="Zoom in (+)"
        >
          +
        </button>
      </div>
    </div>
  );
}
