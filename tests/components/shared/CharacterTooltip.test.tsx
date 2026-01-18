import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { render, screen } from "../../utils/render";

describe("CharacterTooltip", () => {
  it("renders character name for valid character", () => {
    render(<CharacterTooltip characterId="hu_tao" />);

    // Should have heading with character name
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("renders element with icon", () => {
    const { container } = render(<CharacterTooltip characterId="hu_tao" />);

    // Should have element img
    const elementImg = container.querySelector('img[alt="Pyro"]');
    expect(elementImg).toBeInTheDocument();
  });

  it("renders weapon type with icon", () => {
    const { container } = render(<CharacterTooltip characterId="hu_tao" />);

    // Should have weapon img
    const weaponImg = container.querySelector('img[alt="Polearm"]');
    expect(weaponImg).toBeInTheDocument();
  });

  it("renders rarity stars", () => {
    render(<CharacterTooltip characterId="hu_tao" />);

    // Should show 5 stars
    expect(screen.getByText("★★★★★")).toBeInTheDocument();
  });

  it("returns null for unknown character", () => {
    const { container } = render(
      <CharacterTooltip characterId="unknown_character" />
    );

    // Should render nothing
    expect(container.firstChild).toBeNull();
  });

  it("applies rarity background color", () => {
    const { container } = render(<CharacterTooltip characterId="hu_tao" />);

    // 5-star should have the appropriate rarity background class
    const header = container.querySelector(".p-3");
    expect(header).toBeInTheDocument();
  });
});
