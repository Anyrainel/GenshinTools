import { ArrowDownWideNarrow, ArrowUpNarrowWide, Combine } from "lucide-react";
import { useMemo, useState } from "react";
import { AccountDataHelpButton } from "@/components/game-account/AccountDataHelpButton";
import { AccountDataNeedsBothState } from "@/components/game-account/AccountDataNeedsBothState";
import { AccountDataSourceAgeBadge } from "@/components/game-account/AccountDataSourceAge";
import { BuildEvaluationCard } from "@/components/game-account/BuildEvaluationCard";
import { EvaluationHelpDialog } from "@/components/game-account/EvaluationHelpDialog";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CategoryChip } from "@/components/shared/CategoryChip";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ARTIFACT_SET_CATEGORIES,
  type ArtifactSetCategory,
  getArtifactSetCategory,
} from "@/domain/build/artifact/setCategory";
import type { Tier } from "@/domain/enums";
import { tiers } from "@/domain/enums";
import {
  COMPLETION_TIERS,
  type CompletionTier,
  evaluateAllBuilds,
  getTier,
  type SetGroup,
  selectActiveBuildsForAccount,
} from "@/domain/game-account/buildEvaluation";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { cn } from "@/lib/utils";
import {
  selectActiveTierAssignments,
  selectActiveTierCustomization,
} from "@/stores/createTierStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import {
  selectEnabledBuildGroups,
  useBuildsStore,
} from "@/stores/useBuildsStore";
import { useTierStore } from "@/stores/useTierStore";

type SortDir = "asc" | "desc";

interface EvaluationViewProps {
  onOpenImport?: () => void;
  onShowTour?: () => void;
}

