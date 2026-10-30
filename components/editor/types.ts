import type { SegmentType } from "@/lib/play/types";

export type Tool = "select" | "player" | "route";

/** Local only, never synced. */
export interface Selection {
  playerId: string | null;
  routeId: string | null;
  pointIndex: number | null;
}

export const EMPTY_SELECTION: Selection = {
  playerId: null,
  routeId: null,
  pointIndex: null,
};

export type DragPhase = "start" | "move" | "end";

export interface EditorSettings {
  tool: Tool;
  segmentType: SegmentType;
}
