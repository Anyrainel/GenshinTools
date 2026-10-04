import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TriageHelpDialog } from "@/components/account-data/TriageHelpDialog";
import { allSlots } from "@/data/enums";
import type { TriageStatistics } from "@/lib/account-data/triage/types";
import { render } from "../../utils/render";

const statistics: TriageStatistics = {
  totalDemand: 7,
  totalGap: 6,
  totalSupply: 3,
  totalBuilds: 5,
  totalActiveBuilds: 3,
  keepReasons: { prime: 2, solid: 1, filler: 0, flex: 1, other: 1 },
  sets: [
    {
      key: "4pc:gladiators_finale",
      source: { type: "4pc", setKey: "gladiators_finale" },
      demand: 7,
      gap: 6,
      supplyByTier: { prime: 2, solid: 1, filler: 0, fodder: 0 },
      slots: Object.fromEntries(
        allSlots.map((slot) => [
          slot,
          {
            demand: slot === "circlet" ? 3 : 1,
            gap: slot === "flower" ? 0 : slot === "circlet" ? 3 : 1,
            supplyByTier: {
              prime: slot === "flower" ? 2 : 0,
              solid: slot === "flower" ? 1 : 0,
              filler: 0,
              fodder: 0,
            },
          },
        ])
      ) as TriageStatistics["sets"][number]["slots"],
    },
  ],
  characters: [
    { characterId: "amber", totalBuildCount: 3, activeBuildCount: 2 },
    { characterId: "kaeya", totalBuildCount: 2, activeBuildCount: 1 },
  ],
};
function selectTab(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
}
beforeEach(() => {
  localStorage.setItem("app_language", "en");
});

describe("TriageHelpDialog statistics", () => {
  it("defaults to explanation, shows gap and tier supply, and expands slot details", () => {
    render(
      <TriageHelpDialog open onOpenChange={vi.fn()} statistics={statistics} />
    );
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "How it works" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText(/demand is split evenly/)).toBeVisible();
    selectTab("Set demand");
    expect(screen.getByText("Gap: 6")).toBeVisible();
    expect(screen.getByText("Total demand: 7")).toBeVisible();
    expect(screen.getByText("5★ inventory: 3")).toBeVisible();
    const expand = screen.getByRole("button", { name: "Gladiator's Finale" });
    const cells = within(expand.closest("tr")!).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("6");
    expect(cells[2]).toHaveTextContent("7");
    expect(cells[3]).toHaveTextContent("Prime2Solid1Filler0Fodder0");
    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("rowheader", { name: "Circlet" })).toBeVisible();
  });

  it("shows total and active counts with the existing character build deep link", () => {
    const onOpenChange = vi.fn();
    render(
      <TriageHelpDialog
        open
        onOpenChange={onOpenChange}
        statistics={statistics}
      />
    );
    selectTab("Active builds");
    expect(screen.getByText("5 total builds · 3 active")).toBeVisible();
    const link = screen.getByRole("link", { name: "View Amber's builds" });
    expect(link).toHaveAttribute(
      "href",
      "/artifact-filter/configure?char=amber"
    );
    expect(
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(["Amber32", "Kaeya21"]);
    fireEvent.click(link);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows five exclusive keep reasons and a pie chart with counts and percentages", () => {
    render(
      <TriageHelpDialog open onOpenChange={vi.fn()} statistics={statistics} />
    );
    selectTab("Keep reasons");
    expect(screen.getByText("5 artifacts kept")).toBeVisible();
    expect(screen.getByRole("img", { name: "Keep reasons" })).toBeVisible();
    for (const label of [
      "Prime keeps",
      "Solid keeps",
      "Filler keeps",
      "Flex keeps",
      "Other keeps",
    ])
      expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText("2 (40.0%)")).toBeVisible();
    expect(screen.getByText("0 (0.0%)")).toBeVisible();
  });

  it("shows empty states for missing inventory, builds, and keeps", () => {
    render(
      <TriageHelpDialog
        open
        onOpenChange={vi.fn()}
        statistics={{
          sets: [],
          characters: [],
          totalDemand: 0,
          totalGap: 0,
          totalSupply: 0,
          totalBuilds: 0,
          totalActiveBuilds: 0,
          keepReasons: { prime: 0, solid: 0, filler: 0, flex: 0, other: 0 },
        }}
      />
    );
    selectTab("Set demand");
    expect(
      screen.getByText("No demand or 5★ inventory to show.")
    ).toBeVisible();
    selectTab("Active builds");
    expect(
      screen.getByText("No builds passed the current selection.")
    ).toBeVisible();
    selectTab("Keep reasons");
    expect(
      screen.getByText("No artifacts are kept by the current rules.")
    ).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "Keep reasons" })
    ).not.toBeInTheDocument();
  });
});
