import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactArchiveView } from "@/pages/archive/ArtifactArchiveView";
import { useArchiveSessionStore } from "@/stores/useArchiveSessionStore";
import { render, screen, waitFor } from "../../utils/render";

vi.mock("@/contexts/LanguageContext", () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  useLanguage: () => ({
    language: "en",
    t: {
      artifact: (id: string) =>
        ({
          alpha_set: "Sunlit Oath",
          beta_set: "Moonlit Promise",
        })[id] ?? id,
      artifactEffects: (id: string) => [
        `${id} two-piece effect`,
        `${id} four-piece effect`,
      ],
      halfSetShort: (id: string) =>
        ({
          alpha_half: "Sun bonus",
          beta_half: "Moon bonus",
        })[id] ?? id,
      ui: (key: string) =>
        ({
          "accountData.fourPiece": "4-Piece",
          "accountData.twoPiece": "2-Piece",
          "archive.noArtifactResults": "No artifacts match these filters",
          "archive.searchItemPlaceholder": "Search artifacts...",
        })[key] ?? key,
    },
  }),
}));

vi.mock("@/data/gameResources", () => ({
  allHalfSetIds: ["alpha_half", "beta_half"],
  artifactIdToHalfSetId: {
    alpha_set: "alpha_half",
    beta_set: "beta_half",
  },
  betaArtifactIds: new Set<string>(),
  sortedArtifacts: [
    {
      id: "alpha_set",
      rarity: 5,
      imagePaths: {},
    },
    {
      id: "beta_set",
      rarity: 5,
      imagePaths: {},
    },
  ],
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

const SEARCH_PLACEHOLDER = "Search artifacts...";

describe("ArtifactArchiveView search", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useArchiveSessionStore.setState({ artifactSearch: "" });
  });

  it("uses search instead of saved half-set chips and restores them when cleared", async () => {
    const user = userEvent.setup();
    render(<ArtifactArchiveView />);

    await screen.findByText("Sunlit Oath");
    const sunChip = screen.getByRole("button", { name: "Sun bonus" });
    const moonChip = screen.getByRole("button", { name: "Moon bonus" });
    const searchInput = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);

    await user.click(sunChip);
    await waitFor(() => {
      expect(screen.getByText("Sunlit Oath")).toBeInTheDocument();
      expect(screen.queryByText("Moonlit Promise")).not.toBeInTheDocument();
    });

    await user.type(searchInput, "   ");
    expect(sunChip).toBeEnabled();
    expect(moonChip).toBeEnabled();
    expect(screen.getByText("Sunlit Oath")).toBeInTheDocument();
    expect(screen.queryByText("Moonlit Promise")).not.toBeInTheDocument();

    await user.type(searchInput, "moonlit");
    await waitFor(() => {
      expect(screen.queryByText("Sunlit Oath")).not.toBeInTheDocument();
      expect(screen.getByText("Moonlit Promise")).toBeInTheDocument();
      expect(sunChip).toBeDisabled();
      expect(moonChip).toBeDisabled();
    });

    await user.clear(searchInput);
    await waitFor(() => {
      expect(screen.getByText("Sunlit Oath")).toBeInTheDocument();
      expect(screen.queryByText("Moonlit Promise")).not.toBeInTheDocument();
      expect(sunChip).toBeEnabled();
      expect(moonChip).toBeEnabled();
    });
  });
});
