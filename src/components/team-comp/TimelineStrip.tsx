import { CharAvatar } from "@/components/shared/CharAvatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ACTION_LABELS,
  BURST_ACTIONS,
  CHIP_H,
  DIRECT_PARTICLE_ACTIONS,
  FAVONIUS_LABEL,
  PATTERN_ACTIONS,
  PERIODIC_LABEL,
  particles,
} from "@/lib/ercalc/constants";
import {
  type NodeEnergyEvent,
  getActionParticles,
  getAvailableActions,
  getDefaultProcCount,
  getHitParticles,
  getNodeEnergyEvents,
  getParticleElement,
  getPeriodicParticles,
  hasPeriodicGeneration,
} from "@/lib/ercalc/erCalculator";
import type {
  ActionType,
  ERTimeline,
  PeriodicProc,
  TeamSlot,
  TimelineAction,
} from "@/lib/ercalc/types";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, Plus, Trash2, Zap } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

interface TimelineStripProps {
  label: React.ReactNode;
  ert: ERTimeline;
  team: TeamSlot[];
  bindingQIndices?: Set<number>;
  extraControls?: React.ReactNode;
  onAddAction: (charId: string, action: ActionType) => void;
  onRemoveAction: (index: number) => void;
  onUpdateAction: (index: number, action: TimelineAction) => void;
  onReorderActions: (newActions: TimelineAction[]) => void;
  onUpdatePeriodic: (procs: PeriodicProc[]) => void;
  onClear: () => void;
}

