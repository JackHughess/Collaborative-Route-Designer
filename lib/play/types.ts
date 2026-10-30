// Immutable snapshot of a play, read by every component. See CLAUDE.md "Data model".
// All coordinates are in yards: x is 0..FIELD_WIDTH across the field and
// y is yards from the line of scrimmage (positive is downfield).

export type SegmentType = "line" | "curve";
export type RouteStyle = "solid" | "dashed";
export type EndCap = "arrow" | "block";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A route point. `type` describes the segment that ends at this point. */
export interface RoutePoint extends Point {
  readonly type: SegmentType;
}

export interface Player extends Point {
  readonly id: string;
  readonly label: string;
  readonly position: string;
  readonly color: string;
}

export interface Route {
  readonly id: string;
  readonly playerId: string;
  /** Points after the player's starting spot, in order. */
  readonly points: readonly RoutePoint[];
  readonly style: RouteStyle;
  readonly endCap: EndCap;
  /** Yards per second. */
  readonly speed: number;
  /** Seconds after the snap before the player starts moving. */
  readonly delay: number;
  /** Option branches are drawn but the player runs their main route in playback. */
  readonly option: boolean;
}

export interface PlayMeta {
  readonly name: string;
  readonly formation: string;
  readonly notes?: string;
}

export interface PlayModel {
  readonly meta: PlayMeta;
  readonly players: Readonly<Record<string, Player>>;
  readonly routes: Readonly<Record<string, Route>>;
}
