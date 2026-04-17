import { getNextLevelTier } from "@/lib/gameStatsLoader";
import { isFinalStatKey } from "../helpers";
import { exclusionKey } from "../helpers";
import type {
  BuffSource,
  CalcContext,
  ComboFormula,
  ComboResult,
  DamageResult,
  DamageTag,
  DisplayPart,
  DisplayResult,
  ResolvedBuff,
  ResolvedStatEntry,
  StatEntry,
  StatKey,
} from "../types";
import {
  defaultOnFieldCharId,
  isPartOffField,
  resolvePartOnFieldCharIds,
} from "./fieldState";
import { computeSubstatMarginals } from "./marginalGain";
import { buildStatVariants, computeBlendedDamage } from "./stackAllocation";
import type { PartialBuffInfo } from "./stackAllocation";
import {
  CrossScalingBuff,
  ScalingBuff,
  TeamAggregationBuff,
  assertNoDuplicateStatKeys,
} from "./statBuff";
import type { StatBuff } from "./statBuff";
import { bespokeMaxStacks, buildBespokeOverlay } from "./statSheet";
import { StatSheet } from "./statSheet";
import { TeamBuild } from "./teamBuild";

export type EvaluatedDynamicBuff = {
  buff: StatBuff;
  source: BuffSource;
  providerCharId: string;
  entries: StatEntry[];
};

/**
 * Whether a dynamic buff should be deferred to the second pass (final-stat pass).
 * A buff is deferred if it's a ScalingBuff/CrossScalingBuff whose output key
 * is a final stat AND whose input reads from sheet stats.
 * This lets it see post-dynamic sheet stats (e.g. Bennett's ATK).
 */
export function isDeferredFinalBuff(buff: StatBuff): boolean {
  if (buff instanceof ScalingBuff) {
    return isFinalStatKey(buff.outputKey);
  }
  if (buff instanceof CrossScalingBuff) {
    return isFinalStatKey(buff.outputKey);
  }
  return false;
}

/**
 * Two-pass dynamic buff evaluation.
 *
 * Pass 1: Evaluate sheet-stat dynamic buffs (ATK, EM, CR, etc.) from preStats.
 * Pass 2: Build midStats (preStats + sheet-stat buffs), then evaluate final-stat
 * dynamic buffs (baseDmg, dmg%, etc.) from midStats so they see Bennett's ATK, etc.
 *
 * @param buffSources  Iterable of (buff, providerCharId) pairs to evaluate.
 * @param preStats     Per-character pre-stat sheets.
 * @param buildMidStats  Function to apply sheet-stat buffs → midStats.
 */
