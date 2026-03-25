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

import type { OptionMap } from "./damageModels";
import { computeSubstatMarginals } from "./marginalGains";
import {
  type ComboLineContext,
  buildPartialBuffInfos,
  buildStatVariants,
  buildUserOverrideInfos,
  collectStackLimitedBuffs,
  computeBlendedDamage,
  computeComboDefaultActivation,
  computeDefaultActivation,
} from "./stackAllocation";
import type { PartialBuffInfo, StackLimitedBuffInfo } from "./stackAllocation";
import type {
  BuffActivationMap,
  BuffReceiverType,
  BuffSource,
  BuffTarget,
  CalcContext,
  ComboFormula,
  ComboLine,
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
  TeamSlotConfig,
} from "./types";
import {
  buffSourceKey,
  exclusionKey,
  filterMatchesTag,
  isFieldDependentReceiver,
  isSelfReceiver,
  resolvePartReaction,
} from "./types";

export { TeamMeta };

import type { ExtraBuff } from "./extraBuffTypes";
import { createExtraStatBuffs } from "./extraBuffTypes";
import { TeamReactionProvider } from "./teamReactions";

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

type EvaluatedDynamicBuff = {
  buff: StatBuff;
  source: BuffSource;
  providerCharId: string;
  entries: StatEntry[];
};

type ProvidedStaticBuff = {
  buff: StatBuff;
  providerCharId: string;
};

