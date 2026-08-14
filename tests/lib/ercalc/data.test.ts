import { describe, expect, it } from "vitest";
import { z } from "zod";
import { elements, weaponTypes } from "@/data/enums";
import fontaineSE from "@/data/ercalc/selfEnergy-fontaine.json";
import inazumaSE from "@/data/ercalc/selfEnergy-inazuma.json";
import liyueSE from "@/data/ercalc/selfEnergy-liyue.json";
import mondstadtSE from "@/data/ercalc/selfEnergy-mondstadt.json";
import natlanSE from "@/data/ercalc/selfEnergy-natlan.json";
import nodKraiSE from "@/data/ercalc/selfEnergy-nod-krai.json";
import noneSE from "@/data/ercalc/selfEnergy-none.json";
import snezhnayaSE from "@/data/ercalc/selfEnergy-snezhnaya.json";
import sumeruSE from "@/data/ercalc/selfEnergy-sumeru.json";
import artifactData from "@/data/game/artifact_en.json";
import weaponData from "@/data/game/weapon_en.json";
import { artifactEnergyImpls } from "@/lib/ercalc/artifactEnergy";
import { allSelfEnergy, particles } from "@/lib/ercalc/constants";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";

/**
 * Schema-level guards for the ER calculator's DATA layer.
 *
 * `particles.json` is zod-parsed at import time in `constants.ts`; the nine
 * `selfEnergy-*.json` files are not — `allSelfEnergy` is a bare object spread,
 * and `SelfEnergyEntry` carries an index signature with stringly-typed `action`
 * and `target`. Every lookup against that data fails *silently*: a typo'd
 * `target` makes `resolveRecipients` return `[]` and the entry evaporates, a
 * typo'd key is simply never read, and a dead weapon id resolves to `undefined`.
 * Each of those has shipped at least once (docs/er-calc-ga-plan.md, B20).
 *
 * The enums below are pinned deliberately rather than derived at runtime:
 * deriving them from the data would make every typo self-legalizing. They list
 * what the ENGINE understands (`entryMatchesAction` / `resolveRecipients`), so
 * a new value has to be taught to the engine before it can appear in data.
 *
 * Behavioural guards (Venti's A4, erScale resolution, per-hit proc caps, NA
 * pity, weapon-id resolution, particle-element presence) live in
 * `energyDataIntegrity.test.ts` and are not repeated here.
 */

// ─── Enumerations the engine understands ───

/** Anchors accepted by `entryMatchesAction`. `"A"` is the wildcard that matches
 *  the whole normal-attack family (NA/CA/PA) as a PER-HIT effect. `NA`,
 *  `specialE` and `specialQ` are unused by today's data but are legal anchors —
 *  keep them listed so authoring one is not treated as a typo. */
const SELF_ENERGY_ACTIONS = [
  "E",
  "holdE",
  "specialE",
  "Q",
  "specialQ",
  "NA",
  "CA",
  "PA",
  "A",
] as const;

/** Every branch of `resolveRecipients`. Anything else returns `[]`. */
const SELF_ENERGY_TARGETS = ["self", "party", "partyOthers", "active"] as const;

/** `C1`-`C6` constellations, `P1`-`P5` passives, or a talent letter for effects
 *  written into the skill itself (Razor's Sigils, Durin's E, Dori's Q). */
const SOURCE_LABEL = /^(?:C[1-6]|P[1-5]|[AEQ])$/;

const elementEnum = z.enum(elements as unknown as [string, ...string[]]);

