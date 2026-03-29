import { StatSheetPanel } from "@/components/team-comp/StatSheetPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DisplayResult, StatKey } from "@/lib/team-comp/types";
import type { Team } from "@/stores/useTeamStore";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { render, screen } from "../../utils/render";

const mockTeam: Team = {
  id: "test-team",
  name: "Test Team",
  characters: ["hu_tao", "xingqiu", null, null],
  weapons: ["staff_of_homa", "sacrificial_sword", null, null],
  artifacts: [null, null, null, null],
  reactions: [],
  combos: [],
  selectedCombo: null,
  formulaMode: "single",
  minEr: {},
  selectedFormula: null,
  optimizationResult: null,
  opts: {},
};

/** Minimal DisplayResult with stat records for two characters. */
function makeResult(overrides?: Partial<DisplayResult>): DisplayResult {
  return {
    partsByFormula: {},
    totalDamage: 50000,
    buffs: [],
    buffActivation: {},
    statSheets: {},
    charFormulaTags: {},
    marginalGains: {
      hu_tao: { "atk%": 0.015, cr: 0.008, cd: 0.012 },
      xingqiu: {},
    },
    levelUpGains: {},
    idleStatRecords: {
      hu_tao: {
        onField: {
          hp: 30000,
          atk: 800,
          def: 700,
          em: 100,
          er: 1.2,
          cr: 0.6,
          cd: 1.5,
        },
        offField: {
          hp: 30000,
          atk: 800,
          def: 700,
          em: 100,
          er: 1.2,
          cr: 0.6,
          cd: 1.5,
        },
      },
      xingqiu: {
        onField: {
          hp: 20000,
          atk: 600,
          def: 500,
          em: 50,
          er: 1.8,
          cr: 0.5,
          cd: 1.0,
        },
        offField: {
          hp: 20000,
          atk: 600,
          def: 500,
          em: 50,
          er: 1.8,
          cr: 0.5,
          cd: 1.0,
        },
      },
    },
    intrinsicSaturatedCharIds: [],
    ...overrides,
  } as DisplayResult;
}

type PanelProps = Omit<ComponentProps<typeof StatSheetPanel>, "t">;

/** Wrapper that injects the real `t` from LanguageProvider. */
function TestPanel(props: PanelProps) {
  const { t } = useLanguage();
  return <StatSheetPanel {...props} t={t} />;
}

function defaultProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    result: makeResult(),
    team: mockTeam,
    artifactsByChar: { hu_tao: {}, xingqiu: {} },
    targetCharId: "hu_tao",
    highlightedStat: null as {
      key: StatKey | "charLevel";
      charId: string;
    } | null,
    onStatHover: vi.fn(),
    frozenCharIds: undefined,
    onFreezeChar: vi.fn(),
    onUnfreezeChar: vi.fn(),
    ...overrides,
  };
}

