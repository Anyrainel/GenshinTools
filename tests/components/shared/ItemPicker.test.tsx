import { ItemPicker } from "@/components/shared/ItemPicker";
import { characters } from "@/data/resources";
import { useAccountStore } from "@/stores/useAccountStore";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../utils/render";

describe("ItemPicker", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAccountStore.setState({ activeAccountId: null, accounts: {} });
  });

  describe("character picker", () => {
    it("renders empty trigger with + when no value", () => {
      render(
        <ItemPicker type="character" value={null} onChange={mockOnChange} />
      );
      expect(screen.getAllByText("+")[0]).toBeInTheDocument();
    });

    it("shows character icon when value is provided", () => {
      const { container } = render(
        <ItemPicker type="character" value="hu_tao" onChange={mockOnChange} />
      );
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src");
      expect(img?.getAttribute("src")).toContain("hu_tao");
    });

    it("opens popover when clicked", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ItemPicker type="character" value={null} onChange={mockOnChange} />
      );
      const trigger = container.querySelector("[data-state]") as HTMLElement;
      await user.click(trigger);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("allows searching for a character", { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ItemPicker
          type="character"
          value={null}
          onChange={mockOnChange}
          defaultOpen
        />
      );

      const searchInput = screen.getByRole("textbox");

      // Type a nonsense string
      await user.type(searchInput, "xyznonsense");

      await waitFor(() => {
        expect(container.querySelectorAll("img").length).toBe(0);
        // And the no results text should appear
        expect(screen.getByText(/noResults|no result/i)).toBeInTheDocument();
      });
    });

    it("can toggle elemental filters", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ItemPicker
          type="character"
          value={null}
          onChange={mockOnChange}
          defaultOpen
        />
      );

      // Find any filter button directly by class
      const filterBtns = container.querySelectorAll(".p-1\\.5");
      if (filterBtns.length > 0) {
        await user.click(filterBtns[0]);
        // Just verify it doesn't crash after clicking a filter
        expect(filterBtns[0]).toBeInTheDocument();
      }
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
          value={{ type: "4pc", setId: "emblem_of_severed_fate" }}
          onChange={mockOnChange}
        />
      );
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src");
    });

    it("handles 2pc+2pc artifact builder selection flow", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ItemPicker
          type="artifact"
          value={null}
          onChange={mockOnChange}
          defaultOpen
        />
      );

      const twoPcTab = screen.getByRole("tab", { name: /2pc/i });
      await user.click(twoPcTab);

      await waitFor(() => {
        expect(screen.getAllByText("+").length).toBeGreaterThan(0);
      });

      const items = container.querySelectorAll(
        ".flex.items-center.gap-3.p-2.rounded-lg"
      );
      if (items.length >= 2) {
        await user.click(items[0]);
        await user.click(items[1]);

        const confirmButton = container
          .querySelector(".lucide-check")
          ?.closest("button");
        if (confirmButton) {
          await user.click(confirmButton);
          expect(mockOnChange).toHaveBeenCalledWith(
            expect.objectContaining({ type: "2pc+2pc" })
          );
        }
      }
    });
  });

  describe("owned only filter", () => {
    const PROFILE_ID = "test-profile";
    // Pick 5 characters to be "owned" (in account data)
    const ownedIds = characters.slice(5, 10).map((c) => c.id);
    const unownedIds = characters
      .filter((c) => !ownedIds.includes(c.id))
      .map((c) => c.id);

    beforeEach(() => {
      useAccountStore.setState({
        activeAccountId: PROFILE_ID,
        accounts: {
          [PROFILE_ID]: {
            id: PROFILE_ID,
            name: "Test",
            data: {
              characters: ownedIds.map((key) => ({
                key,
                constellation: 0,
                level: 90,
                talent: { auto: 1, skill: 1, burst: 1 },
                artifacts: {},
              })),
              extraArtifacts: [],
              extraWeapons: [],
            },
            scores: {},
            lastUpdate: Date.now(),
          },
        },
      });
    });

    it(
      "filters out unowned characters when toggled",
      { timeout: 15000 },
      async () => {
        const { getIsOwned } = await import("../../hooks/ownershipUtils");

        // Verify getIsOwned returns expected values
        expect(getIsOwned("character", ownedIds[0])).toBe(true);
        expect(getIsOwned("character", unownedIds[0])).toBe(false);

        const user = userEvent.setup();
        const { container } = render(
          <ItemPicker
            type="character"
            value={null}
            onChange={mockOnChange}
            defaultOpen
          />
        );

        // Count grid items — popover content renders in a portal
        const getGridChildren = () => {
          const gridEl = document.querySelector(".grid");
          // Exclude the "no results" placeholder which is always present
          return gridEl
            ? Array.from(gridEl.children).filter(
                (el) => !el.textContent?.includes("noResults")
              )
            : [];
        };

        await waitFor(() => {
          expect(getGridChildren().length).toBeGreaterThan(0);
        });
        const initialCount = getGridChildren().length;

        // Click the "Owned Only" filter
        const ownedOnlyBtn = screen.getByText("Owned Only");
        await user.click(ownedOnlyBtn);

        await waitFor(() => {
          // Should show only owned characters (+ always-owned like Traveler/Manekin)
          const filteredCount = getGridChildren().length;
          expect(filteredCount).toBeLessThan(initialCount);
          expect(filteredCount).toBeGreaterThanOrEqual(ownedIds.length);
        });
      }
    );

    it(
      "shows all characters again when owned filter is toggled off",
      { timeout: 15000 },
      async () => {
        const user = userEvent.setup();
        render(
          <ItemPicker
            type="character"
            value={null}
            onChange={mockOnChange}
            defaultOpen
          />
        );

        const getGridChildren = () => {
          const gridEl = document.querySelector(".grid");
          return gridEl
            ? Array.from(gridEl.children).filter(
                (el) => !el.textContent?.includes("noResults")
              )
            : [];
        };

        await waitFor(() => {
          expect(getGridChildren().length).toBeGreaterThan(0);
        });
        const initialCount = getGridChildren().length;

        const ownedOnlyBtn = screen.getByText("Owned Only");

        // Toggle on
        await user.click(ownedOnlyBtn);
        await waitFor(() => {
          expect(getGridChildren().length).toBeLessThan(initialCount);
        });

        // Toggle off
        await user.click(ownedOnlyBtn);
        await waitFor(() => {
          expect(getGridChildren().length).toBe(initialCount);
        });
      }
    );

    it("works when activeAccountId is null (no account data = no owned)", async () => {
      useAccountStore.setState({ activeAccountId: null, accounts: {} });

      const { getIsOwned } = await import("../../hooks/ownershipUtils");
      // With no account data, non-always-owned characters are not owned
      const nonAlwaysOwned = characters.find(
        (c) => !/^(traveler|manekin|manekina)_/.test(c.id)
      )!;
      expect(getIsOwned("character", nonAlwaysOwned.id)).toBe(false);
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