const SelfEnergyEntrySchema = z.strictObject({
  source: z.string().regex(SOURCE_LABEL),
  action: z.enum(SELF_ENERGY_ACTIONS),
  target: z.enum(SELF_ENERGY_TARGETS),
  /** Restricts a party/partyOthers grant to one element (Xilonen C2). */
  targetElement: elementEnum.optional(),
  /** Minimum constellation. 0 for passives and base-kit effects. */
  minC: z.number().int().min(0).max(6),
  /** Tick count for a multi-proc effect, or the hit cap for an `"A"` anchor. */
  procs: z.number().int().positive().optional(),
  /** Documentation only — the engine never gates self-energy on it (B12). */
  cooldown: z.number().positive().optional(),

  // Amount, in the precedence order `resolveEntryPerProcFlat` reads them.
  erScale: z
    .strictObject({
      per100: z.number().finite(),
      max: z.number().positive().optional(),
    })
    .optional(),
  param: z
    .strictObject({
      source: z.enum(["A", "E", "Q"]),
      index: z.number().int().nonnegative(),
      multiplier: z.number().finite(),
    })
    .optional(),
  percentRefund: z.number().positive().max(100).optional(),
  amount: z.number().finite().optional(),

  /** Multiplier on the resolved amount (Raiden A4), not an amount itself. */
  erMultiplier: z
    .strictObject({ perPercentOver100: z.number().finite() })
    .optional(),

  conditionEn: z.string().optional(),
  conditionZh: z.string().optional(),
  note: z.string().optional(),
});

const RegionFileSchema = z.record(
  z.string(),
  z.array(SelfEnergyEntrySchema).nonempty()
);

const REGION_FILES: Array<[string, unknown]> = [
  ["mondstadt", mondstadtSE],
  ["liyue", liyueSE],
  ["inazuma", inazumaSE],
  ["sumeru", sumeruSE],
  ["fontaine", fontaineSE],
  ["natlan", natlanSE],
  ["snezhnaya", snezhnayaSE],
  ["nod-krai", nodKraiSE],
  ["none", noneSE],
];

/** Every (region, charId, entry) triple, flattened for per-entry assertions.
 *  Walks the FILES, not the merged `allSelfEnergy`, so an entry hidden by a
 *  duplicate charId is still validated. */
const allEntries: Array<{
  region: string;
  charId: string;
  entry: Record<string, unknown>;
}> = REGION_FILES.flatMap(([region, mod]) =>
  Object.entries(mod as Record<string, Record<string, unknown>[]>).flatMap(
    ([charId, entries]) => entries.map((entry) => ({ region, charId, entry }))
  )
);

const label = (e: (typeof allEntries)[number]) =>
  `${e.region}/${e.charId} ${String(e.entry.source)}:${String(e.entry.action)}`;

