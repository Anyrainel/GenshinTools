import type { StatSheet } from "./damageModels";
import { E, type Expr, simplify } from "./expr";
import type { ExprStats } from "./exprStats";
import {
  type BuffSource,
  type BuffTarget,
  type StatEntry,
  type StatKey,
  isSelfReceiver,
} from "./types";

/**
 * Throws if any StatKey appears more than once in the given entry list.
 * Duplicate keys silently overwrite each other in the StatSheet map.
 */
export function assertNoDuplicateStatKeys(
  entries: StatEntry[],
  label: string
): void {
  const seen = new Set<StatKey>();
  for (const { key } of entries) {
    if (seen.has(key)) {
      throw new Error(`Duplicate StatKey "${key}" in ${label}`);
    }
    seen.add(key);
  }
}

const LUNAR_REACTIONS = new Set([
  "lunarCharged",
  "lunarCrystallize",
  "lunarBloom",
]);

const VALID_CHARACTER_ORIGINS = new Set([
  "A",
  "E",
  "Q",
  "P1",
  "P2",
  "P3",
  "P4",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
]);

const VALID_WEAPON_ORIGINS = new Set(["R1", "R2", "R3", "R4", "R5"]);

type KeyConstraint = {
  requiresReceiver?: BuffTarget["receiver"];
  forbidsReceiver?: BuffTarget["receiver"];
  /** filter.reactions must be present and non-empty */
  requiresReactionsFilter?: true;
  /** these filter dimensions must not be present */
  forbidsDims?: ReadonlyArray<"elements" | "abilities" | "reactions">;
  /** at least one filter dimension must be present and non-empty */
  requiresAnyFilter?: true;
};

/**
 * Per-key constraints on receiver and filter dimensions.
 * To add a new constraint, append a line — no other code changes needed.
 */
const KEY_CONSTRAINTS: Partial<Record<StatKey, KeyConstraint>> = {
  "resReduction%": { requiresReceiver: "team", forbidsDims: ["abilities"] },
  "defReduction%": {
    requiresReceiver: "team",
    forbidsDims: ["elements", "reactions"],
  },
  "defIgnore%": {
    forbidsReceiver: "team",
    forbidsDims: ["elements", "reactions"],
  },
  "dmg%": { forbidsDims: ["reactions"] },
  "reactionDmg%": {
    requiresReactionsFilter: true,
    forbidsDims: ["abilities", "elements"],
  },
  baseDmg: { requiresAnyFilter: true },
  cr: { forbidsDims: ["reactions"] },
  cd: { forbidsDims: ["reactions"] },
  reactionCr: {
    requiresReactionsFilter: true,
    forbidsDims: ["abilities", "elements"],
  },
  reactionCd: {
    requiresReactionsFilter: true,
    forbidsDims: ["abilities", "elements"],
  },
};

/**
 * Validates a StatEntry[] against their shared BuffTarget and BuffSource.
 * Checks for:
 *  - duplicate keys
 *  - invalid filter shapes (empty arrays, duplicate elements)
 *  - key/receiver constraints from KEY_CONSTRAINTS
 *  - special-cased rules (e.g. elevated% must only scope to lunar reactions)
 *
 * Called from the StatBuff constructor, so all violations surface at
 * construction time and are caught by entity instantiation tests.
 */
