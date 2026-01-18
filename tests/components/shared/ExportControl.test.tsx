import { ExportControl } from "@/components/shared/ExportControl";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("ExportControl", () => {
  const defaultOnExport = vi.fn();

  beforeEach(() => {
    defaultOnExport.mockClear();
  });

  it("renders an export button", () => {
    render(<ExportControl onExport={defaultOnExport} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent(/export/i);
  });

  it("opens dialog when button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportControl onExport={defaultOnExport} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows author and description inputs in dialog", async () => {
    const user = userEvent.setup();
    render(<ExportControl onExport={defaultOnExport} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("validates empty author field", async () => {
    const user = userEvent.setup();
    render(<ExportControl onExport={defaultOnExport} />);

    await user.click(screen.getByRole("button"));
    // Fill description only
    await user.type(screen.getByLabelText(/description/i), "Test Description");
    // Click export without filling author
    const buttons = screen.getAllByRole("button");
    const exportButton = buttons.find((btn) =>
      btn.textContent?.toLowerCase().includes("export")
    );
    await user.click(exportButton!);

    // Should show error and not call onExport
    expect(defaultOnExport).not.toHaveBeenCalled();
  });

  it("validates empty description field", async () => {
    const user = userEvent.setup();
    render(<ExportControl onExport={defaultOnExport} />);

    await user.click(screen.getByRole("button"));
    // Fill author only
    await user.type(screen.getByLabelText(/author/i), "Test Author");
    // Click export without filling description
    const buttons = screen.getAllByRole("button");
    const exportButton = buttons.find((btn) =>
      btn.textContent?.toLowerCase().includes("export")
    );
    await user.click(exportButton!);

    // Should show error and not call onExport
    expect(defaultOnExport).not.toHaveBeenCalled();
  });

  it("calls onExport with author and description", async () => {
    const user = userEvent.setup();
    render(<ExportControl onExport={defaultOnExport} />);

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByLabelText(/author/i), "Test Author");
    await user.type(screen.getByLabelText(/description/i), "Test Description");

    const buttons = screen.getAllByRole("button");
    const exportButton = buttons.find((btn) =>
      btn.textContent?.toLowerCase().includes("export")
    );
    await user.click(exportButton!);

    expect(defaultOnExport).toHaveBeenCalledWith(
      "Test Author",
      "Test Description"
    );
  });

  it("uses default author and description values", async () => {
    const user = userEvent.setup();
    render(
      <ExportControl
        onExport={defaultOnExport}
        defaultAuthor="Default Author"
        defaultDescription="Default Description"
      />
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByLabelText(/author/i)).toHaveValue("Default Author");
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      "Default Description"
    );
  });

  it("disables button when disabled prop is true", () => {
    render(<ExportControl onExport={defaultOnExport} disabled />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("closes dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportControl onExport={defaultOnExport} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
