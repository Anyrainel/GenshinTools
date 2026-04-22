/**
 * Batch AutoTune View
 *
 * Selection -> Computing -> Review flow.
 * Runs AutoTune sequentially (one build at a time, parallel workers per team).
 * Results display in V2-style cards with shared AutoTuneResults sub-components.
 */

import { AutoTuneEmptyState } from "@/components/artifact-builds/AutoTuneEmptyState";
import { AutoTuneResultCard } from "@/components/artifact-builds/AutoTuneResultCard";
import { AutoTuneSelectionCard } from "@/components/artifact-builds/AutoTuneSelectionCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData, Build, BuildGroup } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useGameStats } from "@/hooks/useGameStats";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import type { WeightedFormula } from "@/lib/account-data/scoring/autoTune";
import type { AutoTuneWorkerResponse } from "@/lib/account-data/scoring/autoTune.worker";
import type {
  AutoTuneOutput,
  AutoTuneTeamInput,
  AutoTuneTeamResult,
} from "@/lib/account-data/scoring/pipeline";
import { aggregateTeamResults } from "@/lib/account-data/scoring/pipeline";
import { buildTeamLabel } from "@/lib/artifact-builds/teamLabel";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { buildTeamConfigs } from "@/lib/team-comp/teamConfigUtils";
import { cn } from "@/lib/utils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { type Team, useTeamStore } from "@/stores/useTeamStore";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type EntryStatus = "idle" | "computing" | "done" | "applied";

type ViewFilter = "available" | "all";

type BuildEntry = {
  buildId: string;
  characterId: string;
  build: Build;
  selected: boolean;
  status: EntryStatus;
  result: AutoTuneOutput | null;
  teams: Team[];
};

type Phase = "selection" | "computing" | "review";

// ── Worker promise wrapper ──

function runAutoTuneWorkers(
  teamInputs: AutoTuneTeamInput[],
  characterId: string,
  element: string
): Promise<AutoTuneOutput> {
  return new Promise((resolve, reject) => {
    if (teamInputs.length === 0) {
      reject(new Error("No team inputs"));
      return;
    }

    const results: (AutoTuneTeamResult | null)[] = new Array(
      teamInputs.length
    ).fill(null);
    let completed = 0;
    let failed = false;
    const workers: Worker[] = [];

    for (let i = 0; i < teamInputs.length; i++) {
      const worker = new Worker(
        new URL(
          "@/lib/account-data/scoring/autoTune.worker.ts",
          import.meta.url
        ),
        { type: "module" }
      );
      workers.push(worker);

      worker.onmessage = (e: MessageEvent<AutoTuneWorkerResponse>) => {
        worker.terminate();
        if (failed) return;
        const resp = e.data;
        if ("error" in resp) {
          failed = true;
          for (const w of workers) w.terminate();
          reject(new Error(resp.error));
          return;
        }
        results[i] = resp.result;
        completed++;
        if (completed === teamInputs.length) {
          try {
            const validResults = results.filter(
              (r): r is AutoTuneTeamResult => r !== null
            );
            resolve(aggregateTeamResults(validResults, characterId, element));
          } catch (err) {
            reject(err);
          }
        }
      };

      worker.onerror = (e) => {
        worker.terminate();
        if (!failed) {
          failed = true;
          for (const w of workers) w.terminate();
          reject(new Error(e.message || "Worker error"));
        }
      };

      worker.postMessage({ id: i, input: teamInputs[i] });
    }
  });
}

// ── Build team inputs from user teams ──

function buildTeamInputsFromUserTeams(
  teams: Team[],
  characterId: string,
  element: string,
  accountData: AccountData | null,
  t: { character: (id: string) => string }
): AutoTuneTeamInput[] {
  const inputs: AutoTuneTeamInput[] = [];

  for (const team of teams) {
    try {
      const configs = buildTeamConfigs(team, accountData);
      if (
        configs.length === 0 ||
        !configs.some((c) => c.charId === characterId)
      )
        continue;
      const opts = (team.opts ?? {}) as Record<string, string>;
      let formulas: WeightedFormula[] | undefined;
      try {
        const tb = new TeamBuild(configs, opts);
        const combo = tb.catalog.getCombo(characterId);
        if (Object.keys(combo).length > 0) {
          const charFormulas = tb.catalog.getFormulaIds()[characterId];
          if (charFormulas) {
            formulas = Object.keys(charFormulas).map((formulaId) => ({
              formulaId,
              count: combo[formulaId] ?? 0,
            }));
          }
        }
      } catch {
        // Fall back to undefined (pipeline will use count=1 for all)
      }
      inputs.push({
        characterId,
        configs,
        opts,
        formulas,
        label: team.name || buildTeamLabel(team, t),
        teamIndex: inputs.length,
        element,
      });
    } catch {
      // Skip teams that fail to build configs
    }
  }

  return inputs;
}

