import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type {
  AnalyzerCharConfig,
  ComboCountOverrides,
  MinErOverrides,
} from "@/lib/team-comp/analyzer";
import { comboLineKey } from "@/lib/team-comp/analyzer";
import {
  ELEMENT_ELIGIBLE_REACTIONS,
  getFormulaReactions,
} from "@/lib/team-comp/constants";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import type {
  ComboFormula,
  I18nLabel,
  ReactionOverride,
  ReactionType,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { resolveComboDescriptor } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormulaLabel } from "./FormulaLabel";
import { ReactionPartControls } from "./ReactionPartControls";

interface AnalyzerComboTabProps {
  teamBuild: TeamBuild;
  charConfigs: AnalyzerCharConfig[];
  baseConfigs: TeamSlotConfig[];
  templateCombo: ComboFormula;
  comboOverrides: ComboCountOverrides;
  minErOverrides: MinErOverrides;
  onComboOverridesChange: (overrides: ComboCountOverrides) => void;
  onMinErOverridesChange: (overrides: MinErOverrides) => void;
  onReactionChange: (stableKey: string, override: ReactionOverride) => void;
}

export function AnalyzerComboTab({
  teamBuild,
  charConfigs,
  baseConfigs,
  templateCombo,
  comboOverrides,
  minErOverrides,
  onComboOverridesChange,
  onMinErOverridesChange,
  onReactionChange,
}: AnalyzerComboTabProps) {
  return (
    <div className="flex flex-col gap-1.5 lg:gap-2">
      {charConfigs.map((cfg) => {
        const bc = baseConfigs.find((b) => b.charId === cfg.charId);
        if (!bc) return null;
        return (
          <CharComboRow
            key={cfg.charId}
            charId={cfg.charId}
            config={cfg}
            teamBuild={teamBuild}
            templateCombo={templateCombo}
            comboOverrides={comboOverrides}
            minErOverrides={minErOverrides}
            baseMinEr={1.0}
            onComboOverridesChange={onComboOverridesChange}
            onMinErOverridesChange={onMinErOverridesChange}
            onReactionChange={onReactionChange}
          />
        );
      })}
    </div>
  );
}

// ─── Row data types ───

/** A variant within a formula row (one per reaction type). */
type Variant = {
  lineKey: string;
  reactionType: string | undefined;
  reaction?: ReactionOverride;
  templateCount: number;
};

/** One formula row — may have multiple reaction variants. */
type FormulaRow = {
  formulaId: string;
  label: I18nLabel | undefined;
  minC: number;
  /** All reaction variants for this formula. */
  variants: Variant[];
  /** Default total count per constellation (from descriptor). */
  getDescriptorCount: (c: number) => number;
};

/** A formula with a non-direct reaction that needs a config panel. */
type ReactionConfig = {
  formulaId: string;
  stableKey: string;
  reactionType: string;
  reaction: ReactionOverride;
};

// ─── Per-character row ───

