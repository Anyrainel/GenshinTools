import { ArtifactBuildsView } from "@/pages/artifact-builds/ArtifactBuildsView";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { waitFor } from "@testing-library/react";
import { render, screen } from "../../utils/render";

describe("ArtifactBuildsView", () => {
  const mockOnJumpToCharacter = vi.fn();

  beforeEach(() => {
    mockOnJumpToCharacter.mockClear();
    useBuildsStore.getState().clearAll();
  });

  it("shows empty state when no builds configured", async () => {
    render(<ArtifactBuildsView onJumpToCharacter={mockOnJumpToCharacter} />);

    // Wait for async computation to settle
    await waitFor(() => {
      expect(screen.getByText("Artifact Set Filters")).toBeInTheDocument();
    });
  });

  it("computes artifact filters from character builds", async () => {
    // Set up a character with a build that uses an artifact set (4pc)
    useBuildsStore.getState().newBuild("xingqiu");
    const buildId = Object.keys(useBuildsStore.getState().builds)[0];

    // Update the build with artifact set configuration
    useBuildsStore.getState().setBuild(buildId, {
      artifactSet: "emblem_of_severed_fate",
      composition: "4pc",
      visible: true,
    });

    render(<ArtifactBuildsView onJumpToCharacter={mockOnJumpToCharacter} />);

    // When a build is set up with an artifact set, it should compute filters
    // and show the artifact card (not the empty state)
    await waitFor(() => {
      expect(
        screen.queryByText("Artifact Set Filters")
      ).not.toBeInTheDocument();
    });
  });

  it("excludes hidden characters from computation", async () => {
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

    render(<ArtifactBuildsView onJumpToCharacter={mockOnJumpToCharacter} />);

    // Hidden character's build should not generate artifact filters
    // So we should see empty state after computation settles
    await waitFor(() => {
      expect(screen.getByText("Artifact Set Filters")).toBeInTheDocument();
    });
  });

  it("excludes non-visible builds from computation", async () => {
    // Set up a build but mark it as not visible
    useBuildsStore.getState().newBuild("hu_tao");
    const buildId = Object.keys(useBuildsStore.getState().builds)[0];
    useBuildsStore.getState().setBuild(buildId, {
      artifactSet: "crimson_witch_of_flames",
      composition: "4pc",
      visible: false, // Not visible!
    });

    render(<ArtifactBuildsView onJumpToCharacter={mockOnJumpToCharacter} />);

    // Non-visible build should not generate artifact filters
    await waitFor(() => {
      expect(screen.getByText("Artifact Set Filters")).toBeInTheDocument();
    });
  });
});
