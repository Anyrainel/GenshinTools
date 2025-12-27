import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CharacterInfo } from "./CharacterInfo";
import { Character, Element, WeaponType, Region } from "@/data/types";

// Mock constants
vi.mock("@/data/constants", () => ({
  elementResourcesByName: {
    Pyro: { imagePath: "elements/pyro.png" },
  },
  weaponResourcesByName: {
    Sword: { imagePath: "weapons/sword.png" },
  },
}));

// Mock LanguageContext
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      character: (id: string) => `Name: ${id}`,
      element: (id: string) => id,
      weaponType: (id: string) => id,
      region: (id: string) => id,
      formatDate: (date: string) => `Formatted: ${date}`,
    },
  }),
}));

const mockCharacter: Character = {
  id: "diluc",
  rarity: 5,
  element: "Pyro" as Element,
  weaponType: "Sword" as WeaponType,
  region: "Mondstadt" as Region,
  releaseDate: "2020-09-28",
  imagePath: "characters/diluc.png",
  imageUrl: "characters/diluc.png",
};

describe("CharacterInfo", () => {
  it("renders character information", () => {
    render(<CharacterInfo character={mockCharacter} />);

    expect(screen.getByText("Name: diluc")).toBeInTheDocument();
    expect(screen.getByText("Pyro")).toBeInTheDocument();
    expect(screen.getByText("Sword")).toBeInTheDocument();
    expect(screen.getByText("Mondstadt")).toBeInTheDocument();
    expect(screen.getByText("Formatted: 2020-09-28")).toBeInTheDocument();
    expect(screen.getByText("★ 5")).toBeInTheDocument();
  });

  it("does not render date when showDate is false", () => {
    render(<CharacterInfo character={mockCharacter} showDate={false} />);
    expect(screen.queryByText(/Formatted:/)).not.toBeInTheDocument();
  });
});
