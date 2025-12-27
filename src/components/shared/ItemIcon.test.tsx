import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ItemIcon } from "./ItemIcon";

describe("ItemIcon", () => {
  it("renders with required props", () => {
    render(<ItemIcon imagePath="characters/test.png" alt="test item" />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "test item");
  });

  it("applies correct size classes", () => {
    const { container, rerender } = render(<ItemIcon imagePath="test.png" size="xs" />);
    expect(container.firstChild).toHaveClass("w-6 h-6");

    rerender(<ItemIcon imagePath="test.png" size="lg" />);
    expect(container.firstChild).toHaveClass("w-16 h-16");
  });

  it("applies rarity background", () => {
    const { container } = render(<ItemIcon imagePath="test.png" rarity={5} />);
    expect(container.firstChild).toHaveClass("bg-rarity-5");
  });

  it("renders label when provided", () => {
    render(<ItemIcon imagePath="test.png" label="C6" />);
    expect(screen.getByText("C6")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <ItemIcon imagePath="test.png">
        <span>Child</span>
      </ItemIcon>
    );
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
