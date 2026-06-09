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
import { characterStatsResource } from "@/data/gameStatsLoader";
import type { AccountData } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import {
  DIRECT_PARTICLE_ACTIONS,
  ORB_MULTIPLIER,
  PATTERN_ACTIONS,
  particles,
} from "@/lib/ercalc/constants";
import {
  autoPlaceFavonius,
  autoPlacePeriodic,
  autoPlaceReactionProcs,
  calculateTeamERSequence,
  getActionParticles,
  getDefaultProcCount,
  getHitParticles,
  getParticleElement,
  hasPeriodicGeneration,
  hasReactionEnergyTrigger,
  toTeamMember,
} from "@/lib/ercalc/erCalculator";
import { optimizeWaitBlocks } from "@/lib/ercalc/optimizer";
import type {
  ActionType,
  CalcMode,
  ERCalculationSegment,
  ERResult,
  ERTimeline,
  ParticleMode,
  PeriodicProc,
  TeamSlot,
  TimelineAction,
} from "@/lib/ercalc/types";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import { teamCompToArrays } from "@/lib/team-comp/teamDeltas";
import type { TeamComp, TeamSetupConfig } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { CARD_CLS, CARD_HEADER_CLS, CARD_TITLE_CLS } from "./cardStyles";
import { ErResultsPanel } from "./ErResultsPanel";
import { TimelineStrip } from "./TimelineStrip";

const EMPTY_ERT: ERTimeline = { actions: [], periodic: [] };

type TimelineListUpdate =
  | ERTimeline[]
  | ((currentTimelines: ERTimeline[]) => ERTimeline[]);

function resolveEnergyTimelines(
  timelines: ERTimeline[] | undefined
): ERTimeline[] {
  return timelines && timelines.length > 0 ? timelines : [EMPTY_ERT];
}

function applyFavoniusDefaultsToActions(
  actions: TimelineAction[],
  team: TeamSlot[]
): TimelineAction[] {
  const nextActions = actions.map((action) => ({ ...action }));
  for (const slot of team) {
    const weaponEnergy = slot.weaponId
      ? weaponEnergyById[slot.weaponId]?.energy
      : undefined;
    if (weaponEnergy?.effect !== "particles") continue;

    const defaultProcs =
      weaponEnergy.defaultProcsByRefinement[slot.refinement ?? 0];
    for (const action of nextActions) {
      if (action.char === slot.charId) action.favoniusProc = false;
    }
    autoPlaceFavonius(nextActions, slot.charId, defaultProcs);
  }
  return nextActions;
}

function hasFavoniusDefaultsDiff(
  timelines: ERTimeline[],
  team: TeamSlot[]
): boolean {
  return timelines.some((timeline) => {
    const defaultActions = applyFavoniusDefaultsToActions(
      timeline.actions,
      team
    );
    return timeline.actions.some(
      (action, index) =>
        !!action.favoniusProc !== !!defaultActions[index]?.favoniusProc
    );
  });
}

