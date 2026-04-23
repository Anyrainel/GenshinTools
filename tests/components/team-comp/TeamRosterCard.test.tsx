import type { ComponentProps } from "react";
import { TeamRosterCard } from "@/components/team-comp/TeamRosterCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { render, screen } from "../../utils/render";

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

// TeamRosterCard reads characterStats/weaponStats from props, not from
// the resources directly — no module mock needed.

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
    combo: null,
    formulaMode: "single",
    calcContext: {
      enemyLevel: 110,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    },
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
    characterStats: {},
    weaponStats: {},
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

  it("does not render Min.CR / Min.ER labels (moved to DamageCard)", () => {
    render(<TestRoster {...defaultProps()} />);
    expect(screen.queryAllByText("Min.CR")).toHaveLength(0);
    expect(screen.queryAllByText("Min.ER")).toHaveLength(0);
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
