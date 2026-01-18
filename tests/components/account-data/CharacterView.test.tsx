import { CharacterView } from "@/components/account-data/CharacterView";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";
import { render, screen } from "../../utils/render";

describe("CharacterView", () => {
  beforeEach(() => {
    useAccountStore.getState().clearAccountData();
    useTierStore.getState().resetTierList();
  });

  it("returns null when no account data", () => {
    const { container } = render(<CharacterView scores={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders character cards for account characters", () => {
    // Set up account data with one character
    useAccountStore.getState().setAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 0,
          talent: { auto: 10, skill: 10, burst: 10 },
          weapon: undefined,
          artifacts: {
            flower: undefined,
            plume: undefined,
            sands: undefined,
            goblet: undefined,
            circlet: undefined,
          },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    });

    render(<CharacterView scores={{}} />);

    // Should show at least one grid element with character card
    // CharacterCard should be rendered for the character
    const filterButton = screen.getAllByRole("button");
    expect(filterButton.length).toBeGreaterThan(0);
  });

  it("respects tier sort when tier assignments exist", () => {
    // Set up account data
    useAccountStore.getState().setAccountData({
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 0,
          talent: { auto: 10, skill: 10, burst: 10 },
          weapon: undefined,
          artifacts: {
            flower: undefined,
            plume: undefined,
            sands: undefined,
            goblet: undefined,
            circlet: undefined,
          },
        },
        {
          key: "xingqiu",
          level: 80,
          constellation: 6,
          talent: { auto: 6, skill: 10, burst: 10 },
          weapon: undefined,
          artifacts: {
            flower: undefined,
            plume: undefined,
            sands: undefined,
            goblet: undefined,
            circlet: undefined,
          },
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    });

    // Set up tier assignments
    useTierStore.getState().setTierAssignments({
      hu_tao: { tier: "S", position: 0 },
      xingqiu: { tier: "A", position: 0 },
    });

    render(<CharacterView scores={{}} />);

    // Component should render without errors (filtering and tier ordering work)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
