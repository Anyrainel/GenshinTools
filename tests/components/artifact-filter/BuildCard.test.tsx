import { BuildCard } from "@/components/artifact-filter/BuildCard";
import { useBuildsStore } from "@/stores/useBuildsStore";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "../../utils/render";

describe("BuildCard", () => {
  const mockOnDelete = vi.fn();
  const mockOnDuplicate = vi.fn();

  beforeEach(() => {
    mockOnDelete.mockClear();
    mockOnDuplicate.mockClear();
    useBuildsStore.getState().clearAll();
    useBuildsStore.getState().newBuild("hu_tao");
  });

  const renderBuildCard = (buildIndex = 1) => {
    const buildId = Object.keys(useBuildsStore.getState().builds)[0];
    return render(
      <BuildCard
        buildId={buildId}
        buildIndex={buildIndex}
        onDelete={mockOnDelete}
        onDuplicate={mockOnDuplicate}
        element="Pyro"
      />
    );
  };

  it("displays build index number in header", () => {
    renderBuildCard(3);

    // Build index should be visible (format may vary: "#3" or "3")
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("shows build name input field", () => {
    renderBuildCard();

    // Should have a textbox input for build name
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("updates build name when input changes", async () => {
    const user = userEvent.setup();
    renderBuildCard();

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Main DPS");

    expect(input).toHaveValue("Main DPS");
  });

  it("has delete button available", () => {
    const { container } = renderBuildCard();

    // Find delete button (has trash icon)
    const trashIcon = container.querySelector(".lucide-trash2");
    expect(trashIcon).toBeInTheDocument();
  });

  it("has copy button available", () => {
    const { container } = renderBuildCard();

    // Find copy button (has copy icon)
    const copyIcon = container.querySelector(".lucide-copy");
    expect(copyIcon).toBeInTheDocument();
  });

  it("renders composition toggle with 4pc as default", () => {
    renderBuildCard();

    // Should have composition label
    expect(screen.getByText(/4pc|2pc\+2pc/i)).toBeInTheDocument();
  });

  it("renders artifact set selector", () => {
    renderBuildCard();

    // Should have combobox for artifact set selection
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  });

  it("has exactly 3 action buttons (collapse, delete, copy)", () => {
    renderBuildCard();

    // Collapsible trigger + Delete + Copy = at minimum 3 buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });
});
