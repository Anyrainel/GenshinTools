import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData, Build, Element } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import type { AutoTuneWorkerResponse } from "@/lib/account-data/scoring/autoTune.worker";
import type {
  AutoTuneOutput,
  AutoTuneTeamResult,
} from "@/lib/account-data/scoring/pipeline";
import { aggregateTeamResults } from "@/lib/account-data/scoring/pipeline";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { ELEMENT_ELIGIBLE_REACTIONS } from "@/lib/team-comp/constants";
import { buildTeamConfigs } from "@/lib/team-comp/teamConfigUtils";
import type { ComboLine, I18nLabel, ReactionType } from "@/lib/team-comp/types";
import { type Team, useTeamStore } from "@/stores/useTeamStore";
import { Loader2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { AutoTuneResults } from "./AutoTuneResults";
import { AutoTuneTeamRow } from "./AutoTuneTeamRow";
import { TeamEditDialog } from "./TeamEditDialog";

/** Unique key for a combo line: formulaId + reaction */
function comboLineKey(line: ComboLine): string {
  return `${line.formulaId}.${line.reaction?.reaction ?? "none"}`;
}

/** Build a team label from character names: "Hu Tao" → "Tao", join with "/" */
function shortenName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

export function buildTeamLabel(
  team: { characters: (string | null)[] },
  t: { character: (id: string) => string }
): string {
  return team.characters
    .filter(Boolean)
    .map((cid) => shortenName(t.character(cid!)))
    .join("/");
}

// ─── State Management ───

type Phase = "config" | "computing" | "results";

type State = {
  phase: Phase;
  enabledTeamIds: Set<string>;
  comboLines: ComboLine[];
  result: AutoTuneOutput | null;
  error: string | null;
};

type Action =
  | { type: "toggleTeam"; teamId: string; enabled: boolean }
  | { type: "setComboLines"; lines: ComboLine[] }
  | { type: "setLineCount"; lineKey: string; count: number }
  | { type: "startCompute" }
  | { type: "computeSuccess"; result: AutoTuneOutput }
  | { type: "computeError"; error: string }
  | { type: "reset"; enabledTeamIds: Set<string> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "toggleTeam": {
      const next = new Set(state.enabledTeamIds);
      if (action.enabled) next.add(action.teamId);
      else next.delete(action.teamId);
      return { ...state, enabledTeamIds: next };
    }
    case "setComboLines":
      return { ...state, comboLines: action.lines };
    case "setLineCount":
      return {
        ...state,
        comboLines: state.comboLines.map((l) =>
          comboLineKey(l) === action.lineKey ? { ...l, count: action.count } : l
        ),
      };
    case "startCompute":
      return { ...state, phase: "computing", error: null };
    case "computeSuccess":
      return { ...state, phase: "results", result: action.result };
    case "computeError":
      return { ...state, phase: "config", error: action.error };
    case "reset":
      return {
        phase: "config",
        enabledTeamIds: action.enabledTeamIds,
        comboLines: [],
        result: null,
        error: null,
      };
  }
}

interface AutoTuneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
  element: Element;
  build: Build;
  onApply: (result: AutoTuneOutput) => void;
}

