import type { ReactionType } from "@/data/enums";
import { ELEMENT_ELIGIBLE_REACTIONS, MULTI_ELEMENT_CHARS } from "../constants";
import type {
  ComboLine,
  ComboTemplate,
  ComboTemplateEntry,
  ConstellationDelta,
  FormulaEntry,
  I18nLabel,
  ReactionComboDelta,
  ReactionComboEntry,
} from "../types";
import type { DamageTag } from "../types";
import type { CharBuild } from "./charBuild";
import { resolveComboDescriptor } from "./combo";
import type { TeamMeta } from "./teamMeta";
import {
  MULTI_CONTRIBUTOR_REACTIONS,
  type TeamReaction,
  resolveReactionComboEntries,
} from "./teamReaction";

/**
 * Pre-computed reaction combo grid row for the analyzer UI.
 * One row per base reaction (e.g. "rx-lunarCharged").
 */
export interface ReactionComboGridRow {
  readonly baseId: string;
  readonly label: I18nLabel;
  readonly isMultiContributor: boolean;
  readonly onFieldCharId: string;
  /** Raw total count before per-char distribution (for override recomputation). */
  readonly baseTotal: number;
  /** charId → default trigger count at construction-time constellation. */
  readonly counts: Record<string, number>;
  /** Set of characters eligible to trigger this reaction. */
  readonly eligible: ReadonlySet<string>;
  /** Constellation-gated deltas (for editable bonus cells in analyzer). */
  readonly bonus: readonly ReactionComboDelta[];
}

/**
 * Owns the flat formula index and formula-metadata queries for a team.
 * Extracted from TeamBuild so formula catalog concerns are separate from
 * stat resolution / damage computation.
 *
 * After construction, callers don't need to distinguish reaction formulas
 * from character formulas — everything is unified in the formula index and
 * per-character formula lists.
 */
export class TeamFormulaCatalog {
  /** Flat index of all formula entries (character + reaction), keyed by formula ID. */
  readonly formulaIndex: Map<string, FormulaEntry>;
  /** @internal — reaction provider is an implementation detail. */
  private readonly reactionProvider: TeamReaction;
  private readonly charBuilds: Record<string, CharBuild>;
  private readonly teamMeta: TeamMeta;
  private cachedRxDescriptor: ReactionComboEntry[] | undefined;
  private cachedRxGrid: ReactionComboGridRow[] | undefined;

