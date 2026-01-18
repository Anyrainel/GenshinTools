import { SortToggleGroup } from "@/components/shared/SortToggleGroup";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("SortToggleGroup", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("renders label", () => {
    render(
      <SortToggleGroup
        label="Release Date"
        value="off"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("Release Date")).toBeInTheDocument();
  });

  it("renders all three toggle options", () => {
    render(
      <SortToggleGroup
        label="Release Date"
        value="off"
        onChange={mockOnChange}
      />
    );

    // Should have Off, Asc, Desc buttons
    expect(
      screen.getByRole("radio", { name: /no sorting/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /ascending/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /descending/i })
    ).toBeInTheDocument();
  });

  it("shows off as selected when value is off", () => {
    render(
      <SortToggleGroup
        label="Release Date"
        value="off"
        onChange={mockOnChange}
      />
    );

    const offButton = screen.getByRole("radio", { name: /no sorting/i });
    expect(offButton).toHaveAttribute("data-state", "on");
  });

  it("shows asc as selected when value is asc", () => {
    render(
      <SortToggleGroup
        label="Release Date"
        value="asc"
        onChange={mockOnChange}
      />
    );

    const ascButton = screen.getByRole("radio", { name: /ascending/i });
    expect(ascButton).toHaveAttribute("data-state", "on");
  });

  it("shows desc as selected when value is desc", () => {
    render(
      <SortToggleGroup
        label="Release Date"
        value="desc"
        onChange={mockOnChange}
      />
    );

    const descButton = screen.getByRole("radio", { name: /descending/i });
    expect(descButton).toHaveAttribute("data-state", "on");
  });

  it("calls onChange when toggle option is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SortToggleGroup
        label="Release Date"
        value="off"
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByRole("radio", { name: /ascending/i }));

    expect(mockOnChange).toHaveBeenCalledWith("asc");
  });
});
