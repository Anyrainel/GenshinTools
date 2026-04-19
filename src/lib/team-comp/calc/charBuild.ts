import type { I18nLabel, OptionMap, StatEntry, TeamSlotConfig } from "../types";
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
import type { StatBuff } from "./statBuff";
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
    this.baseStatSheet = new StatSheet(baseEntries);
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
