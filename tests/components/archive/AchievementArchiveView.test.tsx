import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { achievementTextResource } from "@/data/gameDataLoader";
import type { AchievementData } from "@/data/types";
import { AchievementArchiveView } from "@/pages/archive/AchievementArchiveView";
import { useAccountStore } from "@/stores/useAccountStore";
import { useAchievementStore } from "@/stores/useAchievementStore";
import { render, screen, waitFor } from "../../utils/render";

vi.mock("@/contexts/LanguageContext", () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  useLanguage: () => ({
    language: "en",
    t: {
      ui: (key: string) =>
        (
          ({
            "archive.achievementCategories": "Achievement categories",
            "archive.achievementFinished": "Finished",
            "archive.achievementNeedsAccount":
              "Select an account to track achievement progress.",
            "archive.achievementSearchPlaceholder":
              "Search achievement names and descriptions...",
            "archive.achievementUnfinished": "Unfinished",
            "archive.loadingAchievements": "Loading achievements...",
            "archive.markAchievementFinished": "Mark {0} finished",
            "archive.markAchievementUnfinished": "Mark {0} unfinished",
            "archive.noAchievementResults":
              "No achievements match these filters",
            "archive.primogems": "Primogems",
            "archive.searchBilibili": "Search Bilibili for {0}",
            "archive.searchYouTube": "Search YouTube for {0}",
          }) as Record<string, string>
        )[key] ?? key,
      format: (key: string, ...args: (string | number)[]) => {
        const templates: Record<string, string> = {
          "archive.markAchievementFinished": "Mark {0} finished",
          "archive.markAchievementUnfinished": "Mark {0} unfinished",
          "archive.searchBilibili": "Search Bilibili for {0}",
          "archive.searchYouTube": "Search YouTube for {0}",
        };
        return (templates[key] ?? key).replace(/{(\d+)}/g, (_, index) =>
          String(args[Number(index)] ?? "")
        );
      },
    },
  }),
}));

const ACHIEVEMENT_DATA: AchievementData = {
  categories: [
    { id: 1, name: "Alpha Guild", order: 1 },
    { id: 2, name: "Beta League", order: 2 },
  ],
  achievements: [
    {
      id: 101,
      name: "Apple Hunter I",
      description: "Pick one apple.",
      categoryId: 1,
      order: 1,
      version: "4.8",
      reward: 5,
    },
    {
      id: 102,
      name: "Apple Hunter II",
      description: "Pick every apple.",
      categoryId: 1,
      order: 2,
      version: "5.0",
      reward: 10,
      previousId: 101,
    },
    {
      id: 201,
      name: "Forest Scout",
      description: "Survey the forest.",
      categoryId: 2,
      order: 1,
      version: "6.0",
      reward: 5,
    },
    {
      id: 202,
      name: "Berry Picker",
      description: "Find the hidden berries.",
      categoryId: 2,
      order: 2,
      version: "6.1",
      reward: 10,
      previousId: 201,
    },
  ],
};

const SEARCH_PLACEHOLDER = "Search achievement names and descriptions...";
const FILTER_CHIP_LABELS = [
  "Unfinished",
  "Finished",
  "v1.x",
  "v2.x",
  "v3.x",
  "v4.x",
  "v5.x",
  "v6.x",
  "v7.x",
] as const;

