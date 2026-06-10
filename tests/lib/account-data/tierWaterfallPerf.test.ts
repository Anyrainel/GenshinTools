import { describe, expect, it } from "vitest";
import type { MainStat, Slot, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type {
  AccountData,
  ArtifactData,
  Build,
  CharacterData,
  TierAssignment,
} from "@/data/types";
import { runTierWaterfall } from "@/lib/account-data/tierWaterfall";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { createArtifactScoreResult } from "../../fixtures";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SETS = [
  "crimson_witch_of_flames",
  "emblem_of_severed_fate",
  "gladiators_finale",
  "shimenawas_reminiscence",
  "tenacity_of_the_millelith",
  "noblesse_oblige",
  "viridescent_venerer",
  "golden_troupe",
];

const SUB_KEYS: SubStat[] = [
  "cr",
  "cd",
  "atk%",
  "em",
  "er",
  "hp%",
  "def%",
  "atk",
  "hp",
  "def",
];

const MAIN_BY_SLOT: Record<Slot, MainStat[]> = {
  flower: ["hp"],
  plume: ["atk"],
  sands: ["atk%", "er", "em", "hp%"],
  goblet: ["pyro%", "atk%", "hp%", "em"],
  circlet: ["cr", "cd", "atk%", "hp%"],
};

function randomArtifact(rand: () => number, index: number): ArtifactData {
  const slot = allSlots[Math.floor(rand() * allSlots.length)];
  const mains = MAIN_BY_SLOT[slot];
  const substats: Partial<Record<SubStat, number>> = {};
  const picks = [...SUB_KEYS].sort(() => rand() - 0.5).slice(0, 4);
  for (const stat of picks) {
    substats[stat] = Math.round(rand() * 200) / 10 + 2;
  }
  return {
    id: `bench-${index}`,
    setKey: SETS[Math.floor(rand() * SETS.length)],
    slotKey: slot,
    level: [0, 4, 8, 16, 20][Math.floor(rand() * 5)],
    rarity: 5,
    mainStatKey: mains[Math.floor(rand() * mains.length)],
    lock: false,
    substats,
  };
}

function makeBuild(characterId: string, setKey: string): Build {
  return {
    id: `bench-build-${characterId}`,
    characterId,
    visible: true,
    roles: ["dps"],
    name: "Bench",
    composition: "4pc",
    artifactSet: setKey,
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 80 },
      { stat: "er", weight: 40 },
    ],
    sandsWeights: [
      { stat: "atk%", weight: 100 },
      { stat: "er", weight: 75 },
    ],
    gobletWeights: [{ stat: "pyro%", weight: 100 }],
    circletWeights: [
      { stat: "cd", weight: 100 },
      { stat: "cr", weight: 90 },
    ],
    normalizer: 1,
  };
}

const CHAR_KEYS = [
  "hu_tao",
  "xiangling",
  "bennett",
  "xingqiu",
  "raiden_shogun",
  "nahida",
  "kazuha",
  "furina",
];

describe("tier waterfall benchmark", () => {
  it("allocates a production-sized tier within seconds", () => {
    const rand = mulberry32(20260610);
    // Stress shape: many artifacts concentrated in few sets → large per-slot
    // candidate lists and heavy cross-character contention in one tier.
    const extraArtifacts = Array.from({ length: 1500 }, (_, i) => ({
      ...randomArtifact(rand, i),
      setKey: SETS[Math.floor(rand() * 4)],
    }));

    const characters: CharacterData[] = CHAR_KEYS.map((key, charIdx) => {
      const artifacts: Partial<Record<Slot, ArtifactData>> = {};
      for (const slot of allSlots) {
        artifacts[slot] = {
          ...randomArtifact(rand, 1000 + charIdx * 10 + allSlots.indexOf(slot)),
          slotKey: slot,
          mainStatKey: MAIN_BY_SLOT[slot][0],
          level: 20,
        };
      }
      return {
        key,
        level: 90,
        constellation: 0,
        talent: { auto: 9, skill: 9, burst: 9 },
        artifacts,
      };
    });

    const accountData: AccountData = {
      characters,
      extraArtifacts,
      extraWeapons: [],
    };
    const tierAssignments: TierAssignment = Object.fromEntries(
      CHAR_KEYS.map((key, i) => [key, { tier: "S" as const, position: i }])
    );
    const scores: Record<string, ArtifactScoreResult | null> =
      Object.fromEntries(
        CHAR_KEYS.map((key, i) => [
          key,
          createArtifactScoreResult({
            buildMatch: {
              build: makeBuild(key, SETS[i % 4]),
              statWeights: { cr: 100, cd: 100, "atk%": 80, er: 40 },
            },
          }),
        ])
      );

    const start = performance.now();
    const result = runTierWaterfall(accountData, scores, tierAssignments);
    const elapsedMs = performance.now() - start;

    const allocated = Object.values(result.perCharacter).filter(
      (a) => a.build !== null
    ).length;
    console.log(
      `[bench] ${allocated}/${CHAR_KEYS.length} chars allocated, ` +
        `${result.totalNodesExplored} nodes, ${elapsedMs.toFixed(0)}ms total ` +
        `(single S tier: 8 chars, 1540 artifacts in 4 sets)`
    );

    expect(allocated).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(20000);
  }, 60000);
});