function resolveCharCtx(
  charId: string,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null
): { constellation: number; talentLevels: [number, number, number] } {
  const acctChar = accountData?.characters.find((c) => c.key === charId);
  const defaultConst = acctChar ? acctChar.constellation : 0;
  const constellation =
    setupConfig.charConfigs?.[charId]?.constellation ??
    (setupConfig.combatOptions?.[`${charId}.overrideConstellation`] !==
    undefined
      ? Number(setupConfig.combatOptions[`${charId}.overrideConstellation`])
      : defaultConst);
  const acct = acctChar?.talent ?? { auto: 10, skill: 10, burst: 10 };
  const authoredTalent = setupConfig.charConfigs?.[charId]?.talentLevels;
  const overrideAuto =
    setupConfig.combatOptions?.[`${charId}.overrideTalentAuto`];
  const overrideSkill =
    setupConfig.combatOptions?.[`${charId}.overrideTalentSkill`];
  const overrideBurst =
    setupConfig.combatOptions?.[`${charId}.overrideTalentBurst`];
  const base: [number, number, number] = [
    authoredTalent?.auto !== undefined
      ? authoredTalent.auto
      : overrideAuto !== undefined && overrideAuto !== ""
        ? Number(overrideAuto)
        : acct.auto,
    authoredTalent?.skill !== undefined
      ? authoredTalent.skill
      : overrideSkill !== undefined && overrideSkill !== ""
        ? Number(overrideSkill)
        : acct.skill,
    authoredTalent?.burst !== undefined
      ? authoredTalent.burst
      : overrideBurst !== undefined && overrideBurst !== ""
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

interface BoundaryParticleBridge {
  particleCount: number;
  favoniusBonus: number;
  particleElement: string | null;
}

function getHitIndexAt(actions: TimelineAction[], index: number): number {
  const counts = new Map<string, { NA: number; CA: number; PA: number }>();
  let hitIndex = 0;
  for (let i = 0; i <= index; i++) {
    const act = actions[i];
    if (!act) continue;
    let base = counts.get(act.char);
    if (!base) {
      base = { NA: 0, CA: 0, PA: 0 };
      counts.set(act.char, base);
    }
    if (act.action === "NA" || act.action === "CA" || act.action === "PA") {
      hitIndex = base[act.action];
      base[act.action] += 1;
    }
  }
  return hitIndex;
}

function getBoundaryParticleBridge(
  timeline: ERTimeline,
  team: TeamSlot[],
  particleMode: ParticleMode
): BoundaryParticleBridge | undefined {
  const index = timeline.actions.length - 1;
  const act = timeline.actions[index];
  if (!act) return undefined;

  let particleCount = 0;
  let particleElement: string | null = null;
  if (act.action === "enemyOrb") {
    particleCount = (act.orbCount ?? 0) * ORB_MULTIPLIER;
    particleElement = act.orbElement ?? "Clear";
  } else if (DIRECT_PARTICLE_ACTIONS.has(act.action)) {
    particleCount = getActionParticles(act.char, act.action, particleMode);
    particleElement = getParticleElement(act.char);
  } else if (PATTERN_ACTIONS.has(act.action)) {
    particleCount = getHitParticles(
      act.char,
      act.action,
      getHitIndexAt(timeline.actions, index),
      particleMode
    );
    if (particleCount > 0) particleElement = getParticleElement(act.char);
  }

  const slot = team.find((s) => s.charId === act.char);
  const weaponEnergy = weaponEnergyById[slot?.weaponId ?? ""]?.energy;
  const favoniusBonus =
    act.favoniusProc && weaponEnergy?.effect === "particles"
      ? weaponEnergy.particleCount
      : 0;
  if (particleCount <= 0 && favoniusBonus <= 0) return undefined;
  return {
    particleCount,
    favoniusBonus,
    particleElement: particleCount > 0 ? particleElement : "Clear",
  };
}

function teamToSlots(
  comp: TeamComp,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null,
  characterStats: ReturnType<typeof characterStatsResource.use>
): TeamSlot[] {
  const { characters, weapons, artifacts } = teamCompToArrays(comp);
  const charIds = characters.filter((id): id is string => id != null);

  return charIds
    .map((charId, i) => {
      const info = charInfo[charId];
      const pData = particles[charId];
      const element = (pData?.element ?? "Anemo") as Element;
      const burstCost = info?.energy ?? 60;
      const specialBurstCost = info?.specialBurstCost;
      const weaponId = weapons[i] ?? undefined;
      const { constellation, talentLevels } = resolveCharCtx(
        charId,
        setupConfig,
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
        specialBurstCost,
        constellation,
        weaponId,
        artifactSet:
          artifacts[i]?.type === "4pc" && artifacts[i]?.setId === "scholar"
            ? null
            : artifacts[i],
        weaponType: characterStats?.[charId]?.weaponType,
        talentLevels,
        healAction,
      };
    })
    .filter((s) => particles[s.charId]);
}

interface ErCalcCardProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
}

export function ErCalcCard({ teamComp, setupConfig }: ErCalcCardProps) {
  const { t } = useLanguage();
  const updateTeamSetupConfig = useTeamStore((s) => s.updateTeamSetupConfig);
  const accountData = useActiveAccountData();
  const characterStats = characterStatsResource.use();
  const { characters, artifacts } = useMemo(
    () => teamCompToArrays(teamComp),
    [teamComp]
  );
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

  const charIds = characters.filter((id): id is string => id != null);
  const erTeam = useMemo(
    () => teamToSlots(teamComp, setupConfig, accountData, characterStats),
    [teamComp, setupConfig, accountData, characterStats]
  );

  // Scholar 4pc bonus is not modeled by the engine (particle-gain trigger
  // isn't wired through distributeParticles yet). Show a banner when any
  // teammate has it equipped so users know the calc ignores it.
  const hasScholarEquipped = useMemo(
    () => artifacts.some((a) => a?.type === "4pc" && a.setId === "scholar"),
    [artifacts]
  );

  // Read timelines from team store, fallback to empty
  const timelines = useMemo<ERTimeline[]>(
    () => resolveEnergyTimelines(setupConfig.energy?.timelines),
    [setupConfig.energy?.timelines]
  );

  const setTimelines = useCallback(
    (timelineUpdate: TimelineListUpdate) => {
      updateTeamSetupConfig(teamComp.id, (config) => ({
        ...config,
        energy: {
          ...(config.energy ?? {}),
          timelines:
            typeof timelineUpdate === "function"
              ? timelineUpdate(resolveEnergyTimelines(config.energy?.timelines))
              : timelineUpdate,
        },
      }));
    },
    [teamComp.id, updateTeamSetupConfig]
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

  const results = useMemo<ERResult[]>(() => {
    if (erTeam.length === 0 || mainERT.actions.length === 0) return [];
    const teamMembers = erTeam.map(toTeamMember);
    const segments: ERCalculationSegment[] = [
      ...startupERTs.map((timeline, index) => ({
        timeline,
        source: {
          kind: "startup" as const,
          timelineNumber: index + 1,
        },
      })),
      {
        timeline: mainERT,
        source: { kind: "loop" as const, iteration: "first" as const },
      },
    ];

    if (repeatLast) {
      segments.push({
        timeline: mainERT,
        source: {
          kind: "loop" as const,
          iteration: "subsequent" as const,
        },
      });
    }

    return calculateTeamERSequence(teamMembers, segments, {
      particleMode,
      startFull: !startEmpty,
      isRepeating: repeatLast,
    });
  }, [erTeam, mainERT, startupERTs, repeatLast, startEmpty, particleMode]);

  const updateTimeline = useCallback(
    (tlIndex: number, updater: (ert: ERTimeline) => ERTimeline) => {
      setTimelines((currentTimelines) =>
        currentTimelines.map((ert, i) => (i === tlIndex ? updater(ert) : ert))
      );
    },
    [setTimelines]
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
        if (isETrigger && hasReactionEnergyTrigger(wielder?.weaponId)) {
          newActions[newActions.length - 1] = {
            ...newActions[newActions.length - 1],
            reactionProc: true,
          };
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
    (
      newActions: TimelineAction[],
      newPeriodic: PeriodicProc[],
      tlIndex: number
    ) => {
      updateTimeline(tlIndex, (ert) => ({
        ...ert,
        actions: newActions,
        periodic: newPeriodic,
      }));
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
      const bindingLoopWindow = r.qWindows?.find(
        (w) => w.isBinding && w.source?.kind === "loop"
      );
      if (bindingLoopWindow?.source?.kind === "loop") {
        indices.add(bindingLoopWindow.source.actionIndex);
      }
    }
    return indices;
  }, [results]);

  const boundaryBridges = useMemo(
    () =>
      timelines.map((timeline, index) =>
        index < timelines.length - 1
          ? getBoundaryParticleBridge(timeline, erTeam, particleMode)
          : undefined
      ),
    [timelines, erTeam, particleMode]
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
        const isReaction = hasReactionEnergyTrigger(slot.weaponId);
        initial.set(
          slot.charId,
          isFav || isReaction ? `${slot.weaponId}|${slot.refinement ?? 0}` : ""
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
      const isReaction = hasReactionEnergyTrigger(slot.weaponId);
      const stateKey =
        isFav || isReaction ? `${slot.weaponId}|${slot.refinement ?? 0}` : "";
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
        if (isReaction) autoPlaceReactionProcs(actions, slot.charId);
        return { ...ert, actions };
      });
      dirty = true;
    }
    if (dirty) setTimelines(next);
  }, [erTeam, timelines, setTimelines]);

  // Manual "re-snap" for cases where the user edited Favonius flags by hand
  // and wants to return to default placement without touching the weapon.
  const canResetFavDefaults = useMemo(
    () => hasFavoniusDefaultsDiff(timelines, erTeam),
    [timelines, erTeam]
  );

  const handleResetFavDefaults = useCallback(() => {
    setTimelines(
      timelines.map((timeline) => ({
        ...timeline,
        actions: applyFavoniusDefaultsToActions(timeline.actions, erTeam),
      }))
    );
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
            <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-x-2 gap-y-2">
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

              <div className="h-6 border-r"></div>

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

              <div className="h-6 border-r"></div>
            </div>

            {hasScholarEquipped && (
              <div className="px-3 py-1.5 text-xs md:text-sm text-amber-400 border-b border-border/30 bg-amber-500/5">
                {t.ui("erCalc.scholarNotImplemented")}
              </div>
            )}

            <div className="px-3 py-2 border-b border-border/30 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddStartup}
                className="text-xs md:text-sm hover:text-primary px-2 py-1 rounded border border-border/30 hover:border-border"
                title={t.ui("erCalc.addStartupTitle")}
              >
                {t.ui("erCalc.addStartup")}
              </button>
              {mainERT.actions.length > 0 && (
                <button
                  type="button"
                  onClick={handleCloneLoopToStartup}
                  className="text-xs md:text-sm text-muted-foreground hover:text-primary px-2 py-1 rounded border border-border/30 hover:border-border"
                  title={t.ui("erCalc.cloneLoopTitle")}
                >
                  {t.ui("erCalc.cloneLoop")}
                </button>
              )}
            </div>

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
                      className="text-sm font-semibold h-7 px-2.5 data-[state=on]:border-primary data-[state=on]:bg-transparent data-[state=on]:text-foreground"
                    >
                      {t.ui("erCalc.loopOnce")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="repeat"
                      className="text-sm font-semibold h-7 px-2.5 data-[state=on]:border-primary data-[state=on]:bg-transparent data-[state=on]:text-foreground"
                    >
                      {t.ui("erCalc.loopRepeat")}
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
              return (
                <TimelineStrip
                  key={tlIdx}
                  label={labelNode}
                  ert={tl}
                  team={erTeam}
                  particleMode={particleMode}
                  bindingQIndices={isLast ? bindingQIndices : undefined}
                  incomingBridge={
                    tlIdx > 0 ? boundaryBridges[tlIdx - 1] : undefined
                  }
                  outgoingBridge={boundaryBridges[tlIdx]}
                  extraControls={removeControl}
                  onAddAction={(charId, action) =>
                    handleAddAction(charId, action, tlIdx)
                  }
                  onRemoveAction={(i) => handleRemoveAction(i, tlIdx)}
                  onUpdateAction={(i, a) => handleUpdateAction(i, a, tlIdx)}
                  onReorderActions={(newActions, newPeriodic) =>
                    handleReorderActions(newActions, newPeriodic, tlIdx)
                  }
                  onUpdatePeriodic={(newP) => handleUpdatePeriodic(newP, tlIdx)}
                  onClear={() => handleClearTimeline(tlIdx)}
                />
              );
            })}

            {/* Results */}
            {results.length > 0 && (
              <ErResultsPanel
                results={results}
                team={erTeam}
                targetTeam={teamComp}
                actionControls={
                  <>
                    <button
                      type="button"
                      onClick={handleOptimizeWaits}
                      className="text-xs md:text-sm font-semibold px-2.5 py-1 rounded-md bg-primary/80 hover:bg-primary/70 text-primary-foreground transition-colors"
                      title={t.ui("erCalc.optimizeWaitsTitle")}
                    >
                      {t.ui("erCalc.optimizeWaits")}
                    </button>
                    {canResetFavDefaults && (
                      <button
                        type="button"
                        onClick={handleResetFavDefaults}
                        className="text-xs md:text-sm hover:text-primary px-2 py-1 rounded border border-border/30 hover:border-border"
                        title={t.ui("erCalc.resetFavDefaultsTitle")}
                      >
                        {t.ui("erCalc.resetFavDefaults")}
                      </button>
                    )}
                  </>
                }
                embedded
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
