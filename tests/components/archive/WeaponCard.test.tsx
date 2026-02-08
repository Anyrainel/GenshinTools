import { WeaponCard } from "@/components/archive/WeaponCard";
import type { Weapon } from "@/data/types";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

const MOCK_WEAPON: Weapon = {
  id: "staff_of_homa",
  rarity: 5,
  type: "Polearm",
  secondaryStat: "cd",
  baseAtk: 608,
  secondaryStatValue: "66.2%",
  imageUrl: "https://example.com/homa.png",
  imagePath: "/weapon/staff_of_homa.png",
};

beforeEach(() => {
  useOwnershipStore.getState().clearAll();
});

describe("WeaponCard", () => {
  describe("ownership dimming", () => {
    it("renders without opacity when weapon is owned", () => {
      const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

      // The card div should not have opacity-40
      const cardDiv = container.querySelector(".w-\\[200px\\]");
      expect(cardDiv?.className).not.toContain("opacity-40");
    });

    it("renders with opacity-40 when weapon is unowned", () => {
      useOwnershipStore.getState().setOwned("weapon", "staff_of_homa", false);

      const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

      const cardDiv = container.querySelector(".w-\\[200px\\]");
      expect(cardDiv?.className).toContain("opacity-40");
    });
  });

  describe("text alignment", () => {
    it("renders button with text-left class", () => {
      const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

      const button = container.querySelector("button");
      expect(button?.className).toContain("text-left");
    });
  });

  describe("hover effects", () => {
    it("applies scale and brightness hover classes", () => {
      const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

      const cardDiv = container.querySelector(".w-\\[200px\\]");
      expect(cardDiv?.className).toContain("hover:bg-card/80");
      expect(cardDiv?.className).toContain("hover:scale-[1.02]");
    });

    it("does not apply hover ring", () => {
      const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

      const cardDiv = container.querySelector(".w-\\[200px\\]");
      expect(cardDiv?.className).not.toContain("hover:ring");
    });
  });

  describe("drawer interaction", () => {
    it("opens drawer when card is clicked", async () => {
      const user = userEvent.setup();
      render(<WeaponCard weapon={MOCK_WEAPON} />);

      const button = screen.getAllByRole("button")[0];
      await user.click(button);

      // Drawer should render the weapon name as heading (sr-only)
      expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    });
  });

  describe("drawer content", () => {
    it("centers content with max-w-lg", async () => {
      const user = userEvent.setup();
      render(<WeaponCard weapon={MOCK_WEAPON} />);

      const button = screen.getAllByRole("button")[0];
      await user.click(button);

      const drawerContent = document.querySelector(".max-w-lg");
      expect(drawerContent).toBeInTheDocument();
      expect(drawerContent?.className).toContain("mx-auto");
    });

    it("shows stat pills in drawer", async () => {
      const user = userEvent.setup();
      render(<WeaponCard weapon={MOCK_WEAPON} />);

      const button = screen.getAllByRole("button")[0];
      await user.click(button);

      // Should show base ATK value
      expect(screen.getByText("608")).toBeInTheDocument();
    });
  });
});
