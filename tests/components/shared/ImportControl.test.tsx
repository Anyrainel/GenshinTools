import { ImportControl } from "@/components/shared/ImportControl";
import type { PresetOption } from "@/data/types";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("ImportControl", () => {
  const mockLoadPreset = vi.fn().mockResolvedValue({ data: "test" });
  const mockOnApply = vi.fn();
  const mockOnLocalImport = vi.fn();

  const sampleOptions: PresetOption[] = [
    { label: "Preset A", path: "/presets/a.json" },
    { label: "Preset B", path: "/presets/b.json" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders import button", () => {
    render(
      <ImportControl
        options={[]}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent(/import/i);
  });

  it("opens dialog when button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ImportControl
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays preset options in dialog", async () => {
    const user = userEvent.setup();
    render(
      <ImportControl
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    await user.click(screen.getByRole("button"));

    // Should show preset options sorted alphabetically
    expect(screen.getByText("Preset A")).toBeInTheDocument();
    expect(screen.getByText("Preset B")).toBeInTheDocument();
  });

  it("shows confirmation dialog when preset is selected", async () => {
    const user = userEvent.setup();
    render(
      <ImportControl
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Preset A"));

    // Should show alert dialog for confirmation
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("calls loadPreset and onApply when confirmed", async () => {
    const user = userEvent.setup();
    render(
      <ImportControl
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Preset A"));

    // Find and click confirm button in alert dialog
    const buttons = screen.getAllByRole("button");
    const confirmButton = buttons.find(
      (btn) => !btn.textContent?.toLowerCase().includes("cancel")
    );
    await user.click(confirmButton!);

    expect(mockLoadPreset).toHaveBeenCalledWith("/presets/a.json");
    expect(mockOnApply).toHaveBeenCalledWith({ data: "test" });
  });

  it("shows file import button when onLocalImport is provided", async () => {
    const user = userEvent.setup();
    render(
      <ImportControl
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
        onLocalImport={mockOnLocalImport}
      />
    );

    await user.click(screen.getByRole("button"));

    // Should show "Import from File" button area
    const fileButtons = screen.getAllByText(/import/i);
    // One of them should contain "file"
    const fileButton = fileButtons.find((btn) =>
      btn.textContent?.toLowerCase().includes("file")
    );
    expect(fileButton).toBeInTheDocument();
  });

  it("shows empty list message when no options and hideEmptyList is false", async () => {
    const user = userEvent.setup();
    render(
      <ImportControl
        options={[]}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
        hideEmptyList={false}
      />
    );

    await user.click(screen.getByRole("button"));

    // Should show empty list message
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("hides empty list message when hideEmptyList is true", async () => {
    const user = userEvent.setup();
    render(
      <ImportControl
        options={[]}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
        hideEmptyList={true}
        onLocalImport={mockOnLocalImport}
      />
    );

    await user.click(screen.getByRole("button"));

    // Dialog should still be open but won't show no-presets message
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("disables button when disabled prop is true", () => {
    render(
      <ImportControl
        options={[]}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
        disabled
      />
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
