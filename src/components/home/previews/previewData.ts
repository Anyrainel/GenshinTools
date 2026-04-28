/**
 * Fake data objects for Welcome Guide preview components.
 * All data here is static sample data — never used in production logic.
 */

import type { Slot } from "@/data/enums";
import type { ArtifactData, Build } from "@/data/types";
import type { BuildEvaluation } from "@/lib/account-data/buildEvaluation";
import type { ScoreUpAction } from "@/lib/account-data/scoreUpEngine";
import type { TriageDecision } from "@/lib/account-data/triage/types";
import type { I18nLabel } from "@/lib/dmgcalc/types";
import type { WeaponRanking } from "@/lib/team-comp/types";

function fakeArtifact(
  id: string,
  setKey: string,
  slotKey: Slot,
  mainStatKey: string,
  level: number,
  rarity: 4 | 5 = 5,
  lock = false,
  astralMark = false
): ArtifactData {
  return {
    id,
    setKey,
    slotKey,
    level,
    rarity,
    mainStatKey,
    lock,
    substats: {},
    astralMark,
  } as ArtifactData;
}

// ── Step 1 Tab 3: Recommendations ──

export const PREVIEW_RECOMMENDATIONS: ScoreUpAction[] = [
  {
    actionType: "swap",
    characterId: "mavuika",
    slot: "sands",
    sourceArtifactId: "preview-src-1",
    currentArtifactId: "preview-cur-1",
    setKey: "obsidian_codex",
    slotScoreDiff: 3.6,
    buildScoreDiff: 3.6,
    maxPotentialScore: 50,
  },
  {
    actionType: "upgrade",
    characterId: "mavuika",
    slot: "circlet",
    sourceArtifactId: "preview-src-2",
    currentArtifactId: "preview-cur-2",
    setKey: "obsidian_codex",
    slotScoreDiff: 7.2,
    buildScoreDiff: 7.2,
    maxPotentialScore: 50,
  },
];

export const PREVIEW_ARTIFACT_LOOKUP = new Map<string, ArtifactData>([
  [
    "preview-cur-1",
    fakeArtifact("preview-cur-1", "obsidian_codex", "sands", "atk%", 20),
  ],
  [
    "preview-src-1",
    fakeArtifact("preview-src-1", "obsidian_codex", "sands", "atk%", 20),
  ],
  [
    "preview-cur-2",
    fakeArtifact("preview-cur-2", "obsidian_codex", "circlet", "cr", 12),
  ],
  [
    "preview-src-2",
    fakeArtifact("preview-src-2", "obsidian_codex", "circlet", "cr", 12),
  ],
]);

// ── Step 1 Tab 4: Build Evaluation ──

export const PREVIEW_EVALUATION: BuildEvaluation = {
  evalBuild: {
    key: "preview-eval",
    artifactSet: "obsidian_codex",
    composition: "4pc",
    flexCount: 1,
    builds: [],
    characterIds: ["mavuika"],
    weights: {},
    mainStats: {
      sands: ["atk%"],
      goblet: ["pyro%"],
      circlet: ["cr", "cd"],
    },
    sortedSubstats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 100 },
      { stat: "em", weight: 75 },
    ],
    scalingStat: "atk",
    archetypeRole: "dps",
  },
  slots: {
    flower: {
      artifact: fakeArtifact("ev-f", "obsidian_codex", "flower", "hp", 20),
      score: 42,
      maxScore: 50,
      isFlexSlot: false,
    },
    plume: {
      artifact: fakeArtifact("ev-p", "obsidian_codex", "plume", "atk", 20),
      score: 38,
      maxScore: 50,
      isFlexSlot: false,
    },
    sands: {
      artifact: fakeArtifact("ev-s", "obsidian_codex", "sands", "atk%", 20),
      score: 35,
      maxScore: 50,
      isFlexSlot: false,
    },
    goblet: {
      artifact: fakeArtifact("ev-g", "obsidian_codex", "goblet", "pyro%", 20),
      score: 28,
      maxScore: 50,
      isFlexSlot: true,
    },
    circlet: {
      artifact: fakeArtifact("ev-c", "obsidian_codex", "circlet", "cr", 20),
      score: 40,
      maxScore: 50,
      isFlexSlot: false,
    },
  },
  totalScore: 183,
  totalMaxScore: 250,
  completeness: 0.73,
};

// ── Step 1 Tab 5: Triage Decisions ──

const triageLockArtifact = fakeArtifact(
  "tri-lock",
  "obsidian_codex",
  "flower",
  "hp",
  16,
  5,
  true
);
const triageUnlockArtifact = fakeArtifact(
  "tri-unlock",
  "gladiators_finale",
  "sands",
  "def%",
  8,
  5,
  false
);

