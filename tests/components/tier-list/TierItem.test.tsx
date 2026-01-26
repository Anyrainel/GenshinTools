import { TierItem } from "@/components/tier-list/TierItem";
import type { TierItemData } from "@/components/tier-list/tierTableTypes";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { render } from "../../utils/render";

// Wrapper to provide dnd-kit context
function DndWrapper({
  children,
  items,
}: {
  children: React.ReactNode;
  items: string[];
}) {
  return (
    <DndContext>
      <SortableContext items={items}>{children}</SortableContext>
    </DndContext>
  );
}

const mockItem: TierItemData = {
  id: "hu_tao",
  rarity: 5,
  imagePath: "/character/hu_tao.png",
};

describe("TierItem", () => {
  it("renders with correct data-item-id attribute", () => {
    const { container } = render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem item={mockItem} tier="S" groupValue="Pyro" alt="Hu Tao" />
      </DndWrapper>
    );

    const itemElement = container.querySelector('[data-item-id="hu_tao"]');
    expect(itemElement).toBeInTheDocument();
  });

  it("applies disabled styling when disabled prop is true", () => {
    const { container } = render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem
          item={mockItem}
          tier="S"
          groupValue="Pyro"
          disabled={true}
          alt="Hu Tao"
        />
      </DndWrapper>
    );

    const itemElement = container.querySelector('[data-item-id="hu_tao"]');
    expect(itemElement).toHaveClass("opacity-50");
    expect(itemElement).toHaveClass("cursor-not-allowed");
  });

  it("renders ItemIcon with correct rarity", () => {
    const { container } = render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem item={mockItem} tier="S" groupValue="Pyro" alt="Hu Tao" />
      </DndWrapper>
    );

    // ItemIcon should render an image
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", mockItem.imagePath);
  });

  it("renders overlay image when provided", () => {
    const { container } = render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem
          item={mockItem}
          tier="S"
          groupValue="Pyro"
          alt="Hu Tao"
          overlayImage="/weapon/sword.png"
        />
      </DndWrapper>
    );

    // Should have 2 images: main item + overlay
    const images = container.querySelectorAll("img");
    expect(images.length).toBe(2);
  });
});
