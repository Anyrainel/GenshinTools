import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WeaponStatsMap } from "@/data/gameStatsLoader";
import type { WeaponResource } from "@/data/types";
import { WeaponArchiveView } from "@/pages/archive/WeaponArchiveView";
import { useArchiveSessionStore } from "@/stores/useArchiveSessionStore";
import { render, screen, within } from "../../utils/render";

vi.mock("@/contexts/LanguageContext", () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  useLanguage: () => ({
    language: "en",
    t: {
      ui: (key: string) =>
        (
          ({
            "archive.noWeaponResults": "No weapons match these filters",
            "archive.searchItemPlaceholder": "Search items...",
          }) as Record<string, string>
        )[key] ?? key,
      weapon: (id: string) =>
        ({ sun_sword: "Solar Sword", moon_bow: "Lunar Bow" })[id] ?? id,
      weaponEffect: () => "",
      weaponType: (type: string) => type,
      statShort: (stat: string) => stat,
    },
  }),
}));

vi.mock("@/data/gameResources", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/gameResources")>();
  const sortedWeapons = [
    {
      id: "sun_sword",
      rarity: 4,
      imagePath: "/weapon/sun_sword.webp",
    },
    {
      id: "moon_bow",
      rarity: 5,
      imagePath: "/weapon/moon_bow.webp",
    },
  ] satisfies WeaponResource[];

  return { ...actual, sortedWeapons };
});

vi.mock("@/data/gameStatsLoader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/gameStatsLoader")>();
  const weaponStats = {
    sun_sword: {
      rarity: 4,
      type: "Sword",
      secondaryStat: "atk%",
      levels: { "90": { baseAtk: 510, secondaryStatValue: "41.3%" } },
    },
    moon_bow: {
      rarity: 5,
      type: "Bow",
      secondaryStat: "cr",
      levels: { "90": { baseAtk: 608, secondaryStatValue: "33.1%" } },
    },
  } satisfies WeaponStatsMap;

  return {
    ...actual,
    weaponStatsResource: { use: () => weaponStats },
  };
});

vi.mock("@/components/archive/WeaponCard", () => ({
  WeaponCard: ({ weapon }: { weapon: WeaponResource }) => (
    <div>{weapon.id}</div>
  ),
}));

const SEARCH_PLACEHOLDER = "Search items...";

function getFilterChips(searchInput: HTMLElement) {
  const toolbar = searchInput.parentElement?.parentElement;
  if (!toolbar) throw new Error("Archive toolbar not found");
  return within(toolbar).getAllByRole("button");
}

function getWeaponTypeChip(searchInput: HTMLElement, type: string) {
  const chip = getFilterChips(searchInput).find((button) =>
    button.querySelector(`img[alt="${type}"]`)
  );
  if (!chip) throw new Error(`${type} filter chip not found`);
  return chip;
}

describe("WeaponArchiveView search scope", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useArchiveSessionStore.setState({ weaponSearch: "" });
  });

  it("ignores saved chips only during a non-whitespace search", async () => {
    const user = userEvent.setup();
    render(<WeaponArchiveView />);

    const searchInput = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    await user.click(getWeaponTypeChip(searchInput, "Sword"));

    expect(screen.getByText("sun_sword")).toBeInTheDocument();
    expect(screen.queryByText("moon_bow")).not.toBeInTheDocument();

    await user.type(searchInput, "   ");
    for (const chip of getFilterChips(searchInput)) {
      expect(chip).toBeEnabled();
    }
    expect(screen.getByText("sun_sword")).toBeInTheDocument();
    expect(screen.queryByText("moon_bow")).not.toBeInTheDocument();

    await user.type(searchInput, "lunar");
    expect(screen.getByText("moon_bow")).toBeInTheDocument();
    expect(screen.queryByText("sun_sword")).not.toBeInTheDocument();
    for (const chip of getFilterChips(searchInput)) {
      expect(chip).toBeDisabled();
    }

    await user.clear(searchInput);
    expect(screen.getByText("sun_sword")).toBeInTheDocument();
    expect(screen.queryByText("moon_bow")).not.toBeInTheDocument();
    for (const chip of getFilterChips(searchInput)) {
      expect(chip).toBeEnabled();
    }
  });
});
