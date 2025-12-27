import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ClearAllControl } from "./ClearAllControl";

// Mock the useLanguage hook
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
    },
  }),
}));

// Mock the dialog components since they are complex and we just want to test interaction logic
// However, since we are using Radix UI primitives, they should work in jsdom if we don't mock them too heavily.
// But Radix UI relies on Pointer Events which might be tricky in JSDOM.
// Let's try testing without mocking UI components first.

describe("ClearAllControl", () => {
  it("renders the button", () => {
    render(<ClearAllControl onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: /app.clear/i })).toBeInTheDocument();
  });

  it("opens dialog on click", async () => {
    render(<ClearAllControl onConfirm={() => {}} />);
    const button = screen.getByRole("button", { name: /app.clear/i });
    fireEvent.click(button);

    // Wait for dialog to appear
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("configure.clearAllConfirmTitle")).toBeInTheDocument();
  });

  it("calls onConfirm when confirmed", async () => {
    const handleConfirm = vi.fn();
    render(<ClearAllControl onConfirm={handleConfirm} />);

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /app.clear/i }));

    // Find confirm button in dialog (using action label mock)
    const confirmButton = await screen.findByText("configure.clearAllConfirmAction");
    fireEvent.click(confirmButton);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onConfirm when cancelled", async () => {
    const handleConfirm = vi.fn();
    render(<ClearAllControl onConfirm={handleConfirm} />);

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /app.clear/i }));

    // Find cancel button
    const cancelButton = await screen.findByText("common.cancel");
    fireEvent.click(cancelButton);

    expect(handleConfirm).not.toHaveBeenCalled();
  });
});
