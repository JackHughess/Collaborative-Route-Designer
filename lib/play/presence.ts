import type { Point } from "./types";

/** Awareness state each client publishes. Never persisted. See CLAUDE.md. */
export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

export interface PresenceState {
  user: PresenceUser;
  cursor: Point | null;
  selectedIds: string[];
}

/** Another connected client, as shown on the field and in the avatar list. */
export interface Peer extends PresenceState {
  clientId: number;
}

const PRESENCE_COLORS = [
  "#f43f5e",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#3b82f6",
  "#14b8a6",
];

/** Stable colour for a user id, so everyone sees the same colour for a person. */
export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

export function isPresenceState(value: unknown): value is PresenceState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PresenceState>;
  return (
    !!v.user &&
    typeof v.user.id === "string" &&
    typeof v.user.name === "string" &&
    typeof v.user.color === "string" &&
    Array.isArray(v.selectedIds)
  );
}
