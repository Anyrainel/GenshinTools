import { ArrowDown, ArrowRight, Plus, Skull, Trash2, Zap } from "lucide-react";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { CharAvatar } from "@/components/shared/CharAvatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { elements } from "@/data/enums";
import {
  BURST_ACTIONS,
  CHIP_H,
  DIRECT_PARTICLE_ACTIONS,
  PATTERN_ACTIONS,
  particles,
} from "@/lib/ercalc/constants";
import {
  getActionParticles,
  getAvailableActions,
  getHitParticles,
  getNodeEnergyEvents,
  getParticleElement,
  getPeriodicParticles,
  hasPeriodicGeneration,
  type NodeEnergyEvent,
  toTeamMember,
} from "@/lib/ercalc/erCalculator";
import type {
  ActionType,
  EnergyParticleElement,
  ERTimeline,
  ParticleMode,
  PeriodicProc,
  TeamSlot,
  TimelineAction,
} from "@/lib/ercalc/types";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import { cn } from "@/lib/utils";

const ORB_ELEMENT_OPTIONS: EnergyParticleElement[] = [...elements, "Clear"];

interface ParticleBridge {
  particleCount: number;
  favoniusBonus: number;
  particleElement: string | null;
}

interface TimelineStripProps {
  label: React.ReactNode;
  ert: ERTimeline;
  team: TeamSlot[];
  particleMode: ParticleMode;
  bindingQIndices?: Set<number>;
  incomingBridge?: ParticleBridge;
  outgoingBridge?: ParticleBridge;
  extraControls?: React.ReactNode;
  onAddAction: (charId: string, action: ActionType) => void;
  onRemoveAction: (index: number) => void;
  onUpdateAction: (index: number, action: TimelineAction) => void;
  onReorderActions: (
    newActions: TimelineAction[],
    newPeriodic: PeriodicProc[]
  ) => void;
  onUpdatePeriodic: (procs: PeriodicProc[]) => void;
  onClear: () => void;
}

