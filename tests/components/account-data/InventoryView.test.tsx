import { InventoryView } from "@/components/account-data/InventoryView";
import type { AccountData } from "@/data/types";
import { render, screen } from "../../utils/render";

const mockData: AccountData = {
  characters: [],
  extraWeapons: [
    { id: "w1", key: "staff_of_homa", level: 90, refinement: 1, lock: false },
    { id: "w2", key: "amos_bow", level: 80, refinement: 2, lock: false },
  ],
  extraArtifacts: [
    {
      id: "a1",
      setKey: "emblem_of_severed_fate",
      slotKey: "flower",
      level: 20,
      rarity: 5,
      lock: false,
      mainStatKey: "hp",
      substats: {},
    },
  ],
};

describe("InventoryView", () => {
  it("renders unequipped weapons section", () => {
    render(<InventoryView data={mockData} />);

    // Should have weapons heading with count
    const headings = screen.getAllByRole("heading");
    expect(headings.length).toBeGreaterThan(0);
  });

  it("renders weapon cards with refinement", () => {
    render(<InventoryView data={mockData} />);

    // Should show refinement labels
    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText("R2")).toBeInTheDocument();
  });

  it("renders artifact cards with level", () => {
    render(<InventoryView data={mockData} />);

    // Should show artifact level
    expect(screen.getByText("+20")).toBeInTheDocument();
  });

  it("handles empty inventory", () => {
    const emptyData: AccountData = {
      characters: [],
      extraWeapons: [],
      extraArtifacts: [],
    };

    render(<InventoryView data={emptyData} />);

    // Should still render section headings with (0) counts
    const zeroCounts = screen.getAllByText(/\(0\)/);
    expect(zeroCounts.length).toBe(2); // Both weapons and artifacts sections
  });
});
