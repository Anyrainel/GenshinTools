import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, elementResourcesByName } from "@/data/constants";
import type { Element, ReactionType } from "@/data/types";
import { elements } from "@/data/types";
import { ELEMENT_ELIGIBLE_REACTIONS } from "@/lib/team-comp/constants";
import { type TeamBuild, offFieldStatus } from "@/lib/team-comp/damageCalc";
import type {
  ComboLine,
  I18nLabel,
  ReactionOverride,
} from "@/lib/team-comp/types";
import { cn, getAssetUrl, getElementColor } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { Minus, Plus, RotateCcw, Swords, TrendingUp } from "lucide-react";
import { ReactionSelector } from "./ReactionSelector";

const CARD_CLS = "bg-gradient-card border-border/50 overflow-hidden shadow-lg";
const CARD_HEADER_CLS =
  "bg-gradient-select border-b border-border/40 py-3 px-2 md:px-5";
const CARD_TITLE_CLS =
  "text-base font-bold flex items-center gap-2 tracking-tight text-primary-foreground/90";
const CARD_BODY_CLS = "p-1 md:p-2 bg-black/10";

interface FormulaSelectorCardProps {
  team: Team;
  effectiveTeam: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  formulaMode: "single" | "combo";
  allFormulas: { charId: string; formulaId: string; label: I18nLabel }[];
  availableFormulas: Record<string, Record<string, I18nLabel>>;
  resolvedFormula: { charId: string; formulaId: string } | null;
  teamBuild: TeamBuild | null;
  buildError: string | null;
  currentReactionOverride: ReactionOverride;
  handleReactionChange: (override: ReactionOverride) => void;
  comboLineMap: Map<string, { lineIndex: number; line: ComboLine }>;
  setComboLineCount: (
    charId: string,
    formulaId: string,
    reaction: string,
    count: number
  ) => void;
  onResetCombo?: () => void;
  onInvestmentClick?: () => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
}

