import type { Element, Faction, Region } from "@/data/types";
import { getNextLevelTier } from "@/lib/gameStatsLoader";
import { ELEMENT_ELIGIBLE_REACTIONS } from "./constants";
import {
  ScalingBuff,
  assertNoDuplicateStatKeys,
  deduplicateBuffs,
} from "./damageBuffs";
import {
  type ArtifactHalfSetBase,
  type ArtifactSetBase,
  type CharacterBase,
  StatBuff,
  StatSheet,
  TeamMeta,
  type WeaponBase,
  createArtifactHalfSet,
  createArtifactSet,
  createCharacter,
  createReactionVariant,
  createWeapon,
} from "./damageModels";

import { AVG_SUBSTAT_ROLL } from "@/lib/account-data/scoring/utils";
import type { CombatOpts } from "./damageModels";
import type {
  BuffSource,
  BuffTarget,
  CalcContext,
  CharCompConfig,
  ComboFormula,
  ComboResult,
  DamageResult,
  DamageTag,
  DisplayPart,
  DisplayResult,
  I18nLabel,
  ReactionOverride,
  ResolvedBuff,
  ResolvedStatEntry,
  StatEntry,
  StatKey,
} from "./types";
import { filterMatchesTag, resolvePartReaction } from "./types";

export { TeamMeta };

// ═══════════════════════════════════════════════════════════════
// TeamResonance
// ═══════════════════════════════════════════════════════════════

/**
 * Elemental resonance buffs derived from team composition.
 * Resonance triggers when ≥2 characters share an element,
 * or when all 4 characters have unique elements.
 */
export class TeamResonance {
  readonly buffs: StatBuff[];

