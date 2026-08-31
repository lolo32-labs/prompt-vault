import { describe, it, expect } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("returns all-same for identical text", () => {
    const diff = diffLines("a\nb\nc", "a\nb\nc");
    expect(diff.every((l) => l.type === "same")).toBe(true);
    expect(diff).toHaveLength(3);
  });

  it("detects a changed line as remove+add", () => {
    const diff = diffLines("a\nb\nc", "a\nX\nc");
    expect(diff).toEqual([
      { type: "same", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "X" },
      { type: "same", text: "c" },
    ]);
  });

  it("detects appended lines", () => {
    const diff = diffLines("a", "a\nb\nc");
    expect(diff).toEqual([
      { type: "same", text: "a" },
      { type: "add", text: "b" },
      { type: "add", text: "c" },
    ]);
  });

  it("detects removed lines", () => {
    const diff = diffLines("a\nb\nc", "c");
    expect(diff).toEqual([
      { type: "remove", text: "a" },
      { type: "remove", text: "b" },
      { type: "same", text: "c" },
    ]);
  });

  it("handles empty old text as all additions", () => {
    const diff = diffLines("", "a\nb");
    expect(diff).toEqual([
      { type: "add", text: "a" },
      { type: "add", text: "b" },
    ]);
  });

  it("handles empty new text as all removals", () => {
    const diff = diffLines("a\nb", "");
    expect(diff).toEqual([
      { type: "remove", text: "a" },
      { type: "remove", text: "b" },
    ]);
  });
});
