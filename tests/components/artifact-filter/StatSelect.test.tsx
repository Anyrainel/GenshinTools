import { StatSelect } from "@/components/artifact-filter/StatSelect";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

const mockOptions = ["cr", "cd", "atk%", "hp%", "def%", "em", "er"] as const;

describe("StatSelect", () => {
  const mockOnValuesChange = vi.fn();

  beforeEach(() => {
    mockOnValuesChange.mockClear();
  });

  it("renders existing values as selects", () => {
    render(
      <StatSelect
        values={["cr", "cd"]}
        onValuesChange={mockOnValuesChange}
        options={mockOptions}
        maxLength={4}
      />
    );

    // Should have two comboboxes (one for each value)
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBe(2);
  });

  it("shows add button when below max length", () => {
    render(
      <StatSelect
        values={["cr"]}
        onValuesChange={mockOnValuesChange}
        options={mockOptions}
        maxLength={4}
      />
    );

    // Should have add button
    const addButton = screen.getByRole("button");
    expect(addButton).toBeInTheDocument();
  });

  it("hides add button when at max length", () => {
    render(
      <StatSelect
        values={["cr", "cd", "atk%", "hp%"]}
        onValuesChange={mockOnValuesChange}
        options={mockOptions}
        maxLength={4}
      />
    );

    // Should not have an add button (only comboboxes)
    const buttons = screen.queryAllByRole("button");
    // Filter out comboboxes which might also be buttons
    const addButtons = buttons.filter((b) => b.querySelector(".lucide-plus"));
    expect(addButtons.length).toBe(0);
  });

  it("renders empty state with add button", () => {
    render(
      <StatSelect
        values={[]}
        onValuesChange={mockOnValuesChange}
        options={mockOptions}
        maxLength={4}
      />
    );

    // Should have add button
    const addButton = screen.getByRole("button");
    expect(addButton).toBeInTheDocument();
  });
});
