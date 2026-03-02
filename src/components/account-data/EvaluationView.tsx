import { BuildEvaluationCard } from "@/components/account-data/BuildEvaluationCard";
import { HeaderScrollLayout } from "@/components/layout/HeaderScrollLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById } from "@/data/constants";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import type { ArchetypeRole } from "@/lib/account-data/buildEvaluation";
import {
  COMPLETION_TIERS,
  type SetGroup,
  evaluateAllBuilds,
  getTier,
} from "@/lib/account-data/buildEvaluation";
import { cn } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BarChart3,
  Combine,
} from "lucide-react";
import { useMemo, useState } from "react";

type SortDir = "asc" | "desc";
type RoleFilter = "all" | ArchetypeRole;
type TierFilter = "all" | string; // tier id or "all"

export function EvaluationView() {
  const { t } = useLanguage();
  const { accountData } = useAccountStore();
  const buildGroups = useAllResolvedBuilds();
  const { config: scoreConfig } = useArtifactScoreStore();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const setGroups = useMemo(() => {
    if (!accountData) return [];
    const groups = evaluateAllBuilds(
      buildGroups,
      accountData,
      scoreConfig.global,
      true
    );

    // Apply sort direction
    if (sortDir === "desc") {
      groups.sort((a, b) => b.worstCompleteness - a.worstCompleteness);
      for (const g of groups) {
        g.evaluations.sort((a, b) => b.completeness - a.completeness);
      }
    }

    return groups;
  }, [buildGroups, accountData, scoreConfig.global, sortDir]);

  // Filter evaluations by role and tier
  const filteredGroups = useMemo(() => {
    let groups = setGroups;
    if (roleFilter !== "all") {
      groups = groups
        .map((g) => ({
          ...g,
          evaluations: g.evaluations.filter(
            (e) => e.evalBuild.archetypeRole === roleFilter
          ),
        }))
        .filter((g) => g.evaluations.length > 0);
    }
    if (tierFilter !== "all") {
      groups = groups
        .map((g) => ({
          ...g,
          evaluations: g.evaluations.filter(
            (e) => getTier(e.completeness).id === tierFilter
          ),
        }))
        .filter((g) => g.evaluations.length > 0);
    }
    return groups;
  }, [setGroups, roleFilter, tierFilter]);

  // Aggregate stats (from unfiltered data) — must be above early returns
  const allEvals = setGroups.flatMap((g) => g.evaluations);
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of allEvals) {
      const tier = getTier(e.completeness);
      counts[tier.id] = (counts[tier.id] || 0) + 1;
    }
    return counts;
  }, [allEvals]);
  const avgCompleteness =
    allEvals.reduce((s, e) => s + e.completeness, 0) / allEvals.length;

  if (!accountData) return null;

  if (setGroups.length === 0) {
    return (
      <ScrollLayout className="pb-10 mt-2">
        <div className="flex flex-col items-center pt-24 h-full p-4">
          <div className="flex flex-col items-center text-center space-y-4 max-w-lg">
            <BarChart3 className="w-12 h-12 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-bold text-foreground">
              {t.ui("evaluation.noBuilds")}
            </h3>
            <p className="text-muted-foreground">
              {t.ui("evaluation.noBuildsDesc")}
            </p>
          </div>
        </div>
      </ScrollLayout>
    );
  }

  return (
    <HeaderScrollLayout
      header={
        <div className="container flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
          {/* Title + stats */}
          <h2 className="text-lg font-bold text-white">
            {t.ui("evaluation.title")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t.format(
              "evaluation.subtitle",
              allEvals.length,
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
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors",
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
                  "px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                  roleFilter === role
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {role === "all" ? t.ui("evaluation.all") : t.role(role)}
              </button>
            ))}
          </div>

          {/* Sort toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
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
      bodyClassName="space-y-3 pb-10 pt-3"
    >
      {/* Set Groups */}
      {filteredGroups.map((group) => (
        <SetGroupSection
          key={group.artifactSet}
          group={group}
          isMobile={isMobile}
        />
      ))}
    </HeaderScrollLayout>
  );
}

// ---------------------------------------------------------------------------
// Set Group Section
// ---------------------------------------------------------------------------

function SetGroupSection({
  group,
  isMobile,
}: {
  group: SetGroup;
  isMobile: boolean;
}) {
  const { t } = useLanguage();
  const is2p2 = group.artifactSet === "__2+2__";
  const setInfo = !is2p2 ? artifactsById[group.artifactSet] : null;

  const worstTier = getTier(group.worstCompleteness);
  const worstPct = Math.round(group.worstCompleteness * 100);

  // Uniform card widths — cap max so single cards don't stretch to full row
  const gridClass = isMobile
    ? "grid-cols-1"
    : "grid-cols-[repeat(auto-fill,minmax(280px,360px))]";

  return (
    <div>
      {/* Set Header */}
      <div className="flex items-center gap-2 pb-1">
        {is2p2 ? (
          <Combine className="w-7 h-7 text-muted-foreground shrink-0" />
        ) : setInfo ? (
          <Tooltip>
            <TooltipTrigger>
              <ItemIcon
                imagePath={setInfo.imagePaths.flower}
                rarity={setInfo.rarity}
                size="sm"
              />
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