// ── Collect DPS builds ──

function getMatchingTeams(
  allTeams: Team[],
  characterId: string,
  build: Build
): Team[] {
  return allTeams.filter((team) => {
    const charIdx = team.characters.indexOf(characterId);
    if (charIdx === -1) return false;

    const teamArt = team.artifacts[charIdx];
    if (!teamArt) return true;
    if (build.composition === "4pc" && build.artifactSet) {
      if (teamArt.type === "4pc") return teamArt.setId === build.artifactSet;
      return true;
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
}

function collectEntries(
  groups: BuildGroup[],
  allTeams: Team[],
  filter: ViewFilter,
  characterStats?: Record<string, { releaseDate?: string }> | null
): BuildEntry[] {
  const entries: BuildEntry[] = [];
  for (const group of groups) {
    for (const build of group.builds) {
      if (!build.roles?.includes("dps")) continue;
      const teams = getMatchingTeams(allTeams, group.characterId, build);
      if (filter === "available" && teams.length === 0) continue;
      entries.push({
        buildId: build.id,
        characterId: group.characterId,
        build,
        selected: teams.length > 0,
        status: "idle",
        result: null,
        teams,
      });
    }
  }
  entries.sort((a, b) => {
    const dateA = characterStats?.[a.characterId]?.releaseDate ?? "";
    const dateB = characterStats?.[b.characterId]?.releaseDate ?? "";
    if (dateA || dateB) {
      if (!dateA) return 1;
      if (!dateB) return -1;
      const cmp = dateB.localeCompare(dateA);
      if (cmp !== 0) return cmp;
    }
    return a.characterId.localeCompare(b.characterId);
  });
  return entries;
}

// ── Main View ──

export function AutoTuneView() {
  const { t } = useLanguage();
  const { characterStats } = useGameStats();
  const groups = useAllResolvedBuilds();
  const setBuild = useBuildsStore((s) => s.setBuild);
  const allUserTeams = useTeamStore((s) => s.teams);
  const accountData = useActiveAccountData();

  const [entries, setEntries] = useState<BuildEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("selection");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [viewFilter, setViewFilter] = useState<ViewFilter>("available");
  const abortRef = useRef(false);

  // Initialize entries when groups or filter change (only in selection phase)
  useEffect(() => {
    if (phase === "selection") {
      setEntries(
        collectEntries(groups, allUserTeams, viewFilter, characterStats)
      );
    }
  }, [groups, allUserTeams, phase, viewFilter, characterStats]);

  // ── Selection controls ──

  const toggleEntry = useCallback((idx: number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], selected: !next[idx].selected };
      return next;
    });
  }, []);

  const selectAll = useCallback((selected: boolean) => {
    setEntries((prev) => prev.map((e) => ({ ...e, selected })));
  }, []);

  const selectedCount = entries.filter((e) => e.selected).length;
  const allSelected = entries.length > 0 && selectedCount === entries.length;

  // ── Batch compute ──

  const handleRun = useCallback(async () => {
    if (!characterStats) return;
    abortRef.current = false;

    const selectedIndices = entries
      .map((e, i) => (e.selected ? i : -1))
      .filter((i) => i >= 0);

    setPhase("computing");
    setProgress({ done: 0, total: selectedIndices.length });

    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        status: "idle" as EntryStatus,
        result: null,
      }))
    );

    let doneCount = 0;
    for (const idx of selectedIndices) {
      if (abortRef.current) break;

      const entry = entries[idx];
      const element = characterStats[entry.characterId]?.element ?? "";

      setEntries((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: "computing" };
        return next;
      });

      const teamInputs = buildTeamInputsFromUserTeams(
        entry.teams,
        entry.characterId,
        element,
        accountData,
        t
      );

      if (teamInputs.length === 0) {
        toast.error(
          `${t.character(entry.characterId)}: ${t.ui("batchAutoTune.noTeams")}`
        );
        setEntries((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: "idle" };
          return next;
        });
        doneCount++;
        setProgress({ done: doneCount, total: selectedIndices.length });
        continue;
      }

      try {
        const result = await runAutoTuneWorkers(
          teamInputs,
          entry.characterId,
          element
        );
        setEntries((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: "done", result };
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`${t.character(entry.characterId)}: ${msg}`);
        setEntries((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: "idle" };
          return next;
        });
      }

      doneCount++;
      setProgress({ done: doneCount, total: selectedIndices.length });
    }

    setPhase("review");
  }, [entries, characterStats, accountData, t]);

  // ── Apply ──

  const applyEntry = useCallback(
    (idx: number) => {
      const entry = entries[idx];
      if (!entry.result) return;

      const oldErSands = entry.build.sandsWeights.find((w) => w.stat === "er");
      const oldErSub = entry.build.substats.find((s) => s.stat === "er");

      const newSandsWeights = oldErSands
        ? [
            ...entry.result.sandsWeights.filter((w) => w.stat !== "er"),
            oldErSands,
          ]
        : entry.result.sandsWeights;

      const newSubstats = oldErSub
        ? [...entry.result.substats.filter((s) => s.stat !== "er"), oldErSub]
        : entry.result.substats;

      setBuild(
        entry.buildId,
        {
          substats: newSubstats,
          sandsWeights: newSandsWeights,
          gobletWeights: entry.result.gobletWeights,
          circletWeights: entry.result.circletWeights,
          normalizer: entry.result.normalizer,
        },
        entry.build
      );
      setEntries((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: "applied" };
        return next;
      });
    },
    [entries, setBuild]
  );

  const applyAll = useCallback(() => {
    entries.forEach((entry, idx) => {
      if (entry.status === "done" && entry.result) {
        applyEntry(idx);
      }
    });
  }, [entries, applyEntry]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    setPhase("selection");
    setEntries(
      collectEntries(groups, allUserTeams, viewFilter, characterStats)
    );
  }, [groups, allUserTeams, viewFilter, characterStats]);

  // ── Derived counts ──
  const successCount = entries.filter(
    (e) => e.status === "done" || e.status === "applied"
  ).length;
  const unappliedCount = entries.filter((e) => e.status === "done").length;

  // ── Empty state ──
  if (entries.length === 0) {
    return (
      <ScrollLayout>
        <AutoTuneEmptyState
          hasBuilds={groups.length > 0}
          hasTeams={allUserTeams.some((t) =>
            t.characters.some((c) => c != null)
          )}
          onShowAll={() => setViewFilter("all")}
        />
      </ScrollLayout>
    );
  }

  return (
    <ScrollLayout>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold">{t.ui("batchAutoTune.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t.ui("batchAutoTune.subtitle")}
        </p>
      </div>

      {/* Control bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {phase === "selection" && (
          <>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                type="button"
                className={cn(
                  "px-3.5 py-1.5 font-medium transition-colors",
                  viewFilter === "available"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
                )}
                onClick={() => setViewFilter("available")}
              >
                {t.ui("batchAutoTune.available")}
              </button>
              <button
                type="button"
                className={cn(
                  "px-3.5 py-1.5 font-medium transition-colors border-l border-border",
                  viewFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
                )}
                onClick={() => setViewFilter("all")}
              >
                {t.ui("batchAutoTune.allBuilds")}
              </button>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-sm"
                onClick={() => selectAll(!allSelected)}
              >
                {allSelected
                  ? t.ui("batchAutoTune.deselectAll")
                  : t.ui("batchAutoTune.selectAll")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedCount}/{entries.length}
              </span>
              <Button
                size="default"
                className="text-sm"
                disabled={selectedCount === 0}
                onClick={handleRun}
              >
                {t.ui("batchAutoTune.run")}
              </Button>
            </div>
          </>
        )}

        {phase === "computing" && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-base text-muted-foreground">
              {t.format("batchAutoTune.running", progress.done, progress.total)}
            </span>
          </div>
        )}

        {phase === "review" && (
          <>
            <span className="text-base text-muted-foreground">
              {t.format(
                "batchAutoTune.done",
                successCount,
                entries.filter((e) => e.selected).length
              )}
            </span>
            {unappliedCount > 0 && (
              <Button size="default" onClick={applyAll}>
                {t.ui("batchAutoTune.applyAll")} ({unappliedCount})
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-sm"
              onClick={handleReset}
            >
              Reset
            </Button>
          </>
        )}
      </div>

      {/* Selection grid */}
      {phase === "selection" && (
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          }}
        >
          {entries.map((entry, idx) => (
            <AutoTuneSelectionCard
              key={entry.buildId}
              entry={entry}
              onToggle={() => toggleEntry(idx)}
              element={characterStats?.[entry.characterId]?.element ?? ""}
              accountData={accountData}
            />
          ))}
        </div>
      )}

      {/* Result grid */}
      {phase !== "selection" && (
        <div className="grid gap-2 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
          {entries
            .filter(
              (e) =>
                e.selected &&
                (e.status === "computing" ||
                  e.status === "done" ||
                  e.status === "applied")
            )
            .map((entry) => {
              const idx = entries.indexOf(entry);
              return (
                <AutoTuneResultCard
                  key={entry.buildId}
                  entry={entry}
                  onApply={() => applyEntry(idx)}
                  onDismiss={() => toggleEntry(idx)}
                  element={characterStats?.[entry.characterId]?.element ?? ""}
                  accountData={accountData}
                />
              );
            })}
        </div>
      )}
    </ScrollLayout>
  );
}