describe("selfEnergy data schema", () => {
  it("has entries to validate", () => {
    // A broken import path would make every other assertion vacuously pass.
    expect(allEntries.length).toBeGreaterThan(50);
  });

  it("parses every entry against the strict schema", () => {
    const failures: string[] = [];
    for (const e of allEntries) {
      const parsed = SelfEnergyEntrySchema.safeParse(e.entry);
      if (parsed.success) continue;
      for (const issue of parsed.error.issues) {
        failures.push(
          `${label(e)} → ${issue.path.join(".")}: ${issue.message}`
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it("shapes every region file as charId → non-empty entry list", () => {
    const failures: string[] = [];
    for (const [region, mod] of REGION_FILES) {
      const parsed = RegionFileSchema.safeParse(mod);
      if (!parsed.success) failures.push(`${region}: ${parsed.error.message}`);
    }
    expect(failures).toEqual([]);
  });

  it("declares no charId in two region files", () => {
    // `allSelfEnergy` merges the nine files with a spread, so a repeated charId
    // is not a merge — the later file's array replaces the earlier one outright
    // and those entries vanish with no warning.
    const seen = new Map<string, string[]>();
    for (const [region, mod] of REGION_FILES) {
      for (const charId of Object.keys(mod as Record<string, unknown>)) {
        seen.set(charId, [...(seen.get(charId) ?? []), region]);
      }
    }
    const duplicated = [...seen.entries()]
      .filter(([, regions]) => regions.length > 1)
      .map(([charId, regions]) => `${charId}: ${regions.join(", ")}`);
    expect(duplicated).toEqual([]);
  });

  it("exposes every authored character through the merged map", () => {
    // Pins the spread in `constants.ts` to the files this suite validated.
    const authored = new Set(allEntries.map((e) => e.charId));
    expect(Object.keys(allSelfEnergy).sort()).toEqual([...authored].sort());
  });

  it("rejects the typos it exists to catch", () => {
    // Guards the guard: every field below is one the engine reads by string
    // comparison, so a schema that quietly accepted these would pass forever.
    const valid = {
      source: "C1",
      action: "E",
      target: "party",
      minC: 1,
      amount: 5,
    };
    expect(SelfEnergyEntrySchema.safeParse(valid).success).toBe(true);
    for (const broken of [
      { ...valid, target: "partyOther" }, // resolveRecipients → []
      { ...valid, target: "allies" },
      { ...valid, action: "burst" }, // entryMatchesAction → never fires
      { ...valid, action: "e" },
      { ...valid, targetElement: "electro" }, // element compare is exact-case
      { ...valid, porcs: 3 }, // misspelled key, silently ignored
      { ...valid, minC: 7 },
      { ...valid, source: "C7" },
    ]) {
      expect(SelfEnergyEntrySchema.safeParse(broken).success).toBe(false);
    }
  });

  it("registers every authored character under a real particle id", () => {
    // A misspelled charId key is never looked up — `allSelfEnergy[source.id]`
    // just returns undefined and the whole character's energy disappears. The
    // ER team picker is keyed off `particles`, so that is the id space.
    const unknown = [...new Set(allEntries.map((e) => e.charId))]
      .filter((charId) => !particles[charId])
      .sort();
    expect(unknown).toEqual([]);
  });
});

describe("selfEnergy amount fields", () => {
  const AMOUNT_FIELDS = [
    "amount",
    "percentRefund",
    "erScale",
    "param",
  ] as const;

  /**
   * `resolveEntryPerProcFlat` reads the amount fields in a fixed precedence
   * (erScale → param → percentRefund → amount) and returns on the first hit, so
   * a second field is dead weight that can silently drift away from the live
   * one. These two entries carry a legacy `amount` mirroring `erScale.per100`;
   * they are pinned equal here so the redundancy cannot become a lie, and the
   * allowlist is permissive — dropping the stray `amount` also passes.
   */
  const ER_SCALE_MIRRORS = new Set(["kujou_sara:P2", "dori:P2"]);

  it("carries exactly one amount field per entry", () => {
    const failures: string[] = [];
    for (const e of allEntries) {
      const present = AMOUNT_FIELDS.filter(
        (field) => e.entry[field] !== undefined
      );
      if (present.length === 1) continue;

      const key = `${e.charId}:${String(e.entry.source)}`;
      const isPinnedMirror =
        ER_SCALE_MIRRORS.has(key) &&
        present.length === 2 &&
        present.includes("amount") &&
        present.includes("erScale") &&
        e.entry.amount ===
          (e.entry.erScale as { per100: number } | undefined)?.per100;
      if (isPinnedMirror) continue;

      failures.push(`${label(e)} → [${present.join(", ")}]`);
    }
    expect(failures).toEqual([]);
  });

  it("never authors an amount of zero", () => {
    // `resolveEntryPerProcFlat` returning 0 is indistinguishable from the entry
    // not existing — the emitter skips it before any event is recorded.
    const zeroed = allEntries
      .filter((e) => e.entry.amount === 0 || e.entry.percentRefund === 0)
      .map(label);
    expect(zeroed).toEqual([]);
  });

  it("pairs erMultiplier with something to multiply", () => {
    // `erMultiplier` scales an amount; on its own it multiplies nothing.
    const orphaned = allEntries
      .filter((e) => e.entry.erMultiplier !== undefined)
      .filter((e) => e.entry.erScale !== undefined)
      .map(label);
    // erScale already resolves at ASSUMED_BATTERY_ER, so stacking erMultiplier
    // on top would apply the battery assumption twice.
    expect(orphaned).toEqual([]);
  });
});

/**
 * A `cooldown` shorter than a rotation describes an effect that fires REPEATEDLY,
 * but the engine never reads self-energy `cooldown` (B12) and pays `procs ?? 1`
 * ticks. So "short cooldown, no procs" is the exact shape of an effect modelled
 * as firing once — which is how Dori's Q, Albedo's C1, Klee's C6, Barbara's C1,
 * Qiqi's C1 and Yaoyao's C2 were all under-counting before B2's data pass.
 *
 * The allowlist is the set of cases checked against official text and found
 * acceptable-as-authored, plus the cases still open as known conservative gaps.
 * It is permissive: adding a correct `procs` to any of them also passes. A NEW
 * short-cooldown entry with no `procs` fails.
 */
describe("selfEnergy repeating-effect heuristic", () => {
  const ROTATION_SECONDS = 10;

  /** Cooldown gates a re-trigger of a once-per-cast effect; the node IS the
   *  trigger, so one payout per node is already correct. */
  const CORRECT_AS_AUTHORED = new Set([
    // "When Tengu Juurai: Ambush hits opponents ... once every 3s." One Tengu
    // Juurai per skill cast, so the 3s CD only blocks a second cast.
    "kujou_sara:P2",
    // "When Charmed Cloudstrider hits an opponent ... once every 0.2s." Anchored
    // to the plunge node itself; 0.2s gates nothing at rotation scale.
    "gaming:C4",
  ]);

  /** Genuinely repeating effects still modelled as a single tick. Every one
   *  UNDER-counts energy, so the tool over-states the ER requirement — the safe
   *  direction. Tracked in docs/er-calc-ga-plan.md (B2 data half / B12). */
  const KNOWN_CONSERVATIVE_GAPS = new Set([
    // "If not on the field and his Energy is less than 40, regenerate 2 Energy
    // every second."
    "kamisato_ayato:P2",
    // "Recovers 1.2 Energy when she triggers a Swirl ... once every 2s."
    "sayu:C4",
    // "Regenerates 1 Energy every time he hits an opponent affected by Cryo ...
    // once every 2s."
    "chongyun:C4",
    // "... restoring 7 Energy to Razor ... once every 1s" during the burst,
    // and only with a 2+ Hexerei party.
    "razor:P4",
    // "When Supporting Fire hits an opponent, restore 6 Energy ... once every 8s."
    "ifa:C1",
    // "... 3 Energy will be restored to Kachina ... once every 5s."
    "kachina:C1",
    // "... Flins will recover 8 Elemental Energy ... once every 5.5s."
    "flins:C1",
    // "... recover 5 Elemental Energy ... once every 4s."
    "ineffa:C4",
  ]);

  it("flags no new short-cooldown entry that lacks a proc count", () => {
    const suspicious = allEntries
      .filter((e) => {
        const cooldown = e.entry.cooldown;
        return (
          typeof cooldown === "number" &&
          cooldown < ROTATION_SECONDS &&
          e.entry.procs === undefined
        );
      })
      .map((e) => ({ e, key: `${e.charId}:${String(e.entry.source)}` }))
      .filter(
        ({ key }) =>
          !CORRECT_AS_AUTHORED.has(key) && !KNOWN_CONSERVATIVE_GAPS.has(key)
      )
      .map(({ e }) => `${label(e)} (cooldown ${String(e.entry.cooldown)}s)`);
    expect(suspicious).toEqual([]);
  });

  it("keeps the allowlist free of entries that no longer need it", () => {
    // A stale allowlist entry hides the next real offender behind the same key.
    const stillSuspicious = new Set(
      allEntries
        .filter(
          (e) =>
            typeof e.entry.cooldown === "number" &&
            e.entry.cooldown < ROTATION_SECONDS &&
            e.entry.procs === undefined
        )
        .map((e) => `${e.charId}:${String(e.entry.source)}`)
    );
    const stale = [...CORRECT_AS_AUTHORED, ...KNOWN_CONSERVATIVE_GAPS]
      .filter((key) => !stillSuspicious.has(key))
      .sort();
    expect(stale).toEqual([]);
  });
});

describe("energy registries resolve against game data", () => {
  it("registers every artifact energy impl under a real set id", () => {
    // Same silent-lookup failure as the dead weapon id that shipped once:
    // `getArtifactEnergyImpl` returns undefined and the set simply does nothing.
    const known = new Set(Object.keys(artifactData as Record<string, unknown>));
    const dead = Object.keys(artifactEnergyImpls).filter(
      (id) => !known.has(id)
    );
    expect(dead).toEqual([]);
  });

  it("keys both registries by the entry's own id", () => {
    // Both maps are built with `Object.fromEntries(... [x.id, x])`, so a key
    // that disagrees with the id it carries means the entry was hand-edited.
    const mismatched = [
      ...Object.entries(weaponEnergyById)
        .filter(([key, entry]) => key !== entry.id)
        .map(([key, entry]) => `weapon ${key} ≠ ${entry.id}`),
      ...Object.entries(artifactEnergyImpls)
        .filter(([key, impl]) => key !== impl.setId)
        .map(([key, impl]) => `artifact ${key} ≠ ${impl.setId}`),
    ];
    expect(mismatched).toEqual([]);
  });

  it("declares a real weapon type for every energy weapon", () => {
    // `weapon_en.json` carries no weapon type, so the declared type is only
    // checkable against the enum. A bad value breaks the picker's type filter.
    const valid = new Set<string>(weaponTypes);
    const bad = Object.values(weaponEnergyById)
      .filter((entry) => !valid.has(entry.type))
      .map((entry) => `${entry.id}: ${entry.type}`);
    expect(bad).toEqual([]);
    // Weapon-id resolution against weapon_en.json is asserted in
    // energyDataIntegrity.test.ts; keep the ids reachable from here too.
    expect(Object.keys(weaponEnergyById).length).toBeGreaterThan(0);
    expect(
      Object.keys(weaponData as Record<string, unknown>).length
    ).toBeGreaterThan(0);
  });
});

describe("particle data coverage", () => {
  it("declares a real element for every particle entry", () => {
    // The element drives the 3.0x same-element vs 1.0x different-element rate,
    // and `TeamSetup.inferElement` falls back to Anemo for anything it cannot
    // recognize — a silent 3x error on the wrong character. Presence is checked
    // in energyDataIntegrity.test.ts; this pins the VALUE to the element enum.
    const valid = new Set<string>(elements);
    const bad = Object.entries(particles)
      .filter(([, entry]) => !valid.has(entry.element))
      .map(([id, entry]) => `${id}: ${JSON.stringify(entry.element)}`);
    expect(bad).toEqual([]);
  });

  /**
   * Characters the ER team picker offers (it lists `Object.keys(particles)`)
   * that emit nothing. Each was checked against the official talent text and
   * both upstream particle dumps (`particles.fandom.json`, `particles.gcsim.json`)
   * before being listed — an unexplained zero-particle character is far more
   * likely to be a missed extraction than a real kit.
   */
  const NO_PARTICLES_BY_DESIGN: Record<string, string> = {
    // Let the Show Begin♪ emits no particles. Her energy comes from C1
    // (1 Energy / 10s) and C4 (Charged Attack), both in selfEnergy-mondstadt.
    barbara: "skill generates no particles; energy is C1/C4 only",
    // Breastplate emits no particles and Noelle has no energy passive at all.
    noelle: "skill generates no particles and the kit has no energy clause",
    // Herald of Frost emits no particles; C1 grants 2 Energy on Talisman hits,
    // modelled in selfEnergy-liyue.
    qiqi: "skill generates no particles; energy is C1 only",
    // Not a released playable character — no upstream source publishes
    // emission data. Counts as 0 particles until one does.
    traveler_cryo: "unreleased; no published emission data (see _unmodeled)",
  };

  it("gives every selectable character particle data or a documented reason", () => {
    const emitsNothing = Object.entries(particles)
      .filter(
        ([, entry]) =>
          !entry.E &&
          !entry.holdE &&
          !entry.specialE &&
          !entry.NA &&
          !entry.CA &&
          !entry.PA &&
          !entry.periodic?.E &&
          !entry.periodic?.Q
      )
      .map(([id]) => id);
    const unexplained = emitsNothing
      .filter((id) => !NO_PARTICLES_BY_DESIGN[id])
      .sort();
    expect(unexplained).toEqual([]);
  });

  it("keeps the zero-particle allowlist free of stale entries", () => {
    const stale = Object.keys(NO_PARTICLES_BY_DESIGN)
      .filter((id) => {
        const entry = particles[id];
        if (!entry) return true; // dropped from particles.json entirely
        return Boolean(
          entry.E ||
            entry.holdE ||
            entry.specialE ||
            entry.NA ||
            entry.CA ||
            entry.PA ||
            entry.periodic?.E ||
            entry.periodic?.Q
        );
      })
      .sort();
    expect(stale).toEqual([]);
  });
});
