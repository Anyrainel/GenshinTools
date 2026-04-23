import type { StatEntry } from "@/data/types";
import type {
  ComboTemplate,
  FormulaEntry,
  I18nLabel,
  OptionMap,
  TeamSlotConfig,
} from "../types";
import { getHalfSetIds } from "../utils";
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
 * - charLevel, constellation, getFormulaIds(), getBespokeBuffs(), etc.
 *
 * Stat pipeline (pre → mid �� post) is owned by TeamStatSheet.
 */
export class CharBuild {
  /** @internal — use getters for external access. */
  private readonly _charBase: CharacterBase;
  /** @internal — use getAllBuffs() for external access. */
  private readonly _weaponBase: WeaponBase;
  private readonly _artifactSetBase: ArtifactSetBase | null;
  private readonly _artifactHalfSetBases: ArtifactHalfSetBase[];
  private readonly resonanceBuffs: StatBuff[] = [];
  /** Phase 1 baseline: character + weapon + artifact set bonuses, BEFORE static buffs. */
  readonly baseStatSheet: StatSheet;

  constructor(
    config: TeamSlotConfig,
    teamMeta: TeamMeta,
    combatOpts: OptionMap = {}
  ) {
    this._charBase = createCharacter(
      config.charId,
      config.charLevel,
      config.constellation,
      teamMeta,
      combatOpts,
      config.talentLevels
    );
    this._weaponBase = createWeapon(
      config.weaponId,
      config.refinement,
      config.charId,
      teamMeta,
      combatOpts
    );
    this._artifactSetBase =
      config.artifactSet?.type === "4pc"
        ? createArtifactSet(
            config.artifactSet.setId,
            config.charId,
            teamMeta,
            combatOpts
          )
        : null;

    // Auto-include the 2pc half-set when using a 4pc set (if the set declares one)
    const auto2pcId = this._artifactSetBase?.halfSetId ?? null;
    const auto2pc = auto2pcId
      ? createArtifactHalfSet(auto2pcId, config.charId, teamMeta)
      : null;

    this._artifactHalfSetBases = [
      ...(auto2pc ? [auto2pc] : []),
      ...getHalfSetIds(config.artifactSet).map((id) =>
        createArtifactHalfSet(id, config.charId, teamMeta)
      ),
    ];

    this.resonanceBuffs.push(
      ...buildGleamResonanceBuffs(config.charId, teamMeta)
    );

    // Phase 1: Assemble base stats from character + weapon + artifact set 2pc bonuses
    const baseEntries: StatEntry[] = [
      ...this._charBase.stats,
      ...this._weaponBase.stats,
      ...(this._artifactSetBase?.stats ?? []),
      ...this._artifactHalfSetBases.flatMap((h) => h.stats),
    ];
    this.baseStatSheet = new StatSheet(baseEntries);
  }

  /** @internal — Access the raw CharacterBase for TeamReaction construction.
   *  External callers should use the public getters instead. */
  get charBase(): CharacterBase {
    return this._charBase;
  }

  /** @internal — Access the raw WeaponBase for constraintChecker.
   *  External callers should use getWeaponBuffs() instead. */
  get weaponBase(): WeaponBase {
    return this._weaponBase;
  }

  /** Character's constellation level. */
  get constellation(): number {
    return this._charBase.constellation;
  }

  /** All formula entries from this character's formulaMap (for catalog construction). */
  get allFormulaEntries(): Record<string, FormulaEntry> {
    return this._charBase.allFormulaEntries;
  }

  /** Resolved combo descriptor (internal, for catalog use only). */
  get comboDescriptor(): ComboTemplate {
    return this._charBase.rawComboDescriptor;
  }

  /** Resolved combo counts at construction-time constellation. */
  get combo(): Record<string, number> {
    return this._charBase.combo;
  }

  /** Returns all bespoke buffs across all formula parts, for display in BuffLedger. */
  getBespokeBuffs(): {
    formulaId: string;
    label: I18nLabel;
    buff: StatBuff;
  }[] {
    return this._charBase.getBespokeBuffs();
  }

  /**
   * Collect all buffs from this build's providers, filtering out no-ops.
   *
   * WARNING: Returns a fresh array with fresh object references on each call.
   * Some providers use `get buffs()` getters that create new StatBuff
   * instances per invocation. Do NOT compare objects from separate calls
   * via Set.has() or ===. For stable references, use TeamBuild.buffLedger.allBuffs
   * which is populated once at construction time.
   */
  getAllBuffs(): StatBuff[] {
    return [
      ...this.resonanceBuffs,
      ...this._charBase.buffs,
      ...this._weaponBase.buffs,
      ...(this._artifactSetBase?.buffs ?? []),
      ...this._artifactHalfSetBases.flatMap((h) => h.buffs),
    ].filter((b) => !b.isNoOp);
  }

  /**
   * Character buffs only (no weapon/artifact).
   * Used by constraintChecker for scaling buff estimation.
   */
  getCharBuffs(): StatBuff[] {
    return this._charBase.buffs;
  }

  /**
   * Weapon buffs only (no character/artifact).
   * Used by constraintChecker for scaling buff estimation.
   */
  getWeaponBuffs(): StatBuff[] {
    return this._weaponBase.buffs;
  }

  getFormulaIds(): Record<string, I18nLabel> {
    return this._charBase.formulaIds;
  }

  /** All formula IDs including constellation-locked ones, with minC/enabled info. */
  getAllFormulaIds(): Record<
    string,
    { label: I18nLabel; minC: number; enabled: boolean }
  > {
    return this._charBase.allFormulaIds;
  }
}
