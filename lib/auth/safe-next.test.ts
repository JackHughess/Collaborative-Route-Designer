import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps relative paths", () => {
    expect(safeNext("/play/abc?x=1")).toBe("/play/abc?x=1");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
  });

  it("falls back for missing values", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext(undefined, "/")).toBe("/");
  });
});
