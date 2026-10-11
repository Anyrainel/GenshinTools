import { act, fireEvent, screen } from "@testing-library/react";
import { Gem, Users } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TabPreview } from "@/components/home/previews/TabPreview";
import WelcomeGuide from "@/components/home/WelcomeGuide";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGreetingStore } from "@/stores/useGreetingStore";
import { render } from "../../utils/render";

vi.mock("@/components/home/previews/AccountDataPreview", () => ({
  default: () => <p>Account example</p>,
}));
vi.mock("@/components/home/previews/BuildsPreview", () => ({
  default: () => <p>Build example</p>,
}));
vi.mock("@/components/home/previews/TeamCompPreview", () => ({
  default: () => <p>Team example</p>,
}));

beforeEach(() => {
  localStorage.setItem("app_language", "en");
  useGreetingStore.setState({
    onboardingCompleted: false,
    lastSeenUpdate: null,
  });
});

function Preview() {
  const { t } = useLanguage();
  return (
    <TabPreview
      t={t}
      tabs={[
        { id: "characters", icon: Users, label: "Characters" },
        { id: "inventory", icon: Gem, label: "Inventory" },
      ]}
      panels={[
        {
          content: <button type="button">Example control</button>,
          description: "Character description",
        },
        {
          content: <p>Inventory example</p>,
          description: "Inventory description",
        },
      ]}
    />
  );
}

describe("welcome guide", () => {
  it("navigates named chapters and marks onboarding complete only when dismissed", async () => {
    const onDismiss = vi.fn();
    render(<WelcomeGuide latestDate="2026-10-10" onDismiss={onDismiss} />);
    expect(await screen.findByText("Account example")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Team DMG" }));
    expect(await screen.findByText("Team example")).toBeVisible();
    expect(useGreetingStore.getState().onboardingCompleted).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Builds" }));
    expect(await screen.findByText("Build example")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Team example")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Let's Go!" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(useGreetingStore.getState().onboardingCompleted).toBe(true);
    expect(useGreetingStore.getState().lastSeenUpdate).toBe("2026-10-10");
  });

  it("keeps previews on the chosen tab and supports keyboard navigation", () => {
    vi.useFakeTimers();
    try {
      render(<Preview />);
      act(() => vi.advanceTimersByTime(12000));
      expect(screen.getByRole("tab", { name: "Characters" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      expect(screen.getByText("Example control").parentElement).toHaveProperty(
        "inert",
        true
      );
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Inventory" }), {
        button: 0,
        ctrlKey: false,
      });
      expect(screen.getByRole("tabpanel")).toHaveTextContent(
        "Inventory description"
      );
      act(() => vi.advanceTimersByTime(12000));
      expect(screen.getByRole("tab", { name: "Inventory" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      fireEvent.focus(screen.getByRole("tab", { name: "Inventory" }));
      fireEvent.keyDown(screen.getByRole("tab", { name: "Inventory" }), {
        key: "ArrowLeft",
      });
      act(() => vi.runOnlyPendingTimers());
      expect(screen.getByRole("tab", { name: "Characters" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