  constructor(teamMeta: TeamMeta) {
    const buffs: StatBuff[] = [];

    const elemCounts = new Map<Element, number>();
    for (const el of Object.values(teamMeta.elements)) {
      if (el === undefined) continue;
      elemCounts.set(el, (elemCounts.get(el) ?? 0) + 1);
    }
    const uniqueElements = elemCounts.size;

    // Pyro 2+: ATK +25%
    if ((elemCounts.get("Pyro") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "pyro" },
          { receiver: "team" },
          [{ key: "atk%", value: 0.25 }]
        )
      );
    }

    // Hydro 2+: HP +25%
    if ((elemCounts.get("Hydro") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "hydro" },
          { receiver: "team" },
          [{ key: "hp%", value: 0.25 }]
        )
      );
    }

    // Cryo 2+: CR +15% against Cryo-affected/Frozen (assume active)
    if ((elemCounts.get("Cryo") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "cryo" },
          { receiver: "team" },
          [{ key: "cr", value: 0.15 }]
        )
      );
    }

    // Geo 2+: DMG +15% when shielded + Geo RES -20% when dealing DMG (assume active)
    if ((elemCounts.get("Geo") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "geo" },
          { receiver: "team" },
          [{ key: "dmg%", value: 0.15 }]
        ),
        new StatBuff(
          { type: "teamResonance", id: "geo" },
          { receiver: "team", filter: { elements: ["Geo"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
    }

    // Dendro 2+: EM +50 (base), +30 after Burning/Quicken/Bloom/LunarBloom, +20 after Aggravate/Spread/Hyperbloom/Burgeon (assume active: total EM +100)
    if ((elemCounts.get("Dendro") ?? 0) >= 2) {
      let emBonus = 50;
      if (
        teamMeta.hasReaction("burning") ||
        teamMeta.hasReaction("quicken") ||
        teamMeta.hasReaction("bloom") ||
        teamMeta.hasReaction("lunarBloom")
      ) {
        emBonus += 30;
      }
      if (
        teamMeta.hasReaction("aggravate") ||
        teamMeta.hasReaction("spread") ||
        teamMeta.hasReaction("hyperbloom") ||
        teamMeta.hasReaction("burgeon")
      ) {
        emBonus += 20;
      }

      buffs.push(
        new StatBuff(
          { type: "teamResonance", id: "dendro" },
          { receiver: "team" },
          [{ key: "em", value: emBonus }]
        )
      );
    }

    // 4 unique elements: All Elemental RES +15%, Physical RES +15% (defensive, out of scope)
    // Electro 2+ and Anemo 2+: no directly modellable damage bonuses
    // (energy particles, stamina, movement speed, cooldown reduction are out of scope)

    this.buffs = buffs;
  }
}

export type EvaluatedDynamicBuff = {
  buff: StatBuff;
  source: BuffSource;
  providerCharId: string;
  entries: StatEntry[];
};

export type ProvidedStaticBuff = {
  buff: StatBuff;
  providerCharId: string;
};

/** Precomputed context for repeated optimizer evaluations. */
export type OptimizerContext = {
  swapCharId: string;
  calcTargetId: string;
  ctx?: CalcContext;
  targetDependent: Record<string, StatBuff[]>;
  supportPreStats: Record<string, StatSheet>;
  charBuildOrder: [string, CharBuild][];
};

// ═══════════════════════════════════════════════════════════════
// CharBuild
// ═══════════════════════════════════════════════════════════════

/**
 * Composes a single character's build:
 * character + weapon + artifact sets → stats + buffs + formulas.
 *
 * Owns the stat resolution pipeline:
 * Phase 1: Base stats (character + weapon) → baseStatSheet
 * Phase 2: + target-independent static buffs → innerStatSheet  (construction)
 * Phase 3: + target-dependent buffs + artifact stats → preStats (getTeamStats)
 * Phase 4: + dynamic buffs → postStats                         (getTeamStats)
 */
export class CharBuild {
  readonly charBase: CharacterBase;
  readonly weaponBase: WeaponBase;
  readonly artifactSetBase: ArtifactSetBase | null;
  readonly artifactHalfSetBases: ArtifactHalfSetBase[];
  private readonly resonanceBuffs: StatBuff[] = [];
  private innerStatSheet: StatSheet;

  constructor(
    config: CharCompConfig,
    teamMeta: TeamMeta,
    combatOpts: CombatOpts = {}
  ) {
    this.charBase = createCharacter(
      config.charId,
      config.charLevel,
      config.constellation,
      teamMeta,
      combatOpts
    );
    this.weaponBase = createWeapon(
      config.weaponId,
      config.refinement,
      config.charId,
      teamMeta,
      combatOpts
    );
    this.artifactSetBase = config.artifactSetId
      ? createArtifactSet(
          config.artifactSetId,
          config.charId,
          teamMeta,
          combatOpts
        )
      : null;

    // Auto-include the 2pc half-set when using a 4pc set (if the set declares one)
    const auto2pcId = this.artifactSetBase?.halfSetId ?? null;
    const auto2pc = auto2pcId
      ? createArtifactHalfSet(auto2pcId, config.charId, teamMeta)
      : null;

    this.artifactHalfSetBases = [
      ...(auto2pc ? [auto2pc] : []),
      ...config.artifactHalfSetIds.map((id) =>
        createArtifactHalfSet(id, config.charId, teamMeta)
      ),
    ];

    if (
      teamMeta.countByFaction("Moonsign") >= 2 &&
      teamMeta.factions[config.charId] !== "Moonsign"
    ) {
      const src: BuffSource = {
        type: "teamResonance",
        id: "gleam",
        noStackId: "nk_resonance_reaction_dmg",
      };
      const tgt: BuffTarget = {
        receiver: "team",
        filter: {
          reactions: ["lunarBloom", "lunarCharged", "lunarCrystallize"],
        },
      };
      const el = teamMeta.elements[config.charId];

      if (el === "Pyro" || el === "Electro" || el === "Cryo") {
        this.resonanceBuffs.push(
          new ScalingBuff(src, tgt, [], "atk", "reactionDmg%", 0.00009, 0.36)
        );
      } else if (el === "Hydro") {
        this.resonanceBuffs.push(
          new ScalingBuff(src, tgt, [], "hp", "reactionDmg%", 0.000006, 0.36)
        );
      } else if (el === "Geo") {
        this.resonanceBuffs.push(
          new ScalingBuff(src, tgt, [], "def", "reactionDmg%", 0.0001, 0.36)
        );
      } else if (el === "Anemo" || el === "Dendro") {
        this.resonanceBuffs.push(
          new ScalingBuff(src, tgt, [], "em", "reactionDmg%", 0.000225, 0.36)
        );
      }
    }

    // Superconduct: if team has both Cryo and Electro, -40% Physical RES
    const teamElements = Object.values(teamMeta.elements).filter(
      (el): el is Element => el !== undefined
    );
    const hasCryo = teamElements.includes("Cryo");
    const hasElectro = teamElements.includes("Electro");
    if (hasCryo && hasElectro) {
      this.resonanceBuffs.push(
        new StatBuff(
          { type: "teamResonance", id: "superconduct" },
          { receiver: "team", filter: { elements: ["Physical" as const] } },
          [{ key: "resReduction%", value: 0.4 }]
        )
      );
    }

    // Phase 1: Assemble base stats from character + weapon + artifact set 2pc bonuses
    const baseEntries: StatEntry[] = [
      ...this.charBase.stats,
      ...this.weaponBase.stats,
      ...(this.artifactSetBase?.stats ?? []),
      ...this.artifactHalfSetBases.flatMap((h) => h.stats),
    ];
    this.innerStatSheet = new StatSheet(baseEntries);
  }

  /**
   * Collect all buffs from this build's providers, filtering out no-ops.
   *
   * WARNING: Returns a fresh array with fresh object references on each call.
   * Some providers use `get buffs()` getters that create new StatBuff
   * instances per invocation. Do NOT compare objects from separate calls
   * via Set.has() or ===. For stable references, use TeamBuild.allStaticBuffs
   * which is populated once at construction time.
   */
  getAllBuffs(): StatBuff[] {
    return [
      ...this.resonanceBuffs,
      ...this.charBase.buffs,
      ...this.weaponBase.buffs,
      ...(this.artifactSetBase?.buffs ?? []),
      ...this.artifactHalfSetBases.flatMap((h) => h.buffs),
    ].filter((b) => !b.isNoOp);
  }

  /**
   * Apply target-independent static buffs (self, selfOffField, team).
   * Called once during TeamBuild construction.
   * Target-dependent buffs (onField, selfOnField) are deferred to getTeamStats.
   */
  applyStaticBuffs(
    teamStaticBuffs: ProvidedStaticBuff[],
    selfCharId: string,
    selfRegion?: Region,
    selfFaction?: Faction
  ): void {
    let applicable = teamStaticBuffs
      .filter((b) =>
        isBuffApplicable(
          b.buff,
          b.providerCharId,
          selfCharId,
          null,
          selfRegion,
          selfFaction
        )
      )
      .map((b) => b.buff);
    applicable = deduplicateBuffs(applicable, (b) => b.staticBuffs);
    this.innerStatSheet = this.innerStatSheet.apply(applicable);
  }

  /**
   * Merge with artifact stats + apply target-dependent static buffs.
   * Returns "pre-stats": after base + all static buffs + artifacts, before dynamic.
   */
  getPreStats(
    artifactStats: StatSheet,
    targetDependentBuffs: StatBuff[]
  ): StatSheet {
    const merged = this.innerStatSheet.merge(artifactStats);
    if (targetDependentBuffs.length === 0) return merged;
    const applicable = deduplicateBuffs(
      targetDependentBuffs,
      (b) => b.staticBuffs
    );
    return merged.apply(applicable);
  }

  /**
   * Apply dynamic buffs to pre-stats → post-stats.
   * Evaluates all applicable dynamic buffs.
   */
  getPostStats(
    selfPreStats: StatSheet,
    teamDynamicBuffs: EvaluatedDynamicBuff[],
    selfCharId: string,
    calcTargetId: string,
    selfRegion?: Region,
    selfFaction?: Faction
  ): StatSheet {
    let applicable = teamDynamicBuffs.filter((b) =>
      isBuffApplicable(
        b.buff,
        b.providerCharId,
        selfCharId,
        calcTargetId,
        selfRegion,
        selfFaction
      )
    );
    applicable = deduplicateBuffs(applicable, (b) => b.entries);

    const mappedToStatic = applicable.map(
      (b) => new StatBuff(b.buff.source, b.buff.target, b.entries)
    );
    return selfPreStats.apply(mappedToStatic);
  }

  getFormulaIds(): Record<string, I18nLabel> {
    return this.charBase.formulaIds;
  }

  getDamageResult(
    formulaId: string,
    selfPostStats: StatSheet,
    teamPostStats: StatSheet[],
    ctx: CalcContext,
    reactionOverride?: ReactionOverride
  ): DamageResult {
    return this.charBase.getDamageResult(
      formulaId,
      selfPostStats,
      teamPostStats,
      ctx,
      reactionOverride
    );
  }

  /** Cold path: produce structured display data for a formula. */
  getDisplayParts(
    formulaId: string,
    selfPostStats: StatSheet,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride
  ): { parts: DisplayPart[]; totalDamage: number } {
    const entry = this.charBase.getFormulaEntry(formulaId);
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);
    const displayParts: DisplayPart[] = [];
    let totalDamage = 0;
    for (let i = 0; i < entry.parts.length; i++) {
      const { formula, hits: totalHits, bespokeBuff } = entry.parts[i];
      const h = totalHits ?? 1;

      // Apply per-part stat overlay if present
      const stats = bespokeBuff
        ? selfPostStats.merge(
            StatSheet.fromEntries(
              [
                ...bespokeBuff.staticBuffs,
                ...bespokeBuff.dynamicBuffs(selfPostStats, []),
              ],
              bespokeBuff.target.filter
            )
          )
        : selfPostStats;

      const hasReaction =
        reactionOverride?.reaction && reactionOverride.reaction !== "none";

      // Skip reaction override if the formula already has a built-in reaction
      // (e.g., LunarDirectFormula with lunarBloom should not be converted to CatalyzeFormula)
      if (!hasReaction || formula.tag.reaction !== "none") {
        const dp = formula.display(stats, this.charBase.charLevel, ctx);
        dp.hits = h;
        totalDamage += dp.damage * h;
        displayParts.push(dp);
        continue;
      }

      const partEligible =
        ELEMENT_ELIGIBLE_REACTIONS[
          formula.tag.element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
        ];
      const targetReaction = resolvePartReaction(
        reactionOverride,
        i,
        partEligible
      );

      const reactingHits =
        targetReaction !== "none"
          ? Math.min(reactionOverride.partHits?.[i] ?? h, h)
          : 0;
      const nonReactingHits = h - reactingHits;

      if (reactingHits > 0) {
        const effectiveFormula =
          targetReaction !== formula.tag.reaction
            ? createReactionVariant(formula, targetReaction)
            : formula;
        const dp = effectiveFormula.display(
          stats,
          this.charBase.charLevel,
          ctx
        );
        dp.hits = reactingHits;
        totalDamage += dp.damage * reactingHits;
        displayParts.push(dp);
      }
      if (nonReactingHits > 0) {
        const dp = formula.display(stats, this.charBase.charLevel, ctx);
        dp.hits = nonReactingHits;
        totalDamage += dp.damage * nonReactingHits;
        displayParts.push(dp);
      }
    }
    return { parts: displayParts, totalDamage };
  }
}

