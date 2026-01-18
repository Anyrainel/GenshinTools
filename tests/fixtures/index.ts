/**
 * Centralized test fixtures for reusable mock data.
 * These fixtures are complete, type-safe representations of domain objects.
 */

import type {
  AccountData,
  ArtifactData,
  CharacterData,
  WeaponData,
} from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/artifactScore";

// ============================================================================
// Character Fixtures
// ============================================================================

export const createCharacterData = (
  overrides: Partial<CharacterData> = {}
): CharacterData => ({
  key: "hu_tao",
  level: 90,
  constellation: 1,
  talent: { auto: 10, skill: 10, burst: 10 },
  weapon: undefined,
  artifacts: {
    flower: undefined,
    plume: undefined,
    sands: undefined,
    goblet: undefined,
    circlet: undefined,
  },
  ...overrides,
});

export const MOCK_CHARACTERS = {
  huTao: createCharacterData({
    key: "hu_tao",
    constellation: 1,
    weapon: {
      id: "w1",
      key: "staff_of_homa",
      level: 90,
      refinement: 1,
      lock: false,
    },
  }),
  xingqiu: createCharacterData({
    key: "xingqiu",
    level: 80,
    constellation: 6,
    talent: { auto: 6, skill: 10, burst: 10 },
  }),
  zhongli: createCharacterData({
    key: "zhongli",
    level: 90,
    constellation: 0,
  }),
  bennett: createCharacterData({
    key: "bennett",
    level: 80,
    constellation: 6,
  }),
} as const;

// ============================================================================
// Weapon Fixtures
// ============================================================================

export const createWeaponData = (
  overrides: Partial<WeaponData> = {}
): WeaponData => ({
  id: "weapon-1",
  key: "staff_of_homa",
  level: 90,
  refinement: 1,
  lock: false,
  ...overrides,
});

export const MOCK_WEAPONS = {
  staffOfHoma: createWeaponData({ key: "staff_of_homa", refinement: 1 }),
  amosBow: createWeaponData({
    id: "w2",
    key: "amos_bow",
    level: 80,
    refinement: 2,
  }),
  sacrificialSword: createWeaponData({
    id: "w3",
    key: "sacrificial_sword",
    refinement: 5,
  }),
} as const;

// ============================================================================
// Artifact Fixtures
// ============================================================================

export const createArtifactData = (
  overrides: Partial<ArtifactData> = {}
): ArtifactData => ({
  id: "art-1",
  setKey: "crimson_witch_of_flames",
  slotKey: "flower",
  level: 20,
  rarity: 5,
  lock: false,
  mainStatKey: "hp",
  substats: { cr: 10.5, cd: 21.0, em: 23, atk: 35 },
  ...overrides,
});

export const MOCK_ARTIFACTS = {
  crimsonFlower: createArtifactData({
    id: "art-1",
    setKey: "crimson_witch_of_flames",
    slotKey: "flower",
  }),
  crimsonPlume: createArtifactData({
    id: "art-2",
    setKey: "crimson_witch_of_flames",
    slotKey: "plume",
    mainStatKey: "atk",
  }),
  emblemSands: createArtifactData({
    id: "art-3",
    setKey: "emblem_of_severed_fate",
    slotKey: "sands",
    mainStatKey: "er",
  }),
  fourStarArtifact: createArtifactData({
    id: "art-4star",
    rarity: 4,
    level: 16,
    substats: { cr: 3.5, cd: 7.0 },
  }),
} as const;

// ============================================================================
// Account Data Fixtures
// ============================================================================

export const createAccountData = (
  overrides: Partial<AccountData> = {}
): AccountData => ({
  characters: [],
  extraArtifacts: [],
  extraWeapons: [],
  ...overrides,
});

export const MOCK_ACCOUNT_DATA = {
  empty: createAccountData(),
  withOneCharacter: createAccountData({
    characters: [MOCK_CHARACTERS.huTao],
  }),
  withMultipleCharacters: createAccountData({
    characters: [
      MOCK_CHARACTERS.huTao,
      MOCK_CHARACTERS.xingqiu,
      MOCK_CHARACTERS.zhongli,
    ],
  }),
  withInventory: createAccountData({
    characters: [MOCK_CHARACTERS.huTao],
    extraWeapons: [MOCK_WEAPONS.amosBow, MOCK_WEAPONS.sacrificialSword],
    extraArtifacts: [MOCK_ARTIFACTS.emblemSands],
  }),
} as const;

// ============================================================================
// Artifact Score Fixtures
// ============================================================================

export const createArtifactScoreResult = (
  overrides: Partial<ArtifactScoreResult> = {}
): ArtifactScoreResult => ({
  mainScore: 25,
  subScore: 45,
  slotMainScores: {},
  slotSubScores: {},
  slotMaxSubScores: {},
  statScores: {},
  isComplete: true,
  ...overrides,
});

export const MOCK_SCORES = {
  complete: createArtifactScoreResult({ isComplete: true }),
  incomplete: createArtifactScoreResult({ isComplete: false }),
  highScore: createArtifactScoreResult({ mainScore: 40, subScore: 80 }),
  lowScore: createArtifactScoreResult({ mainScore: 10, subScore: 20 }),
  zero: createArtifactScoreResult({
    mainScore: 0,
    subScore: 0,
    isComplete: false,
  }),
} as const;

// ============================================================================
// Tier Assignment Fixtures
// ============================================================================

export const MOCK_TIER_ASSIGNMENTS = {
  empty: {},
  singleSTier: {
    hu_tao: { tier: "S", position: 0 },
  },
  multipleCharacters: {
    hu_tao: { tier: "S", position: 0 },
    xingqiu: { tier: "A", position: 0 },
    zhongli: { tier: "A", position: 1 },
  },
  fullSpread: {
    hu_tao: { tier: "S", position: 0 },
    xingqiu: { tier: "A", position: 0 },
    zhongli: { tier: "B", position: 0 },
    bennett: { tier: "C", position: 0 },
  },
} as const;
