import { TitleCard } from "@/components/artifact-filter/TitleCard";
import type { Character } from "@/data/types";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { render, screen } from "../../utils/render";

// Mock character data following snake_case ID pattern
const mockCharacter: Character = {
  id: "hu_tao",
  element: "Pyro",
  rarity: 5,
  weaponType: "Polearm",
  region: "Liyue",
  releaseDate: "2021-03-02",
  imageUrl: "https://example.com/hu_tao.png",
  imagePath: "characters/hu_tao.png",
};

describe("TitleCard", () => {
  beforeEach(() => {
    // Reset store state
    useBuildsStore.getState().clearAll();
  });

  it("renders character icon", () => {
    const { container } = render(<TitleCard character={mockCharacter} />);

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute("src")).toContain("hu_tao");
  });

  it("renders toggle visibility button", () => {
    render(<TitleCard character={mockCharacter} />);

    // Should have a toggle button with aria-label
    const toggleButton = screen.getByRole("button");
    expect(toggleButton).toBeInTheDocument();
  });

  it("shows hidden notice when character is hidden", () => {
    // Hide the character first
    useBuildsStore.getState().toggleCharacterHidden("hu_tao");

    render(<TitleCard character={mockCharacter} />);

    // Should show hidden notice
    expect(screen.getByText(/hidden/i)).toBeInTheDocument();
  });
});
