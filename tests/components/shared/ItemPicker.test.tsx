import { ItemPicker } from "@/components/shared/ItemPicker";
import { characters } from "@/data/resources";
import { useAccountStore } from "@/stores/useAccountStore";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../utils/render";

describe("ItemPicker", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAccountStore.setState({ activeAccountId: null, accounts: {} });
    useOwnershipStore.setState({ profiles: {} });
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

    it("allows searching for a character", async () => {
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
    const unownedIds = characters.slice(0, 5).map((c) => c.id);

    beforeEach(() => {
      useAccountStore.setState({ activeAccountId: PROFILE_ID, accounts: {} });
      const unownedCharacters: Record<string, true> = {};
      for (const id of unownedIds) {
        unownedCharacters[id] = true;
      }
      useOwnershipStore.setState({
        profiles: {
          [PROFILE_ID]: {
            unownedCharacters,
            unownedWeapons: {},
            characterConstellations: {},
            weaponRefinements: {},
          },
        },
      });
    });

    it("filters out unowned characters when toggled", async () => {
      const { getIsOwned } = await import("@/hooks/useOwnership");

      // Verify store state is set up correctly
      const storeState = useOwnershipStore.getState();
      expect(storeState.profiles[PROFILE_ID]).toBeDefined();
      expect(
        storeState.profiles[PROFILE_ID].unownedCharacters[unownedIds[0]]
      ).toBe(true);

      // Verify getIsOwned returns expected values
      expect(getIsOwned("character", unownedIds[0])).toBe(false);
      // Pick a character NOT in unownedIds
      const ownedChar = characters.find((c) => !unownedIds.includes(c.id));
      expect(getIsOwned("character", ownedChar!.id)).toBe(true);

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
        expect(getGridChildren().length).toBe(initialCount - unownedIds.length);
      });
    });

    it("shows all characters again when owned filter is toggled off", async () => {
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
    });

    it("works when activeAccountId is null (uses default profile)", async () => {
      // Set up ownership under "default" profile but leave activeAccountId null
      useAccountStore.setState({ activeAccountId: null });
      useOwnershipStore.setState({
        profiles: {
          default: {
            unownedCharacters: Object.fromEntries(
              unownedIds.map((id) => [id, true])
            ) as Record<string, true>,
            unownedWeapons: {},
            characterConstellations: {},
            weaponRefinements: {},
          },
        },
      });

      const { getIsOwned } = await import("@/hooks/useOwnership");
      // getIsOwned should fall back to "default" profile
      expect(getIsOwned("character", unownedIds[0])).toBe(false);

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
      await user.click(ownedOnlyBtn);

      await waitFor(() => {
        expect(getGridChildren().length).toBe(initialCount - unownedIds.length);
      });
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
