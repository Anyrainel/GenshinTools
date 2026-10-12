import "@/providers/reference/statLoaders";
import { act, fireEvent } from "@testing-library/react";
import type { ComponentProps } from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { CharacterReplacementDetail } from "@/components/teams/CharacterReplacementDetail";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type { CharacterReplacementMessage } from "@/domain/team/characterReplacementTypes";
import { buildTeamSlotConfigs } from "@/domain/team/teamConfigUtils";
import { teamCompInputToComp } from "@/domain/team/teamDeltas";
import { render, screen } from "../../utils/render";

const workers: MockWorker[] = [];
class MockWorker {
  onmessage:
    | ((event: MessageEvent<CharacterReplacementMessage>) => void)
    | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
  emit(data: CharacterReplacementMessage) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
}
beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});
beforeEach(() => {
  workers.length = 0;
  vi.stubGlobal("Worker", MockWorker);
});
afterEach(() => vi.unstubAllGlobals());
let sequence = 0;
function props(): ComponentProps<typeof CharacterReplacementDetail> {
  return {
    teamComp: teamCompInputToComp({
      id: `ui-${sequence++}`,
      characters: ["hu_tao", "xingqiu", "zhongli", "bennett"],
      weapons: [
        "staff_of_homa",
        "sacrificial_sword",
        "favonius_lance",
        "favonius_sword",
      ],
    }),
    setupConfig: {
      combatOptions: {},
      damage: { formulaMode: "combo" },
      charConfigs: { hu_tao: { constellation: 1, minEr: 1.1 } },
    },
    accountData: null,
    characterStats: characterStatsResource.peek(),
    weaponStats: weaponStatsResource.peek(),
    objective: {
      id: "custom",
      label: { en: "custom", zh: "自定义" },
      lines: [{ charId: "hu_tao", formulaId: "hu_tao-skill", count: 37 }],
    },
    calcContext: {
      enemyLevel: 105,
      enemyRes: 0.25,
      rollMultiplier: 0.9,
      substatBudget: "8_6",
    },
    updateTeamComp: vi.fn(),
    updateTeamSetupConfig: vi.fn(),
  };
}
function selectLastSlot() {
  fireEvent.click(screen.getAllByRole("checkbox")[3]);
}

