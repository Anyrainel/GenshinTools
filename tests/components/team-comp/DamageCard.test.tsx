import {
  ComparisonLabel,
  DamageCard,
  DpsDisplay,
} from "@/components/team-comp/DamageCard";
import { CharCrErSettings } from "@/components/team-comp/GeneratorControls";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TierAssignment } from "@/data/types";
import type { CalcContext, DisplayResult } from "@/lib/team-comp/types";
import type { Team } from "@/stores/useTeamStore";
import userEvent from "@testing-library/user-event";
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
    weaponStats: {},
    ready: true,
  }),
}));

const mockTeam: Team = {
  id: "test-team",
  name: "Test Team",
  characters: ["hu_tao", "xingqiu", null, null],
  weapons: ["staff_of_homa", null, null, null],
  artifacts: [null, null, null, null],
  reactions: [],
  combo: null,
  formulaMode: "combo",
  calcContext: {
    enemyLevel: 110,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  },
  selectedFormula: null,
  optimizationResult: null,
  opts: {},
};

function makeDisplayResult(overrides?: Partial<DisplayResult>): DisplayResult {
  return {
    partsByFormula: {},
    totalDamage: 50000,
    buffs: [],
    buffActivation: {},
    statSheets: {},
    charFormulaTags: {},
    marginalGains: { hu_tao: {}, xingqiu: {} },
    levelUpGains: {},
    idleStatRecords: {},
    intrinsicSaturatedCharIds: [],
    ...overrides,
  } as DisplayResult;
}

type CardProps = ComponentProps<typeof DamageCard>;

function TestCard(props: CardProps) {
  return <DamageCard {...props} />;
}

function defaultProps(overrides: Partial<CardProps> = {}): CardProps {
  return {
    team: mockTeam,
    effectiveTeam: mockTeam,
    updateTeam: vi.fn(),
    resolvedFormula: null,
    isMobile: false,
    equippedArtifactsByChar: {},
    currentDisplayResult: null,
    accountData: null,
    activeContext: {} as CalcContext,
    isComputing: false,
    teamProgress: null,
    teamResult: null,
    teamError: null,
    handleOptimize: vi.fn(),
    timeBudgetSec: 30,
    onTimeBudgetChange: vi.fn(),
    optimizedArtifactsByChar: {},
    optimizedDisplayResult: null,
    minErRaw: 100,
    genComputing: false,
    genResult: null,
    genError: null,
    handleGenerate: vi.fn(),
    genArtifactsByChar: {},
    genDisplayResult: null,
    formulaMode: "combo",
    ...overrides,
  };
}

