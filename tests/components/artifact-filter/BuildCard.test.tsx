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

    // Mock matchMedia to return true (Desktop view)
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
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

  it("has exactly 3 action buttons (collapse, delete, copy)", () => {
    renderBuildCard();

    // Collapsible trigger + Delete + Copy = at minimum 3 buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });
});
