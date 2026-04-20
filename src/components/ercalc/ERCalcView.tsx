import { CARD_CLS, CARD_HEADER_CLS } from "@/components/team-comp/cardStyles";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import { ENEMY_PRESETS } from "@/lib/ercalc/constants";
import { calculateTeamER, toTeamMember } from "@/lib/ercalc/erCalculator";
import { analyzeRotation } from "@/lib/ercalc/rotationHints";
import type {
  ActionType,
  CalcMode,
  ERResult,
  ParticleMode,
  TeamSlot,
  Timeline,
} from "@/lib/ercalc/types";
import { cn } from "@/lib/utils";
import { useCallback, useMemo, useState } from "react";
import { ERResultsPanel } from "./ERResultsPanel";
import { TeamSetup } from "./TeamSetup";
import { TimelineStrip } from "./TimelineStrip";

export type { TeamSlot } from "@/lib/ercalc/types";

const DEFAULT_TEAM: TeamSlot[] = [
  { charId: "bennett", element: "Pyro", burstCost: 60, constellation: 0 },
  { charId: "xiangling", element: "Pyro", burstCost: 80, constellation: 0 },
  { charId: "xingqiu", element: "Hydro", burstCost: 80, constellation: 0 },
  { charId: "sucrose", element: "Anemo", burstCost: 80, constellation: 0 },
];

const DEFAULT_TIMELINE: Timeline = [
  { char: "bennett", action: "E" }, // Bennett E → XL absorbs (funneling)
  { char: "xiangling", action: "Q" }, // XL bursts
  { char: "bennett", action: "E" }, // Bennett E → XL E absorbs
  { char: "xiangling", action: "E" }, // Deploy Guoba
  { char: "bennett", action: "NA" }, // Bennett on-field while Guoba fires
  { char: "xiangling", action: "periodicE" }, // Guoba hit 1 → Bennett NA absorbs
  { char: "bennett", action: "NA" },
  { char: "xiangling", action: "periodicE" }, // Guoba hit 2 → Bennett NA absorbs
  { char: "bennett", action: "E" }, // Bennett E → Bennett Q absorbs
  { char: "xiangling", action: "periodicE" }, // Guoba hit 3 → XQ E absorbs
  { char: "xiangling", action: "periodicE" }, // Guoba hit 4 → XQ E absorbs
  { char: "bennett", action: "Q" },
  { char: "xingqiu", action: "E" },
  { char: "xingqiu", action: "E" },
  { char: "xingqiu", action: "Q" },
  { char: "sucrose", action: "E" },
  { char: "sucrose", action: "E" },
  { char: "sucrose", action: "Q" },
];

