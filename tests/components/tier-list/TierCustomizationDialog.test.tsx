import TierCustomizationDialog from "@/components/tier-list/TierCustomizationDialog";
import type { TierCustomization } from "@/data/types";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("TierCustomizationDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSave.mockClear();
  });

  it("opens dialog when isOpen is true", () => {
    render(
      <TierCustomizationDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialCustomization={{}}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <TierCustomizationDialog
        isOpen={false}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialCustomization={{}}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("populates inputs with initial customization values", () => {
    const initialCustomization: TierCustomization = {
      S: { displayName: "Super Tier", hidden: false },
    };

    render(
      <TierCustomizationDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialCustomization={initialCustomization}
      />
    );

    // Should show the initial display name
    expect(screen.getByDisplayValue("Super Tier")).toBeInTheDocument();
  });

  it("calls onSave with customization when save button clicked", async () => {
    const user = userEvent.setup();

    render(
      <TierCustomizationDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialCustomization={{}}
      />
    );

    // Dialog has: X close button, Reset, Cancel, Save buttons
    // Save is the last non-X button (3rd in footer)
    const buttons = screen.getAllByRole("button");
    // Filter to buttons that are not the close X button (which has aria-label or similar)
    const footerButtons = buttons.filter(
      (btn) => !btn.classList.contains("absolute")
    );
    const saveButton = footerButtons[footerButtons.length - 1];
    await user.click(saveButton);

    // Should have called onSave
    expect(mockOnSave).toHaveBeenCalled();
  });

  it("renders inputs for each tier", () => {
    render(
      <TierCustomizationDialog
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialCustomization={{}}
      />
    );

    // Should have at least 6 textboxes (custom title + S, A, B, C, D tiers)
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThanOrEqual(6);
  });
});
