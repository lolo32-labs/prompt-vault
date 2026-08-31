import { describe, it, expect } from "vitest";
import { parseTags, generateId, fmtBytes } from "./utils";

describe("parseTags", () => {
  it("splits on commas and trims whitespace", () => {
    expect(parseTags("code-review, python , production")).toEqual([
      "code-review",
      "python",
      "production",
    ]);
  });

  it("filters empty entries", () => {
    expect(parseTags(" a, , b ,,")).toEqual(["a", "b"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseTags("   ")).toEqual([]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("generateId", () => {
  it("returns a non-empty string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("fmtBytes", () => {
  it("formats bytes", () => {
    expect(fmtBytes(0)).toBe("0 B");
    expect(fmtBytes(512)).toBe("512 B");
  });
  it("formats KB and MB", () => {
    expect(fmtBytes(1024)).toBe("1.0 KB");
    expect(fmtBytes(1536)).toBe("1.5 KB");
    expect(fmtBytes(1024 * 1024)).toBe("1.0 MB");
  });
  it("rounds large values", () => {
    expect(fmtBytes(2 * 1024 * 1024 + 512 * 1024)).toBe("2.5 MB");
    expect(fmtBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });
  it("handles invalid input", () => {
    expect(fmtBytes(-5)).toBe("0 B");
    expect(fmtBytes(NaN)).toBe("0 B");
  });
});
