import { TierItemPreview } from "@/components/tier-list/TierItemPreview";
import { render, screen } from "../../utils/render";

const mockItem = {
  id: "hu_tao",
  rarity: 5 as const,
};

describe("TierItemPreview", () => {
  it("renders content from renderContent prop", () => {
    render(
      <TierItemPreview
        item={mockItem}
        renderContent={(item) => (
          <div data-testid="preview-content">{item.id}</div>
        )}
      />
    );

    expect(screen.getByTestId("preview-content")).toBeInTheDocument();
    expect(screen.getByText("hu_tao")).toBeInTheDocument();
  });

  it("applies drag preview styling", () => {
    const { container } = render(
      <TierItemPreview
        item={mockItem}
        renderContent={(item) => <div>{item.id}</div>}
      />
    );

    // Should have opacity, transform, and cursor styles for dragging
    const previewDiv = container.firstChild as HTMLElement;
    expect(previewDiv.style.opacity).toBe("0.8");
    expect(previewDiv.style.cursor).toBe("grabbing");
  });
});
