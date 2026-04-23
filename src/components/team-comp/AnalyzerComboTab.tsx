import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReactionType } from "@/data/enums";
import { charactersById } from "@/data/gameResources";
import type { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import {
  getFormulaReactions,
  type ReactionComboGridRow,
} from "@/lib/dmgcalc/core/teamFormulaCatalog";
import type {
  ComboFormula,
  FormulaEntry,
  I18nLabel,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import {
  comboLineKey,
  comboOverrideKey,
  hasCharOverrides,
  minErOverrideKey,
  removeCharOverrides,
  rxCharOverrideKey,
  rxDeltaOverrideKey,
} from "@/lib/team-comp/analyzer/analyzer";
import type {
  AnalyzerCharConfig,
  ComboCountOverrides,
  MinErOverrides,
} from "@/lib/team-comp/analyzer/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { FormulaLabel } from "./FormulaLabel";
import { ReactionPartControls } from "./ReactionPartControls";

interface AnalyzerComboTabProps {
  teamBuild: TeamBuild;
  charConfigs: AnalyzerCharConfig[];
  baseConfigs: TeamSlotConfig[];
  templateCombo: ComboFormula;
  comboOverrides: ComboCountOverrides;
  minErOverrides: MinErOverrides;
  /** Stored reaction overrides keyed by "charId.formulaId" — read directly for config panels. */
  reactionOverrides: Record<string, ReactionOverride>;
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
  reactionOverrides,
  onComboOverridesChange,
  onMinErOverridesChange,
  onReactionChange,
}: AnalyzerComboTabProps) {
  const rxGrid = teamBuild.catalog.getReactionComboGrid();
  const hasRxFormulas = rxGrid.length > 0;

  return (
    <div className="flex flex-wrap justify-center items-start gap-x-3 gap-y-2 lg:gap-x-5 lg:gap-y-3">
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
            reactionOverrides={reactionOverrides}
            onComboOverridesChange={onComboOverridesChange}
            onMinErOverridesChange={onMinErOverridesChange}
            onReactionChange={onReactionChange}
            rxGrid={rxGrid}
          />
        );
      })}
      {hasRxFormulas && (
        <ReactionComboTable
          baseConfigs={baseConfigs}
          rxGrid={rxGrid}
          comboOverrides={comboOverrides}
          onComboOverridesChange={onComboOverridesChange}
        />
      )}
    </div>
  );
}

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