export const PREVIEW_TRIAGE_LOCK: TriageDecision = {
  artifact: triageLockArtifact,
  label: "lock",
  decidingResult: {
    embryo: {
      demand: {
        buildId: "b1",
        characterId: "mavuika",
        demandSource: { type: "4pc", setKey: "obsidian_codex" },
        slot: "flower",
        acceptedMainStats: ["hp"],
        coreStats: ["cr", "cd", "atk%"],
        valuableStats: ["em"],
      },
      grade: {
        coreCount: 3,
        valuableCount: 1,
        minorCount: 0,
        unwantedCount: 0,
        totalCount: 4,
        initial4Line: true,
      },
      embryoKey: "obsidian_codex|flower|hp|cr,cd,atk%",
    },
    label: "lock",
    ruleId: "primeTierKeep",
    reason: "",
    reasonArgs: [],
    tier: "prime",
  },
  allResults: [],
  specialRules: [],
  supplyDemand: null,
};

export const PREVIEW_TRIAGE_UNLOCK: TriageDecision = {
  artifact: triageUnlockArtifact,
  label: "unlock",
  decidingResult: {
    embryo: {
      demand: {
        buildId: "b2",
        characterId: "bennett",
        demandSource: { type: "4pc", setKey: "gladiator_finale" },
        slot: "sands",
        acceptedMainStats: ["hp%"],
        coreStats: ["er", "hp%"],
        valuableStats: ["cr"],
      },
      grade: {
        coreCount: 0,
        valuableCount: 0,
        minorCount: 1,
        unwantedCount: 3,
        totalCount: 4,
        initial4Line: true,
      },
      embryoKey: "gladiator_finale|sands|def%|er,hp%",
    },
    label: "unlock",
    ruleId: "fillerDefaultUnlock",
    reason: "",
    reasonArgs: [],
    tier: "filler",
  },
  allResults: [],
  specialRules: [],
  supplyDemand: null,
};

// ── Step 2: Build (zibai preset data) ──

export const PREVIEW_BUILD: Build = {
  id: "preview-zibai",
  source: "preset",
  characterId: "zibai",
  visible: true,
  name: "",
  composition: "4pc",
  artifactSet: "night_of_the_skys_unveiling",
  styles: ["on-field"],
  roles: ["dps"],
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
    { stat: "def%", weight: 100 },
    { stat: "em", weight: 50 },
  ],
  sandsWeights: [{ stat: "def%", weight: 100 }],
  gobletWeights: [{ stat: "def%", weight: 100 }],
  circletWeights: [
    { stat: "cd", weight: 100 },
    { stat: "def%", weight: 100 },
  ],
  normalizer: 300 / 50,
};

// ── Step 3 Tab 4: Weapon Rankings (skirk) ──

export const PREVIEW_WEAPON_RANKINGS: WeaponRanking[] = [
  {
    weaponId: "azurelight",
    refinement: 5,
    damage: 113200,
    percentOfBest: 113.2,
  },
  {
    weaponId: "azurelight",
    refinement: 1,
    damage: 100000,
    percentOfBest: 100.0,
  },
  {
    weaponId: "absolution",
    refinement: 1,
    damage: 98900,
    percentOfBest: 98.9,
  },
  {
    weaponId: "mistsplitter_reforged",
    refinement: 1,
    damage: 93800,
    percentOfBest: 93.8,
  },
  {
    weaponId: "the_black_sword",
    refinement: 5,
    damage: 87400,
    percentOfBest: 87.4,
  },
];

// ── Step 3 Tab 2: Frozen character artifacts ──

export const PREVIEW_FROZEN_ARTIFACTS: Record<Slot, ArtifactData> = {
  flower: fakeArtifact(
    "fz-f",
    "night_of_the_skys_unveiling",
    "flower",
    "hp",
    20,
    5,
    true,
    true
  ),
  plume: fakeArtifact(
    "fz-p",
    "night_of_the_skys_unveiling",
    "plume",
    "atk",
    20,
    5,
    true
  ),
  sands: fakeArtifact(
    "fz-s",
    "night_of_the_skys_unveiling",
    "sands",
    "def%",
    20,
    5,
    true
  ),
  goblet: fakeArtifact(
    "fz-g",
    "night_of_the_skys_unveiling",
    "goblet",
    "def%",
    20,
    5,
    true
  ),
  circlet: fakeArtifact(
    "fz-c",
    "night_of_the_skys_unveiling",
    "circlet",
    "cd",
    20,
    5,
    true,
    true
  ),
};

// ── Step 3 Tab 3: Investment path sample teams ──

export const PREVIEW_INVESTMENT_CHAR_IDS = [
  "mavuika",
  "furina",
  "citlali",
  "bennett",
];

// ── Step 3 Tab 1: Team characters for damage preview ──

export const PREVIEW_DAMAGE_TEAM = ["mavuika", "furina", "citlali", "bennett"];

/** Formula label from mavuika's real implementation (character5Natlan.ts) */
export const PREVIEW_FORMULA_LABEL: I18nLabel = {
  zh: "Q后 AZS",
  en: "Post-Q N1+CA+Sprint",
};
