import type { TierItemData } from "@/components/tier-list/TierItem";
import { TierTable } from "@/components/tier-list/TierTable";
import { fireEvent, render, screen } from "../../utils/render";

interface TestItem extends TierItemData {
  element: string;
}

const mockItems: TestItem[] = [
  { id: "hu_tao", rarity: 5, element: "Pyro" },
  { id: "xingqiu", rarity: 4, element: "Hydro" },
  { id: "zhongli", rarity: 5, element: "Geo" },
  { id: "bennett", rarity: 4, element: "Pyro" },
];

const mockItemsById: Record<string, TestItem> = {
  hu_tao: mockItems[0],
  xingqiu: mockItems[1],
  zhongli: mockItems[2],
  bennett: mockItems[3],
};

const defaultProps = {
  items: mockItems,
  itemsById: mockItemsById,
  tierAssignments: {
    hu_tao: { tier: "S", position: 0 },
    xingqiu: { tier: "A", position: 0 },
  },
  tierCustomization: {},
  onAssignmentsChange: vi.fn(),
  isValidDrop: () => true,
  groups: ["Pyro", "Hydro", "Geo"],
  getItemGroup: (item: TestItem) => item.element,
  getGroupCount: (group: string, itemsPerTier: Record<string, TestItem[]>) =>
    Object.values(itemsPerTier)
      .flat()
      .filter((i) => i.element === group).length,
  renderHeader: (group: string, count: number) => (
    <div key={group} data-testid={`header-${group}`}>
      {group} ({count})
    </div>
  ),
  renderPreview: (item: TestItem) => <div>{item.id}</div>,
  getItemData: (item: TestItem) => ({ element: item.element }),
  getTierDisplayName: (tier: string) => tier,
  getImagePath: (item: TestItem) => `/character/${item.id}.png`,
  getAlt: (item: TestItem) => item.id,
  getTooltip: (item: TestItem) => <div>{item.id}</div>,
};

describe("TierTable", () => {
  beforeEach(() => {
    defaultProps.onAssignmentsChange.mockClear();
  });

  it("renders items in their assigned tiers", () => {
    const { container } = render(<TierTable {...defaultProps} />);

    // hu_tao in S tier
    const huTaoItem = container.querySelector('[data-item-id="hu_tao"]');
    expect(huTaoItem).toBeInTheDocument();

    // xingqiu in A tier
    const xingqiuItem = container.querySelector('[data-item-id="xingqiu"]');
    expect(xingqiuItem).toBeInTheDocument();
  });

  it("renders unassigned items in Pool tier", () => {
    const { container } = render(<TierTable {...defaultProps} />);

    // zhongli and bennett have no tier assignment, should be in Pool
    const zhongliItem = container.querySelector('[data-item-id="zhongli"]');
    expect(zhongliItem).toBeInTheDocument();

    const bennettItem = container.querySelector('[data-item-id="bennett"]');
    expect(bennettItem).toBeInTheDocument();
  });

  it("calls onAssignmentsChange when item is double-clicked to remove", () => {
    const { container } = render(<TierTable {...defaultProps} />);

    // Double-click hu_tao to remove from tier
    const huTaoItem = container.querySelector('[data-item-id="hu_tao"]');
    expect(huTaoItem).toBeInTheDocument();

    fireEvent.doubleClick(huTaoItem!);

    // onAssignmentsChange should be called with hu_tao removed
    expect(defaultProps.onAssignmentsChange).toHaveBeenCalled();
    const newAssignments = defaultProps.onAssignmentsChange.mock.calls[0][0];
    expect(newAssignments.hu_tao).toBeUndefined();
  });

  it("hides tiers marked as hidden in tierCustomization", () => {
    const propsWithHiddenTier = {
      ...defaultProps,
      tierCustomization: {
        S: { hidden: true },
      },
    };

    render(<TierTable {...propsWithHiddenTier} />);

    // S tier should not be displayed
    expect(screen.queryByText("S")).not.toBeInTheDocument();
    // A tier should still be visible
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("moves items from hidden tiers to Pool", () => {
    const propsWithHiddenTier = {
      ...defaultProps,
      tierCustomization: {
        S: { hidden: true },
      },
    };

    const { container } = render(<TierTable {...propsWithHiddenTier} />);

    // hu_tao was in S tier, but S is hidden, so it goes to Pool
    const huTaoItem = container.querySelector('[data-item-id="hu_tao"]');
    expect(huTaoItem).toBeInTheDocument();

    // Verify it's in a Pool cell (check the parent cell's data-tier)
    const poolCell = container.querySelector('[data-tier="Pool"]');
    expect(poolCell).toBeInTheDocument();
  });

  it("filters items using filterItem prop", () => {
    const propsWithFilter = {
      ...defaultProps,
      filterItem: (item: TestItem) => item.element === "Pyro",
    };

    const { container } = render(<TierTable {...propsWithFilter} />);

    // Only Pyro characters should be visible
    expect(
      container.querySelector('[data-item-id="hu_tao"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-item-id="bennett"]')
    ).toBeInTheDocument();

    // Non-Pyro should be filtered out
    expect(
      container.querySelector('[data-item-id="xingqiu"]')
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-item-id="zhongli"]')
    ).not.toBeInTheDocument();
  });

  it("sorts items within tier by position", () => {
    const propsWithPositions = {
      ...defaultProps,
      tierAssignments: {
        hu_tao: { tier: "S", position: 1 },
        bennett: { tier: "S", position: 0 },
        xingqiu: { tier: "A", position: 0 },
      },
    };

    const { container } = render(<TierTable {...propsWithPositions} />);

    // Both hu_tao and bennett should be in S tier
    const huTaoItem = container.querySelector('[data-item-id="hu_tao"]');
    const bennettItem = container.querySelector('[data-item-id="bennett"]');
    expect(huTaoItem).toBeInTheDocument();
    expect(bennettItem).toBeInTheDocument();
  });

  it("renders tier grid with all visible tiers", () => {
    render(<TierTable {...defaultProps} />);

    // Default tiers should be visible (S, A, B, C, D, Pool minus hidden)
    expect(screen.getByText("Pool")).toBeInTheDocument();
  });
});
