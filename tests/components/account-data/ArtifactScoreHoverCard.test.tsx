import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import type { SubStat } from "@/data/types";
import type {
  ArtifactScoreResult,
  BuildMatchResult,
  StatScoreBreakdown,
} from "@/lib/account-data/artifactScore";
import { render, screen } from "../../utils/render";

const baseMockSubstatScore = {
  subScore: 35.8,
  statCount: 12.3,
  isComplete: true,
  slotSubScores: {
    flower: 8.2,
    plume: 7.5,
    sands: 6.3,
    goblet: 7.1,
    circlet: 6.7,
  },
  slotMaxSubScores: {
    flower: 40.0,
    plume: 40.0,
    sands: 35.0,
    goblet: 35.0,
    circlet: 35.0,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statScores: {
    hp: { weight: 0.5, subValue: 1200, subScore: 3.5, subCount: 2.1 },
    "hp%": { weight: 1.5, subValue: 12.5, subScore: 8.0, subCount: 3.0 },
    cr: { weight: 2.0, subValue: 15.2, subScore: 12.0, subCount: 4.2 },
    cd: { weight: 2.0, subValue: 28.4, subScore: 10.0, subCount: 3.0 },
  } as Record<SubStat, StatScoreBreakdown>,
};

const mockScoreWithBuild: ArtifactScoreResult = {
  substatScore: baseMockSubstatScore,
  buildMatch: {
    build: { name: "Test Build" },
    buildIndex: 0,
    statWeights: { cr: 100, cd: 100, "hp%": 50 },
    setMatched: true,
    mainStatMatches: 3,
    mainStatMismatches: [],
  } as unknown as BuildMatchResult,
};

const mockScoreNoBuild: ArtifactScoreResult = {
  substatScore: baseMockSubstatScore,
  buildMatch: null,
};

describe("ArtifactScoreHoverCard", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("displays stat count and sub score in trigger when build exists", () => {
    render(
      <ArtifactScoreHoverCard score={mockScoreWithBuild} characterId="test" />
    );
    // Trigger shows two rows: label + statCount, label + subScore
    expect(screen.getByText("12.3")).toBeInTheDocument();
    expect(screen.getByText("36")).toBeInTheDocument();
  });

  it("displays warning icon instead of scores when no build configured", () => {
    render(
      <ArtifactScoreHoverCard score={mockScoreNoBuild} characterId="test" />
    );
    // Should NOT show the score numbers in the trigger
    expect(screen.queryByText("12.3")).not.toBeInTheDocument();
    expect(screen.queryByText("36")).not.toBeInTheDocument();
  });
});
