import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import { charInfo } from "@/data/charInfo";
import type { Element } from "@/data/types";
import { ENEMY_PRESETS } from "@/lib/ercalc/constants";
import {
  autoPlaceTicks,
  calculateTeamER,
  flattenERTimeline,
  particles,
  toTeamMember,
} from "@/lib/ercalc/erCalculator";
import { periodicGenerators } from "@/lib/ercalc/particleConfig";
import { analyzeRotation } from "@/lib/ercalc/rotationHints";
import type {
  ActionType,
  CalcMode,
  ERResult,
  ERTimeline,
  ParticleMode,
  TeamSlot,
  TickAssignment,
  TimelineAction,
} from "@/lib/ercalc/types";
import { cn } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { Battery, ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "../team-comp/cardStyles";
import { ERResultsPanel } from "./ERResultsPanel";
import { TimelineStrip } from "./TimelineStrip";

const EMPTY_ERT: ERTimeline = { actions: [], ticks: [] };

function teamToSlots(team: Team): TeamSlot[] {
  return team.characters
    .filter((id): id is string => id != null)
    .map((charId, i) => {
      const info = charInfo[charId];
      const element = (info?.element ?? "Anemo") as Element;
      const burstCost = info?.burstCost ?? 60;
      const weaponId = team.weapons[i] ?? undefined;
      return {
        charId,
        element,
        burstCost,
        constellation: 0,
        weaponId,
      };
    })
    .filter((s) => particles[s.charId]);
}

interface ERCalcCardProps {
  team: Team;
}

export function ERCalcCard({ team }: ERCalcCardProps) {
  const { t, language } = useLanguage();
  const updateTeam = useTeamStore((s) => s.updateTeam);
  const [collapsed, setCollapsed] = useState(true);

  const charIds = team.characters.filter((id): id is string => id != null);
  const erTeam = useMemo(() => teamToSlots(team), [team]);

  // Read timelines from team store, fallback to empty
  const timelines = useMemo<ERTimeline[]>(
    () =>
      team.erTimelines && team.erTimelines.length > 0
        ? team.erTimelines
        : [EMPTY_ERT],
    [team.erTimelines]
  );

  const setTimelines = useCallback(
    (newTimelines: ERTimeline[]) => {
      updateTeam(team.id, { erTimelines: newTimelines });
    },
    [team.id, updateTeam]
  );

  const [startEmpty, setStartEmpty] = useState(false);
  const [repeatLast, setRepeatLast] = useState(true);
  const [enemyParticles, setEnemyParticles] = useState(0);
  const [particleMode, setParticleMode] = useState<ParticleMode>("expected");

  const calcMode: CalcMode = startEmpty
    ? repeatLast
      ? "zero-energy-repeat"
      : "zero-energy-start"
    : "full-energy-repeat";

  const mainERT = timelines[timelines.length - 1] ?? EMPTY_ERT;
  const startupERTs = timelines.slice(0, -1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mainERT derived from timelines
  const results = useMemo<ERResult[]>(() => {
    if (erTeam.length === 0 || mainERT.actions.length === 0) return [];
    const teamMembers = erTeam.map(toTeamMember);
    const mainFlat = flattenERTimeline(mainERT);
    const startupFlat =
      startupERTs.length > 0
        ? startupERTs.flatMap((ert) => flattenERTimeline(ert))
        : undefined;
    const opts = {
      calcMode,
      particleMode,
      enemyParticles: enemyParticles || undefined,
      timeline2:
        startupFlat && startupFlat.length > 0 ? startupFlat : undefined,
    };
    if (startupFlat && startupFlat.length > 0) {
      return calculateTeamER(teamMembers, startupFlat, {
        ...opts,
        timeline2: mainFlat,
      });
    }
    return calculateTeamER(teamMembers, mainFlat, opts);
  }, [erTeam, timelines, calcMode, particleMode, enemyParticles]);

  const updateTimeline = useCallback(
    (tlIndex: number, updater: (ert: ERTimeline) => ERTimeline) => {
      const newTimelines = timelines.map((ert, i) =>
        i === tlIndex ? updater(ert) : ert
      );
      setTimelines(newTimelines);
    },
    [timelines, setTimelines]
  );

  const handleAddAction = useCallback(
    (charId: string, action: ActionType, tlIndex: number) => {
      updateTimeline(tlIndex, (ert) => {
        const newActions = [...ert.actions, { char: charId, action }];
        let newTicks = [...ert.ticks];
        if (
          (action === "E" || action === "holdE") &&
          periodicGenerators.has(charId)
        ) {
          const eIndex = newActions.length - 1;
          newTicks = [
            ...newTicks,
            ...autoPlaceTicks(newActions, eIndex, charId),
          ];
        }
        return { actions: newActions, ticks: newTicks };
      });
    },
    [updateTimeline]
  );

  const handleRemoveAction = useCallback(
    (index: number, tlIndex: number) => {
      updateTimeline(tlIndex, (ert) => {
        const newActions = ert.actions.filter((_, i) => i !== index);
        const newTicks = ert.ticks
          .filter((tk) => tk.targetIndex !== index)
          .map((tk) => ({
            ...tk,
            targetIndex:
              tk.targetIndex > index ? tk.targetIndex - 1 : tk.targetIndex,
          }));
        return { actions: newActions, ticks: newTicks };
      });
    },
    [updateTimeline]
  );

  const handleReorderActions = useCallback(
    (newActions: TimelineAction[], tlIndex: number) => {
      updateTimeline(tlIndex, (ert) => ({ ...ert, actions: newActions }));
    },
    [updateTimeline]
  );

  const handleUpdateTicks = useCallback(
    (newTicks: TickAssignment[], tlIndex: number) => {
      updateTimeline(tlIndex, (ert) => ({ ...ert, ticks: newTicks }));
    },
    [updateTimeline]
  );

  const handleClearTimeline = useCallback(
    (tlIndex: number) => {
      updateTimeline(tlIndex, () => EMPTY_ERT);
    },
    [updateTimeline]
  );

  const bindingQIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const r of results) {
      if (r.bindingQIndex != null && r.bindingQIndex >= 0) {
        indices.add(r.bindingQIndex);
      }
    }
    return indices;
  }, [results]);

  const hints = useMemo(
    () =>
      analyzeRotation(
        timelines.flatMap((ert) => flattenERTimeline(ert)),
        erTeam.map((s) => s.charId)
      ),
    [timelines, erTeam]
  );

  const bottleneck = useMemo(() => {
    const withQ = results.filter((r) => r.hasQ);
    if (withQ.length === 0) return null;
    const max = withQ.reduce((a, b) => (a.erNeeded > b.erNeeded ? a : b));
    if (max.erNeeded === Number.POSITIVE_INFINITY || max.erNeeded <= 100)
      return null;
    return max;
  }, [results]);

  if (charIds.length < 2) return null;

  return (
    <Card className={CARD_CLS}>
      <Collapsible
        open={!collapsed}
        onOpenChange={() => setCollapsed((p) => !p)}
      >
        <CollapsibleTrigger asChild>
          <CardHeader
            className={cn(CARD_HEADER_CLS, "cursor-pointer select-none")}
          >
            <div className="flex items-center justify-between w-full">
              <div className={CARD_TITLE_CLS}>
                <Battery className="w-4 h-4" />
                {language === "zh" ? "能量需求" : "ER Requirements"}
              </div>
              <div className="flex items-center gap-2">
                {collapsed && bottleneck && (
                  <span className="text-xs text-amber-400 font-medium">
                    {t.character(bottleneck.characterId).split(/[\s_]/)[0]}{" "}
                    {Math.ceil(bottleneck.erNeeded)}%
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    !collapsed && "rotate-180"
                  )}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-0">
            {/* Settings bar */}
            <div className="px-3 py-2 border-b border-border/30 flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                value={startEmpty ? "empty" : "full"}
                onValueChange={(v) => v && setStartEmpty(v === "empty")}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="empty" className="text-xs h-6">
                  {language === "zh" ? "零能量" : "Empty"}
                </ToggleGroupItem>
                <ToggleGroupItem value="full" className="text-xs h-6">
                  {language === "zh" ? "满能量" : "Full"}
                </ToggleGroupItem>
              </ToggleGroup>

              <ToggleGroup
                type="single"
                value={particleMode}
                onValueChange={(v) => v && setParticleMode(v as ParticleMode)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="min" className="text-xs h-6">
                  Min
                </ToggleGroupItem>
                <ToggleGroupItem value="expected" className="text-xs h-6">
                  {language === "zh" ? "期望" : "Avg"}
                </ToggleGroupItem>
                <ToggleGroupItem value="max" className="text-xs h-6">
                  Max
                </ToggleGroupItem>
              </ToggleGroup>

              <select
                value={enemyParticles}
                onChange={(e) =>
                  setEnemyParticles(Number.parseInt(e.target.value))
                }
                className="text-xs rounded-md border border-border bg-background/50 px-2 py-1 h-6"
              >
                {ENEMY_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {language === "zh" ? p.labelZh : p.labelEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Timeline editors */}
            {timelines.map((tl, tlIdx) => {
              const isLast = tlIdx === timelines.length - 1;
              const seqNum = tlIdx + 1;
              const labelNode = isLast ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {language === "zh" ? `序列 ${seqNum}` : `Seq ${seqNum}`}
                  </span>
                  <ToggleGroup
                    type="single"
                    value={repeatLast ? "repeat" : "once"}
                    onValueChange={(v) => v && setRepeatLast(v === "repeat")}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem value="once" className="text-xs h-5">
                      ×1
                    </ToggleGroupItem>
                    <ToggleGroupItem value="repeat" className="text-xs h-5">
                      ×∞
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ) : (
                `${language === "zh" ? "序列" : "Seq"} ${seqNum} ×1`
              );

              return (
                <TimelineStrip
                  key={tlIdx}
                  label={labelNode}
                  ert={tl}
                  team={erTeam}
                  bindingQIndices={isLast ? bindingQIndices : undefined}
                  onAddAction={(charId, action) =>
                    handleAddAction(charId, action, tlIdx)
                  }
                  onRemoveAction={(i) => handleRemoveAction(i, tlIdx)}
                  onReorderActions={(newActions) =>
                    handleReorderActions(newActions, tlIdx)
                  }
                  onUpdateTicks={(newTicks) =>
                    handleUpdateTicks(newTicks, tlIdx)
                  }
                  onClear={() => handleClearTimeline(tlIdx)}
                />
              );
            })}

            {/* Hints */}
            {hints.length > 0 && (
              <div className="px-3 py-2 space-y-1 border-t border-border/30">
                {hints.map((hint, i) => (
                  <div
                    key={`hint-${i}`}
                    className={cn(
                      "text-xs",
                      hint.type === "warning"
                        ? "text-amber-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {(language === "zh"
                      ? hint.messageZh
                      : hint.messageEn
                    ).replace(
                      "{char}",
                      hint.charId ? t.character(hint.charId) : ""
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <ERResultsPanel results={results} team={erTeam} embedded />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