describe("StatSheetPanel", () => {
  it("renders character avatars for filled slots", () => {
    render(<TestPanel {...defaultProps()} />);
    const imgs = screen.getAllByRole("img");
    const alts = imgs.map((img) => img.getAttribute("alt"));
    expect(alts).toContain("hu_tao");
    expect(alts).toContain("xingqiu");
  });

  it("renders view mode buttons when result is provided", () => {
    render(<TestPanel {...defaultProps()} />);
    const idleButtons = screen.getAllByText("Idle");
    const combatButtons = screen.getAllByText("Combat");
    const marginalButtons = screen.getAllByText("Marginal");
    expect(idleButtons.length).toBe(2);
    expect(combatButtons.length).toBe(2);
    expect(marginalButtons.length).toBe(2);
  });

  it("does not render view mode buttons when result is null", () => {
    render(<TestPanel {...defaultProps({ result: null })} />);
    expect(screen.queryByText("Idle")).not.toBeInTheDocument();
    expect(screen.queryByText("Combat")).not.toBeInTheDocument();
    expect(screen.queryByText("Marginal")).not.toBeInTheDocument();
  });

  it("toggles idle view on click to show stat labels", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TestPanel {...defaultProps()} />);
    const idleButtons = screen.getAllByText("Idle");
    await user.click(idleButtons[0]);
    // After opening idle view, stat column headers should appear
    expect(screen.getByText("Off-Field")).toBeInTheDocument();
  });

  it("collapses view on second click", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TestPanel {...defaultProps()} />);
    const idleButtons = screen.getAllByText("Idle");
    // Open
    await user.click(idleButtons[0]);
    const tablesBefore = container.querySelectorAll("table");
    expect(tablesBefore.length).toBeGreaterThan(0);
    // Close
    await user.click(idleButtons[0]);
    // The stat table should be removed
    const tablesAfter = container.querySelectorAll("table");
    expect(tablesAfter.length).toBeLessThan(tablesBefore.length);
  });

  it("switches between view modes for same character", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TestPanel {...defaultProps()} />);
    // Open idle
    const idleButtons = screen.getAllByText("Idle");
    await user.click(idleButtons[0]);
    expect(screen.getByText("Off-Field")).toBeInTheDocument();
    // Switch to marginal
    const marginalButtons = screen.getAllByText("Marginal");
    await user.click(marginalButtons[0]);
    // Marginal view should show gain values
  });

  describe("freeze/unfreeze", () => {
    it("does not show freeze button when character has no artifacts", () => {
      render(<TestPanel {...defaultProps()} />);
      expect(screen.queryByText("Freeze")).not.toBeInTheDocument();
    });

    it("shows unfreeze button for frozen characters", () => {
      render(
        <TestPanel {...defaultProps({ frozenCharIds: new Set(["hu_tao"]) })} />
      );
      expect(screen.getByText("Thaw")).toBeInTheDocument();
    });

    it("calls onUnfreezeChar when thaw is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      const onUnfreezeChar = vi.fn();
      render(
        <TestPanel
          {...defaultProps({
            frozenCharIds: new Set(["hu_tao"]),
            onUnfreezeChar,
          })}
        />
      );
      await user.click(screen.getByText("Thaw"));
      expect(onUnfreezeChar).toHaveBeenCalledWith("hu_tao");
    });
  });

  describe("saturated badge", () => {
    it("shows saturated badge for non-target character with zero marginals", () => {
      render(
        <TestPanel
          {...defaultProps({
            result: makeResult({
              marginalGains: { hu_tao: { "atk%": 0.01 }, xingqiu: {} },
            }),
          })}
        />
      );
      expect(screen.getByText("Saturated")).toBeInTheDocument();
    });

    it("does not show saturated badge for target character even with zero marginals", () => {
      render(
        <TestPanel
          {...defaultProps({
            result: makeResult({
              marginalGains: { hu_tao: {}, xingqiu: { "atk%": 0.01 } },
            }),
          })}
        />
      );
      // hu_tao is target — should NOT show Saturated even with empty marginals
      expect(screen.queryByText("Saturated")).not.toBeInTheDocument();
    });

    it("shows saturated badge only for non-target chars with zero marginals", () => {
      render(
        <TestPanel
          {...defaultProps({
            result: makeResult({
              marginalGains: { hu_tao: {}, xingqiu: {} },
            }),
          })}
        />
      );
      // Only xingqiu (non-target) should show Saturated — hu_tao is target
      const badges = screen.getAllByText("Saturated");
      expect(badges.length).toBe(1);
    });
  });

  describe("fail reasons", () => {
    it("shows fail reason alert when failReasons is set for a character", () => {
      const { container } = render(
        <TestPanel
          {...defaultProps({
            failReasons: {
              hu_tao: { kind: "empty-pool" as const, emptySlots: [] },
            },
          })}
        />
      );
      // Should show amber alert box with the fail reason
      const alerts = container.querySelectorAll(".text-amber-400");
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});
