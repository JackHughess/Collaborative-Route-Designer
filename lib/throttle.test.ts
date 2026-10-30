import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { throttle } from "./throttle";

describe("throttle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs at most once per interval and always delivers the last value", () => {
    const fn = vi.fn();
    const t = throttle(fn, 33);
    t.call(1);
    t.call(2);
    t.call(3);
    expect(fn.mock.calls).toEqual([[1]]);
    vi.advanceTimersByTime(33);
    expect(fn.mock.calls).toEqual([[1], [3]]);
  });

  it("flush runs the pending call immediately", () => {
    const fn = vi.fn();
    const t = throttle(fn, 33);
    t.call("a");
    t.call("b");
    t.flush();
    expect(fn.mock.calls).toEqual([["a"], ["b"]]);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
