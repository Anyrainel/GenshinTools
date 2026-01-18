import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { defaultCharacterFilters } from "@/lib/characterFilters";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("CharacterFilterSidebar", () => {
  const mockOnFiltersChange = vi.fn();

  beforeEach(() => {
    mockOnFiltersChange.mockClear();
  });

  it("renders element filter icons", () => {
    const { container } = render(
      <CharacterFilterSidebar
        filters={defaultCharacterFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Should have images for elements
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThan(0);
  });

  it("renders weapon type filter checkboxes", () => {
    render(
      <CharacterFilterSidebar
        filters={defaultCharacterFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Should have checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("renders sort toggle groups", () => {
    const { container } = render(
      <CharacterFilterSidebar
        filters={defaultCharacterFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // ToggleGroup uses role="group", check for radio buttons inside
    const radioButtons = screen.getAllByRole("radio");
    expect(radioButtons.length).toBeGreaterThan(0);
  });

  it("calls onFiltersChange when checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CharacterFilterSidebar
        filters={defaultCharacterFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Click first checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    expect(mockOnFiltersChange).toHaveBeenCalled();
  });

  it("shows tier sort as disabled when hasTierData is false", () => {
    const { container } = render(
      <CharacterFilterSidebar
        filters={defaultCharacterFilters}
        onFiltersChange={mockOnFiltersChange}
        hasTierData={false}
      />
    );

    // Should have a disabled toggle group (opacity-50)
    const disabledGroup = container.querySelector(".opacity-50");
    expect(disabledGroup).toBeInTheDocument();
  });
});
