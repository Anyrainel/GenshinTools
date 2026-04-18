import type {
  ComboLine,
  ComboTemplate,
  DamageTag,
  FormulaEntry,
  I18nLabel,
} from "../types";
import type { CharBuild } from "./charBuild";
import type { TeamReactionProvider } from "./teamReaction";

/**
 * Owns the flat formula index and formula-metadata queries for a team.
 * Extracted from TeamBuild so formula catalog concerns are separate from
 * stat resolution / damage computation.
 */
export class TeamFormulaCatalog {
  /** Flat index of all formula entries (character + reaction), keyed by formula ID. */
  readonly formulaIndex: Map<string, FormulaEntry>;
  /** Team reaction formula provider (transformative + lunar). */
  readonly reactionProvider: TeamReactionProvider;
  private readonly charBuilds: Record<string, CharBuild>;

  constructor(
    charBuilds: Record<string, CharBuild>,
    reactionProvider: TeamReactionProvider
  ) {
    this.charBuilds = charBuilds;
    this.reactionProvider = reactionProvider;

    // Build flat formulaIndex: character formulas + reaction formulas
    this.formulaIndex = new Map();
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      for (const [fid, entry] of Object.entries(
        build.charBase.allFormulaEntries
      )) {
        if (!entry.owner) entry.owner = charId;
        this.formulaIndex.set(fid, entry);
      }
    }
    for (const [fid, label] of Object.entries(
      this.reactionProvider.getFormulaIds()
    )) {
      const entry = this.reactionProvider.getFormulaEntry(fid);
      if (entry) this.formulaIndex.set(fid, entry);
    }
  }

  /** All available formulas across all characters. */
  getFormulaIds(): Record<string, Record<string, I18nLabel>> {
    const result: Record<string, Record<string, I18nLabel>> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getFormulaIds();
    }
    return result;
  }

  /** All formulas including constellation-locked ones, with minC/enabled info. */
  getAllFormulaIds(): Record<
    string,
    Record<string, { label: I18nLabel; minC: number; enabled: boolean }>
  > {
    const result: Record<
      string,
      Record<string, { label: I18nLabel; minC: number; enabled: boolean }>
    > = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getAllFormulaIds();
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

  /** Raw combo descriptor for a character (for per-constellation resolution). */
  getComboDescriptor(charId: string): ComboTemplate {
    return this.charBuilds[charId]?.charBase.rawComboDescriptor ?? [];
  }

  /** Reaction combo as ComboLine[], ready to append to default combo.
   *  Each line uses a per-triggerer formula ID (e.g. rx-overloaded-amber)
   *  with charId = statsCharId from the reaction entry. */
  getReactionComboLines(): ComboLine[] {
    const resolved = this.reactionProvider.getReactionComboCounts();
    const lines: ComboLine[] = [];
    for (const [formulaId, count] of Object.entries(resolved)) {
      if (count <= 0) continue;
      const entry = this.reactionProvider.getFormulaEntry(formulaId);
      const charId = entry?.statsCharId ?? "";
      lines.push({ charId, formulaId, count });
    }
    return lines;
  }

  /** Check off-field status of a formula's parts. */
  offFieldStatus(
    charId: string,
    formulaId: string
  ): "full" | "partial" | "none" {
    const entry =
      this.charBuilds[charId]?.charBase.getFormulaEntry(formulaId) ??
      this.formulaIndex.get(formulaId);
    if (!entry || entry.parts.length === 0) return "none";
    const offCount = entry.parts.filter((p) => p.offField).length;
    if (offCount === entry.parts.length) return "full";
    if (offCount > 0) return "partial";
    return "none";
  }

  /** Check if a formula has any off-field parts. */
  hasOffFieldParts(charId: string, formulaId: string): boolean {
    const entry =
      this.charBuilds[charId]?.charBase.getFormulaEntry(formulaId) ??
      this.formulaIndex.get(formulaId);
    return entry?.parts.some((p) => p.offField) ?? false;
  }

  /** Collect unique DamageTags per character from all their formula entries. */
  collectCharFormulaTags(): Record<string, DamageTag[]> {
    const charFormulaTags: Record<string, DamageTag[]> = {};
    for (const [cid, cb] of Object.entries(this.charBuilds)) {
      const tags: DamageTag[] = [];
      const seen = new Set<string>();
      for (const fid of Object.keys(cb.getFormulaIds())) {
        const fEntry =
          cb.charBase.getFormulaEntry(fid) ?? this.formulaIndex.get(fid);
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
}
