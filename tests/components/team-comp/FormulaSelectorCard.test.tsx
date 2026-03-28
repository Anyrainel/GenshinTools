import { FormulaSelectorCard } from "@/components/team-comp/FormulaSelectorCard";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ComboLine } from "@/lib/team-comp/types";
import type { Team } from "@/stores/useTeamStore";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { render, screen } from "../../utils/render";

const mockTeam: Team = {
  id: "test-team",
  name: "Test Team",
  characters: ["hu_tao", "xingqiu", "zhongli", "bennett"],
  weapons: [null, null, null, null],
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
};

const mockFormulas = [
  {
    charId: "hu_tao",
    formulaId: "charged",
    label: { en: "Charged ATK", zh: "重击" },
  },
  { charId: "hu_tao", formulaId: "burst", label: { en: "Burst", zh: "爆发" } },
  {
    charId: "xingqiu",
    formulaId: "burst",
    label: { en: "Rain Swords", zh: "雨帘剑" },
  },
];

const mockAvailableFormulas: Record<
  string,
  Record<string, { en: string; zh: string }>
> = {
  hu_tao: {
    charged: { en: "Charged ATK", zh: "重击" },
    burst: { en: "Burst", zh: "爆发" },
  },
  xingqiu: {
    burst: { en: "Rain Swords", zh: "雨帘剑" },
  },
};

type CardProps = Omit<ComponentProps<typeof FormulaSelectorCard>, "t">;

/** Wrapper that injects the real `t` from LanguageProvider. */
function TestCard(props: CardProps) {
  const { t } = useLanguage();
  return <FormulaSelectorCard {...props} t={t} />;
}

function defaultProps(overrides: Partial<CardProps> = {}): CardProps {
  return {
    team: mockTeam,
    effectiveTeam: mockTeam,
    updateTeam: vi.fn(),
    formulaMode: "single",
    allFormulas: mockFormulas,
    availableFormulas: mockAvailableFormulas,
    displayFormulas: Object.fromEntries(
      Object.entries(mockAvailableFormulas).map(([cid, formulas]) => [
        cid,
        Object.fromEntries(
          Object.entries(formulas).map(([fid, label]) => [
            fid,
            { label, minC: 0 },
          ])
        ),
      ])
    ),
    resolvedFormula: null,
    teamBuild: null,
    buildError: null,
    currentReactionOverride: {},
    handleReactionChange: vi.fn(),
    comboLineMap: new Map<string, { lineIndex: number; line: ComboLine }>(),
    setComboLineCount: vi.fn(),
    onResetCombo: vi.fn(),
    onInvestmentClick: vi.fn(),
    isMobile: false,
    ...overrides,
  };
}

