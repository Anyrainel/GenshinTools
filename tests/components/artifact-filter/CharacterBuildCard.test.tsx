import { CharacterBuildCard } from "@/components/artifact-filter/CharacterBuildCard";
import type { Character } from "@/data/types";
import { useBuildsStore } from "@/stores/useBuildsStore";
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

describe("CharacterBuildCard", () => {
  beforeEach(() => {
    useBuildsStore.getState().clearAll();
  });

  it("renders character card", () => {
    const { container } = render(
      <CharacterBuildCard character={mockCharacter} />
    );

    // Should have an img for the character
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
  });

  it("shows add first build button when no builds", () => {
    render(<CharacterBuildCard character={mockCharacter} />);

    // Should have an add build button
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows add build button when builds exist", () => {
    // Add a build first
    useBuildsStore.getState().newBuild("hu_tao");

    render(<CharacterBuildCard character={mockCharacter} />);

    // Should have add build button at the bottom
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
