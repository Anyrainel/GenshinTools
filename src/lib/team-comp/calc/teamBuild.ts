import type { Element } from "@/data/types";
import { getNextLevelTier } from "@/lib/gameStatsLoader";
import {
  type BuffActivationMap,
  type CalcContext,
  type ComboFormula,
  type ComboLine,
  type ComboResult,
  type DamageResult,
  type DamageTag,
  type DisplayPart,
  type DisplayResult,
  type ExtraBuff,
  type FormulaEntry,
  type OptionMap,
  type ProvidedStaticBuff,
  type ReactionOverride,
  type ResolvedBuff,
  type ResolvedStatEntry,
  type StatEntry,
  type StatKey,
  type TeamSlotConfig,
  filterMatchesTag,
} from "../types";
import { CharBuild } from "./charBuild";
import {
  type EvaluatedDynamicBuff,
  annotateScalingInfo,
  isDeferredFinalBuff,
} from "./dynamicBuffEval";
import { fieldReq } from "./fieldState";
import {
  getDefaultOnFieldCharId,
  isPartOffField,
  resolvePartOnFieldCharIds,
} from "./fieldState";
import type { CharacterBase } from "./implModel";
import { computeSubstatMarginals } from "./marginalGain";
import {
  type ComboLineEval,
  type FormulaPartEval,
  type StackLimitedBuffInfo,
  buildUserOverrideInfos,
  collectStackLimitedBuffs,
  computeBlendedDamage,
  computeComboDefaultActivation,
  computeDefaultActivation,
  evaluateFormulaDamage,
  evaluateFormulaDisplay,
} from "./stackRank";
import {
  CrossScalingBuff,
  ScalingBuff,
  type StatBuff,
  TeamAggregationBuff,
  deduplicateBuffs,
  getBuffInstanceKey,
  isBuffApplicable,
} from "./statBuff";
import { bespokeMaxStacks, buildBespokeOverlay } from "./statSheet";
import { StatSheet } from "./statSheet";
import { TeamFormulaCatalog } from "./teamFormulaCatalog";
import { TeamMeta } from "./teamMeta";
import { TeamReaction } from "./teamReaction";
export { TeamFormulaCatalog } from "./teamFormulaCatalog";
import { TeamResonance } from "./teamResonance";
import { TeamStatSheet } from "./teamStatSheet";

/** Widen min/max range on resolved dynamic entries using alternate values. */
function widenDynamicRange(
  entries: ResolvedStatEntry[],
  altValues: readonly StatEntry[]
): void {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const alt = altValues[i];
    if (!alt || e.key !== alt.key) continue;
    const curMin = e.minValue ?? e.value;
    const curMax = e.maxValue ?? e.value;
    const newMin = Math.min(curMin, alt.value);
    const newMax = Math.max(curMax, alt.value);
    if (newMin !== newMax) {
      e.minValue = newMin;
      e.maxValue = newMax;
    }
  }
}