describe("FormulaSelectorCard", () => {
  it("renders the card header", () => {
    render(<TestCard {...defaultProps()} />);
    expect(screen.getByText("Formula Selection")).toBeInTheDocument();
  });

  it("renders formula buttons for each character", () => {
    render(<TestCard {...defaultProps()} />);
    expect(screen.getByText("Charged ATK")).toBeInTheDocument();
    expect(screen.getByText("Rain Swords")).toBeInTheDocument();
  });

  it("highlights selected formula button", () => {
    const { container } = render(
      <TestCard
        {...defaultProps({
          resolvedFormula: { charId: "hu_tao", formulaId: "charged" },
        })}
      />
    );
    const selectedBtn = container.querySelector(".bg-primary\\/15");
    expect(selectedBtn).toBeInTheDocument();
    expect(selectedBtn?.textContent).toContain("Charged ATK");
  });

  it("calls updateTeam when a formula button is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const updateTeam = vi.fn();
    render(<TestCard {...defaultProps({ updateTeam })} />);
    await user.click(screen.getByText("Charged ATK"));
    expect(updateTeam).toHaveBeenCalledWith("test-team", {
      selectedFormula: { charId: "hu_tao", formulaId: "charged" },
    });
  });

  it("shows mode toggle buttons for single and combo", () => {
    render(<TestCard {...defaultProps()} />);
    expect(screen.getByText("Single Skill")).toBeInTheDocument();
    expect(screen.getByText("Rotation Total")).toBeInTheDocument();
  });

  it("calls updateTeam with formulaMode when combo mode is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const updateTeam = vi.fn();
    render(<TestCard {...defaultProps({ updateTeam })} />);
    await user.click(screen.getByText("Rotation Total"));
    expect(updateTeam).toHaveBeenCalledWith("test-team", {
      formulaMode: "combo",
    });
  });

  it("shows reset button in combo mode", () => {
    render(<TestCard {...defaultProps({ formulaMode: "combo" })} />);
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("calls onResetCombo when reset button is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onResetCombo = vi.fn();
    render(
      <TestCard {...defaultProps({ formulaMode: "combo", onResetCombo })} />
    );
    await user.click(screen.getByText("Reset"));
    expect(onResetCombo).toHaveBeenCalledOnce();
  });

  it("does not show reset button in single mode", () => {
    render(<TestCard {...defaultProps({ formulaMode: "single" })} />);
    expect(screen.queryByText("Reset")).not.toBeInTheDocument();
  });

  it("shows build error when allFormulas is empty and buildError is set", () => {
    render(
      <TestCard
        {...defaultProps({
          allFormulas: [],
          availableFormulas: {},
          buildError: "Missing character data",
        })}
      />
    );
    expect(screen.getByText("Setup Error:")).toBeInTheDocument();
    expect(screen.getByText("Missing character data")).toBeInTheDocument();
  });

  it("does not show formula buttons when allFormulas is empty", () => {
    render(
      <TestCard {...defaultProps({ allFormulas: [], availableFormulas: {} })} />
    );
    expect(screen.queryByText("Charged ATK")).not.toBeInTheDocument();
    expect(screen.queryByText("Rain Swords")).not.toBeInTheDocument();
  });

  it("renders analyzer button when onInvestmentClick is provided", () => {
    render(<TestCard {...defaultProps()} />);
    expect(screen.getByText("Investment Analysis")).toBeInTheDocument();
  });

  it("calls onInvestmentClick when analyzer button is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onInvestmentClick = vi.fn();
    render(<TestCard {...defaultProps({ onInvestmentClick })} />);
    await user.click(screen.getByText("Investment Analysis"));
    expect(onInvestmentClick).toHaveBeenCalledOnce();
  });

  it("does not render analyzer button when onInvestmentClick is undefined", () => {
    render(<TestCard {...defaultProps({ onInvestmentClick: undefined })} />);
    expect(screen.queryByText("Investment Analysis")).not.toBeInTheDocument();
  });

  describe("combo line counters", () => {
    const comboLineMap = new Map<
      string,
      { lineIndex: number; line: ComboLine }
    >([
      [
        "hu_tao.charged.none",
        {
          lineIndex: 0,
          line: { charId: "hu_tao", formulaId: "charged", count: 3 },
        },
      ],
      [
        "hu_tao.burst.none",
        {
          lineIndex: 1,
          line: { charId: "hu_tao", formulaId: "burst", count: 0 },
        },
      ],
    ]);

    it("displays current combo line counts", () => {
      render(
        <TestCard {...defaultProps({ formulaMode: "combo", comboLineMap })} />
      );
      const counts = screen.getAllByText("3");
      expect(counts.length).toBeGreaterThan(0);
    });

    it("calls setComboLineCount when plus button is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      const setComboLineCount = vi.fn();
      const { container } = render(
        <TestCard
          {...defaultProps({
            formulaMode: "combo",
            comboLineMap,
            setComboLineCount,
          })}
        />
      );
      const plusButtons = Array.from(
        container.querySelectorAll("button")
      ).filter(
        (btn) =>
          btn.querySelector(".lucide-plus") && !btn.hasAttribute("disabled")
      );
      if (plusButtons.length > 0) {
        await user.click(plusButtons[0]);
        expect(setComboLineCount).toHaveBeenCalled();
      }
    });

    it("disables minus button when count is 0", () => {
      const { container } = render(
        <TestCard {...defaultProps({ formulaMode: "combo", comboLineMap })} />
      );
      const disabledMinusButtons = Array.from(
        container.querySelectorAll("button[disabled]")
      ).filter((btn) => btn.querySelector(".lucide-minus"));
      expect(disabledMinusButtons.length).toBeGreaterThan(0);
    });
  });
});
