import { TierItem, type TierItemData } from "@/components/tier-list/TierItem";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { fireEvent, render, screen } from "../../utils/render";

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
};

describe("TierItem", () => {
  const mockOnDoubleClick = vi.fn();
  const mockGetItemData = vi.fn().mockReturnValue({ element: "Pyro" });

  beforeEach(() => {
    mockOnDoubleClick.mockClear();
    mockGetItemData.mockClear();
  });

  it("renders with correct data-item-id attribute", () => {
    const { container } = render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem
          item={mockItem}
          id="hu_tao"
          tier="S"
          getItemData={mockGetItemData}
          imagePath="/character/hu_tao.png"
          alt="Hu Tao"
        />
      </DndWrapper>
    );

    const itemElement = container.querySelector('[data-item-id="hu_tao"]');
    expect(itemElement).toBeInTheDocument();
  });

  it("calls onDoubleClick with item id when double-clicked", () => {
    const { container } = render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem
          item={mockItem}
          id="hu_tao"
          tier="S"
          onDoubleClick={mockOnDoubleClick}
          getItemData={mockGetItemData}
          imagePath="/character/hu_tao.png"
          alt="Hu Tao"
        />
      </DndWrapper>
    );

    const itemElement = container.querySelector('[data-item-id="hu_tao"]');
    expect(itemElement).toBeInTheDocument();

    fireEvent.doubleClick(itemElement!);

    expect(mockOnDoubleClick).toHaveBeenCalledTimes(1);
    expect(mockOnDoubleClick).toHaveBeenCalledWith("hu_tao");
  });

  it("applies disabled styling when disabled prop is true", () => {
    const { container } = render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem
          item={mockItem}
          id="hu_tao"
          tier="S"
          disabled={true}
          getItemData={mockGetItemData}
          imagePath="/character/hu_tao.png"
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
        <TierItem
          item={mockItem}
          id="hu_tao"
          tier="S"
          getItemData={mockGetItemData}
          imagePath="/character/hu_tao.png"
          alt="Hu Tao"
        />
      </DndWrapper>
    );

    // ItemIcon should render an image
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "Hu Tao");
  });

  it("renders overlay content when provided", () => {
    render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem
          item={mockItem}
          id="hu_tao"
          tier="S"
          getItemData={mockGetItemData}
          imagePath="/character/hu_tao.png"
          alt="Hu Tao"
          overlay={<span data-testid="overlay-content">C6</span>}
        />
      </DndWrapper>
    );

    expect(screen.getByTestId("overlay-content")).toBeInTheDocument();
    expect(screen.getByText("C6")).toBeInTheDocument();
  });

  it("calls getItemData with item to get data attributes", () => {
    render(
      <DndWrapper items={["hu_tao"]}>
        <TierItem
          item={mockItem}
          id="hu_tao"
          tier="S"
          getItemData={mockGetItemData}
          imagePath="/character/hu_tao.png"
          alt="Hu Tao"
        />
      </DndWrapper>
    );

    expect(mockGetItemData).toHaveBeenCalledWith(mockItem);
  });
});
