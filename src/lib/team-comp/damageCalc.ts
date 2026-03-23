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
import type { OptionMap } from "./damageModels";
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
  calcTargetId: string;
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
 * `getTeamStats(artifactStats, calcTargetId)` is the hot path.
 */
export class TeamBuild {
  readonly charBuilds: Record<string, CharBuild>;
  readonly teamMeta: TeamMeta;
  readonly teamResonance: TeamResonance;
  readonly allStaticBuffs: ProvidedStaticBuff[];
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
   * Collect field-dependent static buffs for each character, given a calcTargetId
   * that determines field state (charId === calcTargetId → on-field).
   */
  private getFieldDependentBuffs(
    calcTargetId: string
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
            charId === calcTargetId
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
    calcTargetId: string,
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    const postStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      postStats[id] = build.getPostStats(
        preStats[id]!,
        dynamicBuffs,
        id,
        id === calcTargetId,
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

  // ─── Team stat computation ──────────────────────────────────────────────

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
    const fieldDependent = this.getFieldDependentBuffs(calcTargetId);
    const preStats = this.buildPreStatsFromBuilds(
      artifactStats,
      fieldDependent
    );

    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(preStats, teamPreStatsArr);

    return this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      calcTargetId,
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
    calcTargetId: string,
    ctx: CalcContext | undefined,
    excludeKeys: Set<string>
  ): Record<string, StatSheet> {
    const fieldDependent = this.getFieldDependentBuffs(calcTargetId);

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
      calcTargetId,
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
    calcTargetId: string,
    ctx?: CalcContext
  ): OptimizerContext {
    const variableCharIds = Array.isArray(swapCharId)
      ? new Set(swapCharId)
      : new Set([swapCharId]);
    const primarySwapCharId = Array.isArray(swapCharId)
      ? swapCharId[0]
      : swapCharId;

    // Field-dependent buff filtering (constant for a given calcTargetId)
    const targetDependent = this.getFieldDependentBuffs(calcTargetId);

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
      calcTargetId,
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

    // Post-stats + critRateTarget
    return this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      calcTargetId,
      ctx
    );
  }