function CharComboRow({
  charId,
  config,
  teamBuild,
  templateCombo,
  comboOverrides,
  minErOverrides,
  baseMinEr,
  onComboOverridesChange,
  onMinErOverridesChange,
  onReactionChange,
}: {
  charId: string;
  config: AnalyzerCharConfig;
  teamBuild: TeamBuild;
  templateCombo: ComboFormula;
  comboOverrides: ComboCountOverrides;
  minErOverrides: MinErOverrides;
  baseMinEr: number;
  onComboOverridesChange: (overrides: ComboCountOverrides) => void;
  onMinErOverridesChange: (overrides: MinErOverrides) => void;
  onReactionChange: (stableKey: string, override: ReactionOverride) => void;
}) {
  const { t } = useLanguage();
  const char = charactersById[charId];

  const comboOverridesRef = useRef(comboOverrides);
  comboOverridesRef.current = comboOverrides;
  const minErOverridesRef = useRef(minErOverrides);
  minErOverridesRef.current = minErOverrides;

  const startC = config.startConstellation;
  const maxC = config.maxConstellation;
  const is5Star = config.rarity >= 5;

  const constellations = useMemo(() => {
    if (is5Star) return [0, 1, 2, 3, 4, 5, 6];
    const cols: number[] = [];
    for (let c = startC; c <= maxC; c++) cols.push(c);
    return cols;
  }, [is5Star, startC, maxC]);

  const descriptor = teamBuild.getComboDescriptor(charId);
  const allFormulas = teamBuild.getAllFormulaIds()[charId] ?? {};

  const descriptorCounts = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const c of constellations) {
      map[c] = resolveComboDescriptor(descriptor, c);
    }
    return map;
  }, [constellations, descriptor]);

  // Build formula rows (one per formula, with variants) and reaction configs.
  // Variants come from element eligibility + team meta, NOT from template combo lines.
  // Template lines only supply default counts per reaction variant.
  const { formulaRows, reactionConfigs } = useMemo(() => {
    const charElement = teamBuild.teamMeta.elements[charId];
    const hasReactionFn = (rx: ReactionType, id?: string) =>
      teamBuild.teamMeta.hasReaction(rx, id);

    // Index template lines by formulaId → reactionType for count lookup
    const templateCounts: Record<string, Record<string, number>> = {};
    const templateReactions: Record<
      string,
      Record<string, ReactionOverride>
    > = {};
    for (const line of templateCombo.lines) {
      if (line.charId !== charId) continue;
      const rx = line.reaction?.reaction ?? "none";
      if (!templateCounts[line.formulaId]) templateCounts[line.formulaId] = {};
      templateCounts[line.formulaId][rx] =
        (templateCounts[line.formulaId][rx] ?? 0) + line.count;
      if (line.reaction) {
        if (!templateReactions[line.formulaId])
          templateReactions[line.formulaId] = {};
        templateReactions[line.formulaId][rx] = line.reaction;
      }
    }

    const rows: FormulaRow[] = [];
    const rxConfigs: ReactionConfig[] = [];
    const seen = new Set<string>();

    for (const entry of descriptor) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      const formulaInfo = allFormulas[entry.id];
      const label = formulaInfo?.label;
      const minC = formulaInfo?.minC ?? 0;

      // Derive available reactions from element eligibility
      const formulaEntry =
        teamBuild.charBuilds[charId]?.charBase.getFormulaEntry(entry.id) ??
        null;
      const reactions = getFormulaReactions(
        charId,
        formulaEntry,
        charElement,
        hasReactionFn
      );

      // Build one variant per available reaction type
      const variants: Variant[] = reactions.map((rx) => ({
        lineKey: comboLineKey(
          entry.id,
          rx === "none" ? undefined : { reaction: rx }
        ),
        reactionType: rx,
        templateCount: templateCounts[entry.id]?.[rx] ?? 0,
        reaction:
          rx === "none"
            ? undefined
            : (templateReactions[entry.id]?.[rx] ?? {
                reaction: rx,
              }),
      }));

      rows.push({
        formulaId: entry.id,
        label,
        minC,
        variants,
        getDescriptorCount: (c: number) => descriptorCounts[c]?.[entry.id] ?? 0,
      });

      // Collect non-direct reaction variants for config panels
      for (const v of variants) {
        if (v.reactionType && v.reactionType !== "none") {
          rxConfigs.push({
            formulaId: entry.id,
            stableKey: `${charId}.${entry.id}`,
            reactionType: v.reactionType,
            reaction: v.reaction ?? {
              reaction: v.reactionType as ReactionType,
            },
          });
        }
      }
    }

    return { formulaRows: rows, reactionConfigs: rxConfigs };
  }, [
    descriptor,
    allFormulas,
    templateCombo.lines,
    charId,
    descriptorCounts,
    teamBuild,
  ]);

  const hasOverrides = useMemo(() => {
    const charOverrides = comboOverrides[charId];
    const charMinErOverrides = minErOverrides[charId];
    return (
      (charOverrides && Object.keys(charOverrides).length > 0) ||
      (charMinErOverrides && Object.keys(charMinErOverrides).length > 0)
    );
  }, [comboOverrides, minErOverrides, charId]);

  const handleCountChange = useCallback(
    (constellation: number, lineKey: string, value: number | undefined) => {
      const prev = comboOverridesRef.current;
      let next: ComboCountOverrides;
      if (value == null) {
        if (!prev[charId]?.[constellation]) return;
        const { [lineKey]: _, ...rest } = prev[charId][constellation];
        if (Object.keys(rest).length > 0) {
          next = {
            ...prev,
            [charId]: { ...prev[charId], [constellation]: rest },
          };
        } else {
          const { [constellation]: __, ...restC } = prev[charId];
          if (Object.keys(restC).length > 0) {
            next = { ...prev, [charId]: restC };
          } else {
            const { [charId]: ___, ...restChar } = prev;
            next = restChar;
          }
        }
      } else {
        next = {
          ...prev,
          [charId]: {
            ...prev[charId],
            [constellation]: {
              ...prev[charId]?.[constellation],
              [lineKey]: value,
            },
          },
        };
      }
      onComboOverridesChange(next);
    },
    [charId, onComboOverridesChange]
  );

  const handleMinErChange = useCallback(
    (constellation: number, value: number | undefined) => {
      const prev = minErOverridesRef.current;
      let next: MinErOverrides;
      if (value == null) {
        if (!prev[charId]) return;
        const { [constellation]: _, ...rest } = prev[charId];
        if (Object.keys(rest).length > 0) {
          next = { ...prev, [charId]: rest };
        } else {
          const { [charId]: __, ...restChar } = prev;
          next = restChar;
        }
      } else {
        next = {
          ...prev,
          [charId]: { ...prev[charId], [constellation]: value },
        };
      }
      onMinErOverridesChange(next);
    },
    [charId, onMinErOverridesChange]
  );

  const handleReset = useCallback(() => {
    const { [charId]: _, ...restCombo } = comboOverridesRef.current;
    onComboOverridesChange(restCombo);
    const { [charId]: __, ...restMinEr } = minErOverridesRef.current;
    onMinErOverridesChange(restMinEr);
  }, [charId, onComboOverridesChange, onMinErOverridesChange]);

  // Filter reaction configs: only show if >0 count in any constellation
  const activeReactionConfigs = useMemo(() => {
    return reactionConfigs.filter((rc) => {
      // Find the variant lineKey for this reaction
      const row = formulaRows.find((r) => r.formulaId === rc.formulaId);
      if (!row) return false;
      const variant = row.variants.find(
        (v) => v.reactionType === rc.reactionType
      );
      if (!variant) return false;

      // Check if >0 count in any constellation
      for (const c of constellations) {
        if (c < startC || c > maxC) continue;
        if (c < (row.minC ?? 0)) continue;
        const override = comboOverrides[charId]?.[c]?.[variant.lineKey];
        if (override != null) {
          if (override > 0) return true;
        } else {
          // Compute default
          const descTotal = row.getDescriptorCount(c);
          const templateTotal = row.variants.reduce(
            (s, v) => s + v.templateCount,
            0
          );
          const defaultCount =
            row.variants.length <= 1
              ? descTotal
              : templateTotal > 0
                ? Math.round(
                    (variant.templateCount / templateTotal) * descTotal
                  )
                : variant.reactionType === "none"
                  ? descTotal
                  : 0;
          if (defaultCount > 0) return true;
        }
      }
      return false;
    });
  }, [
    reactionConfigs,
    formulaRows,
    constellations,
    startC,
    maxC,
    comboOverrides,
    charId,
  ]);

  // Also filter by element eligibility
  const visibleReactionConfigs = useMemo(() => {
    const charElement = teamBuild.teamMeta.elements[charId];
    if (!charElement) return [];
    const eligible =
      ELEMENT_ELIGIBLE_REACTIONS[
        charElement as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
      ];
    if (!eligible || eligible.length <= 1) return [];
    return activeReactionConfigs;
  }, [activeReactionConfigs, teamBuild.teamMeta.elements, charId]);

  if (formulaRows.length === 0) return null;

  return (
    <div className="flex flex-col rounded-lg bg-black/10 border border-border/30 p-1.5 gap-1.5 xl:p-2">
      {/* Header: character avatar + name + reset */}
      <div className="flex items-center gap-1.5">
        {char && (
          <img
            src={getAssetUrl(char.imagePath)}
            alt={charId}
            className="w-5 h-5 rounded-full"
          />
        )}
        <span className="font-bold text-foreground/90 truncate min-w-0 text-xs md:text-base lg:text-sm xl:text-base">
          {t.character(charId)}
        </span>
        {hasOverrides && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs ml-auto"
            onClick={handleReset}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            {t.ui("teamComp.analyzerResetDefaults")}
          </Button>
        )}
      </div>

      {/* Content: table + reaction configs side by side */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Combo count table */}
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left pr-1 py-0.5 font-normal border border-border whitespace-nowrap" />
                {constellations.map((c) => (
                  <th
                    key={c}
                    className="text-center px-1 py-0.5 font-normal w-[3.5rem] min-w-[3.5rem] border border-border"
                  >
                    {t.format("common.constellationFormat", c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Min ER row */}
              <tr>
                <td className="text-left pr-1 py-0.5 whitespace-nowrap text-xs font-semibold border border-border">
                  {t.ui("teamComp.analyzerMinEr")}
                </td>
                {constellations.map((c) => {
                  const inRange = c >= startC && c <= maxC;
                  if (!inRange) {
                    return (
                      <td
                        key={c}
                        className="text-center px-1 py-0.5 text-muted-foreground border border-border"
                      >
                        —
                      </td>
                    );
                  }
                  const baseErPct = Math.round(baseMinEr * 100);
                  const override = minErOverrides[charId]?.[c];
                  const isOverridden = override != null;
                  const displayValue = isOverridden
                    ? Math.round(override * 100)
                    : baseErPct;

                  return (
                    <td
                      key={c}
                      className="text-center px-0.5 py-0.5 border border-border"
                    >
                      <NumericCell
                        value={displayValue}
                        defaultValue={baseErPct}
                        isOverridden={isOverridden}
                        onCommit={(num) => {
                          if (num == null || num === baseErPct) {
                            handleMinErChange(c, undefined);
                          } else {
                            handleMinErChange(c, num / 100);
                          }
                        }}
                        min={100}
                        max={300}
                        suffix="%"
                        small
                      />
                    </td>
                  );
                })}
              </tr>
              {/* Formula rows — one row per formula, cells contain stacked variants */}
              {formulaRows.map((row) => (
                <tr key={row.formulaId}>
                  <td className="text-left pr-1 py-0.5 border border-border whitespace-nowrap">
                    {row.label ? (
                      <FormulaLabel
                        label={row.label}
                        minC={row.minC}
                        formulaId={row.formulaId}
                        charId={charId}
                        teamBuild={teamBuild}
                      />
                    ) : (
                      <span className="text-xs">{row.formulaId}</span>
                    )}
                  </td>
                  {constellations.map((c) => {
                    const inRange = c >= startC && c <= maxC;
                    if (!inRange || c < row.minC) {
                      return (
                        <td
                          key={c}
                          className="text-center px-1 py-0.5 text-muted-foreground border border-border"
                        >
                          —
                        </td>
                      );
                    }

                    const descTotal = row.getDescriptorCount(c);
                    const templateTotal = row.variants.reduce(
                      (s, v) => s + v.templateCount,
                      0
                    );
                    const hasMultipleVariants = row.variants.length > 1;
                    const hasOnlyDirect =
                      !hasMultipleVariants &&
                      (!row.variants[0]?.reactionType ||
                        row.variants[0]?.reactionType === "none");

                    return (
                      <td
                        key={c}
                        className="px-0.5 py-0.5 border border-border align-top"
                      >
                        <div className="flex flex-col gap-0.5">
                          {row.variants.map((v) => {
                            // Default count: distribute descriptor total
                            // proportionally to template counts.
                            // If no template lines, only "none" gets the count.
                            const defaultCount =
                              row.variants.length <= 1
                                ? descTotal
                                : templateTotal > 0
                                  ? Math.round(
                                      (v.templateCount / templateTotal) *
                                        descTotal
                                    )
                                  : v.reactionType === "none"
                                    ? descTotal
                                    : 0;
                            const override =
                              comboOverrides[charId]?.[c]?.[v.lineKey];
                            const isOverridden = override != null;
                            const displayValue = isOverridden
                              ? override
                              : defaultCount;

                            return (
                              <div
                                key={v.lineKey}
                                className="flex items-center gap-0.5 justify-center"
                              >
                                {/* Show reaction label only when multiple variants */}
                                {!hasOnlyDirect && (
                                  <span className="text-[9px] text-foreground/80 shrink-0 w-7 text-right truncate">
                                    {v.reactionType
                                      ? t.reaction(v.reactionType)
                                      : t.reaction("none")}
                                  </span>
                                )}
                                <NumericCell
                                  value={displayValue}
                                  defaultValue={defaultCount}
                                  isOverridden={isOverridden}
                                  onCommit={(num) => {
                                    if (num == null || num === defaultCount) {
                                      handleCountChange(
                                        c,
                                        v.lineKey,
                                        undefined
                                      );
                                    } else {
                                      handleCountChange(c, v.lineKey, num);
                                    }
                                  }}
                                  min={0}
                                  small={hasMultipleVariants}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reaction config panels (right side) */}
        {visibleReactionConfigs.length > 0 && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {visibleReactionConfigs.map((rc) => {
              const charBuild = teamBuild.charBuilds[charId];
              const formulaEntry = charBuild?.charBase.getFormulaEntry(
                rc.formulaId
              );
              if (!formulaEntry) return null;

              return (
                <div
                  key={rc.stableKey}
                  className="rounded border border-border bg-black/5 px-2 py-1.5 text-xs"
                >
                  <div className="font-medium mb-1">
                    {allFormulas[rc.formulaId]?.label
                      ? t.resolveLabel(allFormulas[rc.formulaId].label)
                      : rc.formulaId}{" "}
                    <span className="text-muted-foreground">
                      [{t.reaction(rc.reactionType)}]
                    </span>
                  </div>
                  <ReactionPartControls
                    formulaEntry={formulaEntry}
                    charId={charId}
                    reactionType={rc.reactionType as ReactionType}
                    reactionOverride={rc.reaction}
                    onReactionChange={(override) =>
                      onReactionChange(rc.stableKey, override)
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Numeric cell with local editing state ───

function NumericCell({
  value,
  defaultValue,
  isOverridden,
  onCommit,
  min = 0,
  max,
  suffix,
  small,
}: {
  value: number;
  defaultValue: number;
  isOverridden: boolean;
  onCommit: (num: number | undefined) => void;
  min?: number;
  max?: number;
  suffix?: string;
  small?: boolean;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setLocalValue(String(value));
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = localValue.trim();
    if (trimmed === "") {
      onCommit(undefined);
      return;
    }
    const num = Number.parseInt(trimmed, 10);
    if (
      Number.isNaN(num) ||
      (min != null && num < min) ||
      (max != null && num > max)
    ) {
      setLocalValue(String(value));
      return;
    }
    onCommit(num);
  }, [localValue, value, onCommit, min, max]);

  return (
    <span className="inline-flex items-center gap-0.5">
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={editing ? localValue : String(value)}
        onFocus={() => {
          setEditing(true);
          setLocalValue(String(value));
        }}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            setEditing(false);
            setLocalValue(String(value));
            inputRef.current?.blur();
          }
        }}
        className={cn(
          "h-6 text-center px-1",
          small ? "w-10 text-[10px]" : "w-12 text-xs",
          isOverridden && "ring-1 ring-amber-400"
        )}
      />
      {suffix && (
        <span className="text-muted-foreground text-[10px]">{suffix}</span>
      )}
    </span>
  );
}