describe("DamageCard", () => {
  it("renders the card header", () => {
    render(<TestCard {...defaultProps()} />);
    expect(screen.getByText("Artifacts & Damage")).toBeInTheDocument();
  });

  it("renders tab buttons for Current, Optimize, Generate", () => {
    render(<TestCard {...defaultProps()} />);
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Optimize")).toBeInTheDocument();
    expect(screen.getByText("Generate")).toBeInTheDocument();
  });

  it("renders tab descriptions", () => {
    render(<TestCard {...defaultProps()} />);
    expect(screen.getByText("Equipped in account")).toBeInTheDocument();
    expect(screen.getByText("Best from inventory")).toBeInTheDocument();
    expect(screen.getByText("Theoretical best stats")).toBeInTheDocument();
  });

  it("shows empty message when no combo lines are active", () => {
    render(<TestCard {...defaultProps()} />);
    expect(
      screen.getByText(/Add formula counts in the combo tab/i)
    ).toBeInTheDocument();
  });

  it("switches to optimize tab when clicked", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TestCard {...defaultProps()} />);
    // Click the tab title "Optimize" — use getAllByText since it appears in title + description area
    const optimizeBtns = screen.getAllByText("Optimize");
    await user.click(optimizeBtns[0]);
    // After switching, the opt empty message should be visible
    expect(screen.getByText(/Press Run Optimization/i)).toBeInTheDocument();
  });

  it("shows error message when teamError is set on optimize tab", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TestCard
        {...defaultProps({
          teamError: new Error("Something went wrong"),
        })}
      />
    );
    const optimizeBtns = screen.getAllByText("Optimize");
    await user.click(optimizeBtns[0]);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows empty state in optimize tab when no result", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TestCard {...defaultProps()} />);
    const optimizeBtns = screen.getAllByText("Optimize");
    await user.click(optimizeBtns[0]);
    expect(screen.getByText(/Press Run Optimization/i)).toBeInTheDocument();
  });

  it("shows freeze button when onFreezeAll is provided in optimize tab", async () => {
    const user = userEvent.setup({ delay: null });
    const onFreezeAll = vi.fn();
    render(
      <TestCard
        {...defaultProps({
          onFreezeAll,
          hasOptResult: true,
          teamResult: {
            done: true,
            bestDamage: 50000,
            bestAllocation: {},
            bestSubstatWeights: {},
            bestComboResult: null,
            bestArtifactsByChar: {},
            passResults: [],
            failReasons: {},
          } as unknown as CardProps["teamResult"],
          resolvedFormula: { charId: "hu_tao", formulaId: "charged" },
        })}
      />
    );
    const optimizeBtns = screen.getAllByText("Optimize");
    await user.click(optimizeBtns[0]);
    expect(screen.getByText("Freeze All")).toBeInTheDocument();
  });

  it("shows unfreeze button when team is frozen", async () => {
    const user = userEvent.setup({ delay: null });
    const onUnfreezeAll = vi.fn();
    render(
      <TestCard
        {...defaultProps({
          isFrozen: true,
          onUnfreezeAll,
        })}
      />
    );
    const optimizeBtns = screen.getAllByText("Optimize");
    await user.click(optimizeBtns[0]);
    expect(screen.getByText("Thaw All")).toBeInTheDocument();
  });

  it("disables optimize button when fully frozen", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TestCard
        {...defaultProps({
          isFullyFrozen: true,
          resolvedFormula: { charId: "hu_tao", formulaId: "charged" },
        })}
      />
    );
    const optimizeBtns = screen.getAllByText("Optimize");
    await user.click(optimizeBtns[0]);
    expect(screen.getByText("Frozen")).toBeInTheDocument();
  });

  it("shows inventory warning when account has characters but no extra artifacts", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TestCard
        {...defaultProps({
          accountData: {
            characters: [
              {
                key: "hu_tao",
                constellation: 0,
                level: 90,
                talent: { auto: 1, skill: 1, burst: 1 },
                artifacts: {},
              },
            ],
            extraArtifacts: [],
            extraWeapons: [],
          },
        })}
      />
    );
    const optimizeBtns = screen.getAllByText("Optimize");
    await user.click(optimizeBtns[0]);
    expect(
      screen.getByText(/Only equipped artifacts detected/i)
    ).toBeInTheDocument();
  });
});

// ─── ComparisonLabel ───

function TestComparisonLabel(
  props: Partial<ComponentProps<typeof ComparisonLabel>>
) {
  const { t } = useLanguage();
  return (
    <ComparisonLabel
      currentTotal={50000}
      optimizedTotal={50000}
      isMobile={false}
      t={t}
      {...props}
    />
  );
}

