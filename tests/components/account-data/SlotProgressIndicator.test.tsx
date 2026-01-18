import { SlotProgressIndicator } from "@/components/account-data/SlotProgressIndicator";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../utils/render";

describe("SlotProgressIndicator", () => {
  describe("progress bar mode", () => {
    it("renders progress bar when main stat is correct", () => {
      const { container } = render(
        <SlotProgressIndicator
          slot="sands"
          actualScore={8.0}
          maxScore={10.0}
          isMainStatWrong={false}
        />
      );

      // Should have a progress bar div with dynamic width
      const progressBar = container.querySelector("[style]");
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: "80%" });
    });

    it("caps progress at 100%", () => {
      const { container } = render(
        <SlotProgressIndicator
          slot="sands"
          actualScore={15.0}
          maxScore={10.0}
          isMainStatWrong={false}
        />
      );

      const progressBar = container.querySelector("[style]");
      expect(progressBar).toHaveStyle({ width: "100%" });
    });

    it("shows 0% for zero max score", () => {
      const { container } = render(
        <SlotProgressIndicator
          slot="sands"
          actualScore={5.0}
          maxScore={0}
          isMainStatWrong={false}
        />
      );

      const progressBar = container.querySelector("[style]");
      expect(progressBar).toHaveStyle({ width: "0%" });
    });

    it("applies green color for high scores", () => {
      const { container } = render(
        <SlotProgressIndicator
          slot="sands"
          actualScore={9.5}
          maxScore={10.0}
          isMainStatWrong={false}
        />
      );

      const progressBar = container.querySelector("[style]");
      expect(progressBar).toHaveClass("bg-emerald-600");
    });

    it("applies red color for low scores", () => {
      const { container } = render(
        <SlotProgressIndicator
          slot="sands"
          actualScore={3.0}
          maxScore={10.0}
          isMainStatWrong={false}
        />
      );

      const progressBar = container.querySelector("[style]");
      expect(progressBar).toHaveClass("bg-red-500");
    });
  });

  describe("warning mode", () => {
    it("shows warning icon when main stat is wrong", () => {
      const { container } = render(
        <SlotProgressIndicator
          slot="sands"
          actualScore={8.0}
          maxScore={10.0}
          isMainStatWrong={true}
        />
      );

      // Should show warning icon (Lucide AlertTriangle has specific SVG class)
      const warningIcon = container.querySelector(".lucide-triangle-alert");
      expect(warningIcon).toBeInTheDocument();
    });

    it("has amber color for warning icon", () => {
      const { container } = render(
        <SlotProgressIndicator
          slot="sands"
          actualScore={8.0}
          maxScore={10.0}
          isMainStatWrong={true}
        />
      );

      const warningIcon = container.querySelector(".text-amber-500\\/80");
      expect(warningIcon).toBeInTheDocument();
    });
  });
});
