import { TeamRosterCard } from "@/components/team-comp/TeamRosterCard";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ComponentProps } from "react";
import { render, screen } from "../../utils/render";

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/hooks/useGameStats", () => ({
  useGameStats: () => ({
    characterStats: {
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
    },
    weaponStats: {
      staff_of_homa: {
        rarity: 5,
        type: "Polearm",
        secondaryStat: "cd",
        levels: { "90": { baseAtk: 608, secondaryStatValue: "66.2%" } },
      },
    },
    ready: true,
  }),
}));

type RosterProps = Omit<ComponentProps<typeof TeamRosterCard>, "t">;

function TestRoster(props: RosterProps) {
  const { t } = useLanguage();
  return <TeamRosterCard {...props} t={t} />;
}

function makeTeam(
  overrides: Partial<RosterProps["team"]> = {}
): RosterProps["team"] {
  return {
    id: "test-team",
    name: "Test Team",
    characters: ["hu_tao", "xingqiu", null, null],
    weapons: ["staff_of_homa", null, null, null],
    artifacts: [null, null, null, null],
    reactions: [],
    reactionOverrides: {},
    combos: [],
    selectedCombo: null,
    formulaMode: "single",
    minEr: {},
    selectedFormula: null,
    optimizationResult: null,
    opts: {},
    ...overrides,
  };
}

function defaultProps(overrides: Partial<RosterProps> = {}): RosterProps {
  return {
    team: makeTeam(),
    updateTeam: vi.fn(),
    accountData: null,
    characterStats: null,
    weaponStats: null,
    isMobile: false,
    ...overrides,
  };
}

describe("TeamRosterCard", () => {
  it("renders the card header", () => {
    render(<TestRoster {...defaultProps()} />);
    expect(screen.getByText("Team Roster")).toBeInTheDocument();
  });

  it("renders character names for filled slots", () => {
    render(<TestRoster {...defaultProps()} />);
    expect(screen.getByText("Hu Tao")).toBeInTheDocument();
    expect(screen.getByText("Xingqiu")).toBeInTheDocument();
  });

  it("renders Min. CR and Min. ER labels for each character", () => {
    render(<TestRoster {...defaultProps()} />);
    const crLabels = screen.getAllByText("Min. CR");
    const erLabels = screen.getAllByText("Min. ER");
    expect(crLabels.length).toBe(2);
    expect(erLabels.length).toBe(2);
  });

  it("shows level selector defaulting to Lv. 90", () => {
    const { container } = render(<TestRoster {...defaultProps()} />);
    // Radix Select renders value inside a span; look for "Lv. 90" prefix match
    const selectValues = container.querySelectorAll("[data-state]");
    const hasLv90 = Array.from(selectValues).some((el) =>
      el.textContent?.includes("90")
    );
    expect(hasLv90).toBe(true);
  });

  it("shows constellation selector defaulting to C0", () => {
    render(<TestRoster {...defaultProps()} />);
    const cSelectors = screen.getAllByText("C0");
    expect(cSelectors.length).toBeGreaterThan(0);
  });

  it("shows refinement selector when weapon is equipped", () => {
    render(<TestRoster {...defaultProps()} />);
    // hu_tao has staff_of_homa
    expect(screen.getByText("R1")).toBeInTheDocument();
  });

  it("does not show refinement for character without weapon", () => {
    render(
      <TestRoster
        {...defaultProps({
          team: makeTeam({ weapons: [null, null, null, null] }),
        })}
      />
    );
    expect(screen.queryByText("R1")).not.toBeInTheDocument();
  });

  it("renders frozen card styling for frozen characters", () => {
    const { container } = render(
      <TestRoster
        {...defaultProps({
          frozenCharIds: new Set(["hu_tao"]),
        })}
      />
    );
    const frozenCards = container.querySelectorAll(".frozen-card");
    expect(frozenCards.length).toBe(1);
  });

  it("does not render frozen styling when no characters are frozen", () => {
    const { container } = render(<TestRoster {...defaultProps()} />);
    const frozenCards = container.querySelectorAll(".frozen-card");
    expect(frozenCards.length).toBe(0);
  });

  it("uses account data constellation when available", () => {
    render(
      <TestRoster
        {...defaultProps({
          accountData: {
            characters: [
              {
                key: "hu_tao",
                constellation: 1,
                level: 90,
                talent: { auto: 10, skill: 10, burst: 10 },
                weapon: {
                  id: "w1",
                  key: "staff_of_homa",
                  level: 90,
                  refinement: 3,
                  lock: false,
                },
                artifacts: {},
              },
            ],
            extraArtifacts: [],
            extraWeapons: [],
          },
        })}
      />
    );
    expect(screen.getByText("C1")).toBeInTheDocument();
    expect(screen.getByText("R3")).toBeInTheDocument();
  });

  it("overrides constellation via opts", () => {
    render(
      <TestRoster
        {...defaultProps({
          team: makeTeam({
            opts: { "hu_tao.overrideConstellation": "6" },
          }),
        })}
      />
    );
    expect(screen.getByText("C6")).toBeInTheDocument();
  });

  it("renders empty slot placeholder for unfilled positions", () => {
    const { container } = render(
      <TestRoster
        {...defaultProps({
          team: makeTeam({ characters: ["hu_tao", null, null, null] }),
        })}
      />
    );
    // There should be at least one dashed border empty slot
    const dashedBorders = container.querySelectorAll(".border-dashed");
    expect(dashedBorders.length).toBeGreaterThan(0);
  });
});