export function TimelineStrip({
  label,
  ert,
  team,
  particleMode,
  bindingQIndices,
  incomingBridge,
  outgoingBridge,
  extraControls,
  onAddAction,
  onRemoveAction,
  onUpdateAction,
  onReorderActions,
  onUpdatePeriodic,
  onClear,
}: TimelineStripProps) {
  const { t } = useLanguage();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [procDrag, setProcDrag] = useState<{
    procIndex: number;
    sourceChar: string;
  } | null>(null);
  const [procDragOver, setProcDragOver] = useState<number | null>(null);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const teamMap = useMemo(
    () => new Map(team.map((s) => [s.charId, s])),
    [team]
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const { actions, periodic } = ert;

  // Per-char running hit count for NA/CA/PA pattern at each action index
  const hitIndexAt = useMemo(() => {
    const counts = new Map<string, { NA: number; CA: number; PA: number }>();
    return actions.map((act) => {
      let base = counts.get(act.char);
      if (!base) {
        base = { NA: 0, CA: 0, PA: 0 };
        counts.set(act.char, base);
      }
      if (act.action === "NA" || act.action === "CA" || act.action === "PA") {
        const current = base[act.action];
        base[act.action] = current + 1;
        return current;
      }
      return 0;
    });
  }, [actions]);

  const procsByTarget = useMemo(() => {
    const map = new Map<number, { proc: PeriodicProc; procIndex: number }[]>();
    for (let i = 0; i < periodic.length; i++) {
      const p = periodic[i];
      const arr = map.get(p.targetIndex);
      if (arr) arr.push({ proc: p, procIndex: i });
      else map.set(p.targetIndex, [{ proc: p, procIndex: i }]);
    }
    return map;
  }, [periodic]);

  // Main action drag
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, overIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === overIndex) return;
      const newActions = [...actions];
      const [moved] = newActions.splice(dragIndex, 1);
      newActions.splice(overIndex, 0, moved);
      const origOrder = actions.map((_, i) => i);
      const movedItem = origOrder.splice(dragIndex, 1)[0];
      origOrder.splice(overIndex, 0, movedItem);
      const indexMap = new Map<number, number>();
      for (let i = 0; i < origOrder.length; i++) indexMap.set(origOrder[i], i);
      const newPeriodic = periodic.map((p) => ({
        ...p,
        targetIndex: indexMap.get(p.targetIndex) ?? p.targetIndex,
      }));
      onReorderActions(newActions, newPeriodic);
      setDragIndex(overIndex);
    },
    [dragIndex, actions, periodic, onReorderActions]
  );

  const handleDragEnd = useCallback(() => setDragIndex(null), []);

  // Periodic proc drag
  const handleProcDragStart = useCallback(
    (e: React.DragEvent, procIndex: number, sourceChar: string) => {
      setProcDrag({ procIndex, sourceChar });
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleColDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      if (procDrag) {
        e.preventDefault();
        setProcDragOver(targetIndex);
        return;
      }
      // Delegate to main-action dragover so reordering works anywhere in the
      // column (including over the arrow/gap area).
      if (dragIndex !== null) {
        handleDragOver(e, targetIndex);
      }
    },
    [procDrag, dragIndex, handleDragOver]
  );

  const handleProcDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      if (!procDrag) return;
      e.preventDefault();
      const { procIndex, sourceChar } = procDrag;
      const alreadyHas = periodic.some(
        (p, i) =>
          i !== procIndex &&
          p.sourceChar === sourceChar &&
          p.targetIndex === targetIndex
      );
      if (!alreadyHas) {
        onUpdatePeriodic(
          periodic.map((p, i) => (i === procIndex ? { ...p, targetIndex } : p))
        );
      }
      setProcDrag(null);
      setProcDragOver(null);
    },
    [procDrag, periodic, onUpdatePeriodic]
  );

  const handleProcDragEnd = useCallback(() => {
    setProcDrag(null);
    setProcDragOver(null);
  }, []);

  const handleRemoveProc = useCallback(
    (procIndex: number) => {
      onUpdatePeriodic(periodic.filter((_, i) => i !== procIndex));
    },
    [periodic, onUpdatePeriodic]
  );

  const handleAddProc = useCallback(
    (sourceChar: string, targetIndex: number, trigger: "E" | "Q") => {
      if (
        periodic.some(
          (p) =>
            p.sourceChar === sourceChar &&
            p.targetIndex === targetIndex &&
            p.trigger === trigger
        )
      )
        return;
      onUpdatePeriodic([...periodic, { sourceChar, targetIndex, trigger }]);
    },
    [periodic, onUpdatePeriodic]
  );

  const getLabel = useCallback((action: string) => t.erAction(action), [t]);

  // Compute the particle count emitted BY the action at index i (for arrow display)
  const actionParticleCount = useCallback(
    (i: number) => {
      const act = actions[i];
      if (!act) return 0;
      if (DIRECT_PARTICLE_ACTIONS.has(act.action)) {
        return getActionParticles(act.char, act.action, particleMode);
      }
      if (PATTERN_ACTIONS.has(act.action)) {
        return getHitParticles(
          act.char,
          act.action,
          hitIndexAt[i],
          particleMode
        );
      }
      return 0;
    },
    [actions, hitIndexAt, particleMode]
  );

  const addPopover = (
    <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "shrink-0 rounded-md border border-primary/70 bg-primary/80 hover:bg-primary",
            "flex items-center justify-center text-primary-foreground shadow-sm",
            CHIP_H,
            actions.length === 0 ? "px-3 gap-1.5 text-xs" : "w-7"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          {actions.length === 0 && t.ui("erCalc.addAction")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2 space-y-1.5"
        align="start"
        side="bottom"
      >
        {team.map((slot) => (
          <QuickAddRow
            key={slot.charId}
            slot={slot}
            onAdd={(charId, action) => {
              onAddAction(charId, action);
              requestAnimationFrame(() => {
                if (scrollRef.current)
                  scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
              });
            }}
          />
        ))}
        <div className="border-t border-border/40 pt-1.5 mt-1.5 flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              // Use first team slot as positioning anchor; orbCount edited via chip popover.
              const anchor = team[0]?.charId;
              if (!anchor) return;
              onAddAction(anchor, "enemyOrb");
              setAddPopoverOpen(false);
              requestAnimationFrame(() => {
                if (scrollRef.current)
                  scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
              });
            }}
            className="flex-1 text-xs px-2 py-1 rounded border border-rose-500/40 hover:border-rose-400/70 hover:bg-rose-500/10 text-rose-400"
          >
            {t.ui("erCalc.addEnemyOrb")}
          </button>
          <button
            type="button"
            onClick={() => {
              // Use first team slot as positioning anchor; grants are zeroed
              // by default and edited via the chip popover.
              const anchor = team[0]?.charId;
              if (!anchor) return;
              onAddAction(anchor, "grantEnergy");
              setAddPopoverOpen(false);
              requestAnimationFrame(() => {
                if (scrollRef.current)
                  scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
              });
            }}
            className="flex-1 text-xs px-2 py-1 rounded border border-blue-500/40 hover:border-blue-400/70 hover:bg-blue-500/10 text-blue-400"
          >
            {t.ui("erCalc.addGrant")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <section className="mx-2 my-2 rounded-lg border border-border/50 bg-background/10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/15 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="text-sm md:text-base font-semibold">{label}</div>
        </div>
        <div className="flex items-center gap-1">
          {extraControls}
          {actions.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="hover:text-destructive p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto pb-2" ref={scrollRef}>
        <div className="px-2 md:px-4 min-w-fit">
          {actions.length === 0 ? (
            <div className="py-2">{addPopover}</div>
          ) : (
            <div className="flex items-end gap-0 relative pt-1">
              {/* Main-track rail — horizontal line running through action chips */}
              <div className="pointer-events-none absolute left-0 right-0 bottom-[13px] h-0.5 bg-primary/20 rounded-full" />
              {incomingBridge && (
                <TimelineBridgeArrow bridge={incomingBridge} side="incoming" />
              )}
              {actions.map((act, i) => {
                const slot = teamMap.get(act.char);
                const isBurst = BURST_ACTIONS.has(act.action);
                const isDirect = DIRECT_PARTICLE_ACTIONS.has(act.action);
                const isPattern = PATTERN_ACTIONS.has(act.action);
                const isBindingQ = isBurst && bindingQIndices?.has(i);
                const isDragging = dragIndex === i;

                const particleCount = actionParticleCount(i);

                const targetProcs = procsByTarget.get(i) ?? [];
                const periodicAbsorbed = targetProcs.reduce(
                  (sum, { proc }) =>
                    sum +
                    getPeriodicParticles(
                      proc.sourceChar,
                      proc.trigger,
                      particleMode
                    ),
                  0
                );

                const prevParticles = i > 0 ? actionParticleCount(i - 1) : 0;
                const prevFavonius =
                  i > 0 && actions[i - 1].favoniusProc
                    ? (() => {
                        const weaponEnergy =
                          weaponEnergyById[
                            teamMap.get(actions[i - 1].char)?.weaponId ?? ""
                          ]?.energy;
                        return weaponEnergy?.effect === "particles"
                          ? weaponEnergy.particleCount
                          : 0;
                      })()
                    : 0;
                const prevEmitter = i > 0 ? actions[i - 1] : null;
                const prevElement = prevEmitter
                  ? prevParticles > 0
                    ? getParticleElement(prevEmitter.char)
                    : prevFavonius > 0
                      ? "Clear"
                      : null
                  : null;

                const energyEvents = slot
                  ? getNodeEnergyEvents(act, team.map(toTeamMember))
                  : [];

                const isProcDropTarget = procDragOver === i;

                return (
                  <div
                    key={`col-${i}`}
                    className={cn(
                      "flex items-end shrink-0",
                      isProcDropTarget && "ring-1 ring-emerald-400/40 rounded"
                    )}
                    onDragOver={(e) => handleColDragOver(e, i)}
                    onDrop={(e) => handleProcDrop(e, i)}
                  >
                    {i > 0 && (
                      <ParticleArrow
                        particleCount={prevParticles}
                        favoniusBonus={prevFavonius}
                        particleElement={prevElement}
                      />
                    )}
                    <div className="flex flex-col items-center gap-0.5">
                      {targetProcs.length > 0 && (
                        <>
                          <div className="flex flex-col items-center gap-0.5">
                            {targetProcs.map(({ proc, procIndex }) => (
                              <PeriodicChip
                                key={`proc-${procIndex}`}
                                charId={proc.sourceChar}
                                charName={t.character(proc.sourceChar)}
                                particleCount={getPeriodicParticles(
                                  proc.sourceChar,
                                  proc.trigger,
                                  particleMode
                                )}
                                actionLabel={`${t.erAction(proc.trigger)}${t.ui("erCalc.particlesSuffixTriggered")}`}
                                isDragging={procDrag?.procIndex === procIndex}
                                onDragStart={(e) =>
                                  handleProcDragStart(
                                    e,
                                    procIndex,
                                    proc.sourceChar
                                  )
                                }
                                onDragEnd={handleProcDragEnd}
                                onRemove={() => handleRemoveProc(procIndex)}
                              />
                            ))}
                          </div>
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-400/60" />
                        </>
                      )}

                      {act.action === "grantEnergy" ? (
                        <GrantChip
                          act={act}
                          team={team}
                          isDragging={isDragging}
                          onDragStart={(e) => handleDragStart(e, i)}
                          onDragOver={(e) => handleDragOver(e, i)}
                          onDragEnd={handleDragEnd}
                          onUpdate={(next) => onUpdateAction(i, next)}
                          onRemove={() => onRemoveAction(i)}
                        />
                      ) : act.action === "enemyOrb" ? (
                        <EnemyOrbChip
                          act={act}
                          isDragging={isDragging}
                          onDragStart={(e) => handleDragStart(e, i)}
                          onDragOver={(e) => handleDragOver(e, i)}
                          onDragEnd={handleDragEnd}
                          onUpdate={(next) => onUpdateAction(i, next)}
                          onRemove={() => onRemoveAction(i)}
                        />
                      ) : (
                        <MainChip
                          act={act}
                          slot={slot}
                          isBurst={isBurst}
                          isDirect={isDirect}
                          isPattern={isPattern}
                          isBindingQ={isBindingQ ?? false}
                          isDragging={isDragging}
                          particleCount={particleCount}
                          periodicAbsorbed={periodicAbsorbed}
                          energyEvents={energyEvents}
                          charName={t.character(act.char)}
                          actionLabel={getLabel(act.action)}
                          team={team}
                          onDragStart={(e) => handleDragStart(e, i)}
                          onDragOver={(e) => handleDragOver(e, i)}
                          onDragEnd={handleDragEnd}
                          onRemove={() => onRemoveAction(i)}
                          onToggleFavonius={(v) =>
                            onUpdateAction(i, { ...act, favoniusProc: v })
                          }
                          onToggleReaction={(v) =>
                            onUpdateAction(i, { ...act, reactionProc: v })
                          }
                          onAddProc={(sourceChar, trigger) =>
                            handleAddProc(sourceChar, i, trigger)
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-end shrink-0">
                {outgoingBridge && (
                  <TimelineBridgeArrow
                    bridge={outgoingBridge}
                    side="outgoing"
                  />
                )}
                <div className="h-px w-2 bg-border/20 self-center" />
                {addPopover}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ParticleArrow({
  particleCount,
  favoniusBonus = 0,
  particleElement,
}: {
  particleCount: number;
  favoniusBonus?: number;
  particleElement?: string | null;
}) {
  const { t } = useLanguage();
  const total = particleCount + favoniusBonus;
  const suffix = t.ui("erCalc.particleSuffix");
  if (total <= 0) {
    return <div className={cn(CHIP_H, "w-3 shrink-0")} />;
  }
  const elemHint = particleElement
    ? particleElement === "Clear"
      ? "text-sky-400"
      : "text-emerald-400"
    : "text-emerald-400";
  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 gap-0.5 px-0.5",
        CHIP_H
      )}
    >
      <div className="h-px w-1 bg-emerald-500/50" />
      <span
        className={cn(
          "text-xs tabular-nums font-medium whitespace-nowrap",
          elemHint
        )}
      >
        {particleCount > 0
          ? particleCount % 1 === 0
            ? particleCount
            : particleCount.toFixed(1)
          : 0}
        {favoniusBonus > 0 && (
          <span className="text-sky-400 ml-0.5">+{favoniusBonus}</span>
        )}
        <span className="ml-0.5 opacity-70">{suffix}</span>
      </span>
      <ArrowRight className="w-3.5 h-3.5 text-emerald-400/60 shrink-0" />
    </div>
  );
}

function TimelineBridgeArrow({
  bridge,
  side,
}: {
  bridge: ParticleBridge;
  side: "incoming" | "outgoing";
}) {
  return (
    <div
      className={cn(
        "flex items-center shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10",
        side === "incoming" ? "mr-1" : "mx-1"
      )}
    >
      {side === "incoming" && (
        <ArrowRight className="w-3.5 h-3.5 text-emerald-400/60 shrink-0 ml-1" />
      )}
      <ParticleArrow
        particleCount={bridge.particleCount}
        favoniusBonus={bridge.favoniusBonus}
        particleElement={bridge.particleElement}
      />
      {side === "outgoing" && (
        <ArrowRight className="w-3.5 h-3.5 text-emerald-400/60 shrink-0 mr-1" />
      )}
    </div>
  );
}

function MainChip({
  act,
  slot,
  isBurst,
  isDirect,
  isPattern,
  isBindingQ,
  isDragging,
  particleCount,
  periodicAbsorbed,
  energyEvents,
  charName,
  actionLabel,
  team,
  onDragStart,
  onDragOver,
  onDragEnd,
  onRemove,
  onToggleFavonius,
  onToggleReaction,
  onAddProc,
}: {
  act: TimelineAction;
  slot: TeamSlot | undefined;
  isBurst: boolean;
  isDirect: boolean;
  isPattern: boolean;
  isBindingQ: boolean;
  isDragging: boolean;
  particleCount: number;
  periodicAbsorbed: number;
  energyEvents: NodeEnergyEvent[];
  charName: string;
  actionLabel: string;
  team: TeamSlot[];
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onToggleFavonius: (v: boolean) => void;
  onToggleReaction: (v: boolean) => void;
  onAddProc: (sourceChar: string, trigger: "E" | "Q") => void;
}) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const emits = isDirect || isPattern;
  const particleElement = emits ? getParticleElement(act.char) : null;

  const hasFavWeapon =
    !!slot &&
    !!slot.weaponId &&
    weaponEnergyById[slot.weaponId]?.energy.effect === "particles";
  const isSkillOrBurst =
    act.action === "E" ||
    act.action === "holdE" ||
    act.action === "specialE" ||
    act.action === "Q" ||
    act.action === "specialQ";
  const favEligible = hasFavWeapon && isSkillOrBurst;

  // Reaction trigger weapon equipped? Shows a "this E/Q reacts" toggle so
  // reaction-triggered weapons (Bloodsoaked Ruins, Lumidouce Elegy, etc.)
  // fire at user-designated skill nodes instead of lumping at Q.
  const wEnergy = slot?.weaponId
    ? weaponEnergyById[slot.weaponId]?.energy
    : undefined;
  const reactionEligible =
    isSkillOrBurst &&
    wEnergy?.effect === "flatEnergy" &&
    wEnergy.trigger === "reaction";
  const reactionAmount =
    reactionEligible && wEnergy?.effect === "flatEnergy"
      ? wEnergy.totalEnergy[slot?.refinement ?? 0]
      : 0;
  const reactionConditionLabel =
    reactionEligible && wEnergy?.effect === "flatEnergy"
      ? ((language === "zh"
          ? wEnergy.reactionCondition?.zh
          : wEnergy.reactionCondition?.en) ?? null)
      : null;

  // Other team members who could attach a periodic proc here (when this char is on-field)
  const periodicSourceCandidates = team.filter(
    (s) =>
      s.charId !== act.char &&
      (hasPeriodicGeneration(s.charId, "E") ||
        hasPeriodicGeneration(s.charId, "Q"))
  );

  // Total self-refund (flat energy whose recipient list includes the acting
  // char). Shown as chip badge so users see a numeric hint without opening
  // the popover.
  const selfRefundAmount = energyEvents
    .filter((ev) => ev.category !== "drain" && ev.recipients.includes(act.char))
    .reduce((sum, ev) => sum + ev.amount, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          className={cn(
            "rounded-md flex items-center gap-1.5 px-2 cursor-grab select-none shrink-0 border relative",
            CHIP_H,
            isBurst
              ? "border-amber-500/30 bg-amber-500/10"
              : emits
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-border/30 bg-black/5",
            isDragging && "opacity-40 scale-95",
            isBindingQ && "ring-1 ring-amber-400/50"
          )}
          style={{ minWidth: "3.5rem" }}
        >
          <CharAvatar charId={act.char} size={18} />
          <span className="text-xs md:text-sm font-medium">{actionLabel}</span>
          {selfRefundAmount > 0 && (
            <span
              className="text-[10px] md:text-xs font-semibold text-blue-400 tabular-nums leading-none"
              title={t.ui("erCalc.selfEnergy")}
            >
              +
              {selfRefundAmount % 1 === 0
                ? selfRefundAmount
                : selfRefundAmount.toFixed(1)}
            </span>
          )}
          {act.favoniusProc && (
            <Zap className="w-3 h-3 text-sky-400 absolute -top-1 -right-1" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" side="bottom">
        <div className="flex items-center gap-2">
          <CharAvatar charId={act.char} size={24} />
          <div>
            <div className="text-sm font-semibold">{charName}</div>
            <div className="text-xs text-muted-foreground">{actionLabel}</div>
          </div>
        </div>
        <div className="space-y-1 text-xs border-t border-border/30 pt-2">
          {emits && particleCount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t.ui("erCalc.particlesLabel")}
              </span>
              <span className="text-emerald-400 font-medium tabular-nums">
                {particleCount % 1 === 0
                  ? particleCount
                  : particleCount.toFixed(2)}{" "}
                {particleElement}
              </span>
            </div>
          )}
          {periodicAbsorbed > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t.ui("erCalc.periodicAbsorbed")}
              </span>
              <span className="text-blue-400 font-medium tabular-nums">
                +
                {periodicAbsorbed % 1 === 0
                  ? periodicAbsorbed
                  : periodicAbsorbed.toFixed(2)}
              </span>
            </div>
          )}
          {/* Energy drain (burst) */}
          {energyEvents
            .filter((ev) => ev.category === "drain")
            .map((ev, idx) => (
              <div key={`drain-${idx}`} className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.ui("erCalc.drainLabel")}
                </span>
                <span className="text-amber-400 font-medium tabular-nums">
                  -{ev.amount}
                </span>
              </div>
            ))}
          {/* Energy restores — one row per logical effect, showing recipients. */}
          {energyEvents
            .filter((ev) => ev.category !== "drain")
            .map((ev, idx) => {
              const toAll =
                ev.recipients.length === team.length && team.length > 0;
              const toSelfOnly =
                ev.recipients.length === 1 && ev.recipients[0] === act.char;
              const recipientLabel = toAll
                ? t.ui("erCalc.allTarget")
                : toSelfOnly
                  ? null
                  : ev.recipients
                      .map((id) => t.character(id).split(/[\s_]/)[0])
                      .join(", ");
              const condition =
                language === "zh" ? ev.conditionZh : ev.conditionEn;
              return (
                <div key={`restore-${idx}`} className="space-y-0.5">
                  <div className="flex justify-between items-center gap-2">
                    <span className="truncate">
                      {ev.sourceLabel}
                      {ev.procs && ev.procs > 1 && (
                        <span className="text-[10px] ml-0.5 text-foreground/70">
                          ×{ev.procs}
                        </span>
                      )}
                      {recipientLabel && (
                        <span className="text-[10px] ml-1 text-foreground/60">
                          → {recipientLabel}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-medium tabular-nums shrink-0",
                        ev.isErScaling ? "text-purple-400" : "text-blue-400"
                      )}
                    >
                      +{ev.amount % 1 === 0 ? ev.amount : ev.amount.toFixed(1)}
                      {ev.isErScaling && (
                        <span className="text-[10px] ml-0.5">/100%ER</span>
                      )}
                      {ev.procs && ev.procs > 1 && (
                        <span className="text-[10px] ml-0.5 text-foreground/60">
                          {t.ui("erCalc.perProcSuffix")}
                        </span>
                      )}
                    </span>
                  </div>
                  {condition && (
                    <div className="text-[10px] text-foreground/60 pl-1">
                      {condition}
                    </div>
                  )}
                </div>
              );
            })}
          {!emits &&
            !isBurst &&
            periodicAbsorbed === 0 &&
            energyEvents.length === 0 && (
              <div className="text-muted-foreground">
                {t.ui("erCalc.noParticleGen")}
              </div>
            )}
        </div>

        {/* Favonius toggle */}
        {favEligible && (
          <div className="border-t border-border/30 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={!!act.favoniusProc}
                onChange={(e) => onToggleFavonius(e.target.checked)}
                className="rounded border-border"
              />
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {t.erAction("favonius")}
                <span className="text-muted-foreground ml-1">
                  +3 {t.ui("erCalc.clearParticle")}
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Reaction trigger toggle (Bloodsoaked Ruins, Lumidouce Elegy, etc.) */}
        {reactionEligible && (
          <div className="border-t border-border/30 pt-2">
            <label className="flex items-start gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={!!act.reactionProc}
                onChange={(e) => onToggleReaction(e.target.checked)}
                className="rounded border-border mt-0.5"
              />
              <Zap className="w-3.5 h-3.5 text-fuchsia-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span>{t.ui("erCalc.reactionTrigger")}</span>
                  {reactionAmount > 0 && (
                    <span className="font-medium tabular-nums text-blue-400 shrink-0">
                      +
                      {reactionAmount % 1 === 0
                        ? reactionAmount
                        : reactionAmount.toFixed(1)}
                    </span>
                  )}
                </div>
                {reactionConditionLabel && (
                  <div className="text-[10px] text-foreground/60 mt-0.5">
                    {t.ui("erCalc.reactionIf")} {reactionConditionLabel}
                  </div>
                )}
              </div>
            </label>
          </div>
        )}

        {/* Attach periodic proc from another team member */}
        {periodicSourceCandidates.length > 0 && (
          <div className="border-t border-border/30 pt-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t.ui("erCalc.attachPeriodic")}
            </div>
            <div className="flex flex-wrap gap-1">
              {periodicSourceCandidates.map((s) => {
                const triggers: Array<"E" | "Q"> = [];
                if (hasPeriodicGeneration(s.charId, "E")) triggers.push("E");
                if (hasPeriodicGeneration(s.charId, "Q")) triggers.push("Q");
                return triggers.map((trigger) => (
                  <button
                    key={`${s.charId}-${trigger}`}
                    type="button"
                    onClick={() => onAddProc(s.charId, trigger)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/30 hover:bg-accent"
                  >
                    <CharAvatar charId={s.charId} size={14} />
                    <span className="text-xs">{trigger}</span>
                  </button>
                ));
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onRemove();
            setOpen(false);
          }}
          className="w-full text-xs text-destructive hover:text-destructive/80 flex items-center gap-1.5 pt-1 border-t border-border/30"
        >
          <Trash2 className="w-3 h-3" />
          {t.ui("erCalc.remove")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function PeriodicChip({
  charId,
  charName,
  particleCount,
  actionLabel,
  isDragging,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  charId: string;
  charName: string;
  particleCount: number;
  actionLabel: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const particleElement = getParticleElement(charId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className={cn(
            "rounded-md flex items-center gap-1 px-1.5 cursor-grab select-none shrink-0",
            "border border-dashed border-emerald-500/30 bg-emerald-500/5",
            CHIP_H,
            isDragging && "opacity-40 scale-95"
          )}
        >
          <CharAvatar charId={charId} size={16} />
          <span className="text-xs md:text-sm font-medium">{actionLabel}</span>
          <span className="text-xs md:text-sm tabular-nums text-emerald-400">
            {particleCount % 1 === 0 ? particleCount : particleCount.toFixed(1)}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 space-y-2" side="top">
        <div className="flex items-center gap-2">
          <CharAvatar charId={charId} size={20} />
          <div>
            <div className="text-sm font-semibold">{charName}</div>
            <div className="text-xs text-muted-foreground">{actionLabel}</div>
          </div>
        </div>
        <div className="text-xs space-y-1 border-t border-border/30 pt-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t.ui("erCalc.perProcLabel")}
            </span>
            <span className="text-emerald-400 tabular-nums font-medium">
              {particleCount % 1 === 0
                ? particleCount
                : particleCount.toFixed(2)}{" "}
              {particleElement}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onRemove();
            setOpen(false);
          }}
          className="w-full text-xs text-destructive hover:text-destructive/80 flex items-center gap-1.5 pt-1 border-t border-border/30"
        >
          <Trash2 className="w-3 h-3" />
          {t.ui("erCalc.remove")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function GrantChip({
  act,
  team,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onUpdate,
  onRemove,
}: {
  act: TimelineAction;
  team: TeamSlot[];
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onUpdate: (next: TimelineAction) => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const grants = act.energyGrants ?? {};
  // Display total: sum flat + percent (resolved against burst cost). Quick
  // "is anything set" hint on the chip surface.
  const total = team.reduce((sum, slot) => {
    const g = grants[slot.charId];
    if (!g) return sum;
    const f = g.flat ?? 0;
    const p = ((g.percent ?? 0) / 100) * (slot.burstCost ?? 0);
    return sum + f + p;
  }, 0);

  const setGrantField = (
    charId: string,
    field: "flat" | "percent",
    amount: number
  ) => {
    const next = { ...(act.energyGrants ?? {}) };
    const prev = next[charId] ?? {};
    const updated = { ...prev };
    if (!amount || Number.isNaN(amount)) delete updated[field];
    else updated[field] = amount;
    if ((updated.flat ?? 0) === 0 && (updated.percent ?? 0) === 0) {
      delete next[charId];
    } else {
      next[charId] = updated;
    }
    onUpdate({ ...act, energyGrants: next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          className={cn(
            "rounded-md flex items-center gap-1 px-2 cursor-grab select-none shrink-0 border",
            "border-blue-500/40 bg-blue-500/10 text-blue-300",
            CHIP_H,
            isDragging && "opacity-40 scale-95"
          )}
          style={{ minWidth: "3.5rem" }}
          title={t.ui("erCalc.grantEventTitle")}
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="text-xs md:text-sm font-semibold">
            {t.ui("erCalc.grantLabel")}
          </span>
          {total > 0 && (
            <span className="text-[10px] md:text-xs font-semibold tabular-nums text-blue-200">
              +{total}
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" side="bottom">
        <div className="text-sm font-semibold">
          {t.ui("erCalc.grantEventTitle")}
        </div>
        <div className="text-xs text-foreground/80">
          {t.ui("erCalc.grantDesc")}
        </div>
        <div className="space-y-1.5 border-t border-border/40 pt-2">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-1.5 gap-y-0.5 items-center text-[10px] md:text-xs text-foreground/60">
            <span />
            <span className="text-center w-14">{t.ui("erCalc.grantFlat")}</span>
            <span className="text-center w-12">
              {t.ui("erCalc.grantPercent")}
            </span>
            {team.map((slot) => {
              const g = grants[slot.charId] ?? {};
              return (
                <Fragment key={slot.charId}>
                  <div className="flex items-center gap-1.5 min-w-0 text-xs md:text-sm">
                    <CharAvatar charId={slot.charId} size={20} />
                    <span className="truncate">{t.character(slot.charId)}</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={g.flat ?? ""}
                    onChange={(e) =>
                      setGrantField(
                        slot.charId,
                        "flat",
                        Number.parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-14 rounded border border-border/40 bg-background/60 px-1 py-0.5 text-right tabular-nums text-xs"
                    placeholder="0"
                    title={t.ui("erCalc.grantFlatTitle")}
                  />
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={g.percent ?? ""}
                    onChange={(e) =>
                      setGrantField(
                        slot.charId,
                        "percent",
                        Number.parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-12 rounded border border-border/40 bg-background/60 px-1 py-0.5 text-right tabular-nums text-xs"
                    placeholder="%"
                    title={t.ui("erCalc.grantPercentTitle")}
                  />
                </Fragment>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onRemove();
            setOpen(false);
          }}
          className="w-full text-xs text-destructive hover:text-destructive/80 flex items-center justify-center gap-1.5 pt-1 border-t border-border/30"
        >
          <Trash2 className="w-3 h-3" />
          {t.ui("erCalc.remove")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function EnemyOrbChip({
  act,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onUpdate,
  onRemove,
}: {
  act: TimelineAction;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onUpdate: (next: TimelineAction) => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const orbCount = act.orbCount ?? 0;
  const orbElement = act.orbElement ?? "Clear";

  const getOrbElementLabel = (element: EnergyParticleElement) => {
    if (element === "Clear") return t.ui("erCalc.enemyOrbClear");
    return t.element(element);
  };

  const setCount = (n: number) => {
    if (!Number.isFinite(n) || n < 0) n = 0;
    onUpdate({ ...act, orbCount: n });
  };

  const setElement = (element: EnergyParticleElement) => {
    onUpdate({ ...act, orbElement: element });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          className={cn(
            "rounded-md flex items-center gap-1 px-2 cursor-grab select-none shrink-0 border",
            "border-rose-500/40 bg-rose-500/10 text-rose-300",
            CHIP_H,
            isDragging && "opacity-40 scale-95"
          )}
          style={{ minWidth: "3.5rem" }}
          title={t.ui("erCalc.enemyOrbTitle")}
        >
          <Skull className="w-3.5 h-3.5" />
          <span className="text-xs md:text-sm font-semibold">
            {t.erAction("enemyOrb")}
          </span>
          {orbCount > 0 && (
            <span className="text-xs font-semibold tabular-nums text-rose-200">
              ×{orbCount}
            </span>
          )}
          <span className="text-xs font-medium text-rose-200">
            {getOrbElementLabel(orbElement)}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" side="bottom">
        <div className="text-sm font-semibold">
          {t.ui("erCalc.enemyOrbTitle")}
        </div>
        <div className="text-xs text-foreground/80">
          {t.ui("erCalc.enemyOrbDesc")}
        </div>
        <div className="flex items-center gap-2 border-t border-border/40 pt-2 text-xs md:text-sm">
          <span className="flex-1">{t.ui("erCalc.enemyOrbCount")}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={orbCount || ""}
            onChange={(e) => setCount(Number.parseFloat(e.target.value) || 0)}
            className="w-16 rounded border border-border/40 bg-background/60 px-1.5 py-0.5 text-right tabular-nums"
            placeholder="0"
          />
        </div>
        <div className="flex items-center gap-2 border-t border-border/40 pt-2 text-xs md:text-sm">
          <span className="flex-1">{t.ui("erCalc.enemyOrbElement")}</span>
          <Select
            value={orbElement}
            onValueChange={(value) =>
              setElement(value as EnergyParticleElement)
            }
          >
            <SelectTrigger className="h-8 w-28 bg-background/50 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORB_ELEMENT_OPTIONS.map((element) => (
                <SelectItem key={element} value={element}>
                  {getOrbElementLabel(element)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => {
            onRemove();
            setOpen(false);
          }}
          className="w-full text-xs text-destructive hover:text-destructive/80 flex items-center justify-center gap-1.5 pt-1 border-t border-border/30"
        >
          <Trash2 className="w-3 h-3" />
          {t.ui("erCalc.remove")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function QuickAddRow({
  slot,
  onAdd,
}: {
  slot: TeamSlot;
  onAdd: (charId: string, action: ActionType) => void;
}) {
  const { t } = useLanguage();
  const actions = getAvailableActions(slot.charId);
  const hasPatternNA = !!particles[slot.charId]?.NA;
  const hasPatternCA = !!particles[slot.charId]?.CA;
  const hasPatternPA = !!particles[slot.charId]?.PA;

  return (
    <div className="flex items-center gap-1">
      <CharAvatar charId={slot.charId} size={18} />
      {actions.map((action) => {
        const isBurst = action === "Q" || action === "specialQ";
        const isSkill =
          action === "E" || action === "holdE" || action === "specialE";
        const isInfusion =
          (action === "NA" && hasPatternNA) ||
          (action === "CA" && hasPatternCA) ||
          (action === "PA" && hasPatternPA);
        const isWait = action === "wait";

        return (
          <button
            key={action}
            type="button"
            onClick={() => onAdd(slot.charId, action)}
            className={cn(
              "text-xs px-1.5 py-0.5 rounded border border-border",
              isSkill
                ? "border-emerald-500/40 text-emerald-400/80 hover:bg-emerald-500/10"
                : isBurst
                  ? "border-amber-500/40 text-amber-400/80 hover:bg-amber-500/10"
                  : isInfusion
                    ? "border-border text-emerald-400/70 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                    : isWait
                      ? "border-fuchsia-500/40 text-fuchsia-400/80 hover:bg-fuchsia-500/10"
                      : "border-border hover:bg-accent"
            )}
          >
            {t.erAction(action)}
          </button>
        );
      })}
    </div>
  );
}
