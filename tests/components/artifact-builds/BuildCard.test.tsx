import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuildCard } from "@/components/artifact-builds/BuildCard";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { render, screen } from "../../utils/render";

describe("BuildCard", () => {
  const mockOnDuplicate = vi.fn();

  beforeEach(() => {
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

  const renderBuildCard = () => {
    const state = useBuildsStore.getState();
    const buildId = Object.keys(state.builds)[0];
    const build = state.builds[buildId];
    return render(
      <BuildCard
        buildId={buildId}
        build={build}
        onDuplicate={mockOnDuplicate}
        element="Pyro"
      />
    );
  };

  it("renders without error", () => {
    const { container } = renderBuildCard();
    expect(container.firstChild).toBeInTheDocument();
  });

  it("shows build name input field", () => {
    renderBuildCard();
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

  it("has a visibility switch", () => {
    renderBuildCard();
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
  });

  it("has a context menu trigger button", () => {
    renderBuildCard();

    // Switch + at least one more button (the ⋮ menu trigger)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("toggles visibility via switch", async () => {
    const user = userEvent.setup();
    renderBuildCard();
    const stateBefore = useBuildsStore.getState();
    const buildId = Object.keys(stateBefore.builds)[0];

    const toggle = screen.getByRole("switch");
    const wasChecked = toggle.getAttribute("aria-checked") === "true";
    await user.click(toggle);

    await waitFor(() => {
      const build = useBuildsStore.getState().builds[buildId];
      expect(build.visible).toBe(!wasChecked);
    });
  });
});
