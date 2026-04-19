import type { Faction, Region } from "@/data/types";
import { LUNAR_REACTIONS } from "../constants";
import {
  type BuffReceiverType,
  type BuffSource,
  type BuffTarget,
  type ExtraBuff,
  FINAL_STAT_KEYS,
  type ResolvedBuff,
  type StatEntry,
  type StatKey,
} from "../types";
import { E, type Expr, simplify } from "./expr";
import type { ExprStatSheet } from "./exprStatSheet";
import { isSelfReceiver } from "./fieldState";
import { StatSheet } from "./statSheet";

/** Canonical key for a BuffSource, used in BuffActivationMap and override store. */
export function buffSourceKey(source: BuffSource): string {
  const base = `${source.type}:${source.id}:${source.origin ?? ""}`;
  return source.internalKey ? `${base}:${source.internalKey}` : base;
}

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

const LUNAR_REACTION_SET = new Set<string>(LUNAR_REACTIONS);

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
 * Per-key allowlist for constraint violations that are intentional.
 * Key: `${charOrWeaponId}/${origin}`, Value: set of constraint descriptions to skip.
 *
 * Example: Mavuika C2 uses defReduction% with selfOffField/other receivers
 * (below C6) to model Ring-form-only DEF shred without affecting her own
 * on-field Flamestrider damage.
 */
const CONSTRAINT_ALLOWLIST: Record<string, Set<string>> = {
  "mavuika/C2": new Set(["defReduction%:requiresReceiver"]),
};

function isAllowlisted(
  source: BuffSource,
  key: StatKey,
  constraint: string
): boolean {
  const id = `${source.id}/${source.origin ?? ""}`;
  return CONSTRAINT_ALLOWLIST[id]?.has(`${key}:${constraint}`) ?? false;
}

/**
 * Validates a StatEntry[] against their shared BuffTarget and BuffSource.
 * Checks for:
 *  - duplicate keys
 *  - invalid filter shapes (empty arrays, duplicate elements)
 *  - key/receiver constraints from KEY_CONSTRAINTS
 *  - special-cased rules (e.g. elevated% must only scope to lunar reactions)
 *
 * Exported for use in tests. Not called in the production StatBuff constructor.
 */
export function validateStatBuff(
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
      if (
        c.requiresReceiver &&
        target.receiver !== c.requiresReceiver &&
        !isAllowlisted(source, key, "requiresReceiver")
      ) {
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
      const nonLunar = filter.reactions.filter(
        (r) => !LUNAR_REACTION_SET.has(r)
      );
      if (nonLunar.length > 0) {
        throw new Error(
          `${label} elevated% is not expected to apply to non-lunar reactions yet. Ask for review for this case.`
        );
      }
    }
  }
}

