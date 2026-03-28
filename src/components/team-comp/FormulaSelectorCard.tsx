import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  OptionButtonCell,
  OptionButtonRow,
} from "@/components/ui/option-button";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, elementResourcesByName } from "@/data/constants";
import type { Element, ReactionType } from "@/data/types";
import {
  ELEMENT_ELIGIBLE_REACTIONS,
  MULTI_ELEMENT_CHARS,
  REACTION_ELEMENT_REQUIREMENTS,
} from "@/lib/team-comp/constants";
import { type TeamBuild, offFieldStatus } from "@/lib/team-comp/damageCalc";
import type { ComboLine, I18nLabel } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { Minus, Plus, RotateCcw, Swords, TrendingUp } from "lucide-react";
import { ExtraBuffsPanel } from "./ExtraBuffsPanel";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

/** Derive the contributing elements for a reaction formula ID. */
function getReactionElements(formulaId: string): Element[] {
  if (formulaId.startsWith("rx-swirl-")) {
    return ["Anemo", formulaId.slice("rx-swirl-".length) as Element];
  }
  const reaction = formulaId.slice(3) as ReactionType;
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
  team: Team;
  effectiveTeam: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
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
  onInvestmentClick?: () => void;
  isMobile: boolean;
  t: ReturnType<typeof useLanguage>["t"];
}

