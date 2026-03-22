/**
 * Batch AutoTune View
 *
 * Selection → Computing → Review flow.
 * Runs AutoTune sequentially (one build at a time, parallel workers per team).
 * Results display in V2-style cards with shared AutoTuneResults sub-components.
 */

import {
  ComboTable,
  MainStatColumn,
  SubstatPills,
} from "@/components/artifact-builds/AutoTuneResults";
import { AutoTuneTeamRow } from "@/components/artifact-builds/AutoTuneTeamRow";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
} from "@/data/constants";
import type { Build, BuildGroup, Element } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import type { WeightedFormula } from "@/lib/account-data/scoring/autoTune";
import type { AutoTuneWorkerResponse } from "@/lib/account-data/scoring/autoTune.worker";
import type {
  AutoTuneOutput,
  AutoTuneTeamInput,
  AutoTuneTeamResult,
  TeamBreakdown,
} from "@/lib/account-data/scoring/pipeline";
import { aggregateTeamResults } from "@/lib/account-data/scoring/pipeline";
import { buildTeamLabel } from "@/lib/artifact-builds/teamLabel";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { buildTeamConfigs } from "@/lib/team-comp/teamOptUtils";
import { cn, getElementColor } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { type Team, useTeamStore } from "@/stores/useTeamStore";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Scale,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

/** Filter mode: show only builds with matched teams, or all DPS builds */
type ViewFilter = "available" | "all";

