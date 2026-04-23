import { act } from "react";
import { CharacterBuildCard } from "@/components/artifact-builds/CharacterBuildCard";
import type { CharacterResource } from "@/data/types";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { render, screen } from "../../utils/render";

const mockCharacter: CharacterResource = {
  id: "hu_tao",
  rarity: 5,
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

    // Should have an add build button ("Add First Build")
    expect(screen.getByText(/Add First Build/i)).toBeInTheDocument();

    // Should NOT have restore button
    expect(screen.queryByText(/Restore/i)).not.toBeInTheDocument();
  });

  it("shows add build button and restore button when builds exist", () => {
    // Add a build first
    useBuildsStore.getState().newBuild("hu_tao");

    render(<CharacterBuildCard character={mockCharacter} />);

    // Should have add build button ("Add Build" - simpler text when builds exist)
    expect(screen.getByText(/Add Build/i)).toBeInTheDocument();

    // Should HAVE restore button because local builds represent customization
    const restoreButtons = screen.getAllByText(/Restore/i);
    // Usually one button, or button + dialog trigger?
    // The button has text "Restore".
    expect(restoreButtons.length).toBeGreaterThan(0);
  });

  it("does not show restore button if only hidden (even if unhidden for test)", async () => {
    // Scenario: Character is hidden, then unhidden. Should not trigger restore button if no builds.

    // Hide character
    useBuildsStore.getState().toggleCharacterHidden("hu_tao");

    // Render
    const { rerender } = render(
      <CharacterBuildCard character={mockCharacter} />
    );

    // It is hidden, so NO buttons visible (CardContent is hidden)
    expect(screen.queryByText(/Restore/i)).not.toBeInTheDocument();

    // Now unhide via store (simulate user clicking eye icon, effectively).
    // Wrap in act() because the store update triggers a React re-render.
    act(() => {
      useBuildsStore.getState().toggleCharacterHidden("hu_tao");
    });

    // Re-render to see update
    rerender(<CharacterBuildCard character={mockCharacter} />);

    // Now visible. Should NOT have restore button because NO builds.
    expect(screen.queryByText(/Restore/i)).not.toBeInTheDocument();
  });
});
