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
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import type {
  ComboFormula,
  I18nLabel,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { resolveComboDescriptor } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormulaLabel } from "./FormulaLabel";

interface AnalyzerComboTabProps {
  teamBuild: TeamBuild;
  charConfigs: AnalyzerCharConfig[];
  baseConfigs: TeamSlotConfig[];
  templateCombo: ComboFormula;
  comboOverrides: ComboCountOverrides;
  minErOverrides: MinErOverrides;
  perChar?: Record<string, { minEr: number; minCr: number }>;
  onComboOverridesChange: (overrides: ComboCountOverrides) => void;
  onMinErOverridesChange: (overrides: MinErOverrides) => void;
}

export function AnalyzerComboTab({
  teamBuild,
  charConfigs,
  baseConfigs,
  templateCombo,
  comboOverrides,
  minErOverrides,
  perChar,
  onComboOverridesChange,
  onMinErOverridesChange,
}: AnalyzerComboTabProps) {
  return (
    <div className="space-y-4">
      {charConfigs.map((cfg) => {
        const bc = baseConfigs.find((b) => b.charId === cfg.charId);
        if (!bc) return null;
        return (
          <CharComboGrid
            key={cfg.charId}
            charId={cfg.charId}
            config={cfg}
            teamBuild={teamBuild}
            templateCombo={templateCombo}
            comboOverrides={comboOverrides}
            minErOverrides={minErOverrides}
            baseMinEr={perChar?.[cfg.charId]?.minEr ?? 1.0}
            onComboOverridesChange={onComboOverridesChange}
            onMinErOverridesChange={onMinErOverridesChange}
          />
        );
      })}
    </div>
  );
}

// ─── Row data types ───

/** A reaction variant from the template combo for a given formulaId. */
type ReactionVariant = {
  lineKey: string; // comboLineKey: formulaId or formulaId:reactionType
  reactionType: string | undefined;
  templateCount: number;
  reaction?: ReactionOverride; // full config for display
};

/** One row per formulaId from the descriptor. */
type FormulaRow = {
  formulaId: string;
  label: I18nLabel | undefined;
  minC: number;
  /** Reaction variants from the template combo. Empty = no template lines for this formula. */
  variants: ReactionVariant[];
  /** Sum of template variant counts (for proportional distribution). */
  templateTotal: number;
};

// ─── Per-character grid ───

