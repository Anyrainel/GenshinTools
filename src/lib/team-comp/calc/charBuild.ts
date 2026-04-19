import type { Faction, Region } from "@/data/types";
import type {
  I18nLabel,
  OptionMap,
  ProvidedStaticBuff,
  StatEntry,
  TeamSlotConfig,
} from "../types";
import { isFieldDependentReceiver } from "./fieldState";
import type {
  ArtifactHalfSetBase,
  ArtifactSetBase,
  CharacterBase,
  WeaponBase,
} from "./implModel";
import {
  createArtifactHalfSet,
  createArtifactSet,
  createCharacter,
  createWeapon,
} from "./registry";
import {
  type StatBuff,
  deduplicateBuffs,
  getBuffInstanceKey,
  isBuffApplicable,
} from "./statBuff";
import { StatSheet } from "./statSheet";
import type { TeamMeta } from "./teamMeta";
import { buildGleamResonanceBuffs } from "./teamResonance";

/**
 * Composes a single character's build:
 * character + weapon + artifact sets → stats + buffs + formulas.
 *
 * Provides:
 * - baseStatSheet: Phase 1 baseline (character + weapon + artifact set bonuses)
 * - getAllBuffs(): all static buffs from this build's providers
 * - charBase: character data, formula entries, talent levels
 *
 * Stat pipeline (pre → mid → post) is owned by TeamStatSheet.
 */
export class CharBuild {
  readonly charBase: CharacterBase;
  readonly weaponBase: WeaponBase;
  readonly artifactSetBase: ArtifactSetBase | null;
  readonly artifactHalfSetBases: ArtifactHalfSetBase[];
  private readonly resonanceBuffs: StatBuff[] = [];
  /** Phase 1 baseline: character + weapon + artifact set bonuses, BEFORE static buffs. */
  readonly baseStatSheet: StatSheet;
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
      combatOpts,
      config.talentLevels
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

    this.resonanceBuffs.push(
      ...buildGleamResonanceBuffs(config.charId, teamMeta)
    );

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
   * Merge with artifact stats + apply target-dependent static buffs.
   * Returns "pre-stats": after base + all static buffs + artifacts, before dynamic.
   */
  getPreStats(
    artifactStats: StatSheet,
    targetDependentBuffs: ProvidedStaticBuff[]
  ): StatSheet {
    const merged = this.innerStatSheet.merge(artifactStats);
    if (targetDependentBuffs.length === 0) return merged;
    const applicable = deduplicateBuffs(
      targetDependentBuffs.map((b) => b.buff),
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
    targetDependentBuffs: ProvidedStaticBuff[],
    allStaticBuffs: ProvidedStaticBuff[],
    excludeKeys: Set<string>,
    selfCharId: string,
    selfRegion?: Region,
    selfFaction?: Faction
  ): StatSheet {
    let sheet = this.rebuildBaseExcluding(
      artifactStats,
      allStaticBuffs,
      excludeKeys,
      selfCharId,
      selfRegion,
      selfFaction
    );

    if (targetDependentBuffs.length > 0) {
      const filteredTD = targetDependentBuffs.filter(
        (b) => !excludeKeys.has(getBuffInstanceKey(b.buff, b.providerCharId))
      );
      if (filteredTD.length > 0) {
        const deduped = deduplicateBuffs(
          filteredTD.map((b) => b.buff),
          (b) => b.staticBuffs
        );
        sheet = sheet.apply(deduped);
      }
    }

    return sheet;
  }

  /**
   * Shared base rebuild: re-apply target-independent static buffs (excluding
   * specified keys) from Phase 1 baseline, then merge artifact stats.
   */
  private rebuildBaseExcluding(
    artifactStats: StatSheet,
    allStaticBuffs: ProvidedStaticBuff[],
    excludeKeys: Set<string>,
    selfCharId: string,
    selfRegion?: Region,
    selfFaction?: Faction
  ): StatSheet {
    let applicable = allStaticBuffs
      .filter((b) => {
        if (excludeKeys.has(getBuffInstanceKey(b.buff, b.providerCharId)))
          return false;
        if (isFieldDependentReceiver(b.buff.target.receiver)) return false;
        return isBuffApplicable(
          b.buff,
          b.providerCharId,
          selfCharId,
          false,
          selfRegion,
          selfFaction
        );
      })
      .map((b) => b.buff);
    applicable = deduplicateBuffs(applicable, (b) => b.staticBuffs);
    return this.baseStatSheet.apply(applicable).merge(artifactStats);
  }

  getFormulaIds(): Record<string, I18nLabel> {
    return this.charBase.formulaIds;
  }

  /** All formula IDs including constellation-locked ones, with minC/enabled info. */
  getAllFormulaIds(): Record<
    string,
    { label: I18nLabel; minC: number; enabled: boolean }
  > {
    return this.charBase.allFormulaIds;
  }
}
