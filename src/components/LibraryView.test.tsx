// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LibraryView from "./LibraryView";
import type { PromptItem } from "@/types";

function makeItem(overrides: Partial<PromptItem> = {}): PromptItem {
  return {
    id: "item-1",
    name: "Code Review",
    content: "Review this {{language}} code",
    type: "prompt",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function renderLibrary(props: Partial<Parameters<typeof LibraryView>[0]> = {}, items?: PromptItem[]) {
  const onEdit = vi.fn(async () => true);
  const onDeleteItem = vi.fn(async () => true);
  const utils = render(
    <LibraryView
      prompts={items ?? [makeItem()]}
      onEdit={onEdit}
      onDeleteItem={onDeleteItem}
      totalPrompts={items?.length ?? 1}
      {...props}
    />
  );
  return { ...utils, onEdit, onDeleteItem };
}

describe("LibraryView", () => {
  it("renders prompt names", () => {
    renderLibrary({}, [
      makeItem({ id: "a", name: "Alpha Prompt" }),
      makeItem({ id: "b", name: "Beta Skill", type: "skill" }),
    ]);
    expect(screen.getByText("Alpha Prompt")).toBeTruthy();
    expect(screen.getByText("Beta Skill")).toBeTruthy();
  });

  it("shows the vault-empty state when the vault has no items", () => {
    renderLibrary({ prompts: [], totalPrompts: 0 }, []);
    expect(screen.getByText("No prompts yet")).toBeTruthy();
  });

  it("shows the no-matches state with a clear action when filters are active", () => {
    const onClearFilters = vi.fn();
    renderLibrary(
      { prompts: [], totalPrompts: 5, filtersActive: true, onClearFilters },
      []
    );
    expect(screen.getByText("No matches")).toBeTruthy();
    fireEvent.click(screen.getByText("Clear search & filters"));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("opens the detail modal when a card is clicked and closes it", () => {
    renderLibrary();
    fireEvent.click(screen.getByText("Code Review"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the editor from the detail modal", () => {
    renderLibrary();
    fireEvent.click(screen.getByText("Code Review"));
    fireEvent.click(screen.getByLabelText("Edit this item"));
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Code Review");
    expect(screen.getByLabelText("Tags (comma-separated)")).toBeTruthy();
  });

  it("calls onDeleteItem with the item when trash is clicked", () => {
    const { onDeleteItem } = renderLibrary();
    const item = makeItem({ id: "target" });
    renderLibrary({}, [item]);
    fireEvent.click(screen.getByLabelText("Delete"));
    expect(onDeleteItem).toHaveBeenCalledWith(expect.objectContaining({ id: "target" }));
  });

  it("shows the history tab and version list when history exists", () => {
    renderLibrary({}, [
      makeItem({
        history: [{ name: "Old", content: "older content", type: "prompt", savedAt: 1 }],
      }),
    ]);
    fireEvent.click(screen.getByText("Code Review"));
    fireEvent.click(screen.getByText(/History \(1\)/));
    expect(screen.getByText("Old")).toBeTruthy();
  });
});