function CharComboGrid({
  charId,
  config,
  teamBuild,
  templateCombo,
  comboOverrides,
  minErOverrides,
  baseMinEr,
  onComboOverridesChange,
  onMinErOverridesChange,
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
}) {
  const { t } = useLanguage();
  const char = charactersById[charId];

  // Use refs so callbacks always read the latest override state
  const comboOverridesRef = useRef(comboOverrides);
  comboOverridesRef.current = comboOverrides;
  const minErOverridesRef = useRef(minErOverrides);
  minErOverridesRef.current = minErOverrides;

  const startC = config.startConstellation;
  const maxC = config.maxConstellation;

  const constellations = useMemo(() => {
    const cols: number[] = [];
    for (let c = startC; c <= maxC; c++) cols.push(c);
    return cols;
  }, [startC, maxC]);

  // Get combo descriptor and all formula info from character impl
  const descriptor = teamBuild.getComboDescriptor(charId);
  const allFormulas = teamBuild.getAllFormulaIds()[charId] ?? {};

  // Compute descriptor counts per constellation
  const descriptorCounts = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const c of constellations) {
      map[c] = resolveComboDescriptor(descriptor, c);
    }
    return map;
  }, [constellations, descriptor]);

  // Build formula rows from descriptor, attaching template combo variants
  const formulaRows = useMemo<FormulaRow[]>(() => {
    // Collect template lines for this character, grouped by formulaId
    const templateByFormula: Record<string, ReactionVariant[]> = {};
    for (const line of templateCombo.lines) {
      if (line.charId !== charId) continue;
      if (!templateByFormula[line.formulaId])
        templateByFormula[line.formulaId] = [];
      templateByFormula[line.formulaId].push({
        lineKey: comboLineKey(line.formulaId, line.reaction),
        reactionType: line.reaction?.reaction,
        templateCount: line.count,
        reaction: line.reaction,
      });
    }

    // Walk descriptor entries in order
    const seen = new Set<string>();
    const rows: FormulaRow[] = [];
    for (const entry of descriptor) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      const variants = templateByFormula[entry.id] ?? [];
      rows.push({
        formulaId: entry.id,
        label: allFormulas[entry.id]?.label,
        minC: allFormulas[entry.id]?.minC ?? 0,
        variants,
        templateTotal: variants.reduce((s, v) => s + v.templateCount, 0),
      });
    }
    return rows;
  }, [descriptor, allFormulas, templateCombo.lines, charId]);

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

  /** Default count for a variant at constellation c (proportional from descriptor). */
  const getVariantDefault = useCallback(
    (row: FormulaRow, variant: ReactionVariant, c: number): number => {
      const descTotal = descriptorCounts[c]?.[row.formulaId] ?? 0;
      if (row.templateTotal > 0) {
        return Math.round(
          (variant.templateCount / row.templateTotal) * descTotal
        );
      }
      return descTotal;
    },
    [descriptorCounts]
  );

  if (formulaRows.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Header: character name + reset */}
      <div className="flex items-center gap-2">
        {char && (
          <img
            src={getAssetUrl(char.imagePath)}
            alt={charId}
            className="w-5 h-5 rounded-full"
          />
        )}
        <span className="text-sm font-medium">{t.character(charId)}</span>
        {hasOverrides && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={handleReset}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            {t.ui("teamComp.analyzerResetDefaults")}
          </Button>
        )}
      </div>

      {/* Count grid */}
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse mx-auto">
          <thead>
            <tr>
              <th className="text-left pr-2 py-0.5 font-normal" />
              {constellations.map((c) => (
                <th
                  key={c}
                  className="text-center px-1 py-0.5 font-mono font-normal min-w-[2.5rem]"
                >
                  C{c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Min ER row (top) */}
            <tr>
              <td className="text-left pr-2 py-0.5 whitespace-nowrap text-xs font-semibold">
                {t.ui("teamComp.analyzerMinEr")}
              </td>
              {constellations.map((c) => {
                const baseErPct = Math.round(baseMinEr * 100);
                const override = minErOverrides[charId]?.[c];
                const isOverridden = override != null;
                const displayValue = isOverridden
                  ? Math.round(override * 100)
                  : baseErPct;

                return (
                  <td key={c} className="text-center px-0.5 py-0.5">
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
                    />
                  </td>
                );
              })}
            </tr>
            {formulaRows.map((row) => {
              const hasVariants = row.variants.length > 1;

              return (
                <tr key={row.formulaId} className="align-top">
                  <td className="text-left pr-2 py-0.5 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
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
                      {/* Variant reaction labels (stacked beneath formula name) */}
                      {hasVariants &&
                        row.variants.map((v) => (
                          <span
                            key={v.lineKey}
                            className="text-[10px] text-muted-foreground pl-1 leading-tight"
                          >
                            {v.reactionType
                              ? t.reaction(v.reactionType)
                              : t.reaction("none")}
                          </span>
                        ))}
                    </div>
                  </td>
                  {constellations.map((c) => {
                    const enabled = c >= row.minC;

                    if (!enabled) {
                      return (
                        <td
                          key={c}
                          className="text-center px-1 py-0.5 text-muted-foreground"
                        >
                          —
                        </td>
                      );
                    }

                    // No variants or single variant: single input using descriptor count
                    if (row.variants.length <= 1) {
                      const lineKey = row.variants[0]?.lineKey ?? row.formulaId;
                      const defaultCount =
                        descriptorCounts[c]?.[row.formulaId] ?? 0;
                      const override = comboOverrides[charId]?.[c]?.[lineKey];
                      const isOverridden = override != null;
                      const displayValue = isOverridden
                        ? override
                        : defaultCount;

                      return (
                        <td key={c} className="text-center px-0.5 py-0.5">
                          <NumericCell
                            value={displayValue}
                            defaultValue={defaultCount}
                            isOverridden={isOverridden}
                            onCommit={(num) => {
                              if (num == null || num === defaultCount) {
                                handleCountChange(c, lineKey, undefined);
                              } else {
                                handleCountChange(c, lineKey, num);
                              }
                            }}
                            min={0}
                          />
                        </td>
                      );
                    }

                    // Multiple variants: stacked inputs per reaction type
                    return (
                      <td key={c} className="px-0.5 py-0.5">
                        <div className="flex flex-col gap-0.5 items-center">
                          {row.variants.map((v) => {
                            const defaultCount = getVariantDefault(row, v, c);
                            const override =
                              comboOverrides[charId]?.[c]?.[v.lineKey];
                            const isOverridden = override != null;
                            const displayValue = isOverridden
                              ? override
                              : defaultCount;

                            return (
                              <NumericCell
                                key={v.lineKey}
                                value={displayValue}
                                defaultValue={defaultCount}
                                isOverridden={isOverridden}
                                onCommit={(num) => {
                                  if (num == null || num === defaultCount) {
                                    handleCountChange(c, v.lineKey, undefined);
                                  } else {
                                    handleCountChange(c, v.lineKey, num);
                                  }
                                }}
                                min={0}
                              />
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reaction override config cards (from template combo lines) */}
      {formulaRows.some((r) =>
        r.variants.some((v) => v.reaction?.reaction)
      ) && (
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {formulaRows.flatMap((row) =>
            row.variants
              .filter((v) => v.reaction?.reaction)
              .map((v) => (
                <ReactionConfigCard
                  key={v.lineKey}
                  label={row.label}
                  formulaId={row.formulaId}
                  reaction={v.reaction!}
                />
              ))
          )}
        </div>
      )}
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
}: {
  value: number;
  defaultValue: number;
  isOverridden: boolean;
  /** Called with parsed number on blur/enter, or undefined if empty (reset to default). */
  onCommit: (num: number | undefined) => void;
  min?: number;
  max?: number;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value when the external value changes (and we're not mid-edit)
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
        "h-6 w-12 text-xs text-center px-1 font-mono",
        isOverridden && "ring-1 ring-amber-400"
      )}
    />
  );
}

// ─── Reaction config card ───

function ReactionConfigCard({
  label,
  formulaId,
  reaction,
}: {
  label: I18nLabel | undefined;
  formulaId: string;
  reaction: ReactionOverride;
}) {
  const { t } = useLanguage();
  const rx = reaction.reaction!;

  // Collect per-part details
  const partDetails: { index: number; text: string }[] = [];
  if (reaction.partReactions) {
    for (const [idx, rxType] of Object.entries(reaction.partReactions)) {
      partDetails.push({
        index: Number(idx),
        text: t.reaction(rxType),
      });
    }
  }
  if (reaction.partHits) {
    for (const [idx, hits] of Object.entries(reaction.partHits)) {
      const i = Number(idx);
      const existing = partDetails.find((d) => d.index === i);
      if (existing) {
        existing.text += ` ×${hits}`;
      } else {
        partDetails.push({ index: i, text: `×${hits}` });
      }
    }
  }
  partDetails.sort((a, b) => a.index - b.index);

  return (
    <div className="flex flex-col gap-0.5 rounded border border-border px-2 py-1 text-xs">
      <div className="flex items-baseline gap-1">
        <span className="font-medium">
          {label ? t.resolveLabel(label) : formulaId}
        </span>
        <span className="text-muted-foreground">→</span>
        <span>{t.reaction(rx)}</span>
      </div>
      {partDetails.length > 0 && (
        <div className="text-muted-foreground">
          {partDetails.map((d) => (
            <span key={d.index} className="mr-2">
              P{d.index + 1}: {d.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
