/** Field width in yards (160 feet). */
export const FIELD_WIDTH = 53.3;
/** NFL hash marks are 70 ft 9 in from each sideline. */
export const HASH_LEFT = 23.58;
export const HASH_RIGHT = FIELD_WIDTH - HASH_LEFT;
export const FIELD_CENTER_X = FIELD_WIDTH / 2;

/** Range of y the editor lets you place things in, relative to the line of scrimmage. */
export const MIN_Y = -20;
export const MAX_Y = 45;

export const PLAYER_RADIUS = 0.9;

/** Furthest downfield a player can line up: the whole token stays behind the line of scrimmage (y = 0). */
export const MAX_PLAYER_Y = -PLAYER_RADIUS;
