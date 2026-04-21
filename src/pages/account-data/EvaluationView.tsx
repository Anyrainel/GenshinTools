import { AccountDataNeedsBothState } from "@/components/account-data/AccountDataNeedsBothState";
import { BuildEvaluationCard } from "@/components/account-data/BuildEvaluationCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SortDirection } from "@/data/types";
import { tiers } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import type { ArchetypeRole } from "@/lib/account-data/buildEvaluation";
import {
  COMPLETION_TIERS,
  type SetGroup,
  evaluateAllBuilds,
  getTier,
  selectActiveBuildsForAccount,
} from "@/lib/account-data/buildEvaluation";
import { cn } from "@/lib/utils";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useTierStore } from "@/stores/useTierStore";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Combine,
  Minus,
} from "lucide-react";
import { useMemo, useState } from "react";

type SortDir = "asc" | "desc";
type RoleFilter = "all" | ArchetypeRole;
type TierFilter = "all" | string; // tier id or "all"

interface EvaluationViewProps {
  onOpenImport?: () => void;
  onShowTour?: () => void;
}

export function EvaluationView({
  onOpenImport,
  onShowTour,
}: EvaluationViewProps) {
  const { t } = useLanguage();
  const accountData = useActiveAccountData();
  const buildGroups = useAllResolvedBuilds();
  const hasAnyBuilds = buildGroups.some((g) => g.builds.some((b) => b.visible));
  const scoreConfig = useArtifactScoreStore((s) => s.config);

  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tierSort, setTierSort] = useState<SortDirection>("off");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [ownedOnly, setOwnedOnly] = useState(true);

  const tierAssignments = useTierStore((s) => s.tierAssignments);
  const hasTierData = Object.keys(tierAssignments).length > 0;
  const ownedKeys = useMemo(
    () => new Set(accountData?.characters.map((c) => c.key) ?? []),
    [accountData]
  );

  const activeBuildGroups = useMemo(() => {
    if (!accountData) return [];
    return selectActiveBuildsForAccount(buildGroups, accountData);
  }, [buildGroups, accountData]);

  const setGroups = useMemo(() => {
    if (!accountData) return [];
    const groups = evaluateAllBuilds(
      activeBuildGroups,
      accountData,
      scoreConfig.global,
      true
    );

    // Helper: best tier index for an evaluation's characters (lower = better)
    const bestTierIndex = (charIds: string[]): number => {
      let best = tiers.length; // worse than any real tier
      for (const id of charIds) {
        const a = tierAssignments[id];
        if (a) {
          const idx = tiers.indexOf(a.tier);
          if (idx !== -1 && idx < best) best = idx;
        }
      }
      return best;
    };

    // Sort evaluations within each group, then sort groups
    for (const g of groups) {
      g.evaluations.sort((a, b) => {
        // Tier sort first (if enabled)
        if (tierSort !== "off") {
          const ta = bestTierIndex(a.evalBuild.characterIds);
          const tb = bestTierIndex(b.evalBuild.characterIds);
          if (ta !== tb) return tierSort === "asc" ? tb - ta : ta - tb;
        }
        // Then score sort
        return sortDir === "desc"
          ? b.completeness - a.completeness
          : a.completeness - b.completeness;
      });
    }

    // Sort groups by their first evaluation's order (representative)
    if (tierSort !== "off") {
      groups.sort((a, b) => {
        const ta = bestTierIndex(
          a.evaluations[0]?.evalBuild.characterIds ?? []
        );
        const tb = bestTierIndex(
          b.evaluations[0]?.evalBuild.characterIds ?? []
        );
        if (ta !== tb) return tierSort === "asc" ? tb - ta : ta - tb;
        return sortDir === "desc"
          ? b.worstCompleteness - a.worstCompleteness
          : a.worstCompleteness - b.worstCompleteness;
      });
    } else if (sortDir === "desc") {
      groups.sort((a, b) => b.worstCompleteness - a.worstCompleteness);
    }

    return groups;
  }, [
    activeBuildGroups,
    accountData,
    scoreConfig.global,
    sortDir,
    tierSort,
    tierAssignments,
  ]);

  // Filter evaluations by role, tier, and ownership
  const filteredGroups = useMemo(() => {
    if (roleFilter === "all" && tierFilter === "all" && !ownedOnly)
      return setGroups;
    return setGroups
      .map((g) => ({
        ...g,
        evaluations: g.evaluations.filter(
          (e) =>
            (roleFilter === "all" ||
              e.evalBuild.archetypeRole === roleFilter) &&
            (tierFilter === "all" ||
              getTier(e.completeness).id === tierFilter) &&
            (!ownedOnly ||
              e.evalBuild.characterIds.some((id) => ownedKeys.has(id)))
        ),
      }))
      .filter((g) => g.evaluations.length > 0);
  }, [setGroups, roleFilter, tierFilter, ownedOnly, ownedKeys]);

  // Aggregate stats (from unfiltered data) — must be above early returns
  const { tierCounts, avgCompleteness, totalBuilds } = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    let sum = 0;
    for (const g of setGroups) {
      for (const e of g.evaluations) {
        const tier = getTier(e.completeness);
        counts[tier.id] = (counts[tier.id] || 0) + 1;
        sum += e.completeness;
        total++;
      }
    }
    return {
      tierCounts: counts,
      avgCompleteness: total > 0 ? sum / total : 0,
      totalBuilds: total,
    };
  }, [setGroups]);

  if (!accountData || !hasAnyBuilds) {
    return (
      <ScrollLayout>
        <AccountDataNeedsBothState
          needsAccountData={!accountData}
          needsBuilds={!hasAnyBuilds}
          onOpenImport={onOpenImport}
          onShowTour={onShowTour}
        />
      </ScrollLayout>
    );
  }

  return (
    <ScrollLayout
      header={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {/* Title + stats */}
          <h2 className="text-xl font-bold text-white">
            {t.ui("evaluation.title")}
          </h2>
          <span className="text-sm text-muted-foreground">
            {t.format(
              "evaluation.subtitle",
              totalBuilds,
              Math.round(avgCompleteness * 100)
            )}
          </span>

          <div className="flex items-center gap-1 flex-wrap">
            {COMPLETION_TIERS.map((tier) => {
              const count = tierCounts[tier.id];
              if (!count) return null;
              const isActive = tierFilter === tier.id;
              return (
                <button
                  type="button"
                  key={tier.id}
                  onClick={() =>
                    setTierFilter((f) => (f === tier.id ? "all" : tier.id))
                  }
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold transition-colors",
                    isActive
                      ? `ring-1 ring-white/30 ${tier.pillBg}`
                      : tier.pillBg,
                    !isActive && "opacity-80 hover:opacity-100"
                  )}
                >
                  {tier.label}
                  <span className="opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Spacer to push controls right */}
          <div className="flex-1" />

          {/* Role filter chips */}
          <div className="flex items-center gap-1">
            {(["all", "dps", "support"] as const).map((role) => (
              <button
                type="button"
                key={role}
                onClick={() => setRoleFilter(role)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-sm font-medium transition-colors",
                  roleFilter === role
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-foreground hover:bg-muted"
                )}
              >
                {role === "all" ? t.ui("evaluation.all") : t.role(role)}
              </button>
            ))}
          </div>

          {/* Owned-only filter */}
          <span className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox
              id="eval-owned-only"
              checked={ownedOnly}
              onCheckedChange={(v) => setOwnedOnly(v === true)}
              className="h-3.5 w-3.5"
            />
            <label
              htmlFor="eval-owned-only"
              className="text-sm text-foreground cursor-pointer"
            >
              {t.ui("evaluation.ownedOnly")}
            </label>
          </span>

          {/* Tier sort toggle — cycles off → desc → asc */}
          {hasTierData ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-sm text-foreground"
              onClick={() =>
                setTierSort((d) =>
                  d === "off" ? "desc" : d === "desc" ? "asc" : "off"
                )
              }
            >
              {tierSort === "off" ? (
                <Minus className="h-3.5 w-3.5" />
              ) : tierSort === "desc" ? (
                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
              )}
              {tierSort === "off"
                ? t.ui("evaluation.tierSortOff")
                : tierSort === "desc"
                  ? t.ui("evaluation.tierSortDesc")
                  : t.ui("evaluation.tierSortAsc")}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
                  disabled
                >
                  <Minus className="h-3.5 w-3.5" />
                  {t.ui("evaluation.tierSortOff")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.ui("filters.tierSortDisabled")}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Score sort toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-sm text-foreground"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDir === "asc" ? (
              <ArrowUpNarrowWide className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            )}
            {sortDir === "asc"
              ? t.ui("evaluation.sortAsc")
              : t.ui("evaluation.sortDesc")}
          </Button>
        </div>
      }
      bodyClassName="space-y-4"
    >
      {filteredGroups.map((group) => (
        <SetGroupSection key={group.artifactSet} group={group} />
      ))}
    </ScrollLayout>
  );
}

