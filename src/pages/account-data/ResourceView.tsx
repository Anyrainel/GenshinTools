import {
  selectActiveTierAssignments,
  selectActiveTierCustomization,
} from "@/stores/createTierStore";
/**
 * Dedicated page for resource spending suggestions (craft / reroll / level-up).
 * Computes suggestions from evaluation data and displays them grouped by tier.
 */

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AccountDataHelpButton } from "@/components/account-data/AccountDataHelpButton";
import { AccountDataNeedsBothState } from "@/components/account-data/AccountDataNeedsBothState";
import { AccountDataSourceAgeBadge } from "@/components/account-data/AccountDataSourceAge";
import { ResourceHelpDialog } from "@/components/account-data/ResourceHelpDialog";
import { ResourceTierSection } from "@/components/account-data/ResourceTierSection";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { CategoryChip } from "@/components/shared/CategoryChip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  TIER_LIST_OTHER_ARTIFACT_SETS,
  TIER_LIST_SUPPORT_ARTIFACT_SETS,
} from "@/data/constants";
import type { Tier } from "@/data/enums";
import { tiers } from "@/data/enums";
import { artifactsById } from "@/data/gameResources";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import {
  evaluateAllBuilds,
  filterOwnedBuildGroups,
  selectActiveBuildsForAccount,
} from "@/lib/account-data/buildEvaluation";
import {
  computeSuggestionPUpgrade,
  generateResourceSuggestions,
  hashGlobalConfig,
  type ResourceKind,
  type ResourceSuggestion,
  suggestionCacheKey,
  summarizeResourceSuggestionsBySet,
} from "@/lib/account-data/resourceTips";
import { cn, getAssetUrl } from "@/lib/utils";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import {
  selectValidResolvedBuildGroups,
  useBuildsStore,
} from "@/stores/useBuildsStore";
import { usePUpgradeCacheStore } from "@/stores/usePUpgradeCacheStore";
import {
  getResourceRecSettingsForProfile,
  useResourceRecStore,
} from "@/stores/useResourceRecStore";
import { useTierStore } from "@/stores/useTierStore";

type ResourceSetCategory = "dps" | "support" | "other";

const RESOURCE_SET_CATEGORIES: ResourceSetCategory[] = [
  "dps",
  "support",
  "other",
];

const RESOURCE_KIND_ICONS: Record<ResourceKind, string> = {
  craft: "/assets/craft.webp",
  reroll: "/assets/reroll.webp",
  levelup: "/assets/upgrde.webp",
};

function getResourceSetCategory(setId: string): ResourceSetCategory {
  if (TIER_LIST_SUPPORT_ARTIFACT_SETS.has(setId)) return "support";
  if (
    TIER_LIST_OTHER_ARTIFACT_SETS.has(setId) ||
    artifactsById[setId]?.rarity === 4
  ) {
    return "other";
  }
  return "dps";
}

function getResourceSetCategoryLabel(
  category: ResourceSetCategory,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  if (category === "support") return t.ui("tierList.supportSet");
  if (category === "other") return t.ui("tierList.otherSet");
  return t.ui("tierList.dpsSet");
}

function ResourceKindToggle({
  kind,
  label,
  checked,
  count,
  onCheckedChange,
}: {
  kind: ResourceKind;
  label: string;
  checked: boolean;
  count: number;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a Radix primitive wrapping an input
    <label className="flex items-center gap-1.5 md:gap-2.5 cursor-pointer select-none rounded-lg border border-border/50 bg-gradient-card px-2 py-1.5 md:px-3 md:py-2 hover:bg-muted/30 transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="h-3 w-3 md:h-4 md:w-4"
      />
      <img
        src={getAssetUrl(RESOURCE_KIND_ICONS[kind])}
        alt=""
        className="w-5 h-5 md:w-7 md:h-7"
        aria-hidden="true"
      />
      <span className="text-xs md:text-sm font-medium text-foreground">
        {label}
      </span>
      <span className="hidden md:inline text-sm text-foreground font-mono ml-auto">
        {count}
      </span>
    </label>
  );
}

// ─── Main View ───────────────────────────────────────────────────

interface ResourceViewProps {
  onOpenImport?: () => void;
  onShowTour?: () => void;
}

