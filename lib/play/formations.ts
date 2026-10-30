import { FIELD_CENTER_X as C } from "@/lib/field/constants";

export interface FormationPlayer {
  label: string;
  position: string;
  x: number;
  y: number;
}

export interface Formation {
  id: string;
  name: string;
  players: FormationPlayer[];
}

export const POSITION_COLORS: Record<string, string> = {
  QB: "#dc2626",
  RB: "#ea580c",
  FB: "#ca8a04",
  WR: "#2563eb",
  TE: "#7c3aed",
  OL: "#475569",
};

export function colorForPosition(position: string): string {
  return POSITION_COLORS[position] ?? "#0f766e";
}

const LINE_Y = -1;
const line: FormationPlayer[] = [
  { label: "LT", position: "OL", x: C - 4, y: LINE_Y },
  { label: "LG", position: "OL", x: C - 2, y: LINE_Y },
  { label: "C", position: "OL", x: C, y: LINE_Y },
  { label: "RG", position: "OL", x: C + 2, y: LINE_Y },
  { label: "RT", position: "OL", x: C + 4, y: LINE_Y },
];

export const FORMATIONS: readonly Formation[] = [
  {
    id: "shotgun-2x2",
    name: "Shotgun 2x2",
    players: [
      ...line,
      { label: "QB", position: "QB", x: C, y: -5 },
      { label: "RB", position: "RB", x: C + 1.5, y: -5 },
      { label: "X", position: "WR", x: 4, y: LINE_Y },
      { label: "H", position: "WR", x: C - 10, y: -1.5 },
      { label: "Y", position: "WR", x: C + 10, y: -1.5 },
      { label: "Z", position: "WR", x: 49, y: LINE_Y },
    ],
  },
  {
    id: "i-form",
    name: "I-Formation",
    players: [
      ...line,
      { label: "QB", position: "QB", x: C, y: -1.8 },
      { label: "FB", position: "FB", x: C, y: -4.5 },
      { label: "RB", position: "RB", x: C, y: -7 },
      { label: "TE", position: "TE", x: C + 6, y: LINE_Y },
      { label: "X", position: "WR", x: 4, y: LINE_Y },
      { label: "Z", position: "WR", x: 46, y: -1.5 },
    ],
  },
  {
    id: "singleback-trips",
    name: "Singleback Trips Right",
    players: [
      ...line,
      { label: "QB", position: "QB", x: C, y: -1.8 },
      { label: "RB", position: "RB", x: C, y: -6 },
      { label: "X", position: "WR", x: 4, y: LINE_Y },
      { label: "Y", position: "TE", x: C + 6, y: LINE_Y },
      { label: "H", position: "WR", x: 40, y: -1.5 },
      { label: "Z", position: "WR", x: 49, y: LINE_Y },
    ],
  },
  {
    id: "empty",
    name: "Empty 3x2",
    players: [
      ...line,
      { label: "QB", position: "QB", x: C, y: -5 },
      { label: "X", position: "WR", x: 4, y: LINE_Y },
      { label: "H", position: "WR", x: 12, y: -1.5 },
      { label: "Y", position: "TE", x: C + 6, y: LINE_Y },
      { label: "F", position: "WR", x: 40, y: -1.5 },
      { label: "Z", position: "WR", x: 49, y: LINE_Y },
    ],
  },
  { id: "blank", name: "Blank field", players: [] },
];

export const DEFAULT_FORMATION_ID = "shotgun-2x2";

export function getFormation(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}
