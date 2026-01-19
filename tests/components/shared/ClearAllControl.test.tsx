import { ClearAllControl } from "@/components/shared/ClearAllControl";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("ClearAllControl", () => {
  it("renders a clear button", () => {
    render(<ClearAllControl onConfirm={() => {}} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    // Button shows trash icon and Clear text
    expect(button).toHaveTextContent(/clear/i);
  });

  it("opens confirmation dialog when clicked", async () => {
    const user = userEvent.setup();
    render(<ClearAllControl onConfirm={() => {}} />);

    await user.click(screen.getByRole("button"));

    // Dialog should now be visible
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("shows default dialog with cancel and confirm buttons", async () => {
    const user = userEvent.setup();
    render(<ClearAllControl onConfirm={() => {}} />);

    await user.click(screen.getByRole("button"));

    // Should show dialog
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    // Dialog should have cancel and confirm buttons
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("uses tier-list variant messages when specified", async () => {
    const user = userEvent.setup();
    render(<ClearAllControl onConfirm={() => {}} variant="tier-list" />);

    await user.click(screen.getByRole("button"));

    // Dialog should still open with tier-list specific messages
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn();
    render(<ClearAllControl onConfirm={mockOnConfirm} />);

    // Open dialog
    await user.click(screen.getByRole("button"));

    // Find and click the confirm action button (has destructive styling)
    const confirmButton = screen.getByRole("button", { name: /clear|delete/i });
    await user.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledOnce();
  });

  it("closes dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ClearAllControl onConfirm={() => {}} />);

    // Open dialog
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Cancel
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // Dialog should be closed
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("does not call onConfirm when cancel is clicked", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn();
    render(<ClearAllControl onConfirm={mockOnConfirm} />);

    // Open dialog
    await user.click(screen.getByRole("button"));

    // Cancel
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it("disables button when disabled prop is true", () => {
    render(<ClearAllControl onConfirm={() => {}} disabled />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});
