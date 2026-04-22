/**
 * Regression test: buffOverrides must apply to off-field formula parts.
 *
 * User report: overriding VV 4pc to false doesn't change Furina's E
 * (salon-total) damage, which consists entirely of off-field parts.
 */
import { describe, expect, it } from "vitest";

import { preloadGameStats } from "@/data/gameStatsLoader";
import "@/lib/team-comp/index";

import { getEffectiveCombo } from "@/lib/team-comp/calc/combo";
import {
  buildBuffOverrides,
  calcComboResults,
  extractComboOverrides,
} from "@/lib/team-comp/calc/comboBuffOverrides";
import { getBuffInstanceKey } from "@/lib/team-comp/calc/statBuff";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { emptySheets } from "../../../fixtures/optimizerHelpers";

await preloadGameStats();

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

// Furina + Kazuha(VV) + Xingqiu + Bennett
const TEAM: TeamSlotConfig[] = [
  {
    charId: "furina",
    charLevel: 90,
    constellation: 0,
    weaponId: "splendor_of_tranquil_waters",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "viridescent_venerer" },
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 0,
    weaponId: "sacrificial_sword",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 0,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: null,
  },
];

describe("buffOverrides affect off-field parts", () => {
  it("resolveBuffs: VV team buff is active for all Furina salon (off-field) parts", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    expect(vvMatch).toBeDefined();
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    // Simulate UI path: getDisplayResult for furina.furina-salon-total
    const dr = tb.getDisplayResult("furina", "furina-salon-total", sheets, CTX);

    const vvBuff = dr.buffs.find((b) => b.buffKey === vvKey);
    console.log(
      "VV buff on furina-salon-total:",
      vvBuff
        ? {
            active: vvBuff.active,
            activePartIndices: vvBuff.activePartIndices,
          }
        : "NOT FOUND"
    );

    expect(vvBuff).toBeDefined();
    expect(vvBuff!.active).toBe(true);
    // All 3 salon parts should be listed as active (or undefined = universal)
    if (vvBuff!.activePartIndices !== undefined) {
      expect(vvBuff!.activePartIndices).toEqual([0, 1, 2]);
    }
  });

  it("disabling VV team buff reduces Furina's salon (off-field) damage", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    // Find VV's team-receiver (res reduction) buff
    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    expect(vvMatch).toBeDefined();
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    const entry =
      tb.charBuilds.furina.charBase.getFormulaEntry("furina-salon-total");
    expect(entry).toBeDefined();
    expect(entry!.parts.every((p) => p.offField)).toBe(true);

    // Build a 1-line combo of furina's salon-total
    const combo: ComboFormula = {
      id: "c",
      label: { en: "salon", zh: "salon" },
      lines: [{ charId: "furina", formulaId: "furina-salon-total", count: 1 }],
    };

    // Baseline (no overrides)
    const baseline = tb.getComboDamageResult(combo, sheets, CTX).totalDamage;

    // Override: disable VV on all parts of salon-total
    const partActivation: Record<number, number> = {};
    for (let i = 0; i < entry!.parts.length; i++) {
      partActivation[i] = 0;
    }
    const overrides: Record<number, BuffActivationMap> = {
      0: { [vvKey]: partActivation },
    };

    const withOverride = tb.getComboDamageResult(
      combo,
      sheets,
      CTX,
      overrides
    ).totalDamage;

    // The override should decrease damage (VV reduces enemy hydro res by 40%,
    // which boosts Furina's hydro salon damage)
    expect(withOverride).toBeLessThan(baseline);
  });

  it("UI-style combo override (buildBuffOverrides) also affects off-field damage", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    // Find VV's team-receiver (res reduction) buff
    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    expect(vvMatch).toBeDefined();
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    const entry =
      tb.charBuilds.furina.charBase.getFormulaEntry("furina-salon-total");
    expect(entry).toBeDefined();

    const combo: ComboFormula = {
      id: "c",
      label: { en: "salon", zh: "salon" },
      lines: [{ charId: "furina", formulaId: "furina-salon-total", count: 1 }],
    };
    const activeLines = combo.lines;

    // Baseline
    const baseline = tb.getComboDamageResult(combo, sheets, CTX).totalDamage;

    // UI-style combo overrides for this formula
    const comboOverrides: Record<string, BuffActivationMap> = {
      "furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };

    const built = buildBuffOverrides(
      activeLines,
      tb,
      sheets,
      CTX,
      comboOverrides
    );
    expect(built).toBeDefined();

    const withOverride = tb.getComboDamageResult(
      combo,
      sheets,
      CTX,
      built
    ).totalDamage;

    expect(withOverride).toBeLessThan(baseline);
  });

  it("multi-formula combo: disabling VV changes only off-field salon damage proportionally", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    // Combo: bubble (on-field) + salon (off-field) + burst (on-field)
    const combo: ComboFormula = {
      id: "c",
      label: { en: "furinaCombo", zh: "furinaCombo" },
      lines: [
        { charId: "furina", formulaId: "furina-skill-bubble", count: 1 },
        { charId: "furina", formulaId: "furina-salon-total", count: 1 },
        { charId: "furina", formulaId: "furina-burst", count: 1 },
      ],
    };

    const baselineResult = tb.getComboDisplayResult(combo, sheets, CTX);
    const baselineSalon = baselineResult.partsByFormula[
      "furina.furina-salon-total"
    ]!.reduce((s, p) => s + p.damage * (p.hits ?? 1), 0);

    // Disable VV for all formulas where it applies
    const salonEntry =
      tb.charBuilds.furina.charBase.getFormulaEntry("furina-salon-total")!;
    const bubbleEntry = tb.charBuilds.furina.charBase.getFormulaEntry(
      "furina-skill-bubble"
    )!;
    const burstEntry =
      tb.charBuilds.furina.charBase.getFormulaEntry("furina-burst")!;

    const comboOverrides: Record<string, BuffActivationMap> = {
      "furina.furina-salon-total": { [vvKey]: {} },
      "furina.furina-skill-bubble": { [vvKey]: {} },
      "furina.furina-burst": { [vvKey]: {} },
    };
    for (let i = 0; i < salonEntry.parts.length; i++)
      comboOverrides["furina.furina-salon-total"][vvKey][i] = 0;
    for (let i = 0; i < bubbleEntry.parts.length; i++)
      comboOverrides["furina.furina-skill-bubble"][vvKey][i] = 0;
    for (let i = 0; i < burstEntry.parts.length; i++)
      comboOverrides["furina.furina-burst"][vvKey][i] = 0;

    const built = buildBuffOverrides(
      combo.lines,
      tb,
      sheets,
      CTX,
      comboOverrides
    );

    const withOverride = tb.getComboDisplayResult(combo, sheets, CTX, built);
    const overrideSalon = withOverride.partsByFormula[
      "furina.furina-salon-total"
    ]!.reduce((s, p) => s + p.damage * (p.hits ?? 1), 0);

    expect(withOverride.totalDamage).toBeLessThan(baselineResult.totalDamage);
    expect(overrideSalon).toBeLessThan(baselineSalon);
  });

  it("Furina herself wearing VV 4pc: overriding VV should reduce salon damage", () => {
    // Furina wearing VV herself — buff provider = formula char
    const selfVvTeam: TeamSlotConfig[] = [
      {
        charId: "furina",
        charLevel: 90,
        constellation: 0,
        weaponId: "splendor_of_tranquil_waters",
        refinement: 1,
        artifactSet: { type: "4pc", setId: "viridescent_venerer" },
      },
      {
        charId: "kaedehara_kazuha",
        charLevel: 90,
        constellation: 0,
        weaponId: "iron_sting",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "sacrificial_sword",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "bennett",
        charLevel: 90,
        constellation: 0,
        weaponId: "aquila_favonia",
        refinement: 1,
        artifactSet: null,
      },
    ];

    const tb = new TeamBuild(selfVvTeam);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "furina" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    expect(vvMatch).toBeDefined();
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    const combo: ComboFormula = {
      id: "__single__",
      label: { en: "single", zh: "single" },
      lines: [{ charId: "furina", formulaId: "furina-salon-total", count: 1 }],
    };

    const formulaOverrides: Record<string, BuffActivationMap> = {
      "furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };

    const built = buildBuffOverrides(
      combo.lines,
      tb,
      sheets,
      CTX,
      formulaOverrides
    );
    console.log("Self-VV buildBuffOverrides:", JSON.stringify(built, null, 2));

    const baseline = calcComboResults(tb, combo, sheets, CTX)!;
    const withOverride = calcComboResults(tb, combo, sheets, CTX, built)!;

    console.log(
      "Self-VV baseline:",
      baseline.totalDamage,
      "withOverride:",
      withOverride.totalDamage
    );
    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
  });

  it("DamageDetail flow: UI-like calcComboResults with buildBuffOverrides", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    // Single-mode synthetic combo (id="__single__", one line, count=1)
    const combo: ComboFormula = {
      id: "__single__",
      label: { en: "single", zh: "single" },
      lines: [{ charId: "furina", formulaId: "furina-salon-total", count: 1 }],
    };

    // Simulate extractComboOverrides output (prefix already stripped)
    const formulaOverrides: Record<string, BuffActivationMap> = {
      "furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };

    const built = buildBuffOverrides(
      combo.lines,
      tb,
      sheets,
      CTX,
      formulaOverrides
    );
    console.log("buildBuffOverrides result:", JSON.stringify(built, null, 2));

    const baseline = calcComboResults(tb, combo, sheets, CTX)!;
    const withOverride = calcComboResults(tb, combo, sheets, CTX, built)!;

    console.log(
      "baseline:",
      baseline.totalDamage,
      "withOverride:",
      withOverride.totalDamage
    );
    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
  });

  it("forceOnField combo line: VV override still reduces damage", () => {
    // User sets forceOnField=true on furina-salon-total combo line (e.g. via
    // reaction config), then tries to override VV. The override should still
    // reduce damage — the part is now treated as on-field for stats, but VV
    // (team-receiver) applies regardless of field state.
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    const combo: ComboFormula = {
      id: "c",
      label: { en: "forced", zh: "forced" },
      lines: [
        {
          charId: "furina",
          formulaId: "furina-salon-total",
          count: 1,
          forceOnField: true,
        },
      ],
    };

    const baseline = calcComboResults(tb, combo, sheets, CTX)!;

    const comboOverrides: Record<string, BuffActivationMap> = {
      "furina.furina-salon-total": { [vvKey]: { 0: 0, 1: 0, 2: 0 } },
    };
    const built = buildBuffOverrides(
      combo.lines,
      tb,
      sheets,
      CTX,
      comboOverrides
    );
    const withOverride = calcComboResults(tb, combo, sheets, CTX, built)!;

    console.log(
      "forceOnField — baseline:",
      baseline.totalDamage,
      "withOverride:",
      withOverride.totalDamage
    );
    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
  });

  it("single-mode UI store flow: comboOverrides[combo:__single__:...] survives extract+build and reduces damage", () => {
    // Reproduces the user's bug: in single mode, the dialog writes to
    // useBuffOverrideStore.comboOverrides with key
    // "combo:__single__:furina.furina-salon-total". DamageDetail runs
    // extractComboOverrides(storeOverrides, "__single__") → buildBuffOverrides
    // → calcComboResults. The whole chain must end in a strictly smaller
    // damage when VV is disabled.
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    const combo: ComboFormula = {
      id: "__single__",
      label: { en: "single", zh: "single" },
      lines: [{ charId: "furina", formulaId: "furina-salon-total", count: 1 }],
    };

    // Shape written by PartBuffDialog / BuffDialog via setComboHits
    const comboStoreOverrides: Record<string, BuffActivationMap> = {
      [`combo:${combo.id}:furina.furina-salon-total`]: {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };

    const formulaOverrides = extractComboOverrides(
      comboStoreOverrides,
      combo.id
    );
    expect(formulaOverrides).toBeDefined();
    expect(formulaOverrides!["furina.furina-salon-total"]).toBeDefined();

    const built = buildBuffOverrides(
      combo.lines,
      tb,
      sheets,
      CTX,
      formulaOverrides
    );

    const baseline = calcComboResults(tb, combo, sheets, CTX)!;
    const withOverride = calcComboResults(tb, combo, sheets, CTX, built)!;
    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
  });

  it("getComboDisplayResult: per-formula display parts and totalDamage reflect override", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );

    const vvMatch = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    );
    const vvKey = getBuffInstanceKey(vvMatch!.buff, vvMatch!.providerCharId);

    const combo: ComboFormula = {
      id: "c",
      label: { en: "salon", zh: "salon" },
      lines: [{ charId: "furina", formulaId: "furina-salon-total", count: 1 }],
    };

    const baseline = tb.getComboDisplayResult(combo, sheets, CTX);
    const baselinePartDamage = baseline.partsByFormula[
      "furina.furina-salon-total"
    ]!.reduce((s, p) => s + p.damage * (p.hits ?? 1), 0);

    // Override all salon parts
    const comboOverrides: Record<string, BuffActivationMap> = {
      "furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };
    const built = buildBuffOverrides(
      combo.lines,
      tb,
      sheets,
      CTX,
      comboOverrides
    );

    const withOverride = tb.getComboDisplayResult(combo, sheets, CTX, built);
    const overridePartDamage = withOverride.partsByFormula[
      "furina.furina-salon-total"
    ]!.reduce((s, p) => s + p.damage * (p.hits ?? 1), 0);

    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
    expect(overridePartDamage).toBeLessThan(baselinePartDamage);
  });
});

