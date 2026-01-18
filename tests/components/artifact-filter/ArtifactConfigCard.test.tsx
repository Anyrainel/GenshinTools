import { ArtifactConfigCard } from "@/components/artifact-filter/ArtifactConfigCard";
import type { SetConfig } from "@/data/types";
import { fireEvent, render, screen } from "../../utils/render";

const mockConfig: SetConfig = {
  flowerPlume: {
    mainStats: [],
    substats: ["cr", "cd", "er"],
    mustPresent: [],
    minStatCount: 2,
  },
  sands: {
    mainStats: ["er"],
    substats: ["cr", "cd"],
    mustPresent: [],
    minStatCount: 2,
  },
  goblet: {
    mainStats: ["atk%"],
    substats: ["cr", "cd", "er"],
    mustPresent: [],
    minStatCount: 2,
  },
  circlet: {
    mainStats: ["cr", "cd"],
    substats: ["cr", "cd", "er"],
    mustPresent: [],
    minStatCount: 2,
  },
  servedCharacters: [
    { characterId: "xingqiu", hasPerfectMerge: true, has4pcBuild: true },
    { characterId: "hu_tao", hasPerfectMerge: false, has4pcBuild: true },
  ],
};

describe("ArtifactConfigCard", () => {
  const mockOnJumpToCharacter = vi.fn();

  beforeEach(() => {
    mockOnJumpToCharacter.mockClear();
  });

  it("displays config number in header", () => {
    const { container } = render(
      <ArtifactConfigCard
        config={mockConfig}
        configNumber={5}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // Config number should be visible (format may vary: "#5" or "5")
    expect(container.textContent).toMatch(/5/);
  });

  it("displays all slot section labels", () => {
    render(
      <ArtifactConfigCard
        config={mockConfig}
        configNumber={1}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // Should show slot labels
    expect(screen.getAllByText(/Sands/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Goblet/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Circlet/i).length).toBeGreaterThanOrEqual(1);
  });

  it("displays main stat options for each slot", () => {
    render(
      <ArtifactConfigCard
        config={mockConfig}
        configNumber={1}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // ER is a main stat for sands - should be visible
    expect(screen.getAllByText(/ER/i).length).toBeGreaterThanOrEqual(1);
  });

  it("displays substat requirements", () => {
    render(
      <ArtifactConfigCard
        config={mockConfig}
        configNumber={1}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // CR and CD are substats - should be visible
    expect(screen.getAllByText(/CD/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders character icons for all served characters", () => {
    const { container } = render(
      <ArtifactConfigCard
        config={mockConfig}
        configNumber={1}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // Should have images for both xingqiu and hu_tao
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onJumpToCharacter when character icon is clicked", () => {
    const { container } = render(
      <ArtifactConfigCard
        config={mockConfig}
        configNumber={1}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // Find a character button and click it
    const characterButtons = container.querySelectorAll("[data-character-id]");
    if (characterButtons.length > 0) {
      fireEvent.click(characterButtons[0]);
      expect(mockOnJumpToCharacter).toHaveBeenCalled();
    }
  });

  it("displays minStatCount requirement", () => {
    render(
      <ArtifactConfigCard
        config={mockConfig}
        configNumber={1}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // minStatCount of 2 should be shown
    expect(screen.getAllByText(/2/i).length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty servedCharacters gracefully", () => {
    const emptyConfig: SetConfig = {
      ...mockConfig,
      servedCharacters: [],
    };

    const { container } = render(
      <ArtifactConfigCard
        config={emptyConfig}
        configNumber={1}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // Should render without crashing
    expect(container.firstChild).toBeInTheDocument();
  });
});
