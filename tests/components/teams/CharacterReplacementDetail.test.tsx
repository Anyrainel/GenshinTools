import "@/providers/reference/statLoaders";
import { act, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { allSlots } from "@/domain/enums";
import type { ArtifactData } from "@/domain/models";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type {
  CharacterReplacementResult,
  CharacterReplacementWorkerMessage,
} from "@/domain/team/characterReplacementTypes";
import { buildTeamSlotConfigs } from "@/domain/team/teamConfigUtils";
import { teamCompInputToComp } from "@/domain/team/teamDeltas";
import { render, screen } from "../../utils/render";

const workers: MockWorker[] = [];
class MockWorker {
  onmessage:
    | ((event: MessageEvent<CharacterReplacementWorkerMessage>) => void)
    | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
  emit(data: CharacterReplacementWorkerMessage) {
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
function result(
  input: ReturnType<typeof props>,
  slotIndex = 3
): CharacterReplacementResult {
  const configs = input.teamComp.slots.map((slot, index) => ({
    charId: index === slotIndex ? "fischl" : slot.charId!,
    charLevel: 90,
    constellation: index === 0 ? 1 : 6,
    weaponId: index === slotIndex ? "favonius_warbow" : slot.weaponId!,
    refinement: 3,
    artifactSet: null,
  }));
  const artifactsByChar = Object.fromEntries(
    configs.map((config) => [
      config.charId,
      Object.fromEntries(
        allSlots.map((slotKey) => [
          slotKey,
          {
            id: `gen-${config.charId}-${slotKey}`,
            setKey: "gladiators_finale",
            slotKey,
            level: 20,
            rarity: 5,
            mainStatKey:
              slotKey === "flower"
                ? "hp"
                : slotKey === "plume"
                  ? "atk"
                  : "atk%",
            substats: {},
            lock: false,
          } satisfies ArtifactData,
        ])
      ),
    ])
  ) as CharacterReplacementResult["artifactsByChar"];
  return {
    configs,
    replacementSlots: [slotIndex],
    slotIndexes: [0, 1, 2, 3],
    weaponInstanceIds: [null, null, null, null],
    combo: {
      ...input.objective,
      lines: [
        ...input.objective.lines,
        { charId: "fischl", formulaId: "fischl-skill", count: 9 },
      ],
    },
    damage: 1000,
    artifactsByChar,
    artifactBasis: "generated",
    ignoredCharIds: ["fischl"],
  };
}
function publish(
  input: ReturnType<typeof props>,
  incoming = result(input),
  slotIndex = 3
) {
  act(() =>
    workers[0].emit({
      type: "independent-result",
      rankings: [
        {
          slotIndex,
          outcome: {
            type: "result",
            baselineDamage: 900,
            evaluated: 12,
            skipped: 0,
            partial: false,
            results: [incoming],
          },
        },
      ],
    })
  );
}

describe("Characters comparison modes", () => {
  it("uses shared option buttons and starts one all-slot generated comparison without slot selection", () => {
    const input = props();
    const { container } = render(<CharacterReplacementDetail {...input} />);
    expect(
      screen.getByRole("button", { name: "Replace characters" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Replace unowned" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Artifact source" })
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-replacement-slot]")).toHaveLength(
      0
    );
    expect(
      screen.getByRole("combobox", { name: "3–4★ characters" })
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    expect(container.querySelectorAll("[data-replacement-slot]")).toHaveLength(
      4
    );
    expect(workers[0].postMessage.mock.calls[0][0]).toMatchObject({
      task: "independent",
      objective: input.objective,
      calcContext: input.calcContext,
      settings: { artifactBasis: "generated", replaceSlots: [] },
    });
  });

  it("keeps a single-source slot unavailable while the comparison button can calculate other slots", () => {
    const input = props();
    input.setupConfig.damage!.formulaMode = "single";
    render(<CharacterReplacementDetail {...input} />);
    expect(
      screen.queryByText("Single-skill source stays fixed.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find replacements" })
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    expect(
      screen.getByText("Single-skill source stays fixed.")
    ).toBeInTheDocument();
    expect(workers[0].postMessage.mock.calls[0][0].task).toBe("independent");
  });

  it("preserves pool settings by team and submode", async () => {
    const input = props();
    const rendered = render(<CharacterReplacementDetail {...input} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("combobox", { name: "Character & weapon pool" })
    );
    await user.click(
      screen.getByRole("option", { name: "Owned characters + any weapons" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Replace unowned" }));
    expect(
      screen.getByRole("combobox", { name: "Character & weapon pool" })
    ).toHaveTextContent("Owned characters + owned weapons");
    fireEvent.click(screen.getByRole("button", { name: "Replace characters" }));
    expect(
      screen.getByRole("combobox", { name: "Character & weapon pool" })
    ).toHaveTextContent("Owned characters + any weapons");
    rendered.rerender(
      <CharacterReplacementDetail
        {...input}
        teamComp={{ ...input.teamComp, id: "other-correction-team" }}
      />
    );
    expect(
      screen.getByRole("combobox", { name: "Character & weapon pool" })
    ).toHaveTextContent("All characters + any weapons");
    rendered.rerender(<CharacterReplacementDetail {...input} />);
    expect(
      screen.getByRole("combobox", { name: "Character & weapon pool" })
    ).toHaveTextContent("Owned characters + any weapons");
  });

  it("uses unowned replacement as a joint mode preserving owned characters", () => {
    const input = props();
    input.accountData = {
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 1,
          talent: { auto: 10, skill: 10, burst: 10 },
          artifacts: {},
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };
    render(<CharacterReplacementDetail {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace unowned" }));
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    expect(workers[0].postMessage.mock.calls[0][0]).toMatchObject({
      task: "joint",
      settings: {
        pool: "owned-owned",
        artifactBasis: "generated",
        replaceSlots: [1, 2, 3],
      },
    });
  });

  it("cancels outdated input and rejects late worker messages", () => {
    const input = props();
    const rendered = render(<CharacterReplacementDetail {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    const task = workers[0];
    rendered.rerender(
      <CharacterReplacementDetail
        {...input}
        calcContext={{ ...input.calcContext, enemyLevel: 110 }}
      />
    );
    expect(task.terminate).toHaveBeenCalled();
    act(() => task.emit({ type: "error", reason: "calculator-error" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cancels a running search when its local pool changes and rejects the stale reply", async () => {
    const input = props();
    render(<CharacterReplacementDetail {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    const task = workers[0];
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("combobox", { name: "Character & weapon pool" })
    );
    await user.click(
      screen.getByRole("option", { name: "Owned characters + any weapons" })
    );
    expect(task.terminate).toHaveBeenCalled();
    act(() => task.emit({ type: "error", reason: "calculator-error" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Character & weapon pool" })
    ).toHaveTextContent("Owned characters + any weapons");
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    expect(workers[1].postMessage.mock.calls[0][0].settings.pool).toBe(
      "owned-any"
    );
  });

  it("shows a per-slot result and applies only that replacement to the same team", () => {
    const input = props();
    const onIgnored = vi.fn();
    const { container } = render(
      <CharacterReplacementDetail
        {...input}
        onIgnoredCharIdsChange={onIgnored}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    publish(input);
    const rankedSlot = container.querySelector('[data-replacement-slot="3"]')!;
    expect(
      within(rankedSlot as HTMLElement).getByText("Fischl")
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-replacement-slot="0"]')!.textContent
    ).not.toContain("Fischl");
    fireEvent.click(screen.getByRole("button", { name: "Apply to this team" }));
    const nextTeam = vi.mocked(input.updateTeamComp).mock.calls[0][1];
    expect(nextTeam.id).toBe(input.teamComp.id);
    expect(nextTeam.slots.slice(0, 3).map((slot) => slot.charId)).toEqual(
      input.teamComp.slots.slice(0, 3).map((slot) => slot.charId)
    );
    expect(nextTeam.slots[3].charId).toBe("fischl");
    const update = vi.mocked(input.updateTeamSetupConfig).mock.calls[0][1];
    if (typeof update !== "function") throw new Error("Expected setup updater");
    const next = update(input.setupConfig);
    expect(next.charConfigs?.hu_tao).toEqual(
      input.setupConfig.charConfigs?.hu_tao
    );
    expect(next.damage?.combo?.lines[0].count).toBe(37);
    expect(onIgnored).toHaveBeenCalledWith(new Set(["fischl"]));
  });

  it("shows all empty positions and appends a later empty-position suggestion after the saved prefix", () => {
    const input = props();
    const incoming = result(input);
    incoming.configs = [incoming.configs[0], incoming.configs[3]];
    incoming.slotIndexes = [0, 3];
    input.teamComp.slots = input.teamComp.slots.slice(0, 1);
    const { container } = render(<CharacterReplacementDetail {...input} />);
    expect(container.querySelectorAll("[data-replacement-slot]")).toHaveLength(
      0
    );
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    publish(input, incoming);
    fireEvent.click(screen.getByRole("button", { name: "Apply to this team" }));
    const next = vi.mocked(input.updateTeamComp).mock.calls[0][1];
    expect(next.slots.map((slot) => slot.charId)).toEqual(["hu_tao", "fischl"]);
    expect(input.teamComp.slots).toHaveLength(1);
  });

  it("pins unchanged effective ranks when an earlier replacement reorders actual copies", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Find replacements" }));
    const incoming = result(input, 0);
    incoming.configs[0].charId = "keqing";
    incoming.configs[0].weaponId = "sacrificial_sword";
    incoming.configs.forEach((config, index) => {
      config.refinement = index === 0 ? 2 : index === 1 ? 5 : 1;
    });
    incoming.artifactsByChar.keqing = incoming.artifactsByChar.fischl;
    incoming.weaponInstanceIds = ["sword-low", "owned-1", "owned-2", "owned-3"];
    publish(input, incoming, 0);
    fireEvent.click(screen.getByRole("button", { name: "Apply to this team" }));
    const nextTeam = vi.mocked(input.updateTeamComp).mock.calls[0][1];
    const update = vi.mocked(input.updateTeamSetupConfig).mock.calls[0][1];
    if (typeof update !== "function") throw new Error("Expected setup updater");
    const next = update(input.setupConfig);
    expect(next.charConfigs?.xingqiu?.refinement).toBe(5);
    expect(
      buildTeamSlotConfigs(nextTeam, next, input.accountData).map(
        (config) => config.refinement
      )
    ).toEqual([2, 5, 1, 1]);
  });
});
