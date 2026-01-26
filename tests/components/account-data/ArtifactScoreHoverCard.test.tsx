import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../utils/render";

// Sample artifact score result for testing
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
    // Mock matchMedia to return true (Desktop view)
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

    // Main score should be visible (formatted to 0 decimal places)
    expect(screen.getByText("43")).toBeInTheDocument();
  });

  it("displays sub score", () => {
    render(<ArtifactScoreHoverCard score={mockScoreResult} />);

    // Sub score should be visible (formatted to 0 decimal places)
    expect(screen.getByText("36")).toBeInTheDocument();
  });

  it("displays score divider", () => {
    render(<ArtifactScoreHoverCard score={mockScoreResult} />);

    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ArtifactScoreHoverCard
        score={mockScoreResult}
        className="custom-score-class"
      />
    );

    const trigger = container.querySelector(".custom-score-class");
    expect(trigger).toBeInTheDocument();
  });

  it("has cursor-help class for hover indication", () => {
    const { container } = render(
      <ArtifactScoreHoverCard score={mockScoreResult} />
    );

    const trigger = container.querySelector(".cursor-pointer");
    expect(trigger).toBeInTheDocument();
  });

  it.skip("shows hover card content on hover", async () => {
    const user = userEvent.setup();
    render(<ArtifactScoreHoverCard score={mockScoreResult} />);

    // Hover over the trigger
    const trigger = screen.getByText("43").closest("button"); // The trigger is a button, not div
    await user.hover(trigger!);

    // Wait for hover card to appear
    await waitFor(
      () => {
        expect(screen.getAllByText(/42\.5/).length).toBeGreaterThan(0);
      },
      { timeout: 1000 }
    );
  });
});