describe("ComparisonLabel", () => {
  it("renders nothing when currentTotal is 0", () => {
    const { container } = render(
      <TestComparisonLabel currentTotal={0} optimizedTotal={50000} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when optimizedTotal is 0", () => {
    const { container } = render(
      <TestComparisonLabel currentTotal={50000} optimizedTotal={0} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows positive percentage in green when optimized > current", () => {
    render(<TestComparisonLabel currentTotal={40000} optimizedTotal={50000} />);
    const label = screen.getByText("+25.0%");
    expect(label).toBeInTheDocument();
    expect(label.className).toContain("text-green-400");
  });

  it("shows negative percentage in red when optimized < current", () => {
    render(<TestComparisonLabel currentTotal={50000} optimizedTotal={40000} />);
    const label = screen.getByText("-20.0%");
    expect(label).toBeInTheDocument();
    expect(label.className).toContain("text-red-400");
  });

  it("shows +0.0% when values are equal", () => {
    render(<TestComparisonLabel currentTotal={50000} optimizedTotal={50000} />);
    const label = screen.getByText("+0.0%");
    expect(label).toBeInTheDocument();
    expect(label.className).toContain("text-green-400");
  });

  it("shows asterisk and caveat line when caveats are provided", () => {
    render(
      <TestComparisonLabel
        currentTotal={40000}
        optimizedTotal={50000}
        caveats={["套装不同", "暴击不符合要求"]}
      />
    );
    // Caveat line with joined items (includes asterisk prefix)
    expect(screen.getByText(/套装不同，暴击不符合要求/)).toBeInTheDocument();
  });

  it("does not show asterisk when caveats is empty", () => {
    const { container } = render(
      <TestComparisonLabel
        currentTotal={40000}
        optimizedTotal={50000}
        caveats={[]}
      />
    );
    expect(container.textContent).not.toContain("*");
  });
});

// ─── DpsDisplay ───

function TestDpsDisplay(props: Partial<ComponentProps<typeof DpsDisplay>>) {
  const { t } = useLanguage();
  return (
    <DpsDisplay
      totalDamage={100000}
      dpsSeconds=""
      setDpsSeconds={vi.fn()}
      isMobile={false}
      t={t}
      {...props}
    />
  );
}

describe("DpsDisplay", () => {
  it("renders seconds input", () => {
    render(<TestDpsDisplay />);
    // The input should exist with placeholder "—"
    const input = screen.getByPlaceholderText("—");
    expect(input).toBeInTheDocument();
  });

  it("shows dmg/s calculation when seconds is filled", () => {
    render(<TestDpsDisplay totalDamage={100000} dpsSeconds="10" />);
    // 100000 / 10 = 10000 → formatted as "10,000"
    expect(screen.getByText(/10,000/)).toBeInTheDocument();
  });

  it("shows nothing for dmg/s when seconds is empty", () => {
    render(<TestDpsDisplay totalDamage={100000} dpsSeconds="" />);
    // Should not have the "= X/s" text
    expect(screen.queryByText(/=/)).not.toBeInTheDocument();
  });
});

// ─── CharCrErSettings ───

function TestCharCrErSettings(
  props: Partial<ComponentProps<typeof CharCrErSettings>> & {
    team?: Team;
  }
) {
  const { t } = useLanguage();
  return (
    <CharCrErSettings
      team={props.team ?? mockTeam}
      updateTeam={props.updateTeam ?? vi.fn()}
      tierAssignments={props.tierAssignments}
      t={t}
    />
  );
}

describe("CharCrErSettings", () => {
  it("renders a row for each character in the team", () => {
    render(<TestCharCrErSettings />);
    // mockTeam has hu_tao and xingqiu (2 non-null characters) — shown as icons only
    expect(screen.getByAltText("Hu Tao")).toBeInTheDocument();
    expect(screen.getByAltText("Xingqiu")).toBeInTheDocument();
  });

  it("shows CR mode selector", () => {
    render(<TestCharCrErSettings />);
    // Default CR mode is "min" → should display "Min.CR" for each character
    expect(screen.getAllByText("Min.CR").length).toBeGreaterThanOrEqual(2);
  });

  it("shows ER input", () => {
    render(<TestCharCrErSettings />);
    // Should have "Min.ER" labels for each character
    expect(screen.getAllByText("Min.ER").length).toBe(2);
  });

  it("shows Tier checkbox when character has tier assignment", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      xingqiu: { tier: "A", position: 1 },
    };
    render(<TestCharCrErSettings tierAssignments={tierAssignments} />);
    // Should show tier labels for both characters
    expect(screen.getAllByText("Avoid stealing from higher tiers").length).toBe(
      2
    );
  });

  it("does not show Tier checkbox when no tierAssignments", () => {
    render(<TestCharCrErSettings />);
    // Without tierAssignments, no tier labels should appear
    expect(
      screen.queryByText("Avoid stealing from higher tiers")
    ).not.toBeInTheDocument();
  });
});
