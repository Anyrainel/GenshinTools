import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalyzerResultCard } from "@/components/teams/AnalyzerResultCard";
import type {
  AnalyzerCharConfig,
  AnalyzerResult,
} from "@/domain/combat/analyzer/types";
import { render, screen } from "../../utils/render";

vi.mock("@/components/teams/AnalyzerChart", () => ({
  AnalyzerChart: () => <div>path chart</div>,
}));
vi.mock("@/components/teams/AnalyzerTable", () => ({
  AnalyzerTable: () => <div>path table</div>,
}));
vi.mock("@/components/teams/AnalyzerSequence", () => ({
  AnalyzerSequence: () => <div>path sequence</div>,
}));
const configs: AnalyzerCharConfig[] = [
  {
    charId: "hu_tao",
    rarity: 5,
    weapon5Star: { id: "staff_of_homa" },
    startConstellation: 0,
    startRefinement: 1,
    maxConstellation: 1,
    maxRefinement: 1,
  },
];
function result(): AnalyzerResult {
  const nodes = [0, 1].map((c) => ({
    id: `c${c}`,
    jin: c + 2,
    damage: 100000 + c * 25000,
    validated: true,
    isBreakpoint: true,
    allocation: {
      hu_tao: {
        constellation: c,
        weaponId: "staff_of_homa",
        refinement: 1,
        is5StarWeapon: true,
      },
    },
  }));
  return {
    dag: { nodes, edges: [], baselineJin: 2, maxJin: 3 },
    bestAtTier: new Map(nodes.map((n) => [n.jin, n])),
    nodesByJin: new Map(nodes.map((n) => [n.jin, [n]])),
    sequence: nodes.map((node) => ({
      ...node,
      gainVsBaseline: node.damage - 100000,
      gainVsBaselinePct: node.damage / 1000 - 100,
      gainVsPrev: 0,
      gainVsPrevPct: 0,
    })),
  };
}
describe("investment path result views", () => {
  it("renders no placeholder or empty result area before the first run", () => {
    const { container } = render(
      <AnalyzerResultCard
        charConfigs={configs}
        isComputing={false}
        result={null}
        progress={null}
        error={null}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
  it("shows next-pull branches from the same result without a separate run and preserves a capped prefix", async () => {
    const user = userEvent.setup();
    render(
      <AnalyzerResultCard
        charConfigs={configs}
        isComputing={false}
        result={result()}
        progress={null}
        error={null}
      />
    );
    expect(screen.getByText("path chart")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Next pulls" }));
    expect(screen.getByText(/\+25.0%/)).toBeInTheDocument();
    expect(
      screen.getByText("1 of 3 further copies available in this branch")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /run/i })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Full investment path" }));
    expect(screen.getByText("path table")).toBeInTheDocument();
  });
});