function validateStatBuff(
  entries: StatEntry[],
  target: BuffTarget,
  source: BuffSource
): void {
  const label = `[${source.type}:${source.id}${source.origin ? `/${source.origin}` : ""}]`;
  const filter = target.filter;

  assertNoDuplicateStatKeys(entries, `entries for ${label}`);

  if (filter) {
    for (const dim of ["elements", "abilities", "reactions"] as const) {
      const arr = filter[dim];
      if (arr !== undefined && arr.length === 0) {
        throw new Error(
          `${label} DamageTagFilter.${dim} must not be an empty array — omit the key to mean "any"`
        );
      }
      if (arr) {
        const seen = new Set<string>();
        for (const val of arr) {
          if (seen.has(val)) {
            throw new Error(
              `${label} Duplicate "${val}" in DamageTagFilter.${dim}`
            );
          }
          seen.add(val);
        }
      }
    }
  }

  if (target.regions) {
    if (target.regions.length === 0) {
      throw new Error(
        `${label} BuffTarget.regions must not be an empty array — omit the key to mean "any"`
      );
    }
    const seen = new Set<string>();
    for (const val of target.regions) {
      if (seen.has(val)) {
        throw new Error(`${label} Duplicate "${val}" in BuffTarget.regions`);
      }
      seen.add(val);
    }
  }

  if (target.factions) {
    if (target.factions.length === 0) {
      throw new Error(
        `${label} BuffTarget.factions must not be an empty array — omit the key to mean "any"`
      );
    }
    const seen = new Set<string>();
    for (const val of target.factions) {
      if (seen.has(val)) {
        throw new Error(`${label} Duplicate "${val}" in BuffTarget.factions`);
      }
      seen.add(val);
    }
  }

  if (target.charId && isSelfReceiver(target.receiver)) {
    throw new Error(
      `${label} charId must not be combined with receiver "${target.receiver}" — self* receivers already imply the provider character`
    );
  }

  for (const { key } of entries) {
    const c = KEY_CONSTRAINTS[key];
    if (c) {
      if (c.requiresReceiver && target.receiver !== c.requiresReceiver) {
        throw new Error(
          `${label} ${key} must use receiver "${c.requiresReceiver}". Ask for review for this case.`
        );
      }
      if (c.forbidsReceiver && target.receiver === c.forbidsReceiver) {
        throw new Error(
          `${label} ${key} is not expected to use receiver "${c.forbidsReceiver}". Ask for review for this case.`
        );
      }
      if (c.requiresReactionsFilter && !filter?.reactions) {
        throw new Error(
          `${label} ${key} must have a reactions filter to scope which reactions it applies to. Ask for review for this case.`
        );
      }
      for (const dim of c.forbidsDims ?? []) {
        // Swirl reactions may use elements filter to differentiate (e.g. Hydro Swirl vs Pyro Swirl)
        if (dim === "elements" && filter?.reactions?.includes("swirl" as never))
          continue;
        if (filter?.[dim]) {
          throw new Error(
            `${label} ${key} is not expected to have a ${dim} filter. Ask for review for this case.`
          );
        }
      }
      if (c.requiresAnyFilter) {
        if (
          !filter ||
          (!filter.elements && !filter.abilities && !filter.reactions)
        ) {
          throw new Error(
            `${label} ${key} must have at least one filter dimension — an unscoped baseDmg is likely a mistake. Ask for review for this case.`
          );
        }
      }
    }

    // Special case: elevated% may only be scoped to lunar reactions
    if (key === "elevated%" && filter?.reactions) {
      const nonLunar = filter.reactions.filter((r) => !LUNAR_REACTIONS.has(r));
      if (nonLunar.length > 0) {
        throw new Error(
          `${label} elevated% is not expected to apply to non-lunar reactions yet. Ask for review for this case.`
        );
      }
    }
  }
}

function validateOrigin(source: BuffSource): void {
  if (source.type === "extra") return;
  if (source.type === "character" || source.type === "weapon") {
    if (!source.origin) {
      throw new Error(
        `BuffSource origin must not be empty for type ${source.type} (id: ${source.id})`
      );
    }
    const validOrigins =
      source.type === "character"
        ? VALID_CHARACTER_ORIGINS
        : VALID_WEAPON_ORIGINS;
    const expectedDesc =
      source.type === "character" ? "A, E, Q, P1–P4, C1–C6" : "R1–R5";
    const originParts = source.origin.split("/");
    if (!originParts.every((p) => validOrigins.has(p))) {
      throw new Error(
        `BuffSource origin "${source.origin}" is not valid for ${source.type} — expected one of: ${expectedDesc}, optionally joined with "/" (id: ${source.id})`
      );
    }
  }
  if (
    (source.type === "artifactSet" || source.type === "artifactHalfSet") &&
    source.origin
  ) {
    throw new Error(
      `BuffSource origin must be empty for artifact related types (id: ${source.id})`
    );
  }
}

