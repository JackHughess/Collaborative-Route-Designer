import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEWPORT,
  MAX_VIEW_WIDTH,
  MIN_VIEW_WIDTH,
  pan,
  zoomAt,
  zoomCenter,
} from "./viewport";

describe("viewport", () => {
  it("zooming keeps the point under the cursor fixed", () => {
    const center = { x: 20, y: -5 };
    const vp = zoomAt(DEFAULT_VIEWPORT, 2, center);
    const before = (center.x - DEFAULT_VIEWPORT.x) / DEFAULT_VIEWPORT.width;
    const after = (center.x - vp.x) / vp.width;
    expect(after).toBeCloseTo(before);
    expect(vp.width).toBeCloseTo(DEFAULT_VIEWPORT.width / 2);
    expect(vp.height / vp.width).toBeCloseTo(
      DEFAULT_VIEWPORT.height / DEFAULT_VIEWPORT.width,
    );
  });

  it("limits zoom", () => {
    expect(zoomCenter(DEFAULT_VIEWPORT, 1000).width).toBe(MIN_VIEW_WIDTH);
    expect(zoomCenter(DEFAULT_VIEWPORT, 0.001).width).toBe(MAX_VIEW_WIDTH);
  });

  it("pans, but not off the field", () => {
    expect(pan(DEFAULT_VIEWPORT, 3, 0).x).toBe(DEFAULT_VIEWPORT.x + 3);
    expect(pan(DEFAULT_VIEWPORT, 1000, 0).x).toBeLessThan(53.3);
    expect(pan(DEFAULT_VIEWPORT, 0, -1000).y).toBeGreaterThan(-100);
  });
});