export function TimelineStrip({
  label,
  ert,
  team,
  bindingQIndices,
  extraControls,
  onAddAction,
  onRemoveAction,
  onUpdateAction,
  onReorderActions,
  onUpdatePeriodic,
  onClear,
}: TimelineStripProps) {
  const { t, language } = useLanguage();
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
      onReorderActions(newActions);
      onUpdatePeriodic(newPeriodic);
      setDragIndex(overIndex);
    },
    [dragIndex, actions, periodic, onReorderActions, onUpdatePeriodic]
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

  const handleProcDragOverTarget = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      if (!procDrag) return;
      e.preventDefault();
      setProcDragOver(targetIndex);
    },
    [procDrag]
  );

  const handleProcDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (!procDrag) return;
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

  const getLabel = useCallback(
    (action: string) => {
      const entry = ACTION_LABELS[action];
      return entry ? (language === "zh" ? entry.zh : entry.en) : action;
    },
    [language]
  );

  const periodicLabel =
    language === "zh" ? PERIODIC_LABEL.zh : PERIODIC_LABEL.en;

  // Compute the particle count emitted BY the action at index i (for arrow display)
  const actionParticleCount = useCallback(
    (i: number) => {
      const act = actions[i];
      if (!act) return 0;
      if (DIRECT_PARTICLE_ACTIONS.has(act.action)) {
        return getActionParticles(act.char, act.action, "expected");
      }
      if (PATTERN_ACTIONS.has(act.action)) {
        return getHitParticles(act.char, act.action, hitIndexAt[i], "expected");
      }
      return 0;
    },
    [actions, hitIndexAt]
  );

  const addPopover = (
    <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "shrink-0 rounded-md border border-dashed border-border/40 hover:border-border",
            "flex items-center justify-center text-muted-foreground hover:text-foreground",
            CHIP_H,
            actions.length === 0 ? "px-3 gap-1.5 text-xs" : "w-7"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          {actions.length === 0 &&
            (language === "zh" ? "添加动作" : "Add action")}
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
            language={language}
            onAdd={(charId, action) => {
              onAddAction(charId, action);
              requestAnimationFrame(() => {
                if (scrollRef.current)
                  scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
              });
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );

  return (
    <section className="border-t border-border/30">
      <div className="flex items-center justify-between px-2 md:px-5 py-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{label}</div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {actions.length} {t.ui("erCalc.actionsLabel")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {extraControls}
          {actions.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-destructive p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto pb-2" ref={scrollRef}>
        <div className="px-2 md:px-5 min-w-fit">
          {actions.length === 0 ? (
            <div className="py-2">{addPopover}</div>
          ) : (
            <div className="flex items-end gap-0">
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
                      "expected"
                    ),
                  0
                );

                const prevParticles = i > 0 ? actionParticleCount(i - 1) : 0;
                const prevFavonius =
                  i > 0 && actions[i - 1].favoniusProc
                    ? weaponEnergyById[
                        teamMap.get(actions[i - 1].char)?.weaponId ?? ""
                      ]?.energy.effect === "particles"
                      ? 3
                      : 0
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
                  ? getNodeEnergyEvents(
                      act.char,
                      act.action,
                      slot.weaponId,
                      slot.refinement,
                      undefined, // artifactSetId: not plumbed through TeamSlot yet
                      slot.burstCost
                    )
                  : [];

                const isProcDropTarget = procDragOver === i;

                return (
                  <div key={`col-${i}`} className="flex items-end shrink-0">
                    {i > 0 && (
                      <ParticleArrow
                        particleCount={prevParticles}
                        favoniusBonus={prevFavonius}
                        absorberId={act.char}
                        particleElement={prevElement}
                      />
                    )}
                    <div
                      className={cn(
                        "flex flex-col items-center gap-0.5",
                        isProcDropTarget && "ring-1 ring-emerald-400/40 rounded"
                      )}
                      onDragOver={(e) => handleProcDragOverTarget(e, i)}
                      onDrop={(e) => handleProcDrop(e, i)}
                    >
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
                                  "expected"
                                )}
                                actionLabel={periodicLabel}
                                language={language}
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
                        language={language}
                        team={team}
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragEnd={handleDragEnd}
                        onRemove={() => onRemoveAction(i)}
                        onToggleFavonius={(v) =>
                          onUpdateAction(i, { ...act, favoniusProc: v })
                        }
                        onAddProc={(sourceChar, trigger) =>
                          handleAddProc(sourceChar, i, trigger)
                        }
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-end shrink-0">
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
  absorberId,
  particleElement,
}: {
  particleCount: number;
  favoniusBonus?: number;
  absorberId?: string;
  particleElement?: string | null;
}) {
  const total = particleCount + favoniusBonus;
  if (total <= 0) return <div className="h-px w-3 bg-border/20 shrink-0" />;
  const elemHint = particleElement
    ? particleElement === "Clear"
      ? "text-sky-400"
      : "text-emerald-400"
    : "text-emerald-400";
  return (
    <div className="flex items-center shrink-0 gap-0.5 px-0.5">
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
      </span>
      <ArrowRight className="w-3.5 h-3.5 text-emerald-400/60 shrink-0 -ml-0.5" />
      {absorberId && (
        <span className="shrink-0 -ml-0.5">
          <CharAvatar charId={absorberId} size={14} />
        </span>
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
  language,
  team,
  onDragStart,
  onDragOver,
  onDragEnd,
  onRemove,
  onToggleFavonius,
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
  language: string;
  team: TeamSlot[];
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onToggleFavonius: (v: boolean) => void;
  onAddProc: (sourceChar: string, trigger: "E" | "Q") => void;
}) {
  const [open, setOpen] = useState(false);
  const emits = isDirect || isPattern;
  const particleElement = emits ? getParticleElement(act.char) : null;

  const hasFavWeapon =
    !!slot &&
    !!slot.weaponId &&
    weaponEnergyById[slot.weaponId]?.energy.effect === "particles";
  const favEligible =
    hasFavWeapon &&
    (act.action === "E" ||
      act.action === "holdE" ||
      act.action === "specialE" ||
      act.action === "Q" ||
      act.action === "specialQ");

  // Other team members who could attach a periodic proc here (when this char is on-field)
  const periodicSourceCandidates = team.filter(
    (s) =>
      s.charId !== act.char &&
      (hasPeriodicGeneration(s.charId, "E") ||
        hasPeriodicGeneration(s.charId, "Q"))
  );

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
          <span className="text-xs font-medium">{actionLabel}</span>
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
                {language === "zh" ? "生成微粒" : "Particles"}
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
                {language === "zh" ? "吸收周期微粒" : "Periodic absorbed"}
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
                  {language === "zh" ? "消耗能量" : "Drain"}
                </span>
                <span className="text-amber-400 font-medium tabular-nums">
                  -{ev.amount}
                </span>
              </div>
            ))}
          {/* Energy restores (refund / weapon / artifact / party) */}
          {energyEvents
            .filter((ev) => ev.category !== "drain")
            .map((ev, idx) => (
              <div key={`restore-${idx}`} className="flex justify-between">
                <span className="text-muted-foreground">
                  {ev.source}
                  {ev.toParty && !ev.toSelf && (
                    <span className="text-[10px] ml-1">
                      ({language === "zh" ? "队伍" : "party"})
                    </span>
                  )}
                </span>
                <span className="text-blue-400 font-medium tabular-nums">
                  +{ev.amount % 1 === 0 ? ev.amount : ev.amount.toFixed(1)}
                </span>
              </div>
            ))}
          {!emits &&
            !isBurst &&
            periodicAbsorbed === 0 &&
            energyEvents.length === 0 && (
              <div className="text-muted-foreground">
                {language === "zh"
                  ? "此动作不产生微粒"
                  : "No particle generation"}
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
                {language === "zh" ? FAVONIUS_LABEL.zh : FAVONIUS_LABEL.en}
                <span className="text-muted-foreground ml-1">
                  +3 {language === "zh" ? "中性粒子" : "clear"}
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Attach periodic proc from another team member */}
        {periodicSourceCandidates.length > 0 && (
          <div className="border-t border-border/30 pt-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {language === "zh" ? "添加持续产球" : "Attach periodic proc"}
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
          {language === "zh" ? "删除" : "Remove"}
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
  language,
  isDragging,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  charId: string;
  charName: string;
  particleCount: number;
  actionLabel: string;
  language: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
}) {
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
          <span className="text-xs text-muted-foreground font-medium">
            {actionLabel}
          </span>
          <span className="text-xs tabular-nums text-emerald-400/70">
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
              {language === "zh" ? "每次微粒" : "Per proc"}
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
          {language === "zh" ? "删除" : "Remove"}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function QuickAddRow({
  slot,
  language,
  onAdd,
}: {
  slot: TeamSlot;
  language: string;
  onAdd: (charId: string, action: ActionType) => void;
}) {
  const actions = getAvailableActions(slot.charId);
  const eProcs = getDefaultProcCount(slot.charId, "E");
  const qProcs = getDefaultProcCount(slot.charId, "Q");
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
        const showProcs =
          (action === "E" && eProcs > 0) ||
          (action === "holdE" && eProcs > 0) ||
          (action === "specialE" && eProcs > 0) ||
          (action === "Q" && qProcs > 0);
        const procs = action === "Q" ? qProcs : eProcs;
        const isInfusion =
          (action === "NA" && hasPatternNA) ||
          (action === "CA" && hasPatternCA) ||
          (action === "PA" && hasPatternPA);

        return (
          <button
            key={action}
            type="button"
            onClick={() => onAdd(slot.charId, action)}
            className={cn(
              "text-xs px-1.5 py-0.5 rounded border",
              isSkill
                ? "border-emerald-500/30 text-emerald-400/80 hover:bg-emerald-500/10"
                : isBurst
                  ? "border-amber-500/30 text-amber-400/80 hover:bg-amber-500/10"
                  : isInfusion
                    ? "border-emerald-500/20 text-emerald-400/60 hover:bg-emerald-500/5"
                    : "border-border/30 text-muted-foreground hover:bg-accent"
            )}
          >
            {language === "zh"
              ? (ACTION_LABELS[action]?.zh ?? action)
              : (ACTION_LABELS[action]?.en ?? action)}
            {showProcs && (
              <span className="text-muted-foreground ml-0.5 text-[10px]">
                +{procs}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
