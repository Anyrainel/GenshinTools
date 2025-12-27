import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CharacterTooltip } from "./CharacterTooltip";

// Mock data
vi.mock("@/data/constants", () => ({
  charactersById: {
    diluc: {
      id: "diluc",
      rarity: 5,
      element: "Pyro",
      weaponType: "Sword",
      region: "Mondstadt",
      releaseDate: "2020-09-28",
      imagePath: "characters/diluc.png",
    },
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      character: (id: string) => `Name: ${id}`,
      element: (id: string) => id,
      weaponType: (id: string) => id,
      region: (id: string) => id,
    },
  }),
}));

describe("CharacterTooltip", () => {
  it("renders character details", () => {
    render(<CharacterTooltip characterId="diluc" />);

    expect(screen.getByText("Name: diluc")).toBeInTheDocument();
    expect(screen.getByText("Pyro")).toBeInTheDocument();
    expect(screen.getByText("Sword")).toBeInTheDocument();
    expect(screen.getByText("Mondstadt")).toBeInTheDocument();
  });

  it("returns null for unknown character", () => {
    const { container } = render(<CharacterTooltip characterId="unknown" />);
    expect(container.firstChild).toBeNull();
  });
});
