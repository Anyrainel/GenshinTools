import type { ControlHandle } from "@/components/layout/AppBar";
import { ExportControl } from "@/components/shared/ExportControl";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { render, screen } from "../../utils/render";

describe("ExportControl", () => {
  const defaultOnExport = vi.fn();

  beforeEach(() => {
    defaultOnExport.mockClear();
  });

  it("opens dialog via ref.open()", async () => {
    const ref = createRef<ControlHandle>();
    render(<ExportControl ref={ref} onExport={defaultOnExport} />);

    // Dialog should not be visible initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    ref.current?.open();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("shows author and description inputs in dialog", async () => {
    const ref = createRef<ControlHandle>();
    render(<ExportControl ref={ref} onExport={defaultOnExport} />);

    ref.current?.open();
    await screen.findByRole("dialog");

    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("validates empty author field", async () => {
    const user = userEvent.setup();
    const ref = createRef<ControlHandle>();
    render(<ExportControl ref={ref} onExport={defaultOnExport} />);

    ref.current?.open();
    await screen.findByRole("dialog");

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
    const ref = createRef<ControlHandle>();
    render(<ExportControl ref={ref} onExport={defaultOnExport} />);

    ref.current?.open();
    await screen.findByRole("dialog");

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
    const ref = createRef<ControlHandle>();
    render(<ExportControl ref={ref} onExport={defaultOnExport} />);

    ref.current?.open();
    await screen.findByRole("dialog");

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
    const ref = createRef<ControlHandle>();
    render(
      <ExportControl
        ref={ref}
        onExport={defaultOnExport}
        defaultAuthor="Default Author"
        defaultDescription="Default Description"
      />
    );

    ref.current?.open();
    await screen.findByRole("dialog");

    expect(screen.getByLabelText(/author/i)).toHaveValue("Default Author");
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      "Default Description"
    );
  });

  it("closes dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    const ref = createRef<ControlHandle>();
    render(<ExportControl ref={ref} onExport={defaultOnExport} />);

    ref.current?.open();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
