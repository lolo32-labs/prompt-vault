import { describe, it, expect } from "vitest";
import { diffSnapshot } from "./watch";

describe("diffSnapshot", () => {
  it("detects added paths", () => {
    const diff = diffSnapshot({}, { "a/SKILL.md": "sha1" });
    expect(diff.added).toEqual(["a/SKILL.md"]);
    expect(diff.changed).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("detects changed shas", () => {
    const diff = diffSnapshot(
      { "a/SKILL.md": "sha1" },
      { "a/SKILL.md": "sha2" }
    );
    expect(diff.changed).toEqual(["a/SKILL.md"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("detects removed paths", () => {
    const diff = diffSnapshot({ "a/SKILL.md": "sha1" }, {});
    expect(diff.removed).toEqual(["a/SKILL.md"]);
  });

  it("reports clean when snapshots match", () => {
    const snap = { "a/SKILL.md": "sha1", "b.prompt": "sha2" };
    const diff = diffSnapshot(snap, { ...snap });
    expect(diff.added).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("handles mixed changes", () => {
    const diff = diffSnapshot(
      { "keep/SKILL.md": "s1", "gone/SKILL.md": "s2", "edit/SKILL.md": "s3" },
      { "keep/SKILL.md": "s1", "edit/SKILL.md": "s9", "fresh.prompt": "s4" }
    );
    expect(diff.added).toEqual(["fresh.prompt"]);
    expect(diff.changed).toEqual(["edit/SKILL.md"]);
    expect(diff.removed).toEqual(["gone/SKILL.md"]);
  });
});