  /**
   * Pick any other team member's charId. Used to derive off-field stats
   * (by making someone else the calcTarget, the formula character becomes off-field).
   */
  private getOtherCharId(excludeId: string): string | undefined {
    return Object.keys(this.charBuilds).find((id) => id !== excludeId);
  }

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
      const otherCharId = this.getOtherCharId(charId);
      if (otherCharId) {
        for (const buffInfo of stackLimited) {
          const bKey = buffSourceKey(buffInfo.source);
          const excluded = this.getTeamStatsExcluding(
            artifactStats,
            otherCharId,
            ctx,
            new Set([bKey])
          );
          offFieldSansBuffStats.set(bKey, excluded[charId]!);
        }
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
    seed?: Map<string, Record<string, StatSheet>>
  ): (onFieldCharId: string) => Record<string, StatSheet> {
    const cache = seed ?? new Map<string, Record<string, StatSheet>>();
    return (onFieldCharId: string) => {
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
   * Picks another team member as calcTarget so the formula character is off-field.
   */
  private getOffFieldPostStats(
    charId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    getStats?: (onFieldCharId: string) => Record<string, StatSheet>
  ): StatSheet | undefined {
    const otherCharId = this.getOtherCharId(charId);
    if (!otherCharId) return undefined;
    if (getStats) return getStats(otherCharId)[charId];
    return this.getTeamStats(artifactStats, otherCharId, ctx)[charId];
  }

  /** All available formulas across all characters */
  getFormulaIds(): Record<string, Record<string, I18nLabel>> {
    const result: Record<string, Record<string, I18nLabel>> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getFormulaIds();
    }
    return result;
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
          const otherCharId = this.getOtherCharId(charId);
          if (otherCharId) {
            offFieldVariantsMap = buildStatVariants(
              allInfos,
              entry.parts,
              (excludeSet) =>
                this.getTeamStatsExcluding(
                  artifactStats,
                  otherCharId,
                  ctx,
                  excludeSet
                )[charId]!
            );
          }
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
        // Annotate display parts with partial buff info and update damage
        for (let i = 0; i < parts.length; i++) {
          if (blended.partDamages[i]) {
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
    const buffs = this.resolveBuffs(
      charId,
      preStats,
      teamPreStatsArr,
      partTags,
      partReadKeys,
      formulaId
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
    const seedCache = new Map<string, Record<string, StatSheet>>();
    seedCache.set(charId, postStats); // reuse existing computation
    const getStats = this.createStatsCacheFn(artifactStats, ctx, seedCache);

    const statSheets: Record<
      string,
      { onField: StatSheet; offField: StatSheet }
    > = {};
    for (const cid of Object.keys(this.charBuilds)) {
      const onField = getStats(cid)[cid]!;

      // Off-field: stats when someone else is on-field
      const offCtx =
        cid !== charId
          ? charId // reuse existing calcTarget context
          : this.getOtherCharId(cid);
      const offField = offCtx ? getStats(offCtx)[cid]! : onField;

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
      reactionOverride,
      formulaHasOffField
    );

    // ── Level-up gains (Lv90 → Lv100) ──
    const levelUpGains = this.computeLevelUpGains(
      charId,
      formulaId,
      artifactStats,
      ctx,
      totalDamage,
      reactionOverride,
      formulaHasOffField
    );

    return {
      partsByFormula: { [`${charId}.${formulaId}`]: parts },
      totalDamage,
      buffs,
      buffActivation,
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
    partTags: (DamageTag | undefined)[],
    partReadKeys: (ReadonlySet<StatKey> | undefined)[],
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
    // For self* receivers, check against the provider; otherwise against calcTarget.
    let applicableStatic = charBuffEntries
      .filter((b) => {
        const selfId = isSelfReceiver(b.buff.target.receiver)
          ? b.providerCharId
          : calcTargetId;
        return this.isBuffApplicableForChar(
          b.buff,
          b.providerCharId,
          selfId,
          selfId === calcTargetId
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
        : calcTargetId;
      return this.isBuffApplicableForChar(
        b.buff,
        b.providerCharId,
        selfId,
        selfId === calcTargetId
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
        !this.isBuffApplicableForChar(buff, providerCharId, calcTargetId, true)
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
        : calcTargetId;
      const applicable = this.isBuffApplicableForChar(
        buff,
        ownerId,
        selfId,
        selfId === calcTargetId
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
          const reachesCalcTarget = this.isBuffApplicableForChar(
            buff,
            ownerId,
            calcTargetId,
            true
          );
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
              cid === calcTargetId
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
            for (let pi = 0; pi < partTags.length; pi++) {
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
      if (buff.target.charId && buff.target.charId !== calcTargetId) {
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
    const calcBuild = this.charBuilds[calcTargetId];
    const bespokeRaw = calcBuild.charBase.getBespokeBuffs();
    // Deduplicate by buff identity (same buff object on multiple parts)
    const seenBespokeBuffs = new Set<StatBuff>();
    for (const { formulaId: fId, label, buff } of bespokeRaw) {
      if (seenBespokeBuffs.has(buff)) continue;
      seenBespokeBuffs.add(buff);

      const ownerStats = preStats[calcTargetId]!;
      const raw = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
      const active = formulaId === fId;

      let dynamicEntries: ResolvedStatEntry[] = [];
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
        providerCharId: calcTargetId,
        target: buff.target,
        active,
        staticEntries: buff.staticBuffs,
        dynamicEntries,
        bespokeLabel: label,
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
    reactionOverride?: ReactionOverride,
    hasOffField?: boolean
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
        const offFieldStats = hasOffField
          ? this.getOffFieldPostStats(calcTargetId, tweaked, ctx)
          : undefined;
        const build = this.charBuilds[calcTargetId]!;
        const newResult = build.getDamageResult(
          formulaId,
          newStats[calcTargetId]!,
          Object.values(newStats),
          ctx,
          reactionOverride,
          offFieldStats
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
        if (!this.isBuffApplicableForChar(buff, cid, calcTargetId, true))
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
        const offFieldStats = hasOffField
          ? this.getOffFieldPostStats(calcTargetId, tweaked, ctx)
          : undefined;
        const build = this.charBuilds[calcTargetId]!;
        const newResult = build.getDamageResult(
          formulaId,
          newStats[calcTargetId]!,
          Object.values(newStats),
          ctx,
          reactionOverride,
          offFieldStats
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
        calcTargetId,
        ctx
      );
      let offFieldTeamStats: Record<string, StatSheet> | undefined;
      if (hasOffField) {
        offFieldTeamStats = getOffFieldStats(
          tweakedTeam,
          artifactStats,
          calcTargetId,
          ctx
        );
      }
      const tweakedResult = tweakedTeam.getDamageResult(
        calcTargetId,
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
    // ── Resolve pre/post stats using first on-field char for buff collection ──
    const firstCharId = activeLines[0].charId;
    const fieldDependent = this.getFieldDependentBuffs(firstCharId);
    const preStats = this.buildPreStatsFromBuilds(sheets, fieldDependent);
    const teamPreStatsArr = Object.values(preStats);

    // ── Collect stack-limited buffs ──
    const stackLimited = collectStackLimitedBuffs(
      this.allStaticBuffs,
      preStats,
      teamPreStatsArr
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
 * Returns stats where calcTargetId is NOT the formula character,
 * so onField/selfOnField buffs don't apply to them.
 */
function getOffFieldStats(
  teamBuild: TeamBuild,
  artifactStats: Record<string, StatSheet>,
  formulaCharId: string,
  ctx: CalcContext
): Record<string, StatSheet> {
  // Pick any other team member as the on-field character
  const otherCharId = Object.keys(teamBuild.charBuilds).find(
    (id) => id !== formulaCharId
  );
  if (!otherCharId) {
    // Solo team — no off-field distinction possible
    return teamBuild.getTeamStats(artifactStats, formulaCharId, ctx);
  }
  return teamBuild.getTeamStats(artifactStats, otherCharId, ctx);
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
  singleModeOverrides?: Record<string, ReactionOverride>,
  /** Per-line PartialBuffInfo[], keyed by line index in validLines. */
  buffOverrides?: Record<number, PartialBuffInfo[]>
): ComboResult {
  // Skip lines whose formula no longer exists (e.g. constellation lowered)
  const allFormulas = teamBuild.getFormulaIds();
  const validLines = combo.lines.filter((line) => {
    const charFormulas = allFormulas[line.charId];
    return charFormulas?.[line.formulaId];
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

  const lineDamages = validLines.map((line, lineIdx) => {
    const teamStats = getStats(line.charId);

    // Compute off-field stats if the formula has off-field parts
    let offFieldTeamStats: Record<string, StatSheet> | undefined;
    if (hasOffFieldParts(teamBuild, line.charId, line.formulaId)) {
      // Pick any other team member as on-field to get stats without onField buffs
      const otherCharId = Object.keys(teamBuild.charBuilds).find(
        (id) => id !== line.charId
      );
      if (otherCharId) {
        offFieldTeamStats = getStats(otherCharId);
      }
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
          const otherCharId = Object.keys(teamBuild.charBuilds).find(
            (id) => id !== line.charId
          );
          if (otherCharId) {
            lineOffFieldVariants = buildStatVariants(
              lineInfos,
              lineEntry.parts,
              (excl) =>
                teamBuild.getTeamStatsExcluding(
                  artifactStats,
                  otherCharId,
                  ctx,
                  excl
                )[line.charId]!
            );
          }
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
  const activeLines = combo.lines.filter((l) => {
    if (l.count <= 0) return false;
    const charFormulas = allFormulas[l.charId];
    return charFormulas?.[l.formulaId];
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
    singleModeOverrides,
    buffOverrides
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

    // Off-field stats
    const entry = build.charBase.getFormulaEntry(formulaId);
    const formulaHasOffField = entry?.parts.some((p) => p.offField) ?? false;
    let offFieldPostStats: StatSheet | undefined;
    if (formulaHasOffField) {
      const otherCharId = Object.keys(teamBuild.charBuilds).find(
        (id) => id !== charId
      );
      if (otherCharId) {
        offFieldPostStats = getStats(otherCharId)[charId];
      }
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
          const otherCharId = Object.keys(teamBuild.charBuilds).find(
            (id) => id !== charId
          );
          if (otherCharId) {
            offFieldVariants = buildStatVariants(
              aggregatedInfos,
              entry.parts,
              (excl) =>
                teamBuild.getTeamStatsExcluding(
                  artifactStats,
                  otherCharId,
                  ctx,
                  excl
                )[charId]!
            );
          }
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

        for (let i = 0; i < parts.length; i++) {
          if (blended.partDamages[i]) {
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

  return {
    partsByFormula,
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
