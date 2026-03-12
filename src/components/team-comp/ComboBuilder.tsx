import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import { evaluateCombo } from "@/lib/team-comp/damageCalc";
import type { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  ComboFormula,
  ComboLine,
  ReactionOverride,
} from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { Minus, Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { ReactionSelector } from "./ReactionSelector";
import { fmtDamage } from "./displayFormatters";

// ─── Props ───

interface ComboBuilderProps {
  team: Team;
  teamBuild: TeamBuild;
  artifactSheets: Record<string, StatSheet>;
  calcContext: CalcContext;
  onTeamUpdate: (patch: Partial<Team>) => void;
  /** Called when user clicks a line to inspect it */
  onSelectFormula: (
    charId: string,
    formulaId: string,
    reaction?: ReactionOverride
  ) => void;
  /** The currently selected formula key for highlighting */
  selectedFormulaKey?: string;
}

// ─── Helpers ───

function makeDefaultCombo(): ComboFormula {
  return {
    id: `combo-${Date.now()}`,
    label: { en: "Rotation", zh: "循环" },
    lines: [],
  };
}

/** Ensure team.combos[0] exists and return it. */
function ensureCombo(team: Team): {
  combo: ComboFormula;
  patch: Partial<Team> | null;
} {
  if (team.combos.length > 0) {
    return { combo: team.combos[0], patch: null };
  }
  const newCombo = makeDefaultCombo();
  return {
    combo: newCombo,
    patch: { combos: [newCombo], selectedCombo: newCombo.id },
  };
}

// ─── Component ───

export function ComboBuilder({
  team,
  teamBuild,
  artifactSheets,
  calcContext,
  onTeamUpdate,
  onSelectFormula,
  selectedFormulaKey,
}: ComboBuilderProps) {
  const { t } = useLanguage();

  // ── Get or create combo ──

  const { combo, needsInit } = useMemo(() => {
    const { combo: c, patch } = ensureCombo(team);
    return { combo: c, needsInit: patch };
  }, [team]);

  // Auto-create combo on first render if needed
  if (needsInit) {
    // Schedule for next tick to avoid updating during render
    queueMicrotask(() => onTeamUpdate(needsInit));
  }

  // ── All formulas grouped by character ──

  const allFormulaIds = useMemo(() => teamBuild.getFormulaIds(), [teamBuild]);

  const teamCharIds = useMemo(
    () => team.characters.filter((id): id is string => id != null),
    [team.characters]
  );

  // ── Build a lookup from combo lines ──

  const lineMap = useMemo(() => {
    const map = new Map<string, { lineIndex: number; line: ComboLine }>();
    for (let i = 0; i < combo.lines.length; i++) {
      const line = combo.lines[i];
      map.set(`${line.charId}.${line.formulaId}`, { lineIndex: i, line });
    }
    return map;
  }, [combo.lines]);

  // ── Evaluate combo damage ──

  const comboResult = useMemo(() => {
    const activeLines = combo.lines.filter((l) => l.count > 0);
    if (activeLines.length === 0) return null;
    const filteredCombo: ComboFormula = { ...combo, lines: activeLines };
    try {
      return evaluateCombo(
        teamBuild,
        filteredCombo,
        artifactSheets,
        calcContext,
        team.reactionOverrides
      );
    } catch (e) {
      console.warn("[ComboBuilder] evaluateCombo failed:", e);
      return null;
    }
  }, [combo, teamBuild, artifactSheets, calcContext, team.reactionOverrides]);

  // ── Per-line damage map (only for active lines with count > 0) ──

  const lineDamageMap = useMemo(() => {
    if (!comboResult)
      return new Map<string, { perHit: number; total: number }>();
    const map = new Map<string, { perHit: number; total: number }>();
    const activeLines = combo.lines.filter((l) => l.count > 0);
    for (let i = 0; i < activeLines.length; i++) {
      const key = `${activeLines[i].charId}.${activeLines[i].formulaId}`;
      map.set(key, comboResult.lineDamages[i]);
    }
    return map;
  }, [comboResult, combo.lines]);

  // ── Mutation helpers ──

  const updateCombo = useCallback(
    (updater: (combo: ComboFormula) => ComboFormula) => {
      const updated = updater({ ...combo });
      onTeamUpdate({
        combos: team.combos.map((c) => (c.id === combo.id ? updated : c)),
      });
    },
    [combo, team.combos, onTeamUpdate]
  );

  const setLineCount = useCallback(
    (charId: string, formulaId: string, count: number) => {
      const key = `${charId}.${formulaId}`;
      const existing = lineMap.get(key);

      if (existing) {
        // Update existing line count
        updateCombo((c) => ({
          ...c,
          lines: c.lines.map((l, i) =>
            i === existing.lineIndex ? { ...l, count } : l
          ),
        }));
      } else if (count > 0) {
        // Add new line
        updateCombo((c) => ({
          ...c,
          lines: [...c.lines, { charId, formulaId, count }],
        }));
      }
    },
    [lineMap, updateCombo]
  );

  const setLineReaction = useCallback(
    (charId: string, formulaId: string, reaction: ReactionOverride) => {
      const key = `${charId}.${formulaId}`;
      const existing = lineMap.get(key);

      if (existing) {
        updateCombo((c) => ({
          ...c,
          lines: c.lines.map((l, i) =>
            i === existing.lineIndex ? { ...l, reaction } : l
          ),
        }));
      } else {
        // Create the line with count 1 and the reaction
        updateCombo((c) => ({
          ...c,
          lines: [...c.lines, { charId, formulaId, count: 1, reaction }],
        }));
      }
    },
    [lineMap, updateCombo]
  );

  // ─── Render ───

  return (
    <div className="flex flex-col gap-3">
      {/* Formula table grouped by character */}
      {teamCharIds.map((charId) => {
        const charFormulas = allFormulaIds[charId];
        if (!charFormulas || Object.keys(charFormulas).length === 0)
          return null;

        const charRes = charactersById[charId];
        const charElement = teamBuild.teamMeta.elements[charId];

        return (
          <div key={charId} className="flex flex-col gap-0.5">
            {/* Character header */}
            <div className="flex items-center gap-2 px-1 py-1">
              {charRes && (
                <img
                  src={getAssetUrl(charRes.imagePath)}
                  alt={charId}
                  className="w-5 h-5 object-contain rounded-full bg-secondary/40 shrink-0"
                />
              )}
              <span className="text-xs font-semibold text-foreground/80 truncate">
                {t.character(charId)}
              </span>
            </div>

            {/* Formula rows */}
            {Object.entries(charFormulas).map(([formulaId, label]) => {
              const key = `${charId}.${formulaId}`;
              const existing = lineMap.get(key);
              const count = existing?.line.count ?? 0;
              const isActive = count > 0;
              const isSelected = key === selectedFormulaKey;
              const damage = lineDamageMap.get(key);

              const formulaEntry =
                teamBuild.charBuilds[charId]?.charBase.getFormulaEntry(
                  formulaId
                );

              return (
                <div
                  key={formulaId}
                  onClick={() =>
                    onSelectFormula(charId, formulaId, existing?.line.reaction)
                  }
                  className={cn(
                    "flex flex-wrap items-center gap-1.5 px-2 py-1 min-h-9 rounded-md cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-black/5 border border-transparent hover:bg-black/10",
                    isSelected && "ring-1 ring-primary/50",
                    !isActive && "opacity-60"
                  )}
                >
                  {/* Count stepper */}
                  <div
                    className="flex items-center gap-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={count <= 0}
                      onClick={() =>
                        setLineCount(charId, formulaId, Math.max(0, count - 1))
                      }
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span
                      className={cn(
                        "text-xs font-mono tabular-nums w-5 text-center font-semibold",
                        count === 0 && "text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={count >= 99}
                      onClick={() =>
                        setLineCount(charId, formulaId, Math.min(99, count + 1))
                      }
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Formula label */}
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      isActive ? "text-foreground" : "text-foreground/60"
                    )}
                  >
                    {t.resolveLabel(label)}
                  </span>

                  {/* Inline reaction selector */}
                  {formulaEntry && charElement && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <ReactionSelector
                        formulaEntry={formulaEntry}
                        element={charElement}
                        reactionOverride={
                          existing?.line.reaction ?? { reaction: "none" }
                        }
                        onReactionChange={(override: ReactionOverride) =>
                          setLineReaction(charId, formulaId, override)
                        }
                        teamMeta={teamBuild.teamMeta}
                        charId={charId}
                        compact
                      />
                    </div>
                  )}

                  {/* Damage subtotal */}
                  {isActive && damage != null && (
                    <span className="ml-auto text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap shrink-0">
                      {count > 1 && (
                        <>
                          <span className="text-foreground/60">{count}</span>
                          <span className="text-muted-foreground mx-0.5">
                            {"\u00D7"}
                          </span>
                          <span className="text-foreground/60">
                            {fmtDamage(damage.perHit)}
                          </span>
                          <span className="text-muted-foreground mx-0.5">
                            =
                          </span>
                        </>
                      )}
                      <span className="text-foreground font-semibold">
                        {fmtDamage(damage.total)}
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── Total rotation damage ── */}
      {comboResult && comboResult.totalDamage > 0 && (
        <div
          className={cn(
            "flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl",
            "bg-primary/10 border border-primary/30 ring-1 ring-primary/20",
            "shadow-[0_0_15px_rgba(var(--primary),0.12)]"
          )}
        >
          <span className="text-primary/80 font-semibold tracking-wide text-sm whitespace-nowrap">
            {t.ui("teamComp.totalRotation")}
          </span>
          <span className="text-foreground font-[math] font-black text-2xl md:text-3xl drop-shadow-sm">
            {fmtDamage(comboResult.totalDamage)}
          </span>
        </div>
      )}
    </div>
  );
}
