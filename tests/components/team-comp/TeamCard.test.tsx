import { TeamCard } from "@/components/team-comp/TeamCard";
import type { Team } from "@/lib/team-comp/types";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

const mockCharStats = {
  hu_tao: {
    rarity: 5,
    element: "Pyro",
    weaponType: "Polearm",
    region: "Liyue",
    releaseDate: "2021-03-02",
    levels: {},
  },
  xingqiu: {
    rarity: 4,
    element: "Hydro",
    weaponType: "Sword",
    region: "Liyue",
    releaseDate: "2020-09-28",
    levels: {},
  },
  zhongli: {
    rarity: 5,
    element: "Geo",
    weaponType: "Polearm",
    region: "Liyue",
    releaseDate: "2020-12-01",
    levels: {},
  },
  bennett: {
    rarity: 4,
    element: "Pyro",
    weaponType: "Sword",
    region: "Mondstadt",
    releaseDate: "2020-09-28",
    levels: {},
  },
};
const mockWeapStats = {
  staff_of_homa: {
    rarity: 5,
    type: "Polearm",
    secondaryStat: "cd",
    levels: { "90": { baseAtk: 608, secondaryStatValue: "66.2%" } },
  },
  sacrificial_sword: {
    rarity: 4,
    type: "Sword",
    secondaryStat: "er",
    levels: { "90": { baseAtk: 454, secondaryStatValue: "61.3%" } },
  },
  black_tassel: {
    rarity: 3,
    type: "Polearm",
    secondaryStat: "hp%",
    levels: { "90": { baseAtk: 354, secondaryStatValue: "46.9%" } },
  },
  skyward_blade: {
    rarity: 5,
    type: "Sword",
    secondaryStat: "er",
    levels: { "90": { baseAtk: 608, secondaryStatValue: "55.1%" } },
  },
};
vi.mock("@/data/gameStatsLoader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/gameStatsLoader")>();
  return {
    ...actual,
    characterStatsResource: {
      preload: () => Promise.resolve(mockCharStats),
      use: () => mockCharStats,
      peek: () => mockCharStats,
    },
    weaponStatsResource: {
      preload: () => Promise.resolve(mockWeapStats),
      use: () => mockWeapStats,
      peek: () => mockWeapStats,
    },
  };
});

const mockTeam: Team = {
  id: "team-1",
  name: "Hu Tao Vape",
  characters: ["hu_tao", "xingqiu", "zhongli", null],
  weapons: [null, null, null, null],
  artifacts: [null, null, null, null],
  reactions: [],
  opts: {},
  calcContext: {
    enemyLevel: 110,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  },
  selectedFormula: null,
  optimizationResult: null,
  formulaMode: "single",
  combo: null,
};

describe("TeamCard", () => {
  const mockOnUpdate = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCopy = vi.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockOnDelete.mockClear();
    mockOnCopy.mockClear();
  });

  it("displays team name in input field", () => {
    render(
      <TeamCard
        team={mockTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    const input = screen.getByDisplayValue("Hu Tao Vape");
    expect(input).toBeInTheDocument();
  });

  it("calls onUpdate when team name is changed", async () => {
    const user = userEvent.setup();
    render(
      <TeamCard
        team={mockTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    const input = screen.getByDisplayValue("Hu Tao Vape");
    await user.clear(input);
    await user.type(input, "New Team Name");

    // Should call onUpdate with name field
    expect(mockOnUpdate).toHaveBeenCalled();
    const lastCall =
      mockOnUpdate.mock.calls[mockOnUpdate.mock.calls.length - 1][0];
    expect(lastCall.name).toBeDefined();
  });

  it("renders element badges on character icons", () => {
    const { container } = render(
      <TeamCard
        team={mockTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    // 3 characters with elements (hu_tao=Pyro, xingqiu=Hydro, zhongli=Geo)
    // Element icons are rendered in Row 0 with alt set to the element name
    expect(container.querySelector('img[alt="Pyro"]')).toBeInTheDocument();
    expect(container.querySelector('img[alt="Hydro"]')).toBeInTheDocument();
    expect(container.querySelector('img[alt="Geo"]')).toBeInTheDocument();
  });

  it("renders empty placeholder for null character slots", () => {
    const emptyTeam: Team = {
      id: "team-2",
      name: "Empty",
      characters: [null, null, null, null],
      weapons: [null, null, null, null],
      artifacts: [null, null, null, null],
      reactions: [],
      opts: {},
      calcContext: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      selectedFormula: null,
      optimizationResult: null,
      formulaMode: "single",
      combo: null,
    };

    render(
      <TeamCard
        team={emptyTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    // The optimize button should be disabled when no characters are configured
    const optimizeBtn = screen.getByRole("button", {
      name: /Damage Optimization/i,
    });
    expect(optimizeBtn).toBeDisabled();
  });

  it("enables optimize button when all slots are filled", () => {
    const fullTeam: Team = {
      id: "team-3",
      name: "Full Team",
      characters: ["hu_tao", "xingqiu", "zhongli", "bennett"],
      weapons: [
        "staff_of_homa",
        "sacrificial_sword",
        "black_tassel",
        "skyward_blade",
      ],
      artifacts: [
        { type: "4pc", setId: "crimson_witch_of_flames" },
        { type: "4pc", setId: "emblem_of_severed_fate" },
        { type: "4pc", setId: "tenacity_of_the_millelith" },
        { type: "4pc", setId: "noblesse_oblige" },
      ],
      reactions: ["vaporize"],
      opts: {},
      calcContext: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      selectedFormula: null,
      optimizationResult: null,
      formulaMode: "single",
      combo: null,
    };

    render(
      <TeamCard
        team={fullTeam}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
      />
    );

    const optimizeBtn = screen.getByRole("button", {
      name: /Damage Optimization/i,
    });
    expect(optimizeBtn).not.toBeDisabled();
  });
});