export function evaluateDynamicBuffsTwoPass(
  buffSources: Iterable<{ buff: StatBuff; providerCharId: string }>,
  preStats: Record<string, StatSheet>,
  buildMidStats: (
    sheetBuffs: EvaluatedDynamicBuff[]
  ) => Record<string, StatSheet>
): EvaluatedDynamicBuff[] {
  const teamPreStatsArr = Object.values(preStats);
  const sheetBuffs: EvaluatedDynamicBuff[] = [];
  const finalBuffRefs: { buff: StatBuff; providerCharId: string }[] = [];

  for (const { buff, providerCharId } of buffSources) {
    if (providerCharId === "resonance" || providerCharId === "extra") continue;
    if (isDeferredFinalBuff(buff)) {
      finalBuffRefs.push({ buff, providerCharId });
      continue;
    }
    const ownerStats = preStats[providerCharId]!;
    const entries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
    assertNoDuplicateStatKeys(
      entries,
      `dynamicBuffs (source: ${buff.source.type}:${buff.source.id})`
    );
    if (entries.length > 0) {
      sheetBuffs.push({ buff, source: buff.source, providerCharId, entries });
    }
  }

  if (finalBuffRefs.length === 0) return sheetBuffs;

  // Two-pass: build midStats by applying sheet-stat dynamic buffs,
  // then re-evaluate final-stat buffs using midStats.
  const midStats = buildMidStats(sheetBuffs);
  const midStatsArr = Object.values(midStats);

  const finalBuffs: EvaluatedDynamicBuff[] = [];
  for (const { buff, providerCharId } of finalBuffRefs) {
    const ownerStats = midStats[providerCharId]!;
    const entries = buff.dynamicBuffs(ownerStats, midStatsArr);
    assertNoDuplicateStatKeys(
      entries,
      `dynamicBuffs/final (source: ${buff.source.type}:${buff.source.id})`
    );
    if (entries.length > 0) {
      finalBuffs.push({ buff, source: buff.source, providerCharId, entries });
    }
  }

  return [...sheetBuffs, ...finalBuffs];
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
  /** Per-line PartialBuffInfo[], keyed by line index in validLines. */
  buffOverrides?: Record<number, PartialBuffInfo[]>,
  /** Pre-seeded stats cache to avoid redundant getTeamStats calls. */
  externalStatsCache?: Map<string, Record<string, StatSheet>>
): ComboResult {
  // Skip lines with zero count or whose formula no longer exists (e.g. constellation lowered)
  const validLines = combo.lines.filter((line) => {
    if (line.count <= 0) return false;
    return teamBuild.formulaIndex.has(line.formulaId);
  });

  // Cache resolved stat sheets per on-field character.
  // Uses getTeamStats (non-unified) — each call resolves dynamic buffs for
  // a specific on-field context, matching the compile path exactly.
  const statsCache =
    externalStatsCache ?? new Map<string, Record<string, StatSheet>>();
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
    // Prefer charBase lookup to avoid formulaIndex collisions (e.g. manekin);
    // fall back to formulaIndex for reaction/cross-scaled formulas.
    const cb = teamBuild.charBuilds[line.charId];
    const entry =
      cb?.charBase.getFormulaEntry(line.formulaId) ??
      teamBuild.formulaIndex.get(line.formulaId);
    // Resolve statsCharId: use line.charId (which may already be set correctly),
    // or override from the entry's statsCharId if present.
    const statsCharId = entry?.statsCharId ?? line.charId;
    const ownerCharId = entry?.owner ?? line.charId;

    // On-field context: stats char is on-field for on-field parts.
    const teamStats = getStats(statsCharId);

    // Team reaction path: route rx-* formulas to reactionProvider
    if (line.formulaId.startsWith("rx-")) {
      const rp = teamBuild.reactionProvider;
      let result: DamageResult;
      if (rp.isMultiContributor(line.formulaId)) {
        result = rp.getMultiContributorResult(
          line.formulaId,
          statsCharId,
          teamStats,
          ctx
        );
      } else {
        result = rp.getDamageResult(
          line.formulaId,
          statsCharId,
          teamStats[statsCharId]!,
          ctx
        );
      }
      return {
        perHit: result.totalDamage,
        total: result.totalDamage * line.count,
      };
    }

    // Character formula path (including cross-scaled like Nicole projections)
    const lineEntry = entry;
    const partOnFieldCharIds = lineEntry
      ? resolvePartOnFieldCharIds(
          lineEntry.parts,
          statsCharId,
          teamBuild.configs,
          line.reaction
        )
      : [];

    // Off-field context: needed when any part resolves to a different on-field char.
    const offFieldOnFieldCharId = partOnFieldCharIds.find(
      (id) => id !== statsCharId
    );
    let offFieldTeamStats: Record<string, StatSheet> | undefined;
    if (offFieldOnFieldCharId) {
      offFieldTeamStats = getStats(offFieldOnFieldCharId);
    }

    const effectiveReaction = line.reaction;

    // Build stat variants if this line has partial buffs
    const lineInfos = buffOverrides?.[lineIdx];
    let lineVariants: Map<string, StatSheet> | undefined;
    let lineOffFieldVariants: Map<string, StatSheet> | undefined;
    if (lineInfos && lineInfos.length > 0 && lineEntry) {
      lineVariants = buildStatVariants(
        lineInfos,
        lineEntry.parts,
        (excl) =>
          teamBuild.getTeamStatsExcluding(
            artifactStats,
            statsCharId,
            ctx,
            excl
          )[statsCharId]!
      );
      if (offFieldTeamStats && offFieldOnFieldCharId) {
        lineOffFieldVariants = buildStatVariants(
          lineInfos,
          lineEntry.parts,
          (excl) =>
            teamBuild.getTeamStatsExcluding(
              artifactStats,
              offFieldOnFieldCharId,
              ctx,
              excl
            )[statsCharId]!
        );
      }
    }

    // For cross-scaled formulas, pass ownerCharId so getDamageResult
    // looks up the formula from the owner's charBase while using stats from statsCharId
    const formulaOwner = ownerCharId !== statsCharId ? ownerCharId : undefined;
    const result = teamBuild.getDamageResult(
      statsCharId,
      line.formulaId,
      teamStats,
      ctx,
      effectiveReaction,
      offFieldTeamStats,
      lineInfos,
      lineVariants,
      lineOffFieldVariants,
      formulaOwner
    );

    // Adjust for bespokeBuff maxStacks across combo repetitions
    let total = result.totalDamage * line.count;
    for (const part of result.parts) {
      if (part.bespokeInfo) {
        const totalHits = part.hits * line.count;
        const buffedHits = Math.min(part.bespokeInfo.maxStacks, totalHits);
        const unbuffedHits = totalHits - buffedHits;
        // Correct: naive total assumed all hits buffed; replace with blended
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
 * Widen min/max range on resolved dynamic entries using alternate values.
 * Both the existing and alternate values are equally valid (they correspond
/** Annotate a resolved entry with inputKey/cap from any scaling buff type. */
export function annotateScalingInfo(
  buff: StatBuff,
  resolved: ResolvedStatEntry
): void {
  if (buff instanceof ScalingBuff) {
    // Covers ScalingBuff and DynamicCapScalingBuff (which extends ScalingBuff)
    if (buff.cap !== undefined) resolved.cap = buff.cap;
    resolved.inputKey = buff.inputKey;
  } else if (buff instanceof TeamAggregationBuff) {
    if (buff.cap !== undefined) resolved.cap = buff.cap;
    resolved.inputKey = buff.inputKey;
  } else if (buff instanceof CrossScalingBuff) {
    if (buff.capA !== undefined) resolved.cap = buff.capA;
    resolved.inputKey = buff.statA;
  }
}

/**
 * to different on-field contexts for different formula parts).
 * Sets minValue/maxValue when values differ; value is left unchanged.
 */
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

/**
 * Widen min/max range on an existing ResolvedBuff's dynamic entries
 * using values from another instance of the same buff (different on-field context).
 */
function mergeBuffDynamicRange(
  existing: ResolvedBuff,
  incoming: ResolvedBuff
): void {
  widenDynamicRange(existing.dynamicEntries, incoming.dynamicEntries);
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

  // ── Collect all formula tags per character ──
  const charFormulaTags: Record<string, DamageTag[]> = {};
  for (const cid of allCharIds) {
    const tags: DamageTag[] = [];
    const seen = new Set<string>();
    const formulaIds = teamBuild.getFormulaIds()[cid];
    if (formulaIds) {
      for (const fid of Object.keys(formulaIds)) {
        const fEntry =
          teamBuild.charBuilds[cid]?.charBase.getFormulaEntry(fid) ??
          teamBuild.formulaIndex.get(fid);
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
    const offOther = defaultOnFieldCharId(cid, teamBuild.configs);
    const offField = getStats(offOther)[cid]!;
    statSheets[cid] = { onField, offField };
  }

  // ── Base combo damage ──
  // Share the stats cache with evaluateCombo to avoid redundant getTeamStats calls.
  const baseResult = evaluateCombo(
    teamBuild,
    { ...combo, lines: activeLines },
    artifactStats,
    ctx,
    buffOverrides,
    statsCache
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
        undefined,
        statsCache
      ).totalDamage
    : baseDamage;

  // ── Marginal gains ──
  const marginalGains: Record<string, Partial<Record<StatKey, number>>> = {};

  if (fullBuffBaseDamage > 0) {
    const comboConfig = { ...combo, lines: activeLines };
    const evalFn = (sheets: Record<string, StatSheet>): number =>
      evaluateCombo(teamBuild, comboConfig, sheets, ctx).totalDamage;

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
        evaluateCombo(teamBuild, comboConfig, sheets, ctx).totalDamage;
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

    try {
      // Pass the line's reaction override (including forceOnField) so that
      // on-field-receiver buffs correctly resolve as active for off-field
      // formula parts the user has forced on-field. Without this, the UI's
      // buff chip list ignores forceOnField entirely.
      const dr = teamBuild.getDisplayResult(
        line.charId,
        line.formulaId,
        artifactStats,
        ctx,
        line.reaction
      );

      for (const buff of dr.buffs) {
        const existing = buffMap.get(buff.buffKey);
        if (!existing) {
          buffMap.set(buff.buffKey, buff);
        } else if (buff.active && !existing.active) {
          // Upgrade to active
          buffMap.set(buff.buffKey, buff);
        } else if (
          buff.active &&
          existing.active &&
          buff.dynamicEntries.length > 0
        ) {
          // Accumulate min/max for dynamic entries across on-field contexts.
          // Same buff may produce different values depending on who is on-field
          // (e.g. Shenhe ATK→baseDmg sees different ATK with/without Bennett).
          mergeBuffDynamicRange(existing, buff);
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
        ctx
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

    // ── Team reaction formulas: build display parts from formulaIndex ──
    if (formulaId.startsWith("rx-")) {
      const rxEntry = teamBuild.formulaIndex.get(formulaId);
      if (!rxEntry) continue;
      const formula = rxEntry.parts[0].formula;
      const charLevel =
        teamBuild.configs.find((c) => c.charId === charId)?.charLevel ?? 90;

      let parts: DisplayPart[];
      if (teamBuild.reactionProvider.isMultiContributor(formulaId)) {
        // Generate 4 DisplayParts: one per team member, sorted by rank weight.
        // The on-field character uses on-field stats; others use off-field stats.
        const rankWeights =
          teamBuild.reactionProvider.getRankWeights(formulaId);
        const contributions: { charId: string; weight: number }[] = [];
        for (const cfg of teamBuild.configs) {
          const w = rankWeights?.get(cfg.charId) ?? 0;
          contributions.push({ charId: cfg.charId, weight: w });
        }
        // Sort by weight descending (rank 1 first)
        contributions.sort((a, b) => b.weight - a.weight);

        parts = contributions.map((c) => {
          // On-field character gets on-field stats, others get off-field stats
          const onField =
            c.charId === charId
              ? charId
              : defaultOnFieldCharId(charId, teamBuild.configs);
          const stats = getStats(onField);
          const cLevel =
            teamBuild.configs.find((cfg) => cfg.charId === c.charId)
              ?.charLevel ?? 90;
          const dp = formula.displayFull(stats[c.charId]!, cLevel, ctx);
          dp.damage = dp.damage * c.weight;
          dp.hits = 1;
          dp.params = { ...dp.params, rankWeight: c.weight };
          dp.contributorCharId = c.charId;
          return dp;
        });
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

    const firstLine = formulaLines[0].line;
    const effectiveReaction = firstLine.reaction;

    // Off-field stats (first-other on-field for off-field parts)
    const entry =
      build.charBase.getFormulaEntry(formulaId) ??
      teamBuild.formulaIndex.get(formulaId);
    const formulaHasOffField =
      entry?.parts.some((p) => isPartOffField(p, effectiveReaction)) ?? false;
    let offFieldPostStats: StatSheet | undefined;
    if (formulaHasOffField) {
      const offOther = defaultOnFieldCharId(charId, teamBuild.configs);
      offFieldPostStats = getStats(offOther)[charId];
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
          const offOther = defaultOnFieldCharId(charId, teamBuild.configs);
          offFieldVariants = buildStatVariants(
            aggregatedInfos,
            entry.parts,
            (excl) =>
              teamBuild.getTeamStatsExcluding(
                artifactStats,
                offOther,
                ctx,
                excl
              )[charId]!
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
          const eidx = parts[i].sourcePartIndex ?? i;
          if (!blended.partDamages[eidx]) continue;

          const zeroBuffKeys = new Set<string>();
          if (eidx < entry.parts.length) {
            const h = entry.parts[eidx].hits ?? 1;
            for (const info of aggregatedInfos) {
              if ((info.partActivation[eidx] ?? h) === 0) {
                zeroBuffKeys.add(info.buffKey);
              }
            }
          }

          if (zeroBuffKeys.size > 0 && eidx < entry.parts.length) {
            const { formula, offField, bespokeBuffs } = entry.parts[eidx];
            const eKey = exclusionKey(zeroBuffKeys);
            const baseVariant =
              offField && offFieldVariants
                ? (offFieldVariants.get(eKey) ?? offFieldPostStats!)
                : (statsVariants.get(eKey) ?? postStats[charId]!);
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
            parts[i] = {
              ...rebuilt,
              hits: parts[i].hits,
              offField: parts[i].offField,
              damage: blended.partDamages[eidx].damage,
              sourcePartIndex: eidx,
            };
          } else {
            parts[i] = {
              ...parts[i],
              damage: blended.partDamages[eidx].damage,
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

    // Combo-scoped bespoke maxStack split: re-split display parts based on
    // maxStacks vs partHits × totalComboCount (stacks don't reset per invocation)
    if (entry) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const dp = parts[i];
        const eidx = dp.sourcePartIndex;
        if (eidx == null || eidx >= entry.parts.length) continue;
        const { bespokeBuffs } = entry.parts[eidx];
        const bespokeMax = bespokeMaxStacks(bespokeBuffs);
        const partHits = entry.parts[eidx].hits ?? 1;
        const comboTotalHits = partHits * totalComboCount;
        if (bespokeMax == null || bespokeMax >= comboTotalHits) continue;
        // Determine buffed fraction across the whole combo for this entry part
        const buffedFrac = bespokeMax / comboTotalHits;
        const dpHits = dp.hits ?? 1;
        const buffedHits = Math.round(dpHits * buffedFrac * 1000) / 1000;
        const unbuffedHits = dpHits - buffedHits;
        if (buffedHits > 0 && unbuffedHits > 0) {
          const { formula, offField } = entry.parts[eidx];
          const baseSelfStats =
            offField && offFieldPostStats
              ? offFieldPostStats
              : postStats[charId]!;
          // Unbuffed part (without bespoke overlay)
          const dpUnbuffed = formula.displayFull(
            baseSelfStats,
            build.charBase.charLevel,
            ctx
          );
          dpUnbuffed.hits = unbuffedHits;
          dpUnbuffed.sourcePartIndex = eidx;
          if (dp.offField) dpUnbuffed.offField = true;
          // Replace current part with buffed portion and insert unbuffed after
          parts.splice(i, 1, { ...dp, hits: buffedHits }, dpUnbuffed);
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
