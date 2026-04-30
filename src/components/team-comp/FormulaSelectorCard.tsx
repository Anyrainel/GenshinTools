import {
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  Swords,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  OptionButton,
  OptionButtonCell,
  OptionButtonRow,
} from "@/components/ui/option-button";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { Element, ReactionType } from "@/data/enums";
import { charactersById, elementResourcesByName } from "@/data/gameResources";
import { REACTION_ELEMENT_REQUIREMENTS } from "@/lib/dmgcalc/constants";
import type { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import { getFormulaReactions } from "@/lib/dmgcalc/core/teamFormulaCatalog";
import type {
  ComboLine,
  I18nLabel,
  ReactionOverride,
} from "@/lib/dmgcalc/types";
import type { TeamDamageConfig } from "@/lib/team-comp/types";
import { isElement, isReactionType } from "@/lib/typeValidation";
import { cn, getAssetUrl } from "@/lib/utils";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";
import { ExtraBuffsPanel } from "./ExtraBuffsPanel";
import { FormulaLabel } from "./FormulaLabel";
import { ReactionPartControls } from "./ReactionPartControls";

/** Derive the contributing elements for a reaction formula ID. */
function getReactionElements(formulaId: string): Element[] {
  if (formulaId.startsWith("rx-swirl-")) {
    const el = formulaId.slice("rx-swirl-".length);
    return isElement(el) ? ["Anemo", el] : [];
  }
  const reaction = formulaId.slice(3);
  if (!isReactionType(reaction)) return [];
  const req = REACTION_ELEMENT_REQUIREMENTS[reaction];
  if (!req) return [];
  return req.requiredElements.map((slot) => slot[0]);
}

/** Render element icon(s) for a reaction formula. */
function ReactionElementIcons({
  formulaId,
  size,
}: {
  formulaId: string;
  size: string;
}) {
  const elements = getReactionElements(formulaId);
  if (elements.length === 0) return null;
  return (
    <span className="inline-flex items-center shrink-0">
      {elements.map((el) => {
        const res = elementResourcesByName[el];
        return res ? (
          <img
            key={el}
            src={getAssetUrl(res.imagePath)}
            alt={el}
            className={cn(size, "object-contain -ml-0.5 first:ml-0")}
          />
        ) : null;
      })}
    </span>
  );
}

type FormulaInfo = { label: I18nLabel; minC: number };

interface FormulaSelectorCardProps {
  characters: (string | null)[];
  damageConfig: TeamDamageConfig;
  onDamageConfigChange: (
    updater:
      | Partial<TeamDamageConfig>
      | ((config: TeamDamageConfig) => TeamDamageConfig)
  ) => void;
  allFormulas: { charId: string; formulaId: string; label: I18nLabel }[];
  availableFormulas: Record<string, Record<string, I18nLabel>>;
  /** All formulas including constellation-locked ones, with minC info. */
  displayFormulas: Record<string, Record<string, FormulaInfo>>;
  teamBuild: TeamBuild | null;
  buildError: string | null;
  comboLineMap: Map<string, { lineIndex: number; line: ComboLine }>;
  setComboLineCount: (
    charId: string,
    formulaId: string,
    reaction: string,
    count: number
  ) => void;
  onResetCombo?: () => void;
  expandedLine: {
    charId: string;
    formulaId: string;
    reaction: string;
  } | null;
  onExpandLine: (charId: string, formulaId: string, reaction: string) => void;
  onReactionChange: (
    charId: string,
    formulaId: string,
    reaction: string,
    override: ReactionOverride
  ) => void;
  /** Current formula mode: "single" or "combo". */
  formulaMode: "single" | "combo";
  /** Called when user switches between single/combo mode. */
  onModeChange: (mode: "single" | "combo") => void;
  /** Called in single mode when user selects a formula+reaction. */
  onSelectSingleFormula?: (
    charId: string,
    formulaId: string,
    reaction: string
  ) => void;
  /** Character IDs whose damage is currently ignored (combo mode only, ephemeral). */
  ignoredCharIds?: ReadonlySet<string>;
  /** Toggle the ignore state for a character. */
  onToggleIgnoreChar?: (charId: string) => void;
  t: ReturnType<typeof useLanguage>["t"];
}

export function FormulaSelectorCard({
  characters,
  damageConfig,
  onDamageConfigChange,
  allFormulas,
  availableFormulas,
  displayFormulas,
  teamBuild,
  buildError,
  comboLineMap,
  setComboLineCount,
  onResetCombo,
  expandedLine,
  onExpandLine,
  onReactionChange,
  formulaMode,
  onModeChange,
  onSelectSingleFormula,
  ignoredCharIds,
  onToggleIgnoreChar,
  t,
}: FormulaSelectorCardProps) {
  const isSingle = formulaMode === "single";
  const selectedFormula = damageConfig.selectedFormula;
  const singleReaction = damageConfig.singleReaction;
  const singleForceOnField = damageConfig.singleForceOnField;
  const combo = damageConfig.combo;
  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <h3 className={CARD_TITLE_CLS}>
          <span
            data-tour-step-id="tod-formula"
            className="inline-flex items-center gap-2"
          >
            <Swords className="w-4 h-4 opacity-70" />
            <span>{t.ui("teamComp.formulaSelect")}</span>
          </span>
        </h3>
      </CardHeader>
      <OptionButtonRow>
        <OptionButtonCell>
          <ExtraBuffsPanel
            characters={characters.filter((id): id is string => id != null)}
            extraBuffs={damageConfig.extraBuffs ?? []}
            onExtraBuffsChange={(extraBuffs) =>
              onDamageConfigChange({ extraBuffs })
            }
            enemyAura={damageConfig.enemyAura}
            onEnemyAuraChange={(el) => onDamageConfigChange({ enemyAura: el })}
            t={t}
          />
        </OptionButtonCell>
        <OptionButtonCell>
          <OptionButton
            selected={isSingle}
            onClick={() => onModeChange("single")}
            title={t.ui("teamComp.singleFormula")}
            subtitle={t.ui("teamComp.singleFormulaDesc")}
          />
        </OptionButtonCell>
        <OptionButtonCell>
          <OptionButton
            selected={!isSingle}
            onClick={() => onModeChange("combo")}
            title={t.ui("teamComp.comboFormula")}
            subtitle={t.ui("teamComp.comboFormulaDesc")}
          />
        </OptionButtonCell>
      </OptionButtonRow>
      {!isSingle && (
        <div className="flex items-center justify-between px-2 2xl:px-4 pt-0.5 pb-1.5 border-b border-border/40">
          <p className="text-xs text-foreground/80 italic">
            {t.ui("teamComp.comboDisclaimer")}
          </p>
          {onResetCombo && (
            <button
              type="button"
              onClick={onResetCombo}
              className="flex items-center gap-1 text-xs font-semibold text-foreground/80 bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md border border-border/50 transition-colors shrink-0 ml-2"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t.ui("common.reset")}</span>
            </button>
          )}
        </div>
      )}
      <CardContent className={CARD_BODY_CLS}>
        {allFormulas.length > 0 ? (
          <div className="flex flex-col gap-2">
            {/* ── Unified grid: one column per character ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-2">
              {characters.map((cid, idx) => {
                if (!cid) return <div key={idx} />;
                const charFormulas = displayFormulas[cid];
                const unlockedFormulas = availableFormulas[cid];
                const charElement = teamBuild?.teamMeta.elements[cid];

                // Reactions (charReactions = element-level default, refined per-formula below)
                const hasReactionFn = (rx: ReactionType, id?: string) =>
                  teamBuild?.teamMeta.hasReaction(rx, id) ?? false;

                if (!charFormulas) {
                  return (
                    <div
                      key={cid}
                      className="rounded-lg border border-border bg-black/5 px-2 py-2 text-xs text-muted-foreground"
                    >
                      —
                    </div>
                  );
                }

                const isCharIgnored = !!ignoredCharIds?.has(cid);

                return (
                  <div
                    key={cid}
                    className="rounded-lg border border-border bg-black/5 overflow-hidden flex flex-col"
                  >
                    {/* Formula labels: single = chip buttons, combo = steppers */}
                    <div
                      className={cn(
                        isSingle
                          ? "px-2 py-1 flex flex-wrap items-start gap-1.5"
                          : "px-2 py-1 flex flex-col md:grid md:grid-cols-2 md:gap-x-2 lg:grid-cols-1 xl:grid-cols-2"
                      )}
                    >
                      {Object.entries(charFormulas)
                        .filter(([formulaId]) => !formulaId.startsWith("rx-"))
                        .map(([formulaId, { label, minC }]) => {
                          const isLocked = !unlockedFormulas?.[formulaId];
                          const isSingleSelected =
                            isSingle &&
                            selectedFormula?.charId === cid &&
                            selectedFormula?.formulaId === formulaId;

                          // Derive reactions for this formula
                          const formulaEntry =
                            teamBuild?.catalog.formulaIndex.get(formulaId);

                          // For cross-scaled formulas (e.g. Nicole projections),
                          // show the statsCharId's avatar instead of the formula owner's.
                          const iconCharId =
                            formulaEntry?.parts[0]?.statsCharId ?? cid;
                          const iconCharRes = charactersById[iconCharId];

                          const reactions: ReactionType[] = isLocked
                            ? ["none"]
                            : getFormulaReactions(
                                cid,
                                formulaEntry ?? null,
                                charElement,
                                hasReactionFn
                              );
                          const hasReactions = reactions.length > 1;

                          // ── Single mode: chip buttons ──
                          if (isSingle) {
                            const activeRx = isSingleSelected
                              ? (singleReaction?.reaction ?? "none")
                              : "none";
                            const offField = teamBuild
                              ? teamBuild.catalog.offFieldStatus(formulaId)
                              : "none";

                            return (
                              <div key={formulaId} className="flex flex-col">
                                <button
                                  type="button"
                                  disabled={isLocked}
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1 rounded-lg border-2 transition-colors font-bold text-xs md:text-sm lg:text-xs xl:text-sm",
                                    isLocked
                                      ? "opacity-40 cursor-not-allowed bg-secondary text-muted-foreground border-border/40"
                                      : isSingleSelected
                                        ? "bg-primary/15 text-foreground border-primary/40"
                                        : "bg-secondary text-foreground hover:bg-secondary/80 border-border/40"
                                  )}
                                  onClick={() => {
                                    if (isLocked) return;
                                    const currentRx = isSingleSelected
                                      ? (singleReaction?.reaction ?? "none")
                                      : "none";
                                    onSelectSingleFormula?.(
                                      cid,
                                      formulaId,
                                      currentRx
                                    );
                                  }}
                                >
                                  {iconCharRes && (
                                    <img
                                      src={getAssetUrl(iconCharRes.imagePath)}
                                      alt={iconCharId}
                                      className="w-6 h-6 object-contain rounded-full bg-secondary/40 shrink-0"
                                    />
                                  )}
                                  <FormulaLabel
                                    label={label}
                                    minC={minC}
                                    formulaId={formulaId}
                                    charId={cid}
                                    teamBuild={teamBuild}
                                    isLocked={isLocked}
                                  />
                                </button>
                                {/* Force on-field checkbox: shown when selected and formula has off-field parts */}
                                {isSingleSelected &&
                                  !isLocked &&
                                  offField !== "none" && (
                                    <label className="flex items-center gap-1 mt-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!singleForceOnField}
                                        onChange={(e) =>
                                          onDamageConfigChange({
                                            singleForceOnField:
                                              e.target.checked || undefined,
                                          })
                                        }
                                        className="accent-primary w-3 h-3"
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        {t.ui("common.forceOnField")}
                                      </span>
                                    </label>
                                  )}
                                {/* Reaction sub-buttons: shown when selected and has reactions */}
                                {isSingleSelected && hasReactions && (
                                  <div className="mt-1 flex flex-wrap items-center gap-1">
                                    {reactions.map((rx) => {
                                      const isRxActive = activeRx === rx;
                                      return (
                                        <button
                                          key={rx}
                                          type="button"
                                          className={cn(
                                            "px-1.5 py-0.5 rounded text-[10px] md:text-xs font-semibold border transition-colors",
                                            isRxActive
                                              ? "bg-primary/20 border-primary/40 text-primary"
                                              : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                                          )}
                                          onClick={() =>
                                            onSelectSingleFormula?.(
                                              cid,
                                              formulaId,
                                              rx
                                            )
                                          }
                                        >
                                          {t.reaction(rx)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Per-part config: only when a non-direct reaction is active */}
                                {isSingleSelected &&
                                  activeRx !== "none" &&
                                  formulaEntry && (
                                    <div className="mt-1">
                                      <ReactionPartControls
                                        formulaEntry={formulaEntry}
                                        charId={cid}
                                        reactionType={activeRx as ReactionType}
                                        reactionOverride={singleReaction ?? {}}
                                        onReactionChange={(override) =>
                                          onReactionChange(
                                            cid,
                                            formulaId,
                                            activeRx,
                                            {
                                              ...override,
                                              reaction:
                                                activeRx as ReactionType,
                                            }
                                          )
                                        }
                                      />
                                    </div>
                                  )}
                              </div>
                            );
                          }

                          // ── Combo mode ──
                          return (
                            <div
                              key={formulaId}
                              className="px-2 py-0.5 rounded transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {iconCharRes && (
                                  <img
                                    src={getAssetUrl(iconCharRes.imagePath)}
                                    alt={iconCharId}
                                    className="w-5 h-5 rounded-full bg-secondary/40 shrink-0"
                                  />
                                )}
                                <FormulaLabel
                                  label={label}
                                  minC={minC}
                                  formulaId={formulaId}
                                  charId={cid}
                                  teamBuild={teamBuild}
                                  isLocked={isLocked}
                                  className={cn(
                                    "text-xs md:text-sm lg:text-xs xl:text-sm font-bold",
                                    isLocked
                                      ? "text-muted-foreground"
                                      : "text-foreground"
                                  )}
                                />
                              </div>
                              {/* Force on-field checkbox for combo mode */}
                              {!isLocked &&
                                (() => {
                                  const comboOffField = teamBuild
                                    ? teamBuild.catalog.offFieldStatus(
                                        formulaId
                                      )
                                    : "none";
                                  if (comboOffField === "none") return null;
                                  const firstLineKey = reactions
                                    .map((rx) => `${cid}.${formulaId}.${rx}`)
                                    .find((k) => comboLineMap.has(k));
                                  const currentForceOnField = firstLineKey
                                    ? comboLineMap.get(firstLineKey)?.line
                                        .forceOnField
                                    : undefined;
                                  return (
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <span className="w-4 shrink-0" />
                                      <input
                                        type="checkbox"
                                        checked={!!currentForceOnField}
                                        onChange={(e) => {
                                          const newForceOnField =
                                            e.target.checked || undefined;
                                          if (combo) {
                                            const updatedLines =
                                              combo.lines.map((l) => {
                                                if (
                                                  l.charId === cid &&
                                                  l.formulaId === formulaId
                                                ) {
                                                  return {
                                                    ...l,
                                                    forceOnField:
                                                      newForceOnField,
                                                  };
                                                }
                                                return l;
                                              });
                                            onDamageConfigChange({
                                              combo: {
                                                ...combo,
                                                lines: updatedLines,
                                              },
                                            });
                                          }
                                        }}
                                        className="accent-primary w-3 h-3"
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        {t.ui("common.forceOnField")}
                                      </span>
                                    </label>
                                  );
                                })()}

                              {/* Per-reaction count steppers */}
                              {(() => {
                                // ── Combo mode: count steppers ──
                                // Find which reaction (if any) is expanded for this formula
                                const expandedRx = isLocked
                                  ? null
                                  : expandedLine?.charId === cid &&
                                      expandedLine?.formulaId === formulaId
                                    ? expandedLine.reaction
                                    : null;
                                const expandedLineKey = expandedRx
                                  ? `${cid}.${formulaId}.${expandedRx}`
                                  : null;

                                return (
                                  <div className="flex flex-col gap-y-1">
                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                      {hasReactions ? (
                                        reactions.map((rx) => {
                                          const lineKey = `${cid}.${formulaId}.${rx}`;
                                          const count =
                                            comboLineMap.get(lineKey)?.line
                                              .count ?? 0;
                                          const isExpanded = expandedRx === rx;
                                          const showChevron =
                                            formulaEntry != null &&
                                            rx !== "none";
                                          return (
                                            <div
                                              key={lineKey}
                                              className={cn(
                                                "flex items-center",
                                                isCharIgnored && "line-through"
                                              )}
                                            >
                                              {showChevron ? (
                                                <button
                                                  type="button"
                                                  disabled={isLocked}
                                                  className="w-4 h-4 flex items-center justify-center text-foreground hover:text-primary shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                                                  onClick={() =>
                                                    onExpandLine(
                                                      cid,
                                                      formulaId,
                                                      rx
                                                    )
                                                  }
                                                >
                                                  {isExpanded ? (
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                  ) : (
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                  )}
                                                </button>
                                              ) : (
                                                <span className="w-4 shrink-0" />
                                              )}
                                              <span
                                                className={cn(
                                                  "text-[10px] md:text-xs xl:text-sm font-semibold",
                                                  isLocked
                                                    ? "text-muted-foreground"
                                                    : "text-foreground/80"
                                                )}
                                              >
                                                {t.reaction(rx)}
                                              </span>
                                              <button
                                                type="button"
                                                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                disabled={
                                                  isLocked ||
                                                  isCharIgnored ||
                                                  count <= 0
                                                }
                                                onClick={() =>
                                                  setComboLineCount(
                                                    cid,
                                                    formulaId,
                                                    rx,
                                                    Math.max(0, count - 1)
                                                  )
                                                }
                                              >
                                                <Minus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                              </button>
                                              <span
                                                className={cn(
                                                  "text-[10px] md:text-xs xl:text-sm font-mono tabular-nums w-4 text-center font-bold",
                                                  (isLocked ||
                                                    isCharIgnored ||
                                                    count === 0) &&
                                                    "text-muted-foreground"
                                                )}
                                              >
                                                {count}
                                              </span>
                                              <button
                                                type="button"
                                                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                disabled={
                                                  isLocked ||
                                                  isCharIgnored ||
                                                  count >= 99
                                                }
                                                onClick={() =>
                                                  setComboLineCount(
                                                    cid,
                                                    formulaId,
                                                    rx,
                                                    Math.min(99, count + 1)
                                                  )
                                                }
                                              >
                                                <Plus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                              </button>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div
                                          className={cn(
                                            "flex items-center",
                                            isCharIgnored && "line-through"
                                          )}
                                        >
                                          {(() => {
                                            const c =
                                              comboLineMap.get(
                                                `${cid}.${formulaId}.none`
                                              )?.line.count ?? 0;
                                            return (
                                              <>
                                                <button
                                                  type="button"
                                                  className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                  disabled={
                                                    isLocked ||
                                                    isCharIgnored ||
                                                    c <= 0
                                                  }
                                                  onClick={() =>
                                                    setComboLineCount(
                                                      cid,
                                                      formulaId,
                                                      "none",
                                                      Math.max(0, c - 1)
                                                    )
                                                  }
                                                >
                                                  <Minus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                                </button>
                                                <span
                                                  className={cn(
                                                    "text-[10px] md:text-xs xl:text-sm font-mono tabular-nums w-4 text-center font-bold",
                                                    (isLocked ||
                                                      isCharIgnored ||
                                                      c === 0) &&
                                                      "text-muted-foreground"
                                                  )}
                                                >
                                                  {c}
                                                </span>
                                                <button
                                                  type="button"
                                                  className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                  disabled={
                                                    isLocked ||
                                                    isCharIgnored ||
                                                    c >= 99
                                                  }
                                                  onClick={() =>
                                                    setComboLineCount(
                                                      cid,
                                                      formulaId,
                                                      "none",
                                                      Math.min(99, c + 1)
                                                    )
                                                  }
                                                >
                                                  <Plus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                                </button>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                    {/* Expanded reaction config — rendered outside flex-wrap at full width */}
                                    {expandedRx &&
                                      expandedRx !== "none" &&
                                      formulaEntry &&
                                      charElement &&
                                      (() => {
                                        const expandedEntry = comboLineMap.get(
                                          expandedLineKey!
                                        );
                                        const expandedCount =
                                          expandedEntry?.line.count ?? 0;
                                        // Use stored override, or synthesize one with the reaction type
                                        // so per-part controls show even at count 0.
                                        const expandedOverride: ReactionOverride =
                                          expandedEntry?.line.reaction ?? {
                                            reaction:
                                              expandedRx as ReactionType,
                                          };
                                        return (
                                          <div className="pt-1 pb-0.5">
                                            <ReactionPartControls
                                              formulaEntry={formulaEntry}
                                              charId={cid}
                                              reactionType={
                                                expandedRx as ReactionType
                                              }
                                              reactionOverride={
                                                expandedOverride
                                              }
                                              onReactionChange={(override) =>
                                                onReactionChange(
                                                  cid,
                                                  formulaId,
                                                  expandedRx,
                                                  {
                                                    ...override,
                                                    reaction:
                                                      expandedRx as ReactionType,
                                                  }
                                                )
                                              }
                                              disabled={expandedCount <= 0}
                                            />
                                          </div>
                                        );
                                      })()}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                    </div>
                    {!isSingle && onToggleIgnoreChar && (
                      <button
                        type="button"
                        onClick={() => onToggleIgnoreChar(cid)}
                        className="mt-auto flex items-center justify-center gap-1.5 px-2 py-1 cursor-pointer border-t border-border/30 bg-black/10"
                      >
                        <Checkbox
                          checked={isCharIgnored}
                          onBooleanChange={() => onToggleIgnoreChar(cid)}
                          className="rounded-full pointer-events-none"
                        />
                        <span className="text-xs md:text-sm lg:text-xs xl:text-sm text-muted-foreground truncate">
                          {t
                            .ui("common.ignoreCharDamage")
                            .replace("{0}", t.character(cid))}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Team Reactions ── */}
            {teamBuild &&
              (() => {
                const rxGroups = teamBuild.catalog.getReactionComboGrid();
                if (rxGroups.length === 0) return null;

                return (
                  <div className="rounded-lg border border-border bg-black/5 overflow-hidden">
                    <div className="px-2 pt-1 text-[11px] md:text-xs font-semibold text-muted-foreground">
                      {t.ui("teamComp.transformativeReactionDmg")}
                    </div>
                    <div className="px-2 pb-1 flex flex-wrap items-start justify-center gap-x-4 lg:gap-x-6 2xl:gap-x-8 gap-y-1">
                      {rxGroups.map(
                        ({ baseId, label, eligible, isMultiContributor }) => {
                          const eligibleArr = [...eligible];
                          const triggerFormulaId = (cid: string) =>
                            `${baseId}-${cid}`;

                          const isMulti = isMultiContributor;
                          const roleLabel = t.ui(
                            isMulti
                              ? "teamComp.rxOnField"
                              : "teamComp.rxTrigger"
                          );

                          return (
                            <div key={baseId} className="px-2 py-0.5">
                              <div className="flex items-center gap-1.5 text-xs md:text-sm lg:text-xs xl:text-sm font-bold text-foreground mb-0.5">
                                <ReactionElementIcons
                                  formulaId={triggerFormulaId(eligibleArr[0])}
                                  size="w-4 h-4"
                                />
                                {t.resolveLabel(label)}
                              </div>
                              {isSingle ? (
                                /* Single mode: chip buttons — mutually exclusive with character formulas */
                                <div className="flex flex-wrap items-center gap-1">
                                  {eligibleArr.map((cid) => {
                                    const cidFormula = triggerFormulaId(cid);
                                    const isActive =
                                      selectedFormula?.charId === cid &&
                                      selectedFormula?.formulaId === cidFormula;
                                    return (
                                      <button
                                        key={cid}
                                        type="button"
                                        className={cn(
                                          "px-2 py-0.5 rounded-lg border-2 text-[10px] md:text-xs xl:text-sm font-semibold transition-colors",
                                          isActive
                                            ? "bg-primary/15 border-primary/40 text-foreground/80"
                                            : "bg-secondary border-border/40 text-foreground/80 hover:bg-secondary/80"
                                        )}
                                        onClick={() =>
                                          onSelectSingleFormula?.(
                                            cid,
                                            cidFormula,
                                            "none"
                                          )
                                        }
                                      >
                                        {t.character(cid)}
                                        <span className="text-[0.85em] text-muted-foreground font-normal ml-0.5">
                                          {roleLabel}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                /* Combo mode: count steppers */
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                  {eligibleArr.map((cid) => {
                                    const cidFormula = triggerFormulaId(cid);
                                    const lineKey = `${cid}.${cidFormula}.none`;
                                    const count =
                                      comboLineMap.get(lineKey)?.line.count ??
                                      0;
                                    const isRxCharIgnored =
                                      !!ignoredCharIds?.has(cid);

                                    return (
                                      <div
                                        key={cid}
                                        className="flex items-center"
                                      >
                                        <span
                                          className={cn(
                                            "text-[10px] md:text-xs xl:text-sm font-semibold",
                                            isRxCharIgnored
                                              ? "text-muted-foreground"
                                              : "text-foreground/80"
                                          )}
                                        >
                                          {t.character(cid)}
                                          <span className="text-[0.85em] text-muted-foreground font-normal ml-0.5">
                                            {roleLabel}
                                          </span>
                                        </span>
                                        <button
                                          type="button"
                                          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                          disabled={
                                            isRxCharIgnored || count <= 0
                                          }
                                          onClick={() =>
                                            setComboLineCount(
                                              cid,
                                              cidFormula,
                                              "none",
                                              Math.max(0, count - 1)
                                            )
                                          }
                                        >
                                          <Minus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                        </button>
                                        <span
                                          className={cn(
                                            "text-[10px] md:text-xs xl:text-sm font-mono tabular-nums w-4 text-center font-bold",
                                            (isRxCharIgnored || count === 0) &&
                                              "text-muted-foreground",
                                            isRxCharIgnored && "line-through"
                                          )}
                                        >
                                          {count}
                                        </span>
                                        <button
                                          type="button"
                                          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                          disabled={
                                            isRxCharIgnored || count >= 99
                                          }
                                          onClick={() =>
                                            setComboLineCount(
                                              cid,
                                              cidFormula,
                                              "none",
                                              Math.min(99, count + 1)
                                            )
                                          }
                                        >
                                          <Plus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })()}
          </div>
        ) : (
          buildError && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-lg text-sm">
              <span className="font-bold">{t.ui("teamComp.setupError")}</span>{" "}
              {buildError}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
