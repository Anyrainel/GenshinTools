import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePreferencesStore } from "@/stores/usePreferencesStore";

beforeEach(() => {
  usePreferencesStore.setState({
    characterSort: { tierSort: "desc", releaseSort: "desc", scoreSort: "off" },
  });
});

describe("usePreferencesStore", () => {
  it("patches character sort with merge semantics", () => {
    // Partial update preserves other fields
    act(() => {
      usePreferencesStore.getState().setCharacterSort({ tierSort: "asc" });
    });
    let state = usePreferencesStore.getState();
    expect(state.characterSort.tierSort).toBe("asc");
    expect(state.characterSort.releaseSort).toBe("desc");

    // Second partial update preserves first
    act(() => {
      usePreferencesStore.getState().setCharacterSort({ releaseSort: "asc" });
    });
    state = usePreferencesStore.getState();
    expect(state.characterSort.tierSort).toBe("asc");
    expect(state.characterSort.releaseSort).toBe("asc");
  });
});
