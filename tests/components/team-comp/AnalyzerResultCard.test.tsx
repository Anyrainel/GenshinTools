import userEvent from "@testing-library/user-event";
import { AnalyzerResultCard } from "@/components/team-comp/AnalyzerResultCard";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import type {
  AnalyzerCharConfig,
  AnalyzerResult,
  AnalyzerStep,
} from "@/lib/team-comp/analyzer/types";
import { render, screen } from "../../utils/render";

// Keep this test focused on choosing an investment budget, independent of
// the graph/table renderers which have their own calculation coverage.
vi.mock("@/components/team-comp/AnalyzerChart", () => ({
  AnalyzerChart: () => null,
}));
vi.mock("@/components/team-comp/AnalyzerTable", () => ({
  AnalyzerTable: () => null,
}));
vi.mock("@/components/team-comp/AnalyzerSequence", () => ({
  AnalyzerSequence: () => null,
}));

const charConfigs: AnalyzerCharConfig[] = [
  {
    charId: "hu_tao",
    rarity: 5,
    weapon5Star: { id: "staff_of_homa" },
    startConstellation: 0,
    startRefinement: 1,
    maxConstellation: 2,
    maxRefinement: 1,
  },
];

const sequence: AnalyzerStep[] = [
  {
    jin: 2,
    allocation: {
      hu_tao: {
        constellation: 0,
        weaponId: "staff_of_homa",
        refinement: 1,
        is5StarWeapon: true,
      },
    },
    damage: 100_000,
    gainVsBaseline: 0,
    gainVsBaselinePct: 0,
    gainVsPrev: 0,
    gainVsPrevPct: 0,
  },
  {
    jin: 3,
    allocation: {
      hu_tao: {
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        is5StarWeapon: true,
      },
    },
    damage: 125_000,
    gainVsBaseline: 25_000,
    gainVsBaselinePct: 25,
    gainVsPrev: 25_000,
    gainVsPrevPct: 25,
  },
  {
    jin: 4,
    allocation: {
      hu_tao: {
        constellation: 2,
        weaponId: "staff_of_homa",
        refinement: 1,
        is5StarWeapon: true,
      },
    },
    damage: 150_000,
    gainVsBaseline: 50_000,
    gainVsBaselinePct: 50,
    gainVsPrev: 25_000,
    gainVsPrevPct: 20,
  },
];

function resultAtLimit(stepCount: number): AnalyzerResult {
  const steps = sequence.slice(0, stepCount);
  const nodes = steps.map((step) => ({
    id: `tier-${step.jin}`,
    jin: step.jin,
    allocation: step.allocation,
    damage: step.damage,
    validated: true,
    isBreakpoint: true,
  }));
  return {
    dag: {
      nodes,
      edges: [],
      baselineJin: 2,
      maxJin: steps.at(-1)?.jin ?? 2,
    },
    bestAtTier: new Map(nodes.map((node) => [node.jin, node])),
    sequence: steps,
    nodesByJin: new Map(),
  };
}

const props = {
  calcContext: {},
  onCalcContextChange: vi.fn(),
  charConfigs,
  teamMeta: new TeamMeta(["hu_tao"]),
  isComputing: false,
  progress: null,
  error: null,
  onRun: vi.fn(),
  onStop: vi.fn(),
};

describe("investment budget recommendation", () => {
  it("shows the best allocation and gain for the chosen additional-copy budget", async () => {
    const user = userEvent.setup();
    render(<AnalyzerResultCard {...props} result={resultAtLimit(3)} />);

    const budget = screen.getByRole("combobox", {
      name: "Additional 5★ copies",
    });
    expect(budget).toHaveTextContent("+1");
    expect(screen.getByText("C1")).toBeInTheDocument();
    expect(screen.getByText("+25.0%")).toBeInTheDocument();

    await user.click(budget);
    await user.click(screen.getByRole("option", { name: "+2" }));

    expect(budget).toHaveTextContent("+2");
    expect(screen.getByText("C2")).toBeInTheDocument();
    expect(screen.getByText("+50.0%")).toBeInTheDocument();
    expect(screen.queryByText("C1")).not.toBeInTheDocument();
  });

  it("keeps the budget and recommendation consistent when refreshed limits remove a tier", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AnalyzerResultCard {...props} result={resultAtLimit(3)} />
    );
    const budget = screen.getByRole("combobox", {
      name: "Additional 5★ copies",
    });
    await user.click(budget);
    await user.click(screen.getByRole("option", { name: "+2" }));

    rerender(<AnalyzerResultCard {...props} result={resultAtLimit(2)} />);
    expect(budget).toHaveTextContent("+1");
    expect(screen.getByText("C1")).toBeInTheDocument();
    expect(screen.getByText("+25.0%")).toBeInTheDocument();
    expect(screen.queryByText("C2")).not.toBeInTheDocument();

    rerender(<AnalyzerResultCard {...props} result={resultAtLimit(1)} />);
    expect(budget).toHaveTextContent("+0");
    expect(screen.getByText("C0")).toBeInTheDocument();
    expect(screen.getByText("+0.0%")).toBeInTheDocument();
  });
});
