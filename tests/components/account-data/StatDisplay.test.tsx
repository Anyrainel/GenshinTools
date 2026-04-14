import { StatDisplay } from "@/components/account-data/StatDisplay";
import type { ArtifactData, SubStat } from "@/data/types";
import type {
  ArtifactScoreResult,
  BuildMatchResult,
  NormalizedScoreInfo,
  StatScoreBreakdown,
} from "@/lib/account-data/artifactScore";
import { render, screen } from "../../utils/render";

// Sample artifact for testing
const mockArtifact: ArtifactData = {
  id: "artifact_1",
  setKey: "emblem_of_severed_fate",
  slotKey: "sands",
  rarity: 5,
  level: 20,
  mainStatKey: "er",
  lock: false,
  substats: {
    cr: 7.8,
    cd: 14.8,
    hp: 508,
    "hp%": 9.3,
  },
};

// Sample score result
const mockScoreResult: ArtifactScoreResult = {
  substatScore: {
    subScore: 25.0,
    statCount: 0,
    isComplete: true,
    slotSubScores: { flower: 0, plume: 0, sands: 25.0, goblet: 0, circlet: 0 },
    slotMaxSubScores: {
      flower: 0,
      plume: 0,
      sands: 40.0,
      goblet: 0,
      circlet: 0,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statScores: {
      er: { weight: 1.5, subValue: 0, subScore: 0, subCount: 0 },
      cr: { weight: 2.0, subValue: 7.8, subScore: 8.0, subCount: 0 },
      cd: { weight: 2.0, subValue: 14.8, subScore: 10.0, subCount: 0 },
      hp: { weight: 0, subValue: 508, subScore: 0, subCount: 0 },
      "hp%": { weight: 0.5, subValue: 9.3, subScore: 2.0, subCount: 0 },
    } as Record<SubStat, StatScoreBreakdown>,
  },
  buildMatch: {
    build: { name: "Test" },
    buildIndex: 0,
    statWeights: { cr: 100, cd: 100 },
    setMatched: true,
    mainStatMatches: 3,
    mainStatMismatches: [],
  } as unknown as BuildMatchResult,
  normalized: {
    normalizedScore: 150,
    rawMainStatScore: 30,
    slotMainStatScores: {
      flower: 0,
      plume: 0,
      sands: 0,
      goblet: 0,
      circlet: 0,
    },
    idealScore: 100,
    normalizer: 3,
  } as NormalizedScoreInfo,
};

describe("StatDisplay", () => {
  it("shows main stat name", () => {
    render(<StatDisplay artifact={mockArtifact} />);

    // should display main stat short name (ER)
    expect(screen.getByText(/ER/i)).toBeInTheDocument();
  });

  it("shows artifact level", () => {
    render(<StatDisplay artifact={mockArtifact} />);

    // +20 level indicator
    expect(screen.getByText("+20")).toBeInTheDocument();
  });

  it("shows all substats", () => {
    render(<StatDisplay artifact={mockArtifact} />);

    // Should show all 4 substats
    expect(screen.getByText("7.8%")).toBeInTheDocument(); // CR
    expect(screen.getByText("14.8%")).toBeInTheDocument(); // CD
    expect(screen.getByText("508")).toBeInTheDocument(); // HP flat
  });

  it("highlights weighted substats when scoreResult provided", () => {
    const { container } = render(
      <StatDisplay artifact={mockArtifact} scoreResult={mockScoreResult} />
    );

    // Weighted stats have text-foreground, unweighted have text-gray-400
    const foregroundStats = container.querySelectorAll(".text-foreground");
    expect(foregroundStats.length).toBeGreaterThan(0);
  });

  it("renders progress indicator when score data provided", () => {
    const { container } = render(
      <StatDisplay
        artifact={mockArtifact}
        scoreResult={mockScoreResult}
        slotSubScore={25.0}
        slotMaxSubScore={40.0}
      />
    );

    // Progress bar should render with width style
    const progressBar = container.querySelector("[style*='width']");
    expect(progressBar).toBeInTheDocument();
  });

  it("does not render progress indicator without score data", () => {
    const { container } = render(<StatDisplay artifact={mockArtifact} />);

    // No progress bar without scoreResult
    const progressBar = container.querySelector("[style*='width']");
    expect(progressBar).toBeNull();
  });
});
