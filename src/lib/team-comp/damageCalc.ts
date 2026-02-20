import type { Element } from "@/data/types";

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
import type {
  CalcContext,
  CharCompConfig,
  CombatOpts,
  DamageResult,
  I18nLabel,
  StatEntry,
} from "./types";

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
    const src = { type: "teamResonance" as const, id: "resonance" };

    const elemCounts = new Map<Element, number>();
    for (const el of Object.values(teamMeta.elements)) {
      elemCounts.set(el, (elemCounts.get(el) ?? 0) + 1);
    }
    const uniqueElements = elemCounts.size;

    // Pyro 2+: ATK +25%
    if ((elemCounts.get("Pyro") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(src, { receiver: "team" }, [{ key: "atk%", value: 0.25 }])
      );
    }

    // Hydro 2+: HP +25%
    if ((elemCounts.get("Hydro") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(src, { receiver: "team" }, [{ key: "hp%", value: 0.25 }])
      );
    }

    // Cryo 2+: CR +15% against Cryo-affected/Frozen (assume active)
    if ((elemCounts.get("Cryo") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(src, { receiver: "team" }, [{ key: "cr", value: 0.15 }])
      );
    }

    // Geo 2+: DMG +15% when shielded (assume active)
    if ((elemCounts.get("Geo") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(src, { receiver: "team" }, [{ key: "dmg%", value: 0.15 }])
      );
    }

    // Dendro 2+: EM +50 (base), +30 after Burning/Quicken/Bloom (assume active: total EM +80)
    if ((elemCounts.get("Dendro") ?? 0) >= 2) {
      buffs.push(
        new StatBuff(src, { receiver: "team" }, [{ key: "em", value: 80 }])
      );
    }

    // 4 unique elements: All RES +15%, EM +50 (Nod-Krai universal resonance)
    if (uniqueElements >= 4) {
      buffs.push(
        new StatBuff(src, { receiver: "team" }, [{ key: "em", value: 50 }])
      );
    }

    // Electro 2+ and Anemo 2+: no directly modellable damage bonuses
    // (energy particles, stamina, movement speed, cooldown reduction are out of scope)

    this.buffs = buffs;
  }
}

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
      ? createArtifactSet(config.artifactSetId, config.charId, teamMeta)
      : null;
    this.artifactHalfSetBases = config.artifactHalfSetIds.map((id) =>
      createArtifactHalfSet(id, config.charId, teamMeta)
    );

    // Phase 1: Assemble base stats from character + weapon
    const baseEntries: StatEntry[] = [
      ...this.charBase.stats,
      ...this.weaponBase.stats,
    ];
    this.innerStatSheet = new StatSheet(baseEntries);
  }

  /** Collect all buffs from this build's providers */
  getAllBuffs(): StatBuff[] {
    return [
      ...this.charBase.buffs,
      ...this.weaponBase.buffs,
      ...(this.artifactSetBase?.buffs ?? []),
      ...this.artifactHalfSetBases.flatMap((h) => h.buffs),
    ];
  }

  /**
   * Apply target-independent static buffs (self, selfOffField, team).
   * Called once during TeamBuild construction.
   * Target-dependent buffs (onField, selfOnField) are deferred to getTeamStats.
   */
  applyStaticBuffs(teamStaticBuffs: StatBuff[], selfCharId: string): void {
    const applicable = teamStaticBuffs.filter((b) =>
      isBuffApplicable(b, selfCharId, null)
    );
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
    return merged.apply(targetDependentBuffs);
  }

  /** Collect this build's dynamic buffs, evaluated against pre-stats */
  getDynamicBuffs(
    selfPreStats: StatSheet,
    teamPreStats: StatSheet[]
  ): StatBuff[] {
    return this.getAllBuffs().filter(
      (b) => b.dynamicBuffs(selfPreStats, teamPreStats).length > 0
    );
  }

  /**
   * Apply dynamic buffs to pre-stats → post-stats.
   * Evaluates all applicable dynamic buffs.
   */
  getPostStats(
    selfPreStats: StatSheet,
    teamDynamicBuffs: StatBuff[],
    selfCharId: string,
    calcTargetId: string,
    teamPreStats: StatSheet[]
  ): StatSheet {
    const applicable = teamDynamicBuffs.filter((b) =>
      isBuffApplicable(b, selfCharId, calcTargetId)
    );
    return selfPreStats.applyDynamic(applicable, selfPreStats, teamPreStats);
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
}

/**
 * Determine whether a buff applies to a given character's stat sheet.
 *
 * @param buff        The buff to check
 * @param selfCharId  The character whose stat sheet we're building
 * @param calcTargetId The character being optimized (on-field).
 *                     null = target-independent filtering only (construction phase).
 */
function isBuffApplicable(
  buff: StatBuff,
  selfCharId: string,
  calcTargetId: string | null
): boolean {
  const receiver = buff.target.receiver;
  const buffOwnerId = buff.source.id;

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
  private readonly allStaticBuffs: StatBuff[];

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
    this.allStaticBuffs = [
      ...this.teamResonance.buffs,
      ...Object.values(this.charBuilds).flatMap((b) => b.getAllBuffs()),
    ];

    // Apply target-independent static buffs (self, selfOffField, team) at construction.
    // Target-dependent buffs (onField, selfOnField) are deferred to getTeamStats.
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      build.applyStaticBuffs(this.allStaticBuffs, charId);
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
      targetDependent[charId] = this.allStaticBuffs.filter((b) => {
        const r = b.target.receiver;
        if (r !== "onField" && r !== "selfOnField") return false;
        return isBuffApplicable(b, charId, calcTargetId);
      });
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
    const allDynamicBuffs: StatBuff[] = [];
    for (const [id, build] of Object.entries(this.charBuilds)) {
      allDynamicBuffs.push(
        ...build.getDynamicBuffs(preStats[id]!, teamPreStatsArr)
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
        teamPreStatsArr
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
}
