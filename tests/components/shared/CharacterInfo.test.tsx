import { CharacterInfo } from "@/components/shared/CharacterInfo";
import type { Character } from "@/data/types";
import { render, screen } from "../../utils/render";

const mockCharacter: Character = {
  id: "hu_tao",
  element: "Pyro",
  rarity: 5,
  weaponType: "Polearm",
  region: "Liyue",
  releaseDate: "2021-03-02",
  imageUrl: "",
  imagePath: "characters/hu_tao.png",
};

describe("CharacterInfo", () => {
  it("renders character name", () => {
    render(<CharacterInfo character={mockCharacter} />);

    // Character name should be displayed (translated)
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("renders element badge with icon", () => {
    const { container } = render(<CharacterInfo character={mockCharacter} />);

    // Should have an element icon
    const elementImg = container.querySelector('img[alt="Pyro"]');
    expect(elementImg).toBeInTheDocument();
  });

  it("renders rarity stars", () => {
    render(<CharacterInfo character={mockCharacter} />);

    // Should show 5-star rating
    expect(screen.getByText(/★ 5/)).toBeInTheDocument();
  });

  it("renders weapon type badge with icon", () => {
    const { container } = render(<CharacterInfo character={mockCharacter} />);

    // Should have a weapon icon
    const weaponImg = container.querySelector('img[alt="Polearm"]');
    expect(weaponImg).toBeInTheDocument();
  });

  it("shows date when showDate is true", () => {
    render(<CharacterInfo character={mockCharacter} showDate={true} />);

    // Should have date text (format depends on locale)
    expect(screen.getByText(/2021/)).toBeInTheDocument();
  });

  it("hides date when showDate is false", () => {
    render(<CharacterInfo character={mockCharacter} showDate={false} />);

    // Should not have the date span
    expect(screen.queryByText(/2021/)).not.toBeInTheDocument();
  });

  it("applies custom nameClassName", () => {
    render(
      <CharacterInfo
        character={mockCharacter}
        nameClassName="custom-name-class"
      />
    );

    const heading = screen.getByRole("heading");
    expect(heading).toHaveClass("custom-name-class");
  });

  it("renders children", () => {
    render(
      <CharacterInfo character={mockCharacter}>
        <span data-testid="child-content">Child Content</span>
      </CharacterInfo>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });
});
