import { useLanguage } from "@/contexts/LanguageContext";
import { expectedPeriodicProcs } from "@/data/ercalc/particleConfig";
import type { Element } from "@/data/types";
import {
  type ActionType,
  type Timeline,
  getAbsorberForAction,
  getActionParticles,
  getAvailableActions,
} from "@/lib/ercalc/erCalculator";
import { getElementColor } from "@/lib/utils";
import { Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { CharAvatar } from "./CharAvatar";
import type { TeamSlot } from "./ERCalcView";

const ACTION_LABELS: Record<ActionType, string> = {
  E: "E",
  holdE: "Hold E",
  periodicE: "Tick E",
  Q: "Q",
  specialQ: "Alt Q",
  NA: "NA",
  CA: "CA",
  PA: "Plunge",
  wait: "Wait",
};

const ACTION_LABELS_ZH: Record<ActionType, string> = {
  E: "E",
  holdE: "长按E",
  periodicE: "持续E",
  Q: "Q",
  specialQ: "特殊Q",
  NA: "普攻",
  CA: "重击",
  PA: "下落",
  wait: "等待",
};

const BURST_ACTIONS = new Set<ActionType>(["Q", "specialQ"]);

/** Block width for layout calculations. */
const BLOCK_W = 64;
const BLOCK_GAP = 6;
const BLOCK_H = 48;
const ARC_H = 40;

interface TimelineStripProps {
  label: React.ReactNode;
  timeline: Timeline;
  team: TeamSlot[];
  bindingQIndices?: Set<number>;
  /** Extra controls rendered in the sub-header (e.g., copy/remove buttons, repeat toggle) */
  extraControls?: React.ReactNode;
  onAddAction: (charId: string, action: ActionType) => void;
  onRemoveAction: (index: number) => void;
  onReorder: (newTimeline: Timeline) => void;
  onClear: () => void;
}

export function TimelineStrip({
  label,
  timeline,
  team,
  bindingQIndices,
  extraControls,
  onAddAction,
  onRemoveAction,
  onReorder,
  onClear,
}: TimelineStripProps) {
  const { t, language } = useLanguage();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const teamMap = new Map(team.map((s) => [s.charId, s]));

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, overIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === overIndex) return;
      const newTimeline = [...timeline];
      const [moved] = newTimeline.splice(dragIndex, 1);
      newTimeline.splice(overIndex, 0, moved);
      onReorder(newTimeline);
      setDragIndex(overIndex);
    },
    [dragIndex, timeline, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  // Pre-compute absorber links for SVG arcs.
  // Particles skip periodicE nodes (off-field) and go to the next real action.
  const links: { from: number; to: number }[] = [];
  for (let i = 0; i < timeline.length; i++) {
    if (!getAbsorberForAction(timeline, i)) continue;
    // Find next non-periodicE action (matching engine logic)
    let targetIdx = -1;
    for (let j = 1; j <= timeline.length; j++) {
      const idx = (i + j) % timeline.length;
      if (timeline[idx].action !== "periodicE") {
        targetIdx = idx;
        break;
      }
    }
    if (targetIdx >= 0) {
      links.push({ from: i, to: targetIdx });
    }
  }

  const totalWidth = timeline.length * (BLOCK_W + BLOCK_GAP);

  return (
    <section className="border-t border-border/50">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{label}</div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {timeline.length} {t.ui("erCalc.actionsLabel")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {extraControls}
          {timeline.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline: horizontal scroll, blocks + SVG arcs */}
      <div className="overflow-x-auto">
        <div
          className="relative px-4 pt-3"
          style={{ minWidth: Math.max(totalWidth + 32, 200) }}
        >
          {/* Action blocks row */}
          <div className="flex gap-1.5" style={{ gap: BLOCK_GAP }}>
            {timeline.map((action, i) => {
              const slot = teamMap.get(action.char);
              const element = slot?.element ?? "Anemo";
              const bgColor = getElementColor(element as Element, "bg");
              const isDragging = dragIndex === i;
              const particleCount = getActionParticles(
                action.char,
                action.action,
                "expected"
              );
              const isBurst = BURST_ACTIONS.has(action.action);
              const isBindingQ = isBurst && bindingQIndices?.has(i);

              return (
                <div
                  key={`${action.char}-${action.action}-${i}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`${bgColor} rounded-lg flex flex-col items-center justify-center cursor-grab select-none group relative shrink-0 ${
                    isDragging ? "opacity-40 scale-95" : ""
                  } ${isBindingQ ? "ring-2 ring-foreground/50 ring-offset-1 ring-offset-transparent" : ""}`}
                  style={{ width: BLOCK_W, height: BLOCK_H }}
                >
                  {/* Avatar + action label */}
                  <div className="flex items-center gap-1">
                    <CharAvatar charId={action.char} size={20} />
                    <span className="text-sm font-medium">
                      {language === "zh"
                        ? ACTION_LABELS_ZH[action.action]
                        : ACTION_LABELS[action.action]}
                    </span>
                  </div>

                  {/* Particle or burst cost annotation */}
                  {particleCount > 0 && (
                    <span className="text-xs text-green-300 tabular-nums leading-none mt-0.5">
                      +
                      {particleCount % 1 === 0
                        ? particleCount
                        : particleCount.toFixed(1)}
                    </span>
                  )}
                  {isBurst && slot && (
                    <span className="text-xs text-yellow-300 tabular-nums leading-none mt-0.5">
                      -{slot.burstCost}
                    </span>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAction(i);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {timeline.length === 0 && (
              <span className="text-sm text-muted-foreground py-3">
                {t.ui("erCalc.addActionsBelow")}
              </span>
            )}
          </div>

          {/* SVG particle flow arcs below blocks */}
          {links.length > 0 && (
            <svg
              className="w-full pointer-events-none"
              style={{ height: ARC_H }}
              viewBox={`0 0 ${totalWidth} ${ARC_H}`}
              preserveAspectRatio="none"
            >
              {links.map((link, li) => {
                const step = BLOCK_W + BLOCK_GAP;
                const fromX = link.from * step + BLOCK_W / 2;
                const toX = link.to * step + BLOCK_W / 2;

                if (link.from === link.to) {
                  // Self-absorb: small loop under the block
                  return (
                    <path
                      key={`link-${li}`}
                      d={`M ${fromX - 10} 3 Q ${fromX - 10} 24, ${fromX} 24 Q ${fromX + 10} 24, ${fromX + 10} 3`}
                      fill="none"
                      stroke="hsl(142 70% 55% / 0.6)"
                      strokeWidth={2}
                    />
                  );
                }

                // Backward link (periodicE → earlier action): use dashed line
                const isBackward = link.to < link.from;
                const dist = Math.abs(toX - fromX);
                const midX = (fromX + toX) / 2;
                const arcDepth = Math.min(ARC_H - 4, 10 + dist * 0.03);

                return (
                  <g key={`link-${li}`}>
                    <path
                      d={`M ${fromX} 3 Q ${midX} ${arcDepth}, ${toX} 3`}
                      fill="none"
                      stroke={
                        isBackward
                          ? "hsl(200 70% 60% / 0.5)"
                          : "hsl(142 70% 55% / 0.5)"
                      }
                      strokeWidth={2}
                      strokeDasharray={isBackward ? "5 3" : undefined}
                    />
                    {/* Arrowhead at target */}
                    <polygon
                      points={`${toX - 4},0 ${toX + 4},0 ${toX},6`}
                      fill={
                        isBackward
                          ? "hsl(200 70% 60% / 0.6)"
                          : "hsl(142 70% 55% / 0.6)"
                      }
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Spacer when no links */}
          {links.length === 0 && <div className="h-2" />}
        </div>
      </div>

      {/* Quick-add palette */}
      <div className="px-4 py-2.5 border-t border-border/50">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {team.map((slot) => (
            <ActionAdder key={slot.charId} slot={slot} onAdd={onAddAction} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ActionAdder({
  slot,
  onAdd,
}: {
  slot: TeamSlot;
  onAdd: (charId: string, action: ActionType) => void;
}) {
  const { language } = useLanguage();
  const actions = getAvailableActions(slot.charId);
  const bgColor = getElementColor(slot.element as Element, "bg");

  return (
    <div className="flex items-center gap-1">
      <CharAvatar charId={slot.charId} size={20} />
      {actions.map((action) => {
        const isParticle =
          action === "E" || action === "holdE" || action === "periodicE";
        const isBurst = action === "Q" || action === "specialQ";
        const procs =
          action === "periodicE"
            ? expectedPeriodicProcs[slot.charId]
            : undefined;
        return (
          <button
            key={action}
            type="button"
            onClick={() => {
              if (procs && procs > 1) {
                for (let p = 0; p < procs; p++) {
                  onAdd(slot.charId, action);
                }
              } else {
                onAdd(slot.charId, action);
              }
            }}
            className={`text-xs px-1.5 py-0.5 rounded-md border hover:text-foreground ${
              isParticle
                ? `${bgColor} border-transparent`
                : isBurst
                  ? "border-yellow-500/30 text-yellow-300/70 hover:border-yellow-500/50"
                  : "border-border text-muted-foreground hover:bg-accent"
            }`}
            title={procs ? `${action} (×${procs} procs)` : action}
          >
            {language === "zh"
              ? ACTION_LABELS_ZH[action]
              : ACTION_LABELS[action]}
            {procs && procs > 1 && (
              <span className="text-muted-foreground ml-0.5">×{procs}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