function CharComboRow({
  charId,
  config,
  teamBuild,
  templateCombo,
  comboOverrides,
  minErOverrides,
  reactionOverrides,
  onComboOverridesChange,
  onMinErOverridesChange,
  onReactionChange,
  rxGrid,
}: {
  charId: string;
  config: AnalyzerCharConfig;
  teamBuild: TeamBuild;
  templateCombo: ComboFormula;
  comboOverrides: ComboCountOverrides;
  minErOverrides: MinErOverrides;
  reactionOverrides: Record<string, ReactionOverride>;
  onComboOverridesChange: (overrides: ComboCountOverrides) => void;
  onMinErOverridesChange: (overrides: MinErOverrides) => void;
  onReactionChange: (stableKey: string, override: ReactionOverride) => void;
  rxGrid: ReactionComboGridRow[];
}) {
  const { t } = useLanguage();
  const char = charactersById[charId];
  const comboRef = useRef(comboOverrides);
  comboRef.current = comboOverrides;
  const minErRef = useRef(minErOverrides);
  minErRef.current = minErOverrides;

  const startC = config.startConstellation;
  const maxC = config.maxConstellation;
  const constellations = useMemo(() => {
    const cols: number[] = [];
    for (let c = startC; c <= maxC; c++) cols.push(c);
    return cols;
  }, [startC, maxC]);

  const allFormulas = teamBuild.catalog.getAllFormulaIds()[charId] ?? {};

  // Rx- deltas gated by this character's constellation
  const charRxDeltas = useMemo(() => {
    const result: { row: ReactionComboGridRow; minC: number; delta: number }[] =
      [];
    for (const row of rxGrid) {
      for (const b of row.bonus) {
        if (b.charId === charId) {
          result.push({ row, minC: b.minC, delta: b.delta });
        }
      }
    }
    return result;
  }, [rxGrid, charId]);

  const descriptorCounts = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const c of constellations) {
      map[c] = teamBuild.catalog.resolveCombo(charId, c);
    }
    return map;
  }, [constellations, teamBuild, charId]);

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

    // Collect all formula IDs: combo counts first (preserving order), then remaining
    const allFormulaIds: string[] = [];
    const seen = new Set<string>();
    for (const formulaId of Object.keys(descriptorCounts[startC] ?? {})) {
      if (seen.has(formulaId)) continue;
      seen.add(formulaId);
      allFormulaIds.push(formulaId);
    }
    for (const formulaId of Object.keys(allFormulas)) {
      if (seen.has(formulaId)) continue;
      seen.add(formulaId);
      allFormulaIds.push(formulaId);
    }

    return allFormulaIds.map((formulaId) => {
      const formulaInfo = allFormulas[formulaId];
      const formulaEntry =
        teamBuild.catalog.formulaIndex.get(formulaId) ?? null;
      const reactions = getFormulaReactions(
        charId,
        formulaEntry,
        charElement,
        hasReactionFn
      );
      const templateByRx = templateIndex[formulaId] ?? {};

      const variants: Variant[] = reactions.map((rx) => {
        const tmpl = templateByRx[rx];
        const isReaction = rx !== "none";
        return {
          lineKey: comboLineKey(
            formulaId,
            isReaction ? { reaction: rx } : undefined
          ),
          reactionType: rx,
          getDefault: (c: number) => {
            const desc = descriptorCounts[c]?.[formulaId] ?? 0;
            return rx === "none" ? desc : 0;
          },
          reaction: isReaction
            ? (tmpl?.reaction ?? { reaction: rx })
            : undefined,
          formulaEntry: isReaction ? (formulaEntry ?? undefined) : undefined,
        };
      });

      return {
        formulaId,
        label: formulaInfo?.label,
        minC: formulaInfo?.minC ?? 0,
        variants,
        showLabels: reactions.length > 1,
      };
    });
  }, [
    startC,
    allFormulas,
    templateCombo.lines,
    charId,
    descriptorCounts,
    teamBuild,
  ]);

  // ─── Effective count (override or default) ───
  const effectiveCount = useCallback(
    (v: Variant, c: number) =>
      comboOverrides[comboOverrideKey(charId, c, v.lineKey)] ?? v.getDefault(c),
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
      const prev = comboRef.current;
      const eff = (c: number) =>
        prev[comboOverrideKey(charId, c, lineKey)] ?? getDefault(c);
      const oldValue = eff(constellation);

      // Cascade: update higher constellations that share the same old value
      const targets = [constellation];
      for (const c of constellations) {
        if (c <= constellation || c < startC || c > maxC) continue;
        if (eff(c) !== oldValue) break;
        targets.push(c);
      }

      const next = { ...prev };
      for (const c of targets) {
        const key = comboOverrideKey(charId, c, lineKey);
        if (value == null || value === getDefault(c)) {
          delete next[key];
        } else {
          next[key] = value;
        }
      }
      onComboOverridesChange(next);
    },
    [charId, onComboOverridesChange, constellations, startC, maxC]
  );

  const handleMinErChange = useCallback(
    (constellation: number, value: number | undefined) => {
      const prev = minErRef.current;
      const key = minErOverrideKey(charId, constellation);
      const next = { ...prev };
      if (value == null) {
        delete next[key];
      } else {
        next[key] = value;
      }
      onMinErOverridesChange(next);
    },
    [charId, onMinErOverridesChange]
  );

  const handleReset = useCallback(() => {
    onComboOverridesChange(removeCharOverrides(comboRef.current, charId));
    onMinErOverridesChange(removeCharOverrides(minErRef.current, charId));
  }, [charId, onComboOverridesChange, onMinErOverridesChange]);

  const hasOverrides =
    hasCharOverrides(comboOverrides, charId) ||
    hasCharOverrides(minErOverrides, charId);

  // ─── Reaction config panels ───
  // Show for non-direct variants with >0 count in any active constellation.
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
    <div className="flex flex-col rounded-lg bg-black/10 border border-sky-600/50 p-1.5 gap-1.5 xl:p-2">
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

      {/* Table + config panels: side by side at lg+, stacked below md */}
      <div className="flex flex-col lg:flex-row items-start gap-2">
        {/* Count table */}
        <div className="overflow-x-auto shrink-0">
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
                  const override = minErOverrides[minErOverrideKey(charId, c)];
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
                    if (c < row.minC) {
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

              {/* Rx- delta rows: this character's constellation-gated delta */}
              {charRxDeltas.map(({ row, minC, delta }) => {
                const rxType = row.baseId.replace("rx-", "") as ReactionType;
                const overrideKey = rxDeltaOverrideKey(charId, row.baseId);
                const effectiveDelta = comboOverrides[overrideKey] ?? delta;
                return (
                  <tr key={row.baseId} className="bg-purple-500/5">
                    <td className="text-left pr-1 py-0.5 border border-border whitespace-nowrap">
                      <span className="text-xs text-purple-300">
                        {t.reaction(rxType)}{" "}
                        <span className="text-[10px] text-muted-foreground">
                          Δ
                        </span>
                      </span>
                    </td>
                    {constellations.map((c) => {
                      if (c < minC) {
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
                          className="px-0.5 py-0.5 border border-border"
                        >
                          <NumericCell
                            value={effectiveDelta}
                            defaultValue={delta}
                            onCommit={(num) => {
                              const next = { ...comboOverrides };
                              if (num == null || num === delta) {
                                delete next[overrideKey];
                              } else {
                                next[overrideKey] = num;
                              }
                              onComboOverridesChange(next);
                            }}
                            min={0}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Reaction config panels */}
        {reactionPanels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {reactionPanels.map(({ formulaId, label, variant: v }) => {
              const stableKey = `${charId}.${formulaId}`;
              const storedOverride = reactionOverrides[stableKey] ?? {
                reaction: v.reactionType,
              };
              return (
                <div
                  key={`${stableKey}.${v.reactionType}`}
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
                    reactionOverride={storedOverride}
                    onReactionChange={(override) =>
                      onReactionChange(stableKey, override)
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
        placeholder={String(defaultValue)}
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

// ─── Team Reaction Combo Table ───

function ReactionComboTable({
  baseConfigs,
  rxGrid,
  comboOverrides,
  onComboOverridesChange,
}: {
  baseConfigs: TeamSlotConfig[];
  rxGrid: ReactionComboGridRow[];
  comboOverrides: ComboCountOverrides;
  onComboOverridesChange: (overrides: ComboCountOverrides) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col rounded-lg bg-black/10 border border-purple-600/50 p-1.5 gap-1.5 xl:p-2">
      <span className="font-bold text-foreground/90 text-xs md:text-base lg:text-sm xl:text-base">
        {t.ui("teamComp.teamReactions")}
      </span>
      <div className="overflow-x-auto shrink-0">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left pr-1 py-0.5 font-normal border border-border whitespace-nowrap" />
              {baseConfigs.map((cfg) => {
                const char = charactersById[cfg.charId];
                return (
                  <th
                    key={cfg.charId}
                    className="text-center px-1 py-0.5 font-normal border border-border"
                  >
                    <div className="flex items-center gap-1 justify-center">
                      {char && (
                        <img
                          src={getAssetUrl(char.imagePath)}
                          alt={cfg.charId}
                          className="w-4 h-4 rounded-full"
                        />
                      )}
                      <span className="text-[10px] truncate max-w-[4rem]">
                        {t.character(cfg.charId)}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rxGrid.map((row) => {
              const roleLabel = t.ui(
                row.isMultiContributor
                  ? "teamComp.rxOnField"
                  : "teamComp.rxTrigger"
              );

              return (
                <tr key={row.baseId}>
                  <td className="text-left pr-1 py-0.5 border border-border whitespace-nowrap">
                    <span className="text-xs text-purple-300">
                      {t.resolveLabel(row.label)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-0.5">
                      ({roleLabel})
                    </span>
                  </td>
                  {baseConfigs.map((cfg) => {
                    const overrideKey = rxCharOverrideKey(
                      cfg.charId,
                      row.baseId
                    );
                    const isEligible = row.eligible.has(cfg.charId);
                    const defaultCount = row.counts[cfg.charId] ?? 0;
                    const effectiveCount =
                      comboOverrides[overrideKey] ?? defaultCount;
                    return (
                      <td
                        key={cfg.charId}
                        className="px-0.5 py-0.5 border border-border"
                      >
                        {isEligible ? (
                          <NumericCell
                            value={effectiveCount}
                            defaultValue={defaultCount}
                            onCommit={(num) => {
                              const next = { ...comboOverrides };
                              if (num == null || num === defaultCount) {
                                delete next[overrideKey];
                              } else {
                                next[overrideKey] = num;
                              }
                              onComboOverridesChange(next);
                            }}
                            min={0}
                          />
                        ) : (
                          <span className="flex justify-center text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
