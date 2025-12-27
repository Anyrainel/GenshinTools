import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WeaponTooltip } from "./WeaponTooltip";

// Mock data
vi.mock("@/data/constants", () => ({
  weaponsById: {
    wolfs_gravestone: {
      id: "wolfs_gravestone",
      rarity: 5,
      type: "Claymore",
      baseAtk: 608,
      secondaryStat: "atk_percentage",
      secondaryStatValue: "49.6%",
    },
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      weaponName: (id: string) => `Name: ${id}`,
      weaponEffect: (id: string) => `Effect: ${id}`,
      weaponType: (id: string) => id,
      stat: (id: string) => `Stat: ${id}`,
    },
  }),
}));

describe("WeaponTooltip", () => {
  it("renders weapon details", () => {
    render(<WeaponTooltip weaponId="wolfs_gravestone" />);

    expect(screen.getByText("Name: wolfs_gravestone")).toBeInTheDocument();
    expect(screen.getByText("Effect: wolfs_gravestone")).toBeInTheDocument();
    expect(screen.getByText("Claymore")).toBeInTheDocument();
    expect(screen.getByText("608")).toBeInTheDocument();
    expect(screen.getByText("Stat: atk_percentage:")).toBeInTheDocument();
    expect(screen.getByText("49.6%")).toBeInTheDocument();
  });

  it("returns null for unknown weapon", () => {
    const { container } = render(<WeaponTooltip weaponId="unknown" />);
    expect(container.firstChild).toBeNull();
  });
});
