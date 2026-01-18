import { ItemPicker } from "@/components/shared/ItemPicker";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../utils/render";

describe("ItemPicker", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("character picker", () => {
    it("renders empty trigger with + when no value", () => {
      const { container } = render(
        <ItemPicker type="character" value={null} onChange={mockOnChange} />
      );

      // Empty trigger shows "+" text
      expect(screen.getByText("+")).toBeInTheDocument();
    });

    it("shows character icon when value is provided", () => {
      const { container } = render(
        <ItemPicker type="character" value="hu_tao" onChange={mockOnChange} />
      );

      // Should render an image for the selected character
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src");
      expect(img?.getAttribute("src")).toContain("hu_tao");
    });

    it("opens popover when clicked", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ItemPicker type="character" value={null} onChange={mockOnChange} />
      );

      // Click the trigger div (containing the +)
      const trigger = container.querySelector("[data-state]") as HTMLElement;
      await user.click(trigger);

      // Search input should appear
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("weapon picker", () => {
    it("shows weapon icon when value is provided", () => {
      const { container } = render(
        <ItemPicker
          type="weapon"
          value="staff_of_homa"
          onChange={mockOnChange}
        />
      );

      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src");
      expect(img?.getAttribute("src")).toContain("staff_of_homa");
    });
  });

  describe("artifact picker", () => {
    it("shows artifact icon when value is provided", () => {
      const { container } = render(
        <ItemPicker
          type="artifact"
          value="emblem_of_severed_fate"
          onChange={mockOnChange}
        />
      );

      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src");
    });
  });

  describe("common behavior", () => {
    it("applies opacity when disabled", () => {
      const { container } = render(
        <ItemPicker
          type="character"
          value={null}
          onChange={mockOnChange}
          disabled
        />
      );

      // Disabled picker has opacity-50 class on the trigger div
      const triggerDiv = container.querySelector(".opacity-50");
      expect(triggerDiv).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <ItemPicker
          type="character"
          value={null}
          onChange={mockOnChange}
          className="custom-picker-class"
        />
      );

      const element = container.querySelector(".custom-picker-class");
      expect(element).toBeInTheDocument();
    });
  });
});
