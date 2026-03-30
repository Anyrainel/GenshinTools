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
import { getFormulaReactions } from "@/lib/team-comp/constants";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import type { FormulaEntry } from "@/lib/team-comp/damageModels";
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

// ─── Public API ───

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
            onComboOverridesChange={onComboOverridesChange}
            onMinErOverridesChange={onMinErOverridesChange}
            onReactionChange={onReactionChange}
          />
        );
      })}
    </div>
  );
}

// ─── Data model ───

/** One reaction variant of a formula (e.g. "Q Direct", "Q Melt"). */
type Variant = {
  /** Key for override storage, e.g. "burst" or "burst:melt" */
  lineKey: string;
  /** "none" for direct, "melt"/"vaporize"/etc for reactions */
  reactionType: ReactionType;
  /** Default count at constellation c (from template proportions) */
  getDefault: (c: number) => number;
  /** The reaction override config (undefined for direct/"none") */
  reaction: ReactionOverride | undefined;
  /** FormulaEntry for per-part config (only set for non-direct variants) */
  formulaEntry: FormulaEntry | undefined;
};

/** One formula row with all its reaction variants. */
type FormulaRow = {
  formulaId: string;
  label: I18nLabel | undefined;
  minC: number;
  variants: Variant[];
  /** Whether to show reaction labels in cells (true when >1 variant) */
  showLabels: boolean;
};

// ─── Per-character section ───

