import { useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CharacterResource } from "@/domain/models";
import { CharacterBuildView } from "@/pages/builds/CharacterBuildView";
import { filterAndSortCharacters } from "@/services/catalog/characterFilters";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { fireEvent, render, screen, waitFor } from "../../utils/render";

function NavigationBackProbe() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="current-url">
        {location.pathname}
        {location.search}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    </>
  );
}

// Mock dependencies
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
      character: (id: string) => `Char ${id}`,
    },
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/stores/useTierStore", () => ({
  useTierStore: vi.fn((selector) =>
    selector({
      activeTierListId: 1,
      tierLists: {
        1: {
          tierAssignments: {},
          tierCustomization: {},
          customTitle: "",
          author: "",
          description: "",
        },
      },
    })
  ),
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

vi.mock("@/components/builds/CharacterBuildCard", () => ({
  CharacterBuildCard: ({ character }: { character: { id: string } }) => (
    <div data-testid={`char-card-${character.id}`}>Card {character.id}</div>
  ),
}));

// Mock account hooks
vi.mock("@/hooks/useActiveAccount", () => ({
  useActiveAccountData: () => null,
  useActiveAccountScores: () => ({}),
}));

vi.mock("@/stores/useBuildsStore", () => ({
  useBuildsStore: vi.fn((selector) => selector({ hasBuildData: () => true })),
}));

vi.mock("@/components/builds/BuildsEmptyState", () => ({
  BuildsEmptyState: () => <div data-testid="builds-empty-state">Empty</div>,
}));

// Mock data
vi.mock("@/config/gameConstants", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/config/gameConstants")>();
  return {
    ...actual,
    charactersById: {
      char1: {
        id: "char1",
        element: "Pyro",
        weaponType: "Sword",
        rarity: 5,
        region: "Mondstadt",
      },
    },
    allCharacters: [
      {
        id: "char1",
        element: "Pyro",
        weaponType: "Sword",
        rarity: 5,
        region: "Mondstadt",
      },
    ],
  };
});

vi.mock("@/generated/catalog/resources", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/generated/catalog/resources")>();
  return {
    ...actual,
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
  };
});

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
vi.mock("@/services/catalog/characterFilters", () => ({
  defaultCharacterFilters: {},
  getDefaultCharacterFilters: () => ({}),
  hasActiveFilters: () => false,
  filterAndSortCharacters: vi.fn(),
}));

describe("CharacterBuildView", () => {
  beforeEach(() => {
    vi.mocked(filterAndSortCharacters).mockReturnValue([
      { id: "char1", element: "Pyro" } as unknown as CharacterResource,
      { id: "char2", element: "Hydro" } as unknown as CharacterResource,
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

    expect(screen.getByText("configure.noChars")).toBeInTheDocument();
  });

  it("shows BuildsEmptyState and no sidebar when no builds exist", () => {
    vi.mocked(useBuildsStore).mockImplementation((selector) =>
      selector({ hasBuildData: () => false } as never)
    );

    render(<CharacterBuildView />);

    // Should show the empty state, not the sidebar layout
    expect(screen.getByTestId("builds-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-layout")).toBeNull();
  });

  it("consumes a linked character without trapping browser Back on this page", async () => {
    window.history.replaceState(null, "", "/account-data/evaluation");
    window.history.pushState(null, "", "/artifact-filter/configure?char=char1");

    render(
      <>
        <CharacterBuildView />
        <NavigationBackProbe />
      </>
    );

    await waitFor(() =>
      expect(screen.getByTestId("current-url")).toHaveTextContent(
        "/artifact-filter/configure"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));

    await waitFor(() =>
      expect(screen.getByTestId("current-url")).toHaveTextContent(
        "/account-data/evaluation"
      )
    );
  });
});
