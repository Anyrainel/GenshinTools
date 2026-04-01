import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GreetingState {
  onboardingCompleted: boolean;
  lastSeenUpdate: string | null;

  completeOnboarding: (latestDate: string) => void;
  dismissNews: (date: string) => void;
}

export const useGreetingStore = create<GreetingState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      lastSeenUpdate: null,

      completeOnboarding: (latestDate) =>
        set({ onboardingCompleted: true, lastSeenUpdate: latestDate }),

      dismissNews: (date) => set({ lastSeenUpdate: date }),
    }),
    {
      name: "greeting-storage",
      version: 1,
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
        lastSeenUpdate: state.lastSeenUpdate,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as object),
      }),
    }
  )
);