export function EvaluationView({
  onOpenImport,
  onShowTour,
}: EvaluationViewProps) {
  const { t } = useLanguage();
  const activeAccount = useActiveAccount();
  const accountData = activeAccount?.data ?? null;
  const buildGroups = useBuildsStore(selectEnabledBuildGroups);
  const hasAnyBuilds = buildGroups.length > 0;
  const scoreConfig = useArtifactScoreStore((s) => s.config);

  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [setCategoryFilter, setSetCategoryFilter] = useState<
    Set<ArtifactSetCategory>
  >(new Set());
  const [characterTierFilter, setCharacterTierFilter] = useState<Set<Tier>>(
    new Set()
  );
  const [scoreFilter, setScoreFilter] = useState<Set<CompletionTier>>(
    new Set()
  );
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  const tierAssignments = useTierStore(selectActiveTierAssignments);
  const tierCustomization = useTierStore(selectActiveTierCustomization);
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
    return evaluateAllBuilds(
      activeBuildGroups,
      accountData,
      scoreConfig.global,
      true
    );
  }, [activeBuildGroups, accountData, scoreConfig.global]);

  // A merged build must have one character matching both character filters.
  const consideredGroups = useMemo(() => {
    return setGroups
      .filter(
        (group) =>
          setCategoryFilter.size === 0 ||
          setCategoryFilter.has(getArtifactSetCategory(group.artifactSet))
      )
      .map((g) => ({
        ...g,
        evaluations: g.evaluations.filter((e) =>
          e.evalBuild.characterIds.some(
            (id) =>
              (!ownedOnly || ownedKeys.has(id)) &&
              (!hasTierData ||
                characterTierFilter.size === 0 ||
                characterTierFilter.has(tierAssignments[id]?.tier ?? "Pool"))
          )
        ),
      }))
      .filter((g) => g.evaluations.length > 0);
  }, [
    setGroups,
    setCategoryFilter,
    characterTierFilter,
    ownedOnly,
    ownedKeys,
    hasTierData,
    tierAssignments,
  ]);

  // Keep score counts stable while choosing score buckets.
  const { tierCounts, avgCompleteness, totalBuilds } = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    let sum = 0;
    for (const g of consideredGroups) {
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
  }, [consideredGroups]);

  const filteredGroups = useMemo(() => {
    const direction = sortDir === "desc" ? -1 : 1;
    return consideredGroups
      .map((group) => {
        const evaluations = group.evaluations
          .filter(
            (evaluation) =>
              scoreFilter.size === 0 ||
              scoreFilter.has(getTier(evaluation.completeness))
          )
          .sort((a, b) => direction * (a.completeness - b.completeness));
        return {
          ...group,
          evaluations,
          worstCompleteness: Math.min(
            ...evaluations.map((evaluation) => evaluation.completeness)
          ),
        };
      })
      .filter((group) => group.evaluations.length > 0)
      .sort((a, b) => direction * (a.worstCompleteness - b.worstCompleteness));
  }, [consideredGroups, scoreFilter, sortDir]);

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
        <div className="w-full space-y-3 pb-2">
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 className="text-xl font-bold text-foreground">
              {t.ui("evaluation.title")}
            </h2>
            <AccountDataHelpButton
              label={t.ui("buttons.help")}
              onClick={() => setHelpOpen(true)}
            />
            <AccountDataSourceAgeBadge lastUpdate={activeAccount?.lastUpdate} />
            <span className="text-sm text-muted-foreground">
              {t.format(
                "evaluation.subtitle",
                totalBuilds,
                Math.round(avgCompleteness * 100)
              )}
            </span>
          </div>

          <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="shrink-0 text-sm font-medium text-foreground">
                {t.ui("evaluation.setsLabel")}:
              </span>
              {ARTIFACT_SET_CATEGORIES.map((category) => (
                <CategoryChip
                  key={category}
                  active={
                    setCategoryFilter.size === 0 ||
                    setCategoryFilter.has(category)
                  }
                  onClick={() =>
                    setSetCategoryFilter((previous) => {
                      const next = new Set(previous);
                      if (next.has(category)) next.delete(category);
                      else next.add(category);
                      return next;
                    })
                  }
                  color={
                    category === "support"
                      ? "lime"
                      : category === "other"
                        ? "amber"
                        : "sky"
                  }
                >
                  {category === "support"
                    ? t.ui("tierList.supportSet")
                    : category === "other"
                      ? t.ui("tierList.otherSet")
                      : t.ui("tierList.dpsSet")}
                </CategoryChip>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="shrink-0 text-sm font-medium text-foreground">
                {t.ui("accountData.characters")}:
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-pointer select-none items-center gap-1.5">
                    <Checkbox
                      id="eval-owned-only"
                      checked={ownedOnly}
                      onCheckedChange={(v) => setOwnedOnly(v === true)}
                      className="h-3.5 w-3.5"
                    />
                    <label
                      htmlFor="eval-owned-only"
                      className="cursor-pointer text-sm text-foreground"
                    >
                      {t.ui("evaluation.ownedOnly")}
                    </label>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t.ui("filters.ownedOnlyAccountDataTooltip")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <FilterChipGroup
                      label={t.ui("filters.sortByTier")}
                      options={tiers}
                      selectedValues={characterTierFilter}
                      onSelectedValuesChange={setCharacterTierFilter}
                      getKey={(tier) => tier}
                      getLabel={(tier) =>
                        tierCustomization[tier]?.displayName || t.tier(tier)
                      }
                      disabled={!hasTierData}
                      className="px-0"
                    />
                  </div>
                </TooltipTrigger>
                {!hasTierData && (
                  <TooltipContent>
                    <p>{t.ui("filters.tierSortDisabled")}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <FilterChipGroup
              label={t.ui("accountData.score")}
              options={COMPLETION_TIERS}
              selectedValues={scoreFilter}
              onSelectedValuesChange={setScoreFilter}
              getKey={(tier) => tier.id}
              getLabel={(tier, active) => (
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    active && tier.text
                  )}
                >
                  {tier.label}{" "}
                  <span className="tabular-nums">
                    {tierCounts[tier.id] ?? 0}
                  </span>
                </span>
              )}
              className="px-0"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-sm text-foreground"
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
        </div>
      }
      bodyClassName="space-y-4"
    >
      {filteredGroups.length > 0 ? (
        filteredGroups.map((group) => (
          <SetGroupSection key={group.artifactSet} group={group} />
        ))
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t.ui("common.noResults")}
        </p>
      )}
      <EvaluationHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ScrollLayout>
  );
}

// Set Group Section

function SetGroupSection({ group }: { group: SetGroup }) {
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
