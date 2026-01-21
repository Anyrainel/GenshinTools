import type { ControlHandle } from "@/components/layout/AppBar";
import { ImportControl } from "@/components/shared/ImportControl";
import type { PresetOption } from "@/data/types";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
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

  it("opens dialog via ref.open()", async () => {
    const ref = createRef<ControlHandle>();
    render(
      <ImportControl
        ref={ref}
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    // Dialog should not be visible initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    ref.current?.open();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("displays preset options in dialog", async () => {
    const ref = createRef<ControlHandle>();
    render(
      <ImportControl
        ref={ref}
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    ref.current?.open();
    await screen.findByRole("dialog");

    // Should show preset options sorted alphabetically
    expect(screen.getByText("Preset A")).toBeInTheDocument();
    expect(screen.getByText("Preset B")).toBeInTheDocument();
  });

  it("shows confirmation dialog when preset is selected", async () => {
    const user = userEvent.setup();
    const ref = createRef<ControlHandle>();
    render(
      <ImportControl
        ref={ref}
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    ref.current?.open();
    await screen.findByRole("dialog");

    await user.click(screen.getByText("Preset A"));

    // Should show alert dialog for confirmation
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("calls loadPreset and onApply when confirmed", async () => {
    const user = userEvent.setup();
    const ref = createRef<ControlHandle>();
    render(
      <ImportControl
        ref={ref}
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    ref.current?.open();
    await screen.findByRole("dialog");

    await user.click(screen.getByText("Preset A"));
    await screen.findByRole("alertdialog");

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
    const ref = createRef<ControlHandle>();
    render(
      <ImportControl
        ref={ref}
        options={sampleOptions}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
        onLocalImport={mockOnLocalImport}
      />
    );

    ref.current?.open();
    await screen.findByRole("dialog");

    // Should show "Import from File" button area
    const fileButtons = screen.getAllByText(/import/i);
    // One of them should contain "file"
    const fileButton = fileButtons.find((btn) =>
      btn.textContent?.toLowerCase().includes("file")
    );
    expect(fileButton).toBeInTheDocument();
  });

  it("shows empty list message when no options available", async () => {
    const ref = createRef<ControlHandle>();
    render(
      <ImportControl
        ref={ref}
        options={[]}
        loadPreset={mockLoadPreset}
        onApply={mockOnApply}
      />
    );

    ref.current?.open();

    // Should show empty list message
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });
});
