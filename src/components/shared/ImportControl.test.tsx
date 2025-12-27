import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ImportControl } from "./ImportControl";

// Mock LanguageContext
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
    },
  }),
}));

const mockOptions = [
  { label: "Preset 1", path: "preset1" },
  { label: "Preset 2", path: "preset2" },
];

const mockLoadPreset = vi.fn();
const mockOnApply = vi.fn();

describe("ImportControl", () => {
  it("renders import button", () => {
    render(<ImportControl options={mockOptions} loadPreset={mockLoadPreset} onApply={mockOnApply} />);
    expect(screen.getByRole("button", { name: /app.import/i })).toBeInTheDocument();
  });

  it("shows options when clicked", async () => {
    render(<ImportControl options={mockOptions} loadPreset={mockLoadPreset} onApply={mockOnApply} />);

    fireEvent.click(screen.getByRole("button", { name: /app.import/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Preset 1")).toBeInTheDocument();
    expect(screen.getByText("Preset 2")).toBeInTheDocument();
  });

  it("selects a preset and confirms", async () => {
    mockLoadPreset.mockResolvedValue({ data: "test" });
    render(<ImportControl options={mockOptions} loadPreset={mockLoadPreset} onApply={mockOnApply} />);

    // Open picker
    fireEvent.click(screen.getByRole("button", { name: /app.import/i }));

    // Select preset
    fireEvent.click(screen.getByText("Preset 1"));

    // Expect confirmation dialog
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

    // Confirm
    const confirmButton = screen.getByRole("button", { name: /configure.presetConfirmAction/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockLoadPreset).toHaveBeenCalledWith("preset1");
      expect(mockOnApply).toHaveBeenCalledWith({ data: "test" });
    });
  });

  it("handles empty list", async () => {
    render(<ImportControl options={[]} loadPreset={mockLoadPreset} onApply={mockOnApply} />);

    fireEvent.click(screen.getByRole("button", { name: /app.import/i }));

    expect(await screen.findByText("configure.presetDialogEmpty")).toBeInTheDocument();
  });
});