export function ResourceView({ onOpenImport, onShowTour }: ResourceViewProps) {
  const { t } = useLanguage();
  const activeAccount = useActiveAccount();
  const accountData = activeAccount?.data ?? null;
  const buildGroups = useBuildsStore(selectValidResolvedBuildGroups);
  const hasAnyBuilds = buildGroups.some((g) => g.builds.some((b) => b.visible));
  const scoreConfig = useArtifactScoreStore((s) => s.config);
  const tierAssignments = useTierStore(selectActiveTierAssignments);
  const tierCustomization = useTierStore(selectActiveTierCustomization);
  const recSettings = useResourceRecStore((s) =>
    getResourceRecSettingsForProfile(s, activeAccount?.id ?? null)
  );
  const {
    thresholds: recThresholds,
    minScoreDiff: recMinScoreDiff,
    showCraft,
    showReroll,
    showLevelup,
  } = recSettings;
  const setShowCraft = useResourceRecStore((s) => s.setShowCraft);
  const setShowReroll = useResourceRecStore((s) => s.setShowReroll);
  const setShowLevelup = useResourceRecStore((s) => s.setShowLevelup);
  const setThreshold = useResourceRecStore((s) => s.setThreshold);
  const setMinScoreDiff = useResourceRecStore((s) => s.setMinScoreDiff);

  const globalConfig = useArtifactScoreStore((s) => s.config.global);
  const globalConfigHash = useMemo(
    () => hashGlobalConfig(globalConfig),
    [globalConfig]
  );
  const clearPUpgradeCache = usePUpgradeCacheStore((s) => s.clear);
  const [recomputeTrigger, setRecomputeTrigger] = useState(0);

  const activeBuildGroups = useMemo(() => {
    if (!accountData) return [];
    return selectActiveBuildsForAccount(buildGroups, accountData);
  }, [buildGroups, accountData]);

  const suggestions = useMemo(() => {
    if (!accountData) return [];
    const ownedGroups = filterOwnedBuildGroups(activeBuildGroups, accountData);
    const ownedSetGroups = evaluateAllBuilds(
      ownedGroups,
      accountData,
      scoreConfig.global,
      true
    );
    return generateResourceSuggestions(
      ownedSetGroups,
      accountData,
      tierAssignments,
      recThresholds,
      recMinScoreDiff,
      scoreConfig.global
    );
  }, [
    activeBuildGroups,
    accountData,
    tierAssignments,
    recThresholds,
    recMinScoreDiff,
    scoreConfig.global,
  ]);

  // Async pUpgrade scheduler
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputeTrigger intentionally re-fires the effect when cache is cleared
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const s of suggestions) {
        if (cancelled) return;
        const key = suggestionCacheKey(s, globalConfigHash);
        if (usePUpgradeCacheStore.getState().cache.has(key)) continue;
        await new Promise((r) => setTimeout(r, 0));
        if (cancelled) return;
        const value = computeSuggestionPUpgrade(s, globalConfig);
        usePUpgradeCacheStore.getState().set(key, value);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suggestions, globalConfig, globalConfigHash, recomputeTrigger]);

  const craftCount = suggestions.filter((s) => s.kind === "craft").length;
  const rerollCount = suggestions.filter((s) => s.kind === "reroll").length;
  const levelupCount = suggestions.filter((s) => s.kind === "levelup").length;

  const [collapsedTiers, setCollapsedTiers] = useState<Set<Tier>>(
    () => new Set()
  );
  const [setCategoryFilters, setSetCategoryFilters] = useState<
    Record<ResourceSetCategory, boolean>
  >({
    dps: true,
    support: true,
    other: true,
  });
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const categoryFilteredSuggestions = suggestions.filter(
    (s) =>
      ((s.kind === "craft" && showCraft) ||
        (s.kind === "reroll" && showReroll) ||
        (s.kind === "levelup" && showLevelup)) &&
      setCategoryFilters[getResourceSetCategory(s.setId)]
  );
  const setSummaries = useMemo(
    () => summarizeResourceSuggestionsBySet(categoryFilteredSuggestions),
    [categoryFilteredSuggestions]
  );
  const activeSetId = setSummaries.some(
    (summary) => summary.setId === selectedSetId
  )
    ? selectedSetId
    : null;
  const filteredSuggestions = activeSetId
    ? categoryFilteredSuggestions.filter((s) => s.setId === activeSetId)
    : categoryFilteredSuggestions;
  const byTier = new Map<Tier, ResourceSuggestion[]>();
  for (const tier of tiers) byTier.set(tier as Tier, []);
  for (const s of filteredSuggestions) {
    const arr = byTier.get(s.tier) ?? [];
    arr.push(s);
    byTier.set(s.tier, arr);
  }

  const editableTiers: Tier[] = ["S", "A", "B", "C", "D"];
  const allTiers: Tier[] = ["S", "A", "B", "C", "D", "Pool"];

  const toggleTierCollapsed = (tier: Tier) => {
    setCollapsedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };
  const toggleSetCategoryFilter = (category: ResourceSetCategory) => {
    setSetCategoryFilters((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

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
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 pb-2">
            <h2 className="text-xl font-bold text-white">
              {t.ui("evaluation.resourceSuggestions")}
            </h2>
            <AccountDataHelpButton
              label={t.ui("buttons.help")}
              onClick={() => setHelpOpen(true)}
            />
            <AccountDataSourceAgeBadge lastUpdate={activeAccount?.lastUpdate} />
            <span className="text-sm text-muted-foreground">
              ({suggestions.length})
            </span>
            <div className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearPUpgradeCache();
                setRecomputeTrigger((n) => n + 1);
              }}
              className="gap-1 text-foreground"
            >
              <RefreshCw className="w-4 h-4" />
              {t.ui("evaluation.reassess")}
            </Button>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
            <ResourceKindToggle
              kind="levelup"
              label={t.ui("evaluation.sanctifyingEssence")}
              checked={showLevelup}
              count={levelupCount}
              onCheckedChange={setShowLevelup}
            />
            <ResourceKindToggle
              kind="craft"
              label={t.ui("evaluation.sanctifyingElixir")}
              checked={showCraft}
              count={craftCount}
              onCheckedChange={setShowCraft}
            />
            <ResourceKindToggle
              kind="reroll"
              label={t.ui("evaluation.dustOfEnlightenment")}
              checked={showReroll}
              count={rerollCount}
              onCheckedChange={setShowReroll}
            />
            <div className="flex items-center gap-1.5 flex-wrap ml-2 md:ml-4 lg:ml-6">
              {RESOURCE_SET_CATEGORIES.map((category) => (
                <CategoryChip
                  key={category}
                  active={setCategoryFilters[category]}
                  onClick={() => toggleSetCategoryFilter(category)}
                  color={
                    category === "support"
                      ? "lime"
                      : category === "other"
                        ? "amber"
                        : "sky"
                  }
                >
                  {getResourceSetCategoryLabel(category, t)}
                </CategoryChip>
              ))}
            </div>
          </div>
          {setSummaries.length > 1 && (
            <fieldset
              aria-label={t.ui("evaluation.setFilterLabel")}
              className="scrollbar-none m-0 flex min-w-0 items-center gap-1.5 overflow-x-scroll border-0 p-0 pb-1"
            >
              <button
                type="button"
                aria-pressed={activeSetId === null}
                onClick={() => setSelectedSetId(null)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeSetId === null
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background/40 text-foreground hover:bg-muted/50"
                )}
              >
                {t.ui("evaluation.all")}
              </button>
              {setSummaries.map((summary) => {
                const isActive = activeSetId === summary.setId;
                const artifactSet = artifactsById[summary.setId];
                return (
                  <button
                    key={summary.setId}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setSelectedSetId(isActive ? null : summary.setId)
                    }
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-background/40 text-foreground hover:bg-muted/50"
                    )}
                  >
                    {artifactSet && (
                      <img
                        src={getAssetUrl(artifactSet.imagePaths.flower)}
                        alt=""
                        aria-hidden="true"
                        className="h-6 w-6 rounded-full object-cover"
                        draggable={false}
                      />
                    )}
                    <span>{t.artifact(summary.setId)}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {summary.count}
                    </span>
                  </button>
                );
              })}
            </fieldset>
          )}
        </div>
      }
      bodyClassName="space-y-4"
    >
      {filteredSuggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic pt-4">
          {t.ui("evaluation.noSuggestions")}
        </p>
      ) : null}
      {allTiers.map((tier) => {
        const tierSuggestions = byTier.get(tier) ?? [];
        if (tier === "Pool" && tierSuggestions.length === 0) return null;
        const editable = editableTiers.includes(tier);
        const tierLabel =
          tierCustomization[tier]?.displayName ||
          (tier === "Pool"
            ? t.tier(tier)
            : `${t.ui("filters.sortByTier")} ${tier}`);
        return (
          <ResourceTierSection
            key={tier}
            tier={tier}
            tierLabel={tierLabel}
            suggestions={tierSuggestions}
            collapsed={collapsedTiers.has(tier)}
            onToggleCollapsed={() => toggleTierCollapsed(tier)}
            editable={editable}
            threshold={editable ? recThresholds[tier] : undefined}
            minScoreCraft={editable ? recMinScoreDiff.craft[tier] : undefined}
            minScoreReroll={editable ? recMinScoreDiff.reroll[tier] : undefined}
            minScoreLevelup={
              editable ? recMinScoreDiff.levelup[tier] : undefined
            }
            onChangeThreshold={
              editable ? (v) => setThreshold(tier, v) : undefined
            }
            showCraft={showCraft}
            showReroll={showReroll}
            showLevelup={showLevelup}
            onChangeMinScore={
              editable ? (kind, v) => setMinScoreDiff(kind, tier, v) : undefined
            }
            globalConfigHash={globalConfigHash}
          />
        );
      })}
      <ResourceHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ScrollLayout>
  );
}
