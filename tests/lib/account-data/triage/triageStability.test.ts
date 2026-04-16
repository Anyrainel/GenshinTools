import type {
  AccountData,
  ArtifactData,
  Build,
  MainStat,
  Slot,
  SubStat,
  WeightedMainStat,
  WeightedSubStat,
} from "@/data/types";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/defaults";
import { runTriage } from "@/lib/account-data/triage/triageEngine";
import type { TriageSettings } from "@/lib/account-data/triage/types";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) for reproducible randomness
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Valid value pools
// ---------------------------------------------------------------------------

const FIVE_STAR_SETS = [
  "emblem_of_severed_fate",
  "crimson_witch_of_flames",
  "viridescent_venerer",
  "gladiators_finale",
  "blizzard_strayer",
  "heart_of_depth",
  "husk_of_opulent_dreams",
  "deepwood_memories",
  "gilded_dreams",
  "tenacity_of_the_millelith",
  "noblesse_oblige",
  "pale_flame",
  "oceanhued_clam",
  "shimenawas_reminiscence",
  "echoes_of_an_offering",
  "vermillion_hereafter",
  "retracing_bolide",
  "thundering_fury",
  "archaic_petra",
  "marechaussee_hunter",
  "golden_troupe",
  "desert_pavilion_chronicle",
  "flower_of_paradise_lost",
  "nymphs_dream",
  "song_of_days_past",
  "fragment_of_harmonic_whimsy",
  "obsidian_codex",
  "scroll_of_the_hero_of_cinder_city",
  "unfinished_reverie",
  "nighttime_whispers_in_the_echoing_woods",
  "maiden_beloved",
  "silken_moons_serenade",
  "aubade_of_morningstar_and_moon",
  "a_day_carved_from_rising_winds",
  "long_nights_oath",
  "finale_of_the_deep_galleries",
  "night_of_the_skys_unveiling",
  "vourukashas_glow",
] as const;

const SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

const MAIN_STATS_BY_SLOT: Record<Slot, MainStat[]> = {
  flower: ["hp"],
  plume: ["atk"],
  sands: ["atk%", "hp%", "def%", "em", "er"],
  goblet: [
    "atk%",
    "hp%",
    "def%",
    "em",
    "pyro%",
    "hydro%",
    "anemo%",
    "electro%",
    "dendro%",
    "cryo%",
    "geo%",
    "phys%",
  ],
  circlet: ["cr", "cd", "atk%", "hp%", "def%", "em", "heal%"],
};

const ALL_SUBSTATS: SubStat[] = [
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "er",
  "em",
  "atk",
  "hp",
  "def",
];

// ---------------------------------------------------------------------------
// Random artifact generator
// ---------------------------------------------------------------------------

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateArtifact(rng: () => number, id: number): ArtifactData {
  const slot = pick(rng, SLOTS);
  const mainStat = pick(rng, MAIN_STATS_BY_SLOT[slot]);

  // Pick 3 or 4 substats (4-line = initial 4 substats)
  const numSubs = rng() < 0.2 ? 3 : 4;
  // Exclude main stat from substat pool for sands/goblet/circlet where overlap can occur
  const eligible = ALL_SUBSTATS.filter((s) => s !== mainStat);
  const chosenSubs = shuffle(rng, eligible).slice(0, numSubs);

  // Generate substat values (1-9 rolls worth of value)
  const substats: Partial<Record<SubStat, number>> = {};
  for (const sub of chosenSubs) {
    // Use rough average roll values scaled by random roll count
    const rolls = 1 + Math.floor(rng() * 6);
    substats[sub] = rolls;
  }

  const level = Math.floor(rng() * 21); // 0-20
  const lock = rng() < 0.5;

  return {
    id: `fuzz_${id}`,
    setKey: pick(rng, FIVE_STAR_SETS),
    slotKey: slot,
    mainStatKey: mainStat,
    level,
    lock,
    rarity: 5,
    substats,
    unactivatedSubstats: {},
  } as ArtifactData;
}

