import { ItemIcon } from "@/components/shared/ItemIcon";
import { render, screen } from "../../utils/render";

describe("ItemIcon", () => {
  const defaultProps = {
    imagePath: "characters/hu_tao/icon.webp",
  };

  it("renders an image with the correct src", () => {
    const { container } = render(<ItemIcon {...defaultProps} />);

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/characters/hu_tao/icon.webp");
  });

  it("applies rarity background class", () => {
    const { container } = render(<ItemIcon {...defaultProps} rarity={5} />);

    const iconDiv = container.querySelector(".bg-rarity-5");
    expect(iconDiv).toBeInTheDocument();
  });

  it("applies default lg size (64px)", () => {
    const { container } = render(<ItemIcon {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: "64px", height: "64px" });
  });

  it("applies explicit size override", () => {
    const { container } = render(<ItemIcon {...defaultProps} size="xs" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: "40px", height: "40px" });
  });

  it("renders badge when provided", () => {
    render(<ItemIcon {...defaultProps} badge="6" />);
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renders lock icon when lock is true", () => {
    const { container } = render(<ItemIcon {...defaultProps} lock={true} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("does not render lock when lock is false", () => {
    const { container } = render(<ItemIcon {...defaultProps} lock={false} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders level bar when level is provided", () => {
    render(<ItemIcon {...defaultProps} level="Lv. 90" />);
    expect(screen.getByText("Lv. 90")).toBeInTheDocument();
  });

  it("renders weaponTypeBadge when provided", () => {
    const { container } = render(
      <ItemIcon {...defaultProps} weaponTypeBadge="weapon/sword.webp" />
    );
    const imgs = container.querySelectorAll("img");
    const badgeImg = Array.from(imgs).find((img) =>
      img.getAttribute("src")?.includes("sword")
    );
    expect(badgeImg).toBeInTheDocument();
  });
});
