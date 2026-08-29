import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { InventoryWeaponGrid } from "@/components/account-data/InventoryWeaponGrid";
import { useLanguage } from "@/contexts/LanguageContext";
import { render, screen, waitFor, within } from "../../utils/render";

type WeaponGridProps = Omit<ComponentProps<typeof InventoryWeaponGrid>, "t">;

function TestWeaponGrid(props: WeaponGridProps) {
  const { t } = useLanguage();
  return <InventoryWeaponGrid {...props} t={t} />;
}

const GRID_WEAPONS: WeaponGridProps["weapons"] = [
  {
    id: "long-name",
    key: "ultimate_overlords_mega_magic_sword",
    level: 90,
    refinement: 5,
    lock: false,
    equipped: true,
    count: 1,
  },
  {
    id: "short-name",
    key: "the_catch",
    level: 90,
    refinement: 5,
    lock: false,
    equipped: false,
    count: 1,
  },
];

const STAFF_OF_HOMA: WeaponGridProps["weapons"][number] = {
  id: "staff-r3",
  key: "staff_of_homa",
  level: 80,
  refinement: 3,
  lock: true,
  equipped: false,
  count: 1,
};

function setMatchMedia(matchesFor: (query: string) => boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: matchesFor(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  setMatchMedia(() => true);
});

function renderWeaponGrid(overrides: Partial<WeaponGridProps> = {}) {
  return render(
    <TestWeaponGrid
      weapons={GRID_WEAPONS}
      iconSize="xl"
      isEditMode={false}
      onWeaponClick={vi.fn()}
      {...overrides}
    />
  );
}

describe("InventoryWeaponGrid", () => {
  it("keeps long names inside equal-width grid cells", () => {
    const { container } = renderWeaponGrid();

    expect(container.firstElementChild).toHaveClass(
      "grid",
      "grid-cols-[repeat(auto-fill,minmax(72px,1fr))]"
    );
    expect(
      screen.getByText("Ultimate Overlord's Mega Magic Sword")
    ).toHaveClass("line-clamp-2", "w-full", "min-w-0", "break-words");
  });

  it("does not duplicate equipped status with a green dot", () => {
    const { container } = renderWeaponGrid();

    expect(container.querySelector(".bg-green-400")).not.toBeInTheDocument();
  });

  it("opens instance-aware weapon details from a narrow read-only grid", async () => {
    setMatchMedia((query) => query.includes("max-width: 768px"));
    const user = userEvent.setup({ delay: null });
    renderWeaponGrid({ weapons: [STAFF_OF_HOMA] });

    await user.click(screen.getByRole("button", { name: "Staff of Homa" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Weapon Details")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Level 80");
    expect(dialog).toHaveTextContent("R3");
    await waitFor(() => {
      expect(dialog).toHaveTextContent("30%");
      expect(dialog).toHaveTextContent("1.2%");
      expect(dialog).toHaveTextContent("1.4%");
      expect(dialog).not.toHaveTextContent("20%/25%/30%/35%/40%");
      expect(dialog).toHaveTextContent(/Max Level ATK:\s*608/);
    });
  });

  it("keeps the desktop hover preview and opens details on click", async () => {
    setMatchMedia((query) => !query.includes("max-width: 768px"));
    const user = userEvent.setup({ delay: null });
    renderWeaponGrid({ weapons: [STAFF_OF_HOMA] });

    const trigger = screen.getByRole("button", { name: "Staff of Homa" });
    await user.hover(trigger);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("R3");

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps edit-mode clicks on the existing edit action", async () => {
    const user = userEvent.setup({ delay: null });
    const onWeaponClick = vi.fn();
    renderWeaponGrid({
      weapons: [STAFF_OF_HOMA],
      isEditMode: true,
      onWeaponClick,
    });

    await user.click(screen.getByText("Staff of Homa"));

    expect(onWeaponClick).toHaveBeenCalledOnce();
    expect(onWeaponClick).toHaveBeenCalledWith(STAFF_OF_HOMA);
    expect(screen.queryByText("Weapon Details")).not.toBeInTheDocument();
  });
});
