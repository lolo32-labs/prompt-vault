import { describe, it, expect } from "vitest";
import {
  parseRepoUrl,
  parseFrontmatter,
  deriveNameFromPath,
  extractDependencies,
} from "./scanner";

describe("parseRepoUrl", () => {
  it("extracts owner and repo from a standard URL", () => {
    expect(parseRepoUrl("https://github.com/anthropics/skills")).toEqual({
      owner: "anthropics",
      repo: "skills",
    });
  });

  it("strips the .git suffix", () => {
    expect(parseRepoUrl("https://github.com/foo/bar.git")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("tolerates trailing sub-paths and slashes", () => {
    expect(parseRepoUrl("https://github.com/foo/bar/tree/main/")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("returns null for invalid URLs", () => {
    expect(parseRepoUrl("https://example.com/foo/bar")).toBeNull();
    expect(parseRepoUrl("")).toBeNull();
  });
});

describe("parseFrontmatter", () => {
  it("parses simple key/value pairs", () => {
    const md = "---\nname: frontend-design\ndescription: Create interfaces\n---\nbody";
    expect(parseFrontmatter(md)).toEqual({
      name: "frontend-design",
      description: "Create interfaces",
    });
  });

  it("strips surrounding quotes", () => {
    const md = '---\ndescription: "Create interfaces"\n---';
    expect(parseFrontmatter(md).description).toBe("Create interfaces");
  });

  it("preserves colons inside values", () => {
    const md = "---\ndescription: Do X: here's how\n---";
    expect(parseFrontmatter(md).description).toBe("Do X: here's how");
  });

  it("skips comments and list items", () => {
    const md = "---\nname: foo\n# comment\ntags:\n  - a\n  - b\n---";
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe("foo");
    expect(fm.tags).toBeUndefined();
  });

  it("returns an empty object when there is no frontmatter", () => {
    expect(parseFrontmatter("# just a heading")).toEqual({});
  });
});

describe("deriveNameFromPath", () => {
  it("derives title case from a SKILL.md parent folder", () => {
    expect(deriveNameFromPath("skills/frontend-design/SKILL.md")).toBe("Frontend Design");
  });

  it("derives from a .prompt filename", () => {
    expect(deriveNameFromPath("prompts/code_review.prompt")).toBe("Code Review");
  });
});

describe("extractDependencies", () => {
  it("finds ./ relative links", () => {
    expect(extractDependencies("see [guide](./guide.md)")).toEqual(["./guide.md"]);
  });

  it("finds ../ relative links", () => {
    expect(extractDependencies("see [shared](../shared/foo.md)")).toEqual(["../shared/foo.md"]);
  });

  it("ignores absolute links", () => {
    expect(extractDependencies("[external](https://example.com)")).toEqual([]);
  });
});