// ---------------------------------------------------------------------------
// Build generator — creates realistic builds covering various sets
// ---------------------------------------------------------------------------

const ELEMENTS: MainStat[] = [
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
];

function generateBuild(rng: () => number, charId: string, idx: number): Build {
  const set = pick(rng, FIVE_STAR_SETS);

  // Pick 3-4 desired substats with weights
  const numDesired = 3 + Math.floor(rng() * 2);
  const desiredStats = shuffle(rng, [...ALL_SUBSTATS]).slice(0, numDesired);
  const substats: WeightedSubStat[] = desiredStats.map((stat, i) => ({
    stat,
    weight: i === 0 ? 100 : Math.round(40 + rng() * 60),
  }));

  // Main stat weights
  const sandsPool: MainStat[] = ["atk%", "hp%", "def%", "em", "er"];
  const circletPool: MainStat[] = ["cr", "cd", "atk%", "hp%", "def%", "em"];
  const gobletPool: MainStat[] = ["atk%", "hp%", "def%", "em", ...ELEMENTS];

  const sandsWeights: WeightedMainStat[] = [
    { stat: pick(rng, sandsPool), weight: 100 },
  ];
  const gobletWeights: WeightedMainStat[] = [
    { stat: pick(rng, gobletPool), weight: 100 },
  ];
  const circletWeights: WeightedMainStat[] = [
    { stat: pick(rng, circletPool), weight: 100 },
  ];

  return {
    id: `build_${charId}_${idx}`,
    characterId: charId,
    name: `Build ${idx}`,
    visible: true,
    composition: "4pc" as const,
    artifactSet: set,
    substats,
    sandsWeights,
    gobletWeights,
    circletWeights,
    normalizer: 1,
  } as Build;
}

// ---------------------------------------------------------------------------
// Apply triage recommendations: flip lock status per decisions
// ---------------------------------------------------------------------------

function applyDecisions(
  artifacts: ArtifactData[],
  decisions: { artifact: ArtifactData; label: "lock" | "unlock" }[]
): ArtifactData[] {
  const decisionMap = new Map(decisions.map((d) => [d.artifact.id, d.label]));
  return artifacts.map((a) => {
    const label = decisionMap.get(a.id);
    if (!label) return a;
    return { ...a, lock: label === "lock" };
  });
}

// ---------------------------------------------------------------------------
// Count actual recommendations (changes from current lock state)
// ---------------------------------------------------------------------------