/** Precomputed context for repeated optimizer evaluations. */
export type OptimizerContext = {
  swapCharId: string;
  /** All character IDs whose artifact stats are variable (includes swapCharId). */
  variableCharIds: Set<string>;
  /** Which character is on-field. null = nobody (off-field damage context). */
  onFieldCharId: string | null;
  ctx?: CalcContext;
  targetDependent: Record<string, StatBuff[]>;
  /** Pre-computed stats for non-variable characters (artifact sheets baked in). */
  supportPreStats: Record<string, StatSheet>;
  charBuildOrder: [string, CharBuild][];
  /** Original artifact stat sheets (needed for off-field stat recomputation). */
  baseSheets: Record<string, StatSheet>;
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
  /** Phase 1 baseline: character + weapon + artifact set bonuses, BEFORE static buffs. */
  private readonly baseStatSheet: StatSheet;
  private innerStatSheet: StatSheet;

  constructor(
    config: TeamSlotConfig,
    teamMeta: TeamMeta,
    combatOpts: OptionMap = {}
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
      const el = teamMeta.elements[config.charId];
      const src: BuffSource = {
        type: "teamResonance",
        id: "gleam",
        noStackId: "nk_resonance_reaction_dmg",
        element: el,
      };
      const tgt: BuffTarget = {
        receiver: "team",
        filter: {
          reactions: ["lunarBloom", "lunarCharged", "lunarCrystallize"],
        },
      };

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
    this.baseStatSheet = this.innerStatSheet;
  }

  /** Reset innerStatSheet to the pre-applyStaticBuffs baseline.
   *  Used by the analyzer to efficiently reuse CharBuild instances across
   *  team combinations without re-constructing CharacterBase/WeaponBase. */
  resetStatSheet(): void {
    this.innerStatSheet = this.baseStatSheet;
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
   * Apply field-independent static buffs (self, other, team).
   * Called once during TeamBuild construction.
   * Field-dependent buffs (*OnField, *OffField) are deferred to getTeamStats.
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
   * Rebuild pre-stats from Phase 1 baseline, excluding buffs with matching keys.
   * Used by the exclusion-based blending system to produce stat variants.
   */
  getPreStatsExcluding(
    artifactStats: StatSheet,
    targetDependentBuffs: StatBuff[],
    allStaticBuffs: ProvidedStaticBuff[],
    excludeKeys: Set<string>,
    selfCharId: string,
    selfRegion?: Region,
    selfFaction?: Faction
  ): StatSheet {
    // Re-apply target-independent static buffs excluding the specified buff keys
    let applicable = allStaticBuffs
      .filter((b) => {
        if (excludeKeys.has(buffSourceKey(b.buff.source))) return false;
        return isBuffApplicable(
          b.buff,
          b.providerCharId,
          selfCharId,
          null,
          selfRegion,
          selfFaction
        );
      })
      .map((b) => b.buff);
    applicable = deduplicateBuffs(applicable, (b) => b.staticBuffs);
    let sheet = this.baseStatSheet.apply(applicable);

    // Merge artifact stats
    sheet = sheet.merge(artifactStats);

    // Apply target-dependent buffs (also excluding)
    if (targetDependentBuffs.length > 0) {
      const filteredTD = targetDependentBuffs.filter(
        (b) => !excludeKeys.has(buffSourceKey(b.source))
      );
      if (filteredTD.length > 0) {
        const deduped = deduplicateBuffs(filteredTD, (b) => b.staticBuffs);
        sheet = sheet.apply(deduped);
      }
    }

    return sheet;
  }

  /**
   * Apply dynamic buffs to pre-stats → post-stats.
   * Evaluates all applicable dynamic buffs.
   */
  getPostStats(
    selfPreStats: StatSheet,
    teamDynamicBuffs: EvaluatedDynamicBuff[],
    selfCharId: string,
    selfIsOnField: boolean,
    selfRegion?: Region,
    selfFaction?: Faction
  ): StatSheet {
    let applicable = teamDynamicBuffs.filter((b) =>
      isBuffApplicable(
        b.buff,
        b.providerCharId,
        selfCharId,
        selfIsOnField,
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

  /**
   * Compute idle pre-stats: baseStatSheet + artifacts + idle-eligible static buffs.
   * Bypasses innerStatSheet so only explicitly passed buffs are included.
   */
  getIdlePreStats(artifactStats: StatSheet, idleBuffs: StatBuff[]): StatSheet {
    const sheet = this.baseStatSheet.merge(artifactStats);
    if (idleBuffs.length === 0) return sheet;
    const deduped = deduplicateBuffs(idleBuffs, (b) => b.staticBuffs);
    return sheet.apply(deduped);
  }

  getFormulaIds(): Record<string, I18nLabel> {
    return this.charBase.formulaIds;
  }

  getDamageResult(
    formulaId: string,
    selfPostStats: StatSheet,
    teamPostStats: StatSheet[],
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldSelfPostStats?: StatSheet,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    offFieldVariants?: Map<string, StatSheet>
  ): DamageResult {
    return this.charBase.getDamageResult(
      formulaId,
      selfPostStats,
      teamPostStats,
      ctx,
      reactionOverride,
      offFieldSelfPostStats,
      partialBuffs,
      statsVariants,
      offFieldVariants
    );
  }

  /** Cold path: produce structured display data for a formula. */
  getDisplayParts(
    formulaId: string,
    selfPostStats: StatSheet,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldSelfPostStats?: StatSheet
  ): { parts: DisplayPart[]; totalDamage: number } {
    const entry = this.charBase.getFormulaEntry(formulaId);
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);
    const displayParts: DisplayPart[] = [];
    let totalDamage = 0;
    for (let i = 0; i < entry.parts.length; i++) {
      const {
        formula,
        hits: totalHits,
        bespokeBuff,
        offField,
      } = entry.parts[i];
      const h = totalHits ?? 1;

      // Use off-field stats when the part deals damage while the character is off-field
      const baseSelfStats =
        offField && offFieldSelfPostStats
          ? offFieldSelfPostStats
          : selfPostStats;

      // Apply per-part stat overlay if present
      const stats = bespokeBuff
        ? baseSelfStats.merge(
            StatSheet.fromEntries(
              [
                ...bespokeBuff.staticBuffs,
                ...bespokeBuff.dynamicBuffs(baseSelfStats, []),
              ],
              bespokeBuff.target.filter
            )
          )
        : baseSelfStats;

      const hasReaction =
        reactionOverride?.reaction && reactionOverride.reaction !== "none";

      // Skip reaction override if the formula already has a built-in reaction
      // (e.g., LunarDirectFormula with lunarBloom should not be converted to CatalyzeFormula)
      if (!hasReaction || formula.tag.reaction !== "none") {
        const dp = formula.displayFull(stats, this.charBase.charLevel, ctx);
        dp.hits = h;
        if (offField) dp.offField = true;
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
        const dp = effectiveFormula.displayFull(
          stats,
          this.charBase.charLevel,
          ctx
        );
        dp.hits = reactingHits;
        if (offField) dp.offField = true;
        totalDamage += dp.damage * reactingHits;
        displayParts.push(dp);
      }
      if (nonReactingHits > 0) {
        const dp = formula.displayFull(stats, this.charBase.charLevel, ctx);
        dp.hits = nonReactingHits;
        if (offField) dp.offField = true;
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
  selfIsOnField: boolean | null
) => boolean;

const RECEIVER_RULES: Record<BuffReceiverType, ReceiverRule> = {
  // Field-independent
  self: (owner, self) => owner === self,
  other: (owner, self) => owner !== self,
  team: () => true,
  // Field-dependent
  selfOnField: (owner, self, onField) =>
    onField !== null && owner === self && onField,
  selfOffField: (owner, self, onField) =>
    onField !== null && owner === self && !onField,
  otherOnField: (owner, self, onField) =>
    onField !== null && owner !== self && onField,
  otherOffField: (owner, self, onField) =>
    onField !== null && owner !== self && !onField,
  teamOnField: (_, __, onField) => onField !== null && onField,
  teamOffField: (_, __, onField) => onField !== null && !onField,
};

/**
 * Determine whether a buff applies to a given character's stat sheet.
 *
 * @param buff          The buff to check
 * @param providerCharId The character that provides the buff
 * @param selfCharId    The character whose stat sheet we're building
 * @param selfIsOnField Whether selfCharId is on-field for this damage context.
 *                      null = field-independent filtering only (construction phase).
 * @param selfRegion    Region of the target character (for region-scoped buffs).
 * @param selfFaction   Faction of the target character (for faction-scoped buffs).
 */
export function isBuffApplicable(
  buff: StatBuff,
  providerCharId: string,
  selfCharId: string,
  selfIsOnField: boolean | null,
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

  return RECEIVER_RULES[buff.target.receiver](
    providerCharId,
    selfCharId,
    selfIsOnField
  );
}

// ═══════════════════════════════════════════════════════════════
// TeamBuild
// ═══════════════════════════════════════════════════════════════

/**
 * Orchestrates the full team's damage calculation.
 * Owns the stat resolution pipeline across all 4 team members.
 *
 * Construction is immutable (team composition + OptionMap).
 * `getTeamStats(artifactStats, onFieldCharId)` is the hot path.
 */
export class TeamBuild {
  readonly charBuilds: Record<string, CharBuild>;
  readonly teamMeta: TeamMeta;
  readonly teamResonance: TeamResonance;
  readonly allStaticBuffs: ProvidedStaticBuff[];
  /** Team-wide reaction formula provider (transformative + lunar). */
  readonly reactionProvider: TeamReactionProvider;
  /** Original configs used to construct this TeamBuild (for reconstruction). */
  readonly configs: TeamSlotConfig[];
  /** Original combat opts used to construct this TeamBuild (for reconstruction). */
  readonly combatOpts: OptionMap;
  /** Enemy persistent element aura (for reconstruction). */
  readonly enemyAura?: Element;
  /** Extra buffs (food/env/status/custom) applied to stat sheets. */
  readonly extraBuffs: ExtraBuff[];

  constructor(
    configs: TeamSlotConfig[],
    combatOpts: OptionMap = {},
    enemyAura?: Element,
    extraBuffs: ExtraBuff[] = [],
    /**
     * Optional pre-built CharBuilds keyed by charId. When provided, their stat
     * sheets are reset and reused instead of constructing new CharacterBase /
     * WeaponBase / ArtifactSetBase instances. The caller must guarantee that
     * each cached build was created with a TeamMeta whose self-constellation,
     * weapon, artifact set, and combat options match the corresponding config.
     * (Other characters' constellations in the original TeamMeta are irrelevant
     * because no implementation checks cross-character constellation/refinement.)
     */
    cachedCharBuilds?: Record<string, CharBuild>
  ) {
    this.configs = configs;
    this.combatOpts = combatOpts;
    this.enemyAura = enemyAura;
    this.extraBuffs = extraBuffs;
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
      enemyAura
    );
    this.teamResonance = new TeamResonance(this.teamMeta);

    // Create or reuse CharBuilds
    this.charBuilds = {};
    if (cachedCharBuilds) {
      for (const config of configs) {
        const cached = cachedCharBuilds[config.charId];
        if (cached) {
          cached.resetStatSheet();
          this.charBuilds[config.charId] = cached;
        } else {
          this.charBuilds[config.charId] = new CharBuild(
            config,
            this.teamMeta,
            combatOpts
          );
        }
      }
    } else {
      for (const config of configs) {
        this.charBuilds[config.charId] = new CharBuild(
          config,
          this.teamMeta,
          combatOpts
        );
      }
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

    // Add extra buffs (food/env/status/custom) as first-class StatBuffs
    if (extraBuffs.length > 0) {
      for (const buff of createExtraStatBuffs(extraBuffs)) {
        this.allStaticBuffs.push({ buff, providerCharId: "extra" });
      }
    }

    // Apply field-independent static buffs (self, other, team) at construction.
    // Field-dependent buffs (*OnField, *OffField) are deferred to getTeamStats.
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      build.applyStaticBuffs(
        this.allStaticBuffs,
        charId,
        this.teamMeta.regions[charId],
        this.teamMeta.factions[charId]
      );
    }

    // Build team-wide reaction formulas after CharBuilds are constructed
    const charBases: Record<string, CharacterBase> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      charBases[id] = build.charBase;
    }
    this.reactionProvider = new TeamReactionProvider(
      this.teamMeta,
      charBases,
      configs
    );
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
      if (providerCharId === "resonance" || providerCharId === "extra")
        continue;
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

  // ─── Centralized buff applicability helpers ──────────────────────────────

  /** isBuffApplicable with automatic teamMeta region/faction lookup. */
  private isBuffApplicableForChar(
    buff: StatBuff,
    providerCharId: string,
    selfCharId: string,
    selfIsOnField: boolean | null
  ): boolean {
    return isBuffApplicable(
      buff,
      providerCharId,
      selfCharId,
      selfIsOnField,
      this.teamMeta.regions[selfCharId],
      this.teamMeta.factions[selfCharId]
    );
  }

  /**
   * Collect field-dependent static buffs for each character, given a onFieldCharId
   * that determines field state (charId === onFieldCharId → on-field).
   */
  private getFieldDependentBuffs(
    onFieldCharId: string | null
  ): Record<string, StatBuff[]> {
    const result: Record<string, StatBuff[]> = {};
    for (const charId of Object.keys(this.charBuilds)) {
      result[charId] = this.allStaticBuffs
        .filter((b) => {
          if (!isFieldDependentReceiver(b.buff.target.receiver)) return false;
          return this.isBuffApplicableForChar(
            b.buff,
            b.providerCharId,
            charId,
            charId === onFieldCharId
          );
        })
        .map((b) => b.buff);
    }
    return result;
  }

  /**
   * Build post-stats for all team members: apply dynamic buffs + critRateTarget.
   * Extracts the repeated phase-4/5 pattern from getTeamStats and variants.
   */
  private buildTeamPostStats(
    preStats: Record<string, StatSheet>,
    dynamicBuffs: EvaluatedDynamicBuff[],
    onFieldCharId: string | null,
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    const postStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      postStats[id] = build.getPostStats(
        preStats[id]!,
        dynamicBuffs,
        id,
        id === onFieldCharId,
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }
    if (ctx?.critRateTarget != null) {
      const crDelta = (100 - ctx.critRateTarget) / 100;
      for (const id of Object.keys(postStats)) {
        postStats[id] = postStats[id]!.withDelta("cr", crDelta);
      }
    }
    return postStats;
  }

  // ─── Idle stat computation (cold path) ─────────────────────────────────

  /**
   * Compute idle stat sheets for all team members (cold path, display only).
   *
   * Idle stats simulate the game's character-panel view:
   * - Base stats (character + weapon + artifact-set 2pc bonuses)
   * - Artifact main/sub stats
   * - Unconditional buffs only (no triggers, no ability/reaction filters)
   * - Dynamic (scaling) buffs evaluated from idle pre-stats
   *
   * The caller should use `StatSheet.getIdleRecord()` on each result to
   * denormalize dmg% back to per-element keys for display.
   */
  computeIdleStatSheets(
    artifactStats: Record<string, StatSheet>
  ): Record<string, { onField: StatSheet; offField: StatSheet }> {
    // Filter to idle-eligible buffs: no triggers, no ability/reaction filters.
    // Element-only filters are allowed through — getIdleRecord() handles them:
    // dmg% with element filter → denormalized to per-element keys (pyro%, etc.),
    // all other stats with element filter → invisible (read via unfiltered get).
    const idleBuffs = this.allStaticBuffs.filter(({ buff }) => {
      if (buff.source.triggers && buff.source.triggers.length > 0) return false;
      const filter = buff.target.filter;
      if (filter?.abilities || filter?.reactions) return false;
      return true;
    });

    // Compute idle sheets for a given field state
    const computeForField = (onField: boolean): Record<string, StatSheet> => {
      // Phase 1: idle pre-stats per character
      const idlePreStats: Record<string, StatSheet> = {};
      for (const [charId, build] of Object.entries(this.charBuilds)) {
        const applicable = idleBuffs
          .filter(({ buff, providerCharId }) =>
            isBuffApplicable(
              buff,
              providerCharId,
              charId,
              onField,
              this.teamMeta.regions[charId],
              this.teamMeta.factions[charId]
            )
          )
          .map((b) => b.buff);
        idlePreStats[charId] = build.getIdlePreStats(
          artifactStats[charId] ?? new StatSheet([]),
          applicable
        );
      }

      // Phase 2: evaluate dynamic buffs from idle-eligible providers
      const teamPreStatsArr = Object.values(idlePreStats);
      const dynamicEntries: EvaluatedDynamicBuff[] = [];
      for (const { buff, providerCharId } of idleBuffs) {
        if (providerCharId === "resonance" || providerCharId === "extra")
          continue;
        const ownerStats = idlePreStats[providerCharId];
        if (!ownerStats) continue;
        const entries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
        if (entries.length > 0) {
          dynamicEntries.push({
            buff,
            source: buff.source,
            providerCharId,
            entries,
          });
        }
      }

      // Phase 3: apply dynamic buffs → idle post-stats
      const result: Record<string, StatSheet> = {};
      for (const [charId, build] of Object.entries(this.charBuilds)) {
        result[charId] = build.getPostStats(
          idlePreStats[charId]!,
          dynamicEntries,
          charId,
          onField,
          this.teamMeta.regions[charId],
          this.teamMeta.factions[charId]
        );
      }
      return result;
    };

    const onFieldSheets = computeForField(true);
    const offFieldSheets = computeForField(false);

    const result: Record<string, { onField: StatSheet; offField: StatSheet }> =
      {};
    for (const charId of Object.keys(this.charBuilds)) {
      result[charId] = {
        onField: onFieldSheets[charId],
        offField: offFieldSheets[charId],
      };
    }
    return result;
  }

  // ─── Team stat computation ──────────────────────────────────────────────

  /**
   * Compute final stat sheets for all team members.
   * This is the hot path during artifact optimization.
   *
   * @param artifactStats  Per-character artifact stat sheets
   * @param onFieldCharId   Who is on-field (determines onField buff routing). null = nobody.
   */
  getTeamStats(
    artifactStats: Record<string, StatSheet>,
    onFieldCharId: string | null,
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    const fieldDependent = this.getFieldDependentBuffs(onFieldCharId);
    const preStats = this.buildPreStatsFromBuilds(
      artifactStats,
      fieldDependent
    );

    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(preStats, teamPreStatsArr);

    return this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      onFieldCharId,
      ctx
    );
  }

  /**
   * Compute final stat sheets excluding the specified buffs.
   * Rebuilds from Phase 1 baseline for each character, skipping excluded buffs
   * in both the static and dynamic buff application phases.
   */
  getTeamStatsExcluding(
    artifactStats: Record<string, StatSheet>,
    onFieldCharId: string | null,
    ctx: CalcContext | undefined,
    excludeKeys: Set<string>
  ): Record<string, StatSheet> {
    const fieldDependent = this.getFieldDependentBuffs(onFieldCharId);

    // Phase 2: Pre-stats (rebuilt from baseStatSheet excluding specified buffs)
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      preStats[id] = build.getPreStatsExcluding(
        artifactStats[id] ?? new StatSheet([]),
        fieldDependent[id]!,
        this.allStaticBuffs,
        excludeKeys,
        id,
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }

    // Phase 3: Collect dynamic buffs, excluding specified buff keys
    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffsExcluding(
      preStats,
      teamPreStatsArr,
      excludeKeys
    );

    // Phase 4+5: Apply dynamic buffs → post-stats + critRateTarget
    return this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      onFieldCharId,
      ctx
    );
  }

  /** Like collectDynamicBuffs but skips buffs with matching source keys. */
  private collectDynamicBuffsExcluding(
    preStats: Record<string, StatSheet>,
    teamPreStatsArr: StatSheet[],
    excludeKeys: Set<string>
  ): EvaluatedDynamicBuff[] {
    const results: EvaluatedDynamicBuff[] = [];
    for (const { buff, providerCharId } of this.allStaticBuffs) {
      if (providerCharId === "resonance" || providerCharId === "extra")
        continue;
      if (excludeKeys.has(buffSourceKey(buff.source))) continue;
      const ownerStats = preStats[providerCharId]!;
      const entries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
      if (entries.length > 0) {
        results.push({ buff, source: buff.source, providerCharId, entries });
      }
    }
    return results;
  }

  /**
   * Create a reusable context for repeated getTeamStats calls where only one
   * character's artifact sheet changes.  Caches target-dependent buff filtering
   * and support characters' preStats so the hot loop only recomputes the
   * swapped character's preStats.
   */
  createOptimizerContext(
    baseSheets: Record<string, StatSheet>,
    swapCharId: string | string[],
    onFieldCharId: string | null,
    ctx?: CalcContext
  ): OptimizerContext {
    const variableCharIds = Array.isArray(swapCharId)
      ? new Set(swapCharId)
      : new Set([swapCharId]);
    const primarySwapCharId = Array.isArray(swapCharId)
      ? swapCharId[0]
      : swapCharId;

    // Field-dependent buff filtering (constant for a given onFieldCharId)
    const targetDependent = this.getFieldDependentBuffs(onFieldCharId);

    // Support preStats: only for non-variable characters (their artifact sheets are baked in)
    const supportPreStats: Record<string, StatSheet> = {};
    // charBuildOrder preserves Object.entries iteration order for FP parity
    const charBuildOrder = Object.entries(this.charBuilds);
    for (const [id, build] of charBuildOrder) {
      if (!variableCharIds.has(id)) {
        supportPreStats[id] = build.getPreStats(
          baseSheets[id] ?? new StatSheet([]),
          targetDependent[id]!
        );
      }
    }

    return {
      swapCharId: primarySwapCharId,
      variableCharIds,
      onFieldCharId,
      ctx,
      targetDependent,
      supportPreStats,
      charBuildOrder,
      baseSheets,
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
      onFieldCharId,
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

    // Post-stats + critRateTarget
    return this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      onFieldCharId,
      ctx
    );
  }

  /**
   * Pick any other team member's charId. Used to derive off-field stats
  /**
   * Build preStats for all team members from artifact sheets + field-dependent buffs.
   * Extracts the Phase 2 loop that appears in getTeamStats, getDisplayResult, etc.
   */
  private buildPreStatsFromBuilds(
    artifactStats: Record<string, StatSheet>,
    fieldDependent: Record<string, StatBuff[]>
  ): Record<string, StatSheet> {
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      preStats[id] = build.getPreStats(
        artifactStats[id] ?? new StatSheet([]),
        fieldDependent[id]!
      );
    }
    return preStats;
  }

  /**
   * Build sans-buff stat maps for stack-limited greedy allocation.
   * For each stack-limited buff, computes team stats with that buff excluded.
   * Returns { onField, offField? } maps keyed by buff source key.
   */
  private buildSansBuffStats(
    stackLimited: ReturnType<typeof collectStackLimitedBuffs>,
    charId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext | undefined,
    offFieldPostStats?: StatSheet
  ): {
    sansBuffStats: Map<string, StatSheet>;
    offFieldSansBuffStats?: Map<string, StatSheet>;
  } {
    const sansBuffStats = new Map<string, StatSheet>();
    for (const buffInfo of stackLimited) {
      const bKey = buffSourceKey(buffInfo.source);
      const excluded = this.getTeamStatsExcluding(
        artifactStats,
        charId,
        ctx,
        new Set([bKey])
      );
      sansBuffStats.set(bKey, excluded[charId]!);
    }
    let offFieldSansBuffStats: Map<string, StatSheet> | undefined;
    if (offFieldPostStats) {
      offFieldSansBuffStats = new Map();
      for (const buffInfo of stackLimited) {
        const bKey = buffSourceKey(buffInfo.source);
        const excluded = this.getTeamStatsExcluding(
          artifactStats,
          null,
          ctx,
          new Set([bKey])
        );
        offFieldSansBuffStats.set(bKey, excluded[charId]!);
      }
    }
    return { sansBuffStats, offFieldSansBuffStats };
  }

  /**
   * Merge user buff overrides on top of a base activation map (mutates target).
   */
  private static mergeActivationOverrides(
    target: BuffActivationMap,
    overrides: BuffActivationMap
  ): void {
    for (const [bKey, partMap] of Object.entries(overrides)) {
      if (!target[bKey]) target[bKey] = {};
      for (const [pidx, hits] of Object.entries(partMap)) {
        target[bKey][Number(pidx)] = hits;
      }
    }
  }

  /**
   * Create a cached getStats function for repeated team stat lookups
   * keyed by on-field character ID. Reuses computations across calls.
   */
  private createStatsCacheFn(
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    seed?: Map<string | null, Record<string, StatSheet>>
  ): (onFieldCharId: string | null) => Record<string, StatSheet> {
    const cache = seed ?? new Map<string | null, Record<string, StatSheet>>();
    return (onFieldCharId: string | null) => {
      if (!cache.has(onFieldCharId)) {
        cache.set(
          onFieldCharId,
          this.getTeamStats(artifactStats, onFieldCharId, ctx)
        );
      }
      return cache.get(onFieldCharId)!;
    };
  }

  /**
   * Compute off-field post-stats for a character's formula.
   * Uses onFieldCharId=null so nobody is on-field (correct for off-field damage).
   */
  private getOffFieldPostStats(
    charId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    getStats?: (onFieldCharId: string | null) => Record<string, StatSheet>
  ): StatSheet | undefined {
    if (getStats) return getStats(null)[charId];
    return this.getTeamStats(artifactStats, null, ctx)[charId];
  }

  /** All available formulas across all characters */
  getFormulaIds(): Record<string, Record<string, I18nLabel>> {
    const result: Record<string, Record<string, I18nLabel>> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getFormulaIds();
    }
    return result;
  }

  /** Team-wide reaction formula IDs with labels. */
  getReactionFormulaIds(): Record<string, I18nLabel> {
    return this.reactionProvider.getFormulaIds();
  }

  /** Default combo counts for a character (from CharacterBase.combo). */
  getCombo(charId: string): Record<string, number> {
    return this.charBuilds[charId]?.charBase.combo ?? {};
  }

  /** Evaluate a specific character's damage formula with the given team stats */
  getDamageResult(
    charId: string,
    formulaId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldTeamStats?: Record<string, StatSheet>,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    offFieldVariants?: Map<string, StatSheet>
  ): DamageResult {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);
    const teamStatsArr = Object.values(teamStats);
    return build.getDamageResult(
      formulaId,
      teamStats[charId]!,
      teamStatsArr,
      ctx,
      reactionOverride,
      offFieldTeamStats?.[charId],
      partialBuffs,
      statsVariants,
      offFieldVariants
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
    reactionOverride?: ReactionOverride,
    userBuffOverrides?: BuffActivationMap
  ): DisplayResult {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);

    // ── Stat resolution (mirrors getTeamStats but captures intermediate phases) ──
    const fieldDependent = this.getFieldDependentBuffs(charId);
    const preStats = this.buildPreStatsFromBuilds(
      artifactStats,
      fieldDependent
    );

    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(preStats, teamPreStatsArr);

    const postStats = this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      charId,
      ctx
    );

    // ── Formula display ──
    const entry = build.charBase.getFormulaEntry(formulaId);
    const partTags: (DamageTag | undefined)[] =
      entry?.parts.map((p) => p.formula.tag) ?? [];
    const formulaTags: DamageTag[] = partTags.filter(
      (t): t is DamageTag => t !== undefined
    );

    // Compute off-field stats for display if the formula has off-field parts
    const formulaHasOffField = entry?.parts.some((p) => p.offField) ?? false;
    const offFieldPostStats = formulaHasOffField
      ? this.getOffFieldPostStats(charId, artifactStats, ctx)
      : undefined;

    let { parts, totalDamage } = build.getDisplayParts(
      formulaId,
      postStats[charId]!,
      ctx,
      reactionOverride,
      offFieldPostStats
    );
    // Pre-blending damage: consistent baseline for marginal/level-up gain
    // comparisons (getDamageResult without partial buffs returns this value).
    const fullBuffDamage = totalDamage;

    // ── Stack allocation + buff activation ──
    const stackLimited = collectStackLimitedBuffs(
      this.allStaticBuffs,
      preStats,
      teamPreStatsArr
    );
    let buffActivation: BuffActivationMap | undefined;

    if (entry) {
      // 1. Pre-build sans-buff stats for greedy allocation
      let sansBuffStats: Map<string, StatSheet> | undefined;
      let offFieldSansBuffStats: Map<string, StatSheet> | undefined;
      if (stackLimited.length > 0) {
        const sans = this.buildSansBuffStats(
          stackLimited,
          charId,
          artifactStats,
          ctx,
          offFieldPostStats
        );
        sansBuffStats = sans.sansBuffStats;
        offFieldSansBuffStats = sans.offFieldSansBuffStats;
      }

      // 2. Greedy allocation for stack-limited buffs
      let mergedActivation: BuffActivationMap = {};
      if (stackLimited.length > 0) {
        const defaultActivation = computeDefaultActivation(
          entry.parts,
          stackLimited,
          postStats[charId]!,
          build.charBase.charLevel,
          ctx,
          reactionOverride,
          offFieldPostStats,
          sansBuffStats,
          offFieldSansBuffStats
        );
        mergedActivation = { ...defaultActivation };
      }

      // 3. Merge user overrides on top
      if (userBuffOverrides) {
        TeamBuild.mergeActivationOverrides(mergedActivation, userBuffOverrides);
      }

      // 4. Build PartialBuffInfo[] from both stack-limited and user-overridden buffs
      const stackInfos =
        stackLimited.length > 0
          ? buildPartialBuffInfos(mergedActivation, stackLimited, entry.parts)
          : [];
      const userInfos = userBuffOverrides
        ? buildUserOverrideInfos(
            userBuffOverrides,
            this.allStaticBuffs,
            entry.parts,
            (buff, providerId) =>
              this.isBuffApplicableForChar(buff, providerId, charId, true)
          )
        : [];
      const allInfos = [...stackInfos, ...userInfos];

      if (allInfos.length > 0) {
        buffActivation = mergedActivation;

        // 5. Pre-build stat variants for all exclusion combinations
        const statsVariants = buildStatVariants(
          allInfos,
          entry.parts,
          (excludeSet) =>
            this.getTeamStatsExcluding(artifactStats, charId, ctx, excludeSet)[
              charId
            ]!
        );
        let offFieldVariantsMap: Map<string, StatSheet> | undefined;
        if (offFieldPostStats) {
          offFieldVariantsMap = buildStatVariants(
            allInfos,
            entry.parts,
            (excludeSet) =>
              this.getTeamStatsExcluding(artifactStats, null, ctx, excludeSet)[
                charId
              ]!
          );
        }

        const blended = computeBlendedDamage(
          entry.parts,
          allInfos,
          postStats[charId]!,
          statsVariants,
          build.charBase.charLevel,
          ctx,
          offFieldPostStats,
          offFieldVariantsMap
        );
        totalDamage = blended.totalDamage;
        // Rebuild display parts with 1st-hit stats: exclude only buffs
        // with 0 activation (never applied), keep blended average damage.
        for (let i = 0; i < parts.length; i++) {
          if (!blended.partDamages[i]) continue;

          // Collect buffs with 0 activation on this part (never applied)
          const zeroBuffKeys = new Set<string>();
          if (i < entry.parts.length) {
            const h = entry.parts[i].hits ?? 1;
            for (const info of allInfos) {
              if ((info.partActivation[i] ?? h) === 0) {
                zeroBuffKeys.add(info.buffKey);
              }
            }
          }

          if (zeroBuffKeys.size > 0 && i < entry.parts.length) {
            const { formula, offField, bespokeBuff } = entry.parts[i];
            const eKey = exclusionKey(zeroBuffKeys);
            const baseVariant =
              offField && offFieldVariantsMap
                ? (offFieldVariantsMap.get(eKey) ?? offFieldPostStats!)
                : (statsVariants.get(eKey) ?? postStats[charId]!);
            const displayStats = bespokeBuff
              ? baseVariant.merge(
                  StatSheet.fromEntries(
                    [
                      ...bespokeBuff.staticBuffs,
                      ...bespokeBuff.dynamicBuffs(baseVariant, []),
                    ],
                    bespokeBuff.target.filter
                  )
                )
              : baseVariant;
            const rebuilt = formula.displayFull(
              displayStats,
              build.charBase.charLevel,
              ctx
            );
            parts[i] = {
              ...rebuilt,
              hits: parts[i].hits,
              offField: parts[i].offField,
              damage: blended.partDamages[i].damage,
              sourcePartIndex: i,
            };
          } else {
            parts[i] = {
              ...parts[i],
              damage: blended.partDamages[i].damage,
              sourcePartIndex: i,
            };
          }
        }
        // Add partialBuffs annotations from merged activation
        for (const [bKey, partMap] of Object.entries(mergedActivation)) {
          for (const [pidxStr, activated] of Object.entries(partMap)) {
            const pidx = Number(pidxStr);
            if (pidx >= parts.length) continue;
            const h = entry.parts[pidx]?.hits ?? 1;
            if (activated < h) {
              if (!parts[pidx].partialBuffs) parts[pidx].partialBuffs = [];
              parts[pidx].partialBuffs!.push({
                buffKey: bKey,
                activatedHits: activated,
                totalHits: h,
              });
              if (parts[pidx].sourcePartIndex === undefined)
                parts[pidx].sourcePartIndex = pidx;
            }
          }
        }
      } else if (Object.keys(mergedActivation).length > 0) {
        buffActivation = mergedActivation;
      }
    }

    // ── Buff resolution ──
    const partReadKeys = parts.map((p) => p.readKeys);
    const partOffField = entry?.parts.map((p) => p.offField ?? false) ?? [];
    const buffs = this.resolveBuffs(
      charId,
      preStats,
      teamPreStatsArr,
      partTags,
      partReadKeys,
      partOffField,
      formulaId
    );

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
    const seedCache = new Map<string | null, Record<string, StatSheet>>();
    seedCache.set(charId, postStats); // reuse existing computation
    const getStats = this.createStatsCacheFn(artifactStats, ctx, seedCache);

    const statSheets: Record<
      string,
      { onField: StatSheet; offField: StatSheet }
    > = {};
    for (const cid of Object.keys(this.charBuilds)) {
      const onField = getStats(cid)[cid]!;
      const offField = getStats(null)[cid]!;
      statSheets[cid] = { onField, offField };
    }

    // ── Marginal gains ──
    const marginalGains = this.computeMarginalGainsUnified(
      charId,
      formulaId,
      artifactStats,
      ctx,
      fullBuffDamage,
      reactionOverride,
      formulaHasOffField
    );

    // ── Level-up gains (Lv90 → Lv100) ──
    const levelUpGains = this.computeLevelUpGains(
      charId,
      formulaId,
      artifactStats,
      ctx,
      fullBuffDamage,
      reactionOverride,
      formulaHasOffField
    );

    // ── Intrinsic saturation detection ──
    const intrinsicSaturatedCharIds: string[] = [];
    {
      const allCharIds = Object.keys(this.charBuilds);
      const zeroGainCharIds = allCharIds.filter(
        (cid) =>
          !marginalGains[cid] || Object.keys(marginalGains[cid]).length === 0
      );
      if (zeroGainCharIds.length > 0 && fullBuffDamage > 0) {
        const emptySheets = { ...artifactStats };
        for (const cid of zeroGainCharIds) {
          emptySheets[cid] = new StatSheet([]);
        }
        const emptyGains = this.computeMarginalGainsUnified(
          charId,
          formulaId,
          emptySheets,
          ctx,
          fullBuffDamage,
          reactionOverride,
          formulaHasOffField
        );
        for (const cid of zeroGainCharIds) {
          if (!emptyGains[cid] || Object.keys(emptyGains[cid]).length === 0) {
            intrinsicSaturatedCharIds.push(cid);
          }
        }
      }
    }

    // ── Idle stat records (cold path) ──
    const idleSheets = this.computeIdleStatSheets(artifactStats);
    const idleStatRecords: DisplayResult["idleStatRecords"] = {};
    for (const [cid, { onField, offField }] of Object.entries(idleSheets)) {
      idleStatRecords[cid] = {
        onField: onField.getIdleRecord(),
        offField: offField.getIdleRecord(),
      };
    }

    return {
      partsByFormula: { [`${charId}.${formulaId}`]: parts },
      totalDamage,
      buffs,
      buffActivation,
      statSheets,
      charFormulaTags,
      marginalGains,
      levelUpGains,
      idleStatRecords,
      intrinsicSaturatedCharIds,
    };
  }

  /** Resolve all buffs into active/inactive ResolvedBuff[] for display. */
  private resolveBuffs(
    onFieldCharId: string | null,
    preStats: Record<string, StatSheet>,
    teamPreStatsArr: StatSheet[],
    partTags: (DamageTag | undefined)[],
    partReadKeys: (ReadonlySet<StatKey> | undefined)[],
    partOffField: boolean[],
    formulaId?: string
  ): ResolvedBuff[] {
    const result: ResolvedBuff[] = [];

    // Use allStaticBuffs (populated once at construction) as the single source
    // of buff objects. This avoids reference-identity mismatches caused by
    // weapon/artifact getters that create new StatBuff instances each call.

    // Exclude resonance and extra entries — they are handled separately below.
    const charBuffEntries = this.allStaticBuffs.filter(
      (b) => b.providerCharId !== "resonance" && b.providerCharId !== "extra"
    );

    // ── Active static set ──
    // For self* receivers, check against the provider; otherwise against onFieldCharId.
    let applicableStatic = charBuffEntries
      .filter((b) => {
        const selfId = isSelfReceiver(b.buff.target.receiver)
          ? b.providerCharId
          : onFieldCharId;
        if (selfId == null) return false;
        return this.isBuffApplicableForChar(
          b.buff,
          b.providerCharId,
          selfId,
          onFieldCharId != null && selfId === onFieldCharId
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
      const selfId = isSelfReceiver(b.buff.target.receiver)
        ? b.providerCharId
        : onFieldCharId;
      if (selfId == null) return false;
      return this.isBuffApplicableForChar(
        b.buff,
        b.providerCharId,
        selfId,
        onFieldCharId != null && selfId === onFieldCharId
      );
    });
    applicableDynamic = deduplicateBuffs(applicableDynamic, (b) => b.entries);
    const activeDynamicSet = new Set<StatBuff>(
      applicableDynamic.map((e) => e.buff)
    );

    // ── Scaling bridge: inputKey → outputKeys reaching calcTarget ──
    // Enables indirect relevance: a buff giving +ER% is relevant if a scaling
    // buff reads ER and outputs something the formula reads (e.g. ER → DMG%).
    // Keyed by (providerCharId, inputKey) — where providerCharId is the scaling
    // buff's owner who reads inputKey from their own stats.
    // Scaled stat implicit deps: atk% and baseAtk both feed into atk
    const SCALED_DEPS: Record<string, string[]> = {
      atk: ["atk%", "baseAtk"],
      hp: ["hp%", "baseHp"],
      def: ["def%", "baseDef"],
    };

    const scalingBridge = new Map<string, Set<StatKey>>();
    for (const { buff, providerCharId } of charBuffEntries) {
      if (!(buff instanceof ScalingBuff)) continue;
      // Only care about scaling buffs whose output reaches the calc target
      if (
        onFieldCharId == null ||
        !this.isBuffApplicableForChar(buff, providerCharId, onFieldCharId, true)
      )
        continue;
      if (!activeDynamicSet.has(buff)) continue;

      // Register the bridge for the inputKey and all its implicit dependencies
      const inputKeys = [buff.inputKey, ...(SCALED_DEPS[buff.inputKey] ?? [])];
      for (const iKey of inputKeys) {
        const bridgeKey = `${providerCharId}\0${iKey}`;
        let outputs = scalingBridge.get(bridgeKey);
        if (!outputs) {
          outputs = new Set();
          scalingBridge.set(bridgeKey, outputs);
        }
        outputs.add(buff.outputKey);
      }
    }

    // ── Display loop ──
    // Iterate charBuffEntries (not cb.getAllBuffs()) so Set.has() matches.
    for (const { buff, providerCharId: ownerId } of charBuffEntries) {
      const selfId = isSelfReceiver(buff.target.receiver)
        ? ownerId
        : onFieldCharId;
      const applicable =
        selfId != null &&
        this.isBuffApplicableForChar(
          buff,
          ownerId,
          selfId,
          selfId === onFieldCharId
        );

      // Resolve dynamic entries with per-entry caps
      let dynamicEntries: ResolvedStatEntry[] = [];
      let active = false;
      let activePartIndices: number[] | undefined;

      const ownerStats = preStats[ownerId]!;
      const raw = buff.dynamicBuffs(ownerStats, teamPreStatsArr);

      if (applicable) {
        if (raw.length > 0) {
          active = activeDynamicSet.has(buff);
        } else {
          active = activeStaticSet.has(buff);
        }
        if (active && partTags.length > 0) {
          // Collect the buff's output stat keys
          const rawOutputKeys = new Set<StatKey>();
          for (const e of buff.staticBuffs) rawOutputKeys.add(e.key);
          for (const e of raw) rawOutputKeys.add(e.key);

          // Determine the effective output keys that reach the damage formula.
          // A buff can reach the formula in two ways:
          // 1. Direct: outputs land on the calc target's stat sheet
          // 2. Indirect: outputs land on a teammate's sheet and feed a scaling
          //    buff whose output reaches the calc target
          const effectiveKeys = new Set<StatKey>();

          // Check if this buff directly affects the calc target's stat sheet
          const reachesCalcTarget =
            onFieldCharId != null &&
            this.isBuffApplicableForChar(buff, ownerId, onFieldCharId, true);
          if (reachesCalcTarget) {
            for (const k of rawOutputKeys) effectiveKeys.add(k);
          }

          // Check indirect path via scaling bridge for all characters
          // the buff applies to (including calc target — their stats may
          // also feed their own scaling buffs)
          for (const cid of Object.keys(this.charBuilds)) {
            const buffApplies = this.isBuffApplicableForChar(
              buff,
              ownerId,
              cid,
              cid === onFieldCharId
            );
            if (!buffApplies) continue;
            for (const outKey of rawOutputKeys) {
              const bridged = scalingBridge.get(`${cid}\0${outKey}`);
              if (bridged) for (const k of bridged) effectiveKeys.add(k);
            }
          }

          activePartIndices = [];
          // If no effective keys reach the formula at all, buff is irrelevant
          if (effectiveKeys.size > 0) {
            const receiver = buff.target.receiver;
            const isOnFieldBuff =
              receiver === "selfOnField" ||
              receiver === "teamOnField" ||
              receiver === "otherOnField";
            const isOffFieldBuff =
              receiver === "selfOffField" ||
              receiver === "teamOffField" ||
              receiver === "otherOffField";
            for (let pi = 0; pi < partTags.length; pi++) {
              // Layer 2.5: Field-context filter — onField buffs don't apply to
              // off-field parts, offField buffs don't apply to on-field parts
              if (isOnFieldBuff && partOffField[pi]) continue;
              if (isOffFieldBuff && !partOffField[pi]) continue;
              const tag = partTags[pi];
              // Layer 3: DamageTagFilter
              if (tag && buff.target.filter) {
                if (!filterMatchesTag(buff.target.filter!, tag)) continue;
              }
              // Layer 4: Stat relevance
              const rk = partReadKeys[pi];
              if (rk) {
                let relevant = false;
                for (const k of effectiveKeys) {
                  if (rk.has(k)) {
                    relevant = true;
                    break;
                  }
                }
                if (!relevant) continue;
              }
              activePartIndices.push(pi);
            }
          }
          active = activePartIndices.length > 0;
          // If active for all parts, omit the array (= universal)
          if (activePartIndices.length === partTags.length) {
            activePartIndices = undefined;
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
        activePartIndices,
        staticEntries: buff.staticBuffs,
        dynamicEntries,
      });
    }

    // Also include resonance buffs
    for (const buff of this.teamResonance.buffs) {
      let active = true;
      let activePartIndicesRes: number[] | undefined;
      if (partTags.length > 0) {
        const outputKeys = new Set<StatKey>(buff.staticBuffs.map((e) => e.key));
        // Resonance buffs apply to all team members — expand via bridge
        for (const charId of Object.keys(this.charBuilds)) {
          for (const outKey of [...outputKeys]) {
            const bridged = scalingBridge.get(`${charId}\0${outKey}`);
            if (bridged) for (const k of bridged) outputKeys.add(k);
          }
        }

        activePartIndicesRes = [];
        for (let pi = 0; pi < partTags.length; pi++) {
          const tag = partTags[pi];
          if (tag && buff.target.filter) {
            if (!filterMatchesTag(buff.target.filter!, tag)) continue;
          }
          const rk = partReadKeys[pi];
          if (rk && outputKeys.size > 0) {
            let relevant = false;
            for (const k of outputKeys) {
              if (rk.has(k)) {
                relevant = true;
                break;
              }
            }
            if (!relevant) continue;
          }
          activePartIndicesRes.push(pi);
        }
        active = activePartIndicesRes.length > 0;
        if (activePartIndicesRes.length === partTags.length) {
          activePartIndicesRes = undefined;
        }
      }
      result.push({
        source: buff.source,
        target: buff.target,
        active,
        activePartIndices: activePartIndicesRes,
        staticEntries: buff.staticBuffs,
        dynamicEntries: [],
      });
    }

    // ── Extra buffs (food/env/status/custom) ──
    const extraBuffEntries = this.allStaticBuffs.filter(
      (b) => b.providerCharId === "extra"
    );
    for (const { buff } of extraBuffEntries) {
      // charId filter gates applicability
      if (buff.target.charId && buff.target.charId !== onFieldCharId) {
        result.push({
          source: buff.source,
          target: buff.target,
          active: false,
          staticEntries: buff.staticBuffs,
          dynamicEntries: [],
        });
        continue;
      }

      let active = true;
      let activePartIndicesExtra: number[] | undefined;
      if (partTags.length > 0) {
        const outputKeys = new Set<StatKey>(buff.staticBuffs.map((e) => e.key));
        // Extra buffs apply to team members — expand via bridge
        for (const charId of Object.keys(this.charBuilds)) {
          for (const outKey of [...outputKeys]) {
            const bridged = scalingBridge.get(`${charId}\0${outKey}`);
            if (bridged) for (const k of bridged) outputKeys.add(k);
          }
        }

        activePartIndicesExtra = [];
        for (let pi = 0; pi < partTags.length; pi++) {
          const tag = partTags[pi];
          if (tag && buff.target.filter) {
            if (!filterMatchesTag(buff.target.filter!, tag)) continue;
          }
          const rk = partReadKeys[pi];
          if (rk && outputKeys.size > 0) {
            let relevant = false;
            for (const k of outputKeys) {
              if (rk.has(k)) {
                relevant = true;
                break;
              }
            }
            if (!relevant) continue;
          }
          activePartIndicesExtra.push(pi);
        }
        active = activePartIndicesExtra.length > 0;
        if (activePartIndicesExtra.length === partTags.length) {
          activePartIndicesExtra = undefined;
        }
      }
      result.push({
        source: buff.source,
        target: buff.target,
        active,
        activePartIndices: activePartIndicesExtra,
        staticEntries: buff.staticBuffs,
        dynamicEntries: [],
      });
    }

    // ── Bespoke buffs (per-formula-part) ──
    if (onFieldCharId != null) {
      const calcBuild = this.charBuilds[onFieldCharId];
      const bespokeRaw = calcBuild.charBase.getBespokeBuffs();
      // Deduplicate by buff identity (same buff object on multiple parts)
      const seenBespokeBuffs = new Set<StatBuff>();
      for (const { formulaId: fId, label, buff } of bespokeRaw) {
        if (seenBespokeBuffs.has(buff)) continue;
        seenBespokeBuffs.add(buff);

        const ownerStats = preStats[onFieldCharId]!;
        const raw = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
        const active = formulaId === fId;

        let dynamicEntries: ResolvedStatEntry[] = [];
        if (raw.length > 0) {
          dynamicEntries = raw.map((entry: StatEntry) => {
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
          providerCharId: onFieldCharId,
          target: buff.target,
          active,
          staticEntries: buff.staticBuffs,
          dynamicEntries,
          bespokeLabel: label,
        });
      }
    }

    return result;
  }

  /**
   * Compute marginal damage gains for +1 avg substat roll.
   * Delegates to the shared computeSubstatMarginals loop and converts
   * absolute deltas to relative gains.
   */
  private computeMarginalGainsUnified(
    onFieldCharId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    baseDamage: number,
    reactionOverride?: ReactionOverride,
    hasOffField?: boolean
  ): Record<string, Partial<Record<StatKey, number>>> {
    if (baseDamage === 0) return {};

    const evalFn = (sheets: Record<string, StatSheet>): number => {
      const stats = this.getTeamStats(sheets, onFieldCharId, ctx);
      const offFieldStats = hasOffField
        ? this.getOffFieldPostStats(onFieldCharId, sheets, ctx)
        : undefined;
      const build = this.charBuilds[onFieldCharId]!;
      return build.getDamageResult(
        formulaId,
        stats[onFieldCharId]!,
        Object.values(stats),
        ctx,
        reactionOverride,
        offFieldStats
      ).totalDamage;
    };

    const charIds = Object.keys(this.charBuilds);
    const deltas = computeSubstatMarginals(
      evalFn,
      artifactStats,
      baseDamage,
      charIds
    );

    // Convert absolute deltas → relative gains
    const gains: Record<string, Partial<Record<StatKey, number>>> = {};
    for (const [cid, charDeltas] of Object.entries(deltas)) {
      const charGains: Partial<Record<StatKey, number>> = {};
      for (const [key, delta] of Object.entries(charDeltas)) {
        charGains[key as StatKey] = delta / baseDamage;
      }
      gains[cid] = charGains;
    }
    return gains;
  }

  /**
   * Compute the relative damage gain from leveling each Lv90 character to Lv100.
   * Rebuilds the team with the character at Lv100 and compares damage.
   */
  private computeLevelUpGains(
    onFieldCharId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    baseDamage: number,
    reactionOverride?: ReactionOverride,
    hasOffField?: boolean
  ): Record<string, { gain: number; from: number; to: number }[]> {
    if (baseDamage === 0) return {};

    const computeGain = (charId: string, targetLevel: number) => {
      const tweakedConfigs = this.configs.map((c) =>
        c.charId === charId ? { ...c, charLevel: targetLevel } : c
      );
      const tweakedTeam = new TeamBuild(
        tweakedConfigs,
        this.combatOpts,
        this.enemyAura,
        this.extraBuffs
      );
      const tweakedStats = tweakedTeam.getTeamStats(
        artifactStats,
        onFieldCharId,
        ctx
      );
      let offFieldTeamStats: Record<string, StatSheet> | undefined;
      if (hasOffField) {
        offFieldTeamStats = getOffFieldStats(
          tweakedTeam,
          artifactStats,
          onFieldCharId,
          ctx
        );
      }
      const tweakedResult = tweakedTeam.getDamageResult(
        onFieldCharId,
        formulaId,
        tweakedStats,
        ctx,
        reactionOverride,
        offFieldTeamStats
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

  /**
   * Convert a BuffActivationMap (from the override store) into PartialBuffInfo[]
   * suitable for the optimizer's AST compiler. Handles both stack-limited buffs
   * (greedy allocation + user overrides) and non-stack-limited user overrides.
   */
  computePartialBuffSpecs(
    carryCharId: string,
    formulaId: string,
    sheets: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    userOverrides?: BuffActivationMap
  ): PartialBuffInfo[] {
    const build = this.charBuilds[carryCharId];
    if (!build) return [];
    const entry = build.charBase.getFormulaEntry(formulaId);
    if (!entry) return [];

    // Compute post stats
    const postStats = this.getTeamStats(sheets, carryCharId, ctx);

    const offFieldPostStats = entry.parts.some((p) => p.offField)
      ? this.getOffFieldPostStats(carryCharId, sheets, ctx)
      : undefined;

    // Compute pre-stats for collectStackLimitedBuffs
    const fieldDependent = this.getFieldDependentBuffs(carryCharId);
    const preStats = this.buildPreStatsFromBuilds(sheets, fieldDependent);
    const teamPreStatsArr = Object.values(preStats);

    // Stack-limited buffs
    const stackLimited = collectStackLimitedBuffs(
      this.allStaticBuffs,
      preStats,
      teamPreStatsArr
    );

    const infos: PartialBuffInfo[] = [];

    if (stackLimited.length > 0) {
      const { sansBuffStats, offFieldSansBuffStats } = this.buildSansBuffStats(
        stackLimited,
        carryCharId,
        sheets,
        ctx,
        offFieldPostStats
      );

      const defaultActivation = computeDefaultActivation(
        entry.parts,
        stackLimited,
        postStats[carryCharId]!,
        build.charBase.charLevel,
        ctx,
        reactionOverride,
        offFieldPostStats,
        sansBuffStats,
        offFieldSansBuffStats
      );
      // Merge user overrides on top of greedy defaults
      const merged: BuffActivationMap = { ...defaultActivation };
      if (userOverrides) {
        TeamBuild.mergeActivationOverrides(merged, userOverrides);
      }
      infos.push(...buildPartialBuffInfos(merged, stackLimited, entry.parts));
    }

    // Non-stack-limited user overrides
    if (userOverrides && Object.keys(userOverrides).length > 0) {
      infos.push(
        ...buildUserOverrideInfos(
          userOverrides,
          this.allStaticBuffs,
          entry.parts,
          (buff, providerId) =>
            this.isBuffApplicableForChar(buff, providerId, carryCharId, true)
        )
      );
    }

    return infos;
  }

  /**
   * Compute per-line PartialBuffInfo[] for a combo rotation.
   *
   * Shares the maxStack budget across ALL combo lines (unlike the per-formula
   * computePartialBuffSpecs which gives each formula the full budget).
   * Also merges per-line user overrides on top of the combo-wide defaults.
   */
  computeComboPartialBuffSpecs(
    activeLines: ComboLine[],
    sheets: Record<string, StatSheet>,
    ctx: CalcContext,
    rxnOverrides?: Record<string, ReactionOverride>,
    perLineUserOverrides?: Map<number, BuffActivationMap>
  ): Record<number, PartialBuffInfo[]> | undefined {
    if (activeLines.length === 0) return undefined;

    const { defaultActivations, stackLimited, lineEntries } =
      this.buildComboDefaults(activeLines, sheets, ctx);

    // ── Merge defaults + user overrides → PartialBuffInfo[] per line ──
    const result: Record<number, PartialBuffInfo[]> = {};

    for (let lineIdx = 0; lineIdx < activeLines.length; lineIdx++) {
      const entry = lineEntries[lineIdx];
      if (!entry) continue;

      const merged: BuffActivationMap = { ...defaultActivations[lineIdx] };
      const userOv = perLineUserOverrides?.get(lineIdx);
      if (userOv) {
        TeamBuild.mergeActivationOverrides(merged, userOv);
      }

      const infos: PartialBuffInfo[] = [];

      if (stackLimited.length > 0) {
        infos.push(...buildPartialBuffInfos(merged, stackLimited, entry.parts));
      }

      if (userOv && Object.keys(userOv).length > 0) {
        const lineCharId = activeLines[lineIdx].charId;
        infos.push(
          ...buildUserOverrideInfos(
            userOv,
            this.allStaticBuffs,
            entry.parts,
            (buff, providerId) =>
              this.isBuffApplicableForChar(buff, providerId, lineCharId, true)
          )
        );
      }

      if (infos.length > 0) {
        result[lineIdx] = infos;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Compute combo-wide default activations and stack-limited buff info.
   *
   * Used by both the damage calc hot path (computeComboPartialBuffSpecs) and
   * the display/dialog path (getComboFormulaDefaults) so that both share the
   * same maxStack budget across ALL combo lines.
   */
  getComboFormulaDefaults(
    activeLines: ComboLine[],
    sheets: Record<string, StatSheet>,
    ctx: CalcContext
  ): {
    perLine: BuffActivationMap[];
    stackLimited: StackLimitedBuffInfo[];
  } {
    if (activeLines.length === 0) return { perLine: [], stackLimited: [] };
    const { defaultActivations, stackLimited } = this.buildComboDefaults(
      activeLines,
      sheets,
      ctx
    );
    return { perLine: defaultActivations, stackLimited };
  }

  /**
   * Build combo-wide default activation by resolving stats and running
   * computeComboDefaultActivation. Shared between computeComboPartialBuffSpecs
   * and getComboFormulaDefaults.
   */
  private buildComboDefaults(
    activeLines: ComboLine[],
    sheets: Record<string, StatSheet>,
    ctx: CalcContext
  ): {
    defaultActivations: BuffActivationMap[];
    stackLimited: StackLimitedBuffInfo[];
    lineEntries: (ReturnType<CharacterBase["getFormulaEntry"]> | null)[];
  } {
    // ── Collect stack-limited buffs ──
    // Field context doesn't matter here: collectStackLimitedBuffs only checks
    // whether dynamicBuffs() returns entries (always true for non-no-op buffs),
    // not their values. Any on-field character produces the same result.
    const fieldDependent = this.getFieldDependentBuffs(activeLines[0].charId);
    const preStats = this.buildPreStatsFromBuilds(sheets, fieldDependent);
    const stackLimited = collectStackLimitedBuffs(
      this.allStaticBuffs,
      preStats,
      Object.values(preStats)
    );

    // ── Build per-line contexts with correct postStats ──
    const getStats = this.createStatsCacheFn(sheets, ctx);

    const lineContexts: ComboLineContext[] = [];
    const lineEntries: (ReturnType<CharacterBase["getFormulaEntry"]> | null)[] =
      [];

    for (const line of activeLines) {
      const cb = this.charBuilds[line.charId];
      const entry = cb?.charBase.getFormulaEntry(line.formulaId);
      lineEntries.push(entry ?? null);
      if (!entry || !cb) {
        lineContexts.push({
          parts: [],
          lineCount: line.count,
          postStats: new StatSheet([]),
          charLevel: 0,
        });
        continue;
      }

      const teamStats = getStats(line.charId);
      const linePostStats = teamStats[line.charId]!;

      const offFieldPostStats = entry.parts.some((p) => p.offField)
        ? this.getOffFieldPostStats(line.charId, sheets, ctx, getStats)
        : undefined;

      // Pre-build sans-buff stats for each stack-limited buff on this line
      let lineSansBuff: Map<string, StatSheet> | undefined;
      let lineOffFieldSansBuff: Map<string, StatSheet> | undefined;
      if (stackLimited.length > 0) {
        const sans = this.buildSansBuffStats(
          stackLimited,
          line.charId,
          sheets,
          ctx,
          offFieldPostStats
        );
        lineSansBuff = sans.sansBuffStats;
        lineOffFieldSansBuff = sans.offFieldSansBuffStats;
      }

      lineContexts.push({
        parts: entry.parts,
        lineCount: line.count,
        postStats: linePostStats,
        charLevel: cb.charBase.charLevel,
        offFieldPostStats,
        sansBuffStats: lineSansBuff,
        offFieldSansBuffStats: lineOffFieldSansBuff,
      });
    }

    // ── Combo-wide default activation (shared maxStack budget) ──
    const defaultActivations = computeComboDefaultActivation(
      lineContexts,
      stackLimited,
      ctx
    );

    return { defaultActivations, stackLimited, lineEntries };
  }
}

// ═══════════════════════════════════════════════════════════════
// Off-Field Helpers
// ═══════════════════════════════════════════════════════════════

/** Check if a formula has any off-field parts. */
export function hasOffFieldParts(
  teamBuild: TeamBuild,
  charId: string,
  formulaId: string
): boolean {
  const entry =
    teamBuild.charBuilds[charId]?.charBase.getFormulaEntry(formulaId);
  return entry?.parts.some((p) => p.offField) ?? false;
}

/** Check off-field status of a formula's parts. */
export function offFieldStatus(
  teamBuild: TeamBuild,
  charId: string,
  formulaId: string
): "full" | "partial" | "none" {
  const entry =
    teamBuild.charBuilds[charId]?.charBase.getFormulaEntry(formulaId);
  if (!entry || entry.parts.length === 0) return "none";
  const offCount = entry.parts.filter((p) => p.offField).length;
  if (offCount === entry.parts.length) return "full";
  if (offCount > 0) return "partial";
  return "none";
}

/**
 * Compute off-field stats for a formula character.
 * Uses onFieldCharId=null (nobody on-field) so no character gets onField buffs.
 */
function getOffFieldStats(
  teamBuild: TeamBuild,
  artifactStats: Record<string, StatSheet>,
  _formulaCharId: string,
  ctx: CalcContext
): Record<string, StatSheet> {
  return teamBuild.getTeamStats(artifactStats, null, ctx);
}

// ═══════════════════════════════════════════════════════════════
// Combo Evaluation
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluate a combo formula: weighted sum of multiple formula lines,
 * potentially from different characters with different reaction overrides.
 *
 * Groups lines by on-field character and caches getTeamStats() per unique
 * onFieldCharId for efficiency (typically 1-2 unique on-field characters).
 */
export function evaluateCombo(
  teamBuild: TeamBuild,
  combo: ComboFormula,
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext,
  /** Single-mode per-formula reaction overrides — used as defaults for per-part config. */
  singleModeOverrides?: Record<string, ReactionOverride>,
  /** Per-line PartialBuffInfo[], keyed by line index in validLines. */
  buffOverrides?: Record<number, PartialBuffInfo[]>
): ComboResult {
  // Skip lines with zero count or whose formula no longer exists (e.g. constellation lowered)
  const allFormulas = teamBuild.getFormulaIds();
  const reactionFormulas = teamBuild.reactionProvider.getFormulaIds();
  const validLines = combo.lines.filter((line) => {
    if (line.count <= 0) return false;
    if (line.formulaId.startsWith("rx-")) {
      return reactionFormulas[line.formulaId] !== undefined;
    }
    const charFormulas = allFormulas[line.charId];
    return charFormulas?.[line.formulaId];
  });

  // Cache stat resolution per unique on-field character (null = nobody on-field)
  const statsCache = new Map<string | null, Record<string, StatSheet>>();
  const getStats = (onFieldCharId: string | null) => {
    if (!statsCache.has(onFieldCharId)) {
      statsCache.set(
        onFieldCharId,
        teamBuild.getTeamStats(artifactStats, onFieldCharId, ctx)
      );
    }
    return statsCache.get(onFieldCharId)!;
  };

  const lineDamages = validLines.map((line, lineIdx) => {
    const teamStats = getStats(line.charId);

    // Team reaction path: route rx-* formulas to reactionProvider
    if (line.formulaId.startsWith("rx-")) {
      const rp = teamBuild.reactionProvider;
      let result: DamageResult;
      if (rp.isMultiContributor(line.formulaId)) {
        result = rp.getMultiContributorResult(
          line.formulaId,
          line.charId,
          teamStats,
          ctx
        );
      } else {
        result = rp.getDamageResult(
          line.formulaId,
          line.charId,
          teamStats[line.charId]!,
          ctx
        );
      }
      return {
        perHit: result.totalDamage,
        total: result.totalDamage * line.count,
      };
    }

    // Normal character formula path
    // Compute off-field stats if the formula has off-field parts
    let offFieldTeamStats: Record<string, StatSheet> | undefined;
    if (hasOffFieldParts(teamBuild, line.charId, line.formulaId)) {
      // Nobody on-field for off-field damage parts
      offFieldTeamStats = getStats(null);
    }

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

    // Build stat variants if this line has partial buffs
    const lineInfos = buffOverrides?.[lineIdx];
    let lineVariants: Map<string, StatSheet> | undefined;
    let lineOffFieldVariants: Map<string, StatSheet> | undefined;
    if (lineInfos && lineInfos.length > 0) {
      const lineEntry = teamBuild.charBuilds[
        line.charId
      ]?.charBase.getFormulaEntry(line.formulaId);
      if (lineEntry) {
        lineVariants = buildStatVariants(
          lineInfos,
          lineEntry.parts,
          (excl) =>
            teamBuild.getTeamStatsExcluding(
              artifactStats,
              line.charId,
              ctx,
              excl
            )[line.charId]!
        );
        if (offFieldTeamStats) {
          lineOffFieldVariants = buildStatVariants(
            lineInfos,
            lineEntry.parts,
            (excl) =>
              teamBuild.getTeamStatsExcluding(artifactStats, null, ctx, excl)[
                line.charId
              ]!
          );
        }
      }
    }

    const result = teamBuild.getDamageResult(
      line.charId,
      line.formulaId,
      teamStats,
      ctx,
      effectiveReaction,
      offFieldTeamStats,
      lineInfos,
      lineVariants,
      lineOffFieldVariants
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
  singleModeOverrides?: Record<string, ReactionOverride>,
  buffOverrides?: Record<number, PartialBuffInfo[]>
): DisplayResult {
  // Skip lines whose formula no longer exists (e.g. constellation lowered)
  const allFormulas = teamBuild.getFormulaIds();
  const reactionFormulas = teamBuild.reactionProvider.getFormulaIds();
  const activeLines = combo.lines.filter((l) => {
    if (l.count <= 0) return false;
    if (l.formulaId.startsWith("rx-")) {
      return reactionFormulas[l.formulaId] !== undefined;
    }
    const charFormulas = allFormulas[l.charId];
    return charFormulas?.[l.formulaId];
  });

  // Determine unique on-field characters and which chars have active lines
  const allCharIds = Object.keys(teamBuild.charBuilds);

  // ── Stats: compute per unique on-field context (null = nobody on-field) ──
  const statsCache = new Map<string | null, Record<string, StatSheet>>();
  const getStats = (onFieldCharId: string | null) => {
    if (!statsCache.has(onFieldCharId)) {
      statsCache.set(
        onFieldCharId,
        teamBuild.getTeamStats(artifactStats, onFieldCharId, ctx)
      );
    }
    return statsCache.get(onFieldCharId)!;
  };

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
    const onField = getStats(cid)[cid]!;
    const offField = getStats(null)[cid]!;
    statSheets[cid] = { onField, offField };
  }

  // ── Base combo damage ──
  const baseResult = evaluateCombo(
    teamBuild,
    { ...combo, lines: activeLines },
    artifactStats,
    ctx,
    singleModeOverrides,
    buffOverrides
  );
  const baseDamage = baseResult.totalDamage;
  // Full-buff baseline for marginal/level-up comparisons: consistent with
  // the tweaked evaluateCombo calls which don't pass buffOverrides.
  const fullBuffBaseDamage = buffOverrides
    ? evaluateCombo(
        teamBuild,
        { ...combo, lines: activeLines },
        artifactStats,
        ctx,
        singleModeOverrides
      ).totalDamage
    : baseDamage;

  // ── Marginal gains ──
  const marginalGains: Record<string, Partial<Record<StatKey, number>>> = {};

  if (fullBuffBaseDamage > 0) {
    const comboConfig = { ...combo, lines: activeLines };
    const evalFn = (sheets: Record<string, StatSheet>): number =>
      evaluateCombo(teamBuild, comboConfig, sheets, ctx, singleModeOverrides)
        .totalDamage;

    const deltas = computeSubstatMarginals(
      evalFn,
      artifactStats,
      fullBuffBaseDamage,
      allCharIds
    );

    // Convert absolute deltas → relative gains
    for (const [cid, charDeltas] of Object.entries(deltas)) {
      const charGains: Partial<Record<StatKey, number>> = {};
      for (const [key, delta] of Object.entries(charDeltas)) {
        charGains[key as StatKey] = delta / fullBuffBaseDamage;
      }
      marginalGains[cid] = charGains;
    }
  }

  // ── Intrinsic saturation detection ──
  // Characters with zero stat marginal gains at the current operating point
  // might be intrinsically saturated (e.g. Bennett — buffs scale on baseAtk).
  // Verify by re-checking with empty artifact sheets: if still zero gains,
  // the character's artifacts truly don't affect team damage.
  const intrinsicSaturatedCharIds: string[] = [];
  {
    const zeroGainCharIds = allCharIds.filter(
      (cid) =>
        !marginalGains[cid] || Object.keys(marginalGains[cid]).length === 0
    );
    if (zeroGainCharIds.length > 0 && fullBuffBaseDamage > 0) {
      const comboConfig = { ...combo, lines: activeLines };
      const evalFn = (sheets: Record<string, StatSheet>): number =>
        evaluateCombo(teamBuild, comboConfig, sheets, ctx, singleModeOverrides)
          .totalDamage;
      // Build sheets with empty artifacts for each zero-gain character
      const emptySheets = { ...artifactStats };
      for (const cid of zeroGainCharIds) {
        emptySheets[cid] = new StatSheet([]);
      }
      const emptyBaseDmg = evalFn(emptySheets);
      if (emptyBaseDmg > 0) {
        const emptyDeltas = computeSubstatMarginals(
          evalFn,
          emptySheets,
          emptyBaseDmg,
          zeroGainCharIds
        );
        for (const cid of zeroGainCharIds) {
          const gains = emptyDeltas[cid];
          if (!gains || Object.keys(gains).length === 0) {
            intrinsicSaturatedCharIds.push(cid);
          }
        }
      }
    }
  }

  // ── Buffs: union across all on-field contexts ──
  // resolveBuffs is private, so we call getDisplayResult for each unique on-field
  // character+formula pair and merge buffs. A buff is active if it's active in ANY formula.
  const buffMap = new Map<string, ResolvedBuff>();

  // Collect unique (charId, formulaId) pairs from active combo lines (skip rx- formulas)
  const seenFormulas = new Set<string>();
  for (const line of activeLines) {
    if (line.formulaId.startsWith("rx-")) continue;
    const fKey = `${line.charId}.${line.formulaId}`;
    if (seenFormulas.has(fKey)) continue;
    seenFormulas.add(fKey);

    const rxnOverride = singleModeOverrides?.[fKey];
    try {
      const dr = teamBuild.getDisplayResult(
        line.charId,
        line.formulaId,
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
        `[damageCalc] buff collection failed for ${line.charId}/${line.formulaId}:`,
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
  if (fullBuffBaseDamage > 0) {
    const computeComboGain = (charId: string, targetLevel: number) => {
      const tweakedConfigs = teamBuild.configs.map((c) =>
        c.charId === charId ? { ...c, charLevel: targetLevel } : c
      );
      const tweakedTeam = new TeamBuild(
        tweakedConfigs,
        teamBuild.combatOpts,
        teamBuild.enemyAura,
        teamBuild.extraBuffs
      );
      const newResult = evaluateCombo(
        tweakedTeam,
        { ...combo, lines: activeLines },
        artifactStats,
        ctx,
        singleModeOverrides
      );
      return (newResult.totalDamage - fullBuffBaseDamage) / fullBuffBaseDamage;
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

  // ── Per-formula display parts ──
  const partsByFormula: Record<string, DisplayPart[]> = {};

  // Group active lines by formula key
  const linesByFormula = new Map<
    string,
    { lineIdx: number; line: (typeof activeLines)[0] }[]
  >();
  for (let i = 0; i < activeLines.length; i++) {
    const line = activeLines[i];
    const key = `${line.charId}.${line.formulaId}`;
    let arr = linesByFormula.get(key);
    if (!arr) {
      arr = [];
      linesByFormula.set(key, arr);
    }
    arr.push({ lineIdx: i, line });
  }

  for (const [formulaKey, formulaLines] of linesByFormula) {
    const { charId, formulaId } = formulaLines[0].line;
    const build = teamBuild.charBuilds[charId];
    if (!build) continue;

    const postStats = getStats(charId);

    // ── Team reaction formulas: build display parts from reactionProvider ──
    if (formulaId.startsWith("rx-")) {
      const rxEntry = teamBuild.reactionProvider.getFormulaEntry(formulaId);
      if (!rxEntry) continue;
      const formula = rxEntry.parts[0].formula;
      const charLevel =
        teamBuild.configs.find((c) => c.charId === charId)?.charLevel ?? 90;

      let parts: DisplayPart[];
      if (teamBuild.reactionProvider.isMultiContributor(formulaId)) {
        const teamStats = getStats(charId);
        const display = teamBuild.reactionProvider.getMultiContributorDisplay(
          formulaId,
          charId,
          teamStats,
          ctx
        );
        // Single aggregated display part
        const dp = formula.displayFull(postStats[charId]!, charLevel, ctx);
        dp.damage = display.totalDamage;
        dp.hits = 1;
        parts = [dp];
      } else {
        const dp = formula.displayFull(postStats[charId]!, charLevel, ctx);
        dp.hits = 1;
        parts = [dp];
      }

      const totalComboCount = formulaLines.reduce(
        (sum, fl) => sum + fl.line.count,
        0
      );
      partsByFormula[formulaKey] = parts.map((dp) => ({
        ...dp,
        damage: dp.damage * totalComboCount,
      }));
      continue;
    }

    // Compute effective reaction (first line merged with single-mode overrides)
    const firstLine = formulaLines[0].line;
    let effectiveReaction = firstLine.reaction;
    if (singleModeOverrides) {
      const singleOverride = singleModeOverrides[formulaKey];
      if (singleOverride && effectiveReaction) {
        effectiveReaction = {
          ...effectiveReaction,
          partReactions: {
            ...singleOverride.partReactions,
            ...effectiveReaction.partReactions,
          },
          partHits: {
            ...singleOverride.partHits,
            ...effectiveReaction.partHits,
          },
        };
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
        effectiveReaction = singleOverride;
      }
    }

    // Off-field stats (nobody on-field for off-field parts)
    const entry = build.charBase.getFormulaEntry(formulaId);
    const formulaHasOffField = entry?.parts.some((p) => p.offField) ?? false;
    let offFieldPostStats: StatSheet | undefined;
    if (formulaHasOffField) {
      offFieldPostStats = getStats(null)[charId];
    }

    // Get raw display parts
    const { parts } = build.getDisplayParts(
      formulaId,
      postStats[charId]!,
      ctx,
      effectiveReaction,
      offFieldPostStats
    );

    // Aggregate partial buffs across combo lines for this formula
    const totalComboCount = formulaLines.reduce(
      (sum, fl) => sum + fl.line.count,
      0
    );
    const hasLinePartialBuffs = formulaLines.some(
      (fl) => buffOverrides?.[fl.lineIdx]?.length
    );

    if (hasLinePartialBuffs && entry) {
      // Sum activated × count across lines per buff per part
      const buffAgg = new Map<string, Record<number, number>>();
      for (const fl of formulaLines) {
        const lineInfos = buffOverrides?.[fl.lineIdx];
        if (!lineInfos) continue;
        for (const info of lineInfos) {
          let agg = buffAgg.get(info.buffKey);
          if (!agg) {
            agg = {};
            buffAgg.set(info.buffKey, agg);
          }
          for (const [pidxStr, activated] of Object.entries(
            info.partActivation
          )) {
            const pidx = Number(pidxStr);
            agg[pidx] = (agg[pidx] ?? 0) + activated * fl.line.count;
          }
        }
      }

      // Build per-cast-average PartialBuffInfo[] for blended damage
      const aggregatedInfos: PartialBuffInfo[] = [];
      for (const [buffKey, partAgg] of buffAgg) {
        const perCastActivation: Record<number, number> = {};
        for (const [pidxStr, totalActivated] of Object.entries(partAgg)) {
          perCastActivation[Number(pidxStr)] = totalActivated / totalComboCount;
        }
        aggregatedInfos.push({
          buffKey,
          partActivation: perCastActivation,
        });
      }

      if (aggregatedInfos.length > 0) {
        // Build stat variants and compute blended damage
        const statsVariants = buildStatVariants(
          aggregatedInfos,
          entry.parts,
          (excl) =>
            teamBuild.getTeamStatsExcluding(artifactStats, charId, ctx, excl)[
              charId
            ]!
        );
        let offFieldVariants: Map<string, StatSheet> | undefined;
        if (offFieldPostStats) {
          offFieldVariants = buildStatVariants(
            aggregatedInfos,
            entry.parts,
            (excl) =>
              teamBuild.getTeamStatsExcluding(artifactStats, null, ctx, excl)[
                charId
              ]!
          );
        }

        const blended = computeBlendedDamage(
          entry.parts,
          aggregatedInfos,
          postStats[charId]!,
          statsVariants,
          build.charBase.charLevel,
          ctx,
          offFieldPostStats,
          offFieldVariants
        );

        // Rebuild display parts with 1st-hit stats (exclude 0-activation buffs)
        for (let i = 0; i < parts.length; i++) {
          if (!blended.partDamages[i]) continue;

          const zeroBuffKeys = new Set<string>();
          if (i < entry.parts.length) {
            const h = entry.parts[i].hits ?? 1;
            for (const info of aggregatedInfos) {
              if ((info.partActivation[i] ?? h) === 0) {
                zeroBuffKeys.add(info.buffKey);
              }
            }
          }

          if (zeroBuffKeys.size > 0 && i < entry.parts.length) {
            const { formula, offField, bespokeBuff } = entry.parts[i];
            const eKey = exclusionKey(zeroBuffKeys);
            const baseVariant =
              offField && offFieldVariants
                ? (offFieldVariants.get(eKey) ?? offFieldPostStats!)
                : (statsVariants.get(eKey) ?? postStats[charId]!);
            const displayStats = bespokeBuff
              ? baseVariant.merge(
                  StatSheet.fromEntries(
                    [
                      ...bespokeBuff.staticBuffs,
                      ...bespokeBuff.dynamicBuffs(baseVariant, []),
                    ],
                    bespokeBuff.target.filter
                  )
                )
              : baseVariant;
            const rebuilt = formula.displayFull(
              displayStats,
              build.charBase.charLevel,
              ctx
            );
            parts[i] = {
              ...rebuilt,
              hits: parts[i].hits,
              offField: parts[i].offField,
              damage: blended.partDamages[i].damage,
              sourcePartIndex: i,
            };
          } else {
            parts[i] = {
              ...parts[i],
              damage: blended.partDamages[i].damage,
              sourcePartIndex: i,
            };
          }
        }
      }

      // Annotate parts with combo-wide partial buff info
      for (const [buffKey, partAgg] of buffAgg) {
        for (const [pidxStr, totalActivated] of Object.entries(partAgg)) {
          const pidx = Number(pidxStr);
          if (pidx >= parts.length) continue;
          const partHits = entry.parts[pidx]?.hits ?? 1;
          const totalHits = partHits * totalComboCount;
          if (totalActivated < totalHits) {
            if (!parts[pidx].partialBuffs) {
              parts[pidx] = { ...parts[pidx], partialBuffs: [] };
            }
            parts[pidx].partialBuffs!.push({
              buffKey,
              activatedHits: totalActivated,
              totalHits,
            });
            if (parts[pidx].sourcePartIndex === undefined) {
              parts[pidx] = { ...parts[pidx], sourcePartIndex: pidx };
            }
          }
        }
      }
    }

    partsByFormula[formulaKey] = parts;
  }

  // ── Idle stat records (cold path) ──
  const idleSheets = teamBuild.computeIdleStatSheets(artifactStats);
  const idleStatRecords: DisplayResult["idleStatRecords"] = {};
  for (const [cid, { onField, offField }] of Object.entries(idleSheets)) {
    idleStatRecords[cid] = {
      onField: onField.getIdleRecord(),
      offField: offField.getIdleRecord(),
    };
  }

  return {
    partsByFormula,
    totalDamage: baseDamage,
    lineDamages: baseResult.lineDamages,
    buffs,
    statSheets,
    charFormulaTags,
    marginalGains,
    levelUpGains,
    idleStatRecords,
    intrinsicSaturatedCharIds,
  };
}
