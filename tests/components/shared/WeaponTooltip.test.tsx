import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { render, screen } from "../../utils/render";

describe("WeaponTooltip", () => {
  it("renders weapon name for valid weapon", () => {
    render(<WeaponTooltip weaponId="staff_of_homa" />);

    // Should have heading with weapon name
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("renders rarity stars", () => {
    render(<WeaponTooltip weaponId="staff_of_homa" />);

    // Should show 5 stars for 5-star weapon
    expect(screen.getByText("★★★★★")).toBeInTheDocument();
  });

  it("renders weapon type with icon", () => {
    const { container } = render(<WeaponTooltip weaponId="staff_of_homa" />);

    // Should have weapon type img
    const weaponImg = container.querySelector('img[alt="Polearm"]');
    expect(weaponImg).toBeInTheDocument();
  });

  it("renders base ATK", () => {
    render(<WeaponTooltip weaponId="staff_of_homa" />);

    // Should show ATK stat label (may be multiple due to effect also mentioning ATK)
    const atkElements = screen.getAllByText(/ATK/i);
    expect(atkElements.length).toBeGreaterThan(0);
  });

  it("returns null for unknown weapon", () => {
    const { container } = render(<WeaponTooltip weaponId="unknown_weapon" />);

    // Should render nothing
    expect(container.firstChild).toBeNull();
  });
});
