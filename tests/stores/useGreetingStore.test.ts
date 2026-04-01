import { useGreetingStore } from "@/stores/useGreetingStore";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useGreetingStore.setState({
    onboardingCompleted: false,
    lastSeenUpdate: null,
  });
});

describe("useGreetingStore", () => {
  describe("initial state", () => {
    it("starts with onboarding not completed", () => {
      const state = useGreetingStore.getState();
      expect(state.onboardingCompleted).toBe(false);
      expect(state.lastSeenUpdate).toBeNull();
    });
  });

  describe("completeOnboarding", () => {
    it("sets onboardingCompleted and lastSeenUpdate", () => {
      act(() => {
        useGreetingStore.getState().completeOnboarding("2025-03-31");
      });
      const state = useGreetingStore.getState();
      expect(state.onboardingCompleted).toBe(true);
      expect(state.lastSeenUpdate).toBe("2025-03-31");
    });
  });

  describe("dismissNews", () => {
    it("updates lastSeenUpdate without changing onboardingCompleted", () => {
      act(() => {
        useGreetingStore.getState().completeOnboarding("2025-03-29");
      });
      act(() => {
        useGreetingStore.getState().dismissNews("2025-03-31");
      });
      const state = useGreetingStore.getState();
      expect(state.onboardingCompleted).toBe(true);
      expect(state.lastSeenUpdate).toBe("2025-03-31");
    });
  });
});
