import { describe, it, expect } from "vitest";
import { parseTags, generateId } from "./utils";

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
