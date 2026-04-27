/**
 * Dedicated page for resource spending suggestions (craft / reroll / level-up).
 * Computes suggestions from evaluation data and displays them grouped by tier.
 */

import { CircleHelp, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AccountDataNeedsBothState } from "@/components/account-data/AccountDataNeedsBothState";
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
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
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
} from "@/lib/account-data/resourceTips";
import { getAssetUrl } from "@/lib/utils";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { usePUpgradeCacheStore } from "@/stores/usePUpgradeCacheStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
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
  const accountData = useActiveAccountData();
  const buildGroups = useAllResolvedBuilds();
  const hasAnyBuilds = buildGroups.some((g) => g.builds.some((b) => b.visible));
  const scoreConfig = useArtifactScoreStore((s) => s.config);
  const tierAssignments = useTierStore((s) => s.tierAssignments);
  const tierCustomization = useTierStore((s) => s.tierCustomization);
  const recThresholds = useResourceRecStore((s) => s.thresholds);
  const recMinScoreDiff = useResourceRecStore((s) => s.minScoreDiff);
  const showCraft = useResourceRecStore((s) => s.showCraft);
  const showReroll = useResourceRecStore((s) => s.showReroll);
  const showLevelup = useResourceRecStore((s) => s.showLevelup);
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
  const [helpOpen, setHelpOpen] = useState(false);

  // Filter by kind toggles, group by tier
  const filteredSuggestions = suggestions.filter(
    (s) =>
      ((s.kind === "craft" && showCraft) ||
        (s.kind === "reroll" && showReroll) ||
        (s.kind === "levelup" && showLevelup)) &&
      setCategoryFilters[getResourceSetCategory(s.setId)]
  );
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">
              {t.ui("evaluation.resourceSuggestions")}
            </h2>
            <span className="text-sm text-muted-foreground">
              ({suggestions.length})
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              <CircleHelp className="size-4" />
            </button>
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