describe("AchievementArchiveView search", () => {
  beforeEach(() => {
    vi.spyOn(achievementTextResource, "use").mockReturnValue(ACHIEVEMENT_DATA);
    useAccountStore.setState({ accounts: {}, activeAccountId: null });
    useAchievementStore.setState({ earnedIdsByProfileId: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses AND item search instead of saved chips and restores them when cleared", async () => {
    const user = userEvent.setup();
    render(<AchievementArchiveView />);

    await screen.findByText("Apple Hunter I");
    await user.click(screen.getByRole("button", { name: "v4.x" }));
    const searchInput = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    await user.type(searchInput, "  hidden   bErRy  ");

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Alpha Guild/ })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Beta League/ })
      ).toBeInTheDocument();
      expect(screen.getByText("Berry Picker")).toBeInTheDocument();
      expect(screen.queryByText("Forest Scout")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Apple Hunter I")).not.toBeInTheDocument();
    expect(screen.queryByText("Apple Hunter II")).not.toBeInTheDocument();

    await user.clear(searchInput);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Alpha Guild/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Beta League/ })
      ).not.toBeInTheDocument();
      expect(screen.getByText("Apple Hunter I")).toBeInTheDocument();
      expect(screen.queryByText("Apple Hunter II")).not.toBeInTheDocument();
    });
  });

  it("does not match category names", async () => {
    const user = userEvent.setup();
    render(<AchievementArchiveView />);

    await screen.findByText("Apple Hunter I");
    await user.type(
      screen.getByPlaceholderText(SEARCH_PLACEHOLDER),
      "  aLpHa GuIlD  "
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Alpha Guild/ })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Beta League/ })
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Apple Hunter I")).not.toBeInTheDocument();
      expect(screen.queryByText("Apple Hunter II")).not.toBeInTheDocument();
    });
  });

  it("hides categories and series steps without a matching version", async () => {
    const user = userEvent.setup();
    render(<AchievementArchiveView />);

    await screen.findByText("Apple Hunter I");
    await user.click(screen.getByRole("button", { name: "v4.x" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Alpha Guild/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Beta League/ })
      ).not.toBeInTheDocument();
      expect(screen.getByText("Apple Hunter I")).toBeInTheDocument();
      expect(screen.queryByText("Apple Hunter II")).not.toBeInTheDocument();
    });
  });

  it("hides categories and series steps without a matching status", async () => {
    const user = userEvent.setup();
    useAccountStore.setState({ accounts: {}, activeAccountId: 1 });
    useAchievementStore.setState({ earnedIdsByProfileId: { 1: [101] } });
    render(<AchievementArchiveView />);

    await screen.findByText("Apple Hunter II");
    await user.click(screen.getByRole("button", { name: "Finished" }));
    await user.click(screen.getByRole("button", { name: "Unfinished" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Alpha Guild/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Beta League/ })
      ).not.toBeInTheDocument();
      expect(screen.getByText("Apple Hunter I")).toBeInTheDocument();
      expect(screen.queryByText("Apple Hunter II")).not.toBeInTheDocument();
    });
  });

  it("shows every matching item across categories and hides other series steps", async () => {
    const user = userEvent.setup();
    render(<AchievementArchiveView />);

    await screen.findByText("Apple Hunter I");
    await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "pick");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Alpha Guild/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Beta League/ })
      ).toBeInTheDocument();
      expect(screen.getByText("Apple Hunter I")).toBeInTheDocument();
      expect(screen.getByText("Apple Hunter II")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Beta League/ }));

    await waitFor(() => {
      expect(screen.getByText("Berry Picker")).toBeInTheDocument();
      expect(screen.queryByText("Forest Scout")).not.toBeInTheDocument();
    });
  });

  it("keeps the full series cascade when search hides predecessor steps", async () => {
    const user = userEvent.setup();
    useAccountStore.setState({ accounts: {}, activeAccountId: 1 });
    useAchievementStore.setState({ earnedIdsByProfileId: { 1: [] } });
    render(<AchievementArchiveView />);

    await user.type(
      screen.getByPlaceholderText(SEARCH_PLACEHOLDER),
      "Berry Picker"
    );

    expect(await screen.findByText("Berry Picker")).toBeInTheDocument();
    expect(screen.queryByText("Forest Scout")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Mark Berry Picker finished" })
    );

    await waitFor(() => {
      expect(useAchievementStore.getState().earnedIdsByProfileId[1]).toEqual([
        201, 202,
      ]);
    });
    expect(screen.queryByText("Forest Scout")).not.toBeInTheDocument();
  });

  it("disables filter chips only while a non-whitespace search is active", async () => {
    const user = userEvent.setup();
    render(<AchievementArchiveView />);

    const searchInput = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    for (const label of FILTER_CHIP_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }

    await user.type(searchInput, "   ");
    for (const label of FILTER_CHIP_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }

    await user.type(searchInput, "Berry");
    for (const label of FILTER_CHIP_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }

    await user.clear(searchInput);
    for (const label of FILTER_CHIP_LABELS) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }
  });
});