export function FormulaSelectorCard({
  team,
  effectiveTeam,
  updateTeam,
  allFormulas,
  availableFormulas,
  displayFormulas,
  teamBuild,
  buildError,
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
            <span>{t.ui("teamComp.formulaSelect")}</span>
          </span>
        </h3>
      </CardHeader>
      <OptionButtonRow>
        <OptionButtonCell>
          <ExtraBuffsPanel
            team={team}
            updateTeam={updateTeam}
            enemyAura={team.enemyAura}
            onEnemyAuraChange={(el) => updateTeam(team.id, { enemyAura: el })}
            t={t}
          />
        </OptionButtonCell>
      </OptionButtonRow>
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
      <CardContent className={CARD_BODY_CLS}>
        {allFormulas.length > 0 ? (
          <div className="flex flex-col gap-2">
            {/* ── Unified grid: one column per character ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-2">
              {effectiveTeam.characters.map((cid, idx) => {
                if (!cid) return <div key={idx} />;
                const charRes = charactersById[cid];
                const charFormulas = displayFormulas[cid];
                const unlockedFormulas = availableFormulas[cid];
                const charElement = teamBuild?.teamMeta.elements[cid];

                // Reactions
                const isMultiElement = MULTI_ELEMENT_CHARS.has(cid);
                const charEligible: ReactionType[] = charElement
                  ? (ELEMENT_ELIGIBLE_REACTIONS[
                      charElement as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
                    ] ?? ["none"])
                  : ["none"];
                const charReactions = charEligible.filter(
                  (rx) =>
                    rx === "none" || teamBuild?.teamMeta.hasReaction(rx, cid)
                ) as ReactionType[];

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

                return (
                  <div
                    key={cid}
                    className="rounded-lg border border-border bg-black/5 overflow-hidden"
                  >
                    {/* Formula labels with per-reaction steppers */}
                    <div className="px-2 py-1 flex flex-col md:grid md:grid-cols-2 md:gap-x-2 lg:grid-cols-1 xl:grid-cols-2">
                      {Object.entries(charFormulas).map(
                        ([formulaId, { label, minC }]) => {
                          const isLocked = !unlockedFormulas?.[formulaId];

                          // Check if all reaction counts for this formula are 0
                          const allCountsZero = (() => {
                            if (isLocked) return false;
                            const reactions = isMultiElement
                              ? (() => {
                                  const entry =
                                    teamBuild?.charBuilds[
                                      cid
                                    ]?.charBase.getFormulaEntry(formulaId);
                                  if (!entry) return charReactions;
                                  const rxSet = new Set<ReactionType>(["none"]);
                                  for (const part of entry.parts) {
                                    const partEl = part.formula.tag.element;
                                    const partEligible =
                                      ELEMENT_ELIGIBLE_REACTIONS[
                                        partEl as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
                                      ];
                                    if (partEligible)
                                      for (const rx of partEligible)
                                        rxSet.add(rx);
                                  }
                                  return Array.from(rxSet).filter(
                                    (rx) =>
                                      rx === "none" ||
                                      teamBuild?.teamMeta.hasReaction(rx)
                                  ) as ReactionType[];
                                })()
                              : charReactions;
                            const hasReactions = reactions.length > 1;
                            if (hasReactions) {
                              return reactions.every((rx) => {
                                const lineKey = `${cid}.${formulaId}.${rx}`;
                                return (
                                  (comboLineMap.get(lineKey)?.line.count ??
                                    0) === 0
                                );
                              });
                            }
                            const c =
                              comboLineMap.get(`${cid}.${formulaId}.none`)?.line
                                .count ?? 0;
                            return c === 0;
                          })();

                          return (
                            <div
                              key={formulaId}
                              className={cn(
                                "px-2 py-0.5",
                                isLocked && "opacity-40",
                                !isLocked && allCountsZero && "opacity-50"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {charRes && (
                                  <img
                                    src={getAssetUrl(charRes.imagePath)}
                                    alt={cid}
                                    className="w-5 h-5 rounded-full bg-secondary/40 shrink-0"
                                  />
                                )}
                                <span className="text-xs md:text-sm lg:text-xs xl:text-sm font-bold text-foreground flex flex-wrap items-baseline gap-x-1">
                                  {minC > 0 && (
                                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/15 px-1 rounded shrink-0">
                                      {t.format(
                                        "common.constellationFormat",
                                        minC
                                      )}
                                    </span>
                                  )}
                                  <span className="truncate">
                                    {t.resolveLabel(label)}
                                  </span>
                                  {(() => {
                                    if (!teamBuild || isLocked) return null;
                                    const s = offFieldStatus(
                                      teamBuild,
                                      cid,
                                      formulaId
                                    );
                                    if (s === "none") return null;
                                    return (
                                      <span className="text-[10px] md:text-xs xl:text-sm text-muted-foreground font-normal whitespace-nowrap">
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

                              {/* Per-reaction steppers */}
                              {isLocked
                                ? null
                                : (() => {
                                    // For multi-element chars, derive reactions from formula parts
                                    const reactions = isMultiElement
                                      ? (() => {
                                          const entry =
                                            teamBuild?.charBuilds[
                                              cid
                                            ]?.charBase.getFormulaEntry(
                                              formulaId
                                            );
                                          if (!entry) return charReactions;
                                          const rxSet = new Set<ReactionType>([
                                            "none",
                                          ]);
                                          for (const part of entry.parts) {
                                            const partEl =
                                              part.formula.tag.element;
                                            const partEligible =
                                              ELEMENT_ELIGIBLE_REACTIONS[
                                                partEl as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
                                              ];
                                            if (partEligible)
                                              for (const rx of partEligible)
                                                rxSet.add(rx);
                                          }
                                          return Array.from(rxSet).filter(
                                            (rx) =>
                                              rx === "none" ||
                                              teamBuild?.teamMeta.hasReaction(
                                                rx
                                              )
                                          ) as ReactionType[];
                                        })()
                                      : charReactions;
                                    const hasReactions = reactions.length > 1;
                                    return (
                                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                        {hasReactions ? (
                                          reactions.map((rx) => {
                                            const lineKey = `${cid}.${formulaId}.${rx}`;
                                            const count =
                                              comboLineMap.get(lineKey)?.line
                                                .count ?? 0;
                                            return (
                                              <div
                                                key={lineKey}
                                                className="flex items-center"
                                              >
                                                <span
                                                  className={cn(
                                                    "text-[10px] md:text-xs xl:text-sm font-semibold",
                                                    count > 0
                                                      ? "text-foreground"
                                                      : "text-muted-foreground"
                                                  )}
                                                >
                                                  {t.reaction(rx)}
                                                </span>
                                                <button
                                                  type="button"
                                                  className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
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
                                                  <Minus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                                </button>
                                                <span
                                                  className={cn(
                                                    "text-[10px] md:text-xs xl:text-sm font-mono tabular-nums w-4 text-center font-bold",
                                                    count === 0 &&
                                                      "text-muted-foreground"
                                                  )}
                                                >
                                                  {count}
                                                </span>
                                                <button
                                                  type="button"
                                                  className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
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
                                                  <Plus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
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
                                                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
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
                                                    <Minus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                                  </button>
                                                  <span
                                                    className={cn(
                                                      "text-[10px] md:text-xs xl:text-sm font-mono tabular-nums w-4 text-center font-bold",
                                                      c === 0 &&
                                                        "text-muted-foreground"
                                                    )}
                                                  >
                                                    {c}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
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
                                                    <Plus className="w-3 h-3 md:w-3.5 md:h-3.5 xl:w-4 xl:h-4" />
                                                  </button>
                                                </>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Team Reactions ── */}
            {teamBuild &&
              (() => {
                const rxFormulas = teamBuild.reactionProvider.getFormulaIds();
                const rxEntries = Object.entries(rxFormulas);
                if (rxEntries.length === 0) return null;

                return (
                  <div className="rounded-lg border border-border bg-black/5 overflow-hidden">
                    <div className="px-2 py-1 flex flex-wrap items-start justify-center gap-x-4 lg:gap-x-6 2xl:gap-x-8 gap-y-1">
                      {rxEntries.map(([formulaId, label]) => {
                        const eligible =
                          teamBuild.reactionProvider.getEligibleCharacters(
                            formulaId
                          );

                        return (
                          <div key={formulaId} className="px-2 py-0.5">
                            <div className="flex items-center gap-1.5 text-xs md:text-sm lg:text-xs xl:text-sm font-bold text-foreground mb-0.5">
                              <ReactionElementIcons
                                formulaId={formulaId}
                                size="w-4 h-4"
                              />
                              {t.resolveLabel(label)}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                              {eligible.map((cid) => {
                                const lineKey = `${cid}.${formulaId}.none`;
                                const count =
                                  comboLineMap.get(lineKey)?.line.count ?? 0;

                                return (
                                  <div key={cid} className="flex items-center">
                                    <span
                                      className={cn(
                                        "text-xs md:text-sm xl:text-base font-semibold",
                                        count > 0
                                          ? "text-foreground"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {t.character(cid)}
                                    </span>
                                    <button
                                      type="button"
                                      className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                      disabled={count <= 0}
                                      onClick={() =>
                                        setComboLineCount(
                                          cid,
                                          formulaId,
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
                                        count === 0 && "text-muted-foreground"
                                      )}
                                    >
                                      {count}
                                    </span>
                                    <button
                                      type="button"
                                      className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                                      disabled={count >= 99}
                                      onClick={() =>
                                        setComboLineCount(
                                          cid,
                                          formulaId,
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
                          </div>
                        );
                      })}
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
        {onInvestmentClick && (
          <div className="mx-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-sm border-amber-600/50 bg-amber-700/30 hover:bg-amber-600/40 text-amber-100"
              onClick={onInvestmentClick}
            >
              <TrendingUp className="w-4 h-4" />
              {t.ui("teamComp.analyzer")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
