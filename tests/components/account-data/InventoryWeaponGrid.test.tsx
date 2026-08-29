import type { ComponentProps } from "react";
import { InventoryWeaponGrid } from "@/components/account-data/InventoryWeaponGrid";
import { useLanguage } from "@/contexts/LanguageContext";
import { render, screen } from "../../utils/render";

type WeaponGridProps = Omit<ComponentProps<typeof InventoryWeaponGrid>, "t">;

function TestWeaponGrid(props: WeaponGridProps) {
  const { t } = useLanguage();
  return <InventoryWeaponGrid {...props} t={t} />;
}

function renderWeaponGrid() {
  return render(
    <TestWeaponGrid
      weapons={[
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
      ]}
      iconSize="xl"
      isEditMode
      onWeaponClick={vi.fn()}
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
});
