import type { Element, Faction, Region } from "@/data/types";
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
  createWeapon,
} from "./damageModels";
import { AVG_SUBSTAT_ROLL } from "./inspection";
import type {
  BuffSource,
  BuffTarget,
  CalcContext,
  CharCompConfig,
  CombatOpts,
  DamageResult,
  DamageTag,
  DisplayPart,
  DisplayResult,
  I18nLabel,
  ResolvedBuff,
  ResolvedStatEntry,
  StatEntry,
  StatKey,
} from "./types";
import { filterMatchesTag } from "./types";

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
      teamMeta.countByRegion("Nod-Krai") >= 2 &&
      teamMeta.regions[config.charId] !== "Nod-Krai"
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

  /** Collect all buffs from this build's providers, filtering out no-ops. */
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

  /** Collect this build's dynamic buffs, evaluated against pre-stats */
  getDynamicBuffs(
    selfCharId: string,
    selfPreStats: StatSheet,
    teamPreStats: StatSheet[]
  ): EvaluatedDynamicBuff[] {
    const results: EvaluatedDynamicBuff[] = [];
    for (const b of this.getAllBuffs()) {
      const entries = b.dynamicBuffs(selfPreStats, teamPreStats);
      assertNoDuplicateStatKeys(
        entries,
        `dynamicBuffs (source: ${b.source.type}:${b.source.id})`
      );
      if (entries.length > 0) {
        results.push({
          buff: b,
          source: b.source,
          providerCharId: selfCharId,
          entries,
        });
      }
    }
    return results;
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
    ctx: CalcContext
  ): DamageResult {
    return this.charBase.getDamageResult(
      formulaId,
      selfPostStats,
      teamPostStats,
      ctx
    );
  }

  /** Cold path: produce structured display data for a formula. */
  getDisplayParts(
    formulaId: string,
    selfPostStats: StatSheet,
    ctx: CalcContext
  ): { parts: DisplayPart[]; totalDamage: number } {
    const entry = this.charBase.getFormulaEntry(formulaId);
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);
    const displayParts: DisplayPart[] = [];
    let totalDamage = 0;
    for (const { formula, hits } of entry.parts) {
      const dp = formula.display(selfPostStats, this.charBase.charLevel, ctx);
      const h = hits ?? 1;
      totalDamage += dp.damage * h;
      dp.hits = h;
      displayParts.push(dp);
    }
    return { parts: displayParts, totalDamage };
  }
}

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
  // Region filter: if buff specifies regions, target must be from one of them
  if (buff.target.regions && selfRegion !== undefined) {
    if (!buff.target.regions.includes(selfRegion)) return false;
  }
  // Faction filter: if buff specifies factions, target must be from one of them
  if (buff.target.factions && selfFaction !== undefined) {
    if (!buff.target.factions.includes(selfFaction)) return false;
  }

  const receiver = buff.target.receiver;
  const buffOwnerId = providerCharId;

  switch (receiver) {
    case "self":
    case "selfOffField":
      // Always applies to the provider's own stat sheet.
      // selfOffField is equivalent to self in single-target optimization
      // (supports are inherently off-field).
      return buffOwnerId === selfCharId;

    case "selfOnField":
      // Applies to the provider ONLY when provider IS the calc target.
      // During construction (calcTargetId=null), skip — deferred to getTeamStats.
      if (calcTargetId === null) return false;
      return buffOwnerId === selfCharId && selfCharId === calcTargetId;

    case "onField":
      // Applies to whoever is the calc target.
      // During construction (calcTargetId=null), skip — deferred to getTeamStats.
      if (calcTargetId === null) return false;
      return selfCharId === calcTargetId;

    case "otherOnField":
      // Applies if calc target is not provider
      if (calcTargetId === null) return false;
      return selfCharId !== buffOwnerId && selfCharId === calcTargetId;

    case "team":
      return true;
  }
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
  private readonly allStaticBuffs: ProvidedStaticBuff[];

  constructor(configs: CharCompConfig[], combatOpts: CombatOpts = {}) {
    const charIds = configs.map((c) => c.charId);
    const constellations: Record<string, number> = {};
    const artifactSets: Record<string, string> = {};
    for (const c of configs) {
      if (c.artifactSetId) artifactSets[c.charId] = c.artifactSetId;
      constellations[c.charId] = c.constellation;
    }
    this.teamMeta = new TeamMeta(charIds, constellations, artifactSets);
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
   * Compute final stat sheets for all team members.
   * This is the hot path during artifact optimization.
   *
   * @param artifactStats  Per-character artifact stat sheets
   * @param calcTargetId   The character being optimized (determines onField buff routing)
   */
  getTeamStats(
    artifactStats: Record<string, StatSheet>,
    calcTargetId: string
  ): Record<string, StatSheet> {
    // Collect target-dependent static buffs (onField, selfOnField) for each character
    const targetDependent: Record<string, StatBuff[]> = {};
    for (const charId of Object.keys(this.charBuilds)) {
      targetDependent[charId] = this.allStaticBuffs
        .filter((b) => {
          const r = b.buff.target.receiver;
          if (r !== "onField" && r !== "selfOnField") return false;
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
    const allDynamicBuffs: EvaluatedDynamicBuff[] = [];
    for (const [id, build] of Object.entries(this.charBuilds)) {
      allDynamicBuffs.push(
        ...build.getDynamicBuffs(id, preStats[id]!, teamPreStatsArr)
      );
    }

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

  /** Evaluate a specific character's damage formula with the given team stats */
  getDamageResult(
    charId: string,
    formulaId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext
  ): DamageResult {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);
    const teamStatsArr = Object.values(teamStats);
    return build.getDamageResult(
      formulaId,
      teamStats[charId]!,
      teamStatsArr,
      ctx
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
    ctx: CalcContext
  ): DisplayResult {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);

    // ── Stat resolution (mirrors getTeamStats but captures intermediate phases) ──
    const targetDependent: Record<string, StatBuff[]> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      targetDependent[cid] = this.allStaticBuffs
        .filter((b) => {
          const r = b.buff.target.receiver;
          if (r !== "onField" && r !== "selfOnField") return false;
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
    const allDynamicBuffs: EvaluatedDynamicBuff[] = [];
    for (const [id, cb] of Object.entries(this.charBuilds)) {
      allDynamicBuffs.push(
        ...cb.getDynamicBuffs(id, preStats[id]!, teamPreStatsArr)
      );
    }

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
      ctx
    );

    // ── Buff resolution ──
    const buffs = this.resolveBuffs(
      charId,
      preStats,
      teamPreStatsArr,
      formulaTags
    );

    // ── Stats (full team) ──
    const idleStats: Record<string, Partial<Record<StatKey, number>>> = {};
    const combatStats: Record<string, Partial<Record<StatKey, number>>> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      idleStats[cid] = preStats[cid]!.getAll();
      combatStats[cid] = postStats[cid]!.getAll(
        cid === charId ? formulaTags[0] : undefined
      );
    }

    // ── Marginal gains ──
    const marginalGains = this.computeMarginalGains(
      charId,
      formulaId,
      artifactStats,
      ctx,
      totalDamage,
      parts
    );

    return {
      parts,
      totalDamage,
      buffs,
      idleStats,
      combatStats,
      marginalGains,
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

    // Determine tie-breakers for calcTargetId
    const calcTargetRegion = this.teamMeta.regions[calcTargetId];
    const calcTargetFaction = this.teamMeta.factions[calcTargetId];
    let applicableStatic = this.allStaticBuffs
      .filter((b) =>
        isBuffApplicable(
          b.buff,
          b.providerCharId,
          calcTargetId,
          calcTargetId,
          calcTargetRegion,
          calcTargetFaction
        )
      )
      .map((b) => b.buff);
    applicableStatic = deduplicateBuffs(applicableStatic, (b) => b.staticBuffs);
    const activeStaticSet = new Set<StatBuff>(applicableStatic);

    const allDynamic: EvaluatedDynamicBuff[] = [];
    for (const [id, cb] of Object.entries(this.charBuilds)) {
      allDynamic.push(
        ...cb.getDynamicBuffs(id, preStats[id]!, teamPreStatsArr)
      );
    }
    let applicableDynamic = allDynamic.filter((b) =>
      isBuffApplicable(
        b.buff,
        b.providerCharId,
        calcTargetId,
        calcTargetId,
        calcTargetRegion,
        calcTargetFaction
      )
    );
    applicableDynamic = deduplicateBuffs(applicableDynamic, (b) => b.entries);
    const activeDynamicSet = new Set<StatBuff>(
      applicableDynamic.map((e) => e.buff)
    );

    for (const [ownerId, cb] of Object.entries(this.charBuilds)) {
      for (const buff of cb.getAllBuffs()) {
        const applicable = isBuffApplicable(
          buff,
          ownerId,
          calcTargetId,
          calcTargetId,
          calcTargetRegion,
          calcTargetFaction
        );

        // Resolve dynamic entries with per-entry caps
        let dynamicEntries: ResolvedStatEntry[] = [];
        let active = false;

        if (applicable) {
          const ownerStats = preStats[ownerId]!;
          const raw = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
          if (raw.length > 0) {
            active = activeDynamicSet.has(buff);
            if (active && formulaTags.length > 0 && buff.target.filter) {
              active = formulaTags.some((tag) =>
                filterMatchesTag(buff.target.filter!, tag)
              );
            }
            if (active) {
              dynamicEntries = raw.map((entry) => {
                const resolved: ResolvedStatEntry = { ...entry };
                // Extract per-entry cap and input key from known scaling buff types
                if (buff instanceof ScalingBuff) {
                  const cap = (buff as { cap?: number }).cap;
                  if (cap !== undefined) resolved.cap = cap;
                  resolved.inputKey = (buff as { inputKey: StatKey }).inputKey;
                }
                return resolved;
              });
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

        result.push({
          source: buff.source,
          providerCharId: ownerId,
          target: buff.target,
          active,
          staticEntries: buff.staticBuffs,
          dynamicEntries,
        });
      }
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
    displayParts: DisplayPart[]
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

    // Filter to rollable stat keys only
    const rollableKeys = Object.keys(AVG_SUBSTAT_ROLL) as StatKey[];
    const targetRollable = rollableKeys.filter((k) => usedKeys.has(k));

    if (targetRollable.length > 0) {
      const charGains: Partial<Record<StatKey, number>> = {};
      for (const key of targetRollable) {
        const delta = AVG_SUBSTAT_ROLL[key];
        if (!delta) continue;
        const tweaked = { ...artifactStats };
        tweaked[calcTargetId] = (
          artifactStats[calcTargetId] ?? new StatSheet([])
        ).withDelta(key, delta);
        const newStats = this.getTeamStats(tweaked, calcTargetId);
        const build = this.charBuilds[calcTargetId]!;
        const newResult = build.getDamageResult(
          formulaId,
          newStats[calcTargetId]!,
          Object.values(newStats),
          ctx
        );
        charGains[key] = (newResult.totalDamage - baseDamage) / baseDamage;
      }
      gains[calcTargetId] = charGains;
    }

    // For teammates: check inputKeys of their scaling buffs that affect calc target
    for (const [cid, cb] of Object.entries(this.charBuilds)) {
      if (cid === calcTargetId) continue;
      const relevantKeys = new Set<StatKey>();
      for (const buff of cb.getAllBuffs()) {
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
          const inputKey = (buff as { inputKey: StatKey }).inputKey;
          relevantKeys.add(inputKey);
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
        const delta = AVG_SUBSTAT_ROLL[key];
        if (!delta) continue;
        const tweaked = { ...artifactStats };
        tweaked[cid] = (artifactStats[cid] ?? new StatSheet([])).withDelta(
          key,
          delta
        );
        const newStats = this.getTeamStats(tweaked, calcTargetId);
        const build = this.charBuilds[calcTargetId]!;
        const newResult = build.getDamageResult(
          formulaId,
          newStats[calcTargetId]!,
          Object.values(newStats),
          ctx
        );
        charGains[key] = (newResult.totalDamage - baseDamage) / baseDamage;
      }
      if (Object.keys(charGains).length > 0) {
        gains[cid] = charGains;
      }
    }

    return gains;
  }
}
