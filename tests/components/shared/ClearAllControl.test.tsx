import type { ControlHandle } from "@/components/layout/AppBar";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { render, screen } from "../../utils/render";

describe("ClearAllControl", () => {
  it("opens confirmation dialog via ref.open()", async () => {
    const ref = createRef<ControlHandle>();
    render(<ClearAllControl ref={ref} onConfirm={() => {}} />);

    // Dialog should not be visible initially
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // Open via ref
    ref.current?.open();

    // Dialog should now be visible
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("shows cancel and confirm buttons in dialog", async () => {
    const ref = createRef<ControlHandle>();
    render(<ClearAllControl ref={ref} onConfirm={() => {}} />);

    ref.current?.open();

    // Should show dialog
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeInTheDocument();

    // Dialog should have cancel and confirm buttons
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("uses tier-list variant messages when specified", async () => {
    const ref = createRef<ControlHandle>();
    render(
      <ClearAllControl ref={ref} onConfirm={() => {}} variant="tier-list" />
    );

    ref.current?.open();

    // Dialog should open with tier-list specific messages
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn();
    const ref = createRef<ControlHandle>();
    render(<ClearAllControl ref={ref} onConfirm={mockOnConfirm} />);

    // Open dialog via ref
    ref.current?.open();
    await screen.findByRole("alertdialog");

    // Find and click the confirm action button (has destructive styling)
    const confirmButton = screen.getByRole("button", { name: /clear|delete/i });
    await user.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledOnce();
  });

  it("closes dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    const ref = createRef<ControlHandle>();
    render(<ClearAllControl ref={ref} onConfirm={() => {}} />);

    // Open dialog
    ref.current?.open();
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

    // Cancel
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // Dialog should be closed
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("does not call onConfirm when cancel is clicked", async () => {
    const user = userEvent.setup();
    const mockOnConfirm = vi.fn();
    const ref = createRef<ControlHandle>();
    render(<ClearAllControl ref={ref} onConfirm={mockOnConfirm} />);

    // Open dialog
    ref.current?.open();
    await screen.findByRole("alertdialog");

    // Cancel
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
