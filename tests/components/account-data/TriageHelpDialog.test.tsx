import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TriageHelpDialog } from "@/components/account-data/TriageHelpDialog";
import { allSlots } from "@/data/enums";
import type { TriageStatistics } from "@/lib/account-data/triage/types";
import { render } from "../../utils/render";

const statistics: TriageStatistics = {
  totalDemand: 7,
  totalSupply: 3,
  totalBuilds: 3,
  sets: [
    {
      key: "4pc:gladiators_finale",
      source: { type: "4pc", setKey: "gladiators_finale" },
      demand: 7,
      supply: 3,
      slots: Object.fromEntries(
        allSlots.map((slot) => [
          slot,
          {
            demand: slot === "circlet" ? 3 : 1,
            supply: slot === "flower" ? 3 : 0,
          },
        ])
      ) as TriageStatistics["sets"][number]["slots"],
    },
  ],
  characters: [
    { characterId: "amber", buildCount: 2 },
    { characterId: "kaeya", buildCount: 1 },
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
  it("defaults to the explanation and shows demand, supply, slot details, and selected builds in tabs", () => {
    render(
      <TriageHelpDialog open onOpenChange={vi.fn()} statistics={statistics} />
    );
    expect(screen.getByRole("tab", { name: "How it works" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText(/demand is split evenly/)).toBeVisible();
    selectTab("Set demand");
    expect(screen.getByText("Total demand: 7")).toBeVisible();
    expect(screen.getByText("5★ inventory: 3")).toBeVisible();
    const row = screen.getByText("Gladiator's Finale").closest("tr")!;
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    ).toEqual([expect.stringContaining("Gladiator's Finale"), "7", "3"]);
    fireEvent.click(screen.getByText("Gladiator's Finale"));
    expect(screen.getByText("3 / 0")).toBeVisible();
    selectTab("Active builds");
    expect(screen.getByText("3 active builds")).toBeVisible();
    expect(
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(["Amber2", "Kaeya1"]);
  });

  it("shows useful empty states when no builds or inventory are available", () => {
    render(
      <TriageHelpDialog
        open
        onOpenChange={vi.fn()}
        statistics={{
          sets: [],
          characters: [],
          totalDemand: 0,
          totalSupply: 0,
          totalBuilds: 0,
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
  });
});
