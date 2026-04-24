import { Battery, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { AccountData } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { particles } from "@/lib/ercalc/constants";
import {
  autoPlaceFavonius,
  autoPlacePeriodic,
  calculateTeamER,
  getDefaultProcCount,
  hasPeriodicGeneration,
  toTeamMember,
} from "@/lib/ercalc/erCalculator";
import { optimizeWaitBlocks } from "@/lib/ercalc/optimizer";
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
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { CARD_CLS, CARD_HEADER_CLS, CARD_TITLE_CLS } from "./cardStyles";
import { ErResultsPanel } from "./ErResultsPanel";
import { TimelineStrip } from "./TimelineStrip";

const EMPTY_ERT: ERTimeline = { actions: [], periodic: [] };

function resolveCharCtx(
  charId: string,
  team: Team,
  accountData: AccountData | null
): { constellation: number; talentLevels: [number, number, number] } {
  const acctChar = accountData?.characters.find((c) => c.key === charId);
  const defaultConst = acctChar ? acctChar.constellation : 0;
  const constellation =
    team.opts?.[`${charId}.overrideConstellation`] !== undefined
      ? Number(team.opts[`${charId}.overrideConstellation`])
      : defaultConst;
  const acct = acctChar?.talent ?? { auto: 10, skill: 10, burst: 10 };
  const overrideAuto = team.opts?.[`${charId}.overrideTalentAuto`];
  const overrideSkill = team.opts?.[`${charId}.overrideTalentSkill`];
  const overrideBurst = team.opts?.[`${charId}.overrideTalentBurst`];
  const base: [number, number, number] = [
    overrideAuto !== undefined && overrideAuto !== ""
      ? Number(overrideAuto)
      : acct.auto,
    overrideSkill !== undefined && overrideSkill !== ""
      ? Number(overrideSkill)
      : acct.skill,
    overrideBurst !== undefined && overrideBurst !== ""
      ? Number(overrideBurst)
      : acct.burst,
  ];

  // Apply constellation +3 talent bonuses (C3 / C5) — matches CharacterBase
  // effective-level calc in dmgcalc, so ercalc stays aligned with what the UI
  // displays in the talent dropdowns.
  const info = charInfo[charId];
  const c3Bonus = constellation >= 3 && info ? 3 : 0;
  const c5Bonus = constellation >= 5 && info ? 3 : 0;
  const bonusFor = (slot: "A" | "E" | "Q") =>
    (info?.c3Talent === slot ? c3Bonus : 0) +
    (info?.c5Talent === slot ? c5Bonus : 0);
  const talentLevels: [number, number, number] = [
    base[0] + bonusFor("A"),
    base[1] + bonusFor("E"),
    base[2] + bonusFor("Q"),
  ];
  return { constellation, talentLevels };
}

function teamToSlots(team: Team, accountData: AccountData | null): TeamSlot[] {
  const charIds = team.characters.filter((id): id is string => id != null);

  return charIds
    .map((charId, i) => {
      const info = charInfo[charId];
      const pData = particles[charId];
      const element = (pData?.element ?? "Anemo") as Element;
      const burstCost = info?.energy ?? 60;
      const weaponId = team.weapons[i] ?? undefined;
      const { constellation, talentLevels } = resolveCharCtx(
        charId,
        team,
        accountData
      );
      // healAction: only set if this character actually heals at the current
      // constellation. Default action is Q when data hasn't specified one.
      const isHealer =
        info?.healerC !== undefined && constellation >= info.healerC;
      const healAction: "E" | "Q" | undefined = isHealer
        ? (info?.healAction ?? "Q")
        : undefined;
      return {
        charId,
        element,
        burstCost,
        constellation,
        weaponId,
        talentLevels,
        healAction,
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
  const accountData = useActiveAccountData();
  // Persist open/closed across refresh via session store (sessionStorage-backed).
  const expanded = useSessionNavStore(
    (s) => s.viewSettings.damage.erCalcExpanded
  );
  const setErCalcExpanded = useSessionNavStore((s) => s.setErCalcExpanded);
  const collapsed = !expanded;
  const setCollapsed = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof updater === "function" ? updater(collapsed) : updater;
      setErCalcExpanded("damage", !next);
    },
    [collapsed, setErCalcExpanded]
  );

  const charIds = team.characters.filter((id): id is string => id != null);
  const erTeam = useMemo(
    () => teamToSlots(team, accountData),
    [team, accountData]
  );

  // Scholar 4pc bonus is not modeled by the engine (particle-gain trigger
  // isn't wired through distributeParticles yet). Show a banner when any
  // teammate has it equipped so users know the calc ignores it.
  const hasScholarEquipped = useMemo(
    () =>
      team.artifacts.some((a) => a?.type === "4pc" && a.setId === "scholar"),
    [team.artifacts]
  );

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
      timeline2: startup && startup.actions.length > 0 ? mainERT : undefined,
    };
    if (startup && startup.actions.length > 0) {
      return calculateTeamER(teamMembers, startup, opts);
    }
    return calculateTeamER(teamMembers, mainERT, { calcMode, particleMode });
  }, [erTeam, timelines, calcMode, particleMode]);

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
        const newIndex = newActions.length - 1;

        // Backfill deferred procs from earlier triggers onto the new action
        // (procs couldn't be placed when the trigger was the last action).
        for (let j = 0; j < newIndex; j++) {
          const prior = newActions[j];
          const priorIsE =
            prior.action === "E" ||
            prior.action === "holdE" ||
            prior.action === "specialE";
          const priorIsQ = prior.action === "Q" || prior.action === "specialQ";
          let priorTrigger: "E" | "Q" | null = null;
          if (priorIsE && hasPeriodicGeneration(prior.char, "E"))
            priorTrigger = "E";
          else if (priorIsQ && hasPeriodicGeneration(prior.char, "Q"))
            priorTrigger = "Q";
          if (!priorTrigger) continue;
          const expected = getDefaultProcCount(prior.char, priorTrigger);
          const existing = newPeriodic.filter(
            (p) =>
              p.sourceChar === prior.char &&
              p.trigger === priorTrigger &&
              p.targetIndex > j &&
              p.targetIndex <= newIndex
          ).length;
          if (existing < expected) {
            newPeriodic = [
              ...newPeriodic,
              {
                sourceChar: prior.char,
                trigger: priorTrigger,
                targetIndex: newIndex,
              },
            ];
          }
        }

        // Auto-place periodic procs when a periodic trigger is added
        const isETrigger =
          action === "E" || action === "holdE" || action === "specialE";
        const isQTrigger = action === "Q" || action === "specialQ";
        if (isETrigger && hasPeriodicGeneration(charId, "E")) {
          newPeriodic = [
            ...newPeriodic,
            ...autoPlacePeriodic(newActions, newIndex, charId, "E"),
          ];
        } else if (isQTrigger && hasPeriodicGeneration(charId, "Q")) {
          newPeriodic = [
            ...newPeriodic,
            ...autoPlacePeriodic(newActions, newIndex, charId, "Q"),
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

  // Insert a new empty startup timeline immediately before the loop (last).
  const handleAddStartup = useCallback(() => {
    const next = [...timelines];
    // Splice a new empty startup at the position before the loop
    next.splice(next.length - 1, 0, { actions: [], periodic: [] });
    setTimelines(next);
  }, [timelines, setTimelines]);

  // Clone the loop's contents into a new startup timeline.
  const handleCloneLoopToStartup = useCallback(() => {
    const loop = timelines[timelines.length - 1];
    if (!loop || loop.actions.length === 0) return;
    const cloned: ERTimeline = {
      actions: loop.actions.map((a) => ({ ...a })),
      periodic: loop.periodic.map((p) => ({ ...p })),
    };
    const next = [...timelines];
    next.splice(next.length - 1, 0, cloned);
    setTimelines(next);
  }, [timelines, setTimelines]);

  // Remove a startup timeline (cannot remove the loop).
  const handleRemoveTimeline = useCallback(
    (tlIndex: number) => {
      if (tlIndex === timelines.length - 1) return; // never remove loop
      if (timelines.length <= 1) return;
      const next = timelines.filter((_, i) => i !== tlIndex);
      setTimelines(next);
    },
    [timelines, setTimelines]
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

  // Auto-apply Favonius defaults whenever a wielder's weapon or refinement
  // changes. The first run after mount records current weapon state without
  // touching timelines, so persisted customizations survive page reloads;
  // afterwards, equip / refinement / unequip changes re-snap flags to the
  // refinement's default proc count.
  const prevFavState = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (prevFavState.current === null) {
      const initial = new Map<string, string>();
      for (const slot of erTeam) {
        const we = slot.weaponId ? weaponEnergyById[slot.weaponId] : undefined;
        const isFav = we?.energy.effect === "particles";
        initial.set(
          slot.charId,
          isFav ? `${slot.weaponId}|${slot.refinement ?? 0}` : ""
        );
      }
      prevFavState.current = initial;
      return;
    }
    let dirty = false;
    let next = timelines;
    for (const slot of erTeam) {
      const we = slot.weaponId ? weaponEnergyById[slot.weaponId] : undefined;
      const isFav = we?.energy.effect === "particles";
      const stateKey = isFav ? `${slot.weaponId}|${slot.refinement ?? 0}` : "";
      const prev = prevFavState.current.get(slot.charId) ?? "";
      if (prev === stateKey) continue;
      prevFavState.current.set(slot.charId, stateKey);

      const defaultProcs =
        isFav && we && we.energy.effect === "particles"
          ? we.energy.defaultProcsByRefinement[slot.refinement ?? 0]
          : 0;
      next = next.map((ert) => {
        const actions = ert.actions.map((a) => ({ ...a }));
        for (const a of actions)
          if (a.char === slot.charId) a.favoniusProc = false;
        if (defaultProcs > 0)
          autoPlaceFavonius(actions, slot.charId, defaultProcs);
        return { ...ert, actions };
      });
      dirty = true;
    }
    if (dirty) setTimelines(next);
  }, [erTeam, timelines, setTimelines]);

  // Manual "re-snap" for cases where the user edited Favonius flags by hand
  // and wants to return to default placement without touching the weapon.
  const handleResetFavDefaults = useCallback(() => {
    let next = timelines;
    for (const slot of erTeam) {
      const we = slot.weaponId ? weaponEnergyById[slot.weaponId] : undefined;
      if (we?.energy.effect !== "particles") continue;
      const defaultProcs =
        we.energy.defaultProcsByRefinement[slot.refinement ?? 0];
      next = next.map((ert) => {
        const actions = ert.actions.map((a) => ({ ...a }));
        for (const a of actions)
          if (a.char === slot.charId) a.favoniusProc = false;
        autoPlaceFavonius(actions, slot.charId, defaultProcs);
        return { ...ert, actions };
      });
    }
    setTimelines(next);
  }, [erTeam, timelines, setTimelines]);

  // Greedy optimizer: insert wait blocks (+ swap E↔Q) on the loop timeline
  // to minimize the maximum team ER requirement. Operates on the loop only;
  // startup timelines are untouched.
  const handleOptimizeWaits = useCallback(() => {
    if (erTeam.length === 0 || mainERT.actions.length === 0) return;
    const teamMembers = erTeam.map(toTeamMember);
    const startup =
      startupERTs.length > 0 ? concatErTimelines(startupERTs) : undefined;
    const opts = {
      calcMode,
      particleMode,
      timeline2: startup && startup.actions.length > 0 ? mainERT : undefined,
    };
    const baseTimeline =
      startup && startup.actions.length > 0 ? startup : mainERT;
    const result = optimizeWaitBlocks(teamMembers, baseTimeline, opts);
    // Only write back to the loop. Optimizer returns the timeline it mutated,
    // which is `startup` when present — but the optimization edits propagate
    // to the loop via the simulated repeat; we re-run it on the loop only
    // when there's no startup, otherwise we keep startup edits via the result.
    if (!startup || startup.actions.length === 0) {
      setTimelines([...timelines.slice(0, -1), result.timeline]);
    } else {
      // With startup: optimizer edited the startup; the loop is unchanged.
      // For now apply the same optimizer to the loop as a separate pass to
      // surface in-loop wait insertions, which are more impactful for repeats.
      const loopResult = optimizeWaitBlocks(teamMembers, mainERT, {
        calcMode: "full-energy-repeat",
        particleMode,
      });
      setTimelines([...timelines.slice(0, -1), loopResult.timeline]);
    }
  }, [
    erTeam,
    timelines,
    mainERT,
    startupERTs,
    calcMode,
    particleMode,
    concatErTimelines,
    setTimelines,
  ]);

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
            <div className="flex items-center w-full">
              <div className={CARD_TITLE_CLS}>
                <Battery className="w-4 h-4" />
                {t.ui("erCalc.title")}
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform",
                    !collapsed && "rotate-180"
                  )}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-0 max-h-[65vh] overflow-y-auto">
            {/* Settings bar */}
            <div className="px-3 py-2 border-b border-border/30 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs md:text-sm text-foreground/80">
                  {t.ui("erCalc.startEnergy")}
                </span>
                <ToggleGroup
                  type="single"
                  value={startEmpty ? "empty" : "full"}
                  onValueChange={(v) => v && setStartEmpty(v === "empty")}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem
                    value="empty"
                    className="text-xs md:text-sm h-7"
                  >
                    {t.ui("erCalc.zeroEnergy")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="full"
                    className="text-xs md:text-sm h-7"
                  >
                    {t.ui("erCalc.fullEnergy")}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs md:text-sm text-foreground/80">
                  {t.ui("erCalc.particleEst")}
                </span>
                <ToggleGroup
                  type="single"
                  value={particleMode}
                  onValueChange={(v) => v && setParticleMode(v as ParticleMode)}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem
                    value="min"
                    className="text-xs md:text-sm h-7"
                  >
                    {t.ui("erCalc.minEst")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="expected"
                    className="text-xs md:text-sm h-7"
                  >
                    {t.ui("erCalc.avgEst")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="max"
                    className="text-xs md:text-sm h-7"
                  >
                    {t.ui("erCalc.maxEst")}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <button
                type="button"
                onClick={handleResetFavDefaults}
                className="text-xs md:text-sm hover:text-primary px-2 py-1 rounded border border-border/30 hover:border-border"
                title={t.ui("erCalc.resetFavDefaultsTitle")}
              >
                {t.ui("erCalc.resetFavDefaults")}
              </button>
              <button
                type="button"
                onClick={handleOptimizeWaits}
                className="text-xs md:text-sm hover:text-primary px-2 py-1 rounded border border-border/30 hover:border-border"
                title={t.ui("erCalc.optimizeWaitsTitle")}
              >
                {t.ui("erCalc.optimizeWaits")}
              </button>
            </div>

            {hasScholarEquipped && (
              <div className="px-3 py-1.5 text-xs md:text-sm text-amber-400 border-b border-border/30 bg-amber-500/5">
                {t.ui("erCalc.scholarNotImplemented")}
              </div>
            )}

            {/* Timeline editors */}
            {timelines.map((tl, tlIdx) => {
              const isLast = tlIdx === timelines.length - 1;
              const startupNum = tlIdx + 1;
              const labelNode = isLast ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm md:text-base font-semibold">
                    {t.ui("erCalc.loopLabel")}
                  </span>
                  <ToggleGroup
                    type="single"
                    value={repeatLast ? "repeat" : "once"}
                    onValueChange={(v) => v && setRepeatLast(v === "repeat")}
                    variant="outline"
                    size="sm"
                  >
                    <ToggleGroupItem
                      value="once"
                      className="text-sm font-semibold h-7 px-2.5"
                    >
                      ×1
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="repeat"
                      className="text-sm font-semibold h-7 px-2.5"
                    >
                      ×∞
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ) : (
                <span className="text-sm md:text-base font-semibold">
                  {t.ui("erCalc.startupLabel")} {startupNum}
                </span>
              );

              const removeControl = !isLast ? (
                <button
                  type="button"
                  onClick={() => handleRemoveTimeline(tlIdx)}
                  className="text-xs md:text-sm hover:text-destructive px-2 py-0.5 rounded border border-border/30 hover:border-destructive/40"
                  title={t.ui("erCalc.removeStartupTitle")}
                >
                  {t.ui("erCalc.remove")}
                </button>
              ) : null;

              const loopControls = isLast ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleAddStartup}
                    className="text-xs md:text-sm hover:text-primary px-2 py-0.5 rounded border border-border/30 hover:border-border"
                    title={t.ui("erCalc.addStartupTitle")}
                  >
                    {t.ui("erCalc.addStartup")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloneLoopToStartup}
                    disabled={tl.actions.length === 0}
                    className="text-xs md:text-sm hover:text-primary px-2 py-0.5 rounded border border-border/30 hover:border-border disabled:opacity-40 disabled:cursor-not-allowed"
                    title={t.ui("erCalc.cloneLoopTitle")}
                  >
                    {t.ui("erCalc.cloneLoop")}
                  </button>
                </div>
              ) : null;

              return (
                <TimelineStrip
                  key={tlIdx}
                  label={labelNode}
                  ert={tl}
                  team={erTeam}
                  bindingQIndices={isLast ? bindingQIndices : undefined}
                  extraControls={removeControl ?? loopControls}
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
                      "text-xs md:text-sm",
                      hint.type === "warning"
                        ? "text-amber-400"
                        : "text-foreground/80"
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
              <ErResultsPanel
                results={results}
                team={erTeam}
                targetTeam={team}
                embedded
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
