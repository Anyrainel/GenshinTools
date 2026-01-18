import { ArtifactCard } from "@/components/artifact-filter/ArtifactCard";
import type { ArtifactSetConfigs } from "@/data/types";
import { render, screen } from "../../utils/render";

const mockFilter: ArtifactSetConfigs = {
  setId: "emblem_of_severed_fate",
  configurations: [
    {
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
      ],
    },
  ],
};

describe("ArtifactCard", () => {
  const mockOnJumpToCharacter = vi.fn();

  beforeEach(() => {
    mockOnJumpToCharacter.mockClear();
  });

  it("renders artifact name in title", () => {
    render(
      <ArtifactCard
        setId="emblem_of_severed_fate"
        setImagePath="artifacts/emblem_of_severed_fate/flower.png"
        filter={mockFilter}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // Should have at least one heading (artifact title)
    const headings = screen.getAllByRole("heading");
    expect(headings.length).toBeGreaterThan(0);
  });

  it("renders artifact icon", () => {
    const { container } = render(
      <ArtifactCard
        setId="emblem_of_severed_fate"
        setImagePath="artifacts/emblem_of_severed_fate/flower.png"
        filter={mockFilter}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
  });

  it("renders 2pc and 4pc effect markers", () => {
    render(
      <ArtifactCard
        setId="emblem_of_severed_fate"
        setImagePath="artifacts/emblem_of_severed_fate/flower.png"
        filter={mockFilter}
        onJumpToCharacter={mockOnJumpToCharacter}
      />
    );

    // Should show 2pc and 4pc markers
    expect(screen.getAllByText("[2]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[4]").length).toBeGreaterThan(0);
  });
});