function EnemyAuraSelect({
  value,
  onChange,
  label,
  t,
}: {
  value?: Element;
  onChange: (el: Element | undefined) => void;
  label: string;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="flex-1">
      <Select
        value={value ?? "__none__"}
        onValueChange={(v) =>
          onChange(v === "__none__" ? undefined : (v as Element))
        }
      >
        <SelectTrigger
          className={cn(
            "h-auto rounded-lg border-2 px-3 py-2 shadow-none border-border/30 bg-black/5",
            value && "ring-2 ring-primary/50"
          )}
        >
          <div className="flex items-center justify-center gap-3 w-full">
            <span className="text-base md:text-lg font-bold text-foreground/80 shrink-0">
              {label}
            </span>
            {value ? (
              <>
                <img
                  src={getAssetUrl(elementResourcesByName[value]?.imagePath)}
                  alt={value}
                  className="w-6 h-6"
                />
                <span
                  className={cn(
                    "text-base md:text-lg font-bold",
                    getElementColor(value, "text")
                  )}
                >
                  {t.element(value)}
                </span>
              </>
            ) : (
              <span className="text-base md:text-lg font-bold text-foreground/80 pl-9">
                {t.ui("teamComp.enemyAuraNone")}
              </span>
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            {t.ui("teamComp.enemyAuraNone")}
          </SelectItem>
          {elements.map((el) => (
            <SelectItem key={el} value={el}>
              <div className="flex items-center gap-2">
                <img
                  src={getAssetUrl(elementResourcesByName[el]?.imagePath)}
                  alt={el}
                  className="w-6 h-6"
                />
                <span>{t.element(el)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FormulaSelectorCard({
  team,
  effectiveTeam,
  updateTeam,
  formulaMode,
  allFormulas,
  availableFormulas,
  resolvedFormula,
  teamBuild,
  buildError,
  currentReactionOverride,
  handleReactionChange,
  comboLineMap,
  setComboLineCount,
  onResetCombo,
  onInvestmentClick,
  isMobile,
  t,
}: FormulaSelectorCardProps) {
  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <h3 className={CARD_TITLE_CLS}>
          <span
            data-tour-step-id="tod-formula"
            className="inline-flex items-center gap-2"
          >
            <Swords className="w-4 h-4 opacity-70" />
            <span>{t.ui("teamComp.formulaSelection")}</span>
          </span>
        </h3>
      </CardHeader>
      {allFormulas.length > 0 && (
        <div className="flex flex-col md:flex-row gap-2 px-2 md:px-4 py-2 border-b border-border/20">
          {/* Enemy Element Aura — dropdown select */}
          <EnemyAuraSelect
            value={team.enemyElementAura}
            onChange={(el) => updateTeam(team.id, { enemyElementAura: el })}
            label={t.ui("teamComp.enemyAura")}
            t={t}
          />
          {(["single", "combo"] as const).map((mode) => {
            const selected = formulaMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => updateTeam(team.id, { formulaMode: mode })}
                className={cn(
                  "flex-1 flex items-start gap-2.5 rounded-lg border-2 px-3 py-2 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border/30 bg-black/5 hover:border-border/50 hover:bg-black/10"
                )}
              >
                {/* Radio circle */}
                <div
                  className={cn(
                    "mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                    selected ? "border-primary" : "border-border"
                  )}
                >
                  {selected && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
                  <span
                    className={cn(
                      "text-base md:text-lg font-bold",
                      selected ? "text-foreground" : "text-foreground/70"
                    )}
                  >
                    {t.ui(
                      mode === "single"
                        ? "teamComp.singleFormula"
                        : "teamComp.comboFormula"
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-xs leading-snug",
                      selected
                        ? "text-muted-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {t.ui(
                      mode === "single"
                        ? "teamComp.singleFormulaDesc"
                        : "teamComp.comboFormulaDesc"
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {formulaMode === "combo" && (
        <div className="flex items-center justify-between px-2 md:px-4 pt-0.5 pb-1.5 border-b border-border/20">
          <p className="text-xs text-foreground/80 italic">
            {t.ui("teamComp.comboDisclaimer")}
          </p>
          {onResetCombo && (
            <button
              type="button"
              onClick={onResetCombo}
              className="flex items-center gap-1 text-xs font-semibold text-foreground/80 bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md border border-border/30 transition-colors shrink-0 ml-2"
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
              {effectiveTeam.characters.map((cid, idx) => {
                if (!cid) return <div key={idx} />;
                const charRes = charactersById[cid];
                const charFormulas = availableFormulas[cid];
                const charElement = teamBuild?.teamMeta.elements[cid];

                // Reactions for combo mode
                const eligible: ReactionType[] = charElement
                  ? (ELEMENT_ELIGIBLE_REACTIONS[
                      charElement as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
                    ] ?? ["none"])
                  : ["none"];
                const reactions = eligible.filter(
                  (rx) =>
                    rx === "none" || teamBuild?.teamMeta.hasReaction(rx, cid)
                ) as ReactionType[];
                const hasReactions = reactions.length > 1;

                if (!charFormulas) {
                  return (
                    <div
                      key={cid}
                      className="rounded-lg border border-border/30 bg-black/5 px-2 py-2 text-xs text-muted-foreground"
                    >
                      —
                    </div>
                  );
                }

                return (
                  <div
                    key={cid}
                    className="rounded-lg border border-border/30 bg-black/5 overflow-hidden"
                  >
                    {/* Formula buttons/labels */}
                    {formulaMode === "single" ? (
                      <div className="px-2 py-1 flex flex-wrap items-start gap-1">
                        {Object.entries(charFormulas).map(
                          ([formulaId, label]) => {
                            const isSelected =
                              resolvedFormula?.charId === cid &&
                              resolvedFormula?.formulaId === formulaId;
                            return (
                              <div key={formulaId} className="flex flex-col">
                                <button
                                  type="button"
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1 rounded-lg border-2 transition-colors font-bold text-sm",
                                    isSelected
                                      ? "bg-primary/15 text-foreground border-primary/40 shadow-md"
                                      : "bg-card/40 text-foreground hover:bg-card/60 border-border/20"
                                  )}
                                  onClick={() =>
                                    updateTeam(team.id, {
                                      selectedFormula: {
                                        charId: cid,
                                        formulaId,
                                      },
                                    })
                                  }
                                >
                                  {charRes && (
                                    <img
                                      src={getAssetUrl(charRes.imagePath)}
                                      alt={cid}
                                      className="w-6 h-6 object-contain rounded-full bg-secondary/40 shrink-0"
                                    />
                                  )}
                                  <span className="flex flex-wrap items-baseline gap-x-1">
                                    <span className="truncate">
                                      {t.resolveLabel(label)}
                                    </span>
                                    {(() => {
                                      if (!teamBuild) return null;
                                      const s = offFieldStatus(
                                        teamBuild,
                                        cid,
                                        formulaId
                                      );
                                      if (s === "none") return null;
                                      return (
                                        <span className="text-muted-foreground font-normal whitespace-nowrap">
                                          {t.ui(
                                            s === "full"
                                              ? "common.offFieldSuffix"
                                              : "common.partialOffFieldSuffix"
                                          )}
                                        </span>
                                      );
                                    })()}
                                  </span>
                                </button>
                                {isSelected &&
                                  (() => {
                                    const entry =
                                      teamBuild?.charBuilds[
                                        cid
                                      ]?.charBase.getFormulaEntry(formulaId);
                                    if (!entry || !charElement) return null;
                                    return (
                                      <div className="mt-1">
                                        <ReactionSelector
                                          formulaEntry={entry}
                                          element={charElement}
                                          reactionOverride={
                                            currentReactionOverride
                                          }
                                          onReactionChange={
                                            handleReactionChange
                                          }
                                          teamMeta={teamBuild!.teamMeta}
                                          charId={cid}
                                        />
                                      </div>
                                    );
                                  })()}
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div className="px-2 py-1 flex flex-col 2xl:grid 2xl:grid-cols-2 2xl:gap-x-2">
                        {Object.entries(charFormulas).map(
                          ([formulaId, label]) => {
                            const isSelected =
                              resolvedFormula?.charId === cid &&
                              resolvedFormula?.formulaId === formulaId;
                            return (
                              <div key={formulaId} className="px-2 py-0.5">
                                <div className="flex items-center gap-2">
                                  {charRes && (
                                    <img
                                      src={getAssetUrl(charRes.imagePath)}
                                      alt={cid}
                                      className="w-5 h-5 rounded-full bg-secondary/40 shrink-0"
                                    />
                                  )}
                                  <span className="text-base font-bold text-foreground flex flex-wrap items-baseline gap-x-1">
                                    <span className="truncate">
                                      {t.resolveLabel(label)}
                                    </span>
                                    {(() => {
                                      if (!teamBuild) return null;
                                      const s = offFieldStatus(
                                        teamBuild,
                                        cid,
                                        formulaId
                                      );
                                      if (s === "none") return null;
                                      return (
                                        <span className="text-muted-foreground font-normal whitespace-nowrap">
                                          {t.ui(
                                            s === "full"
                                              ? "common.offFieldSuffix"
                                              : "common.partialOffFieldSuffix"
                                          )}
                                        </span>
                                      );
                                    })()}
                                  </span>
                                </div>

                                {/* Combo mode: per-reaction steppers */}
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                  {hasReactions ? (
                                    reactions.map((rx) => {
                                      const lineKey = `${cid}.${formulaId}.${rx}`;
                                      const count =
                                        comboLineMap.get(lineKey)?.line.count ??
                                        0;
                                      return (
                                        <div
                                          key={lineKey}
                                          className="flex items-center"
                                        >
                                          <span
                                            className={cn(
                                              "text-base font-semibold",
                                              count > 0
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                            )}
                                          >
                                            {t.reaction(rx)}
                                          </span>
                                          <button
                                            type="button"
                                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                            disabled={count <= 0}
                                            onClick={() =>
                                              setComboLineCount(
                                                cid,
                                                formulaId,
                                                rx,
                                                Math.max(0, count - 1)
                                              )
                                            }
                                          >
                                            <Minus className="w-3.5 h-3.5" />
                                          </button>
                                          <span
                                            className={cn(
                                              "text-base font-mono tabular-nums w-5 text-center font-bold",
                                              count === 0 &&
                                                "text-muted-foreground"
                                            )}
                                          >
                                            {count}
                                          </span>
                                          <button
                                            type="button"
                                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                            disabled={count >= 99}
                                            onClick={() =>
                                              setComboLineCount(
                                                cid,
                                                formulaId,
                                                rx,
                                                Math.min(99, count + 1)
                                              )
                                            }
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="flex items-center">
                                      {(() => {
                                        const c =
                                          comboLineMap.get(
                                            `${cid}.${formulaId}.none`
                                          )?.line.count ?? 0;
                                        return (
                                          <>
                                            <button
                                              type="button"
                                              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                              disabled={c <= 0}
                                              onClick={() =>
                                                setComboLineCount(
                                                  cid,
                                                  formulaId,
                                                  "none",
                                                  Math.max(0, c - 1)
                                                )
                                              }
                                            >
                                              <Minus className="w-4 h-4" />
                                            </button>
                                            <span
                                              className={cn(
                                                "text-base font-mono tabular-nums w-5 text-center font-bold",
                                                c === 0 &&
                                                  "text-muted-foreground"
                                              )}
                                            >
                                              {c}
                                            </span>
                                            <button
                                              type="button"
                                              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                              disabled={c >= 99}
                                              onClick={() =>
                                                setComboLineCount(
                                                  cid,
                                                  formulaId,
                                                  "none",
                                                  Math.min(99, c + 1)
                                                )
                                              }
                                            >
                                              <Plus className="w-4 h-4" />
                                            </button>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          buildError && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-lg text-sm">
              <span className="font-bold">{t.ui("teamComp.setupError")}</span>{" "}
              {buildError}
            </div>
          )
        )}
        {onInvestmentClick && (
          <div className="mx-2 mt-2">
            <Button
              variant="outline"
              className="w-full gap-2 border-amber-600/50 bg-amber-700/30 hover:bg-amber-600/40 text-amber-100"
              onClick={onInvestmentClick}
            >
              <TrendingUp className="w-4 h-4" />
              {t.ui("teamComp.investmentAnalysis")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
