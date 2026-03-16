/**
 * Batch AutoTune View
 *
 * Selection → Computing → Review flow.
 * Runs AutoTune sequentially (one build at a time, parallel workers per team).
 * Results display in V2-style cards with shared AutoTuneResults sub-components.
 */

import {
  MainStatColumn,
  SubstatPills,
  TeamBreakdownSection,
} from "@/components/artifact-builds/AutoTuneResults";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { Build, BuildGroup, Element } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import type { AutoTuneWorkerResponse } from "@/lib/account-data/scoring/autoTune.worker";
import type {
  AutoTuneOutput,
  AutoTuneTeamInput,
  AutoTuneTeamResult,
} from "@/lib/account-data/scoring/pipeline";
import { aggregateTeamResults } from "@/lib/account-data/scoring/pipeline";
import {
  getFlagshipTeamsForChar,
  teamEntryToConfigs,
} from "@/lib/account-data/scoring/teamDatabase";
import type { CharCompConfig } from "@/lib/team-comp/types";
import { cn, getElementColor } from "@/lib/utils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ── Constants ──

const ELEMENT_HEX: Record<string, string> = {
  Pyro: "#b8483f",
  Hydro: "#22728f",
  Electro: "#8f70aa",
  Cryo: "#7aa8b8",
  Anemo: "#3d9b6a",
  Geo: "#b58f35",
  Dendro: "#669423",
};

// ── Types ──

type EntryStatus = "idle" | "computing" | "done" | "applied";

type BuildEntry = {
  buildId: string;
  characterId: string;
  build: Build;
  selected: boolean;
  status: EntryStatus;
  result: AutoTuneOutput | null;
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
          workers.forEach((w) => w.terminate());
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
          workers.forEach((w) => w.terminate());
          reject(new Error(e.message || "Worker error"));
        }
      };

      worker.postMessage({ id: i, input: teamInputs[i] });
    }
  });
}

// ── Build team inputs from Flagship Teams ──

