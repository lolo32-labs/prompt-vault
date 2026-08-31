import { describe, it, expect } from "vitest";
import { withPriorVersion, HISTORY_LIMIT } from "./storage";
import type { PromptItem } from "@/types";

function makeItem(overrides: Partial<PromptItem> = {}): PromptItem {
  return {
    id: "item-1",
    name: "Code Review",
    content: "Review this code",
    type: "prompt",
    createdAt: 1000,
    ...overrides,
  };
}

describe("withPriorVersion", () => {
  it("pushes the previous version onto history when content changes", () => {
    const previous = makeItem();
    const next = makeItem({ content: "Review this code carefully" });
    const result = withPriorVersion(next, previous);
    expect(result.history).toHaveLength(1);
    expect(result.history?.[0]).toMatchObject({
      name: "Code Review",
      content: "Review this code",
      type: "prompt",
    });
    expect(typeof result.history?.[0].savedAt).toBe("number");
  });

  it("captures name, tags, and description from the previous version", () => {
    const previous = makeItem({
      name: "Old Name",
      tags: ["a"],
      description: "old desc",
    });
    const next = makeItem({ name: "New Name" });
    const result = withPriorVersion(next, previous);
    expect(result.history?.[0]).toMatchObject({
      name: "Old Name",
      tags: ["a"],
      description: "old desc",
    });
  });

  it("does not push history when nothing semantic changed", () => {
    const previous = makeItem({ history: [{ name: "X", content: "Y", type: "prompt", savedAt: 1 }] });
    const same = makeItem({ history: previous.history });
    const result = withPriorVersion(same, previous);
    expect(result.history).toEqual(previous.history);
  });

  it("ignores metadata-only differences", () => {
    const previous = makeItem();
    const next = makeItem({ metadata: { foo: 1 }, sourceUrl: "https://example.com" });
    const result = withPriorVersion(next, previous);
    expect(result.history).toBeUndefined();
  });

  it("preserves and extends existing history", () => {
    const older = { name: "V1", content: "v1", type: "prompt" as const, savedAt: 1 };
    const previous = makeItem({ content: "v2", history: [older] });
    const next = makeItem({ content: "v3" });
    const result = withPriorVersion(next, previous);
    expect(result.history).toHaveLength(2);
    expect(result.history?.[1]).toEqual(older);
  });

  it("prunes history to the limit", () => {
    const history = Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
      name: `v${i}`,
      content: `c${i}`,
      type: "prompt" as const,
      savedAt: i,
    }));
    const previous = makeItem({ history });
    const next = makeItem({ content: "new" });
    const result = withPriorVersion(next, previous);
    expect(result.history).toHaveLength(HISTORY_LIMIT);
    expect(result.history?.[0].content).toBe("Review this code");
    expect(result.history?.[HISTORY_LIMIT - 1]).toEqual(history[HISTORY_LIMIT - 2]);
  });
});