describe("CharacterReplacementDetail shared input lifecycle", () => {
  it("pins an unchanged member's effective rank when an earlier replacement reorders account copies", () => {
    const input = props();
    input.accountData = {
      characters: input.teamComp.slots.map((slot, index) => ({
        key: slot.charId!,
        level: 90,
        constellation: 0,
        talent: { auto: 10, skill: 10, burst: 10 },
        artifacts: {},
        weapon: {
          id: `owned-${index}`,
          key: slot.weaponId!,
          level: 90,
          refinement: index === 1 ? 5 : 1,
          lock: false,
        },
      })),
      extraArtifacts: [],
      extraWeapons: [
        {
          id: "sword-low",
          key: "sacrificial_sword",
          level: 90,
          refinement: 2,
          lock: false,
        },
      ],
    };
    render(<CharacterReplacementDetail {...input} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    const configs = ["keqing", "xingqiu", "zhongli", "bennett"].map(
      (charId, index) => ({
        charId,
        charLevel: 90,
        constellation: 0,
        weaponId:
          index === 0
            ? "sacrificial_sword"
            : input.teamComp.slots[index].weaponId!,
        refinement: index === 0 ? 2 : index === 1 ? 5 : 1,
        artifactSet: null,
      })
    );
    const combo = {
      ...input.objective,
      lines: [{ charId: "keqing", formulaId: "keqing-skill", count: 1 }],
    };
    act(() =>
      workers[0].emit({
        type: "result",
        baselineDamage: null,
        evaluated: 1,
        skipped: 0,
        partial: false,
        results: [
          {
            configs,
            slotIndexes: [0, 1, 2, 3],
            weaponInstanceIds: ["sword-low", "owned-1", "owned-2", "owned-3"],
            combo,
            damage: 1000,
            artifactsByChar: {
              keqing: {} as never,
              xingqiu: {} as never,
              zhongli: {} as never,
              bennett: {} as never,
            },
            artifactBasis: "generated",
            ignoredCharIds: [],
          },
        ],
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply to this team" }));
    const nextTeam = vi.mocked(input.updateTeamComp).mock.calls[0][1];
    const update = vi.mocked(input.updateTeamSetupConfig).mock.calls[0][1];
    if (typeof update !== "function") throw new Error("Expected setup updater");
    const nextSetup = update(input.setupConfig);
    expect(nextSetup.charConfigs?.xingqiu?.refinement).toBe(5);
    expect(
      buildTeamSlotConfigs(nextTeam, nextSetup, input.accountData).map(
        (config) => config.refinement
      )
    ).toEqual([2, 5, 1, 1]);
  });
  it("keeps independent pool/artifact choices and per-team replacement slots", () => {
    const input = props();
    const rendered = render(<CharacterReplacementDetail {...input} />);
    selectLastSlot();
    fireEvent.change(screen.getByLabelText("Character & weapon pool"), {
      target: { value: "owned-any" },
    });
    expect(screen.getByLabelText("Artifact source")).toHaveValue("generated");
    rendered.rerender(
      <CharacterReplacementDetail
        {...input}
        teamComp={{ ...input.teamComp, id: "other-team" }}
      />
    );
    expect(screen.getAllByRole("checkbox")[3]).not.toBeChecked();
    rendered.rerender(<CharacterReplacementDetail {...input} />);
    expect(screen.getAllByRole("checkbox")[3]).toBeChecked();
    expect(screen.getByLabelText("Character & weapon pool")).toHaveValue(
      "owned-any"
    );
  });

  it("explains incompatible single-skill source replacement before running", () => {
    const input = props();
    input.setupConfig.damage!.formulaMode = "single";
    render(<CharacterReplacementDetail {...input} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Single-skill damage needs its source character"
    );
    expect(
      screen.getByRole("button", { name: "Find replacements" })
    ).toBeDisabled();
    expect(workers).toHaveLength(0);
  });

  it("cancels an outdated run and rejects its late worker message", () => {
    const input = props();
    const rendered = render(<CharacterReplacementDetail {...input} />);
    selectLastSlot();
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    expect(workers).toHaveLength(1);
    const task = workers[0];
    expect(task.postMessage.mock.calls[0][0]).toMatchObject({
      objective: input.objective,
      calcContext: input.calcContext,
    });
    rendered.rerender(
      <CharacterReplacementDetail
        {...input}
        calcContext={{ ...input.calcContext, enemyLevel: 110 }}
      />
    );
    expect(task.terminate).toHaveBeenCalled();
    act(() => task.emit({ type: "error", reason: "calculator-error" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find replacements" })
    ).toBeEnabled();
  });

  it("applies replacement into the same team while retaining unchanged configuration", () => {
    const input = props();
    const onIgnored = vi.fn();
    render(
      <CharacterReplacementDetail
        {...input}
        onIgnoredCharIdsChange={onIgnored}
      />
    );
    selectLastSlot();
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    const configs = ["hu_tao", "xingqiu", "zhongli", "fischl"].map(
      (charId, index) => ({
        charId,
        charLevel: 90,
        constellation: index === 0 ? 1 : 6,
        weaponId:
          index === 3
            ? "favonius_warbow"
            : input.teamComp.slots[index].weaponId!,
        refinement: 3,
        artifactSet: null,
      })
    );
    const combo = {
      ...input.objective,
      lines: [
        ...input.objective.lines,
        { charId: "fischl", formulaId: "fischl-skill", count: 9 },
      ],
    };
    act(() =>
      workers[0].emit({
        type: "result",
        baselineDamage: null,
        evaluated: 12,
        skipped: 0,
        partial: false,
        results: [
          {
            configs,
            slotIndexes: [0, 1, 2, 3],
            weaponInstanceIds: [null, null, null, null],
            combo,
            damage: 1000,
            artifactsByChar: {
              hu_tao: {} as never,
              xingqiu: {} as never,
              zhongli: {} as never,
              fischl: {} as never,
            },
            artifactBasis: "generated",
            ignoredCharIds: ["fischl"],
          },
        ],
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply to this team" }));
    expect(input.updateTeamComp).toHaveBeenCalledWith(
      input.teamComp.id,
      expect.objectContaining({
        slots: expect.arrayContaining([
          expect.objectContaining({
            charId: "fischl",
            weaponId: "favonius_warbow",
          }),
        ]),
      })
    );
    const update = vi.mocked(input.updateTeamSetupConfig).mock.calls[0][1];
    expect(typeof update).toBe("function");
    if (typeof update !== "function") return;
    const updated = update(input.setupConfig);
    expect(updated.charConfigs?.hu_tao).toEqual(
      input.setupConfig.charConfigs?.hu_tao
    );
    expect(updated.damage?.combo).toEqual(combo);
    expect(updated.charConfigs?.fischl?.constellation).toBe(6);
    expect(onIgnored).toHaveBeenCalledWith(new Set(["fischl"]));
  });
});
