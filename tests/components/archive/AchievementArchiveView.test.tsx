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
              "Search categories, achievement names, and descriptions...",
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

const SEARCH_PLACEHOLDER =
  "Search categories, achievement names, and descriptions...";
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

  it("filters groups by item name without applying the saved chips", async () => {
    const user = userEvent.setup();
    render(<AchievementArchiveView />);

    await screen.findByText("Apple Hunter I");
    await user.click(screen.getByRole("button", { name: "v4.x" }));
    await user.type(
      screen.getByPlaceholderText(SEARCH_PLACEHOLDER),
      "bErRy PiCkEr"
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Alpha Guild/ })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Beta League/ })
      ).toBeInTheDocument();
      expect(screen.getByText("Berry Picker")).toBeInTheDocument();
    });
    expect(screen.getByText("Forest Scout")).toBeInTheDocument();
    expect(screen.queryByText("Apple Hunter I")).not.toBeInTheDocument();
  });

  it("matches a category name and shows that category's items", async () => {
    const user = userEvent.setup();
    render(<AchievementArchiveView />);

    await screen.findByText("Apple Hunter I");
    await user.type(
      screen.getByPlaceholderText(SEARCH_PLACEHOLDER),
      "  aLpHa GuIlD  "
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Alpha Guild/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Beta League/ })
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Apple Hunter I")).toBeInTheDocument();
    expect(screen.getByText("Apple Hunter II")).toBeInTheDocument();
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
