import { WeaponCard } from "@/components/archive/WeaponCard";
import type { WeaponResource } from "@/data/types";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

const MOCK_WEAPON: WeaponResource = {
  id: "staff_of_homa",
  rarity: 5,
  imagePath: "/weapon/staff_of_homa.png",
};

beforeEach(() => {
  useOwnershipStore.getState().clearAll();
});

describe("WeaponCard", () => {
  it("renders without opacity when weapon is owned", () => {
    const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

    const cardDiv = container.querySelector("button > div");
    expect(cardDiv?.className).not.toContain("opacity-40");
  });

  it("renders with opacity-40 when weapon is unowned", () => {
    useOwnershipStore.getState().setOwned("weapon", "staff_of_homa", false);

    const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

    const cardDiv = container.querySelector("button > div");
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
