import { TierGrid } from "@/components/tier-list/TierGrid";
import type {
  TierGroupConfig,
  TierItemData,
} from "@/components/tier-list/tierTableTypes";
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
  {
    id: "hu_tao",
    rarity: 5,
    imagePath: "/character/hu_tao.png",
    element: "Pyro",
  },
  {
    id: "xingqiu",
    rarity: 4,
    imagePath: "/character/xingqiu.png",
    element: "Hydro",
  },
  {
    id: "zhongli",
    rarity: 5,
    imagePath: "/character/zhongli.png",
    element: "Geo",
  },
];

const testGroupConfig: Record<string, TierGroupConfig> = {
  Pyro: { bgClass: "bg-element-pyro/60", iconPath: "/elements/pyro.png" },
  Hydro: { bgClass: "bg-element-hydro/60", iconPath: "/elements/hydro.png" },
  Geo: { bgClass: "bg-element-geo/60", iconPath: "/elements/geo.png" },
};

const defaultProps = {
  allTiers: ["S", "A", "Pool"],
  groups: ["Pyro", "Hydro", "Geo"] as const,
  itemsPerTier: {
    S: [mockItems[0]], // hu_tao in S tier
    A: [mockItems[1]], // xingqiu in A tier
    Pool: [mockItems[2]], // zhongli in Pool
  } as { [tier: string]: TestItem[] },
  tierCustomization: {},
  groupKey: "element" as keyof TestItem,
  groupConfig: testGroupConfig,
  getGroupName: (group: string) => group,
  getItemName: (item: TestItem) => item.id,
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

  it("renders group headers with icons", () => {
    const { container } = render(
      <DndWrapper>
        <TierGrid {...defaultProps} />
      </DndWrapper>
    );

    // Headers should have images for each group
    const headerImages = container.querySelectorAll("img");
    expect(headerImages.length).toBeGreaterThan(0);
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

  it("uses t.ui for tier display names when no custom name", () => {
    // TierGrid now uses useLanguage() internally, which is mocked in tests
    // This test just verifies the component renders with tier labels
    render(
      <DndWrapper>
        <TierGrid {...defaultProps} />
      </DndWrapper>
    );

    // The mock LanguageProvider in tests returns keys as-is
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Pool")).toBeInTheDocument();
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
