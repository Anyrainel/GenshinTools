import { DamageCard } from "@/components/team-comp/DamageCard";
import { useLanguage } from "@/contexts/LanguageContext";
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
  combos: [],
  selectedCombo: null,
  formulaMode: "combo",
  minEr: {},
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

type CardProps = Omit<ComponentProps<typeof DamageCard>, "t">;

function TestCard(props: CardProps) {
  const { t } = useLanguage();
  return <DamageCard {...props} t={t} />;
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
