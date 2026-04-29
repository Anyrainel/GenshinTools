import { beforeEach, describe, expect, it } from "vitest";
import { handleAccountSwitch } from "@/stores/storeEffects";
import { useTierStore } from "@/stores/useTierStore";

beforeEach(() => {
  useTierStore.setState({
    tierLists: {
      0: {
        id: 0,
        tierAssignments: {},
        tierCustomization: {},
        customTitle: "List A",
        author: "",
        description: "",
        linkedAccountId: 800000001,
      },
      1: {
        id: 1,
        tierAssignments: {},
        tierCustomization: {},
        customTitle: "List B",
        author: "",
        description: "",
        linkedAccountId: 800000002,
      },
      2: {
        id: 2,
        tierAssignments: {},
        tierCustomization: {},
        customTitle: "Unlinked",
        author: "",
        description: "",
        linkedAccountId: null,
      },
    },
    activeTierListId: 0,
    nextId: 3,
    // Derived fields from active list (id 0)
    tierAssignments: {},
    tierCustomization: {},
    customTitle: "List A",
    author: "",
    description: "",
  });
});

describe("handleAccountSwitch", () => {
  it("switches to linked tier list when account changes", () => {
    handleAccountSwitch(800000002);
    expect(useTierStore.getState().activeTierListId).toBe(1);
  });

  it("does nothing when account has no linked tier list", () => {
    handleAccountSwitch(999999999);
    expect(useTierStore.getState().activeTierListId).toBe(0);
  });

  it("does nothing when accountId is null", () => {
    handleAccountSwitch(null);
    expect(useTierStore.getState().activeTierListId).toBe(0);
  });
});
