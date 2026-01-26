import { CharacterBuildView } from "@/components/artifact-filter/CharacterBuildView";
import type { Character } from "@/data/types";
import { filterAndSortCharacters } from "@/lib/characterFilters";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
      character: (id: string) => `Char ${id}`,
    },
  }),
}));

vi.mock("@/stores/useTierStore", () => ({
  useTierStore: vi.fn(() => ({ tierAssignments: {} })),
}));

// Mock complex sub-components
vi.mock("@/components/layout/SidebarLayout", () => ({
  SidebarLayout: ({
    children,
    sidebar,
    triggerLabel,
  }: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    triggerLabel: string;
  }) => (
    <div data-testid="sidebar-layout">
      <div data-testid="sidebar-trigger">{triggerLabel}</div>
      <div data-testid="sidebar-content">{sidebar}</div>
      <div data-testid="main-content">{children}</div>
    </div>
  ),
}));

vi.mock("@/components/shared/CharacterFilterSidebar", () => ({
  CharacterFilterSidebar: () => (
    <div data-testid="filter-sidebar">Filter Sidebar</div>
  ),
}));

vi.mock("@/components/artifact-filter/CharacterBuildCard", () => ({
  CharacterBuildCard: ({ character }: { character: { id: string } }) => (
    <div data-testid={`char-card-${character.id}`}>Card {character.id}</div>
  ),
}));

// Mock data
vi.mock("@/data/constants", () => ({
  charactersById: {
    char1: {
      id: "char1",
      element: "Pyro",
      weaponType: "Sword",
      rarity: 5,
      region: "Mondstadt",
    },
  },
}));

vi.mock("@/data/resources", () => ({
  characters: [
    {
      id: "char1",
      element: "Pyro",
      weaponType: "Sword",
      rarity: 5,
      region: "Mondstadt",
    },
    {
      id: "char2",
      element: "Hydro",
      weaponType: "Bow",
      rarity: 4,
      region: "Liyue",
    },
  ],
}));

// Mock virtualizer
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () =>
      Array.from({ length: count }).map((_, i) => ({
        index: i,
        key: i,
        start: i * 100,
      })),
    measureElement: vi.fn(),
  }),
}));

vi.mock("@/hooks/useGlobalScroll", () => ({
  useGlobalScroll: vi.fn(),
}));

// Mock filter logic
vi.mock("@/lib/characterFilters", () => ({
  defaultCharacterFilters: {},
  getDefaultCharacterFilters: () => ({}),
  hasActiveFilters: () => false,
  filterAndSortCharacters: vi.fn(),
}));

describe("CharacterBuildView", () => {
  beforeEach(() => {
    vi.mocked(filterAndSortCharacters).mockReturnValue([
      { id: "char1", element: "Pyro" } as unknown as Character,
      { id: "char2", element: "Hydro" } as unknown as Character,
    ]);
  });

  it("renders list of characters", () => {
    render(<CharacterBuildView />);

    expect(screen.getByTestId("sidebar-layout")).toBeInTheDocument();
    // Check virtualized items
    expect(screen.getByTestId("char-card-char1")).toBeInTheDocument();
    expect(screen.getByTestId("char-card-char2")).toBeInTheDocument();
  });

  it("displays no characters found when empty", () => {
    vi.mocked(filterAndSortCharacters).mockReturnValue([]);

    render(<CharacterBuildView />);

    expect(screen.getByText("configure.noCharactersFound")).toBeInTheDocument();
  });
});