type ReceiverRule = (
  providerCharId: string,
  selfCharId: string,
  calcTargetId: string | null
) => boolean;

const RECEIVER_RULES: Record<string, ReceiverRule> = {
  self: (owner, self) => owner === self,
  selfOffField: (owner, self) => owner === self,
  selfOnField: (owner, self, target) =>
    target !== null && owner === self && self === target,
  onField: (_, self, target) => target !== null && self === target,
  otherOnField: (owner, self, target) =>
    target !== null && self !== owner && self === target,
  team: () => true,
};

/**
 * Determine whether a buff applies to a given character's stat sheet.
 *
 * @param buff        The buff to check
 * @param selfCharId  The character whose stat sheet we're building
 * @param calcTargetId The character being optimized (on-field).
 *                     null = target-independent filtering only (construction phase).
 * @param selfRegion  Region of the target character (for region-scoped buffs).
 * @param selfFaction Faction of the target character (for faction-scoped buffs).
 */
export function isBuffApplicable(
  buff: StatBuff,
  providerCharId: string,
  selfCharId: string,
  calcTargetId: string | null,
  selfRegion?: Region,
  selfFaction?: Faction
): boolean {
  // CharId filter: if buff specifies charId, target must match
  if (buff.target.charId !== undefined) {
    if (buff.target.charId !== selfCharId) return false;
  }
  // Region filter: if buff specifies regions, target must be from one of them
  if (buff.target.regions && selfRegion !== undefined) {
    if (!buff.target.regions.includes(selfRegion)) return false;
  }
  // Faction filter: if buff specifies factions, target must be from one of them
  if (buff.target.factions && selfFaction !== undefined) {
    if (!buff.target.factions.includes(selfFaction)) return false;
  }

  const rule = RECEIVER_RULES[buff.target.receiver];
  return rule ? rule(providerCharId, selfCharId, calcTargetId) : false;
}

// ═══════════════════════════════════════════════════════════════
// TeamBuild
// ═══════════════════════════════════════════════════════════════

/**
 * Orchestrates the full team's damage calculation.
 * Owns the stat resolution pipeline across all 4 team members.
 *
 * Construction is immutable (team composition + CombatOpts).
 * `getTeamStats(artifactStats, calcTargetId)` is the hot path.
 */
export class TeamBuild {
  readonly charBuilds: Record<string, CharBuild>;
  readonly teamMeta: TeamMeta;
  readonly teamResonance: TeamResonance;
  readonly allStaticBuffs: ProvidedStaticBuff[];
  /** Original configs used to construct this TeamBuild (for reconstruction). */
  readonly configs: CharCompConfig[];
  /** Original combat opts used to construct this TeamBuild (for reconstruction). */
  readonly combatOpts: CombatOpts;
  /** Enemy persistent element aura (for reconstruction). */
  readonly enemyElementAura?: Element;

  constructor(
    configs: CharCompConfig[],
    combatOpts: CombatOpts = {},
    enemyElementAura?: Element
  ) {
    this.configs = configs;
    this.combatOpts = combatOpts;
    this.enemyElementAura = enemyElementAura;
    const charIds = configs.map((c) => c.charId);
    const constellations: Record<string, number> = {};
    const artifactSets: Record<string, string> = {};
    for (const c of configs) {
      if (c.artifactSetId) artifactSets[c.charId] = c.artifactSetId;
      constellations[c.charId] = c.constellation;
    }
    this.teamMeta = new TeamMeta(
      charIds,
      constellations,
      artifactSets,
      enemyElementAura
    );
    this.teamResonance = new TeamResonance(this.teamMeta);

    // Create CharBuilds
    this.charBuilds = {};
    for (const config of configs) {
      this.charBuilds[config.charId] = new CharBuild(
        config,
        this.teamMeta,
        combatOpts
      );
    }

    // Collect all static buffs across the team
    this.allStaticBuffs = this.teamResonance.buffs.map((buff) => ({
      buff,
      providerCharId: "resonance",
    }));
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      for (const buff of build.getAllBuffs()) {
        this.allStaticBuffs.push({ buff, providerCharId: charId });
      }
    }

