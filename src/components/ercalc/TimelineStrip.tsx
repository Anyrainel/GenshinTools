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
  TICK_LABEL,
} from "@/lib/ercalc/constants";
import {
  getActionParticles,
  getAvailableActions,
  getParticleElement,
} from "@/lib/ercalc/erCalculator";
import {
  expectedPeriodicProcs,
  periodicGenerators,
} from "@/lib/ercalc/particleConfig";
import type {
  ActionType,
  ERTimeline,
  TeamSlot,
  TickAssignment,
  TimelineAction,
} from "@/lib/ercalc/types";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

/** Skill actions that produce particles in the UI (excludes periodicE which is in ticks). */
const UI_PARTICLE_ACTIONS = new Set<ActionType>(["E", "holdE"]);

interface TimelineStripProps {
  label: React.ReactNode;
  ert: ERTimeline;
  team: TeamSlot[];
  bindingQIndices?: Set<number>;
  extraControls?: React.ReactNode;
  onAddAction: (charId: string, action: ActionType) => void;
  onRemoveAction: (index: number) => void;
  onReorderActions: (newActions: TimelineAction[]) => void;
  onUpdateTicks: (newTicks: TickAssignment[]) => void;
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
  onReorderActions,
  onUpdateTicks,
  onClear,
}: TimelineStripProps) {
  const { t, language } = useLanguage();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [tickDrag, setTickDrag] = useState<{
    tickIndex: number;
    sourceChar: string;
  } | null>(null);
  const [tickDragOver, setTickDragOver] = useState<number | null>(null);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const teamMap = useMemo(
    () => new Map(team.map((s) => [s.charId, s])),
    [team]
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const { actions, ticks } = ert;

  const ticksByTarget = useMemo(() => {
    const map = new Map<
      number,
      { tick: TickAssignment; tickIndex: number }[]
    >();
    for (let i = 0; i < ticks.length; i++) {
      const tk = ticks[i];
      const arr = map.get(tk.targetIndex);
      if (arr) arr.push({ tick: tk, tickIndex: i });
      else map.set(tk.targetIndex, [{ tick: tk, tickIndex: i }]);
    }
    return map;
  }, [ticks]);

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
      const newTicks = ticks.map((tk) => ({
        ...tk,
        targetIndex: indexMap.get(tk.targetIndex) ?? tk.targetIndex,
      }));
      onReorderActions(newActions);
      onUpdateTicks(newTicks);
      setDragIndex(overIndex);
    },
    [dragIndex, actions, ticks, onReorderActions, onUpdateTicks]
  );

  const handleDragEnd = useCallback(() => setDragIndex(null), []);

  // Tick drag
  const handleTickDragStart = useCallback(
    (e: React.DragEvent, tickIndex: number, sourceChar: string) => {
      setTickDrag({ tickIndex, sourceChar });
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleTickDragOverTarget = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      if (!tickDrag) return;
      e.preventDefault();
      setTickDragOver(targetIndex);
    },
    [tickDrag]
  );

  const handleTickDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (!tickDrag) return;
      const { tickIndex, sourceChar } = tickDrag;
      const alreadyHas = ticks.some(
        (tk, i) =>
          i !== tickIndex &&
          tk.sourceChar === sourceChar &&
          tk.targetIndex === targetIndex
      );
      if (!alreadyHas) {
        onUpdateTicks(
          ticks.map((tk, i) => (i === tickIndex ? { ...tk, targetIndex } : tk))
        );
      }
      setTickDrag(null);
      setTickDragOver(null);
    },
    [tickDrag, ticks, onUpdateTicks]
  );

  const handleTickDragEnd = useCallback(() => {
    setTickDrag(null);
    setTickDragOver(null);
  }, []);

  const handleRemoveTick = useCallback(
    (tickIndex: number) => {
      onUpdateTicks(ticks.filter((_, i) => i !== tickIndex));
    },
    [ticks, onUpdateTicks]
  );

  const getLabel = useCallback(
    (action: string) => {
      const entry = ACTION_LABELS[action];
      return entry ? (language === "zh" ? entry.zh : entry.en) : action;
    },
    [language]
  );

  const tickLabel = language === "zh" ? TICK_LABEL.zh : TICK_LABEL.en;

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
                const isParticle = UI_PARTICLE_ACTIONS.has(act.action);
                const isBindingQ = isBurst && bindingQIndices?.has(i);
                const isDragging = dragIndex === i;

                const particleCount = isParticle
                  ? getActionParticles(act.char, act.action, "expected")
                  : 0;
                const burstCost = isBurst && slot ? slot.burstCost : 0;

                const targetTicks = ticksByTarget.get(i) ?? [];
                const periodicParticles = targetTicks.reduce(
                  (sum, { tick }) =>
                    sum +
                    getActionParticles(
                      tick.sourceChar,
                      "periodicE",
                      "expected"
                    ),
                  0
                );

                const prevAct = i > 0 ? actions[i - 1] : null;
                const prevParticles =
                  prevAct && UI_PARTICLE_ACTIONS.has(prevAct.action)
                    ? getActionParticles(
                        prevAct.char,
                        prevAct.action,
                        "expected"
                      )
                    : 0;

                const isTickDropTarget = tickDragOver === i;

                return (
                  <div key={`col-${i}`} className="flex items-end shrink-0">
                    {i > 0 && <ParticleArrow particleCount={prevParticles} />}
                    <div
                      className={cn(
                        "flex flex-col items-center gap-0.5",
                        isTickDropTarget && "ring-1 ring-emerald-400/40 rounded"
                      )}
                      onDragOver={(e) => handleTickDragOverTarget(e, i)}
                      onDrop={(e) => handleTickDrop(e, i)}
                    >
                      {targetTicks.length > 0 && (
                        <>
                          <div className="flex flex-col items-center gap-0.5">
                            {targetTicks.map(({ tick, tickIndex }) => (
                              <TickChip
                                key={`tick-${tickIndex}`}
                                charId={tick.sourceChar}
                                charName={t.character(tick.sourceChar)}
                                particleCount={getActionParticles(
                                  tick.sourceChar,
                                  "periodicE",
                                  "expected"
                                )}
                                actionLabel={tickLabel}
                                language={language}
                                isDragging={tickDrag?.tickIndex === tickIndex}
                                onDragStart={(e) =>
                                  handleTickDragStart(
                                    e,
                                    tickIndex,
                                    tick.sourceChar
                                  )
                                }
                                onDragEnd={handleTickDragEnd}
                                onRemove={() => handleRemoveTick(tickIndex)}
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
                        isParticle={isParticle}
                        isBindingQ={isBindingQ ?? false}
                        isDragging={isDragging}
                        particleCount={particleCount}
                        burstCost={burstCost}
                        periodicParticles={periodicParticles}
                        charName={t.character(act.char)}
                        actionLabel={getLabel(act.action)}
                        language={language}
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragEnd={handleDragEnd}
                        onRemove={() => onRemoveAction(i)}
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

function ParticleArrow({ particleCount }: { particleCount: number }) {
  if (particleCount <= 0)
    return <div className="h-px w-3 bg-border/20 shrink-0" />;
  return (
    <div className="flex items-center shrink-0 gap-0.5 px-0.5">
      <div className="h-px w-1 bg-emerald-500/50" />
      <span className="text-xs tabular-nums text-emerald-400 font-medium whitespace-nowrap">
        {particleCount % 1 === 0 ? particleCount : particleCount.toFixed(1)}
      </span>
      <ArrowRight className="w-3.5 h-3.5 text-emerald-400/60 shrink-0 -ml-0.5" />
    </div>
  );
}

function MainChip({
  act,
  slot,
  isBurst,
  isParticle,
  isBindingQ,
  isDragging,
  particleCount,
  burstCost,
  periodicParticles,
  charName,
  actionLabel,
  language,
  onDragStart,
  onDragOver,
  onDragEnd,
  onRemove,
}: {
  act: { char: string; action: ActionType };
  slot: TeamSlot | undefined;
  isBurst: boolean;
  isParticle: boolean;
  isBindingQ: boolean;
  isDragging: boolean;
  particleCount: number;
  burstCost: number;
  periodicParticles: number;
  charName: string;
  actionLabel: string;
  language: string;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const particleElement = isParticle ? getParticleElement(act.char) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          className={cn(
            "rounded-md flex items-center gap-1.5 px-2 cursor-grab select-none shrink-0 border",
            CHIP_H,
            isBurst
              ? "border-amber-500/30 bg-amber-500/10"
              : isParticle
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-border/30 bg-black/5",
            isDragging && "opacity-40 scale-95",
            isBindingQ && "ring-1 ring-amber-400/50"
          )}
          style={{ minWidth: "3.5rem" }}
        >
          <CharAvatar charId={act.char} size={18} />
          <span className="text-xs font-medium">{actionLabel}</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-2" side="bottom">
        <div className="flex items-center gap-2">
          <CharAvatar charId={act.char} size={24} />
          <div>
            <div className="text-sm font-semibold">{charName}</div>
            <div className="text-xs text-muted-foreground">{actionLabel}</div>
          </div>
        </div>
        <div className="space-y-1 text-xs border-t border-border/30 pt-2">
          {isParticle && particleCount > 0 && (
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
          {periodicParticles > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {language === "zh" ? "吸收周期微粒" : "Periodic absorbed"}
              </span>
              <span className="text-blue-400 font-medium tabular-nums">
                +
                {periodicParticles % 1 === 0
                  ? periodicParticles
                  : periodicParticles.toFixed(2)}
              </span>
            </div>
          )}
          {isBurst && burstCost > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {language === "zh" ? "能量消耗" : "Energy cost"}
              </span>
              <span className="text-amber-400 font-medium tabular-nums">
                {burstCost}
              </span>
            </div>
          )}
          {!isParticle && !isBurst && (
            <div className="text-muted-foreground">
              {language === "zh"
                ? "此动作不产生微粒"
                : "No particle generation"}
            </div>
          )}
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

function TickChip({
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
  const isPeriodic = periodicGenerators.has(slot.charId);
  const procs = isPeriodic ? expectedPeriodicProcs[slot.charId] : undefined;

  return (
    <div className="flex items-center gap-1">
      <CharAvatar charId={slot.charId} size={18} />
      {actions.map((action) => {
        const isBurst = action === "Q" || action === "specialQ";
        const isSkill = action === "E" || action === "holdE";
        const showProcs = isSkill && procs;

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
