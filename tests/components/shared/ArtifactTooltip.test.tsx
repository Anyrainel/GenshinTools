import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { render, screen } from "../../utils/render";

describe("ArtifactTooltip", () => {
  it("renders artifact name for valid set", () => {
    render(<ArtifactTooltip setId="emblem_of_severed_fate" />);

    // Should have heading with artifact name
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("renders rarity stars", () => {
    render(<ArtifactTooltip setId="emblem_of_severed_fate" />);

    // Should show 5 stars for 5-star artifact
    expect(screen.getByText("★★★★★")).toBeInTheDocument();
  });

  it("renders 2-piece effect", () => {
    render(<ArtifactTooltip setId="emblem_of_severed_fate" />);

    // Should show [2] prefix for 2-piece effect
    expect(screen.getByText("[2]")).toBeInTheDocument();
  });

  it("renders 4-piece effect by default", () => {
    render(<ArtifactTooltip setId="emblem_of_severed_fate" />);

    // Should show [4] prefix for 4-piece effect
    expect(screen.getByText("[4]")).toBeInTheDocument();
  });

  it("hides 4-piece effect when hideFourPieceEffect is true", () => {
    render(
      <ArtifactTooltip
        setId="emblem_of_severed_fate"
        hideFourPieceEffect={true}
      />
    );

    // Should not show [4] prefix
    expect(screen.queryByText("[4]")).not.toBeInTheDocument();
  });

  it("returns null for unknown artifact", () => {
    const { container } = render(<ArtifactTooltip setId="unknown_artifact" />);

    // Should render nothing
    expect(container.firstChild).toBeNull();
  });
});