    // Apply target-independent static buffs (self, selfOffField, team) at construction.
    // Target-dependent buffs (onField, selfOnField) are deferred to getTeamStats.
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      build.applyStaticBuffs(
        this.allStaticBuffs,
        charId,
        this.teamMeta.regions[charId],
        this.teamMeta.factions[charId]
      );
    }
  }

  /**
   * Collect dynamic buffs from allStaticBuffs, evaluated against pre-stats.
   * Uses construction-time buff references for consistency with resolveBuffs.
   */
  private collectDynamicBuffs(
    preStats: Record<string, StatSheet>,
    teamPreStatsArr: StatSheet[]
  ): EvaluatedDynamicBuff[] {
    const results: EvaluatedDynamicBuff[] = [];
    for (const { buff, providerCharId } of this.allStaticBuffs) {
      if (providerCharId === "resonance") continue;
      const ownerStats = preStats[providerCharId]!;
      const entries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
      assertNoDuplicateStatKeys(
        entries,
        `dynamicBuffs (source: ${buff.source.type}:${buff.source.id})`
      );
      if (entries.length > 0) {
        results.push({ buff, source: buff.source, providerCharId, entries });
      }
    }
    return results;
  }

  /**
   * Compute final stat sheets for all team members.
   * This is the hot path during artifact optimization.
   *
   * @param artifactStats  Per-character artifact stat sheets
   * @param calcTargetId   The character being optimized (determines onField buff routing)
   */
  getTeamStats(
    artifactStats: Record<string, StatSheet>,
    calcTargetId: string,
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    // Collect target-dependent static buffs (onField, selfOnField) for each character
    const targetDependent: Record<string, StatBuff[]> = {};
    for (const charId of Object.keys(this.charBuilds)) {
      targetDependent[charId] = this.allStaticBuffs
        .filter((b) => {
          const r = b.buff.target.receiver;
          if (r !== "onField" && r !== "selfOnField" && r !== "otherOnField")
            return false;
          return isBuffApplicable(
            b.buff,
            b.providerCharId,
            charId,
            calcTargetId,
            this.teamMeta.regions[charId],
            this.teamMeta.factions[charId]
          );
        })
        .map((b) => b.buff);
    }

    // Phase 2: Pre-stats (base + all static buffs + artifacts)
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      preStats[id] = build.getPreStats(
        artifactStats[id] ?? new StatSheet([]),
        targetDependent[id]!
      );
    }

    // Phase 3: Collect dynamic buffs from all members
    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(preStats, teamPreStatsArr);

    // Phase 4: Apply dynamic buffs → post-stats
    const postStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      postStats[id] = build.getPostStats(
        preStats[id]!,
        allDynamicBuffs,
        id,
        calcTargetId,
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }

    // Phase 5: Apply critRateTarget bonus to all team members
    if (ctx?.critRateTarget != null) {
      const crDelta = (100 - ctx.critRateTarget) / 100;
      for (const id of Object.keys(postStats)) {
        postStats[id] = postStats[id].withDelta("cr", crDelta);
      }
    }

    return postStats;
  }

  /**
   * Create a reusable context for repeated getTeamStats calls where only one
   * character's artifact sheet changes.  Caches target-dependent buff filtering
   * and support characters' preStats so the hot loop only recomputes the
   * swapped character's preStats.
   */
  createOptimizerContext(
    baseSheets: Record<string, StatSheet>,
    swapCharId: string,
    calcTargetId: string,
    ctx?: CalcContext
  ): OptimizerContext {
    // Target-dependent buff filtering (constant for a given calcTargetId)
    const targetDependent: Record<string, StatBuff[]> = {};
    for (const charId of Object.keys(this.charBuilds)) {
      targetDependent[charId] = this.allStaticBuffs
        .filter((b) => {
          const r = b.buff.target.receiver;
          if (r !== "onField" && r !== "selfOnField" && r !== "otherOnField")
            return false;
          return isBuffApplicable(
            b.buff,
            b.providerCharId,
            charId,
            calcTargetId,
            this.teamMeta.regions[charId],
            this.teamMeta.factions[charId]
          );
        })
        .map((b) => b.buff);
    }

    // Support preStats (constant since their artifact sheets don't change)
    const supportPreStats: Record<string, StatSheet> = {};
    // charBuildOrder preserves Object.entries iteration order for FP parity
    const charBuildOrder = Object.entries(this.charBuilds);
    for (const [id, build] of charBuildOrder) {
      if (id !== swapCharId) {
        supportPreStats[id] = build.getPreStats(
          baseSheets[id] ?? new StatSheet([]),
          targetDependent[id]!
        );
      }
    }

    return {
      swapCharId,
      calcTargetId,
      ctx,
      targetDependent,
      supportPreStats,
      charBuildOrder,
    };
  }

  /**
   * Fast getTeamStats using a precomputed OptimizerContext.
   * Only recomputes preStats for swapCharId; reuses cached support preStats.
   * Produces identical FP results to getTeamStats.
   */
  getTeamStatsFast(
    swapCharSheet: StatSheet,
    optCtx: OptimizerContext
  ): Record<string, StatSheet> {
    const {
      swapCharId,
      calcTargetId,
      ctx,
      targetDependent,
      supportPreStats,
      charBuildOrder,
    } = optCtx;

    // Build preStats with same key insertion order as getTeamStats
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of charBuildOrder) {
      if (id === swapCharId) {
        preStats[id] = build.getPreStats(swapCharSheet, targetDependent[id]!);
      } else {
        preStats[id] = supportPreStats[id]!;
      }
    }

    // Dynamic buffs (must recompute — may depend on swapCharId's preStats)
    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(preStats, teamPreStatsArr);

    // Post-stats
    const postStats: Record<string, StatSheet> = {};
    for (const [id, build] of charBuildOrder) {
      postStats[id] = build.getPostStats(
        preStats[id]!,
        allDynamicBuffs,
        id,
        calcTargetId,
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }

    // critRateTarget
    if (ctx?.critRateTarget != null) {
      const crDelta = (100 - ctx.critRateTarget) / 100;
      for (const id of Object.keys(postStats)) {
        postStats[id] = postStats[id].withDelta("cr", crDelta);
      }
    }

    return postStats;
  }

  /** All available formulas across all characters */
  getFormulaIds(): Record<string, Record<string, I18nLabel>> {
    const result: Record<string, Record<string, I18nLabel>> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getFormulaIds();
    }
    return result;
  }

  /** Default rotation counts for a character (from CharacterBase.rotation). */
  getRotation(charId: string): Record<string, number> {
    return this.charBuilds[charId]?.charBase.rotation ?? {};
  }

  /** Evaluate a specific character's damage formula with the given team stats */
  getDamageResult(
    charId: string,
    formulaId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride
  ): DamageResult {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);
    const teamStatsArr = Object.values(teamStats);
    return build.getDamageResult(
      formulaId,
      teamStats[charId]!,
      teamStatsArr,
      ctx,
      reactionOverride
    );
  }

  /**
   * Cold-path display entry point.
   * Produces all data needed for UI display: formula breakdown, buffs, stats, marginal gains.
   */
  getDisplayResult(
    charId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride
  ): DisplayResult {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);

    // ── Stat resolution (mirrors getTeamStats but captures intermediate phases) ──
    const targetDependent: Record<string, StatBuff[]> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      targetDependent[cid] = this.allStaticBuffs
        .filter((b) => {
          const r = b.buff.target.receiver;
          if (r !== "onField" && r !== "selfOnField" && r !== "otherOnField")
            return false;
          return isBuffApplicable(
            b.buff,
            b.providerCharId,
            cid,
            charId,
            this.teamMeta.regions[cid],
            this.teamMeta.factions[cid]
          );
        })
        .map((b) => b.buff);
    }

    const preStats: Record<string, StatSheet> = {};
    for (const [id, cb] of Object.entries(this.charBuilds)) {
      preStats[id] = cb.getPreStats(
        artifactStats[id] ?? new StatSheet([]),
        targetDependent[id]!
      );
    }

    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(preStats, teamPreStatsArr);

    const postStats: Record<string, StatSheet> = {};
    for (const [id, cb] of Object.entries(this.charBuilds)) {
      postStats[id] = cb.getPostStats(
        preStats[id]!,
        allDynamicBuffs,
        id,
        charId,
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }

    // Apply critRateTarget bonus to all team members
    if (ctx.critRateTarget != null) {
      const crDelta = (100 - ctx.critRateTarget) / 100;
      for (const id of Object.keys(postStats)) {
        postStats[id] = postStats[id].withDelta("cr", crDelta);
      }
    }

    // ── Formula display ──
    const entry = build.charBase.getFormulaEntry(formulaId);
    const formulaTags: DamageTag[] = [];
    if (entry && entry.parts.length > 0) {
      for (const part of entry.parts) {
        if (part.formula.tag) {
          formulaTags.push(part.formula.tag);
        }
      }
    }

    const { parts, totalDamage } = build.getDisplayParts(
      formulaId,
      postStats[charId]!,
      ctx,
      reactionOverride
    );

    // ── Buff resolution ──
    const buffs = this.resolveBuffs(
      charId,
      preStats,
      teamPreStatsArr,
      formulaTags
    );

    // ── Stats (full team) — deprecated flat projections ──
    const idleStats: Record<string, Partial<Record<StatKey, number>>> = {};
    const combatStats: Record<string, Partial<Record<StatKey, number>>> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      idleStats[cid] = preStats[cid]!.getAll();
      combatStats[cid] = postStats[cid]!.getAll(
        cid === charId ? formulaTags[0] : undefined
      );
    }

    // ── Collect all formula tags per character ──
    const charFormulaTags: Record<string, DamageTag[]> = {};
    for (const [cid, cb] of Object.entries(this.charBuilds)) {
      const tags: DamageTag[] = [];
      const seen = new Set<string>();
      for (const fid of Object.keys(cb.getFormulaIds())) {
        const fEntry = cb.charBase.getFormulaEntry(fid);
        if (!fEntry) continue;
        for (const part of fEntry.parts) {
          const t = part.formula.tag;
          const key = `${t.element}|${t.ability}|${t.reaction}`;
          if (!seen.has(key)) {
            seen.add(key);
            tags.push(t);
          }
        }
      }
      charFormulaTags[cid] = tags;
    }

    // ── Raw StatSheets with on/off field contexts ──
    const statsCache = new Map<string, Record<string, StatSheet>>();
    statsCache.set(charId, postStats); // reuse existing computation

    const statSheets: Record<
      string,
      { onField: StatSheet; offField: StatSheet }
    > = {};
    for (const cid of Object.keys(this.charBuilds)) {
      // On-field: stats when cid is on-field
      if (!statsCache.has(cid)) {
        statsCache.set(cid, this.getTeamStats(artifactStats, cid, ctx));
      }
      const onField = statsCache.get(cid)![cid]!;

      // Off-field: stats when someone else is on-field
      const offCtx =
        cid !== charId
          ? charId // reuse existing calcTarget context
          : Object.keys(this.charBuilds).find((x) => x !== cid)!;
      if (offCtx && !statsCache.has(offCtx)) {
        statsCache.set(offCtx, this.getTeamStats(artifactStats, offCtx, ctx));
      }
      const offField = offCtx ? statsCache.get(offCtx)![cid]! : onField;

      statSheets[cid] = { onField, offField };
    }

    // ── Marginal gains ──
    const marginalGains = this.computeMarginalGains(
      charId,
      formulaId,
      artifactStats,
      ctx,
      totalDamage,
      parts,
      reactionOverride
    );

    // ── Level-up gains (Lv90 → Lv100) ──
    const levelUpGains = this.computeLevelUpGains(
      charId,
      formulaId,
      artifactStats,
      ctx,
      totalDamage,
      reactionOverride
    );

    return {
      parts,
      totalDamage,
      buffs,
      statSheets,
      charFormulaTags,
      marginalGains,
      levelUpGains,
      idleStats,
      combatStats,
    };
  }

  /** Resolve all buffs into active/inactive ResolvedBuff[] for display. */
  private resolveBuffs(
    calcTargetId: string,
    preStats: Record<string, StatSheet>,
    teamPreStatsArr: StatSheet[],
    formulaTags: DamageTag[]
  ): ResolvedBuff[] {
    const result: ResolvedBuff[] = [];

    // Use allStaticBuffs (populated once at construction) as the single source
    // of buff objects. This avoids reference-identity mismatches caused by
    // weapon/artifact getters that create new StatBuff instances each call.
    const calcTargetRegion = this.teamMeta.regions[calcTargetId];
    const calcTargetFaction = this.teamMeta.factions[calcTargetId];

    // Exclude resonance entries — they are handled separately below.
    const charBuffEntries = this.allStaticBuffs.filter(
      (b) => b.providerCharId !== "resonance"
    );

    // ── Active static set ──
    // For each character, determine the correct selfCharId based on receiver.
    let applicableStatic = charBuffEntries
      .filter((b) => {
        const receiver = b.buff.target.receiver;
        const isSelfTargeting =
          receiver === "self" || receiver === "selfOffField";
        const selfId = isSelfTargeting ? b.providerCharId : calcTargetId;
        const selfRegion = isSelfTargeting
          ? this.teamMeta.regions[b.providerCharId]
          : calcTargetRegion;
        const selfFaction = isSelfTargeting
          ? this.teamMeta.factions[b.providerCharId]
          : calcTargetFaction;
        return isBuffApplicable(
          b.buff,
          b.providerCharId,
          selfId,
          calcTargetId,
          selfRegion,
          selfFaction
        );
      })
      .map((b) => b.buff);
    applicableStatic = deduplicateBuffs(applicableStatic, (b) => b.staticBuffs);
    const activeStaticSet = new Set<StatBuff>(applicableStatic);

    // ── Active dynamic set ──
    // Evaluate dynamic buffs from the same allStaticBuffs objects.
    const allDynamic: EvaluatedDynamicBuff[] = [];
    for (const { buff, providerCharId } of charBuffEntries) {
      const ownerStats = preStats[providerCharId]!;
      const entries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
      if (entries.length > 0) {
        allDynamic.push({ buff, source: buff.source, providerCharId, entries });
      }
    }

    let applicableDynamic = allDynamic.filter((b) => {
      const receiver = b.buff.target.receiver;
      const isSelfTargeting =
        receiver === "self" || receiver === "selfOffField";
      const selfId = isSelfTargeting ? b.providerCharId : calcTargetId;
      const selfRegion = isSelfTargeting
        ? this.teamMeta.regions[b.providerCharId]
        : calcTargetRegion;
      const selfFaction = isSelfTargeting
        ? this.teamMeta.factions[b.providerCharId]
        : calcTargetFaction;
      return isBuffApplicable(
        b.buff,
        b.providerCharId,
        selfId,
        calcTargetId,
        selfRegion,
        selfFaction
      );
    });
    applicableDynamic = deduplicateBuffs(applicableDynamic, (b) => b.entries);
    const activeDynamicSet = new Set<StatBuff>(
      applicableDynamic.map((e) => e.buff)
    );

    // ── Display loop ──
    // Iterate charBuffEntries (not cb.getAllBuffs()) so Set.has() matches.
    for (const { buff, providerCharId: ownerId } of charBuffEntries) {
      const receiver = buff.target.receiver;
      const isSelfTargeting =
        receiver === "self" || receiver === "selfOffField";
      const selfId = isSelfTargeting ? ownerId : calcTargetId;
      const selfRegion = isSelfTargeting
        ? this.teamMeta.regions[ownerId]
        : calcTargetRegion;
      const selfFaction = isSelfTargeting
        ? this.teamMeta.factions[ownerId]
        : calcTargetFaction;
      const applicable = isBuffApplicable(
        buff,
        ownerId,
        selfId,
        calcTargetId,
        selfRegion,
        selfFaction
      );

      // Resolve dynamic entries with per-entry caps
      let dynamicEntries: ResolvedStatEntry[] = [];
      let active = false;

      const ownerStats = preStats[ownerId]!;
      const raw = buff.dynamicBuffs(ownerStats, teamPreStatsArr);

      if (applicable) {
        if (raw.length > 0) {
          active = activeDynamicSet.has(buff);
          if (active && formulaTags.length > 0 && buff.target.filter) {
            active = formulaTags.some((tag) =>
              filterMatchesTag(buff.target.filter!, tag)
            );
          }
        } else {
          active = activeStaticSet.has(buff);
          if (active && formulaTags.length > 0 && buff.target.filter) {
            active = formulaTags.some((tag) =>
              filterMatchesTag(buff.target.filter!, tag)
            );
          }
        }
      }

      // Always populate dynamic entries for display, even when inactive
      if (raw.length > 0) {
        dynamicEntries = raw.map((entry) => {
          const resolved: ResolvedStatEntry = { ...entry };
          if (buff instanceof ScalingBuff) {
            if (buff.cap !== undefined) resolved.cap = buff.cap;
            resolved.inputKey = buff.inputKey;
          }
          return resolved;
        });
      }

      result.push({
        source: buff.source,
        providerCharId: ownerId,
        target: buff.target,
        active,
        staticEntries: buff.staticBuffs,
        dynamicEntries,
      });
    }

    // Also include resonance buffs
    for (const buff of this.teamResonance.buffs) {
      let active = true;
      if (formulaTags.length > 0 && buff.target.filter) {
        active = formulaTags.some((tag) =>
          filterMatchesTag(buff.target.filter!, tag)
        );
      }
      result.push({
        source: buff.source,
        target: buff.target,
        active,
        staticEntries: buff.staticBuffs,
        dynamicEntries: [],
      });
    }

    return result;
  }

  /** Compute marginal damage gains for +1 avg substat roll. */
  private computeMarginalGains(
    calcTargetId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    baseDamage: number,
    displayParts: DisplayPart[],
    reactionOverride?: ReactionOverride
  ): Record<string, Partial<Record<StatKey, number>>> {
    if (baseDamage === 0) return {};

    const gains: Record<string, Partial<Record<StatKey, number>>> = {};

    // For calc target: check stat keys used by the formula
    const usedKeys = new Set<StatKey>();
    for (const dp of displayParts) {
      for (const key of Object.keys(dp.statValues) as StatKey[]) {
        usedKeys.add(key);
      }
      for (const key of dp.scalingKeys) {
        usedKeys.add(key);
      }
    }

    // Flat hp/atk/def appear in formulas but their substat rolls are negligible;
    // replace with percent versions which are the meaningful substat rolls.
    const flatToPercent: Partial<Record<StatKey, StatKey>> = {
      hp: "hp%",
      atk: "atk%",
      def: "def%",
    };
    for (const [flat, pct] of Object.entries(flatToPercent) as [
      StatKey,
      StatKey,
    ][]) {
      if (usedKeys.has(flat)) {
        usedKeys.delete(flat);
        usedKeys.add(pct);
      }
    }

    // Also check the calc target's own scaling buffs (self-targeting) whose
    // Also check the calc target's own scaling buffs whose output feeds into the
    // formula indirectly (e.g. Engulfing Lightning: ER → ATK%).
    // Must run after flatToPercent so that e.g. "atk%" is in usedKeys.
    for (const { buff, providerCharId } of this.allStaticBuffs) {
      if (providerCharId !== calcTargetId) continue;
      if (buff instanceof ScalingBuff) {
        if (usedKeys.has(buff.outputKey)) usedKeys.add(buff.inputKey);
      }
    }

    // Filter to rollable stat keys only
    const rollableKeys = Object.keys(AVG_SUBSTAT_ROLL) as StatKey[];
    const targetRollable = rollableKeys.filter((k) => usedKeys.has(k));

    if (targetRollable.length > 0) {
      const charGains: Partial<Record<StatKey, number>> = {};
      for (const key of targetRollable) {
        const delta = (AVG_SUBSTAT_ROLL as Record<string, number>)[key];
        if (!delta) continue;
        const tweaked = { ...artifactStats };
        tweaked[calcTargetId] = (
          artifactStats[calcTargetId] ?? new StatSheet([])
        ).withDelta(key, delta);
        const newStats = this.getTeamStats(tweaked, calcTargetId, ctx);
        const build = this.charBuilds[calcTargetId]!;
        const newResult = build.getDamageResult(
          formulaId,
          newStats[calcTargetId]!,
          Object.values(newStats),
          ctx,
          reactionOverride
        );
        charGains[key] = (newResult.totalDamage - baseDamage) / baseDamage;
      }
      gains[calcTargetId] = charGains;
    }

    // For teammates: check inputKeys of their scaling buffs that affect calc target
    for (const cid of Object.keys(this.charBuilds)) {
      if (cid === calcTargetId) continue;
      const relevantKeys = new Set<StatKey>();
      for (const { buff, providerCharId } of this.allStaticBuffs) {
        if (providerCharId !== cid) continue;
        if (
          !isBuffApplicable(
            buff,
            cid,
            calcTargetId,
            calcTargetId,
            this.teamMeta.regions[calcTargetId],
            this.teamMeta.factions[calcTargetId]
          )
        )
          continue;
        if (buff instanceof ScalingBuff) {
          relevantKeys.add(buff.inputKey);
        }
      }

      // Same flat→percent substitution as for the carry.
      for (const [flat, pct] of Object.entries(flatToPercent) as [
        StatKey,
        StatKey,
      ][]) {
        if (relevantKeys.has(flat)) {
          relevantKeys.delete(flat);
          relevantKeys.add(pct);
        }
      }

      const teamRollable = rollableKeys.filter((k) => relevantKeys.has(k));
      if (teamRollable.length === 0) continue;

      const charGains: Partial<Record<StatKey, number>> = {};
      for (const key of teamRollable) {
        const delta = (AVG_SUBSTAT_ROLL as Record<string, number>)[key];
        if (!delta) continue;
        const tweaked = { ...artifactStats };
        tweaked[cid] = (artifactStats[cid] ?? new StatSheet([])).withDelta(
          key,
          delta
        );
        const newStats = this.getTeamStats(tweaked, calcTargetId, ctx);
        const build = this.charBuilds[calcTargetId]!;
        const newResult = build.getDamageResult(
          formulaId,
          newStats[calcTargetId]!,
          Object.values(newStats),
          ctx,
          reactionOverride
        );
        charGains[key] = (newResult.totalDamage - baseDamage) / baseDamage;
      }
      if (Object.keys(charGains).length > 0) {
        gains[cid] = charGains;
      }
    }

    return gains;
  }

  /**
   * Compute the relative damage gain from leveling each Lv90 character to Lv100.
   * Rebuilds the team with the character at Lv100 and compares damage.
   */
  private computeLevelUpGains(
    calcTargetId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    baseDamage: number,
    reactionOverride?: ReactionOverride
  ): Record<string, { gain: number; from: number; to: number }[]> {
    if (baseDamage === 0) return {};

    const computeGain = (charId: string, targetLevel: number) => {
      const tweakedConfigs = this.configs.map((c) =>
        c.charId === charId ? { ...c, charLevel: targetLevel } : c
      );
      const tweakedTeam = new TeamBuild(
        tweakedConfigs,
        this.combatOpts,
        this.enemyElementAura
      );
      const tweakedStats = tweakedTeam.getTeamStats(
        artifactStats,
        calcTargetId,
        ctx
      );
      const tweakedResult = tweakedTeam.getDamageResult(
        calcTargetId,
        formulaId,
        tweakedStats,
        ctx,
        reactionOverride
      );
      return (tweakedResult.totalDamage - baseDamage) / baseDamage;
    };

    const gains: Record<string, { gain: number; from: number; to: number }[]> =
      {};
    for (const config of this.configs) {
      const nextLevel = getNextLevelTier(config.charLevel);
      if (!nextLevel) continue;

      const entries: { gain: number; from: number; to: number }[] = [];
      const gain = computeGain(config.charId, nextLevel);
      if (gain > 0) {
        entries.push({ gain, from: config.charLevel, to: nextLevel });
      }
      // For level 90, also show the full 90→100 gain
      if (config.charLevel === 90 && nextLevel < 100) {
        const fullGain = computeGain(config.charId, 100);
        if (fullGain > 0) {
          entries.push({ gain: fullGain, from: config.charLevel, to: 100 });
        }
      }
      if (entries.length > 0) {
        gains[config.charId] = entries;
      }
    }

    return gains;
  }
}

