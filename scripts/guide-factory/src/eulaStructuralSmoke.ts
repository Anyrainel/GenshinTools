import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { DamageReplayInput } from "./computationReplay";

/**
 * Calculator integration fixture only.
 *
 * Empty artifact sheets and a single Eula Skill tap deliberately avoid
 * inventing an artifact allocation or rotation. This is not guide evidence.
 */
export const EULA_STRUCTURAL_SMOKE: DamageReplayInput = {
  replayId: "eula-selected-loadout-structural-smoke-v1",
  evidence: {
    classification: "structural_smoke",
    supportsGuideClaims: false,
    notes: [
      "All four artifact sheets are intentionally empty; this fixture does not model authored main stats or substat rolls.",
      "The damage objective is one Eula Skill tap, not a rotation or a formula-count recommendation.",
      "Level 90, C0, R1, and 10/10/10 talents are explicit structural assumptions, not facts imported from the team preset.",
      "Weapon base stats use the calculator's implicit level-90 model because TeamSlotConfig has no weapon-level field.",
      "Selected weapons and artifact sets reproduce one current GenshinTools team record, but their optimality is not asserted.",
    ],
    sourceRefs: [
      {
        kind: "knowledge_record",
        recordId: "genshintools-presets:team:1ZC3ATIWeGrK1fWd0N",
        supports: ["roster", "selected_weapons", "selected_artifact_sets"],
      },
    ],
  },
  teamConfigs: [
    {
      charId: "eula",
      charLevel: 90,
      constellation: 0,
      weaponId: "song_of_broken_pines",
      refinement: 1,
      artifactSet: { type: "4pc", setId: "pale_flame" },
      talentLevels: { auto: 10, skill: 10, burst: 10 },
    },
    {
      charId: "furina",
      charLevel: 90,
      constellation: 0,
      weaponId: "splendor_of_tranquil_waters",
      refinement: 1,
      artifactSet: { type: "4pc", setId: "golden_troupe" },
      talentLevels: { auto: 10, skill: 10, burst: 10 },
    },
    {
      charId: "mika",
      charLevel: 90,
      constellation: 0,
      weaponId: "favonius_lance",
      refinement: 1,
      artifactSet: { type: "4pc", setId: "noblesse_oblige" },
      talentLevels: { auto: 10, skill: 10, burst: 10 },
    },
    {
      charId: "raiden_shogun",
      charLevel: 90,
      constellation: 0,
      weaponId: "engulfing_lightning",
      refinement: 1,
      artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
      talentLevels: { auto: 10, skill: 10, burst: 10 },
    },
  ],
  combatOptions: {},
  enemyAura: null,
  extraBuffs: [],
  calcContext: {
    enemyLevel: 110,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  },
  combo: {
    id: "eula-one-skill-tap-structural-only",
    label: {
      en: "One Eula Skill tap (structural only)",
      zh: "优菈元素战技点按一次（仅结构测试）",
    },
    lines: [
      {
        charId: "eula",
        formulaId: "eula-skill-tap",
        count: 1,
        reaction: null,
        forceOnField: false,
      },
    ],
  },
  artifactSheets: {
    eula: new StatSheet([]),
    furina: new StatSheet([]),
    mika: new StatSheet([]),
    raiden_shogun: new StatSheet([]),
  },
  formulaBuffOverrides: null,
};
