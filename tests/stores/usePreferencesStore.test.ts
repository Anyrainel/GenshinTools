import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  usePreferencesStore.setState({
    characterSort: { tierSort: "desc", releaseSort: "desc", scoreSort: "off" },
  });
});

describe("usePreferencesStore", () => {
  describe("initial state", () => {
    it("has default character sort preferences", () => {
      const state = usePreferencesStore.getState();
      expect(state.characterSort.tierSort).toBe("desc");
      expect(state.characterSort.releaseSort).toBe("desc");
    });
  });

  describe("setCharacterSort", () => {
    it("updates tierSort only when partial sort provided", () => {
      act(() => {
        usePreferencesStore.getState().setCharacterSort({ tierSort: "asc" });
      });
      const state = usePreferencesStore.getState();
      expect(state.characterSort.tierSort).toBe("asc");
      expect(state.characterSort.releaseSort).toBe("desc");
    });

    it("updates releaseSort only when partial sort provided", () => {
      act(() => {
        usePreferencesStore.getState().setCharacterSort({
          releaseSort: "asc",
        });
      });
      const state = usePreferencesStore.getState();
      expect(state.characterSort.tierSort).toBe("desc");
      expect(state.characterSort.releaseSort).toBe("asc");
    });

    it("updates both when both provided", () => {
      act(() => {
        usePreferencesStore.getState().setCharacterSort({
          tierSort: "asc",
          releaseSort: "asc",
        });
      });
      const state = usePreferencesStore.getState();
      expect(state.characterSort.tierSort).toBe("asc");
      expect(state.characterSort.releaseSort).toBe("asc");
    });
  });
});
