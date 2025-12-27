import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CharacterFilterSidebar } from "./CharacterFilterSidebar";
import { CharacterFilters } from "@/data/types";

// Mock LanguageContext
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
      element: (key: string) => key,
      weaponType: (key: string) => key,
      region: (key: string) => key,
    },
  }),
}));

// Mock constants
vi.mock("@/data/constants", () => ({
  elementResourcesByName: {
    Pyro: { imagePath: "elements/pyro.png" },
    Hydro: { imagePath: "elements/hydro.png" },
    Anemo: { imagePath: "elements/anemo.png" },
    Electro: { imagePath: "elements/electro.png" },
    Dendro: { imagePath: "elements/dendro.png" },
    Cryo: { imagePath: "elements/cryo.png" },
    Geo: { imagePath: "elements/geo.png" },
  },
  weaponResourcesByName: {
    Sword: { imagePath: "weapons/sword.png" },
    Claymore: { imagePath: "weapons/claymore.png" },
    Polearm: { imagePath: "weapons/polearm.png" },
    Bow: { imagePath: "weapons/bow.png" },
    Catalyst: { imagePath: "weapons/catalyst.png" },
  },
}));

const mockFilters: CharacterFilters = {
  elements: [],
  weaponTypes: [],
  rarities: [],
  regions: [],
  sortOrder: "desc",
};

describe("CharacterFilterSidebar", () => {
  it("renders filter sections", () => {
    render(
      <CharacterFilterSidebar
        filters={mockFilters}
        onFiltersChange={() => {}}
      />
    );

    expect(screen.getByText("filters.sort")).toBeInTheDocument();
    expect(screen.getByText("filters.elements")).toBeInTheDocument();
    expect(screen.getByText("filters.rarity")).toBeInTheDocument();
    expect(screen.getByText("filters.weaponTypes")).toBeInTheDocument();
    expect(screen.getByText("filters.regions")).toBeInTheDocument();
  });

  it("toggles sort order", () => {
    const handleChange = vi.fn();
    render(
      <CharacterFilterSidebar
        filters={mockFilters}
        onFiltersChange={handleChange}
      />
    );

    const sortButton = screen.getByRole("button", { name: /filters.sortByReleaseDate/i });
    fireEvent.click(sortButton);

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
      sortOrder: "asc",
    }));
  });

  it("selects filters", () => {
    const handleChange = vi.fn();
    render(
      <CharacterFilterSidebar
        filters={mockFilters}
        onFiltersChange={handleChange}
      />
    );

    // Find the label for Pyro
    const pyroLabel = screen.getByText("Pyro");

    // Click it to toggle the checkbox associated with it
    fireEvent.click(pyroLabel);

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
      elements: ["Pyro"],
    }));
  });
});
