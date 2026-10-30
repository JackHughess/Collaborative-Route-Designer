import { FIELD_WIDTH, MAX_Y, MIN_Y } from "./constants";
import { svgY } from "./geometry";

/** SVG viewBox in yards (SVG y, so downfield is negative). Local view state only. */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_VIEW_WIDTH = 8;
export const MAX_VIEW_WIDTH = 120;

/** Whole width of the field, from 15 yards behind the line to 25 downfield. */
export const DEFAULT_VIEWPORT: Viewport = {
  x: -2,
  y: svgY(25),
  width: FIELD_WIDTH + 4,
  height: 40,
};

export function viewBox(vp: Viewport): string {
  return `${vp.x} ${vp.y} ${vp.width} ${vp.height}`;
}

/** Keep part of the field in view so you can't pan off into nothing. */
export function clampViewport(vp: Viewport): Viewport {
  const minX = -vp.width + 4;
  const maxX = FIELD_WIDTH - 4;
  const minY = svgY(MAX_Y) - vp.height + 4;
  const maxY = svgY(MIN_Y) - 4;
  return {
    ...vp,
    x: Math.min(maxX, Math.max(minX, vp.x)),
    y: Math.min(maxY, Math.max(minY, vp.y)),
  };
}

/**
 * Zoom by `factor` (> 1 zooms in) keeping the SVG point `center` fixed on screen.
 */
export function zoomAt(
  vp: Viewport,
  factor: number,
  center: { x: number; y: number },
): Viewport {
  const width = Math.min(
    MAX_VIEW_WIDTH,
    Math.max(MIN_VIEW_WIDTH, vp.width / factor),
  );
  const k = width / vp.width;
  return clampViewport({
    x: center.x - (center.x - vp.x) * k,
    y: center.y - (center.y - vp.y) * k,
    width,
    height: vp.height * k,
  });
}

export function zoomCenter(vp: Viewport, factor: number): Viewport {
  return zoomAt(vp, factor, {
    x: vp.x + vp.width / 2,
    y: vp.y + vp.height / 2,
  });
}

/** Move the view by (dx, dy) SVG units. */
export function pan(vp: Viewport, dx: number, dy: number): Viewport {
  return clampViewport({ ...vp, x: vp.x + dx, y: vp.y + dy });
}
