import { describe, it, expect } from "vitest";
import { scorePrompt } from "./quality";

const WELL_STRUCTURED = `# Code Review Prompt

You are a senior engineer reviewing {{language}} code.

## Steps

- Check for {{focus}} issues first
- Note security concerns
- Suggest concrete fixes

Keep feedback actionable.`;

const WALL_OF_TEXT =
  "This is a very long single line without any structure. ".repeat(40);

describe("scorePrompt", () => {
  it("scores a well-structured prompt with variables highly", () => {
    const result = scorePrompt({
      name: "Code Review",
      content: WELL_STRUCTURED,
      type: "prompt",
    });
    expect(result.clarity).toBe(100);
    expect(result.organization).toBeGreaterThanOrEqual(60);
    expect(result.variables).toBe(100);
    expect(result.total).toBeGreaterThanOrEqual(80);
  });

  it("scores tiny content low on clarity", () => {
    const result = scorePrompt({ name: "x", content: "hi", type: "prompt" });
    expect(result.clarity).toBe(20);
    expect(result.total).toBeLessThan(50);
  });

  it("penalizes walls of text on clarity", () => {
    const result = scorePrompt({ name: "wall", content: WALL_OF_TEXT, type: "prompt" });
    expect(result.clarity).toBeLessThan(100);
  });

  it("gives a neutral variable score when there are no variables", () => {
    const result = scorePrompt({
      name: "static",
      content: "Summarize this document in three bullet points.",
      type: "prompt",
    });
    expect(result.variables).toBe(60);
  });

  it("counts repeated use of the same variable once", () => {
    const result = scorePrompt({
      name: "repeat",
      content: "{{lang}} review. Write {{lang}} tests for {{lang}}.",
      type: "prompt",
    });
    expect(result.variables).toBe(100);
  });

  it("scores 5-8 unique variables below perfect", () => {
    const vars = ["a", "b", "c", "d", "e", "f"].map((v) => `{{${v}}}`).join(" ");
    const result = scorePrompt({ name: "many", content: vars, type: "prompt" });
    expect(result.variables).toBe(80);
  });

  it("scores over-parameterized content lower", () => {
    const vars = Array.from({ length: 10 }, (_, i) => `{{v${i}}}`).join(" ");
    const result = scorePrompt({ name: "too-many", content: vars, type: "prompt" });
    expect(result.variables).toBe(60);
  });

  it("returns deterministic results", () => {
    const item = { name: "d", content: WELL_STRUCTURED, type: "skill" as const };
    expect(scorePrompt(item)).toEqual(scorePrompt(item));
  });

  it("keeps all scores within 0-100", () => {
    const result = scorePrompt({ name: "e", content: "", type: "prompt" });
    for (const value of [result.clarity, result.organization, result.variables, result.total]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