// The classes below cover the most common buff patterns in Genshin.
// New reusable buff types should be added here so that all
// character/weapon/artifact implementations can share them.

/**
 * Core buff abstraction. Each buff has static entries (known at build time)
 * and optional dynamic entries (computed from resolved stats).
 */
export class StatBuff {
  constructor(
    readonly source: BuffSource,
    readonly target: BuffTarget,
    readonly staticBuffs: StatEntry[]
  ) {
    validateOrigin(source);
    validateStatBuff(staticBuffs, target, source);
  }

  /**
   * Stat contributions that depend on resolved stats.
   * Override in subclasses for stat-scaling buffs.
   */
  dynamicBuffs(_selfStats: StatSheet, _teamStats: StatSheet[]): StatEntry[] {
    return [];
  }

  /**
   * Expr-based dynamic buffs that depend on team stats.
   * Override in subclasses that use teamStats in dynamicBuffs().
   * Returns null by default (meaning: use numeric fallback).
   */
  dynamicBuffsExprTeam?(
    selfStats: ExprStats,
    teamExprStats: ExprStats[]
  ): { key: StatKey; expr: Expr }[];

  /**
   * True when this buff will never contribute any stat entries and can be
   * safely filtered out before the buff pipeline runs.
   *
   * A buff is no-op iff it has no staticBuffs AND has not overridden
   * dynamicBuffs (the base implementation always returns []).
   * Subclasses that override dynamicBuffs automatically become non-no-op.
   */
  get isNoOp(): boolean {
    return (
      this.staticBuffs.length === 0 &&
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.dynamicBuffs === StatBuff.prototype.dynamicBuffs
    );
  }

  protected get identityExtra(): string {
    return "";
  }

  get identityShapeKey(): string {
    const sourceKey = [
      this.source.type,
      this.source.id,
      this.source.origin ?? "",
      this.source.internalKey ?? "",
      this.source.noStackId ?? "",
      this.source.maxStacks != null ? String(this.source.maxStacks) : "",
      this.source.element ?? "",
      (this.source.triggers ?? []).join(","),
    ].join("\u0000");

    const filter = this.target.filter;
    const targetKey = [
      this.target.receiver,
      this.target.charId ?? "",
      (this.target.regions ?? []).join(","),
      (this.target.factions ?? []).join(","),
      (filter?.abilities ?? []).join(","),
      (filter?.elements ?? []).join(","),
      (filter?.reactions ?? []).join(","),
    ].join("\u0000");

    const staticKey = this.staticBuffs
      .map((entry) => `${entry.key}:${entry.value}`)
      .join("\u0001");

    const kind = this.constructor.name || "StatBuff";
    return [sourceKey, targetKey, staticKey, kind, this.identityExtra].join(
      "\u0002"
    );
  }
}

export function getBuffInstanceKey(
  buff: StatBuff,
  providerCharId?: string
): string {
  return `${providerCharId ?? ""}\u0003${buff.identityShapeKey}`;
}

/**
 * Buff that scales a single output stat from a single input stat (self).
 * Covers patterns like "X% of Max HP as ATK" or "EM × 0.04% as Elemental DMG".
 */