export function ERCalcView() {
  const { t, language } = useLanguage();
  const [team, setTeam] = useState<TeamSlot[]>(DEFAULT_TEAM);
  const [timelines, setTimelines] = useState<Timeline[]>([
    [],
    DEFAULT_TIMELINE,
  ]);
  const [startEmpty, setStartEmpty] = useState(false); // false = 满能量, true = 零能量
  const [repeatLast, setRepeatLast] = useState(true); // true = 循环, false = 单次
  const [enemyParticles, setEnemyParticles] = useState(0);
  const [particleMode, setParticleMode] = useState<ParticleMode>("expected");

  // Derive the old CalcMode from the two toggles
  const calcMode: CalcMode = startEmpty
    ? repeatLast
      ? "zero-energy-repeat"
      : "zero-energy-start"
    : "full-energy-repeat"; // 满能量 + 单次 treated as full-energy-repeat (×1 is edge case)

  // The last timeline is the "main" rotation. Earlier ones are startup sequences.
  const mainTimeline = timelines[timelines.length - 1] ?? [];
  const startupTimelines = timelines.slice(0, -1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mainTimeline and startupTimelines are derived from timelines
  const results = useMemo<ERResult[]>(() => {
    if (team.length === 0 || mainTimeline.length === 0) return [];
    const teamMembers = team.map(toTeamMember);
    // Concatenate all startup timelines into one startup sequence
    const startupSequence =
      startupTimelines.length > 0 ? startupTimelines.flat() : undefined;
    const opts = {
      calcMode,
      particleMode,
      enemyParticles: enemyParticles || undefined,
      timeline2:
        startupSequence && startupSequence.length > 0
          ? startupSequence
          : undefined,
    };
    // Note: engine expects timeline=startup, timeline2=repeating for dual mode.
    // But our model is: startupTimelines run first, then mainTimeline repeats.
    // We need to swap: pass mainTimeline as the "timeline" param (which the engine
    // treats as the repeating rotation) and startupSequence as timeline2 (startup).
    // Actually the engine's convention: timeline=primary, timeline2=repeating.
    // With dual: timeline=startup(T1), timeline2=repeating(T2).
    // So: pass startupSequence as timeline, mainTimeline as timeline2.
    if (startupSequence && startupSequence.length > 0) {
      return calculateTeamER(teamMembers, startupSequence, {
        ...opts,
        timeline2: mainTimeline,
      });
    }
    return calculateTeamER(teamMembers, mainTimeline, opts);
  }, [team, timelines, calcMode, particleMode, enemyParticles]);

  const handleTeamChange = useCallback((newTeam: TeamSlot[]) => {
    const newIds = new Set(newTeam.map((s) => s.charId));
    setTimelines((prev) =>
      prev.map((tl) => tl.filter((a) => newIds.has(a.char)))
    );
    setTeam(newTeam);
  }, []);

  // Helper to update a specific timeline by index
  const updateTimeline = useCallback(
    (tlIndex: number, updater: (tl: Timeline) => Timeline) => {
      setTimelines((prev) =>
        prev.map((tl, i) => (i === tlIndex ? updater(tl) : tl))
      );
    },
    []
  );

  const handleAddAction = useCallback(
    (charId: string, action: ActionType, tlIndex: number) => {
      updateTimeline(tlIndex, (tl) => [...tl, { char: charId, action }]);
    },
    [updateTimeline]
  );

  const handleRemoveAction = useCallback(
    (index: number, tlIndex: number) => {
      updateTimeline(tlIndex, (tl) => tl.filter((_, i) => i !== index));
    },
    [updateTimeline]
  );

  const handleReorderTimeline = useCallback(
    (newTimeline: Timeline, tlIndex: number) => {
      updateTimeline(tlIndex, () => newTimeline);
    },
    [updateTimeline]
  );

  const handleClearTimeline = useCallback(
    (tlIndex: number) => {
      updateTimeline(tlIndex, () => []);
    },
    [updateTimeline]
  );

  const handleAddTimeline = useCallback(() => {
    setTimelines((prev) => [...prev.slice(0, -1), [], prev[prev.length - 1]]);
  }, []);

  const handleRemoveTimeline = useCallback((tlIndex: number) => {
    setTimelines((prev) => prev.filter((_, i) => i !== tlIndex));
  }, []);

  const handleCopyTimeline = useCallback((tlIndex: number) => {
    setTimelines((prev) => [
      ...prev.slice(0, tlIndex),
      [...prev[tlIndex]],
      ...prev.slice(tlIndex),
    ]);
  }, []);

  // activeMode description derived from toggles
  const modeDesc = startEmpty
    ? repeatLast
      ? { en: "Start 0, sustain forever", zh: "从零开始并持续循环" }
      : { en: "Start 0, one-shot", zh: "从零能量开始单次释放" }
    : repeatLast
      ? { en: "Start full, sustain forever", zh: "满能量持续循环" }
      : { en: "Start full, one-shot", zh: "满能量单次释放" };

  // Collect binding Q indices from results to highlight in the timeline
  const bindingQIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const r of results) {
      if (r.bindingQIndex != null && r.bindingQIndex >= 0) {
        indices.add(r.bindingQIndex);
      }
    }
    return indices;
  }, [results]);

  // Rotation hints (analyze all timelines concatenated)
  const hints = useMemo(
    () =>
      analyzeRotation(
        timelines.flat(),
        team.map((s) => s.charId)
      ),
    [timelines, team]
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* ── Team card ── */}
        <div className={cn("rounded-xl overflow-hidden", CARD_CLS)}>
          <div className="p-3 md:p-4 space-y-3">
            <TeamSetup team={team} onChange={handleTeamChange} />
          </div>
        </div>

        {/* ── Combat Sequence section ── */}
        <div className={cn("rounded-xl overflow-hidden", CARD_CLS)}>
          {/* Section header: title + settings */}
          <div className={cn(CARD_HEADER_CLS, "space-y-2")}>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold">
                {language === "zh" ? "战斗序列" : "Combat Sequence"}
              </h3>
              <div className="h-5 w-px bg-border/50 hidden sm:block" />
              {/* Energy start toggle */}
              <ToggleGroup
                type="single"
                value={startEmpty ? "empty" : "full"}
                onValueChange={(v) => v && setStartEmpty(v === "empty")}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="empty" className="text-xs">
                  {language === "zh" ? "零能量启动" : "Start Empty"}
                </ToggleGroupItem>
                <ToggleGroupItem value="full" className="text-xs">
                  {language === "zh" ? "满能量启动" : "Start Full"}
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="h-5 w-px bg-border/50 hidden sm:block" />

              <ToggleGroup
                type="single"
                value={particleMode}
                onValueChange={(v) => v && setParticleMode(v as ParticleMode)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="min" className="text-xs">
                  Min
                </ToggleGroupItem>
                <ToggleGroupItem value="expected" className="text-xs">
                  {language === "zh" ? "期望" : "Avg"}
                </ToggleGroupItem>
                <ToggleGroupItem value="max" className="text-xs">
                  Max
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="h-5 w-px bg-border/50 hidden sm:block" />

              <select
                value={enemyParticles}
                onChange={(e) =>
                  setEnemyParticles(Number.parseInt(e.target.value))
                }
                className="text-xs rounded-md border border-border bg-background/50 px-2 py-1.5 cursor-pointer"
              >
                {ENEMY_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {language === "zh" ? preset.labelZh : preset.labelEn}
                  </option>
                ))}
              </select>

              <div className="h-5 w-px bg-border/50 hidden sm:block" />

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleAddTimeline}
              >
                + {language === "zh" ? "添加序列" : "Add sequence"}
              </Button>
            </div>
          </div>

          {/* N timelines */}
          <div className="space-y-0">
            {timelines.map((tl, tlIdx) => {
              const isLast = tlIdx === timelines.length - 1;
              const seqNum = tlIdx + 1;

              // Label: last timeline shows 单次/循环 toggle inline
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
                    <ToggleGroupItem value="once" className="text-xs">
                      ×1
                    </ToggleGroupItem>
                    <ToggleGroupItem value="repeat" className="text-xs">
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
                  timeline={tl}
                  team={team}
                  bindingQIndices={isLast ? bindingQIndices : undefined}
                  onAddAction={(charId, action) =>
                    handleAddAction(charId, action, tlIdx)
                  }
                  onRemoveAction={(i) => handleRemoveAction(i, tlIdx)}
                  onReorder={(newTl) => handleReorderTimeline(newTl, tlIdx)}
                  onClear={() => handleClearTimeline(tlIdx)}
                  extraControls={
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-1"
                        onClick={() => handleCopyTimeline(tlIdx)}
                      >
                        {language === "zh" ? "复制" : "Copy"}
                      </Button>
                      {!isLast && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6 px-1 text-destructive"
                          onClick={() => handleRemoveTimeline(tlIdx)}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  }
                />
              );
            })}
          </div>

          {/* Rotation hints */}
          {hints.length > 0 && (
            <div className="px-4 py-2 space-y-1 border-t border-border/50">
              {hints.map((hint, i) => (
                <div
                  key={`hint-${i}`}
                  className={`text-xs ${
                    hint.type === "warning"
                      ? "text-amber-400"
                      : "text-muted-foreground"
                  }`}
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
        </div>

        {/* ── Results ── */}
        {results.length > 0 && <ERResultsPanel results={results} team={team} />}
      </div>
    </div>
  );
}