// ═══════════════════════════════════════════════════════════════
// Combo Evaluation
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluate a combo formula: weighted sum of multiple formula lines,
 * potentially from different characters with different reaction overrides.
 *
 * Groups lines by on-field character and caches getTeamStats() per unique
 * calcTargetId for efficiency (typically 1-2 unique on-field characters).
 */
export function evaluateCombo(
  teamBuild: TeamBuild,
  combo: ComboFormula,
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext,
  /** Single-mode per-formula reaction overrides — used as defaults for per-part config. */
  singleModeOverrides?: Record<string, ReactionOverride>
): ComboResult {
  // Skip lines whose formula no longer exists (e.g. constellation lowered)
  const allFormulas = teamBuild.getFormulaIds();
  const validLines = combo.lines.filter((line) => {
    const charFormulas = allFormulas[line.charId];
    return charFormulas && charFormulas[line.formulaId];
  });

  // Cache stat resolution per unique on-field character
  const statsCache = new Map<string, Record<string, StatSheet>>();
  const getStats = (onFieldCharId: string) => {
    if (!statsCache.has(onFieldCharId)) {
      statsCache.set(
        onFieldCharId,
        teamBuild.getTeamStats(artifactStats, onFieldCharId, ctx)
      );
    }
    return statsCache.get(onFieldCharId)!;
  };

  const lineDamages = validLines.map((line) => {
    const teamStats = getStats(line.charId);

    // Merge: single-mode per-part config as defaults, combo line overrides on top
    let effectiveReaction = line.reaction;
    if (singleModeOverrides) {
      const key = `${line.charId}.${line.formulaId}`;
      const singleOverride = singleModeOverrides[key];
      if (singleOverride && effectiveReaction) {
        effectiveReaction = {
          ...effectiveReaction,
          // Use single-mode partReactions/partHits as defaults,
          // combo line's own values override
          partReactions: {
            ...singleOverride.partReactions,
            ...effectiveReaction.partReactions,
          },
          partHits: {
            ...singleOverride.partHits,
            ...effectiveReaction.partHits,
          },
        };
        // Clean up empty objects
        if (
          effectiveReaction.partReactions &&
          Object.keys(effectiveReaction.partReactions).length === 0
        )
          effectiveReaction.partReactions = undefined;
        if (
          effectiveReaction.partHits &&
          Object.keys(effectiveReaction.partHits).length === 0
        )
          effectiveReaction.partHits = undefined;
      } else if (singleOverride && !effectiveReaction) {
        // Combo line has no reaction override — inherit single-mode fully
        effectiveReaction = singleOverride;
      }
    }

    const result = teamBuild.getDamageResult(
      line.charId,
      line.formulaId,
      teamStats,
      ctx,
      effectiveReaction
    );
    return {
      perHit: result.totalDamage,
      total: result.totalDamage * line.count,
    };
  });

  return {
    lineDamages,
    totalDamage: lineDamages.reduce((sum, l) => sum + l.total, 0),
  };
}