type BuildEntry = {
  buildId: string;
  characterId: string;
  build: Build;
  selected: boolean;
  status: EntryStatus;
  result: AutoTuneOutput | null;
  /** Matching user teams for this build */
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

// ── Build team inputs from user teams (matches AutoTuneDialog logic) ──

function buildTeamInputsFromUserTeams(
  teams: Team[],
  characterId: string,
  element: string,
  accountData: import("@/data/types").AccountData | null,
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
      // Build combo-based formulas from character's defaultCombo
      let formulas: WeightedFormula[] | undefined;
      try {
        const tb = new TeamBuild(configs, opts);
        const combo = tb.getCombo(characterId);
        if (Object.keys(combo).length > 0) {
          const charFormulas = tb.getFormulaIds()[characterId];
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

/** Filter user teams matching this build's character + artifact set (same logic as AutoTuneDialog) */
function getMatchingTeams(
  allTeams: Team[],
  characterId: string,
  build: Build
): Team[] {
  return allTeams.filter((team) => {
    const charIdx = team.characters.indexOf(characterId);
    if (charIdx === -1) return false;

    const teamArt = team.artifacts[charIdx];
    if (!teamArt) return true; // no artifact configured = match
    if (build.composition === "4pc" && build.artifactSet) {
      if (teamArt.type === "4pc") return teamArt.setId === build.artifactSet;
      return true;
    }
    if (build.composition === "2pc+2pc" && build.halfSet1 && build.halfSet2) {
      if (teamArt.type === "2pc+2pc") {
        const buildIds = [
          String(build.halfSet1),
          String(build.halfSet2),
        ].sort();
        const teamIds = [String(teamArt.id1), String(teamArt.id2)].sort();
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

// ── Artifact set icon helper ──

function ArtifactSetIcons({ build }: { build: Build }) {
  if (build.composition === "4pc" && build.artifactSet) {
    const art = artifactsById[build.artifactSet];
    if (!art) return null;
    return (
      <ItemIcon
        imagePath={art.imagePaths.flower}
        rarity={art.rarity}
        size="xs"
      />
    );
  }
  if (build.composition === "2pc+2pc") {
    const hs1 =
      build.halfSet1 != null ? artifactHalfSetsById[build.halfSet1] : null;
    const hs2 =
      build.halfSet2 != null ? artifactHalfSetsById[build.halfSet2] : null;
    const setId1 = hs1?.setIds.find((s) => artifactsById[s]?.rarity === 5);
    const setId2 = hs2?.setIds.find((s) => artifactsById[s]?.rarity === 5);
    const art1 = setId1 ? artifactsById[setId1] : null;
    const art2 = setId2 ? artifactsById[setId2] : null;
    if (!art1 && !art2) return null;
    return (
      <ItemIcon
        imagePath={art1?.imagePaths.flower ?? ""}
        imagePath2={art2?.imagePaths.flower ?? ""}
        size="xs"
      />
    );
  }
  return null;
}

// ── Teams hover tooltip ──

function TeamsTooltip({
  teams,
  characterId,
  accountData,
  t,
}: {
  teams: Team[];
  characterId: string;
  accountData: import("@/data/types").AccountData | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (teams.length === 0) return null;
  return (
    <div className="space-y-1.5 p-2">
      {teams.map((team) => (
        <AutoTuneTeamRow
          key={team.id}
          team={team}
          characterId={characterId}
          enabled={true}
          onToggle={() => {}}
          accountData={accountData}
        />
      ))}
    </div>
  );
}

// ── Selection card ──

function SelectionCard({
  entry,
  onToggle,
  element,
  accountData,
}: {
  entry: BuildEntry;
  onToggle: () => void;
  element: string;
  accountData: import("@/data/types").AccountData | null;
}) {
  const { t } = useLanguage();
  const char = charactersById[entry.characterId];
  const elHex = ELEMENT_HEX[element] || "#888";
  const elColor = getElementColor(element as Element, "text");
  const noTeams = entry.teams.length === 0;

  return (
    <div className="relative group">
      <button
        type="button"
        tabIndex={noTeams ? -1 : 0}
        onClick={noTeams ? undefined : onToggle}
        disabled={noTeams}
        className={cn(
          "relative flex items-center gap-1.5 rounded-lg border text-left transition-all",
          "w-full overflow-hidden p-1.5 pl-2",
          noTeams
            ? "border-transparent bg-muted/5 opacity-30 cursor-not-allowed"
            : entry.selected
              ? "border-border bg-gradient-card cursor-pointer"
              : "border-transparent bg-muted/5 opacity-40 hover:opacity-65 cursor-pointer"
        )}
      >
        {/* Element accent — left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
          style={{
            background: entry.selected && !noTeams ? elHex : "transparent",
          }}
        />

        {/* Checkbox on far left */}
        <Checkbox
          checked={noTeams ? false : entry.selected}
          onCheckedChange={noTeams ? undefined : onToggle}
          className={cn(
            "shrink-0 pointer-events-none",
            noTeams && "opacity-50"
          )}
          tabIndex={-1}
          disabled={noTeams}
        />

        {/* Character icon */}
        {char && (
          <ItemIcon
            imagePath={char.imagePath}
            rarity={char.rarity}
            size="md"
            characterId={entry.characterId}
          />
        )}

        {/* Right column: name top, artifact + team count bottom */}
        <div className="min-w-0 flex flex-col gap-1 self-stretch py-0.5">
          {/* Name */}
          <span
            className={cn(
              "text-sm font-semibold truncate leading-none",
              elColor
            )}
          >
            {t.character(entry.characterId)}
          </span>

          {/* Artifact icons row */}
          <div className="flex items-end mt-auto">
            <ArtifactSetIcons build={entry.build} />
          </div>
        </div>
      </button>

      {/* Hover tooltip — teams */}
      {entry.teams.length > 0 && (
        <div
          className={cn(
            "absolute z-50 left-0 top-full mt-1",
            "bg-popover border border-border rounded-lg shadow-xl",
            "opacity-0 pointer-events-none scale-95 origin-top-left",
            "group-hover:opacity-100 group-hover:pointer-events-auto group-hover:scale-100",
            "transition-all duration-150"
          )}
        >
          <TeamsTooltip
            teams={entry.teams}
            characterId={entry.characterId}
            accountData={accountData}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

// ── Per-team result row: team grid + expandable combo table ──

function TeamResultRow({
  team,
  characterId,
  breakdown,
  accountData,
  t,
}: {
  team: Team | null;
  characterId: string;
  breakdown: TeamBreakdown;
  accountData: import("@/data/types").AccountData | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const [expanded, setExpanded] = useState(false);
  const qualifying = breakdown.combos.filter((c) => c.damageRatio >= 0.96);

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-3 w-full px-2.5 py-2 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Team grid or fallback label */}
        {team ? (
          <div className="flex-1 min-w-0 pointer-events-none">
            <AutoTuneTeamRow
              team={team}
              characterId={characterId}
              enabled={true}
              onToggle={() => {}}
              accountData={accountData}
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground truncate flex-1">
            {breakdown.label}
          </span>
        )}

        {/* Info: formula counts + qualifying combo count */}
        <div className="shrink-0 text-right space-y-0.5">
          {breakdown.formulas
            ?.filter((f) => f.count > 0)
            .map((f) => (
              <div key={f.formulaId} className="text-xs">
                <span className="font-medium text-foreground md:text-sm">
                  {f.label ? t.resolveLabel(f.label) : f.formulaId}
                </span>{" "}
                <span className="text-sm font-mono font-semibold text-foreground/70">
                  ×{f.count}
                </span>
              </div>
            ))}
          <div className="text-xs text-muted-foreground">
            {t.format(
              "batchAutoTune.mainStatCombos",
              qualifying.length,
              qualifying.length !== 1 ? "s" : ""
            )}
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && qualifying.length > 0 && (
        <div className="px-2.5 pb-2">
          <ComboTable combos={qualifying} t={t} />
        </div>
      )}
    </div>
  );
}

// ── V2-style result card (reuses shared AutoTuneResults components) ──

function ResultCard({
  entry,
  onApply,
  onDismiss,
  element,
  accountData,
}: {
  entry: BuildEntry;
  onApply: () => void;
  onDismiss: () => void;
  element: string;
  accountData: import("@/data/types").AccountData | null;
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
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={onDismiss}
              >
                {t.ui("batchAutoTune.dismiss")}
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={onApply}>
                {t.ui("batchAutoTune.apply")}
              </Button>
            </div>
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

        {/* ── Per-team breakdowns with icon grid ── */}
        {result.teamBreakdowns.length > 0 && (
          <div className="border-t border-white/10 pt-2 space-y-2">
            {result.teamBreakdowns.map((tb) => (
              <TeamResultRow
                key={tb.teamIndex}
                team={entry.teams[tb.teamIndex] ?? null}
                characterId={entry.characterId}
                breakdown={tb}
                accountData={accountData}
                t={t}
              />
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
  const { characterStats } = useGameStats();
  const groups = useAllResolvedBuilds();
  const setBuild = useBuildsStore((s) => s.setBuild);
  const allUserTeams = useTeamStore((s) => s.teams);
  const accountData = useAccountStore((s) => getActiveAccount(s)?.data ?? null);

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

      // Preserve existing ER weights — autotune ignores ER so we carry them over
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

  // ── Loading ──
  if (entries.length === 0) {
    const hasBuilds = groups.length > 0;
    const hasTeams = allUserTeams.length > 0;
    return (
      <ScrollLayout>
        <div className="flex flex-col items-center pt-16 md:pt-24 h-full p-4">
          <div className="flex flex-col items-center text-center space-y-6 max-w-lg">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
              <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
                <Scale className="w-12 h-12 text-primary opacity-80" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {t.ui("batchAutoTune.noBuildTitle")}
              </h3>
              <p className="text-muted-foreground text-base max-w-md mx-auto">
                {t.ui("batchAutoTune.noBuildDesc")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!hasBuilds && (
                <Button asChild variant="default" size="lg" className="gap-2">
                  <Link to="/artifact-filter?tab=configure">
                    <ExternalLink className="w-4 h-4" />
                    {t.ui("evaluation.goToBuilds")}
                  </Link>
                </Button>
              )}
              {!hasTeams && (
                <Button
                  asChild
                  variant={hasBuilds ? "default" : "outline"}
                  size="lg"
                  className="gap-2"
                >
                  <Link to="/team-comp">
                    <ExternalLink className="w-4 h-4" />
                    {t.ui("batchAutoTune.goToTeams")}
                  </Link>
                </Button>
              )}
              {hasBuilds && hasTeams && (
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={() => setViewFilter("all")}
                >
                  {t.ui("batchAutoTune.allBuilds")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </ScrollLayout>
    );
  }

  return (
    <ScrollLayout>
      {/* ── Header ── */}
      <div className="mb-4">
        <h2 className="text-xl font-bold">{t.ui("batchAutoTune.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t.ui("batchAutoTune.subtitle")}
        </p>
      </div>

      {/* ── Control bar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {phase === "selection" && (
          <>
            {/* View filter toggle */}
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

      {/* ── Selection grid ── */}
      {phase === "selection" && (
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          }}
        >
          {entries.map((entry, idx) => (
            <SelectionCard
              key={entry.buildId}
              entry={entry}
              onToggle={() => toggleEntry(idx)}
              element={characterStats?.[entry.characterId]?.element ?? ""}
              accountData={accountData}
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
