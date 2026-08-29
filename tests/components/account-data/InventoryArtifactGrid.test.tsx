import { InventoryArtifactGrid } from "@/components/account-data/InventoryArtifactGrid";
import { render } from "../../utils/render";

describe("InventoryArtifactGrid", () => {
  it("does not duplicate equipped status with a green dot", () => {
    const { container } = render(
      <InventoryArtifactGrid
        artifacts={[
          {
            id: "equipped-artifact",
            setKey: "emblem_of_severed_fate",
            slotKey: "flower",
            level: 20,
            rarity: 5,
            mainStatKey: "hp",
            lock: false,
            substats: {},
            equipped: true,
          },
        ]}
        iconSize="xl"
        isEditMode
        onArtifactClick={vi.fn()}
      />
    );

    expect(container.querySelector(".bg-green-400")).not.toBeInTheDocument();
  });
});
