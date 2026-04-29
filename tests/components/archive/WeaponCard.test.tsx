import userEvent from "@testing-library/user-event";
import { WeaponCard } from "@/components/archive/WeaponCard";
import type { WeaponResource } from "@/data/types";
import { useAccountStore } from "@/stores/useAccountStore";
import { render, screen } from "../../utils/render";

const MOCK_WEAPON: WeaponResource = {
  id: "staff_of_homa",
  rarity: 5,
  imagePath: "/weapon/staff_of_homa.png",
};

const TEST_PROFILE = 1;

function setAccountWithWeapon(weaponKey?: string) {
  useAccountStore.setState({
    activeAccountId: TEST_PROFILE,
    accounts: {
      [TEST_PROFILE]: {
        id: TEST_PROFILE,
        name: "Test",
        data: {
          characters: weaponKey
            ? [
                {
                  key: "hu_tao",
                  constellation: 0,
                  level: 90,
                  talent: { auto: 1, skill: 1, burst: 1 },
                  weapon: {
                    id: "w1",
                    key: weaponKey,
                    level: 90,
                    refinement: 1,
                    lock: false,
                  },
                  artifacts: {},
                },
              ]
            : [],
          extraArtifacts: [],
          extraWeapons: [],
        },
        lastUpdate: Date.now(),
      },
    },
  });
}

beforeEach(() => {
  useAccountStore.setState({ activeAccountId: TEST_PROFILE, accounts: {} });
});

describe("WeaponCard", () => {
  it("renders without opacity when weapon is owned", () => {
    setAccountWithWeapon("staff_of_homa");
    const { container } = render(<WeaponCard weapon={MOCK_WEAPON} />);

    const cardDiv = container.querySelector("button > div");
    expect(cardDiv?.className).not.toContain("opacity-40");
  });

  it("renders with opacity-40 when weapon is unowned", () => {
    setAccountWithWeapon(); // no weapon in account data
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