function countRecommendations(
  decisions: { artifact: ArtifactData; label: "lock" | "unlock" }[]
): { lockRecs: number; unlockRecs: number } {
  let lockRecs = 0;
  let unlockRecs = 0;
  for (const d of decisions) {
    if (d.label === "lock" && !d.artifact.lock) lockRecs++;
    if (d.label === "unlock" && d.artifact.lock) unlockRecs++;
  }
  return { lockRecs, unlockRecs };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("triage stability (fuzz)", () => {
  const SEEDS = [42, 1337, 2024, 9999, 314159];
  const ARTIFACT_COUNTS = [500, 1000, 2000];
  const CHARACTER_COUNT = 12;
  const BUILDS_PER_CHAR = 2;

  for (const count of ARTIFACT_COUNTS) {
    for (const seed of SEEDS) {
      it(`${count} artifacts, seed ${seed}: no swing-back after applying recommendations`, () => {
        const rng = mulberry32(seed);

        const artifacts: ArtifactData[] = [];
        for (let i = 0; i < count; i++) {
          artifacts.push(generateArtifact(rng, i));
        }

        // Generate characters with builds
        const charIds = Array.from(
          { length: CHARACTER_COUNT },
          (_, i) => `char_${i}`
        );
        const buildGroups = charIds.map((charId) => ({
          characterId: charId,
          builds: Array.from({ length: BUILDS_PER_CHAR }, (_, i) =>
            generateBuild(rng, charId, i)
          ),
        }));

        // Some artifacts are "equipped" on characters
        const equippedArts: ArtifactData[] = [];
        const extraArts: ArtifactData[] = [];
        const charsWithEquipment: Array<{
          key: string;
          constellation: number;
          artifacts: Partial<Record<Slot, ArtifactData>>;
        }> = charIds.map((key) => ({
          key,
          constellation: Math.floor(rng() * 7),
          artifacts: {},
        }));

        // Equip ~1 artifact per character per slot (if available)
        let artIdx = 0;
        for (const char of charsWithEquipment) {
          for (const slot of SLOTS) {
            if (artIdx >= artifacts.length) break;
            if (rng() < 0.3) {
              // 30% chance to have an equipped artifact for this slot
              const art = { ...artifacts[artIdx], slotKey: slot };
              char.artifacts[slot] = art as ArtifactData;
              equippedArts.push(art as ArtifactData);
              artIdx++;
            }
          }
        }
        // Rest go to extraArtifacts
        for (; artIdx < artifacts.length; artIdx++) {
          extraArts.push(artifacts[artIdx]);
        }

        const account: AccountData = {
          characters: charsWithEquipment,
          extraArtifacts: extraArts,
        } as unknown as AccountData;

        const settings: TriageSettings = {
          ...DEFAULT_TRIAGE_SETTINGS,
          ownedOnly: false, // include all characters
        };

        // --- Pass 1: initial triage ---
        const r1 = runTriage(account, buildGroups, settings);
        const { lockRecs: lockRecs1, unlockRecs: unlockRecs1 } =
          countRecommendations(r1.decisions);

        // Sanity: we should have some decisions
        expect(r1.decisions.length).toBeGreaterThan(0);

        // --- Apply recommendations ---
        const appliedEquipped = applyDecisions(equippedArts, r1.decisions);
        const appliedExtra = applyDecisions(extraArts, r1.decisions);

        // Rebuild account with applied lock states
        const account2: AccountData = {
          characters: charsWithEquipment.map((c) => ({
            ...c,
            artifacts: Object.fromEntries(
              Object.entries(c.artifacts).map(([slot, art]) => {
                const applied = appliedEquipped.find((a) => a.id === art!.id);
                return [slot, applied ?? art];
              })
            ),
          })),
          extraArtifacts: appliedExtra,
        } as unknown as AccountData;

        // --- Pass 2: re-run triage on the post-apply state ---
        const r2 = runTriage(account2, buildGroups, settings);
        const { lockRecs: lockRecs2, unlockRecs: unlockRecs2 } =
          countRecommendations(r2.decisions);

        // The key assertion: no new recommendations after applying
        if (lockRecs2 > 0 || unlockRecs2 > 0) {
          // Collect details for debugging
          const swingArts = r2.decisions.filter((d) => {
            if (d.label === "lock" && !d.artifact.lock) return true;
            if (d.label === "unlock" && d.artifact.lock) return true;
            return false;
          });
          const details = swingArts.slice(0, 10).map((d) => ({
            id: d.artifact.id,
            set: d.artifact.setKey,
            slot: d.artifact.slotKey,
            mainStat: d.artifact.mainStatKey,
            currentLock: d.artifact.lock,
            recommended: d.label,
            ruleId: d.decidingResult?.ruleId,
            specialRules: d.specialRules,
            tier: d.decidingResult?.tier,
          }));
          expect.fail(
            `[${count} arts, seed ${seed}] pass 1 had ${lockRecs1} lock + ${unlockRecs1} unlock recs. ` +
              `After applying, pass 2 still has ${lockRecs2} lock + ${unlockRecs2} unlock recs (should be 0). ` +
              `Sample swings:\n${JSON.stringify(details, null, 2)}`
          );
        }
      });
    }
  }
});