export function validateOrigin(source: BuffSource): void {
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

/**
 * Core buff abstraction. Each buff has static entries (known at build time)
 * and optional dynamic entries (computed from resolved stats).
 */
export class StatBuff {
  constructor(
    readonly source: BuffSource,
    readonly target: BuffTarget,
    readonly staticBuffs: StatEntry[]
  ) {}

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
    selfStats: ExprStatSheet,
    teamExprStats: ExprStatSheet[]
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

  /**
   * Determine whether this buff applies to a given character's stat sheet.
   *
   * @param providerCharId The character that provides the buff
   * @param selfCharId    The character whose stat sheet we're building
   * @param selfIsOnField Whether selfCharId is on-field for this damage context.
   * @param selfRegion    Region of the target character (for region-scoped buffs).
   * @param selfFaction   Faction of the target character (for faction-scoped buffs).
   */
  isApplicable(
    providerCharId: string,
    selfCharId: string,
    selfIsOnField: boolean,
    selfRegion?: Region,
    selfFaction?: Faction
  ): boolean {
    // CharId filter: if buff specifies charId, target must match
    if (this.target.charId !== undefined) {
      if (this.target.charId !== selfCharId) return false;
    }
    // Region filter: if buff specifies regions, target must be from one of them
    if (this.target.regions && selfRegion !== undefined) {
      if (!this.target.regions.includes(selfRegion)) return false;
    }
    // Faction filter: if buff specifies factions, target must be from one of them
    if (this.target.factions && selfFaction !== undefined) {
      if (!this.target.factions.includes(selfFaction)) return false;
    }

    return RECEIVER_RULES[this.target.receiver](
      providerCharId,
      selfCharId,
      selfIsOnField
    );
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
    if (FINAL_STAT_KEYS.has(inputKey)) {
      throw new Error(
        `ScalingBuff inputKey "${inputKey}" is a final stat — final stats cannot be used ` +
          `as scaling inputs (source: ${source.type}:${source.id}/${source.origin ?? ""})`
      );
    }
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const input = this.threshold
      ? Math.max(0, selfStats.get(this.inputKey, null) - this.threshold)
      : selfStats.get(this.inputKey, null);
    const raw = input * this.scale;
    const value = this.cap !== undefined ? Math.min(raw, this.cap) : raw;
    return [{ key: this.outputKey, value }];
  }

  dynamicBuffsExpr(selfStats: ExprStatSheet): { key: StatKey; expr: Expr }[] {
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
 * ScalingBuff where the cap is computed from another stat:
 *   output = min(input × scale, capKey × capScale)
 * Use for patterns like "X% of HP as ATK, cannot exceed baseAtk × 4" (Hu Tao).
 */
export class DynamicCapScalingBuff extends ScalingBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    inputKey: StatKey,
    outputKey: StatKey,
    scale: number,
    readonly capKey: StatKey,
    readonly capScale: number
  ) {
    super(source, target, staticBuffs, inputKey, outputKey, scale);
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const raw = selfStats.get(this.inputKey, null) * this.scale;
    const cap = selfStats.get(this.capKey, null) * this.capScale;
    return [{ key: this.outputKey, value: Math.min(raw, cap) }];
  }

  override dynamicBuffsExpr(
    selfStats: ExprStatSheet
  ): { key: StatKey; expr: Expr }[] {
    const raw = E.mul(selfStats.get(this.inputKey, null), E.const(this.scale));
    const cap = E.mul(selfStats.get(this.capKey, null), E.const(this.capScale));
    return [{ key: this.outputKey, expr: simplify(E.min(raw, cap)) }];
  }

  protected override get identityExtra(): string {
    return [
      this.inputKey,
      this.outputKey,
      String(this.scale),
      this.capKey,
      String(this.capScale),
    ].join("\u0000");
  }
}

/**
 * Buff that aggregates a stat across team members (max/min/sum),
 * scales it, and outputs to another stat with an optional cap.
 * Use for patterns like "highest party EM × 25%, cap 250" (Nahida P1).
 */
export class TeamAggregationBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    readonly inputKey: StatKey,
    readonly outputKey: StatKey,
    readonly scale: number,
    readonly cap: number | undefined,
    readonly aggregation: "max" | "min" | "sum"
  ) {
    super(source, target, staticBuffs);
  }

  private aggregate(values: number[]): number {
    switch (this.aggregation) {
      case "max":
        return Math.max(...values);
      case "min":
        return Math.min(...values);
      case "sum":
        return values.reduce((a, b) => a + b, 0);
    }
  }

  override dynamicBuffs(
    _selfStats: StatSheet,
    teamStats: StatSheet[]
  ): StatEntry[] {
    const agg = this.aggregate(
      teamStats.map((s) => s.get(this.inputKey, null))
    );
    const raw = agg * this.scale;
    const value = this.cap !== undefined ? Math.min(raw, this.cap) : raw;
    return [{ key: this.outputKey, value }];
  }

  override dynamicBuffsExprTeam(
    _selfStats: ExprStatSheet,
    teamExprStats: ExprStatSheet[]
  ): { key: StatKey; expr: Expr }[] {
    let agg: Expr = teamExprStats[0]!.get(this.inputKey, null);
    for (let i = 1; i < teamExprStats.length; i++) {
      const next = teamExprStats[i]!.get(this.inputKey, null);
      switch (this.aggregation) {
        case "max":
          agg = E.max(agg, next);
          break;
        case "min":
          agg = E.min(agg, next);
          break;
        case "sum":
          agg = E.add(agg, next);
          break;
      }
    }
    let result: Expr = E.mul(agg, E.const(this.scale));
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
      this.aggregation,
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
    if (FINAL_STAT_KEYS.has(statA)) {
      throw new Error(
        `CrossScalingBuff statA "${statA}" is a final stat — final stats cannot be used ` +
          `as scaling inputs (source: ${source.type}:${source.id}/${source.origin ?? ""})`
      );
    }
    if (FINAL_STAT_KEYS.has(statB)) {
      throw new Error(
        `CrossScalingBuff statB "${statB}" is a final stat — final stats cannot be used ` +
          `as scaling inputs (source: ${source.type}:${source.id}/${source.origin ?? ""})`
      );
    }
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const a = selfStats.get(this.statA, null) * this.scaleA;
    const capped = this.capA !== undefined ? Math.min(a, this.capA) : a;
    return [
      { key: this.outputKey, value: capped * selfStats.get(this.statB, null) },
    ];
  }

  dynamicBuffsExpr(selfStats: ExprStatSheet): { key: StatKey; expr: Expr }[] {
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
/**
 * Convert ExtraBuff[] into StatBuff[] for integration with the buff system.
 * Each ExtraBuff becomes one StatBuff with source.type = "extra".
 */
/** Strip category prefix (e.g. "food:gateau_debord" → "gateau_debord") from presetId. */
function stripCategoryPrefix(presetId: string): string {
  const idx = presetId.indexOf(":");
  return idx >= 0 ? presetId.slice(idx + 1) : presetId;
}

export function createExtraStatBuffs(extraBuffs: ExtraBuff[]): StatBuff[] {
  return extraBuffs.map((buff) => {
    const source: BuffSource = {
      type: "extra",
      id: buff.presetId ? stripCategoryPrefix(buff.presetId) : buff.id,
    };
    const target: BuffTarget =
      buff.target === "team"
        ? { receiver: "team" }
        : { receiver: "team", charId: buff.target };
    return new StatBuff(source, target, buff.stats);
  });
}
type ReceiverRule = (
  providerCharId: string,
  selfCharId: string,
  selfIsOnField: boolean
) => boolean;
const RECEIVER_RULES: Record<BuffReceiverType, ReceiverRule> = {
  // Field-independent
  self: (owner, self) => owner === self,
  other: (owner, self) => owner !== self,
  team: () => true,
  // Field-dependent
  selfOnField: (owner, self, onField) => owner === self && onField,
  selfOffField: (owner, self, onField) => owner === self && !onField,
  otherOnField: (owner, self, onField) => owner !== self && onField,
  otherOffField: (owner, self, onField) => owner !== self && !onField,
  teamOnField: (_, __, onField) => onField,
  teamOffField: (_, __, onField) => !onField,
};
/**
 * Standalone applicability check — works on any object with a `.target` property,
 * including plain-object casts. Prefer `buff.isApplicable(...)` when you have a
 * real StatBuff instance.
 */
export function isBuffApplicable(
  buff: Pick<StatBuff, "target">,
  providerCharId: string,
  selfCharId: string,
  selfIsOnField: boolean,
  selfRegion?: Region,
  selfFaction?: Faction
): boolean {
  if (buff.target.charId !== undefined) {
    if (buff.target.charId !== selfCharId) return false;
  }
  if (buff.target.regions && selfRegion !== undefined) {
    if (!buff.target.regions.includes(selfRegion)) return false;
  }
  if (buff.target.factions && selfFaction !== undefined) {
    if (!buff.target.factions.includes(selfFaction)) return false;
  }
  return RECEIVER_RULES[buff.target.receiver](
    providerCharId,
    selfCharId,
    selfIsOnField
  );
} /** Build the buffApplicability map from a formula-specific DisplayResult's buffs. */

/** Build a merged overlay from an array of bespoke buffs. */
export function buildBespokeOverlay(
  bespokeBuffs: StatBuff[],
  baseStats: StatSheet,
  teamStats: StatSheet[]
): StatSheet {
  let overlay = StatSheet.fromEntries([]);
  for (const bb of bespokeBuffs) {
    overlay = overlay.merge(
      StatSheet.fromEntries(
        [...bb.staticBuffs, ...bb.dynamicBuffs(baseStats, teamStats)],
        bb.target.filter
      )
    );
  }
  return overlay;
}

/** Extract maxStacks from bespoke buff array (first buff that has it). */
export function bespokeMaxStacks(
  bespokeBuffs: StatBuff[] | undefined
): number | undefined {
  if (!bespokeBuffs) return undefined;
  for (const bb of bespokeBuffs) {
    if (bb.source.maxStacks != null) return bb.source.maxStacks;
  }
  return undefined;
}

export function buildBuffApplicability(
  buffs: ResolvedBuff[]
): Record<string, number[] | undefined> {
  const map: Record<string, number[] | undefined> = {};
  for (const b of buffs) {
    if (b.active && !b.bespokeLabel) {
      map[b.buffKey] = b.activePartIndices;
    }
  }
  return map;
}
