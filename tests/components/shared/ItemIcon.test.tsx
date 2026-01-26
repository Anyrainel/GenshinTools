import { ItemIcon } from "@/components/shared/ItemIcon";
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

    // Find the inner icon div that has the rarity class
    const iconDiv = container.querySelector(".bg-rarity-1");
    expect(iconDiv).toBeInTheDocument();
  });

  it("applies correct rarity background for 5-star", () => {
    const { container } = render(<ItemIcon {...defaultProps} rarity={5} />);

    const iconDiv = container.querySelector(".bg-rarity-5");
    expect(iconDiv).toBeInTheDocument();
  });

  it("applies correct rarity background for 4-star", () => {
    const { container } = render(<ItemIcon {...defaultProps} rarity={4} />);

    const iconDiv = container.querySelector(".bg-rarity-4");
    expect(iconDiv).toBeInTheDocument();
  });

  describe("size variants", () => {
    // ItemIcon now uses inline styles for sizing, not Tailwind classes
    // Test that the outer wrapper has the correct computed width/height via style
    it("applies xs size (40px)", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="xs" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: "40px", height: "40px" });
    });

    it("applies sm size (48px)", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="sm" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: "48px", height: "48px" });
    });

    it("applies md size (56px)", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="md" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: "56px", height: "56px" });
    });

    it("applies lg size (64px, default)", () => {
      const { container } = render(<ItemIcon {...defaultProps} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: "64px", height: "64px" });
    });

    it("applies xl size (80px)", () => {
      const { container } = render(<ItemIcon {...defaultProps} size="xl" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: "80px", height: "80px" });
    });
  });

  describe("badge", () => {
    it("renders badge when provided", () => {
      render(<ItemIcon {...defaultProps} badge="6" />);
      expect(screen.getByText("6")).toBeInTheDocument();
    });

    it("renders badge on all sizes including xs", () => {
      render(<ItemIcon {...defaultProps} badge="6" size="xs" />);
      expect(screen.getByText("6")).toBeInTheDocument();
    });
  });

  describe("lock", () => {
    it("renders lock icon when lock is true", () => {
      const { container } = render(<ItemIcon {...defaultProps} lock={true} />);
      // Lock uses lucide Lock icon which renders as svg
      const lockSvg = container.querySelector("svg");
      expect(lockSvg).toBeInTheDocument();
    });

    it("does not render lock when lock is false", () => {
      const { container } = render(<ItemIcon {...defaultProps} lock={false} />);
      const lockSvg = container.querySelector("svg");
      expect(lockSvg).not.toBeInTheDocument();
    });

    it("renders lock on all sizes including xs", () => {
      const { container } = render(
        <ItemIcon {...defaultProps} lock={true} size="xs" />
      );
      const lockSvg = container.querySelector("svg");
      expect(lockSvg).toBeInTheDocument();
    });
  });

  describe("level", () => {
    it("renders level bar when level is provided", () => {
      render(<ItemIcon {...defaultProps} level="Lv. 90" />);
      expect(screen.getByText("Lv. 90")).toBeInTheDocument();
    });

    it("renders artifact level format", () => {
      render(<ItemIcon {...defaultProps} level="+20" />);
      expect(screen.getByText("+20")).toBeInTheDocument();
    });

    it("creates layered background for level bar", () => {
      const { container } = render(
        <ItemIcon {...defaultProps} level="Lv. 90" />
      );
      // Check for the warm white background layer
      const bgLayer = container.querySelector(".bg-\\[\\#f5f0e6\\]");
      expect(bgLayer).toBeInTheDocument();
    });

    it("renders level bar on all sizes including xs", () => {
      render(<ItemIcon {...defaultProps} level="Lv. 90" size="xs" />);
      expect(screen.getByText("Lv. 90")).toBeInTheDocument();
    });

    it("renders level bar on sm size", () => {
      render(<ItemIcon {...defaultProps} level="Lv. 90" size="sm" />);
      expect(screen.getByText("Lv. 90")).toBeInTheDocument();
    });

    it("renders level bar on md size", () => {
      render(<ItemIcon {...defaultProps} level="Lv. 90" size="md" />);
      expect(screen.getByText("Lv. 90")).toBeInTheDocument();
    });
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

  it("uses imagePath as alt attribute", () => {
    const { container } = render(<ItemIcon {...defaultProps} />);

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", defaultProps.imagePath);
  });
});