/**
 * Produce a DisplayResult for combo mode — stats, marginal gains, and buffs
 * aggregated across all on-field characters in the combo.
 */
export function getComboDisplayResult(
  teamBuild: TeamBuild,
  combo: ComboFormula,
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext,
  singleModeOverrides?: Record<string, ReactionOverride>
): DisplayResult {
  // Skip lines whose formula no longer exists (e.g. constellation lowered)
  const allFormulas = teamBuild.getFormulaIds();
  const activeLines = combo.lines.filter((l) => {
    if (l.count <= 0) return false;
    const charFormulas = allFormulas[l.charId];
    return charFormulas && charFormulas[l.formulaId];
  });

  // Determine unique on-field characters and which chars have active lines
  const activeCharIds = new Set(activeLines.map((l) => l.charId));
  const allCharIds = Object.keys(teamBuild.charBuilds);

  // Pick a fallback on-field context for chars with no active lines
  const fallbackOnField = activeLines[0]?.charId ?? allCharIds[0];

  // ── Stats: compute per unique on-field context ──
  const statsCache = new Map<string, Record<string, StatSheet>>();
  const getStats = (onFieldCharId: string) => {
    if (!statsCache.has(onFieldCharId)) {
      statsCache.set(
        onFieldCharId,
        teamBuild.getTeamStats(artifactStats, onFieldCharId, ctx)
      );
    }
    return statsCache.get(onFieldCharId)!;
  };

  // For idle/combat stats, use each char's own on-field context if active, else fallback
  const idleStats: Record<string, Partial<Record<StatKey, number>>> = {};
  const combatStats: Record<string, Partial<Record<StatKey, number>>> = {};

  // Build a representative formula tag per active character (for element-filtered stats)
  const charFormulaTag: Record<string, DamageTag | undefined> = {};
  for (const cid of allCharIds) {
    if (activeCharIds.has(cid)) {
      const formulaIds = teamBuild.getFormulaIds()[cid];
      const firstFormulaId = formulaIds
        ? Object.keys(formulaIds)[0]
        : undefined;
      if (firstFormulaId) {
        const entry =
          teamBuild.charBuilds[cid]?.charBase.getFormulaEntry(firstFormulaId);
        charFormulaTag[cid] = entry?.parts[0]?.formula.tag;
      }
    }
  }

  for (const cid of allCharIds) {
    const onField = activeCharIds.has(cid) ? cid : fallbackOnField;
    const teamStats = getStats(onField);
    combatStats[cid] = teamStats[cid]!.getAll(charFormulaTag[cid]);
    idleStats[cid] = teamStats[cid]!.getAll();
  }

  // ── Collect all formula tags per character ──
  const charFormulaTags: Record<string, DamageTag[]> = {};
  for (const cid of allCharIds) {
    const tags: DamageTag[] = [];
    const seen = new Set<string>();
    const formulaIds = teamBuild.getFormulaIds()[cid];
    if (formulaIds) {
      for (const fid of Object.keys(formulaIds)) {
        const fEntry = teamBuild.charBuilds[cid]?.charBase.getFormulaEntry(fid);
        if (!fEntry) continue;
        for (const part of fEntry.parts) {
          const t = part.formula.tag;
          const key = `${t.element}|${t.ability}|${t.reaction}`;
          if (!seen.has(key)) {
            seen.add(key);
            tags.push(t);
          }
        }
      }
    }
    charFormulaTags[cid] = tags;
  }

  // ── Raw StatSheets with on/off field contexts ──
  const statSheets: Record<
    string,
    { onField: StatSheet; offField: StatSheet }
  > = {};
  for (const cid of allCharIds) {
    // On-field: stats when cid is on-field
    const onFieldStats = getStats(cid);
    const onField = onFieldStats[cid]!;

    // Off-field: stats when someone else is on-field
    const offCtx = activeCharIds.has(cid)
      ? (allCharIds.find((x) => x !== cid) ?? cid)
      : fallbackOnField;
    const offFieldStats = getStats(offCtx);
    const offField = offFieldStats[cid]!;

    statSheets[cid] = { onField, offField };
  }

  // ── Base combo damage ──
  const baseResult = evaluateCombo(
    teamBuild,
    { ...combo, lines: activeLines },
    artifactStats,
    ctx,
    singleModeOverrides
  );
  const baseDamage = baseResult.totalDamage;

  // ── Marginal gains ──
  const marginalGains: Record<string, Partial<Record<StatKey, number>>> = {};

  if (baseDamage > 0) {
    const rollableKeys = Object.keys(AVG_SUBSTAT_ROLL) as StatKey[];

    for (const cid of allCharIds) {
      // Determine relevant stat keys for this character
      const relevantKeys = new Set<StatKey>();

      if (activeCharIds.has(cid)) {
        // Carry char: include common scaling stats
        // We test all rollable keys since combo may use multiple formulas
        for (const key of rollableKeys) {
          relevantKeys.add(key);
        }
      } else {
        // Support char: check inputKeys of scaling buffs that affect any active char
        const { allStaticBuffs, teamMeta } = teamBuild;
        for (const { buff, providerCharId } of allStaticBuffs) {
          if (providerCharId !== cid) continue;
          if (buff instanceof ScalingBuff) {
            relevantKeys.add(buff.inputKey);
          }
        }
      }

      // Flat→percent substitution
      const flatToPercent: Partial<Record<StatKey, StatKey>> = {
        hp: "hp%",
        atk: "atk%",
        def: "def%",
      };
      for (const [flat, pct] of Object.entries(flatToPercent) as [
        StatKey,
        StatKey,
      ][]) {
        if (relevantKeys.has(flat)) {
          relevantKeys.delete(flat);
          relevantKeys.add(pct);
        }
      }

      const charRollable = rollableKeys.filter((k) => relevantKeys.has(k));
      if (charRollable.length === 0) continue;

      const charGains: Partial<Record<StatKey, number>> = {};
      for (const key of charRollable) {
        const delta = (AVG_SUBSTAT_ROLL as Record<string, number>)[key];
        if (!delta) continue;
        const tweaked = { ...artifactStats };
        tweaked[cid] = (artifactStats[cid] ?? new StatSheet([])).withDelta(
          key,
          delta
        );
        const newResult = evaluateCombo(
          teamBuild,
          { ...combo, lines: activeLines },
          tweaked,
          ctx,
          singleModeOverrides
        );
        const gain = (newResult.totalDamage - baseDamage) / baseDamage;
        if (gain !== 0) {
          charGains[key] = gain;
        }
      }
      if (Object.keys(charGains).length > 0) {
        marginalGains[cid] = charGains;
      }
    }
  }

  // ── Buffs: union across all on-field contexts ──
  // resolveBuffs is private, so we call getDisplayResult for each unique on-field
  // character and merge buffs. A buff is active if it's active in ANY context.
  const buffMap = new Map<string, ResolvedBuff>();

  for (const onFieldCharId of activeCharIds) {
    // Find any formula for this char to get a valid DisplayResult
    const formulaIds = teamBuild.getFormulaIds()[onFieldCharId];
    if (!formulaIds) continue;
    const firstFormulaId = Object.keys(formulaIds)[0];
    if (!firstFormulaId) continue;

    // Find the reaction override for this char+formula from single-mode overrides
    const key = `${onFieldCharId}.${firstFormulaId}`;
    const rxnOverride = singleModeOverrides?.[key];

    try {
      const dr = teamBuild.getDisplayResult(
        onFieldCharId,
        firstFormulaId,
        artifactStats,
        ctx,
        rxnOverride
      );

      for (const buff of dr.buffs) {
        const buffKey = `${buff.source.type}:${buff.source.id}:${buff.source.origin ?? ""}:${buff.providerCharId ?? ""}:${buff.target.receiver}`;
        const existing = buffMap.get(buffKey);
        if (!existing) {
          buffMap.set(buffKey, buff);
        } else if (buff.active && !existing.active) {
          // Upgrade to active
          buffMap.set(buffKey, buff);
        }
      }
    } catch (e) {
      console.warn(
        `[damageCalc] buff collection failed for ${onFieldCharId}/${firstFormulaId}:`,
        e
      );
    }
  }

  const buffs = Array.from(buffMap.values());

  // ── Level-up gains (current tier → next tier(s)) ──
  const levelUpGains: Record<
    string,
    { gain: number; from: number; to: number }[]
  > = {};
  if (baseDamage > 0) {
    const computeComboGain = (charId: string, targetLevel: number) => {
      const tweakedConfigs = teamBuild.configs.map((c) =>
        c.charId === charId ? { ...c, charLevel: targetLevel } : c
      );
      const tweakedTeam = new TeamBuild(
        tweakedConfigs,
        teamBuild.combatOpts,
        teamBuild.enemyElementAura
      );
      const newResult = evaluateCombo(
        tweakedTeam,
        { ...combo, lines: activeLines },
        artifactStats,
        ctx,
        singleModeOverrides
      );
      return (newResult.totalDamage - baseDamage) / baseDamage;
    };

    for (const config of teamBuild.configs) {
      const nextLevel = getNextLevelTier(config.charLevel);
      if (!nextLevel) continue;
      const entries: { gain: number; from: number; to: number }[] = [];
      const gain = computeComboGain(config.charId, nextLevel);
      if (gain > 0) {
        entries.push({ gain, from: config.charLevel, to: nextLevel });
      }
      // For level 90, also show the full 90→100 gain
      if (config.charLevel === 90 && nextLevel < 100) {
        const fullGain = computeComboGain(config.charId, 100);
        if (fullGain > 0) {
          entries.push({ gain: fullGain, from: config.charLevel, to: 100 });
        }
      }
      if (entries.length > 0) {
        levelUpGains[config.charId] = entries;
      }
    }
  }

  return {
    parts: [],
    totalDamage: baseDamage,
    buffs,
    statSheets,
    charFormulaTags,
    marginalGains,
    levelUpGains,
    idleStats,
    combatStats,
  };
}