// Set Group Section

function SetGroupSection({
  group,
}: {
  group: SetGroup;
}) {
  const { t } = useLanguage();
  const is2p2 = group.artifactSet === "__2+2__";

  const worstTier = getTier(group.worstCompleteness);
  const worstPct = Math.round(group.worstCompleteness * 100);

  // Uniform card widths — cap max so single cards don't stretch to full row
  const gridClass =
    "grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(280px,320px))]";

  return (
    <div>
      {/* Set Header */}
      <div className="flex items-center gap-2 pb-1">
        {is2p2 ? (
          <Combine className="w-7 h-7 text-muted-foreground shrink-0" />
        ) : !is2p2 ? (
          <Tooltip>
            <TooltipTrigger>
              <ItemIcon artifactSetId={group.artifactSet} size="sm" />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="p-0 border-none bg-transparent"
            >
              <ArtifactTooltip setId={group.artifactSet} />
            </TooltipContent>
          </Tooltip>
        ) : null}
        <h3 className="text-lg font-bold text-white">
          {is2p2 ? t.ui("buildCard.2pc+2pc") : t.artifact(group.artifactSet)}
          <span
            className={cn(
              "text-sm font-normal tabular-nums ml-1.5",
              worstTier.text
            )}
          >
            ({worstPct}%+)
          </span>
        </h3>
        <div className="flex-1 border-b border-white/5 self-end mb-1" />
      </div>

      {/* Cards grid */}
      <div className={`grid gap-2 ${gridClass}`}>
        {group.evaluations.map((evaluation) => (
          <BuildEvaluationCard
            key={evaluation.evalBuild.key}
            evaluation={evaluation}
          />
        ))}
      </div>
    </div>
  );
}
