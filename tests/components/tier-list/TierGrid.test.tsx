import { TierGrid } from "@/components/tier-list/TierGrid";
import type { TierItemData } from "@/components/tier-list/TierItem";
import { DndContext } from "@dnd-kit/core";
import { render, screen } from "../../utils/render";

// Wrapper to provide dnd-kit context
function DndWrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

interface TestItem extends TierItemData {
  element: string;
}

const mockItems: TestItem[] = [
  { id: "hu_tao", rarity: 5, element: "Pyro" },
  { id: "xingqiu", rarity: 4, element: "Hydro" },
  { id: "zhongli", rarity: 5, element: "Geo" },
];

const defaultProps = {
  allTiers: ["S", "A", "Pool"],
  groups: ["Pyro", "Hydro", "Geo"],
  itemsPerTier: {
    S: [mockItems[0]], // hu_tao in S tier
    A: [mockItems[1]], // xingqiu in A tier
    Pool: [mockItems[2]], // zhongli in Pool
  } as { [tier: string]: TestItem[] },
  tierCustomization: {},
  onRemoveFromTiers: vi.fn(),
  renderHeader: (group: string, count: number) => (
    <div key={group} data-testid={`header-${group}`}>
      {group} ({count})
    </div>
  ),
  getItemData: (item: TestItem) => ({ element: item.element }),
  getItemGroup: (item: TestItem) => item.element,
  getGroupCount: (
    group: string,
    itemsPerTier: { [tier: string]: TestItem[] }
  ) =>
    Object.values(itemsPerTier)
      .flat()
      .filter((i) => i.element === group).length,
  getTierDisplayName: (tier: string) => tier,
  getImagePath: (item: TestItem) => `/character/${item.id}.png`,
  getAlt: (item: TestItem) => item.id,
  getTooltip: (item: TestItem) => <div>{item.id}</div>,
};

describe("TierGrid", () => {
  it("renders all tier labels", () => {
    render(
      <DndWrapper>
        <TierGrid {...defaultProps} />
      </DndWrapper>
    );

    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Pool")).toBeInTheDocument();
  });

  it("renders group headers", () => {
    render(
      <DndWrapper>
        <TierGrid {...defaultProps} />
      </DndWrapper>
    );

    expect(screen.getByTestId("header-Pyro")).toBeInTheDocument();
    expect(screen.getByTestId("header-Hydro")).toBeInTheDocument();
    expect(screen.getByTestId("header-Geo")).toBeInTheDocument();
  });

  it("renders items in correct tier cells", () => {
    const { container } = render(
      <DndWrapper>
        <TierGrid {...defaultProps} />
      </DndWrapper>
    );

    // Each cell has data-tier and data-group attributes
    const sTierPyroCell = container.querySelector(
      '[data-tier="S"][data-group="Pyro"]'
    );
    expect(sTierPyroCell).toBeInTheDocument();

    // hu_tao should be in S tier
    const huTaoItem = container.querySelector('[data-item-id="hu_tao"]');
    expect(huTaoItem).toBeInTheDocument();
  });

  it("displays custom tier names when provided", () => {
    const propsWithCustomNames = {
      ...defaultProps,
      tierCustomization: {
        S: { displayName: "God Tier" },
      },
    };

    render(
      <DndWrapper>
        <TierGrid {...propsWithCustomNames} />
      </DndWrapper>
    );

    expect(screen.getByText("God Tier")).toBeInTheDocument();
    expect(screen.queryByText("S")).not.toBeInTheDocument();
  });

  it("uses getTierDisplayName for tier label when no custom name", () => {
    const customGetTierDisplayName = vi.fn((tier: string) => `Tier ${tier}`);

    render(
      <DndWrapper>
        <TierGrid
          {...defaultProps}
          getTierDisplayName={customGetTierDisplayName}
        />
      </DndWrapper>
    );

    expect(screen.getByText("Tier S")).toBeInTheDocument();
    expect(screen.getByText("Tier A")).toBeInTheDocument();
    expect(screen.getByText("Tier Pool")).toBeInTheDocument();
  });

  it("renders correct number of tier rows", () => {
    const { container } = render(
      <DndWrapper>
        <TierGrid {...defaultProps} />
      </DndWrapper>
    );

    // 3 tiers * 3 groups = 9 cells (plus tier labels)
    const cells = container.querySelectorAll("[data-tier]");
    expect(cells.length).toBe(9);
  });
});
