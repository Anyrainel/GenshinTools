import type { Tier } from "@/data/enums";
import type { TierAssignment } from "@/data/types";
import { DEFAULT_INVESTMENT_THRESHOLDS } from "@/stores/useTierStore";
import {
  type TierListInstance,
  migrateTierStore,
  useTierStore,
} from "@/stores/useTierStore";
import { beforeEach, describe, expect, it } from "vitest";

// Reset store before each test — create a fresh default state
beforeEach(() => {
  const defaultInstance: TierListInstance = {
    id: 1,
    tierAssignments: {},
    tierCustomization: {},
    customTitle: "",
    author: "",
    description: "",
    linkedAccountId: null,
  };
  useTierStore.setState({
    tierLists: { 1: defaultInstance },
    activeTierListId: 1,
    nextId: 2,
    showWeapons: true,
    showTravelers: false,
    showManekin: false,
    investmentThresholds: { ...DEFAULT_INVESTMENT_THRESHOLDS },
    tierAssignments: {},
    tierCustomization: {},
    customTitle: "",
    author: "",
    description: "",
  });
});

describe("useTierStore", () => {
  // Initial state
  describe("initial state", () => {
    it("starts with one default list", () => {
      const state = useTierStore.getState();
      const ids = Object.keys(state.tierLists).map(Number);
      expect(ids).toEqual([1]);
      expect(state.activeTierListId).toBe(1);
      expect(state.nextId).toBe(2);
    });

    it("starts with empty tier assignments", () => {
      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual({});
    });

    it("starts with empty tier customization", () => {
      const state = useTierStore.getState();
      expect(state.tierCustomization).toEqual({});
    });

    it("has default visibility settings", () => {
      const state = useTierStore.getState();
      expect(state.showWeapons).toBe(true);
      expect(state.showTravelers).toBe(false);
      expect(state.showManekin).toBe(false);
    });

    it("has empty metadata", () => {
      const state = useTierStore.getState();
      expect(state.author).toBe("");
      expect(state.description).toBe("");
      expect(state.customTitle).toBe("");
    });

    it("has default investment thresholds", () => {
      const state = useTierStore.getState();
      expect(state.investmentThresholds).toEqual(DEFAULT_INVESTMENT_THRESHOLDS);
    });
  });

  // Backward-compatible selectors
  describe("backward-compatible selectors", () => {
    it("top-level tierAssignments reflects active list", () => {
      const assignments: TierAssignment = {
        venti: { tier: "S", position: 0 },
      };
      useTierStore.getState().setTierAssignments(assignments);

      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual(assignments);
      expect(state.tierLists[state.activeTierListId].tierAssignments).toEqual(
        assignments
      );
    });

    it("top-level customTitle reflects active list", () => {
      useTierStore.getState().setCustomTitle("My List");
      const state = useTierStore.getState();
      expect(state.customTitle).toBe("My List");
      expect(state.tierLists[state.activeTierListId].customTitle).toBe(
        "My List"
      );
    });

    it("switching active list updates top-level selectors", () => {
      // Set data on list 1
      useTierStore.getState().setCustomTitle("List One");
      useTierStore.getState().setTierAssignments({
        venti: { tier: "S", position: 0 },
      });

      // Create list 2
      const id2 = useTierStore.getState().createTierList("List Two");

      // Top-level should now reflect list 2
      let state = useTierStore.getState();
      expect(state.customTitle).toBe("List Two");
      expect(state.tierAssignments).toEqual({});

      // Switch back to list 1
      useTierStore.getState().setActiveTierList(1);
      state = useTierStore.getState();
      expect(state.customTitle).toBe("List One");
      expect(state.tierAssignments).toEqual({
        venti: { tier: "S", position: 0 },
      });
    });
  });

  // Mutators on active list
  describe("setTierAssignments", () => {
    it("sets tier assignments directly", () => {
      const assignments: TierAssignment = {
        kaedehara_kazuha: { tier: "S", position: 0 },
        venti: { tier: "A", position: 0 },
      };

      useTierStore.getState().setTierAssignments(assignments);

      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual(assignments);
    });

    it("supports function updater", () => {
      useTierStore.getState().setTierAssignments({
        venti: { tier: "S", position: 0 },
      });

      useTierStore.getState().setTierAssignments((prev: TierAssignment) => ({
        ...prev,
        kaedehara_kazuha: { tier: "S", position: 1 },
      }));

      const state = useTierStore.getState();
      expect(state.tierAssignments.venti).toEqual({ tier: "S", position: 0 });
      expect(state.tierAssignments.kaedehara_kazuha).toEqual({
        tier: "S",
        position: 1,
      });
    });
  });

  describe("setTierCustomization", () => {
    it("sets tier customization", () => {
      const customization = {
        S: { displayName: "God Tier", hidden: false },
        D: { displayName: "Skip", hidden: true },
      };

      useTierStore.getState().setTierCustomization(customization);

      const state = useTierStore.getState();
      expect(state.tierCustomization).toEqual(customization);
    });
  });

  describe("setCustomTitle", () => {
    it("sets custom title", () => {
      useTierStore.getState().setCustomTitle("My Tier List");

      const state = useTierStore.getState();
      expect(state.customTitle).toBe("My Tier List");
    });
  });

  describe("visibility toggles", () => {
    it("sets showWeapons", () => {
      useTierStore.getState().setShowWeapons(false);
      expect(useTierStore.getState().showWeapons).toBe(false);

      useTierStore.getState().setShowWeapons(true);
      expect(useTierStore.getState().showWeapons).toBe(true);
    });

    it("sets showTravelers", () => {
      useTierStore.getState().setShowTravelers(true);
      expect(useTierStore.getState().showTravelers).toBe(true);

      useTierStore.getState().setShowTravelers(false);
      expect(useTierStore.getState().showTravelers).toBe(false);
    });

    it("sets showManekin", () => {
      useTierStore.getState().setShowManekin(true);
      expect(useTierStore.getState().showManekin).toBe(true);

      useTierStore.getState().setShowManekin(false);
      expect(useTierStore.getState().showManekin).toBe(false);
    });
  });

  describe("resetTierList", () => {
    it("clears tier assignments and metadata", () => {
      useTierStore.getState().setTierAssignments({
        venti: { tier: "S", position: 0 },
      });
      useTierStore.getState().setCustomTitle("Test Title");
      useTierStore.getState().setMetadata("Author", "Description");

      useTierStore.getState().resetTierList();

      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual({});
      expect(state.tierCustomization).toEqual({});
      expect(state.customTitle).toBe("");
      expect(state.author).toBe("");
      expect(state.description).toBe("");
    });

    it("only resets the active list", () => {
      useTierStore.getState().setCustomTitle("List One Data");
      const id2 = useTierStore.getState().createTierList("List Two");
      useTierStore.getState().setCustomTitle("List Two Data");

      // Reset list 2
      useTierStore.getState().resetTierList();
      expect(useTierStore.getState().customTitle).toBe("");

      // List 1 is untouched
      useTierStore.getState().setActiveTierList(1);
      expect(useTierStore.getState().customTitle).toBe("List One Data");
    });
  });

  describe("loadTierListData", () => {
    it("loads complete tier list data", () => {
      const data = {
        tierAssignments: { venti: { tier: "S" as Tier, position: 0 } },
        tierCustomization: { S: { displayName: "Best", hidden: false } },
        customTitle: "Imported List",
        author: "Test Author",
        description: "Test Description",
      };

      useTierStore.getState().loadTierListData(data);

      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual(data.tierAssignments);
      expect(state.tierCustomization).toEqual(data.tierCustomization);
      expect(state.customTitle).toBe("Imported List");
      expect(state.author).toBe("Test Author");
      expect(state.description).toBe("Test Description");
    });

    it("handles missing optional fields", () => {
      const data = {
        tierAssignments: { venti: { tier: "S" as Tier, position: 0 } },
        tierCustomization: {},
      };

      useTierStore.getState().loadTierListData(data);

      const state = useTierStore.getState();
      expect(state.tierAssignments).toEqual(data.tierAssignments);
      expect(state.customTitle).toBe("");
      expect(state.author).toBe("");
      expect(state.description).toBe("");
    });
  });

  describe("setMetadata", () => {
    it("sets author and description", () => {
      useTierStore.getState().setMetadata("Test Author", "Test Description");

      const state = useTierStore.getState();
      expect(state.author).toBe("Test Author");
      expect(state.description).toBe("Test Description");
    });
  });

  describe("setTierLuckExpectation", () => {
    it("sets luck expectation on a tier", () => {
      useTierStore.getState().setTierLuckExpectation("S", "hopeful");

      const state = useTierStore.getState();
      expect(state.tierCustomization.S).toEqual({
        displayName: "S",
        hidden: false,
        luckExpectation: "hopeful",
      });
    });

    it("preserves existing tier customization fields", () => {
      useTierStore.getState().setTierCustomization({
        S: { displayName: "God Tier", hidden: false },
      });
      useTierStore.getState().setTierLuckExpectation("S", "cautious");

      const state = useTierStore.getState();
      expect(state.tierCustomization.S).toEqual({
        displayName: "God Tier",
        hidden: false,
        luckExpectation: "cautious",
      });
    });
  });

  describe("setInvestmentThreshold", () => {
    it("updates a single threshold key", () => {
      useTierStore.getState().setInvestmentThreshold("swap", 5);
      const state = useTierStore.getState();
      expect(state.investmentThresholds.swap).toBe(5);
      expect(state.investmentThresholds.upgrade).toBe(
        DEFAULT_INVESTMENT_THRESHOLDS.upgrade
      );
    });
  });

  // CRUD operations
  describe("createTierList", () => {
    it("creates a new list and switches to it", () => {
      const newId = useTierStore.getState().createTierList("New List");

      const state = useTierStore.getState();
      expect(newId).toBe(2);
      expect(state.activeTierListId).toBe(2);
      expect(state.tierLists[2]).toBeDefined();
      expect(state.tierLists[2].customTitle).toBe("New List");
      expect(state.nextId).toBe(3);
    });

    it("creates list with empty title by default", () => {
      const newId = useTierStore.getState().createTierList();

      const state = useTierStore.getState();
      expect(state.tierLists[newId].customTitle).toBe("");
    });

    it("increments nextId for each new list", () => {
      useTierStore.getState().createTierList("A");
      useTierStore.getState().createTierList("B");

      const state = useTierStore.getState();
      expect(state.nextId).toBe(4);
      expect(Object.keys(state.tierLists)).toHaveLength(3);
    });
  });

  describe("deleteTierList", () => {
    it("deletes a list and switches active if needed", () => {
      useTierStore.getState().createTierList("Second");

      // Delete active list (id=2)
      useTierStore.getState().deleteTierList(2);

      const state = useTierStore.getState();
      expect(state.tierLists[2]).toBeUndefined();
      expect(state.activeTierListId).toBe(1);
      expect(state.customTitle).toBe(""); // back to list 1
    });

    it("refuses to delete the last list", () => {
      useTierStore.getState().deleteTierList(1);

      const state = useTierStore.getState();
      expect(state.tierLists[1]).toBeDefined();
      expect(Object.keys(state.tierLists)).toHaveLength(1);
    });

    it("does not switch active if deleting a non-active list", () => {
      useTierStore.getState().createTierList("Second");
      useTierStore.getState().setActiveTierList(1);

      // Delete list 2 while list 1 is active
      useTierStore.getState().deleteTierList(2);

      const state = useTierStore.getState();
      expect(state.activeTierListId).toBe(1);
      expect(state.tierLists[2]).toBeUndefined();
    });
  });

  describe("setActiveTierList", () => {
    it("switches active list and updates derived fields", () => {
      useTierStore.getState().setCustomTitle("List One");
      useTierStore.getState().createTierList("List Two");

      useTierStore.getState().setActiveTierList(1);
      expect(useTierStore.getState().customTitle).toBe("List One");

      useTierStore.getState().setActiveTierList(2);
      expect(useTierStore.getState().customTitle).toBe("List Two");
    });

    it("does nothing for non-existent id", () => {
      useTierStore.getState().setActiveTierList(999);
      expect(useTierStore.getState().activeTierListId).toBe(1);
    });
  });

  describe("renameTierList", () => {
    it("renames a specific list", () => {
      useTierStore.getState().renameTierList(1, "Renamed");

      const state = useTierStore.getState();
      expect(state.tierLists[1].customTitle).toBe("Renamed");
      // Since list 1 is active, top-level should also update
      expect(state.customTitle).toBe("Renamed");
    });

    it("renames a non-active list without affecting top-level", () => {
      useTierStore.getState().createTierList("Second");
      // Active is now 2

      useTierStore.getState().renameTierList(1, "Renamed One");

      const state = useTierStore.getState();
      expect(state.tierLists[1].customTitle).toBe("Renamed One");
      expect(state.customTitle).toBe("Second"); // still the active list's title
    });

    it("does nothing for non-existent id", () => {
      useTierStore.getState().renameTierList(999, "Nope");
      // no crash, state unchanged
      expect(useTierStore.getState().tierLists[999]).toBeUndefined();
    });
  });

  // Account linking
  describe("linkAccount", () => {
    it("links an account to a tier list", () => {
      useTierStore.getState().linkAccount(1, "account-abc");

      const state = useTierStore.getState();
      expect(state.tierLists[1].linkedAccountId).toBe("account-abc");
    });

    it("unlinks from other lists when reassigning", () => {
      useTierStore.getState().createTierList("Second");

      useTierStore.getState().linkAccount(1, "account-abc");
      expect(useTierStore.getState().tierLists[1].linkedAccountId).toBe(
        "account-abc"
      );

      // Link same account to list 2 — should unlink from list 1
      useTierStore.getState().linkAccount(2, "account-abc");

      const state = useTierStore.getState();
      expect(state.tierLists[1].linkedAccountId).toBeNull();
      expect(state.tierLists[2].linkedAccountId).toBe("account-abc");
    });

    it("can unlink by passing null", () => {
      useTierStore.getState().linkAccount(1, "account-abc");
      useTierStore.getState().linkAccount(1, null);

      expect(useTierStore.getState().tierLists[1].linkedAccountId).toBeNull();
    });

    it("does nothing for non-existent tier list", () => {
      useTierStore.getState().linkAccount(999, "account-abc");
      // no crash
      expect(useTierStore.getState().tierLists[999]).toBeUndefined();
    });
  });

  describe("findTierListByAccount", () => {
    it("finds a tier list linked to an account", () => {
      useTierStore.getState().linkAccount(1, "account-abc");

      const result = useTierStore
        .getState()
        .findTierListByAccount("account-abc");
      expect(result).toBe(1);
    });

    it("returns null when no list is linked", () => {
      const result = useTierStore
        .getState()
        .findTierListByAccount("nonexistent");
      expect(result).toBeNull();
    });
  });

  // Migration
  describe("migrateTierStore", () => {
    it("migrates v0 flat format to v1 multi-instance", () => {
      const v0State = {
        tierAssignments: { venti: { tier: "S", position: 0 } },
        tierCustomization: { S: { displayName: "Best", hidden: false } },
        customTitle: "Old List",
        author: "Author",
        description: "Desc",
        showWeapons: false,
        showTravelers: true,
        showManekin: true,
        investmentThresholds: { swap: 2, upgrade: 4, reroll: 8, farm: 6 },
      };

      const result = migrateTierStore(v0State, 0);

      expect(result.activeTierListId).toBe(1);
      expect(result.nextId).toBe(2);
      expect(result.showWeapons).toBe(false);
      expect(result.showTravelers).toBe(true);
      expect(result.showManekin).toBe(true);
      expect(result.investmentThresholds).toEqual(v0State.investmentThresholds);

      const tierLists = result.tierLists as Record<number, TierListInstance>;
      expect(tierLists[1]).toBeDefined();
      expect(tierLists[1].id).toBe(1);
      expect(tierLists[1].tierAssignments).toEqual(v0State.tierAssignments);
      expect(tierLists[1].tierCustomization).toEqual(v0State.tierCustomization);
      expect(tierLists[1].customTitle).toBe("Old List");
      expect(tierLists[1].author).toBe("Author");
      expect(tierLists[1].description).toBe("Desc");
      expect(tierLists[1].linkedAccountId).toBeNull();

      // Derived fields should also be present
      expect(result.tierAssignments).toEqual(v0State.tierAssignments);
      expect(result.customTitle).toBe("Old List");
    });

    it("handles v0 with missing fields", () => {
      const result = migrateTierStore({}, 0);

      const tierLists = result.tierLists as Record<number, TierListInstance>;
      expect(tierLists[1].tierAssignments).toEqual({});
      expect(tierLists[1].customTitle).toBe("");
      expect(result.showWeapons).toBe(true);
      expect(result.showTravelers).toBe(false);
      expect(result.investmentThresholds).toEqual(
        DEFAULT_INVESTMENT_THRESHOLDS
      );
    });

    it("handles null persisted state for v0", () => {
      const result = migrateTierStore(null, 0);

      const tierLists = result.tierLists as Record<number, TierListInstance>;
      expect(tierLists[1]).toBeDefined();
      expect(tierLists[1].tierAssignments).toEqual({});
    });

    it("passes through v1 state unchanged", () => {
      const v1State = {
        tierLists: { 1: { id: 1, customTitle: "Already v1" } },
        activeTierListId: 1,
        nextId: 2,
      };

      const result = migrateTierStore(v1State, 1);
      expect(result).toBe(v1State); // same reference
    });
  });
});