/** Widen min/max range on a ResolvedBuff's dynamic entries from another context. */
function mergeBuffDynamicRange(
  existing: ResolvedBuff,
  incoming: ResolvedBuff
): void {
  widenDynamicRange(existing.dynamicEntries, incoming.dynamicEntries);
}

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
  readonly teamStats: TeamStatSheet;
  /** Team-wide reaction formula provider (transformative + lunar). */
  readonly reactionProvider: TeamReaction;
  /** Original configs used to construct this TeamBuild (for reconstruction). */
  readonly configs: TeamSlotConfig[];
  /** Original combat opts used to construct this TeamBuild (for reconstruction). */
  readonly combatOpts: OptionMap;
  /** Enemy persistent element aura (for reconstruction). */
  readonly enemyAura?: Element;
  /** Extra buffs (food/env/status/custom) applied to stat sheets. */
  readonly extraBuffs: ExtraBuff[];
  /** Enemy context used for baseline lunar rank computation. */
  readonly baselineCtx: CalcContext;
  /** Formula catalog: flat index, formula queries, and reaction provider. */
  readonly catalog: TeamFormulaCatalog;
  /** Flat index of all formula entries (character + reaction), keyed by formula ID. */
  readonly formulaIndex: Map<string, FormulaEntry>;

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
    cachedCharBuilds?: Record<string, CharBuild>,
    /**
     * Enemy context used for baseline lunar rank computation. Only the
     * relative damage between contributors matters for ranking, but using
     * the caller's actual ctx keeps results consistent across paths.
     */
    baselineCtx?: Partial<CalcContext>
  ) {
    this.configs = configs;
    this.combatOpts = combatOpts;
    this.enemyAura = enemyAura;
    this.extraBuffs = extraBuffs;
    this.baselineCtx = {
      enemyLevel: baselineCtx?.enemyLevel ?? 110,
      enemyRes: baselineCtx?.enemyRes ?? 0.1,
      rollMultiplier: baselineCtx?.rollMultiplier ?? 0.85,
      substatBudget: baselineCtx?.substatBudget ?? "8_6",
    };
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

    // TeamStatSheet owns allStaticBuffs and the stat pipeline
    this.teamStats = new TeamStatSheet(
      this.charBuilds,
      this.teamResonance,
      extraBuffs,
      this.teamMeta,
      configs,
      configs.map((c) => c.charId)
    );

    // Build team-wide reaction formulas after CharBuilds are constructed
    const charBases: Record<string, CharacterBase> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      charBases[id] = build.charBase;
    }
    this.reactionProvider = new TeamReaction(this.teamMeta, charBases, configs);

    // Pre-compute rank weights and N-part entries for multi-contributor lunar
    // formulas using baseline stats (no artifacts) so ranking is deterministic.
    {
      const emptySheet = new StatSheet([]);
      const emptySheets: Record<string, StatSheet> = {};
      for (const c of configs) emptySheets[c.charId] = emptySheet;
      const baselineStats = this.getTeamStats(emptySheets, configs[0].charId);
      const charLevels: Record<string, number> = {};
      for (const c of configs) charLevels[c.charId] = c.charLevel;
      this.reactionProvider.finalizeMultiContributorEntries(
        baselineStats,
        charLevels,
        this.baselineCtx
      );
    }

    // Build catalog (owns formulaIndex + formula-metadata queries)
    this.catalog = new TeamFormulaCatalog(
      this.charBuilds,
      this.reactionProvider
    );
    this.formulaIndex = this.catalog.formulaIndex;
  }

  get allStaticBuffs(): ProvidedStaticBuff[] {
    return this.teamStats.allStaticBuffs;
  }

  // ─── Centralized buff applicability helpers ──────────────────────────────
  /** isBuffApplicable with automatic teamMeta region/faction lookup. */
  private isBuffApplicableForChar(
    buff: StatBuff,
    providerCharId: string,
    selfCharId: string,
    selfIsOnField: boolean
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
   * Does this buff apply to ANY team member in either field state?
   *
   * Used as a display pre-filter in resolveBuffs, which shows buffs for a
   * formula that may contain both on-field and off-field parts. Intentionally
   * permissive — Layer 2.5 (fieldReq vs partOffField) narrows per-part.
   */
  private isBuffApplicableForTeam(
    buff: StatBuff,
    providerCharId: string
  ): boolean {
    for (const cid of Object.keys(this.charBuilds)) {
      if (this.couldBuffApplyToChar(buff, providerCharId, cid)) return true;
    }
    return false;
  }

  /**
   * Does this buff apply to a specific character in EITHER field state?
   *
   * Use this (not `isBuffApplicableForChar(..., true)`) whenever the caller
   * only knows the carry/line char and does NOT know the field state of each
   * formula part. Hardcoding `selfIsOnField=true` silently drops buffs whose
   * receiver is selfOffField/otherOffField/teamOffField, even when the formula
   * contains off-field parts that should receive them. Layer 2.5
   * (fieldReq vs partOffField) narrows correctly per-part later.
   */
  private couldBuffApplyToChar(
    buff: StatBuff,
    providerCharId: string,
    selfCharId: string
  ): boolean {
    return (
      this.isBuffApplicableForChar(
        buff,
        providerCharId,
        selfCharId,
        true /* on-field */
      ) ||
      this.isBuffApplicableForChar(
        buff,
        providerCharId,
        selfCharId,
        false /* off-field */
      )
    );
  }

  // ─── Team stat computation ──────────────────────────────────────────────
  /**
   * Compute final stat sheets for all team members.
   * This is the hot path during artifact optimization.
   *
   * @param artifactStats  Per-character artifact stat sheets
   * @param onFieldCharId   Who is on-field (determines onField buff routing).
   */
  getTeamStats(
    artifactStats: Record<string, StatSheet>,
    onFieldCharId: string,
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    this.teamStats.setArtifacts(artifactStats, ctx);
    return this.teamStats.getAllPostStats(onFieldCharId);
  }

  /**
   * Compute final stat sheets excluding the specified buffs.
   * Rebuilds from Phase 1 baseline for each character, skipping excluded buffs
   * in both the static and dynamic buff application phases.
   */
  getTeamStatsExcluding(
    artifactStats: Record<string, StatSheet>,
    onFieldCharId: string,
    ctx: CalcContext | undefined,
    excludeKeys: Set<string>
  ): Record<string, StatSheet> {
    this.teamStats.setArtifacts(artifactStats, ctx);
    return this.teamStats.getAllPostStats(onFieldCharId, excludeKeys);
  }

  /**
   * Build pre-resolved FormulaPartEval[] for a formula's parts.
   * Uses resolvePartOnFieldCharIds to determine the correct stats per part.
   */
  private buildPartEvals(
    charId: string,
    entry: FormulaEntry,
    sheets: Record<string, StatSheet>,
    ctx: CalcContext,
    forceOnField?: boolean
  ): FormulaPartEval[] {
    const charLevel = this.charBuilds[charId]!.charBase.charLevel;
    const onFieldCharIds = resolvePartOnFieldCharIds(
      entry.parts,
      charId,
      this.configs,
      forceOnField
    );

    const statsCache = new Map<string, Record<string, StatSheet>>();
    const getStatsFor = (onFieldId: string) => {
      let s = statsCache.get(onFieldId);
      if (!s) {
        s = this.getTeamStats(sheets, onFieldId, ctx);
        statsCache.set(onFieldId, s);
      }
      return s;
    };

    return entry.parts.map((part, i) => ({
      formula: part.formula,
      stats: getStatsFor(onFieldCharIds[i])[charId]!,
      charLevel,
      hits: part.hits ?? 1,
    }));
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

  // ─── Delegation methods to catalog (backward compat) ────────────────────
  getFormulaIds() {
    return this.catalog.getFormulaIds();
  }
  getAllFormulaIds() {
    return this.catalog.getAllFormulaIds();
  }
  getReactionFormulaIds() {
    return this.catalog.getReactionFormulaIds();
  }
  getCombo(charId: string) {
    return this.catalog.getCombo(charId);
  }
  getComboDescriptor(charId: string) {
    return this.catalog.getComboDescriptor(charId);
  }
  getReactionComboLines() {
    return this.catalog.getReactionComboLines();
  }
  offFieldStatus(charId: string, formulaId: string) {
    return this.catalog.offFieldStatus(charId, formulaId);
  }
  hasOffFieldParts(charId: string, formulaId: string) {
    return this.catalog.hasOffFieldParts(charId, formulaId);
  }

  /**
   * Evaluate a combo formula: weighted sum of multiple formula lines,
   * potentially from different characters with different reaction overrides.
   *
   * Groups lines by on-field character and caches getTeamStats() per unique
   * onFieldCharId for efficiency (typically 1-2 unique on-field characters).
   */
  getComboDamageResult(
    combo: ComboFormula,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    /** Per-line BuffActivationMap, keyed by line index in validLines. */
    buffOverrides?: Record<number, BuffActivationMap>
  ): ComboResult {
    // Skip lines with zero count or whose formula no longer exists
    const validLines = combo.lines.filter((line) => {
      if (line.count <= 0) return false;
      return this.formulaIndex.has(line.formulaId);
    });

    this.teamStats.setArtifacts(artifactStats, ctx);

    const lineDamages = validLines.map((line, lineIdx) => {
      const cb = this.charBuilds[line.charId];
      const entry =
        cb?.charBase.getFormulaEntry(line.formulaId) ??
        this.formulaIndex.get(line.formulaId);
      const statsCharId = entry?.parts[0]?.statsCharId ?? line.charId;
      const ownerCharId = entry?.owner ?? line.charId;

      const effectiveReaction = line.reaction;
      const lineInfos = buffOverrides?.[lineIdx];

      const formulaOwner =
        ownerCharId !== statsCharId ? ownerCharId : undefined;
      const result = this.getDamageResult(
        statsCharId,
        line.formulaId,
        ctx,
        effectiveReaction,
        lineInfos,
        formulaOwner,
        line.forceOnField
      );

      // Adjust for bespokeBuff maxStacks across combo repetitions
      let total = result.totalDamage * line.count;
      for (const part of result.parts) {
        if (part.bespokeInfo) {
          const totalHits = part.hits * line.count;
          const buffedHits = Math.min(part.bespokeInfo.maxStacks, totalHits);
          const unbuffedHits = totalHits - buffedHits;
          total -= part.damage * part.hits * line.count;
          total +=
            part.damage * buffedHits +
            part.bespokeInfo.unbuffedDamage * unbuffedHits;
        }
      }

      return {
        perHit: result.totalDamage,
        total,
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
   *
   * This is THE primary display interface. Single-formula display is just a
   * 1-line combo internally.
   */
  getComboDisplayResult(
    combo: ComboFormula,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    buffOverrides?: Record<number, BuffActivationMap>
  ): DisplayResult {
    // Skip lines whose formula no longer exists
    const allFormulas = this.getFormulaIds();
    const reactionFormulas = this.reactionProvider.getFormulaIds();
    const activeLines = combo.lines.filter((l) => {
      if (l.count <= 0) return false;
      if (l.formulaId.startsWith("rx-")) {
        return reactionFormulas[l.formulaId] !== undefined;
      }
      const charFormulas = allFormulas[l.charId];
      return charFormulas?.[l.formulaId];
    });

    const allCharIds = Object.keys(this.charBuilds);

    this.teamStats.setArtifacts(artifactStats, ctx);

    const charFormulaTags = this.catalog.collectCharFormulaTags();

    // ── Raw StatSheets with on/off field contexts ──
    const statSheets: Record<
      string,
      { onField: StatSheet; offField: StatSheet }
    > = {};
    for (const cid of allCharIds) {
      const onField = this.teamStats.getPostStats(cid, cid);
      const defaultOnFieldCharId = this.teamStats.getDefaultOnFieldCharId(cid);
      const offField = this.teamStats.getPostStats(cid, defaultOnFieldCharId);
      statSheets[cid] = { onField, offField };
    }

    // ── Base combo damage ──
    const baseResult = this.getComboDamageResult(
      { ...combo, lines: activeLines },
      artifactStats,
      ctx,
      buffOverrides
    );
    const baseDamage = baseResult.totalDamage;
    const fullBuffBaseDamage = buffOverrides
      ? this.getComboDamageResult(
          { ...combo, lines: activeLines },
          artifactStats,
          ctx
        ).totalDamage
      : baseDamage;

    // ── Marginal gains ──
    const marginalGains: Record<string, Partial<Record<StatKey, number>>> = {};

    if (fullBuffBaseDamage > 0) {
      const comboConfig = { ...combo, lines: activeLines };
      const evalFn = (sheets: Record<string, StatSheet>): number =>
        this.getComboDamageResult(comboConfig, sheets, ctx).totalDamage;

      const deltas = computeSubstatMarginals(
        evalFn,
        artifactStats,
        fullBuffBaseDamage,
        allCharIds
      );

      for (const [cid, charDeltas] of Object.entries(deltas)) {
        const charGains: Partial<Record<StatKey, number>> = {};
        for (const [key, delta] of Object.entries(charDeltas)) {
          charGains[key as StatKey] = delta / fullBuffBaseDamage;
        }
        marginalGains[cid] = charGains;
      }
    }

    // ── Intrinsic saturation detection ──
    const intrinsicSaturatedCharIds: string[] = [];
    {
      const zeroGainCharIds = allCharIds.filter(
        (cid) =>
          !marginalGains[cid] || Object.keys(marginalGains[cid]).length === 0
      );
      if (zeroGainCharIds.length > 0 && fullBuffBaseDamage > 0) {
        const comboConfig = { ...combo, lines: activeLines };
        const evalFn = (sheets: Record<string, StatSheet>): number =>
          this.getComboDamageResult(comboConfig, sheets, ctx).totalDamage;
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
    // Use resolveFormulaBuffs (lightweight) instead of getDisplayResult.
    const buffMap = new Map<string, ResolvedBuff>();

    const seenFormulas = new Set<string>();
    for (const line of activeLines) {
      if (line.formulaId.startsWith("rx-")) continue;
      const fKey = `${line.charId}.${line.formulaId}`;
      if (seenFormulas.has(fKey)) continue;
      seenFormulas.add(fKey);

      try {
        const buffs = this.resolveFormulaBuffs(
          line.charId,
          line.formulaId,
          artifactStats,
          ctx,
          line.reaction,
          line.forceOnField
        );

        for (const buff of buffs) {
          const existing = buffMap.get(buff.buffKey);
          if (!existing) {
            buffMap.set(buff.buffKey, buff);
          } else if (buff.active && !existing.active) {
            buffMap.set(buff.buffKey, buff);
          } else if (
            buff.active &&
            existing.active &&
            buff.dynamicEntries.length > 0
          ) {
            mergeBuffDynamicRange(existing, buff);
          }
        }
      } catch (e) {
        console.warn(
          `[TeamBuild] buff collection failed for ${line.charId}/${line.formulaId}:`,
          e
        );
      }
    }

    const buffs = Array.from(buffMap.values());

    // ── Level-up gains ──
    const levelUpGains: Record<
      string,
      { gain: number; from: number; to: number }[]
    > =
      fullBuffBaseDamage > 0
        ? this.iterateLevelUpGains((charId, targetLevel) => {
            const tweakedConfigs = this.configs.map((c) =>
              c.charId === charId ? { ...c, charLevel: targetLevel } : c
            );
            const tweakedTeam = new TeamBuild(
              tweakedConfigs,
              this.combatOpts,
              this.enemyAura,
              this.extraBuffs
            );
            const newResult = tweakedTeam.getComboDamageResult(
              { ...combo, lines: activeLines },
              artifactStats,
              ctx
            );
            return (
              (newResult.totalDamage - fullBuffBaseDamage) / fullBuffBaseDamage
            );
          })
        : {};

    // ── Per-formula display parts ──
    const partsByFormula: Record<string, DisplayPart[]> = {};

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
      const build = this.charBuilds[charId];

      const firstLine = formulaLines[0].line;
      const effectiveReaction = firstLine.reaction;

      const entry = build
        ? (build.charBase.getFormulaEntry(formulaId) ??
          this.formulaIndex.get(formulaId))
        : this.formulaIndex.get(formulaId);
      if (!entry) continue;

      const entryCharLevel = build
        ? build.charBase.charLevel
        : (this.configs.find((c) => c.charId === charId)?.charLevel ?? 90);
      const formulaHasOffField = entry.parts.some((p) =>
        isPartOffField(p, firstLine.forceOnField)
      );
      const defaultOnFieldCharId = formulaHasOffField
        ? this.teamStats.getDefaultOnFieldCharId(charId)
        : charId;

      const { parts } = evaluateFormulaDisplay(
        entry,
        charId,
        this.teamStats,
        ctx,
        effectiveReaction,
        firstLine.forceOnField
      );

      const totalComboCount = formulaLines.reduce(
        (sum, fl) => sum + fl.line.count,
        0
      );
      const hasLinePartialBuffs = formulaLines.some((fl) => {
        const ov = buffOverrides?.[fl.lineIdx];
        return ov && Object.keys(ov).length > 0;
      });

      if (hasLinePartialBuffs && entry) {
        const buffAgg = new Map<string, Record<number, number>>();
        for (const fl of formulaLines) {
          const lineActivation = buffOverrides?.[fl.lineIdx];
          if (!lineActivation) continue;
          for (const [buffKey, partMap] of Object.entries(lineActivation)) {
            let agg = buffAgg.get(buffKey);
            if (!agg) {
              agg = {};
              buffAgg.set(buffKey, agg);
            }
            for (const [pidxStr, activated] of Object.entries(partMap)) {
              const pidx = Number(pidxStr);
              agg[pidx] =
                (agg[pidx] ?? 0) + (activated as number) * fl.line.count;
            }
          }
        }

        const aggregatedActivation: BuffActivationMap = {};
        for (const [buffKey, partAgg] of buffAgg) {
          const perCastActivation: Record<number, number> = {};
          for (const [pidxStr, totalActivated] of Object.entries(partAgg)) {
            perCastActivation[Number(pidxStr)] =
              totalActivated / totalComboCount;
          }
          aggregatedActivation[buffKey] = perCastActivation;
        }

        if (Object.keys(aggregatedActivation).length > 0) {
          const blended = computeBlendedDamage(
            entry.parts,
            aggregatedActivation,
            charId,
            this.teamStats,
            ctx
          );

          for (let i = 0; i < parts.length; i++) {
            const eidx = parts[i].sourcePartIndex ?? i;
            if (!blended.partDamages[eidx]) continue;

            const zeroBuffKeys = new Set<string>();
            if (eidx < entry.parts.length) {
              const h = entry.parts[eidx].hits ?? 1;
              for (const [bKey, partMap] of Object.entries(
                aggregatedActivation
              )) {
                if ((partMap[eidx] ?? h) === 0) {
                  zeroBuffKeys.add(bKey);
                }
              }
            }

            if (zeroBuffKeys.size > 0 && eidx < entry.parts.length) {
              const {
                formula,
                offField,
                bespokeBuffs: bBuffs,
              } = entry.parts[eidx];
              const baseVariant = offField
                ? this.teamStats.getPostStats(
                    charId,
                    defaultOnFieldCharId,
                    zeroBuffKeys
                  )
                : this.teamStats.getPostStats(charId, charId, zeroBuffKeys);
              const displayStats = bBuffs?.length
                ? baseVariant.merge(
                    buildBespokeOverlay(bBuffs, baseVariant, [])
                  )
                : baseVariant;
              const rebuilt = formula.displayFull(
                displayStats,
                entryCharLevel,
                ctx
              );
              const blendedDmg = blended.partDamages[eidx].damage;
              const unblendedDmg = rebuilt.damage;
              parts[i] = {
                ...rebuilt,
                hits: parts[i].hits,
                offField: parts[i].offField,
                damage: blendedDmg,
                ...(blendedDmg < unblendedDmg
                  ? { maxDamage: unblendedDmg }
                  : {}),
                sourcePartIndex: eidx,
              };
            } else {
              const blendedDmg = blended.partDamages[eidx].damage;
              const unblendedDmg = parts[i].damage;
              parts[i] = {
                ...parts[i],
                damage: blendedDmg,
                ...(blendedDmg < unblendedDmg
                  ? { maxDamage: unblendedDmg }
                  : {}),
                sourcePartIndex: eidx,
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

      // Combo-scoped bespoke maxStack split
      if (entry) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const dp = parts[i];
          const eidx = dp.sourcePartIndex;
          if (eidx == null || eidx >= entry.parts.length) continue;
          const { bespokeBuffs: bBuffs } = entry.parts[eidx];
          const bMax = bespokeMaxStacks(bBuffs);
          const partHits = entry.parts[eidx].hits ?? 1;
          const comboTotalHits = partHits * totalComboCount;
          if (bMax == null || bMax >= comboTotalHits) continue;
          const buffedFrac = bMax / comboTotalHits;
          const dpHits = dp.hits ?? 1;
          const buffedHits = Math.round(dpHits * buffedFrac * 1000) / 1000;
          const unbuffedHits = dpHits - buffedHits;
          if (buffedHits > 0 && unbuffedHits > 0) {
            const { formula, offField } = entry.parts[eidx];
            const baseSelfStats = offField
              ? this.teamStats.getPostStats(charId, defaultOnFieldCharId)
              : this.teamStats.getPostStats(charId, charId);
            const dpUnbuffed = formula.displayFull(
              baseSelfStats,
              entryCharLevel,
              ctx
            );
            dpUnbuffed.hits = unbuffedHits;
            dpUnbuffed.sourcePartIndex = eidx;
            if (dp.offField) dpUnbuffed.offField = true;
            parts.splice(i, 1, { ...dp, hits: buffedHits }, dpUnbuffed);
          }
        }
      }

      partsByFormula[formulaKey] = parts;
    }

    // ── Idle stat records (cold path) ──
    this.teamStats.setArtifacts(artifactStats);
    const idleSheets = this.teamStats.getIdleStats();
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

  /** Evaluate a specific character's damage formula with the given team stats.
   *  For cross-scaled formulas (statsCharId override), pass the stats character
   *  as charId and the formula owner as formulaOwnerCharId. */
  getDamageResult(
    charId: string,
    formulaId: string,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    activation?: BuffActivationMap,
    formulaOwnerCharId?: string,
    forceOnField?: boolean
  ): DamageResult {
    const ownerCharId = formulaOwnerCharId ?? charId;
    const build = this.charBuilds[ownerCharId];
    const entry = build
      ? (build.charBase.getFormulaEntry(formulaId) ??
        this.formulaIndex.get(formulaId))
      : this.formulaIndex.get(formulaId);
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);

    return evaluateFormulaDamage(
      entry,
      charId,
      this.teamStats,
      ctx,
      reactionOverride,
      activation,
      forceOnField
    );
  }

  /**
   * Build off-field preStats (and optionally midStats) for ScalingBuff range display.
   * Both resolveFormulaBuffs and getDisplayResult need these to show min~max values
   * when a ScalingBuff provider has different stats on-field vs off-field.
   */
  private buildOffFieldContext(
    charId: string,
    _artifactStats: Record<string, StatSheet>,
    _hasAnyFinalBuffs: boolean
  ): {
    offFieldPreStats: Record<string, StatSheet>;
    offFieldMidStats: Record<string, StatSheet> | undefined;
  } {
    const defaultOnFieldCharId = getDefaultOnFieldCharId(charId, this.configs);
    const offFieldPreStats: Record<string, StatSheet> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      offFieldPreStats[cid] = this.teamStats.getPreStats(
        cid,
        defaultOnFieldCharId
      );
    }
    const offFieldMidStats: Record<string, StatSheet> = {};
    let hasOffMid = false;
    for (const cid of Object.keys(this.charBuilds)) {
      const mid = this.teamStats.getMidStats(cid, defaultOnFieldCharId);
      const pre = offFieldPreStats[cid]!;
      if (mid !== pre) hasOffMid = true;
      offFieldMidStats[cid] = mid;
    }
    return {
      offFieldPreStats,
      offFieldMidStats: hasOffMid ? offFieldMidStats : undefined,
    };
  }

  /**
   * Lightweight buff resolution for a character's formula.
   * Returns ResolvedBuff[] without computing stack allocation, marginal gains,
   * level-up gains, or idle stats. Used by combo display and DamageCard buff
   * applicability where only buff metadata is needed.
   */
  resolveFormulaBuffs(
    charId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    forceOnField?: boolean
  ): ResolvedBuff[] {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);

    this.teamStats.setArtifacts(artifactStats, ctx);

    // Read preStats from TeamStatSheet
    const preStats: Record<string, StatSheet> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      preStats[cid] = this.teamStats.getPreStats(cid, charId);
    }
    const teamPreStatsArr = Object.values(preStats);

    // Read midStats from TeamStatSheet (uses pipeline cache)
    const midStatsRecord: Record<string, StatSheet> = {};
    let hasMidStats = false;
    for (const cid of Object.keys(this.charBuilds)) {
      const mid = this.teamStats.getMidStats(cid, charId);
      const pre = preStats[cid]!;
      if (mid !== pre) hasMidStats = true;
      midStatsRecord[cid] = mid;
    }
    const midStats = hasMidStats ? midStatsRecord : undefined;

    // Formula entry for part tags and off-field info
    const entry = build.charBase.getFormulaEntry(formulaId);
    const partTags = entry?.parts.map((p) => p.formula.tag) ?? [];

    // Off-field context for ScalingBuff range display
    const formulaHasOffField =
      entry?.parts.some((p) => isPartOffField(p, forceOnField)) ?? false;
    let offFieldPreStats: Record<string, StatSheet> | undefined;
    let offFieldMidStats: Record<string, StatSheet> | undefined;
    if (formulaHasOffField) {
      const defaultOnFieldCharId = getDefaultOnFieldCharId(
        charId,
        this.configs
      );
      offFieldPreStats = {};
      for (const cid of Object.keys(this.charBuilds)) {
        offFieldPreStats[cid] = this.teamStats.getPreStats(
          cid,
          defaultOnFieldCharId
        );
      }
      offFieldMidStats = {};
      let hasOffMid = false;
      for (const cid of Object.keys(this.charBuilds)) {
        const mid = this.teamStats.getMidStats(cid, defaultOnFieldCharId);
        const pre = offFieldPreStats[cid]!;
        if (mid !== pre) hasOffMid = true;
        offFieldMidStats[cid] = mid;
      }
      if (!hasOffMid) offFieldMidStats = undefined;
    }

    // Compute display parts purely for readKeys (needed by resolveBuffs)
    const resolveEntry = build.charBase.getFormulaEntry(formulaId);
    const { parts } = resolveEntry
      ? evaluateFormulaDisplay(
          resolveEntry,
          charId,
          this.teamStats,
          ctx,
          reactionOverride,
          forceOnField
        )
      : { parts: [] as DisplayPart[] };

    const partReadKeys = parts.map((p) => p.readKeys);
    const partOffField =
      entry?.parts.map((p) => isPartOffField(p, forceOnField)) ?? [];

    return this.resolveBuffs(
      charId,
      preStats,
      teamPreStatsArr,
      partTags,
      partReadKeys,
      partOffField,
      formulaId,
      midStats,
      offFieldPreStats,
      offFieldMidStats
    );
  }

  /**
   * Single-formula display entry point — produces full breakdown, buffs, stats, marginal gains.
   * @internal Prefer `getComboDisplayResult` for public use. This remains public for tests
   * that exercise single-formula display behavior.
   */
  getDisplayResult(
    charId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    userBuffOverrides?: BuffActivationMap,
    externalActivation?: BuffActivationMap,
    forceOnField?: boolean
  ): DisplayResult {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);

    // ── Stat resolution via TeamStatSheet ──
    this.teamStats.setArtifacts(artifactStats, ctx);

    const preStats: Record<string, StatSheet> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      preStats[cid] = this.teamStats.getPreStats(cid, charId);
    }
    const teamPreStatsArr = Object.values(preStats);

    // Read midStats from TeamStatSheet
    const midStatsRecord: Record<string, StatSheet> = {};
    let hasMidStats = false;
    for (const cid of Object.keys(this.charBuilds)) {
      const mid = this.teamStats.getMidStats(cid, charId);
      const pre = preStats[cid]!;
      if (mid !== pre) hasMidStats = true;
      midStatsRecord[cid] = mid;
    }
    const midStats = hasMidStats ? midStatsRecord : undefined;

    const postStats = this.teamStats.getAllPostStats(charId);

    // ── Formula display ──
    const entry = build.charBase.getFormulaEntry(formulaId);
    const partTags: (DamageTag | undefined)[] =
      entry?.parts.map((p) => p.formula.tag) ?? [];
    const formulaTags: DamageTag[] = partTags.filter(
      (t): t is DamageTag => t !== undefined
    );

    // Compute off-field stats for display if the formula has off-field parts
    const formulaHasOffField =
      entry?.parts.some((p) => isPartOffField(p, forceOnField)) ?? false;

    // Build off-field preStats/midStats for ScalingBuff range display.
    const offFieldCtx = formulaHasOffField
      ? this.buildOffFieldContext(charId, artifactStats, false)
      : undefined;
    const offFieldPreStats = offFieldCtx?.offFieldPreStats;
    const offFieldMidStats = offFieldCtx?.offFieldMidStats;

    const displayEntry = build.charBase.getFormulaEntry(formulaId);
    let { parts, totalDamage } = displayEntry
      ? evaluateFormulaDisplay(
          displayEntry,
          charId,
          this.teamStats,
          ctx,
          reactionOverride,
          forceOnField
        )
      : { parts: [] as DisplayPart[], totalDamage: 0 };
    // Pre-blending damage: consistent baseline for marginal/level-up gain
    // comparisons (getDamageResult without partial buffs returns this value).
    const fullBuffDamage = totalDamage;

    // ── Stack allocation + buff activation ──
    // When `externalPartialBuffs` is provided, the caller is supplying the
    // distribution directly (used by tests to compare all 3 paths under the
    // same stack allocation). Skip internal compute in that case.
    const useExternal = externalActivation !== undefined;
    const stackLimited = useExternal
      ? []
      : collectStackLimitedBuffs(
          this.allStaticBuffs,
          preStats,
          teamPreStatsArr
        );
    let buffActivation: BuffActivationMap | undefined;

    if (entry) {
      // Greedy allocation for stack-limited buffs
      let mergedActivation: BuffActivationMap = {};
      if (stackLimited.length > 0) {
        const partEvals = this.buildPartEvals(
          charId,
          entry,
          artifactStats,
          ctx,
          forceOnField
        );
        const defaultActivation = computeDefaultActivation(
          partEvals,
          stackLimited,
          ctx
        );
        mergedActivation = { ...defaultActivation };
      }

      // 3. Merge user overrides on top
      if (!useExternal && userBuffOverrides) {
        TeamBuild.mergeActivationOverrides(mergedActivation, userBuffOverrides);
      }

      // 4. Build unified BuffActivationMap from stack-limited + user-overridden buffs
      let userActivation: BuffActivationMap = {};
      if (!useExternal && userBuffOverrides) {
        userActivation = buildUserOverrideInfos(
          userBuffOverrides,
          this.allStaticBuffs,
          entry.parts,
          (buff, providerId) =>
            this.couldBuffApplyToChar(buff, providerId, charId)
        );
      }
      const allActivation: BuffActivationMap = useExternal
        ? externalActivation!
        : { ...mergedActivation, ...userActivation };

      if (Object.keys(allActivation).length > 0) {
        buffActivation = mergedActivation;

        const blended = computeBlendedDamage(
          entry.parts,
          allActivation,
          charId,
          this.teamStats,
          ctx,
          reactionOverride,
          forceOnField
        );
        totalDamage = blended.totalDamage;
        // Rebuild display parts with 1st-hit stats: exclude only buffs
        // with 0 activation (never applied), keep blended average damage.
        for (let i = 0; i < parts.length; i++) {
          const eidx = parts[i].sourcePartIndex ?? i;
          if (!blended.partDamages[eidx]) continue;

          const zeroBuffKeys = new Set<string>();
          if (eidx < entry.parts.length) {
            const h = entry.parts[eidx].hits ?? 1;
            for (const [buffKey, partMap] of Object.entries(allActivation)) {
              if ((partMap[eidx] ?? h) === 0) {
                zeroBuffKeys.add(buffKey);
              }
            }
          }

          if (zeroBuffKeys.size > 0 && eidx < entry.parts.length) {
            const { formula, offField, bespokeBuffs } = entry.parts[eidx];
            const baseVariant = offField
              ? this.teamStats.getPostStats(
                  charId,
                  this.teamStats.getDefaultOnFieldCharId(charId),
                  zeroBuffKeys
                )
              : this.teamStats.getPostStats(charId, charId, zeroBuffKeys);
            const displayStats = bespokeBuffs?.length
              ? baseVariant.merge(
                  buildBespokeOverlay(bespokeBuffs, baseVariant, [])
                )
              : baseVariant;
            const rebuilt = formula.displayFull(
              displayStats,
              build.charBase.charLevel,
              ctx
            );
            const blendedDmg = blended.partDamages[eidx].damage;
            const unblendedDmg = rebuilt.damage;
            parts[i] = {
              ...rebuilt,
              hits: parts[i].hits,
              offField: parts[i].offField,
              damage: blendedDmg,
              ...(blendedDmg < unblendedDmg ? { maxDamage: unblendedDmg } : {}),
              sourcePartIndex: eidx,
            };
          } else {
            const blendedDmg = blended.partDamages[eidx].damage;
            const unblendedDmg = parts[i].damage;
            parts[i] = {
              ...parts[i],
              damage: blendedDmg,
              ...(blendedDmg < unblendedDmg ? { maxDamage: unblendedDmg } : {}),
              sourcePartIndex: eidx,
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
    const partOffField =
      entry?.parts.map((p) => isPartOffField(p, forceOnField)) ?? [];
    const buffs = this.resolveBuffs(
      charId,
      preStats,
      teamPreStatsArr,
      partTags,
      partReadKeys,
      partOffField,
      formulaId,
      midStats,
      offFieldPreStats,
      offFieldMidStats
    );

    const charFormulaTags = this.catalog.collectCharFormulaTags();

    // ── Raw StatSheets with on/off field contexts ──
    const statSheets: Record<
      string,
      { onField: StatSheet; offField: StatSheet }
    > = {};
    for (const cid of Object.keys(this.charBuilds)) {
      const onField = this.teamStats.getPostStats(cid, cid);
      const defaultOnFieldCharId = this.teamStats.getDefaultOnFieldCharId(cid);
      const offField = this.teamStats.getPostStats(cid, defaultOnFieldCharId);
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
      formulaHasOffField,
      forceOnField
    );

    // ── Level-up gains (Lv90 → Lv100) ──
    const levelUpGains = this.computeLevelUpGains(
      charId,
      formulaId,
      artifactStats,
      ctx,
      fullBuffDamage,
      reactionOverride,
      formulaHasOffField,
      forceOnField
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
          formulaHasOffField,
          forceOnField
        );
        for (const cid of zeroGainCharIds) {
          if (!emptyGains[cid] || Object.keys(emptyGains[cid]).length === 0) {
            intrinsicSaturatedCharIds.push(cid);
          }
        }
      }
    }

    // ── Idle stat records (cold path) ──
    this.teamStats.setArtifacts(artifactStats);
    const idleSheets = this.teamStats.getIdleStats();
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
    onFieldCharId: string,
    preStats: Record<string, StatSheet>,
    teamPreStatsArr: StatSheet[],
    partTags: (DamageTag | undefined)[],
    partReadKeys: (ReadonlySet<StatKey> | undefined)[],
    partOffField: boolean[],
    formulaId?: string,
    midStats?: Record<string, StatSheet>,
    offFieldPreStats?: Record<string, StatSheet>,
    offFieldMidStats?: Record<string, StatSheet>
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
    let applicableStatic = charBuffEntries
      .filter((b) => this.isBuffApplicableForTeam(b.buff, b.providerCharId))
      .map((b) => b.buff);
    applicableStatic = deduplicateBuffs(applicableStatic, (b) => b.staticBuffs);
    const activeStaticSet = new Set<StatBuff>(applicableStatic);

    // ── Active dynamic set ──
    // Evaluate dynamic buffs from the same allStaticBuffs objects.
    // Final-stat ScalingBuffs (e.g., ATK→baseDmg) use midStats so they see
    // sheet-stat dynamic buffs like Bennett's ATK share.
    const midStatsArr = midStats ? Object.values(midStats) : undefined;
    const allDynamic: EvaluatedDynamicBuff[] = [];
    for (const { buff, providerCharId } of charBuffEntries) {
      const useMid = midStats && isDeferredFinalBuff(buff);
      const ownerStats = useMid
        ? midStats[providerCharId]!
        : preStats[providerCharId]!;
      const statsArr = useMid ? midStatsArr! : teamPreStatsArr;
      const entries = buff.dynamicBuffs(ownerStats, statsArr);
      if (entries.length > 0) {
        allDynamic.push({ buff, source: buff.source, providerCharId, entries });
      }
    }

    let applicableDynamic = allDynamic.filter((b) =>
      this.isBuffApplicableForTeam(b.buff, b.providerCharId)
    );
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
      // Extract scaling info: input keys → output key for any scaling buff type
      let bridgeInputKeys: StatKey[] | undefined;
      let bridgeOutputKey: StatKey | undefined;
      if (buff instanceof ScalingBuff) {
        bridgeInputKeys = [buff.inputKey];
        bridgeOutputKey = buff.outputKey;
      } else if (buff instanceof TeamAggregationBuff) {
        bridgeInputKeys = [buff.inputKey];
        bridgeOutputKey = buff.outputKey;
      } else if (buff instanceof CrossScalingBuff) {
        bridgeInputKeys = [buff.statA, buff.statB];
        bridgeOutputKey = buff.outputKey;
      }
      if (!bridgeInputKeys || !bridgeOutputKey) continue;

      // Only care about scaling buffs whose output reaches the calc target.
      // Check both field states (true = on-field, false = off-field) because
      // the formula may mix on-field and off-field parts. Layer 2.5 narrows
      // per-part later.
      if (
        !(
          this.isBuffApplicableForChar(
            buff,
            providerCharId,
            onFieldCharId,
            true /* on-field */
          ) ||
          this.isBuffApplicableForChar(
            buff,
            providerCharId,
            onFieldCharId,
            false /* off-field */
          )
        )
      )
        continue;
      if (!activeDynamicSet.has(buff)) continue;

      // Register the bridge for each input key and its implicit dependencies
      for (const baseKey of bridgeInputKeys) {
        const inputKeys = [baseKey, ...(SCALED_DEPS[baseKey] ?? [])];
        for (const iKey of inputKeys) {
          const bridgeKey = `${providerCharId}\0${iKey}`;
          let outputs = scalingBridge.get(bridgeKey);
          if (!outputs) {
            outputs = new Set();
            scalingBridge.set(bridgeKey, outputs);
          }
          outputs.add(bridgeOutputKey);
        }
      }
    }

    // ── Display loop ──
    // Pre-compute field-state flags (invariant across buffs).
    const hasOnFieldParts = partOffField.some((f) => !f);
    const hasOffFieldParts =
      offFieldPreStats != null && partOffField.some((f) => f);

    // Iterate charBuffEntries (not cb.getAllBuffs()) so Set.has() matches.
    for (const { buff, providerCharId: ownerId } of charBuffEntries) {
      const applicable = this.isBuffApplicableForTeam(buff, ownerId);

      // Resolve dynamic entries with per-entry caps.
      // Evaluate using stats matching the formula's actual field states:
      // - on-field parts use preStats/midStats (built with formula char on-field)
      // - off-field parts use offFieldPreStats/offFieldMidStats (different on-field char)
      let dynamicEntries: ResolvedStatEntry[] = [];
      let active = false;
      let activePartIndices: number[] | undefined;

      const useMid = midStats && isDeferredFinalBuff(buff);

      // Evaluate in contexts that the formula actually uses
      const onRaw = hasOnFieldParts
        ? buff.dynamicBuffs(
            useMid ? midStats[ownerId]! : preStats[ownerId]!,
            useMid ? midStatsArr! : teamPreStatsArr
          )
        : undefined;
      const offRaw = hasOffFieldParts
        ? buff.dynamicBuffs(
            useMid && offFieldMidStats
              ? offFieldMidStats[ownerId]!
              : offFieldPreStats![ownerId]!,
            useMid && offFieldMidStats
              ? Object.values(offFieldMidStats)
              : Object.values(offFieldPreStats!)
          )
        : undefined;
      // Use whichever context produced entries (keys are identical in both).
      const raw = onRaw ?? offRaw ?? [];

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

          // Check if this buff directly affects the calc target's stat sheet.
          // Check both field states (true = on-field, false = off-field)
          // because the formula may mix on-field and off-field parts.
          // Layer 2.5 narrows per-part later.
          const reachesCalcTarget =
            this.isBuffApplicableForChar(
              buff,
              ownerId,
              onFieldCharId,
              true /* on-field */
            ) ||
            this.isBuffApplicableForChar(
              buff,
              ownerId,
              onFieldCharId,
              false /* off-field */
            );
          if (reachesCalcTarget) {
            for (const k of rawOutputKeys) effectiveKeys.add(k);
          }

          // Check indirect path via scaling bridge for all characters
          // the buff applies to (including calc target — their stats may
          // also feed their own scaling buffs).
          // Check both field states per character (same rationale as above).
          for (const cid of Object.keys(this.charBuilds)) {
            const buffApplies =
              this.isBuffApplicableForChar(
                buff,
                ownerId,
                cid,
                true /* on-field */
              ) ||
              this.isBuffApplicableForChar(
                buff,
                ownerId,
                cid,
                false /* off-field */
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
            const fr = fieldReq(buff.target.receiver);
            for (let pi = 0; pi < partTags.length; pi++) {
              // Layer 2.5: Field-context filter — onField buffs don't apply to
              // off-field parts, offField buffs don't apply to on-field parts
              if (fr === "on" && partOffField[pi]) continue;
              if (fr === "off" && !partOffField[pi]) continue;
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

      // Always populate dynamic entries for display, even when inactive.
      // When both on-field and off-field contexts exist, compute range.
      if (raw.length > 0) {
        dynamicEntries = raw.map((entry, i) => {
          const resolved: ResolvedStatEntry = { ...entry };
          annotateScalingInfo(buff, resolved);
          // If both contexts were evaluated, compare values and set range.
          if (onRaw && offRaw) {
            const onVal = onRaw[i]?.value ?? entry.value;
            const offVal = offRaw[i]?.value ?? entry.value;
            if (onVal !== offVal) {
              resolved.minValue = Math.min(onVal, offVal);
              resolved.maxValue = Math.max(onVal, offVal);
            }
          }
          return resolved;
        });
      }

      result.push({
        buffKey: getBuffInstanceKey(buff, ownerId),
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
        buffKey: getBuffInstanceKey(buff),
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
          buffKey: getBuffInstanceKey(buff, "extra"),
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
        buffKey: getBuffInstanceKey(buff, "extra"),
        source: buff.source,
        target: buff.target,
        active,
        activePartIndices: activePartIndicesExtra,
        staticEntries: buff.staticBuffs,
        dynamicEntries: [],
      });
    }

    // ── Bespoke buffs (per-formula-part) ──
    {
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
            annotateScalingInfo(buff, resolved);
            return resolved;
          });
        }

        result.push({
          buffKey: getBuffInstanceKey(buff, onFieldCharId),
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
   * onFieldCharId is the formula owner — they are on-field when executing.
   */
  private computeMarginalGainsUnified(
    onFieldCharId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    baseDamage: number,
    reactionOverride?: ReactionOverride,
    hasOffField?: boolean,
    forceOnField?: boolean
  ): Record<string, Partial<Record<StatKey, number>>> {
    if (baseDamage === 0) return {};

    const build = this.charBuilds[onFieldCharId]!;
    const entry = build.charBase.getFormulaEntry(formulaId);
    if (!entry) return {};
    const evalFn = (sheets: Record<string, StatSheet>): number => {
      this.teamStats.setArtifacts(sheets, ctx);
      return evaluateFormulaDamage(
        entry,
        onFieldCharId,
        this.teamStats,
        ctx,
        reactionOverride,
        undefined, // activation
        forceOnField
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
    hasOffField?: boolean,
    forceOnField?: boolean
  ): Record<string, { gain: number; from: number; to: number }[]> {
    if (baseDamage === 0) return {};

    return this.iterateLevelUpGains((charId, targetLevel) => {
      const tweakedConfigs = this.configs.map((c) =>
        c.charId === charId ? { ...c, charLevel: targetLevel } : c
      );
      const tweakedTeam = new TeamBuild(
        tweakedConfigs,
        this.combatOpts,
        this.enemyAura,
        this.extraBuffs
      );
      tweakedTeam.teamStats.setArtifacts(artifactStats, ctx);
      const tweakedResult = tweakedTeam.getDamageResult(
        onFieldCharId,
        formulaId,
        ctx,
        reactionOverride,
        undefined, // activation
        undefined, // formulaOwnerCharId
        forceOnField
      );
      return (tweakedResult.totalDamage - baseDamage) / baseDamage;
    });
  }

  /**
   * Shared iteration for level-up gain computation. For each team member,
   * checks the next level tier and optionally the 90→100 jump, calling
   * the provided gain function and collecting positive-gain entries.
   */
  private iterateLevelUpGains(
    computeGain: (charId: string, targetLevel: number) => number
  ): Record<string, { gain: number; from: number; to: number }[]> {
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
   * Compute a merged BuffActivationMap for a single formula.
   * Handles both stack-limited buffs (greedy allocation + user overrides)
   * and non-stack-limited user overrides.
   */
  computePartialBuffSpecs(
    carryCharId: string,
    formulaId: string,
    sheets: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    userOverrides?: BuffActivationMap,
    forceOnField?: boolean
  ): BuffActivationMap {
    const build = this.charBuilds[carryCharId];
    if (!build) return {};
    const entry = build.charBase.getFormulaEntry(formulaId);
    if (!entry) return {};

    // Compute pre-stats via TeamStatSheet
    this.teamStats.setArtifacts(sheets, ctx);
    const preStats: Record<string, StatSheet> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      preStats[cid] = this.teamStats.getPreStats(cid, carryCharId);
    }
    const teamPreStatsArr = Object.values(preStats);

    // Stack-limited buffs
    const stackLimited = collectStackLimitedBuffs(
      this.allStaticBuffs,
      preStats,
      teamPreStatsArr
    );

    let activation: BuffActivationMap = {};

    if (stackLimited.length > 0) {
      const partEvals = this.buildPartEvals(
        carryCharId,
        entry,
        sheets,
        ctx,
        forceOnField
      );

      const defaultActivation = computeDefaultActivation(
        partEvals,
        stackLimited,
        ctx
      );
      // Merge user overrides on top of greedy defaults
      activation = { ...defaultActivation };
      if (userOverrides) {
        TeamBuild.mergeActivationOverrides(activation, userOverrides);
      }
    }

    // Non-stack-limited user overrides
    if (userOverrides && Object.keys(userOverrides).length > 0) {
      const userActivation = buildUserOverrideInfos(
        userOverrides,
        this.allStaticBuffs,
        entry.parts,
        (buff, providerId) =>
          this.couldBuffApplyToChar(buff, providerId, carryCharId)
      );
      activation = { ...activation, ...userActivation };
    }

    return activation;
  }

  /**
   * Compute per-line BuffActivationMap for a combo rotation.
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
  ): Record<number, BuffActivationMap> | undefined {
    if (activeLines.length === 0) return undefined;

    const { defaultActivations, stackLimited, lineEntries } =
      this.buildComboDefaults(activeLines, sheets, ctx);

    const result: Record<number, BuffActivationMap> = {};

    for (let lineIdx = 0; lineIdx < activeLines.length; lineIdx++) {
      const entry = lineEntries[lineIdx];
      if (!entry) continue;

      const merged: BuffActivationMap = { ...defaultActivations[lineIdx] };
      const userOv = perLineUserOverrides?.get(lineIdx);
      if (userOv) {
        TeamBuild.mergeActivationOverrides(merged, userOv);
      }

      let lineActivation: BuffActivationMap = {};

      if (stackLimited.length > 0) {
        // merged already contains the stack-limited activation
        lineActivation = { ...merged };
      }

      if (userOv && Object.keys(userOv).length > 0) {
        const lineCharId = activeLines[lineIdx].charId;
        const userActivation = buildUserOverrideInfos(
          userOv,
          this.allStaticBuffs,
          entry.parts,
          (buff, providerId) =>
            this.couldBuffApplyToChar(buff, providerId, lineCharId)
        );
        lineActivation = { ...lineActivation, ...userActivation };
      }

      if (Object.keys(lineActivation).length > 0) {
        result[lineIdx] = lineActivation;
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
    lineEntries: (FormulaEntry | null)[];
  } {
    // ── Collect stack-limited buffs ──
    // Field context doesn't matter here: collectStackLimitedBuffs only checks
    // whether dynamicBuffs() returns entries (always true for non-no-op buffs),
    // not their values. Any on-field character produces the same result.
    this.teamStats.setArtifacts(sheets, ctx);
    const preStats: Record<string, StatSheet> = {};
    for (const cid of Object.keys(this.charBuilds)) {
      preStats[cid] = this.teamStats.getPreStats(cid, activeLines[0].charId);
    }
    const stackLimited = collectStackLimitedBuffs(
      this.allStaticBuffs,
      preStats,
      Object.values(preStats)
    );

    // ── Build per-line evaluation data ──
    const lineContexts: ComboLineEval[] = [];
    const lineEntries: (FormulaEntry | null)[] = [];

    for (const line of activeLines) {
      const cb = this.charBuilds[line.charId];
      // Prefer charBase lookup to avoid formulaIndex collisions (e.g. manekin);
      // fall back to formulaIndex for reaction/cross-scaled formulas.
      const entry =
        cb?.charBase.getFormulaEntry(line.formulaId) ??
        this.formulaIndex.get(line.formulaId) ??
        null;
      lineEntries.push(entry);
      if (!entry || !cb) {
        lineContexts.push({
          partEvals: [],
          lineCount: line.count,
        });
        continue;
      }

      const partEvals = this.buildPartEvals(
        line.charId,
        entry,
        sheets,
        ctx,
        line.forceOnField
      );

      lineContexts.push({
        partEvals,
        lineCount: line.count,
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
