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
  it("renders without opacity when weapon is owned", () => {
    const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

    const cardDiv = container.querySelector(".w-\\[200px\\]");
    expect(cardDiv?.className).not.toContain("opacity-40");
  });

  it("renders with opacity-40 when weapon is unowned", () => {
    useOwnershipStore.getState().setOwned("weapon", "staff_of_homa", false);

    const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

    const cardDiv = container.querySelector(".w-\\[200px\\]");
    expect(cardDiv?.className).toContain("opacity-40");
  });

  it("opens drawer when card is clicked", async () => {
    const user = userEvent.setup();
    render(<WeaponCard weapon={MOCK_WEAPON} />);

    const button = screen.getAllByRole("button")[0];
    await user.click(button);

    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("shows stat pills in drawer", async () => {
    const user = userEvent.setup();
    render(<WeaponCard weapon={MOCK_WEAPON} />);

    const button = screen.getAllByRole("button")[0];
    await user.click(button);

    expect(screen.getByText("608")).toBeInTheDocument();
  });
});
