import { BuildImportControl } from "@/components/artifact-builds/BuildImportControl";
import type { PresetOption } from "@/data/types";
import { fireEvent, render, screen, waitFor } from "../../utils/render";

describe("BuildImportControl", () => {
  const mockLoadPreset = vi.fn();
  const mockOnSubscribe = vi.fn();
  const mockOnCopy = vi.fn();
  const mockRef = { current: null };

  const options: PresetOption[] = [
    { label: "Preset A", path: "preset-a", author: "Author A" },
    { label: "Preset B", path: "preset-b", author: "Author B" },
  ];

  beforeEach(() => {
    mockLoadPreset.mockReset();
    mockOnSubscribe.mockReset();
    mockOnCopy.mockReset();
    mockLoadPreset.mockResolvedValue({ version: 5, builds: {} });
  });

  it("renders list of presets when opened", async () => {
    render(
      <BuildImportControl
        ref={mockRef}
        options={options}
        loadPreset={mockLoadPreset}
        onSubscribe={mockOnSubscribe}
        onCopy={mockOnCopy}
      />
    );

    // Initial state is closed
    expect(screen.queryByText("Preset A")).not.toBeInTheDocument();

    // Open dialog
    // @ts-ignore
    mockRef.current?.open();

    await waitFor(() => {
      expect(screen.getByText("Preset A")).toBeInTheDocument();
      expect(screen.getByText("Preset B")).toBeInTheDocument();
    });
  });

  it("shows action dialog on preset selection", async () => {
    render(
      <BuildImportControl
        ref={mockRef}
        options={options}
        loadPreset={mockLoadPreset}
        onSubscribe={mockOnSubscribe}
        onCopy={mockOnCopy}
      />
    );

    // @ts-ignore
    mockRef.current?.open();
    await waitFor(() => screen.getByText("Preset A"));

    // Select Preset A
    fireEvent.click(screen.getByText("Preset A"));

    await waitFor(() => {
      // Check for action dialog content
      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText("Preset A")).toBeInTheDocument();
      // Should see Subscribe and Copy buttons
      // We look for text inside buttons
      expect(screen.getByText(/Subscribe/i)).toBeInTheDocument();
      expect(screen.getByText(/Copy to Local/i)).toBeInTheDocument();
    });
  });

  it("calls onSubscribe when Subscribe is clicked", async () => {
    render(
      <BuildImportControl
        ref={mockRef}
        options={options}
        loadPreset={mockLoadPreset}
        onSubscribe={mockOnSubscribe}
        onCopy={mockOnCopy}
      />
    );

    // @ts-ignore
    mockRef.current?.open();
    await waitFor(() => screen.getByText("Preset A"));
    fireEvent.click(screen.getByText("Preset A"));

    await waitFor(() => screen.getByRole("alertdialog"));

    // Click Subscribe
    fireEvent.click(screen.getByText(/Subscribe/i));

    await waitFor(() => {
      expect(mockLoadPreset).toHaveBeenCalledWith("preset-a");
      expect(mockOnSubscribe).toHaveBeenCalledWith(
        "preset-a",
        expect.anything()
      );
    });
  });

  it("calls onCopy when Copy is clicked", async () => {
    render(
      <BuildImportControl
        ref={mockRef}
        options={options}
        loadPreset={mockLoadPreset}
        onSubscribe={mockOnSubscribe}
        onCopy={mockOnCopy}
      />
    );

    // @ts-ignore
    mockRef.current?.open();
    await waitFor(() => screen.getByText("Preset A"));
    fireEvent.click(screen.getByText("Preset A"));

    await waitFor(() => screen.getByRole("alertdialog"));

    // Click Copy
    fireEvent.click(screen.getByText(/Copy to Local/i));

    await waitFor(() => {
      expect(mockLoadPreset).toHaveBeenCalledWith("preset-a");
      expect(mockOnCopy).toHaveBeenCalledWith(expect.anything());
    });
  });
});