export function AutoTuneDialog({
  open,
  onOpenChange,
  characterId,
  element,
  build,
  onApply,
}: AutoTuneDialogProps) {
  const { t } = useLanguage();
  const teams = useTeamStore((s) => s.teams);
  const addTeam = useTeamStore((s) => s.addTeam);
  const accountData = useActiveAccountData();

  // Filter teams: must contain this character AND match build's artifact set
  const relevantTeams = useMemo(() => {
    return teams.filter((team) => {
      const charIdx = team.characters.indexOf(characterId);
      if (charIdx === -1) return false;

      // Match artifact set from the build
      const teamArt = team.artifacts[charIdx];
      if (!teamArt) return true; // no artifact configured = show it
      if (build.composition === "4pc" && build.artifactSet) {
        if (teamArt.type === "4pc") return teamArt.setId === build.artifactSet;
        return true; // different composition type = show it
      }
      if (build.composition === "2pc+2pc" && build.halfSet1 && build.halfSet2) {
        if (teamArt.type === "2pc+2pc") {
          const buildIds = [build.halfSet1, build.halfSet2].sort();
          const teamIds = [teamArt.halfSetIds[0], teamArt.halfSetIds[1]].sort();
          return buildIds[0] === teamIds[0] && buildIds[1] === teamIds[1];
        }
        return true;
      }
      return true;
    });
  }, [teams, characterId, build]);

  const initialEnabledIds = useMemo(
    () => new Set(relevantTeams.map((t) => t.id)),
    [relevantTeams]
  );

  const [state, dispatch] = useReducer(reducer, {
    phase: "config",
    enabledTeamIds: initialEnabledIds,
    comboLines: [],
    result: null,
    error: null,
  });

  // Reset when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        dispatch({
          type: "reset",
          enabledTeamIds: new Set(relevantTeams.map((t) => t.id)),
        });
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, relevantTeams]
  );

  const enabledTeams = useMemo(
    () => relevantTeams.filter((t) => state.enabledTeamIds.has(t.id)),
    [relevantTeams, state.enabledTeamIds]
  );

  // ─── Formula Discovery ───
  // Build a TeamBuild from the first valid enabled team to discover formulas
  // and eligible reactions per the character's element and team composition
  const { discoveredFormulas, eligibleReactions, defaultCombo } =
    useMemo(() => {
      const formulas: {
        formulaId: string;
        label: I18nLabel;
        offField: "full" | "partial" | "none";
      }[] = [];
      let reactions: ReactionType[] = ["none"];
      let combo: Record<string, number> = {};
      for (const team of enabledTeams) {
        const configs = buildTeamConfigs(team, accountData);
        if (
          configs.length === 0 ||
          !configs.some((c) => c.charId === characterId)
        )
          continue;
        try {
          const tb = new TeamBuild(
            configs,
            (team.opts ?? {}) as Record<string, string>
          );
          const allFormulas = tb.catalog.getFormulaIds();
          const charFormulas = allFormulas[characterId];
          if (!charFormulas || Object.keys(charFormulas).length === 0) continue;
          for (const [fid, label] of Object.entries(charFormulas)) {
            formulas.push({
              formulaId: fid,
              label,
              offField: tb.catalog.offFieldStatus(fid),
            });
          }
          combo = tb.catalog.getCombo(characterId);
          // Determine eligible reactions for this element + team
          const eligible = ELEMENT_ELIGIBLE_REACTIONS[
            element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
          ] ?? ["none"];
          reactions = eligible.filter(
            (rx) => rx === "none" || tb.teamMeta.hasReaction(rx, characterId)
          ) as ReactionType[];
          return {
            discoveredFormulas: formulas,
            eligibleReactions: reactions,
            defaultCombo: combo,
          };
        } catch {
          // try next team
        }
      }
      return {
        discoveredFormulas: formulas,
        eligibleReactions: reactions,
        defaultCombo: combo,
      };
    }, [enabledTeams, accountData, characterId, element]);

  const hasReactions = eligibleReactions.length > 1;

  // Auto-populate combo lines when formulas are discovered
  useEffect(() => {
    if (discoveredFormulas.length > 0 && state.comboLines.length === 0) {
      const hasCombo = Object.keys(defaultCombo).length > 0;
      // Create one line per formula × reaction variant
      const lines: ComboLine[] = [];
      for (const f of discoveredFormulas) {
        const comboCount = hasCombo ? (defaultCombo[f.formulaId] ?? 0) : 1;
        if (hasReactions) {
          for (const rx of eligibleReactions) {
            lines.push({
              charId: characterId,
              formulaId: f.formulaId,
              count: rx === "none" ? comboCount : 0,
              reaction: rx !== "none" ? { reaction: rx } : undefined,
            });
          }
        } else {
          lines.push({
            charId: characterId,
            formulaId: f.formulaId,
            count: comboCount,
          });
        }
      }
      dispatch({ type: "setComboLines", lines });
    }
  }, [
    discoveredFormulas,
    state.comboLines.length,
    characterId,
    hasReactions,
    eligibleReactions,
    defaultCombo,
  ]);

  // ─── Add Team (via edit dialog) ───
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const buildArtifactConfig = useCallback((): ArtifactConfig | null => {
    if (build.composition === "4pc" && build.artifactSet)
      return { type: "4pc", setId: build.artifactSet };
    if (build.composition === "2pc+2pc" && build.halfSet1 && build.halfSet2)
      return { type: "2pc+2pc", halfSetIds: [build.halfSet1, build.halfSet2] };
    return null;
  }, [build]);

  const handleAddTeam = useCallback(() => {
    setEditDialogOpen(true);
  }, []);

  const handleEditSave = useCallback(
    (team: {
      characters: (string | null)[];
      weapons: (string | null)[];
      artifacts: (ArtifactConfig | null)[];
    }) => {
      const teamId = addTeam({
        characters: team.characters,
        weapons: team.weapons,
        artifacts: team.artifacts,
      });
      dispatch({ type: "toggleTeam", teamId, enabled: true });
      setEditDialogOpen(false);
    },
    [addTeam]
  );

  // ─── Calculate ───
  const activeFormulas = useMemo(
    () =>
      state.comboLines
        .filter((l) => l.count > 0)
        .map((l) => ({
          formulaId: l.formulaId,
          count: l.count,
          reaction: l.reaction,
        })),
    [state.comboLines]
  );

  const handleCalculate = useCallback(() => {
    dispatch({ type: "startCompute" });

    const formulas = activeFormulas.length > 0 ? activeFormulas : undefined;

    // Spawn one worker per team for parallel computation
    const teamInputs = enabledTeams.map((team, i) => ({
      characterId,
      configs: buildTeamConfigs(team, accountData),
      opts: (team.opts ?? {}) as Record<string, string>,
      formulas,
      label: team.name || buildTeamLabel(team, t),
      teamIndex: i,
      element,
    }));

    const results: (AutoTuneTeamResult | null)[] = new Array(
      teamInputs.length
    ).fill(null);
    let completed = 0;
    let failed = false;

    for (let i = 0; i < teamInputs.length; i++) {
      const worker = new Worker(
        new URL(
          "@/lib/account-data/scoring/autoTune.worker.ts",
          import.meta.url
        ),
        { type: "module" }
      );
      worker.onmessage = (e: MessageEvent<AutoTuneWorkerResponse>) => {
        worker.terminate();
        if (failed) return;
        const resp = e.data;
        if ("error" in resp) {
          failed = true;
          dispatch({ type: "computeError", error: resp.error });
          return;
        }
        results[i] = resp.result;
        completed++;
        if (completed === teamInputs.length) {
          try {
            const validResults = results.filter(
              (r): r is AutoTuneTeamResult => r !== null
            );
            const output = aggregateTeamResults(
              validResults,
              characterId,
              element
            );
            dispatch({ type: "computeSuccess", result: output });
          } catch (err) {
            dispatch({
              type: "computeError",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      };
      worker.onerror = (e) => {
        worker.terminate();
        if (!failed) {
          failed = true;
          dispatch({
            type: "computeError",
            error: e.message || "Worker error",
          });
        }
      };
      worker.postMessage({ id: i, input: teamInputs[i] });
    }
  }, [enabledTeams, accountData, characterId, element, activeFormulas, t]);

  const handleApply = useCallback(() => {
    if (state.result) {
      onApply(state.result);
      onOpenChange(false);
    }
  }, [state.result, onApply, onOpenChange]);

  const canCalculate = enabledTeams.length > 0 && activeFormulas.length > 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="md:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("buildCard.autoTuneTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("buildCard.autoTuneDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[60vh] overflow-y-auto overscroll-contain space-y-4 py-2">
          {state.phase === "config" && (
            <ConfigPhase
              characterId={characterId}
              relevantTeams={relevantTeams}
              enabledTeamIds={state.enabledTeamIds}
              discoveredFormulas={discoveredFormulas}
              comboLines={state.comboLines}
              eligibleReactions={eligibleReactions}
              hasReactions={hasReactions}
              error={state.error}
              dispatch={dispatch}
              onAddTeam={handleAddTeam}
              accountData={accountData}
              t={t}
            />
          )}

          {state.phase === "computing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t.ui("buildCard.autoTuneComputing")}
              </span>
            </div>
          )}

          {state.phase === "results" && state.result && (
            <AutoTuneResults result={state.result} />
          )}
        </div>

        <ResponsiveDialogFooter>
          {state.phase === "config" && (
            <Button onClick={handleCalculate} disabled={!canCalculate}>
              {t.ui("buildCard.autoTuneCalculate")}
            </Button>
          )}
          {state.phase === "results" && (
            <div className="flex gap-2 w-full justify-end">
              <Button
                variant="outline"
                onClick={() =>
                  dispatch({
                    type: "reset",
                    enabledTeamIds: new Set(relevantTeams.map((t) => t.id)),
                  })
                }
              >
                {t.ui("common.cancel")}
              </Button>
              <Button onClick={handleApply}>
                {t.ui("buildCard.autoTuneApply")}
              </Button>
            </div>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>

      {/* Team Edit Dialog (nested) */}
      <TeamEditDialog
        open={editDialogOpen}
        onSave={handleEditSave}
        onCancel={() => setEditDialogOpen(false)}
        initialCharacters={[characterId, null, null, null]}
        initialWeapons={[null, null, null, null]}
        initialArtifacts={[buildArtifactConfig(), null, null, null]}
        accountData={accountData}
      />
    </ResponsiveDialog>
  );
}

// ─── Config Phase ───

function ConfigPhase({
  characterId,
  relevantTeams,
  enabledTeamIds,
  discoveredFormulas,
  comboLines,
  eligibleReactions,
  hasReactions,
  error,
  dispatch,
  onAddTeam,
  accountData,
  t,
}: {
  characterId: string;
  relevantTeams: Team[];
  enabledTeamIds: Set<string>;
  discoveredFormulas: {
    formulaId: string;
    label: I18nLabel;
    offField: "full" | "partial" | "none";
  }[];
  comboLines: ComboLine[];
  eligibleReactions: ReactionType[];
  hasReactions: boolean;
  error: string | null;
  dispatch: React.Dispatch<Action>;
  onAddTeam: () => void;
  accountData: AccountData | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="space-y-4">
      {/* Team Selection */}
      <section>
        <h4 className="text-sm font-medium mb-1.5">
          {t.ui("buildCard.autoTuneTeams")}
        </h4>
        {relevantTeams.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            {t.ui("buildCard.autoTuneNoTeams")}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 justify-items-center">
            {relevantTeams.map((team) => (
              <AutoTuneTeamRow
                key={team.id}
                team={team}
                characterId={characterId}
                enabled={enabledTeamIds.has(team.id)}
                onToggle={(enabled) =>
                  dispatch({ type: "toggleTeam", teamId: team.id, enabled })
                }
                accountData={accountData}
              />
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={onAddTeam}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {t.ui("buildCard.autoTuneAddTeam")}
        </Button>
      </section>

      {/* Formula Selection */}
      {discoveredFormulas.length > 0 && (
        <section>
          <h4 className="text-sm font-medium mb-1.5">
            {t.ui("buildCard.autoTuneFormulas")}
          </h4>
          <div className="space-y-0.5">
            {discoveredFormulas.map((formula) => (
              <div
                key={formula.formulaId}
                className="px-2 py-1.5 rounded bg-muted/30"
              >
                <span className="text-sm font-medium flex flex-wrap items-baseline gap-x-1">
                  <span>{t.resolveLabel(formula.label)}</span>
                  {formula.offField !== "none" && (
                    <span className="text-muted-foreground font-normal whitespace-nowrap">
                      {t.ui(
                        formula.offField === "full"
                          ? "common.offFieldSuffix"
                          : "common.partialOffFieldSuffix"
                      )}
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  {hasReactions
                    ? eligibleReactions.map((rx) => {
                        const lineKey = `${formula.formulaId}.${rx}`;
                        const line = comboLines.find(
                          (l) => comboLineKey(l) === lineKey
                        );
                        const count = line?.count ?? 0;
                        return (
                          <div key={lineKey} className="flex items-center">
                            <span
                              className={`text-sm font-semibold ${count > 0 ? "text-foreground" : "text-muted-foreground"}`}
                            >
                              {t.reaction(rx)}
                            </span>
                            <CountStepper
                              count={count}
                              lineKey={lineKey}
                              dispatch={dispatch}
                            />
                          </div>
                        );
                      })
                    : (() => {
                        const lineKey = `${formula.formulaId}.none`;
                        const line = comboLines.find(
                          (l) => comboLineKey(l) === lineKey
                        );
                        const count = line?.count ?? 0;
                        return (
                          <CountStepper
                            count={count}
                            lineKey={lineKey}
                            dispatch={dispatch}
                          />
                        );
                      })()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
          {t.ui("buildCard.autoTuneError")}: {error}
        </div>
      )}
    </div>
  );
}

function CountStepper({
  count,
  lineKey,
  dispatch,
}: {
  count: number;
  lineKey: string;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground disabled:opacity-30"
        disabled={count <= 0}
        onClick={() =>
          dispatch({ type: "setLineCount", lineKey, count: count - 1 })
        }
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span
        className={`w-5 text-center text-sm font-mono tabular-nums font-bold ${count === 0 ? "text-muted-foreground" : ""}`}
      >
        {count}
      </span>
      <button
        type="button"
        className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground disabled:opacity-30"
        disabled={count >= 99}
        onClick={() =>
          dispatch({ type: "setLineCount", lineKey, count: count + 1 })
        }
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
