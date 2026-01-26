import { ArtifactFilterView } from "@/components/artifact-filter/ArtifactFilterView";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { render, screen } from "../../utils/render";

describe("ArtifactFilterView", () => {
  const mockOnJumpToCharacter = vi.fn();

  beforeEach(() => {
    mockOnJumpToCharacter.mockClear();
    useBuildsStore.getState().clearAll();
  });

  it("shows empty state when no builds configured", () => {
    render(<ArtifactFilterView onJumpToCharacter={mockOnJumpToCharacter} />);

    // Should show the empty state message (gear emoji and message)
    expect(screen.getByText("⚙️")).toBeInTheDocument();
  });

  it("computes artifact filters from character builds", () => {
    // Set up a character with a build that uses an artifact set (4pc)
    useBuildsStore.getState().newBuild("xingqiu");
    const buildId = Object.keys(useBuildsStore.getState().builds)[0];

    // Update the build with artifact set configuration
    useBuildsStore.getState().setBuild(buildId, {
      artifactSet: "emblem_of_severed_fate",
      composition: "4pc",
      visible: true,
    });

    render(<ArtifactFilterView onJumpToCharacter={mockOnJumpToCharacter} />);

    // When a build is set up with an artifact set, it should compute filters
    // and show the artifact card (not the empty state)
    expect(screen.queryByText("⚙️")).not.toBeInTheDocument();
  });

  it("excludes hidden characters from computation", () => {
    // Set up a build for a character
    useBuildsStore.getState().newBuild("hu_tao");
    const buildId = Object.keys(useBuildsStore.getState().builds)[0];
    useBuildsStore.getState().setBuild(buildId, {
      artifactSet: "crimson_witch_of_flames",
      composition: "4pc",
      visible: true,
    });

    // Hide the character
    useBuildsStore.getState().setCharacterHidden("hu_tao", true);

    render(<ArtifactFilterView onJumpToCharacter={mockOnJumpToCharacter} />);

    // Hidden character's build should not generate artifact filters
    // So we should see empty state
    expect(screen.getByText("⚙️")).toBeInTheDocument();
  });

  it("excludes non-visible builds from computation", () => {
    // Set up a build but mark it as not visible
    useBuildsStore.getState().newBuild("hu_tao");
    const buildId = Object.keys(useBuildsStore.getState().builds)[0];
    useBuildsStore.getState().setBuild(buildId, {
      artifactSet: "crimson_witch_of_flames",
      composition: "4pc",
      visible: false, // Not visible!
    });

    render(<ArtifactFilterView onJumpToCharacter={mockOnJumpToCharacter} />);

    // Non-visible build should not generate artifact filters
    expect(screen.getByText("⚙️")).toBeInTheDocument();
  });
});
