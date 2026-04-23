import { substatRollTiers } from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/enums";
import type {
  AccountData,
  ArtifactData,
  Build,
  BuildPayloadV5,
} from "@/data/types";
import { toGOODArtifact } from "@/lib/account-data/manager/instructions";
import {
  applyJobResults,
  rebuildAccountFromSnapshot,
} from "@/lib/account-data/manager/storeSync";
import type {
  InstructionResult,
  ManagePayload,
} from "@/lib/account-data/manager/types";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/defaults";
import { runTriage } from "@/lib/account-data/triage/triageEngine";
import type { TriageSettings } from "@/lib/account-data/triage/types";
import presetJson from "@/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
import { describe, expect, it } from "vitest";

// Seeded PRNG (mulberry32) for reproducible randomness

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Preset build groups — real builds from the GGArtifact preset

const preset = presetJson as BuildPayloadV5;
const PRESET_BUILD_GROUPS: { characterId: string; builds: Build[] }[] = [];
for (const [charId, buildIds] of Object.entries(preset.characterBuilds)) {
  const builds = buildIds
    .map((id) => preset.builds[id])
    .filter((b): b is Build => !!b);
  if (builds.length > 0) {
    PRESET_BUILD_GROUPS.push({ characterId: charId, builds });
  }
}

// Valid value pools

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

/** 4 roll tier values per substat, in display format */
const ROLL_TIERS = substatRollTiers[5];

// Random artifact generator — realistic values

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

/** Pick a random roll tier value for the given substat */
function rollValue(rng: () => number, stat: SubStat): number {
  const tiers = ROLL_TIERS[stat];
  return tiers[Math.floor(rng() * 4)];
}

function generateArtifact(rng: () => number, id: number): ArtifactData {
  const slot = pick(rng, SLOTS);
  const mainStat = pick(rng, MAIN_STATS_BY_SLOT[slot]);

  // 80% 3-line initial, 20% 4-line initial
  const initialLines = rng() < 0.8 ? 3 : 4;

  // Level: 50% lv0, 50% uniform 1-20
  const level = rng() < 0.5 ? 0 : 1 + Math.floor(rng() * 20);

  // Total substat count: initial lines + upgrade rolls (one new substat per 4 levels)
  const upgradeRolls = Math.floor(level / 4);
  const totalRolls = initialLines + upgradeRolls;

  // Pick substats — exclude main stat from pool
  const eligible = ALL_SUBSTATS.filter((s) => s !== mainStat);

  // For 3-line initial: first 3 are activated, 4th is unactivated (revealed at +4)
  // For 4-line initial: all 4 are activated from the start
  const allChosen = shuffle(rng, eligible).slice(0, 4);
  const activatedKeys =
    initialLines === 3 ? allChosen.slice(0, 3) : allChosen.slice(0, 4);
  const unactivatedKey = initialLines === 3 ? allChosen[3] : null;

  // Distribute rolls among activated substats
  // Initial: each activated substat gets 1 roll. Remaining rolls go to random substats.
  const substats: Partial<Record<SubStat, number>> = {};
  for (const stat of activatedKeys) {
    substats[stat] = rollValue(rng, stat);
  }

  // Upgrade rolls: each goes to a random existing substat (or the newly activated one)
  // At level 4, the unactivated substat gets activated for 3-line artifacts
  const rollableKeys = [...activatedKeys];
  for (let r = 0; r < upgradeRolls; r++) {
    // For 3-line: the first upgrade roll activates the 4th substat
    if (r === 0 && unactivatedKey) {
      substats[unactivatedKey] = rollValue(rng, unactivatedKey);
      rollableKeys.push(unactivatedKey);
    } else {
      const target = pick(rng, rollableKeys);
      substats[target] = (substats[target] ?? 0) + rollValue(rng, target);
    }
  }

  // Round values to display precision
  for (const [stat, val] of Object.entries(substats)) {
    substats[stat as SubStat] = Math.round(val! * 10) / 10;
  }

  // Build unactivatedSubstats for 3-line artifacts that haven't been upgraded yet
  let unactivatedSubstats: Partial<Record<SubStat, number>> | undefined;
  if (initialLines === 3 && level < 4 && unactivatedKey) {
    // Not yet revealed — store the pending substat with a 1-roll value
    unactivatedSubstats = {
      [unactivatedKey]: rollValue(rng, unactivatedKey),
    };
  }

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
    totalRolls,
    ...(unactivatedSubstats ? { unactivatedSubstats } : {}),
  } as ArtifactData;
}

// Build group selection — picks N characters from the preset