function buildTeamInputsForBuild(
  characterId: string,
  element: string
): AutoTuneTeamInput[] {
  const teamEntries = getFlagshipTeamsForChar(characterId);
  const inputs: AutoTuneTeamInput[] = [];

  for (const { team } of teamEntries) {
    try {
      const configs = teamEntryToConfigs(team) as CharCompConfig[];
      const label = team.name || `Team ${team.id.slice(-4)}`;
      inputs.push({
        characterId,
        configs,
        opts: team.opts ?? {},
        formulas: undefined,
        label,
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

function collectEntries(groups: BuildGroup[]): BuildEntry[] {
  const entries: BuildEntry[] = [];
  for (const group of groups) {
    for (const build of group.builds) {
      if (!build.roles?.includes("dps")) continue;
      entries.push({
        buildId: build.id,
        characterId: group.characterId,
        build,
        selected: true,
        status: "idle",
        result: null,
      });
    }
  }
  entries.sort((a, b) => a.characterId.localeCompare(b.characterId));
  return entries;
}

// ── Selection chip ──

function SelectionChip({
  entry,
  onToggle,
}: {
  entry: BuildEntry;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const char = charactersById[entry.characterId];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-left transition-colors",
        entry.selected
          ? "border-primary/50 bg-primary/10"
          : "border-border/30 bg-muted/10 opacity-50"
      )}
    >
      <Checkbox
        checked={entry.selected}
        onCheckedChange={onToggle}
        className="shrink-0 pointer-events-none"
        tabIndex={-1}
      />
      {char && (
        <ItemIcon imagePath={char.imagePath} rarity={char.rarity} size="xs" />
      )}
      <div className="min-w-0 text-xs leading-tight">
        <div className="font-medium truncate">
          {t.character(entry.characterId)}
        </div>
        {entry.build.name && (
          <div className="text-muted-foreground truncate">
            {entry.build.name}
          </div>
        )}
      </div>
    </button>
  );
}

// ── V2-style result card (reuses shared AutoTuneResults components) ──

function ResultCard({
  entry,
  onApply,
  element,
}: {
  entry: BuildEntry;
  onApply: () => void;
  element: string;
}) {
  const { t } = useLanguage();
  const char = charactersById[entry.characterId];
  const elColor = getElementColor(element as Element, "text");
  const elHex = ELEMENT_HEX[element] || "#888";
  const result = entry.result;

  // Computing — spinner placeholder card
  if (entry.status === "computing") {
    return (
      <div className="bg-gradient-card border border-border/50 rounded-lg overflow-hidden">
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, ${elHex}, transparent)`,
          }}
        />
        <div className="p-3 flex items-center gap-2.5">
          {char && (
            <ItemIcon
              imagePath={char.imagePath}
              rarity={char.rarity}
              size="md"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className={cn("font-bold text-base truncate", elColor)}>
              {t.character(entry.characterId)}
            </div>
            {entry.build.name && (
              <div className="text-sm text-foreground/70">
                {entry.build.name}
              </div>
            )}
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  const applied = entry.status === "applied";

  return (
    <div
      className={cn(
        "bg-gradient-card border rounded-lg overflow-hidden",
        applied ? "border-green-500/40" : "border-border/50"
      )}
    >
      {/* Element accent */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${elHex}, transparent)`,
        }}
      />

      <div className="p-3 space-y-3">
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5">
          {char && (
            <ItemIcon
              imagePath={char.imagePath}
              rarity={char.rarity}
              size="md"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className={cn("font-bold text-base truncate", elColor)}>
              {t.character(entry.characterId)}
            </div>
            {entry.build.name && (
              <div className="text-sm text-foreground/70">
                {entry.build.name}
              </div>
            )}
          </div>
          {applied ? (
            <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              {t.ui("batchAutoTune.applied")}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onApply}
            >
              {t.ui("batchAutoTune.apply")}
            </Button>
          )}
        </div>

        {/* ── Main stat weights (3-col grid) ── */}
        <div className="grid grid-cols-3 gap-2">
          <MainStatColumn
            label={t.slot("sands")}
            weights={result.sandsWeights}
            t={t}
          />
          <MainStatColumn
            label={t.slot("goblet")}
            weights={result.gobletWeights}
            t={t}
          />
          <MainStatColumn
            label={t.slot("circlet")}
            weights={result.circletWeights}
            t={t}
          />
        </div>

        {/* ── Substat pills ── */}
        <SubstatPills substats={result.substats} t={t} />

        {/* ── Team breakdowns ── */}
        {result.teamBreakdowns.length > 0 && (
          <div className="border-t border-white/10 pt-2 space-y-1">
            {result.teamBreakdowns.map((tb) => (
              <TeamBreakdownSection key={tb.teamIndex} breakdown={tb} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main View ──

export function WeightsView() {
  const { t } = useLanguage();
  const { ready, characterStats } = useGameStats();
  const groups = useAllResolvedBuilds();
  const setBuild = useBuildsStore((s) => s.setBuild);

  const [entries, setEntries] = useState<BuildEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("selection");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const abortRef = useRef(false);

  // Initialize entries when groups change (only in selection phase)
  useMemo(() => {
    if (phase === "selection") {
      setEntries(collectEntries(groups));
    }
  }, [groups, phase]);

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

    // Reset status
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

      const teamInputs = buildTeamInputsForBuild(entry.characterId, element);

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
  }, [entries, characterStats, t]);

  // ── Apply ──

  const applyEntry = useCallback(
    (idx: number) => {
      const entry = entries[idx];
      if (!entry.result) return;
      setBuild(
        entry.buildId,
        {
          substats: entry.result.substats,
          sandsWeights: entry.result.sandsWeights,
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
    setEntries(collectEntries(groups));
  }, [groups]);

  // ── Derived counts ──
  const successCount = entries.filter(
    (e) => e.status === "done" || e.status === "applied"
  ).length;
  const unappliedCount = entries.filter((e) => e.status === "done").length;

  // ── Loading ──
  if (!ready) {
    return (
      <ScrollLayout>
        <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t.ui("v2Weights.loading")}</span>
        </div>
      </ScrollLayout>
    );
  }

  if (entries.length === 0) {
    return (
      <ScrollLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          {t.ui("batchAutoTune.noBuild")}
        </div>
      </ScrollLayout>
    );
  }

  return (
    <ScrollLayout className="pb-6 pt-2">
      {/* ── Control bar ── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {phase === "selection" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => selectAll(!allSelected)}
            >
              {allSelected
                ? t.ui("batchAutoTune.deselectAll")
                : t.ui("batchAutoTune.selectAll")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {selectedCount}/{entries.length}
            </span>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={selectedCount === 0}
              onClick={handleRun}
            >
              {t.ui("batchAutoTune.run")}
            </Button>
          </>
        )}

        {phase === "computing" && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t.format("batchAutoTune.running", progress.done, progress.total)}
            </span>
          </div>
        )}

        {phase === "review" && (
          <>
            <span className="text-sm text-muted-foreground">
              {t.format(
                "batchAutoTune.done",
                successCount,
                entries.filter((e) => e.selected).length
              )}
            </span>
            {unappliedCount > 0 && (
              <Button size="sm" className="h-7 text-xs" onClick={applyAll}>
                {t.ui("batchAutoTune.applyAll")} ({unappliedCount})
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={handleReset}
            >
              Reset
            </Button>
          </>
        )}
      </div>

      {/* ── Selection grid ── */}
      {phase === "selection" && (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry, idx) => (
            <SelectionChip
              key={entry.buildId}
              entry={entry}
              onToggle={() => toggleEntry(idx)}
            />
          ))}
        </div>
      )}

      {/* ── Result grid ── */}
      {phase !== "selection" && (
        <div className="grid gap-2.5 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
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
                <ResultCard
                  key={entry.buildId}
                  entry={entry}
                  onApply={() => applyEntry(idx)}
                  element={characterStats?.[entry.characterId]?.element ?? ""}
                />
              );
            })}
        </div>
      )}
    </ScrollLayout>
  );
}
