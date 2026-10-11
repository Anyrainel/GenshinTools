import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeaponChoiceDetail } from "@/components/team-comp/WeaponChoiceDetail";
import type { WeaponChoiceResultCard } from "@/components/team-comp/WeaponChoiceResultCard";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { AccountData } from "@/data/types";
import type { WeaponChoiceResult as ComputeResult } from "@/lib/team-comp/analyzer/weaponChoice";
import { teamCompInputToComp } from "@/lib/team-comp/teamDeltas";
import { fireEvent, render, screen } from "../../utils/render";
import "@/lib/dmgcalc";

const state = vi.hoisted(() => ({
  account: null as AccountData | null,
  result: null as ComputeResult | null,
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@/hooks/useActiveAccount", () => ({
  useActiveAccountData: () => state.account,
}));
vi.mock("@/hooks/useAsyncWeaponChoice", () => ({
  useAsyncWeaponChoice: () => ({
    result: state.result,
    isComputing: false,
    error: null,
    start: state.start,
    stop: state.stop,
  }),
}));
vi.mock("@/components/team-comp/TeamRosterCard", () => ({
  TeamRosterCard: () => null,
}));
vi.mock("@/components/team-comp/FormulaSelectorCard", () => ({
  FormulaSelectorCard: () => null,
}));
vi.mock("@/components/team-comp/TeamDetailAspectLinks", () => ({
  TeamDetailAspectLinks: () => null,
}));
vi.mock(
  "@/components/team-comp/WeaponChoiceResultCard",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/components/team-comp/WeaponChoiceResultCard")
      >();
    return {
      WeaponChoiceResultCard: (
        props: ComponentProps<typeof WeaponChoiceResultCard>
      ) => (
        <>
          <actual.WeaponChoiceResultCard {...props} />
          <output data-testid="result">
            {props.result?.timestamp ?? "empty"}
          </output>
        </>
      ),
    };
  }
);

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);
const teamComp = teamCompInputToComp({
  id: "owned-comparison",
  name: "Team",
  characters: ["hu_tao", null, null, null],
  weapons: ["staff_of_homa", null, null, null],
  artifacts: [null, null, null, null],
  reactions: [],
});
const setupConfig = { combatOptions: {} };
const props = { teamComp, setupConfig, onBack: vi.fn() };
const account: AccountData = {
  characters: [],
  extraArtifacts: [],
  extraWeapons: [
    { id: "homa", key: "staff_of_homa", refinement: 3, level: 90, lock: false },
  ],
};
function result(mode: "weapon" | "artifact", timestamp: number): ComputeResult {
  return {
    mode,
    timestamp,
    perCharacter: {},
    done: true,
    progress: { phase: "done", overallProgress: 1 },
  };
}

describe("owned comparison scope", () => {
  beforeEach(() => {
    state.account = account;
    state.result = null;
    vi.clearAllMocks();
  });

  it("clears account-scoped rankings after inventory changes and can leave owned mode after account removal", async () => {
    const view = render(<WeaponChoiceDetail {...props} />);
    await userEvent.click(screen.getByRole("tab", { name: "Owned weapons" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    expect(state.start.mock.calls[0][0].ownedWeaponChoices).toEqual([
      { weaponId: "staff_of_homa", refinement: 3 },
    ]);
    state.result = result("weapon", 22);
    view.rerender(<WeaponChoiceDetail {...props} />);
    expect(screen.getByTestId("result")).toHaveTextContent("22");
    state.account = { ...account, extraWeapons: [] };
    view.rerender(<WeaponChoiceDetail {...props} />);
    expect(screen.getByTestId("result")).toHaveTextContent("empty");
    state.account = null;
    view.rerender(<WeaponChoiceDetail {...props} />);
    expect(screen.getByRole("button", { name: "Run Analysis" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "All weapons" })).not.toBeDisabled();
    await userEvent.click(screen.getByRole("tab", { name: "All weapons" }));
    expect(
      screen.getByRole("button", { name: "Run Analysis" })
    ).not.toBeDisabled();
  });

  it("keeps an artifact comparison running when owned inventory changes", async () => {
    const view = render(<WeaponChoiceDetail {...props} />);
    await userEvent.click(screen.getByRole("tab", { name: "Owned weapons" }));
    await userEvent.click(screen.getByRole("tab", { name: "Artifact sets" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.stop.mockClear();
    state.account = { ...account, extraWeapons: [] };
    view.rerender(<WeaponChoiceDetail {...props} />);
    expect(state.stop).not.toHaveBeenCalled();
    state.result = result("artifact", 33);
    view.rerender(<WeaponChoiceDetail {...props} />);
    expect(screen.getByTestId("result")).toHaveTextContent("33");
  });

  it("restores the catalog cache when leaving owned mode", async () => {
    const resultCache = { weaponChoiceResult: result("weapon", 11) };
    const view = render(
      <WeaponChoiceDetail {...props} resultCache={resultCache} />
    );
    expect(screen.getByTestId("result")).toHaveTextContent("11");
    await userEvent.click(screen.getByRole("tab", { name: "Owned weapons" }));
    expect(screen.getByTestId("result")).toHaveTextContent("empty");
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.result = result("weapon", 22);
    view.rerender(<WeaponChoiceDetail {...props} resultCache={resultCache} />);
    expect(screen.getByTestId("result")).toHaveTextContent("22");
    await userEvent.click(screen.getByRole("tab", { name: "All weapons" }));
    expect(screen.getByTestId("result")).toHaveTextContent("11");
    await userEvent.click(screen.getByRole("tab", { name: "Owned weapons" }));
    expect(screen.getByTestId("result")).toHaveTextContent("22");
  });
});
