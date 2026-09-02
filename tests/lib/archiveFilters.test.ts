import { describe, expect, it, vi } from "vitest";
import {
  filterArchiveItems,
  isArchiveSearchActive,
  itemMatchesArchiveFilterScope,
} from "@/lib/archiveFilters";

describe("archive filter scope", () => {
  it("treats only non-whitespace input as active search", () => {
    expect(isArchiveSearchActive(" \t ")).toBe(false);
    expect(isArchiveSearchActive("  moon  ")).toBe(true);
  });

  it("uses the normalized search predicate and bypasses chip filters", () => {
    const item = { name: "The Blood Moon" };
    const matchesSearch = vi.fn((candidate: typeof item, query: string) =>
      candidate.name.toLowerCase().includes(query.toLowerCase())
    );
    const matchesChipFilters = vi.fn(() => false);

    expect(
      itemMatchesArchiveFilterScope(
        item,
        "  blood moon  ",
        matchesSearch,
        matchesChipFilters
      )
    ).toBe(true);
    expect(matchesSearch).toHaveBeenCalledWith(item, "blood moon");
    expect(matchesChipFilters).not.toHaveBeenCalled();
  });

  it("uses chip filters when search is empty or whitespace-only", () => {
    const item = { id: 1 };
    const matchesSearch = vi.fn(() => false);
    const matchesChipFilters = vi.fn(() => true);

    expect(
      itemMatchesArchiveFilterScope(
        item,
        "   ",
        matchesSearch,
        matchesChipFilters
      )
    ).toBe(true);
    expect(matchesSearch).not.toHaveBeenCalled();
    expect(matchesChipFilters).toHaveBeenCalledWith(item);
  });

  it("applies the selected scope to a collection", () => {
    const items = ["blood moon", "bright moon", "sunrise"];

    expect(
      filterArchiveItems(
        items,
        "  bright  ",
        (item, query) => item.includes(query),
        (item) => item.startsWith("blood")
      )
    ).toEqual(["bright moon"]);
    expect(
      filterArchiveItems(
        items,
        "   ",
        (item, query) => item.includes(query),
        (item) => item.startsWith("blood")
      )
    ).toEqual(["blood moon"]);
  });
});