export class ScalingBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    readonly inputKey: StatKey,
    readonly outputKey: StatKey,
    readonly scale: number,
    readonly cap?: number,
    /** Subtract this from input before scaling (e.g. "HP above 30000") */
    readonly threshold?: number
  ) {
    super(source, target, staticBuffs);
    validateStatBuff([{ key: outputKey, value: 0 }], target, source);
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const input = this.threshold
      ? Math.max(0, selfStats.get(this.inputKey, null) - this.threshold)
      : selfStats.get(this.inputKey, null);
    const raw = input * this.scale;
    const value = this.cap !== undefined ? Math.min(raw, this.cap) : raw;
    return [{ key: this.outputKey, value }];
  }

  dynamicBuffsExpr(selfStats: ExprStats): { key: StatKey; expr: Expr }[] {
    let input: Expr = selfStats.get(this.inputKey, null);
    if (this.threshold) {
      // max(0, input - threshold)
      input = E.max(E.const(0), E.add(input, E.const(-this.threshold)));
    }
    let result: Expr = E.mul(input, E.const(this.scale));
    if (this.cap !== undefined) {
      result = E.min(result, E.const(this.cap));
    }
    return [{ key: this.outputKey, expr: simplify(result) }];
  }

  protected override get identityExtra(): string {
    return [
      this.inputKey,
      this.outputKey,
      String(this.scale),
      this.cap != null ? String(this.cap) : "",
      this.threshold != null ? String(this.threshold) : "",
    ].join("\u0000");
  }
}

/**
 * Buff that scales an output stat from two input stats (self):
 *   output = min(statA × scaleA, capA) × statB
 * Use when one stat's contribution is capped before multiplying by another
 * (e.g., "EM × 0.2% ATK per point, capped at 400% ATK extra → baseDmg").
 * capA is expressed in the same unit as (statA × scaleA); omit for no cap.
 */
export class CrossScalingBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    readonly statA: StatKey,
    readonly scaleA: number,
    readonly capA: number | undefined,
    readonly statB: StatKey,
    readonly outputKey: StatKey
  ) {
    super(source, target, staticBuffs);
    validateStatBuff([{ key: outputKey, value: 0 }], target, source);
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const a = selfStats.get(this.statA, null) * this.scaleA;
    const capped = this.capA !== undefined ? Math.min(a, this.capA) : a;
    return [
      { key: this.outputKey, value: capped * selfStats.get(this.statB, null) },
    ];
  }

  dynamicBuffsExpr(selfStats: ExprStats): { key: StatKey; expr: Expr }[] {
    let a: Expr = E.mul(selfStats.get(this.statA, null), E.const(this.scaleA));
    if (this.capA !== undefined) {
      a = E.min(a, E.const(this.capA));
    }
    const result = E.mul(a, selfStats.get(this.statB, null));
    return [{ key: this.outputKey, expr: simplify(result) }];
  }

  protected override get identityExtra(): string {
    return [
      this.statA,
      String(this.scaleA),
      this.capA != null ? String(this.capA) : "",
      this.statB,
      this.outputKey,
    ].join("\u0000");
  }
}

/**
 * Deduplicate buffs within the same noStackId, per stat key.
 *
 * In-game: "buffs of the same type will not stack" — "type" means stat key
 * (atk%, dmg%, em, etc.). Within a noStackId group, for each stat key, only
 * the buff with the highest value for that key survives. A single buff object
 * may contribute the winning value for some keys but not others.
 *
 * Implementation: group by (noStackId, stat key). For each sub-group, keep
 * the buff with the highest value. A buff that loses on all its keys is dropped
 * entirely; a buff that wins on some keys but loses on others is kept (the
 * losing keys become redundant but harmless since the winner also applies).
 */
export function deduplicateBuffs<T extends { source: BuffSource }>(
  buffs: T[],
  evaluator: (b: T) => StatEntry[]
): T[] {
  const result: T[] = [];
  // (noStackId, statKey) → best buff and its value
  const bestPerKey = new Map<string, { buff: T; value: number }>();

  for (const b of buffs) {
    if (!b.source.noStackId) {
      result.push(b);
      continue;
    }
    for (const e of evaluator(b)) {
      const groupKey = `${b.source.noStackId}\0${e.key}`;
      const cur = bestPerKey.get(groupKey);
      if (!cur || e.value > cur.value) {
        bestPerKey.set(groupKey, { buff: b, value: e.value });
      }
    }
  }

  // Collect unique winning buffs (a buff may win on multiple keys)
  const winners = new Set<T>();
  for (const { buff } of bestPerKey.values()) {
    winners.add(buff);
  }
  for (const b of winners) result.push(b);

  return result;
}
