import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterArchiveView } from "@/pages/archive/CharacterArchiveView";
import { useArchiveSessionStore } from "@/stores/useArchiveSessionStore";
import { render, screen, waitFor, within } from "../../utils/render";

const CHARACTER_STATS = {
  amber: {
    rarity: 4,
    element: "Pyro",
    weaponType: "Bow",
    region: "Mondstadt",
    releaseDate: "2020-09-28",
    levels: {},
  },
  furina: {
    rarity: 5,
    element: "Hydro",
    weaponType: "Sword",
    region: "Fontaine",
    releaseDate: "2023-11-08",
    levels: {},
  },
} as const;

vi.mock("@/contexts/LanguageContext", () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  useLanguage: () => ({
    t: {
      character: (id: string) =>
        ({ amber: "Amber", furina: "Furina" })[id] ?? id,
      constellations: () => null,
      element: (element: string) => element,
      glossary: () => null,
      passives: () => null,
      skills: () => null,
      ui: (key: string) =>
        (
          ({
            "archive.characterLabel": "Characters",
            "archive.noCharacterSelected": "No character selected",
            "archive.noResults": "No results",
            "archive.searchPlaceholder": "Search characters...",
          }) as Record<string, string>
        )[key] ?? key,
      weaponType: (weaponType: string) => weaponType,
    },
  }),
}));

vi.mock("@/data/gameResources", () => {
  const resource = { imagePath: "/test.png" };
  return {
    allCharacters: [
      { id: "amber", imagePath: "/amber.png", rarity: 4 },
      { id: "furina", imagePath: "/furina.png", rarity: 5 },
    ],
    betaCharacterIds: new Set<string>(),
    elementResourcesByName: {
      Anemo: resource,
      Cryo: resource,
      Dendro: resource,
      Electro: resource,
      Geo: resource,
      Hydro: resource,
      Pyro: resource,
    },
    weaponResourcesByName: {
      Bow: resource,
      Catalyst: resource,
      Claymore: resource,
      Polearm: resource,
      Sword: resource,
    },
  };
});

vi.mock("@/data/gameStatsLoader", () => ({
  characterStatsResource: { use: () => CHARACTER_STATS },
  getCharacterDisplayMeta: (
    character: { rarity: number },
    stats:
      | {
          element: string;
          rarity: number;
          region: string;
          releaseDate: string;
          weaponType: string;
        }
      | undefined
  ) => ({
    element: stats?.element,
    rarity: stats?.rarity ?? character.rarity,
    region: stats?.region,
    releaseDate: stats?.releaseDate,
    weaponType: stats?.weaponType,
  }),
}));

vi.mock("@/components/archive/CharacterDetailPanel", () => ({
  CharacterDetailPanel: () => null,
}));

vi.mock("@/components/artifact-builds/BuildsDefaultPresetPrompt", () => ({
  BuildsDefaultPresetPrompt: () => null,
}));

vi.mock("@/components/layout/SidebarDetailLayout", () => ({
  SidebarDetailLayout: ({
    header,
    sidebar,
  }: {
    header: React.ReactNode;
    sidebar: React.ReactNode;
  }) => (
    <>
      <div data-testid="archive-header">{header}</div>
      <div>{sidebar}</div>
    </>
  ),
}));

vi.mock("@/components/shared/ItemIcon", () => ({
  ItemIcon: () => null,
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/hooks/useOwnership", () => ({
  useIsOwned: () => () => true,
}));

describe("CharacterArchiveView search filter scope", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useArchiveSessionStore.setState({
      characterSearch: "",
      selectedCharacterId: null,
    });
  });

  it("temporarily disables and ignores saved chips only for non-whitespace search", async () => {
    const user = userEvent.setup();
    render(<CharacterArchiveView />);

    const searchInput = screen.getByPlaceholderText("Search characters...");
    const toolbar = screen.getByTestId("archive-header");
    const filterButtons = () => within(toolbar).getAllByRole("button");
    const pyroChip = screen.getByRole("button", { name: /Pyro/ });

    expect(filterButtons()).toHaveLength(14);
    expect(
      filterButtons().every((button) => !button.hasAttribute("disabled"))
    ).toBe(true);

    await user.click(pyroChip);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Amber" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Furina" })
      ).not.toBeInTheDocument();
    });

    await user.type(searchInput, "   ");

    expect(filterButtons().every((button) => button.matches(":enabled"))).toBe(
      true
    );
    expect(screen.getByRole("button", { name: "Amber" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Furina" })
    ).not.toBeInTheDocument();

    await user.type(searchInput, "Furina");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Furina" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Amber" })
      ).not.toBeInTheDocument();
    });
    expect(filterButtons().every((button) => button.matches(":disabled"))).toBe(
      true
    );

    await user.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Amber" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Furina" })
      ).not.toBeInTheDocument();
    });
    expect(filterButtons().every((button) => button.matches(":enabled"))).toBe(
      true
    );
  });
});
