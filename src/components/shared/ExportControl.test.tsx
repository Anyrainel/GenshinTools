import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExportControl } from "./ExportControl";

// Mock LanguageContext
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
    },
  }),
}));

describe("ExportControl", () => {
  it("renders export button", () => {
    render(<ExportControl onExport={() => {}} />);
    expect(screen.getByRole("button", { name: /app.export/i })).toBeInTheDocument();
  });

  it("opens dialog on click", async () => {
    render(<ExportControl onExport={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /app.export/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("validates inputs before exporting", async () => {
    const handleExport = vi.fn();
    render(<ExportControl onExport={handleExport} />);

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /app.export/i }));

    // Click confirm without inputs
    const confirmButton = screen.getByRole("button", { name: /configure.exportConfirmAction/i });
    fireEvent.click(confirmButton);

    expect(handleExport).not.toHaveBeenCalled();
    expect(screen.getByText("configure.exportAuthorRequired")).toBeInTheDocument();
    expect(screen.getByText("configure.exportDescriptionRequired")).toBeInTheDocument();
  });

  it("calls onExport with correct values", async () => {
    const handleExport = vi.fn();
    render(<ExportControl onExport={handleExport} />);

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /app.export/i }));

    // Fill inputs
    fireEvent.change(screen.getByLabelText("configure.exportAuthorLabel"), { target: { value: "Author Name" } });
    fireEvent.change(screen.getByLabelText("configure.exportDescriptionLabel"), { target: { value: "Desc" } });

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: /configure.exportConfirmAction/i });
    fireEvent.click(confirmButton);

    expect(handleExport).toHaveBeenCalledWith("Author Name", "Desc");
  });
});