  constructor(
    charBuilds: Record<string, CharBuild>,
    reactionProvider: TeamReaction,
    teamMeta: TeamMeta
  ) {
    this.charBuilds = charBuilds;
    this.reactionProvider = reactionProvider;
    this.teamMeta = teamMeta;

    // Build flat formulaIndex: character formulas + reaction formulas
    this.formulaIndex = new Map();
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      for (const [fid, entry] of Object.entries(build.allFormulaEntries)) {
        if (!entry.owner) entry.owner = charId;
        this.formulaIndex.set(fid, entry);
      }
    }
    for (const [fid, _label] of Object.entries(
      this.reactionProvider.getFormulaIds()
    )) {
      const entry = this.reactionProvider.getFormulaEntry(fid);
      if (entry) this.formulaIndex.set(fid, entry);
    }
  }

  /**
   * All available formulas across all characters, including reaction formulas
   * grouped under each triggerer character.
   */
  getFormulaIds(): Record<string, Record<string, I18nLabel>> {
    const result: Record<string, Record<string, I18nLabel>> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = { ...build.getFormulaIds() };
    }
    for (const [fid, label] of Object.entries(
      this.reactionProvider.getFormulaIds()
    )) {
      const entry = this.reactionProvider.getFormulaEntry(fid);
      const owner = entry?.owner;
      if (owner && result[owner]) {
        result[owner][fid] = label;
      }
    }
    return result;
  }

  /**
   * All formulas including constellation-locked ones, with minC/enabled info.
   * Includes reaction formulas under each triggerer character.
   */
  getAllFormulaIds(): Record<
    string,
    Record<string, { label: I18nLabel; minC: number; enabled: boolean }>
  > {
    const result: Record<
      string,
      Record<string, { label: I18nLabel; minC: number; enabled: boolean }>
    > = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = { ...build.getAllFormulaIds() };
    }
    for (const [fid, label] of Object.entries(
      this.reactionProvider.getFormulaIds()
    )) {
      const entry = this.reactionProvider.getFormulaEntry(fid);
      const owner = entry?.owner;
      if (owner && result[owner]) {
        result[owner][fid] = { label, minC: 0, enabled: true };
      }
    }
    return result;
  }

  /**
   * Unified combo counts (character + reaction) for a character
   * at construction-time constellation.
   */
  getCombo(charId: string): Record<string, number> {
    return this.resolveCombo(charId, this.teamMeta.constellations[charId] ?? 0);
  }

  /**
   * Unified combo counts (character + reaction) for a character
   * at a given constellation level.
   * Cross-character constellation deltas use the team's construction-time values.
   */
  resolveCombo(charId: string, constellation: number): Record<string, number> {
    const descriptor = this.charBuilds[charId]?.comboDescriptor ?? [];
    const counts = resolveComboDescriptor(descriptor, constellation);

    const rxEntries = this.getPerCharComboEntries()[charId] ?? [];
    for (const entry of rxEntries) {
      let count = entry.count;
      if (entry.bonus) {
        for (const b of entry.bonus) {
          const bCharId = b.charId ?? charId;
          const bConstellation =
            bCharId === charId
              ? constellation
              : (this.teamMeta.constellations[bCharId] ?? 0);
          if (bConstellation >= b.minC) count += b.delta;
        }
      }
      counts[entry.id] = count;
    }

    return counts;
  }

  /** Check off-field status of a formula's parts. */
  offFieldStatus(formulaId: string): "full" | "partial" | "none" {
    const entry = this.formulaIndex.get(formulaId);
    if (!entry || entry.parts.length === 0) return "none";
    const offCount = entry.parts.filter((p) => p.offField).length;
    if (offCount === entry.parts.length) return "full";
    if (offCount > 0) return "partial";
    return "none";
  }

  /** Check if a formula has any off-field parts. */
  hasOffFieldParts(formulaId: string): boolean {
    const entry = this.formulaIndex.get(formulaId);
    return entry?.parts.some((p) => p.offField) ?? false;
  }

  /** Collect unique DamageTags per character from all their formula entries. */
  collectCharFormulaTags(): Record<string, DamageTag[]> {
    const charFormulaTags: Record<string, DamageTag[]> = {};
    for (const [cid, cb] of Object.entries(this.charBuilds)) {
      const tags: DamageTag[] = [];
      const seen = new Set<string>();
      for (const fid of Object.keys(cb.getFormulaIds())) {
        const fEntry = this.formulaIndex.get(fid);
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
    return charFormulaTags;
  }

  // ─── Reaction combo grid (for analyzer UI) ─────────────────────────

  /** Get pre-computed rank weights for a multi-contributor formula.
   *  Returns undefined if not pre-computed. */
  getRankWeights(formulaId: string): Map<string, number> | undefined {
    return this.reactionProvider.getRankWeights(formulaId);
  }

  /**
   * Pre-computed reaction combo grid for the analyzer UI.
   * One row per base reaction with per-character counts, eligibility,
   * and constellation-gated deltas — ready to render without extrapolation.
   */
  getReactionComboGrid(): ReactionComboGridRow[] {
    if (this.cachedRxGrid) return this.cachedRxGrid;

    const descriptor = this.getReactionComboDescriptor();
    const resolved = resolveReactionComboEntries(
      descriptor,
      this.teamMeta.constellations
    );

    const rows: ReactionComboGridRow[] = descriptor.map((entry) => {
      const baseReaction = entry.id.startsWith("rx-")
        ? entry.id.slice(3)
        : undefined;
      const isMulti =
        baseReaction != null &&
        MULTI_CONTRIBUTOR_REACTIONS.has(baseReaction as ReactionType);

      const counts: Record<string, number> = {};
      for (const charId of entry.eligible) {
        counts[charId] = resolved[`${entry.id}-${charId}`] ?? 0;
      }

      const label = this.reactionProvider.getFormulaEntry(
        `${entry.id}-${entry.eligible[0]}`
      )?.label ?? { en: entry.id, zh: entry.id };

      return {
        baseId: entry.id,
        label,
        isMultiContributor: isMulti,
        onFieldCharId: entry.onFieldCharId,
        baseTotal: entry.total,
        counts,
        eligible: new Set(entry.eligible),
        bonus: entry.bonus,
      };
    });

    this.cachedRxGrid = rows;
    return rows;
  }

  // ─── Internal combo heuristics ─────────────────────────────────────

  /** Guess the on-field character for a base reaction. */
  private guessOnFieldChar(baseId: string): string | undefined {
    const eligible = this.reactionProvider.getEligibleCharacters(baseId);
    const priority = ["flins", "zibai", "ineffa", "linnea", "columbina"];
    for (const charId of priority) {
      if (eligible.includes(charId)) return charId;
    }
    return eligible[0] ?? this.teamMeta.characters[0];
  }

  private getReactionComboDescriptor(): ReactionComboEntry[] {
    if (this.cachedRxDescriptor) return this.cachedRxDescriptor;

    const baseReactionIds = new Set(this.reactionProvider.getBaseReactionIds());
    const hasLCh = baseReactionIds.has("rx-lunarCharged");
    const hasLCr = baseReactionIds.has("rx-lunarCrystallize");
    const hasLB = this.teamMeta.hasReaction("lunarBloom");

    const entries: ReactionComboEntry[] = [];
    const lunarCount = +hasLCh + +hasLCr + +hasLB;

    const baseCounts: Record<string, number> = {};
    if (lunarCount >= 3) {
      if (hasLCh) baseCounts["rx-lunarCharged"] = 0;
      if (hasLCr) baseCounts["rx-lunarCrystallize"] = 0;
    } else if (lunarCount === 1) {
      if (hasLCh) baseCounts["rx-lunarCharged"] = 9;
      if (hasLCr) baseCounts["rx-lunarCrystallize"] = 15;
    } else {
      if (hasLCh && hasLCr) {
        baseCounts["rx-lunarCharged"] = 9;
        baseCounts["rx-lunarCrystallize"] = 0;
      } else if (hasLCr && hasLB) {
        baseCounts["rx-lunarCrystallize"] = 3;
      } else if (hasLCh && hasLB) {
        baseCounts["rx-lunarCharged"] = 3;
      }
    }

    const hasColumbina = this.teamMeta.characters.includes("columbina");
    const col = hasColumbina
      ? (n: number) => Math.round((n * 4) / 3)
      : (n: number) => n;

    for (const [id, baseTotal] of Object.entries(baseCounts)) {
      const bonus: ReactionComboDelta[] = [];

      if (id === "rx-lunarCrystallize" && this.charBuilds.linnea) {
        const linneaCombo = this.charBuilds.linnea.combo;
        const isTap = "linnea-overdrive" in linneaCombo;
        bonus.push({
          charId: "linnea",
          minC: 2,
          delta: col(isTap ? 12 : 3),
        });
      }

      const eligible = this.reactionProvider.getEligibleCharacters(id);
      const onFieldCharId = this.guessOnFieldChar(id) ?? eligible[0] ?? "";

      entries.push({
        id,
        total: col(baseTotal),
        eligible,
        onFieldCharId,
        bonus,
      });
    }

    this.cachedRxDescriptor = entries;
    return entries;
  }

  private getPerCharComboEntries(): Record<string, ComboTemplateEntry[]> {
    const descriptor = this.getReactionComboDescriptor();
    const result: Record<string, ComboTemplateEntry[]> = {};

    for (const entry of descriptor) {
      const eligible = entry.eligible;
      const isMulti =
        entry.id.startsWith("rx-") &&
        MULTI_CONTRIBUTOR_REACTIONS.has(entry.id.slice(3) as ReactionType);

      if (isMulti) {
        const charId = entry.onFieldCharId;
        const formulaId = `${entry.id}-${charId}`;
        if (!result[charId]) result[charId] = [];
        result[charId].push({
          id: formulaId,
          count: entry.total,
          bonus: entry.bonus.map((b) => ({
            minC: b.minC,
            delta: b.delta,
            charId: b.charId,
          })),
        });
      } else {
        for (const charId of eligible) {
          const isOnField = charId === entry.onFieldCharId;
          const baseCount =
            entry.total > 0
              ? isOnField
                ? Math.max(0, entry.total - (eligible.length - 1))
                : 1
              : 0;
          const formulaId = `${entry.id}-${charId}`;
          if (!result[charId]) result[charId] = [];
          const bonus: ComboTemplateEntry["bonus"] = isOnField
            ? entry.bonus.map((b) => ({
                minC: b.minC,
                delta: b.delta,
                charId: b.charId,
              }))
            : undefined;
          result[charId].push({
            id: formulaId,
            count: baseCount,
            ...(bonus?.length ? { bonus } : {}),
          });
        }
      }
    }

    return result;
  }
}

/**
 * Derive the available reaction types for a specific formula, given
 * team composition and element eligibility.
 *
 * Returns e.g. `["none", "melt"]` for a Pyro formula on a team with Cryo.
 * Returns `["none"]` for Anemo/Geo/Physical or when team can't trigger reactions.
 *
 * Used by FormulaSelectorCard (combo/single mode) and AnalyzerComboTab.
 */
export function getFormulaReactions(
  charId: string,
  formulaEntry: { parts: { formula: { tag: { element: string } } }[] } | null,
  charElement: string | undefined,
  hasReaction: (reaction: ReactionType, charId?: string) => boolean
): ReactionType[] {
  if (!charElement) return ["none"];

  const isMultiElement = MULTI_ELEMENT_CHARS.has(charId);

  if (isMultiElement && formulaEntry) {
    const rxSet = new Set<ReactionType>(["none"]);
    for (const part of formulaEntry.parts) {
      const partEl = part.formula.tag.element;
      const partEligible =
        ELEMENT_ELIGIBLE_REACTIONS[
          partEl as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
        ];
      if (partEligible) for (const rx of partEligible) rxSet.add(rx);
    }
    return Array.from(rxSet).filter((rx) => rx === "none" || hasReaction(rx));
  }

  const eligible: ReactionType[] = ELEMENT_ELIGIBLE_REACTIONS[
    charElement as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
  ] ?? ["none"];

  return eligible.filter((rx) => rx === "none" || hasReaction(rx, charId));
}