// ─── buffOverride × forceOnField (single and combo mode, UI flow) ──────────

/**
 * Mini TeamLike shape that `getEffectiveCombo` accepts. Mirrors the UI:
 * single mode → synthesized 1-line combo with `singleReaction`.
 * combo mode → entry from `team.combos[selectedCombo]`.
 */
type TeamLike = {
  formulaMode: "single" | "combo";
  selectedFormula: { charId: string; formulaId: string } | null;
  singleReaction?: ReactionOverride;
  singleForceOnField?: boolean;
  combo: ComboFormula | null;
};

/**
 * UI damage-calc flow: mirror DamageDetail.tsx exactly. Reads overrides out
 * of the flat store, builds per-line BuffActivationMap, runs calcComboResults.
 */
function runUiFlow(
  tb: TeamBuild,
  team: TeamLike,
  sheets: Record<string, import("@/lib/team-comp/calc/statSheet").StatSheet>,
  storeOverrides: Record<string, BuffActivationMap>
) {
  const displayCombo = getEffectiveCombo(team);
  const formulaOverrides = extractComboOverrides(
    storeOverrides,
    displayCombo.id
  );
  const built = buildBuffOverrides(
    displayCombo.lines.filter((l) => l.count > 0),
    tb,
    sheets,
    CTX,
    formulaOverrides
  );
  return {
    displayCombo,
    result: calcComboResults(tb, displayCombo, sheets, CTX, built)!,
  };
}

