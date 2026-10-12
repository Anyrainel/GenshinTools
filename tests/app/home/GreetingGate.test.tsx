import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GreetingGate } from "@/app/home/GreetingGate";
import { useAccountStore } from "@/stores/useAccountStore";
import { useGreetingStore } from "@/stores/useGreetingStore";
import { render } from "../../utils/render";

vi.mock("@/app/home/WelcomeGuide", () => ({
  default: () => <p>First-use tutorial</p>,
}));
vi.mock("@/app/home/NewsDialog", () => ({
  default: () => <p>Latest updates</p>,
}));

beforeEach(() => {
  localStorage.setItem("app_language", "en");
  useAccountStore.getState().clearAccounts();
  useGreetingStore.setState({
    onboardingCompleted: false,
    lastSeenUpdate: null,
  });
});

describe("greeting gate", () => {
  it("shows the tutorial for a first-time user without accounts", async () => {
    render(<GreetingGate />);
    expect(await screen.findByText("First-use tutorial")).toBeVisible();
  });

  it("remembers existing users after deleting the last account and reloading", async () => {
    localStorage.setItem(
      "greeting-storage",
      JSON.stringify({
        version: 1,
        state: { onboardingCompleted: false, lastSeenUpdate: "2025-03-29" },
      })
    );
    await useGreetingStore.persist.rehydrate();
    useAccountStore.getState().addOrUpdateAccount(123456789, {
      data: { characters: [], extraArtifacts: [], extraWeapons: [] },
    });
    const view = render(<GreetingGate />);
    expect(await screen.findByText("Latest updates")).toBeVisible();
    expect(useGreetingStore.getState().onboardingCompleted).toBe(true);
    expect(useGreetingStore.getState().lastSeenUpdate).toBe("2025-03-29");

    act(() => useAccountStore.getState().deleteAccount(123456789));
    expect(screen.queryByText("First-use tutorial")).not.toBeInTheDocument();
    view.unmount();
    const savedGreeting = localStorage.getItem("greeting-storage");
    expect(savedGreeting).not.toBeNull();
    useGreetingStore.setState({ onboardingCompleted: false });
    localStorage.setItem("greeting-storage", savedGreeting!);
    await useGreetingStore.persist.rehydrate();
    render(<GreetingGate />);
    expect(await screen.findByText("Latest updates")).toBeVisible();
    expect(screen.queryByText("First-use tutorial")).not.toBeInTheDocument();
    expect(useGreetingStore.getState().onboardingCompleted).toBe(true);
  });
});
