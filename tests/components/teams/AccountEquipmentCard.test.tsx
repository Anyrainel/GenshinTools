import "@/providers/reference/statLoaders";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { AccountEquipmentCard } from "@/components/teams/AccountEquipmentCard";
import { DEFAULT_CALC_CONTEXT } from "@/domain/combat/damage/constants";
import { weaponStatsResource } from "@/domain/reference/stats";
import type { AccountEquipmentYield } from "@/domain/team/accountEquipmentTypes";
import { teamCompInputToComp } from "@/domain/team/teamDeltas";
import { render, screen } from "../../utils/render";

const computation = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  result: null as AccountEquipmentYield | null,
}));
vi.mock("@/hooks/useAsyncComputation", () => ({
  useAsyncComputation: () => ({
    ...computation,
    isComputing: false,
    error: null,
  }),
}));
vi.mock("@/hooks/useTeamInventory", () => ({
  useTeamInventory: () => ({
    allArtifacts: [],
    availableArtifacts: [],
    frozenArtifactIds: new Set(),
    perCharExtraArtifacts: {},
    forceReuseChars: {},
  }),
}));
await weaponStatsResource.preload();

const team = teamCompInputToComp({
  id: "account-improvement",
  name: "Vape team",
  characters: ["hu_tao", "xingqiu", null, null],
  weapons: ["staff_of_homa", null, null, null],
  artifacts: [null, null, null, null],
  reactions: [],
});
const firstConfig = {
  charId: "hu_tao",
  charLevel: 90,
  constellation: 0,
  weaponId: "staff_of_homa",
  refinement: 1,
  artifactSet: null,
};
const secondConfig = {
  ...firstConfig,
  charId: "xingqiu",
  weaponId: "sacrificial_sword",
};
const props: ComponentProps<typeof AccountEquipmentCard> = {
  teamComp: team,
  setupConfig: { combatOptions: {} },
  accountData: { characters: [], extraWeapons: [], extraArtifacts: [] },
  configs: [firstConfig],
  objectiveCombo: {
    id: "shared",
    label: { en: "Rotation", zh: "循环" },
    lines: [{ charId: "hu_tao", formulaId: "charged", count: 1 }],
  },
  calcContext: { ...DEFAULT_CALC_CONTEXT },
  baseSheets: {},
  onApply: vi.fn(),
  onSave: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  computation.result = null;
});

it("requires a weapon configuration for every nonempty roster member before searching", async () => {
  const user = userEvent.setup();
  const view = render(<AccountEquipmentCard {...props} />);
  expect(
    screen.getByText("Select a weapon for every team member.")
  ).toBeInTheDocument();
  const run = screen.getByRole("button", { name: "Run Analysis" });
  expect(run).toBeDisabled();
  await user.click(run);
  expect(computation.start).not.toHaveBeenCalled();
  view.rerender(
    <AccountEquipmentCard
      {...props}
      teamComp={{
        ...team,
        slots: team.slots.map((slot) =>
          slot.charId === "xingqiu"
            ? { ...slot, weaponId: "sacrificial_sword" }
            : slot
        ),
      }}
      configs={[firstConfig, secondConfig]}
    />
  );
  expect(
    screen.queryByText("Select a weapon for every team member.")
  ).not.toBeInTheDocument();
  expect(run).not.toBeDisabled();
  await user.click(run);
  expect(computation.start).toHaveBeenCalledTimes(1);
  expect(
    computation.start.mock.calls[0][0].configs.map(
      (config: { charId: string }) => config.charId
    )
  ).toEqual(["hu_tao", "xingqiu"]);
});

it("does not publish a partial team outcome while roster inputs are incomplete", () => {
  computation.result = {
    kind: "result",
    result: {
      configs: [firstConfig],
      weaponCopyIds: ["homa-1"],
      artifactsByChar: {},
      damage: 100_000,
      baselineDamage: 90_000,
      evaluated: 1,
      approximate: true,
    },
  };
  render(<AccountEquipmentCard {...props} />);
  expect(screen.queryByText("Best allocation found")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Apply to roster" })
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Select a weapon for every team member.")
  ).toBeInTheDocument();
});
