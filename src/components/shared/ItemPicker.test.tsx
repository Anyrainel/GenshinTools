import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ItemPicker } from "./ItemPicker";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock LanguageContext
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
      character: (id: string) => id,
      weaponName: (id: string) => id,
      artifact: (id: string) => id,
    },
  }),
}));

// Mock constants and data
vi.mock("@/data/constants", () => ({
  charactersById: {
    "char1": { id: "char1", rarity: 5, imagePath: "char1.png" }
  },
  sortedCharacters: [
    { id: "char1", rarity: 5, imagePath: "char1.png" }
  ],
  weaponsById: {
    "wep1": { id: "wep1", rarity: 4, imagePath: "wep1.png" }
  },
  sortedWeapons: [
    { id: "wep1", rarity: 4, imagePath: "wep1.png" }
  ],
  artifactsById: {
    "art1": { id: "art1", rarity: 5, imagePaths: { flower: "flower.png" } }
  },
  sortedArtifacts: [
    { id: "art1", rarity: 5, imagePaths: { flower: "flower.png" } }
  ],
}));

// Mock Tooltips to avoid deep rendering
vi.mock("@/components/shared/CharacterTooltip", () => ({
  CharacterTooltip: () => <div data-testid="char-tooltip">Tooltip</div>
}));
vi.mock("@/components/shared/WeaponTooltip", () => ({
  WeaponTooltip: () => <div data-testid="weapon-tooltip">Tooltip</div>
}));
vi.mock("@/components/shared/ArtifactTooltip", () => ({
  ArtifactTooltip: () => <div data-testid="art-tooltip">Tooltip</div>
}));

describe("ItemPicker", () => {
  it("renders placeholder when no value", () => {
    render(
      <TooltipProvider>
        <ItemPicker type="character" value={null} onChange={() => {}} />
      </TooltipProvider>
    );
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("renders selected character", () => {
    render(
      <TooltipProvider>
        <ItemPicker type="character" value="char1" onChange={() => {}} />
      </TooltipProvider>
    );
    expect(screen.getByRole("img")).toBeInTheDocument(); // ItemIcon renders an img
  });

  it("opens popover on click", async () => {
    render(
      <TooltipProvider>
        <ItemPicker type="character" value={null} onChange={() => {}} />
      </TooltipProvider>
    );

    fireEvent.click(screen.getByText("+"));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("teamBuilder.selectCharacter")).toBeInTheDocument();
  });

  it("filters items by search", async () => {
    render(
      <TooltipProvider>
        <ItemPicker type="character" value={null} onChange={() => {}} />
      </TooltipProvider>
    );
    fireEvent.click(screen.getByText("+"));

    const input = screen.getByPlaceholderText("teamBuilder.selectCharacter");
    fireEvent.change(input, { target: { value: "char1" } });

    // Check if item is displayed. The ItemIcon alt is 'char1'.
    expect(await screen.findByAltText("char1")).toBeInTheDocument();
  });
});