function pickBuildGroups(
  rng: () => number,
  count: number
): { characterId: string; builds: Build[] }[] {
  const shuffled = shuffle(rng, [...PRESET_BUILD_GROUPS]);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Apply triage recommendations: flip lock status per decisions

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

// Count actual recommendations (changes from current lock state)

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

// Helper: build account from artifacts + character IDs

function buildAccount(
  charIds: string[],
  rng: () => number,
  artifacts: ArtifactData[]
): {
  account: AccountData;
  equippedArts: ArtifactData[];
  extraArts: ArtifactData[];
} {
  const charsWithEquipment: Array<{
    key: string;
    constellation: number;
    artifacts: Partial<Record<Slot, ArtifactData>>;
  }> = charIds.map((key) => ({
    key,
    constellation: Math.floor(rng() * 7),
    artifacts: {},
  }));

  const equippedArts: ArtifactData[] = [];
  const extraArts: ArtifactData[] = [];
  let artIdx = 0;
  for (const char of charsWithEquipment) {
    for (const slot of SLOTS) {
      if (artIdx >= artifacts.length) break;
      if (rng() < 0.3) {
        const art = { ...artifacts[artIdx], slotKey: slot };
        char.artifacts[slot] = art as ArtifactData;
        equippedArts.push(art as ArtifactData);
        artIdx++;
      }
    }
  }
  for (; artIdx < artifacts.length; artIdx++) {
    extraArts.push(artifacts[artIdx]);
  }

  return {
    account: {
      characters: charsWithEquipment,
      extraArtifacts: extraArts,
    } as unknown as AccountData,
    equippedArts,
    extraArts,
  };
}

// Tests

describe("triage stability (fuzz)", () => {
  const SEEDS = [42, 1337, 2024, 9999, 314159];
  const ARTIFACT_COUNTS = [500, 1000, 2000];

  for (const count of ARTIFACT_COUNTS) {
    for (const seed of SEEDS) {
      it(`${count} artifacts, seed ${seed}: no swing-back after applying recommendations`, () => {
        const rng = mulberry32(seed);

        const artifacts: ArtifactData[] = [];
        for (let i = 0; i < count; i++) {
          artifacts.push(generateArtifact(rng, i));
        }

        const buildGroups = pickBuildGroups(rng, 20);
        const charIds = buildGroups.map((g) => g.characterId);
        const { account, equippedArts, extraArts } = buildAccount(
          charIds,
          rng,
          artifacts
        );

        const settings: TriageSettings = {
          ...DEFAULT_TRIAGE_SETTINGS,
          ownedOnly: false,
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
          characters: (
            account.characters as Array<{
              key: string;
              constellation: number;
              artifacts: Partial<Record<Slot, ArtifactData>>;
            }>
          ).map((c) => ({
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

// 2a: Snapshot rebuild stability
// After applying decisions, convert to GOOD, rebuild from snapshot, re-triage
// → assert 0 new recommendations (validates ID reassignment doesn't destabilize)

describe("triage stability after snapshot rebuild", () => {
  const SEEDS = [42, 1337, 9999];

  for (const seed of SEEDS) {
    it(`seed ${seed}: no swing-back after snapshot round-trip`, () => {
      const rng = mulberry32(seed);
      const count = 500;

      const artifacts: ArtifactData[] = [];
      for (let i = 0; i < count; i++) {
        artifacts.push(generateArtifact(rng, i));
      }

      const buildGroups = pickBuildGroups(rng, 12);
      const charIds = buildGroups.map((g) => g.characterId);
      const { account, equippedArts, extraArts } = buildAccount(
        charIds,
        rng,
        artifacts
      );

      const settings: TriageSettings = {
        ...DEFAULT_TRIAGE_SETTINGS,
        ownedOnly: false,
      };

      // Pass 1: run triage and apply
      const r1 = runTriage(account, buildGroups, settings);
      const appliedEquipped = applyDecisions(equippedArts, r1.decisions);
      const appliedExtra = applyDecisions(extraArts, r1.decisions);

      const account2: AccountData = {
        characters: (
          account.characters as Array<{
            key: string;
            constellation: number;
            artifacts: Partial<Record<Slot, ArtifactData>>;
          }>
        ).map((c) => ({
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

      // Convert to GOOD and rebuild from snapshot (simulating scanner sync)
      const goodArts: ReturnType<typeof toGOODArtifact>[] = [];
      for (const c of account2.characters as Array<{
        key: string;
        artifacts: Partial<Record<Slot, ArtifactData>>;
      }>) {
        for (const art of Object.values(c.artifacts)) {
          if (art) goodArts.push(toGOODArtifact(art, c.key));
        }
      }
      for (const art of account2.extraArtifacts) {
        goodArts.push(toGOODArtifact(art));
      }

      const { data: rebuilt } = rebuildAccountFromSnapshot(account2, goodArts);

      // Pass 2: re-triage on rebuilt data
      const r2 = runTriage(rebuilt, buildGroups, settings);
      const { lockRecs, unlockRecs } = countRecommendations(r2.decisions);

      expect(
        lockRecs + unlockRecs,
        `seed ${seed}: snapshot rebuild caused ${lockRecs} lock + ${unlockRecs} unlock swing-backs`
      ).toBe(0);
    });
  }
});

// 2b: Partial success stability
// Some success, some not_found, some error. After applyJobResults, artifacts
// that succeeded should not swing back.

describe("triage stability with partial job results", () => {
  it("succeeded artifacts stay stable, failed artifacts may still have recommendations", () => {
    const rng = mulberry32(7777);
    const count = 300;

    const artifacts: ArtifactData[] = [];
    for (let i = 0; i < count; i++) {
      artifacts.push(generateArtifact(rng, i));
    }

    const buildGroups = pickBuildGroups(rng, 10);
    const charIds = buildGroups.map((g) => g.characterId);

    const account: AccountData = {
      characters: charIds.map((key) => ({
        key,
        constellation: Math.floor(rng() * 7),
        artifacts: {},
      })),
      extraArtifacts: artifacts,
    } as unknown as AccountData;

    const settings: TriageSettings = {
      ...DEFAULT_TRIAGE_SETTINGS,
      ownedOnly: false,
    };

    // Run triage
    const r1 = runTriage(account, buildGroups, settings);
    const recs = r1.decisions.filter((d) => {
      if (d.label === "lock" && !d.artifact.lock) return true;
      if (d.label === "unlock" && d.artifact.lock) return true;
      return false;
    });

    if (recs.length === 0) return; // nothing to test

    // Build payload: split recommendations into lock/unlock
    const toLock = recs
      .filter((d) => d.label === "lock")
      .map((d) => d.artifact);
    const toUnlock = recs
      .filter((d) => d.label === "unlock")
      .map((d) => d.artifact);

    const lockIds = toLock.map((a) => a.id);
    const unlockIds = toUnlock.map((a) => a.id);
    const payload: ManagePayload = {
      request: { lock: [], unlock: [] },
      lockIds,
      unlockIds,
    };

    // Simulate mixed results: alternate success/not_found
    const results: InstructionResult[] = [];
    const successIds = new Set<string>();

    for (let i = 0; i < lockIds.length; i++) {
      const status = i % 3 === 1 ? "not_found" : "success";
      results.push({ id: `lock:${i}`, status });
      if (status === "success") successIds.add(lockIds[i]);
    }
    for (let i = 0; i < unlockIds.length; i++) {
      const status = i % 4 === 2 ? "ui_error" : "success";
      results.push({ id: `unlock:${i}`, status });
      if (status === "success") successIds.add(unlockIds[i]);
    }

    // Apply partial results
    const updated = applyJobResults(account, payload, results);

    // Re-triage
    const r2 = runTriage(
      { ...account, extraArtifacts: updated.extraArtifacts },
      buildGroups,
      settings
    );

    // Artifacts that succeeded should not have new recommendations
    const swingBacks = r2.decisions.filter((d) => {
      if (!successIds.has(d.artifact.id)) return false;
      if (d.label === "lock" && !d.artifact.lock) return true;
      if (d.label === "unlock" && d.artifact.lock) return true;
      return false;
    });

    expect(
      swingBacks.length,
      `${swingBacks.length} succeeded artifacts swung back`
    ).toBe(0);
  });
});

// 2c: already_correct correction
// Artifact has wrong local lock state. Triage recommends change. Scanner
// returns already_correct. applyJobResults corrects local. Re-triage → stable.

describe("already_correct corrects local state", () => {
  it("no new recommendation after already_correct correction", () => {
    const rng = mulberry32(5555);
    const count = 200;

    const artifacts: ArtifactData[] = [];
    for (let i = 0; i < count; i++) {
      artifacts.push(generateArtifact(rng, i));
    }

    const buildGroups = pickBuildGroups(rng, 8);
    const charIds = buildGroups.map((g) => g.characterId);

    const account: AccountData = {
      characters: charIds.map((key) => ({
        key,
        constellation: 0,
        artifacts: {},
      })),
      extraArtifacts: artifacts,
    } as unknown as AccountData;

    const settings: TriageSettings = {
      ...DEFAULT_TRIAGE_SETTINGS,
      ownedOnly: false,
    };

    const r1 = runTriage(account, buildGroups, settings);
    const recs = r1.decisions.filter((d) => {
      if (d.label === "lock" && !d.artifact.lock) return true;
      if (d.label === "unlock" && d.artifact.lock) return true;
      return false;
    });

    if (recs.length === 0) return;

    // All results are already_correct (scanner says game already has the right state)
    const toLock = recs
      .filter((d) => d.label === "lock")
      .map((d) => d.artifact);
    const toUnlock = recs
      .filter((d) => d.label === "unlock")
      .map((d) => d.artifact);

    const lockIds = toLock.map((a) => a.id);
    const unlockIds = toUnlock.map((a) => a.id);
    const payload: ManagePayload = {
      request: { lock: [], unlock: [] },
      lockIds,
      unlockIds,
    };

    const results: InstructionResult[] = [
      ...lockIds.map((_, i) => ({
        id: `lock:${i}`,
        status: "already_correct" as const,
      })),
      ...unlockIds.map((_, i) => ({
        id: `unlock:${i}`,
        status: "already_correct" as const,
      })),
    ];

    const updated = applyJobResults(account, payload, results);

    // Re-triage — those artifacts should now be stable
    const r2 = runTriage(
      { ...account, extraArtifacts: updated.extraArtifacts },
      buildGroups,
      settings
    );
    const { lockRecs, unlockRecs } = countRecommendations(r2.decisions);

    expect(
      lockRecs + unlockRecs,
      `already_correct correction left ${lockRecs} lock + ${unlockRecs} unlock recs`
    ).toBe(0);
  });
});

// Order-independence: shuffling 3000 artifacts must produce identical labels

describe("triage is order-independent", () => {
  const SEEDS = [42, 1337, 271828];

  for (const seed of SEEDS) {
    it(`seed ${seed}: shuffled artifacts produce identical decisions`, () => {
      const rng = mulberry32(seed);
      const count = 3000;

      const artifacts: ArtifactData[] = [];
      for (let i = 0; i < count; i++) {
        artifacts.push(generateArtifact(rng, i));
      }

      const buildGroups = pickBuildGroups(rng, 20);
      const charIds = buildGroups.map((g) => g.characterId);

      const settings: TriageSettings = {
        ...DEFAULT_TRIAGE_SETTINGS,
        ownedOnly: false,
      };

      // Run on original order
      const account1: AccountData = {
        characters: charIds.map((key) => ({
          key,
          constellation: 0,
          artifacts: {},
        })),
        extraArtifacts: artifacts,
      } as unknown as AccountData;

      const r1 = runTriage(account1, buildGroups, settings);
      const labelMap1 = new Map(
        r1.decisions.map((d) => [d.artifact.id, d.label])
      );

      // Run on multiple different shuffles
      const SHUFFLE_COUNT = 5;
      for (let s = 0; s < SHUFFLE_COUNT; s++) {
        const shuffleRng = mulberry32(seed * 1000 + s + 1);
        const shuffled = shuffle(shuffleRng, [...artifacts]);

        const account2: AccountData = {
          characters: charIds.map((key) => ({
            key,
            constellation: 0,
            artifacts: {},
          })),
          extraArtifacts: shuffled,
        } as unknown as AccountData;

        const r2 = runTriage(account2, buildGroups, settings);
        const labelMap2 = new Map(
          r2.decisions.map((d) => [d.artifact.id, d.label])
        );

        // Every artifact must have the same label
        const mismatches: string[] = [];
        for (const [id, label1] of labelMap1) {
          const label2 = labelMap2.get(id);
          if (label1 !== label2) {
            mismatches.push(`${id}: ${label1} → ${label2}`);
          }
        }

        expect(
          mismatches.length,
          `seed ${seed}, shuffle ${s}: ${mismatches.length} mismatches:\n${mismatches.slice(0, 10).join("\n")}`
        ).toBe(0);
      }
    });
  }
});

// Lock-state independence: randomizing lock states produces same labels
// (with SK disabled — SK intentionally uses lock state for tie-breaking)

describe("triage is lock-state-independent (SK disabled)", () => {
  const SEEDS = [42, 1337, 271828];

  for (const seed of SEEDS) {
    it(`seed ${seed}: randomized lock states produce identical decisions`, () => {
      const rng = mulberry32(seed);
      const count = 3000;

      const artifacts: ArtifactData[] = [];
      for (let i = 0; i < count; i++) {
        artifacts.push(generateArtifact(rng, i));
      }

      const buildGroups = pickBuildGroups(rng, 20);
      const charIds = buildGroups.map((g) => g.characterId);

      const settings: TriageSettings = {
        ...DEFAULT_TRIAGE_SETTINGS,
        ownedOnly: false,
        setSlotKeep: 0, // disable SK to remove lock-state tie-breaking
      };

      // Run with original lock states
      const account1: AccountData = {
        characters: charIds.map((key) => ({
          key,
          constellation: 0,
          artifacts: {},
        })),
        extraArtifacts: artifacts,
      } as unknown as AccountData;

      const r1 = runTriage(account1, buildGroups, settings);
      const labelMap1 = new Map(
        r1.decisions.map((d) => [d.artifact.id, d.label])
      );

      // Run with multiple different random lock state assignments
      const VARIATION_COUNT = 5;
      for (let v = 0; v < VARIATION_COUNT; v++) {
        const lockRng = mulberry32(seed * 1000 + v + 1);
        const relocked = artifacts.map((a) => ({
          ...a,
          lock: lockRng() < 0.5,
        }));

        const account2: AccountData = {
          characters: charIds.map((key) => ({
            key,
            constellation: 0,
            artifacts: {},
          })),
          extraArtifacts: relocked,
        } as unknown as AccountData;

        const r2 = runTriage(account2, buildGroups, settings);
        const labelMap2 = new Map(
          r2.decisions.map((d) => [d.artifact.id, d.label])
        );

        const mismatches: string[] = [];
        for (const [id, label1] of labelMap1) {
          const label2 = labelMap2.get(id);
          if (label1 !== label2) {
            mismatches.push(`${id}: ${label1} → ${label2}`);
          }
        }

        expect(
          mismatches.length,
          `seed ${seed}, variation ${v}: ${mismatches.length} mismatches:\n${mismatches.slice(0, 10).join("\n")}`
        ).toBe(0);
      }
    });
  }
});

// Lock-state independence WITH SK enabled: SK may pick different artifacts
// from a tie group, but the total lock/unlock counts per set+slot must match

describe("triage with SK: lock-state changes preserve lock counts per set+slot", () => {
  const SEEDS = [42, 1337];

  for (const seed of SEEDS) {
    it(`seed ${seed}: different lock states produce same lock counts per set+slot`, () => {
      const rng = mulberry32(seed);
      const count = 3000;

      const artifacts: ArtifactData[] = [];
      for (let i = 0; i < count; i++) {
        artifacts.push(generateArtifact(rng, i));
      }

      const buildGroups = pickBuildGroups(rng, 20);
      const charIds = buildGroups.map((g) => g.characterId);

      const settings: TriageSettings = {
        ...DEFAULT_TRIAGE_SETTINGS,
        ownedOnly: false,
      };

      function getLockCountsBySetSlot(
        decisions: { artifact: ArtifactData; label: "lock" | "unlock" }[]
      ): Map<string, number> {
        const counts = new Map<string, number>();
        for (const d of decisions) {
          if (d.label !== "lock") continue;
          const key = `${d.artifact.setKey}:${d.artifact.slotKey}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
      }

      // Baseline
      const account1: AccountData = {
        characters: charIds.map((key) => ({
          key,
          constellation: 0,
          artifacts: {},
        })),
        extraArtifacts: artifacts,
      } as unknown as AccountData;

      const r1 = runTriage(account1, buildGroups, settings);
      const counts1 = getLockCountsBySetSlot(r1.decisions);

      // Variation with different lock states
      const lockRng = mulberry32(seed * 999 + 7);
      const relocked = artifacts.map((a) => ({
        ...a,
        lock: lockRng() < 0.5,
      }));

      const account2: AccountData = {
        characters: charIds.map((key) => ({
          key,
          constellation: 0,
          artifacts: {},
        })),
        extraArtifacts: relocked,
      } as unknown as AccountData;

      const r2 = runTriage(account2, buildGroups, settings);
      const counts2 = getLockCountsBySetSlot(r2.decisions);

      // Same set+slot groups should have the same lock count
      const allKeys = new Set([...counts1.keys(), ...counts2.keys()]);
      const mismatches: string[] = [];
      for (const key of allKeys) {
        const c1 = counts1.get(key) ?? 0;
        const c2 = counts2.get(key) ?? 0;
        if (c1 !== c2) {
          mismatches.push(`${key}: ${c1} → ${c2}`);
        }
      }

      expect(
        mismatches.length,
        `seed ${seed}: ${mismatches.length} set+slot groups differ:\n${mismatches.slice(0, 10).join("\n")}`
      ).toBe(0);
    });
  }
});
