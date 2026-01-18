import { ItemIcon, SIZE_CLASSES } from "@/components/shared/ItemIcon";
import { render, screen } from "../../utils/render";

describe("ItemIcon", () => {
  const defaultProps = {
    imagePath: "characters/hu_tao/icon.webp",
  };

  it("renders an image with the correct src", () => {
    const { container } = render(<ItemIcon {...defaultProps} />);

    // Image with empty alt has role="presentation", so query by tag
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/characters/hu_tao/icon.webp");
  });

  it("applies rarity background class", () => {
    const { container } = render(<ItemIcon {...defaultProps} rarity={1} />);

    // Rarity uses custom CSS classes like bg-rarity-1
    const iconDiv = container.firstChild as HTMLElement;
    expect(iconDiv).toHaveClass("bg-rarity-1");
  });

  it("applies correct rarity background for 5-star", () => {
    const { container } = render(<ItemIcon {...defaultProps} rarity={5} />);

    const iconDiv = container.firstChild as HTMLElement;
    expect(iconDiv).toHaveClass("bg-rarity-5");
  });

  it("applies correct rarity background for 4-star", () => {
    const { container } = render(<ItemIcon {...defaultProps} rarity={4} />);

    const iconDiv = container.firstChild as HTMLElement;
    expect(iconDiv).toHaveClass("bg-rarity-4");
  });

  describe("size variants", () => {
    // Test width/height from each size, not rounding (component has override)
    it("applies xs size classes", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="xs" />);
      const iconDiv = container.firstChild as HTMLElement;
      expect(iconDiv).toHaveClass("w-10", "h-10");
    });

    it("applies sm size classes", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="sm" />);
      const iconDiv = container.firstChild as HTMLElement;
      expect(iconDiv).toHaveClass("w-12", "h-12");
    });

    it("applies md size classes", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="md" />);
      const iconDiv = container.firstChild as HTMLElement;
      expect(iconDiv).toHaveClass("w-14", "h-14");
    });

    it("applies lg size classes (default)", () => {
      const { container } = render(<ItemIcon {...defaultProps} />);
      const iconDiv = container.firstChild as HTMLElement;
      expect(iconDiv).toHaveClass("w-16", "h-16");
    });

    it("applies xl size classes", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="xl" />);
      const iconDiv = container.firstChild as HTMLElement;
      expect(iconDiv).toHaveClass("w-20", "h-20");
    });

    it("applies 2xl size classes", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="2xl" />);
      const iconDiv = container.firstChild as HTMLElement;
      expect(iconDiv).toHaveClass("w-24", "h-24");
    });

    it("applies full size class", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="full" />);
      const iconDiv = container.firstChild as HTMLElement;
      expect(iconDiv).toHaveClass("w-full", "h-full");
    });
  });

  it("renders label when provided", () => {
    render(<ItemIcon {...defaultProps} label="C6" />);

    expect(screen.getByText("C6")).toBeInTheDocument();
  });

  it("does not render label when not provided", () => {
    const { container } = render(<ItemIcon {...defaultProps} />);

    // Label div has absolute positioning
    const labelDivs = container.querySelectorAll(".absolute");
    // No label divs when label not provided
    expect(labelDivs.length).toBe(0);
  });

  it("applies custom className", () => {
    const { container } = render(
      <ItemIcon {...defaultProps} className="my-custom-class" />
    );

    const iconDiv = container.firstChild as HTMLElement;
    expect(iconDiv).toHaveClass("my-custom-class");
  });

  it("renders children when provided", () => {
    render(
      <ItemIcon {...defaultProps}>
        <span data-testid="child-element">Child</span>
      </ItemIcon>
    );

    expect(screen.getByTestId("child-element")).toBeInTheDocument();
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  it("sets alt attribute when provided", () => {
    render(<ItemIcon {...defaultProps} alt="Hu Tao Icon" />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "Hu Tao Icon");
  });

  it("sets empty alt attribute by default", () => {
    const { container } = render(<ItemIcon {...defaultProps} />);

    // Empty alt has role="presentation", so query by tag
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
  });
});
