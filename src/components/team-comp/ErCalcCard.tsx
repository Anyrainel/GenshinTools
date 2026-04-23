import { Battery, ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import { charInfo } from "@/data/charInfo";
import type { Element } from "@/data/enums";
import { ENEMY_PRESETS, particles } from "@/lib/ercalc/constants";
import {
  autoPlaceFavonius,
  autoPlacePeriodic,
  calculateTeamER,
  hasPeriodicGeneration,
  toTeamMember,
} from "@/lib/ercalc/erCalculator";
import { analyzeRotation } from "@/lib/ercalc/rotationHints";
import type {
  ActionType,
  CalcMode,
  ERResult,
  ERTimeline,
  ParticleMode,
  PeriodicProc,
  TeamSlot,
  TimelineAction,
} from "@/lib/ercalc/types";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import type { Team } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/stores/useTeamStore";
import { CARD_CLS, CARD_HEADER_CLS, CARD_TITLE_CLS } from "./cardStyles";
import { ErResultsPanel } from "./ErResultsPanel";
import { TimelineStrip } from "./TimelineStrip";

const EMPTY_ERT: ERTimeline = { actions: [], periodic: [] };

function teamToSlots(team: Team): TeamSlot[] {
  return team.characters
    .filter((id): id is string => id != null)
    .map((charId, i) => {
      const info = charInfo[charId];
      const pData = particles[charId];
      const element = (pData?.element ?? "Anemo") as Element;
      const burstCost = info?.energy ?? 60;
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

interface ErCalcCardProps {
  team: Team;
}

export function ErCalcCard({ team }: ErCalcCardProps) {
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

  // Concatenate multiple startup ERTimelines into one ERTimeline
  const concatErTimelines = useCallback((ts: ERTimeline[]): ERTimeline => {
    const actions: TimelineAction[] = [];
    const periodic: PeriodicProc[] = [];
    let offset = 0;
    for (const t of ts) {
      for (const a of t.actions) actions.push({ ...a });
      for (const p of t.periodic) {
        periodic.push({ ...p, targetIndex: p.targetIndex + offset });
      }
      offset += t.actions.length;
    }
    return { actions, periodic };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mainERT derived from timelines
  const results = useMemo<ERResult[]>(() => {
    if (erTeam.length === 0 || mainERT.actions.length === 0) return [];
    const teamMembers = erTeam.map(toTeamMember);
    const startup =
      startupERTs.length > 0 ? concatErTimelines(startupERTs) : undefined;
    const opts = {
      calcMode,
      particleMode,
      enemyParticles: enemyParticles || undefined,
      timeline2: startup && startup.actions.length > 0 ? mainERT : undefined,
    };
    if (startup && startup.actions.length > 0) {
      return calculateTeamER(teamMembers, startup, opts);
    }
    return calculateTeamER(teamMembers, mainERT, {
      calcMode,
      particleMode,
      enemyParticles: enemyParticles || undefined,
    });
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
        const newActions: TimelineAction[] = [
          ...ert.actions,
          { char: charId, action },
        ];
        let newPeriodic = [...ert.periodic];

        // Auto-place periodic procs when a periodic trigger is added
        const isETrigger =
          action === "E" || action === "holdE" || action === "specialE";
        const isQTrigger = action === "Q" || action === "specialQ";
        if (isETrigger && hasPeriodicGeneration(charId, "E")) {
          const idx = newActions.length - 1;
          newPeriodic = [
            ...newPeriodic,
            ...autoPlacePeriodic(newActions, idx, charId, "E"),
          ];
        } else if (isQTrigger && hasPeriodicGeneration(charId, "Q")) {
          const idx = newActions.length - 1;
          newPeriodic = [
            ...newPeriodic,
            ...autoPlacePeriodic(newActions, idx, charId, "Q"),
          ];
        }

        // Auto-toggle Favonius on this node if wielder has Favonius AND
        // doesn't yet have the default N procs flagged in this timeline
        const wielder = erTeam.find((s) => s.charId === charId);
        const we = wielder?.weaponId
          ? weaponEnergyById[wielder.weaponId]
          : undefined;
        if (we?.energy.effect === "particles" && (isETrigger || isQTrigger)) {
          const defaultProcs =
            we.energy.defaultProcsByRefinement[wielder?.refinement ?? 0];
          const existing = newActions.filter(
            (a) => a.char === charId && a.favoniusProc
          ).length;
          if (existing < defaultProcs) {
            newActions[newActions.length - 1] = {
              ...newActions[newActions.length - 1],
              favoniusProc: true,
            };
          }
        }

        return { actions: newActions, periodic: newPeriodic };
      });
    },
    [updateTimeline, erTeam]
  );

  const handleRemoveAction = useCallback(
    (index: number, tlIndex: number) => {
      updateTimeline(tlIndex, (ert) => {
        const newActions = ert.actions.filter((_, i) => i !== index);
        const newPeriodic = ert.periodic
          .filter((p) => p.targetIndex !== index)
          .map((p) => ({
            ...p,
            targetIndex:
              p.targetIndex > index ? p.targetIndex - 1 : p.targetIndex,
          }));
        return { actions: newActions, periodic: newPeriodic };
      });
    },
    [updateTimeline]
  );

  const handleUpdateAction = useCallback(
    (index: number, action: TimelineAction, tlIndex: number) => {
      updateTimeline(tlIndex, (ert) => ({
        ...ert,
        actions: ert.actions.map((a, i) => (i === index ? action : a)),
      }));
    },
    [updateTimeline]
  );

  const handleReorderActions = useCallback(
    (newActions: TimelineAction[], tlIndex: number) => {
      updateTimeline(tlIndex, (ert) => ({ ...ert, actions: newActions }));
    },
    [updateTimeline]
  );

  const handleUpdatePeriodic = useCallback(
    (newPeriodic: PeriodicProc[], tlIndex: number) => {
      updateTimeline(tlIndex, (ert) => ({ ...ert, periodic: newPeriodic }));
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
        concatErTimelines(timelines),
        erTeam.map((s) => s.charId)
      ),
    [timelines, erTeam, concatErTimelines]
  );

  const bottleneck = useMemo(() => {
    const withQ = results.filter((r) => r.hasQ);
    if (withQ.length === 0) return null;
    const max = withQ.reduce((a, b) => (a.erNeeded > b.erNeeded ? a : b));
    if (max.erNeeded === Number.POSITIVE_INFINITY || max.erNeeded <= 100)
      return null;
    return max;
  }, [results]);

  // Suggestion: auto-toggle Favonius on existing timelines when a wielder equips Favonius
  const applyFavoniusDefaults = useCallback(() => {
    for (const slot of erTeam) {
      const we = slot.weaponId ? weaponEnergyById[slot.weaponId] : undefined;
      if (we?.energy.effect !== "particles") continue;
      const defaultProcs =
        we.energy.defaultProcsByRefinement[slot.refinement ?? 0];
      const newTimelines = timelines.map((ert) => {
        const actions = ert.actions.map((a) => ({ ...a }));
        // Clear prior Favonius flags for this wielder, then re-apply defaults
        for (const a of actions)
          if (a.char === slot.charId) a.favoniusProc = false;
        autoPlaceFavonius(actions, slot.charId, defaultProcs);
        return { ...ert, actions };
      });
      setTimelines(newTimelines);
    }
  }, [erTeam, timelines, setTimelines]);

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
                  setEnemyParticles(Number.parseInt(e.target.value, 10))
                }
                className="text-xs rounded-md border border-border bg-background/50 px-2 py-1 h-6"
              >
                {ENEMY_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {language === "zh" ? p.labelZh : p.labelEn}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={applyFavoniusDefaults}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border/30 hover:border-border"
                title={
                  language === "zh"
                    ? "重置西风默认产球"
                    : "Reset Favonius defaults"
                }
              >
                {language === "zh" ? "重置西风" : "Reset Fav"}
              </button>
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
                  onUpdateAction={(i, a) => handleUpdateAction(i, a, tlIdx)}
                  onReorderActions={(newActions) =>
                    handleReorderActions(newActions, tlIdx)
                  }
                  onUpdatePeriodic={(newP) => handleUpdatePeriodic(newP, tlIdx)}
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
              <ErResultsPanel results={results} team={erTeam} embedded />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
