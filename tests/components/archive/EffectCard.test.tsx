import { EffectCard } from "@/components/archive/EffectCard";
import type { CharacterEffect } from "@/data/types";
import { fireEvent, render, screen } from "../../utils/render";

const mockEffect: CharacterEffect = {
  name: "Crimson Bouquet",
  descHtml:
    "While in a <b>Paramita Papilio</b> state, Hu Tao's Charged Attacks do not consume Stamina.",
};

describe("EffectCard", () => {
  it("renders effect name", () => {
    render(<EffectCard effect={mockEffect} />);
    expect(screen.getByText("Crimson Bouquet")).toBeInTheDocument();
  });

  it("renders description by default (expanded)", () => {
    const { container } = render(<EffectCard effect={mockEffect} />);
    // Description is shown via dangerouslySetInnerHTML
    const descDiv = container.querySelector(".skill-desc");
    expect(descDiv).toBeInTheDocument();
    expect(descDiv?.innerHTML).toContain("Paramita Papilio");
  });

  it("hides description when collapsed", () => {
    const { container } = render(<EffectCard effect={mockEffect} />);

    // Click to collapse
    fireEvent.click(screen.getByText("Crimson Bouquet"));

    const descDiv = container.querySelector(".skill-desc");
    expect(descDiv).not.toBeInTheDocument();
  });

  it("toggles back to expanded on second click", () => {
    const { container } = render(<EffectCard effect={mockEffect} />);

    // Collapse
    fireEvent.click(screen.getByText("Crimson Bouquet"));
    expect(container.querySelector(".skill-desc")).not.toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByText("Crimson Bouquet"));
    expect(container.querySelector(".skill-desc")).toBeInTheDocument();
  });
});