function CharComboRow({
  charId,
  config,
  teamBuild,
  templateCombo,
  comboOverrides,
  minErOverrides,
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
  const constellations = useMemo(() => {
    if (config.rarity >= 5) return [0, 1, 2, 3, 4, 5, 6];
    const cols: number[] = [];
    for (let c = startC; c <= maxC; c++) cols.push(c);
    return cols;
  }, [config.rarity, startC, maxC]);

  const descriptor = teamBuild.getComboDescriptor(charId);
  const allFormulas = teamBuild.getAllFormulaIds()[charId] ?? {};

  const descriptorCounts = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const c of constellations) {
      map[c] = resolveComboDescriptor(descriptor, c);
    }
    return map;
  }, [constellations, descriptor]);

  // ─── Build formula rows ───
  const formulaRows = useMemo(() => {
    const charElement = teamBuild.teamMeta.elements[charId];
    const hasReactionFn = (rx: ReactionType, id?: string) =>
      teamBuild.teamMeta.hasReaction(rx, id);

    // Index template lines: formulaId → reactionType → { count, reaction }
    const templateIndex: Record<
      string,
      Record<string, { count: number; reaction?: ReactionOverride }>
    > = {};
    for (const line of templateCombo.lines) {
      if (line.charId !== charId) continue;
      const rx = line.reaction?.reaction ?? "none";
      if (!templateIndex[line.formulaId]) templateIndex[line.formulaId] = {};
      const byFormula = templateIndex[line.formulaId];
      byFormula[rx] = {
        count: (byFormula[rx]?.count ?? 0) + line.count,
        reaction: line.reaction ?? byFormula[rx]?.reaction,
      };
    }

    const rows: FormulaRow[] = [];
    const seen = new Set<string>();

    for (const entry of descriptor) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);

      const formulaInfo = allFormulas[entry.id];
      const formulaEntry =
        teamBuild.charBuilds[charId]?.charBase.getFormulaEntry(entry.id) ??
        null;
      const reactions = getFormulaReactions(
        charId,
        formulaEntry,
        charElement,
        hasReactionFn
      );

      // Template counts for proportional distribution
      const templateByRx = templateIndex[entry.id] ?? {};
      const templateTotal = Object.values(templateByRx).reduce(
        (s, t) => s + t.count,
        0
      );

      const variants: Variant[] = reactions.map((rx) => {
        const tmpl = templateByRx[rx];
        const tmplCount = tmpl?.count ?? 0;
        const isReaction = rx !== "none";

        return {
          lineKey: comboLineKey(
            entry.id,
            isReaction ? { reaction: rx } : undefined
          ),
          reactionType: rx,
          getDefault: (c: number) => {
            const desc = descriptorCounts[c]?.[entry.id] ?? 0;
            if (reactions.length <= 1) return desc;
            if (templateTotal > 0)
              return Math.round((tmplCount / templateTotal) * desc);
            return rx === "none" ? desc : 0;
          },
          reaction: isReaction
            ? (tmpl?.reaction ?? { reaction: rx })
            : undefined,
          formulaEntry: isReaction ? (formulaEntry ?? undefined) : undefined,
        };
      });

      rows.push({
        formulaId: entry.id,
        label: formulaInfo?.label,
        minC: formulaInfo?.minC ?? 0,
        variants,
        showLabels: reactions.length > 1,
      });
    }

    return rows;
  }, [
    descriptor,
    allFormulas,
    templateCombo.lines,
    charId,
    descriptorCounts,
    teamBuild,
  ]);

  // ─── Effective count at a constellation (override or default) ───
  const effectiveCount = useCallback(
    (v: Variant, c: number) =>
      comboOverrides[charId]?.[c]?.[v.lineKey] ?? v.getDefault(c),
    [comboOverrides, charId]
  );

  // ─── Handlers ───

  const handleCountChange = useCallback(
    (
      constellation: number,
      lineKey: string,
      value: number | undefined,
      getDefault: (c: number) => number
    ) => {
      const prev = comboOverridesRef.current;
      const eff = (c: number) => prev[charId]?.[c]?.[lineKey] ?? getDefault(c);
      const oldValue = eff(constellation);

      // Cascade: update higher constellations that share the same old value
      const targets = [constellation];
      for (const c of constellations) {
        if (c <= constellation || c < startC || c > maxC) continue;
        if (eff(c) !== oldValue) break;
        targets.push(c);
      }

      let next = { ...prev };
      for (const c of targets) {
        const newVal = value == null ? undefined : value;
        if (newVal == null || newVal === getDefault(c)) {
          // Clear override
          if (next[charId]?.[c]?.[lineKey] != null) {
            const { [lineKey]: _, ...rest } = next[charId][c];
            if (Object.keys(rest).length > 0) {
              next = { ...next, [charId]: { ...next[charId], [c]: rest } };
            } else {
              const { [c]: __, ...restC } = next[charId];
              next =
                Object.keys(restC).length > 0
                  ? { ...next, [charId]: restC }
                  : (({ [charId]: ___, ...r }) => r)(next);
            }
          }
        } else {
          next = {
            ...next,
            [charId]: {
              ...next[charId],
              [c]: { ...next[charId]?.[c], [lineKey]: newVal },
            },
          };
        }
      }
      onComboOverridesChange(next);
    },
    [charId, onComboOverridesChange, constellations, startC, maxC]
  );

  const handleMinErChange = useCallback(
    (constellation: number, value: number | undefined) => {
      const prev = minErOverridesRef.current;
      if (value == null) {
        if (!prev[charId]) return;
        const { [constellation]: _, ...rest } = prev[charId];
        onMinErOverridesChange(
          Object.keys(rest).length > 0
            ? { ...prev, [charId]: rest }
            : (({ [charId]: __, ...r }) => r)(prev)
        );
      } else {
        onMinErOverridesChange({
          ...prev,
          [charId]: { ...prev[charId], [constellation]: value },
        });
      }
    },
    [charId, onMinErOverridesChange]
  );

  const handleReset = useCallback(() => {
    const { [charId]: _, ...restCombo } = comboOverridesRef.current;
    onComboOverridesChange(restCombo);
    const { [charId]: __, ...restMinEr } = minErOverridesRef.current;
    onMinErOverridesChange(restMinEr);
  }, [charId, onComboOverridesChange, onMinErOverridesChange]);

  const hasOverrides = useMemo(() => {
    return (
      (comboOverrides[charId] &&
        Object.keys(comboOverrides[charId]).length > 0) ||
      (minErOverrides[charId] && Object.keys(minErOverrides[charId]).length > 0)
    );
  }, [comboOverrides, minErOverrides, charId]);

  // ─── Collect reaction variants that need config panels ───
  // A non-direct variant needs a config panel if it has >0 count in any constellation.
  const reactionPanels = useMemo(() => {
    const panels: {
      formulaId: string;
      label: I18nLabel | undefined;
      variant: Variant;
    }[] = [];
    for (const row of formulaRows) {
      for (const v of row.variants) {
        if (v.reactionType === "none" || !v.formulaEntry) continue;
        const hasCount = constellations.some(
          (c) =>
            c >= startC &&
            c <= maxC &&
            c >= row.minC &&
            effectiveCount(v, c) > 0
        );
        if (hasCount) {
          panels.push({
            formulaId: row.formulaId,
            label: row.label,
            variant: v,
          });
        }
      }
    }
    return panels;
  }, [formulaRows, constellations, startC, maxC, effectiveCount]);

  if (formulaRows.length === 0) return null;

  const baseMinEr = 1.0;
  const baseErPct = Math.round(baseMinEr * 100);

  // ─── Render ───
  return (
    <div className="flex flex-col rounded-lg bg-black/10 border border-border/30 p-1.5 gap-1.5 xl:p-2">
      {/* Header */}
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

      {/* Table + config panels side by side */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Count table */}
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
                  if (c < startC || c > maxC) {
                    return (
                      <td
                        key={c}
                        className="text-center px-1 py-0.5 text-muted-foreground border border-border"
                      >
                        —
                      </td>
                    );
                  }
                  const override = minErOverrides[charId]?.[c];
                  const display =
                    override != null ? Math.round(override * 100) : baseErPct;
                  return (
                    <td
                      key={c}
                      className="text-center px-0.5 py-0.5 border border-border"
                    >
                      <NumericCell
                        value={display}
                        defaultValue={baseErPct}
                        onCommit={(num) =>
                          handleMinErChange(
                            c,
                            num == null || num === baseErPct
                              ? undefined
                              : num / 100
                          )
                        }
                        min={100}
                        max={300}
                        suffix="%"
                        small
                      />
                    </td>
                  );
                })}
              </tr>

              {/* Formula rows */}
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
                    if (c < startC || c > maxC || c < row.minC) {
                      return (
                        <td
                          key={c}
                          className="text-center px-1 py-0.5 text-muted-foreground border border-border"
                        >
                          —
                        </td>
                      );
                    }
                    return (
                      <td
                        key={c}
                        className="px-0.5 py-0.5 border border-border align-top"
                      >
                        <div className="flex flex-col gap-0.5">
                          {row.variants.map((v) => {
                            const def = v.getDefault(c);
                            const val = effectiveCount(v, c);
                            return (
                              <div
                                key={v.lineKey}
                                className="flex items-center gap-0.5 justify-center"
                              >
                                {row.showLabels && (
                                  <span className="text-[10px] text-foreground/80 shrink-0 w-7 text-right truncate">
                                    {t.reaction(v.reactionType)}
                                  </span>
                                )}
                                <NumericCell
                                  value={val}
                                  defaultValue={def}
                                  onCommit={(num) =>
                                    handleCountChange(
                                      c,
                                      v.lineKey,
                                      num == null || num === def
                                        ? undefined
                                        : num,
                                      v.getDefault
                                    )
                                  }
                                  min={0}
                                  small={row.showLabels}
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

        {/* Reaction config panels */}
        {reactionPanels.length > 0 && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {reactionPanels.map(({ formulaId, label, variant: v }) => (
              <div
                key={`${charId}.${formulaId}.${v.reactionType}`}
                className="rounded border border-border bg-black/5 px-2 py-1.5 text-xs"
              >
                <div className="font-medium mb-1">
                  {label ? t.resolveLabel(label) : formulaId}{" "}
                  <span className="text-muted-foreground">
                    [{t.reaction(v.reactionType)}]
                  </span>
                </div>
                <ReactionPartControls
                  formulaEntry={v.formulaEntry!}
                  charId={charId}
                  reactionType={v.reactionType}
                  reactionOverride={v.reaction ?? {}}
                  onReactionChange={(override) =>
                    onReactionChange(`${charId}.${formulaId}`, override)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Numeric cell ───

function NumericCell({
  value,
  defaultValue,
  onCommit,
  min = 0,
  max,
  suffix,
  small,
}: {
  value: number;
  defaultValue: number;
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
          "h-6 text-center px-0.5",
          small ? "w-8 text-[10px]" : "w-12 text-xs"
        )}
      />
      {suffix && (
        <span className="text-muted-foreground text-[10px]">{suffix}</span>
      )}
    </span>
  );
}
