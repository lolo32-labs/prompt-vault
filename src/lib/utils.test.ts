import { describe, it, expect } from "vitest";
import { parseTags, generateId, fmtBytes, resolveDependency } from "./utils";

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

describe("resolveDependency", () => {
  const src =
    "https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md";

  it("resolves ./ siblings against the source directory", () => {
    expect(resolveDependency(src, "./assets/guide.md")).toBe(
      "https://github.com/anthropics/skills/blob/main/skills/frontend-design/assets/guide.md"
    );
  });

  it("resolves ../ parent traversals", () => {
    expect(resolveDependency(src, "../shared/tokens.md")).toBe(
      "https://github.com/anthropics/skills/blob/main/skills/shared/tokens.md"
    );
  });

  it("passes through absolute URLs", () => {
    expect(resolveDependency(src, "https://example.com/x.md")).toBe(
      "https://example.com/x.md"
    );
  });

  it("returns null for non-GitHub sources or missing source", () => {
    expect(resolveDependency(undefined, "./x.md")).toBeNull();
    expect(resolveDependency("https://example.com/readme", "./x.md")).toBeNull();
  });
});
