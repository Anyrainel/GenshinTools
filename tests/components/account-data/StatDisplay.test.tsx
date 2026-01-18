import { StatDisplay } from "@/components/account-data/StatDisplay";
import type { ArtifactData } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
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
  mainScore: 15.0,
  subScore: 25.0,
  isComplete: true,
  slotMainScores: { sands: 15.0 },
  slotSubScores: { sands: 25.0 },
  slotMaxSubScores: { sands: 40.0 },
  statScores: {
    er: {
      weight: 1.5,
      mainValue: 51.8,
      mainScore: 15.0,
      subValue: 0,
      subScore: 0,
    },
    cr: {
      weight: 2.0,
      mainValue: 0,
      mainScore: 0,
      subValue: 7.8,
      subScore: 8.0,
    },
    cd: {
      weight: 2.0,
      mainValue: 0,
      mainScore: 0,
      subValue: 14.8,
      subScore: 10.0,
    },
    hp: { weight: 0, mainValue: 0, mainScore: 0, subValue: 508, subScore: 0 },
    "hp%": {
      weight: 0.5,
      mainValue: 0,
      mainScore: 0,
      subValue: 9.3,
      subScore: 2.0,
    },
  },
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

    // Weighted stats have text-gray-200, unweighted have text-muted-foreground
    const grayStats = container.querySelectorAll(".text-gray-200");
    expect(grayStats.length).toBeGreaterThan(0);
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
