import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGreetingStore } from "@/stores/useGreetingStore";

beforeEach(() => {
  useGreetingStore.setState({
    onboardingCompleted: false,
    lastSeenUpdate: null,
  });
});

describe("useGreetingStore", () => {
  it("completeOnboarding sets both flags, dismissNews only updates lastSeen", () => {
    act(() => {
      useGreetingStore.getState().completeOnboarding("2025-03-29");
    });
    let state = useGreetingStore.getState();
    expect(state.onboardingCompleted).toBe(true);
    expect(state.lastSeenUpdate).toBe("2025-03-29");

    act(() => {
      useGreetingStore.getState().dismissNews("2025-03-31");
    });
    state = useGreetingStore.getState();
    expect(state.onboardingCompleted).toBe(true);
    expect(state.lastSeenUpdate).toBe("2025-03-31");
  });
});