describe("buffOverride × forceOnField UI flow", () => {
  it("single mode + forceOnField + VV override: damage is reduced", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );
    const vv = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    )!;
    const vvKey = getBuffInstanceKey(vv.buff, vv.providerCharId);

    const team: TeamLike = {
      formulaMode: "single",
      selectedFormula: { charId: "furina", formulaId: "furina-salon-total" },
      singleForceOnField: true,
      combo: null,
    };

    const baseline = runUiFlow(tb, team, sheets, {}).result;

    // Single-mode dialog writes to `combo:__single__:furina.furina-salon-total`
    const store: Record<string, BuffActivationMap> = {
      "combo:__single__:furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };
    const { displayCombo, result: withOverride } = runUiFlow(
      tb,
      team,
      sheets,
      store
    );

    // Single-mode MUST synthesize `forceOnField` into the combo line.
    expect(displayCombo.lines[0].forceOnField).toBe(true);
    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
  });

  it("combo mode + forceOnField on line + VV override: damage is reduced", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );
    const vv = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    )!;
    const vvKey = getBuffInstanceKey(vv.buff, vv.providerCharId);

    const combo: ComboFormula = {
      id: "myCombo",
      label: { en: "combo", zh: "combo" },
      lines: [
        {
          charId: "furina",
          formulaId: "furina-salon-total",
          count: 1,
          forceOnField: true,
        },
      ],
    };
    const team: TeamLike = {
      formulaMode: "combo",
      selectedFormula: null,
      combo,
    };

    const baseline = runUiFlow(tb, team, sheets, {}).result;

    const store: Record<string, BuffActivationMap> = {
      "combo:myCombo:furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };
    const { result: withOverride } = runUiFlow(tb, team, sheets, store);

    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
  });

  it("single ≡ combo: same formula, same reaction, same override → identical damage", () => {
    // Regression guard against the bug class "single and combo modes compute
    // damage differently given the same inputs". The UI treats them as modes
    // with separate state, but damage calc must be mode-agnostic.
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );
    const vv = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    )!;
    const vvKey = getBuffInstanceKey(vv.buff, vv.providerCharId);

    // Single mode: override stored under combo:__single__:...
    const singleTeam: TeamLike = {
      formulaMode: "single",
      selectedFormula: { charId: "furina", formulaId: "furina-salon-total" },
      singleForceOnField: true,
      combo: null,
    };
    const singleStore: Record<string, BuffActivationMap> = {
      "combo:__single__:furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };

    // Combo mode: same formula, same reaction, override keyed by combo id.
    const comboTeam: TeamLike = {
      formulaMode: "combo",
      selectedFormula: null,
      combo: {
        id: "c",
        label: { en: "c", zh: "c" },
        lines: [
          {
            charId: "furina",
            formulaId: "furina-salon-total",
            count: 1,
            forceOnField: true,
          },
        ],
      },
    };
    const comboStore: Record<string, BuffActivationMap> = {
      "combo:c:furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };

    const single = runUiFlow(tb, singleTeam, sheets, singleStore).result;
    const combo = runUiFlow(tb, comboTeam, sheets, comboStore).result;

    expect(single.totalDamage).toBe(combo.totalDamage);
  });

  it("single mode WITHOUT forceOnField + VV override: damage is reduced", () => {
    // Matches the user-reported original scenario: Furina salon formula
    // (off-field parts) + VV 4pc from a teammate + no forceOnField flag.
    // The UI flow must propagate the override through to the calc.
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );
    const vv = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    )!;
    const vvKey = getBuffInstanceKey(vv.buff, vv.providerCharId);

    const team: TeamLike = {
      formulaMode: "single",
      selectedFormula: { charId: "furina", formulaId: "furina-salon-total" },
      combo: null,
    };

    const baseline = runUiFlow(tb, team, sheets, {}).result;

    const store: Record<string, BuffActivationMap> = {
      "combo:__single__:furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };
    const { result: withOverride } = runUiFlow(tb, team, sheets, store);

    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
  });

  it("combo mode WITHOUT forceOnField on line + VV override: damage is reduced", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );
    const vv = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    )!;
    const vvKey = getBuffInstanceKey(vv.buff, vv.providerCharId);

    const combo: ComboFormula = {
      id: "myCombo",
      label: { en: "combo", zh: "combo" },
      lines: [{ charId: "furina", formulaId: "furina-salon-total", count: 1 }],
    };
    const team: TeamLike = {
      formulaMode: "combo",
      selectedFormula: null,
      combo,
    };

    const baseline = runUiFlow(tb, team, sheets, {}).result;

    const store: Record<string, BuffActivationMap> = {
      "combo:myCombo:furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };
    const { result: withOverride } = runUiFlow(tb, team, sheets, store);

    expect(withOverride.totalDamage).toBeLessThan(baseline.totalDamage);
  });

  it("single mode without forceOnField ≡ combo mode without forceOnField", () => {
    // Same equivalence without forceOnField, to ensure parity is not accidental.
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets(
      "furina",
      "kaedehara_kazuha",
      "xingqiu",
      "bennett"
    );
    const vv = tb.buffLedger.allBuffs.find(
      (b) =>
        b.providerCharId === "kaedehara_kazuha" &&
        b.buff.source.type === "artifactSet" &&
        b.buff.source.id === "viridescent_venerer" &&
        b.buff.target.receiver === "team"
    )!;
    const vvKey = getBuffInstanceKey(vv.buff, vv.providerCharId);

    const singleTeam: TeamLike = {
      formulaMode: "single",
      selectedFormula: { charId: "furina", formulaId: "furina-salon-total" },
      combo: null,
    };
    const singleStore: Record<string, BuffActivationMap> = {
      "combo:__single__:furina.furina-salon-total": {
        [vvKey]: { 0: 0, 1: 0, 2: 0 },
      },
    };

    const comboTeam: TeamLike = {
      formulaMode: "combo",
      selectedFormula: null,
      combo: {
        id: "c",
        label: { en: "c", zh: "c" },
        lines: [
          { charId: "furina", formulaId: "furina-salon-total", count: 1 },
        ],
      },
    };
    const comboStore: Record<string, BuffActivationMap> = {
      "combo:c:furina.furina-salon-total": { [vvKey]: { 0: 0, 1: 0, 2: 0 } },
    };

    const single = runUiFlow(tb, singleTeam, sheets, singleStore).result;
    const combo = runUiFlow(tb, comboTeam, sheets, comboStore).result;

    expect(single.totalDamage).toBe(combo.totalDamage);
  });
});
