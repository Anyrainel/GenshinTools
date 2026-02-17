import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import { render, screen } from "../../utils/render";

const mockScoreResult: ArtifactScoreResult = {
  mainScore: 42.5,
  subScore: 35.8,
  isComplete: true,
  slotMainScores: {
    flower: 0,
    plume: 0,
    sands: 15.0,
    goblet: 18.0,
    circlet: 9.5,
  },
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
  statScores: {
    hp: {
      weight: 0.5,
      mainValue: 4780,
      mainScore: 5.0,
      subValue: 1200,
      subScore: 3.5,
    },
    "hp%": {
      weight: 1.5,
      mainValue: 46.6,
      mainScore: 15.0,
      subValue: 12.5,
      subScore: 8.0,
    },
    cr: {
      weight: 2.0,
      mainValue: 0,
      mainScore: 0,
      subValue: 15.2,
      subScore: 12.0,
    },
    cd: {
      weight: 2.0,
      mainValue: 0,
      mainScore: 0,
      subValue: 28.4,
      subScore: 10.0,
    },
  },
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

  it("displays main score", () => {
    render(<ArtifactScoreHoverCard score={mockScoreResult} />);
    expect(screen.getByText("43")).toBeInTheDocument();
  });

  it("displays sub score", () => {
    render(<ArtifactScoreHoverCard score={mockScoreResult} />);
    expect(screen.getByText("36")).toBeInTheDocument();
  });
});
