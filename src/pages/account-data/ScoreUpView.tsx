import { ArrowUpRight, Info, Loader2, Monitor, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AccountDataHelpButton } from "@/components/account-data/AccountDataHelpButton";
import { AccountDataNeedsBothState } from "@/components/account-data/AccountDataNeedsBothState";
import { AccountDataSourceAgeBadge } from "@/components/account-data/AccountDataSourceAge";
import { ScoreUpHelpDialog } from "@/components/account-data/RecommendationHelpDialog";
import { ScoreUpCard } from "@/components/account-data/ScoreUpCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ArtifactManagerDialog } from "@/components/shared/ArtifactManagerDialog";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LuckExpectation, Tier } from "@/data/enums";
import { allSlots, LUCK_MULTIPLIERS, tiers } from "@/data/enums";
import { charactersById } from "@/data/gameResources";
import type { CharacterData, TierCustomization } from "@/data/types";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useAsyncScoreUp } from "@/hooks/useAsyncRecommendations";
import { buildScoreUpEquipInstructions } from "@/lib/account-data/manager/instructions";
import {
  buildArtifactLookup,
  type CharacterActions,
  recomputeTierUpgrades,
  type ScoreUpAction,
} from "@/lib/account-data/scoreUpEngine";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import {
  selectActiveTierAssignments,
  selectActiveTierCustomization,
} from "@/stores/createTierStore";
import {
  selectValidResolvedBuildGroups,
  useBuildsStore,
} from "@/stores/useBuildsStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useScoreUpCacheStore } from "@/stores/useScoreUpCacheStore";
import {
  getScoreUpSettingsForProfile,
  useScoreUpSettingsStore,
} from "@/stores/useScoreUpSettingsStore";
import { useTierStore } from "@/stores/useTierStore";

interface ScoreUpViewProps {
  scores: Record<string, ArtifactScoreResult | null>;
  onOpenImport?: () => void;
  onShowTour?: () => void;
}

const APPLY_RECOMMENDATION_TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const EMPTY_PROTECTED_ARTIFACT_IDS: readonly string[] = [];

type ApplyTarget =
  | { type: "tiers" }
  | {
      type: "character";
      characterId: string;
      allocatedBuild: NonNullable<CharacterActions["allocatedBuild"]>;
    };

export function ScoreUpView({
  scores,
  onOpenImport,
  onShowTour,
}: ScoreUpViewProps) {
  const { t } = useLanguage();
  const activeAccount = useActiveAccount();
  const accountData = activeAccount?.data ?? null;
  const buildGroups = useBuildsStore(selectValidResolvedBuildGroups);
  const hasAnyBuilds = buildGroups.some((g) => g.builds.some((b) => b.visible));
  const tierAssignments = useTierStore(selectActiveTierAssignments);
  const tierCustomization = useTierStore(selectActiveTierCustomization);
  const scoreUpSettings = useScoreUpSettingsStore((s) =>
    getScoreUpSettingsForProfile(s, activeAccount?.id ?? null)
  );
  const setAllowPoolArtifactSteals = useScoreUpSettingsStore(
    (s) => s.setAllowPoolArtifactSteals
  );
  const setRespectFrozenArtifacts = useScoreUpSettingsStore(
    (s) => s.setRespectFrozenArtifacts
  );
  const setTierLuckExpectation = useScoreUpSettingsStore(
    (s) => s.setTierLuckExpectation
  );
  const {
    allowPoolArtifactSteals,
    respectFrozenArtifacts,
    luckExpectationByTier,
  } = scoreUpSettings;
  const standaloneFrozenArtifactIds = useFreezeStore(
    (s) => s.frozenArtifactIds
  );
  const frozenTeamLoadouts = useFreezeStore((s) => s.frozenTeamLoadouts);
  const frozenArtifactIdsForRecommendations = useMemo(() => {
    const ids = new Set(standaloneFrozenArtifactIds);
    for (const loadout of Object.values(frozenTeamLoadouts)) {
      for (const charId of loadout.frozenCharIds) {
        const slotIds = loadout.artifactIdsByChar[charId] ?? {};
        for (const slot of allSlots) {
          const id = slotIds[slot];
          if (id) ids.add(id);
        }
      }
    }
    return Array.from(ids).sort();
  }, [standaloneFrozenArtifactIds, frozenTeamLoadouts]);
  const protectedArtifactIds = respectFrozenArtifacts
    ? frozenArtifactIdsForRecommendations
    : EMPTY_PROTECTED_ARTIFACT_IDS;
  const tierLuckCustomization = useMemo<TierCustomization>(
    () =>
      Object.fromEntries(
        tiers.map((tier) => [
          tier,
          {
            ...tierCustomization[tier],
            luckExpectation: luckExpectationByTier[tier],
          },
        ])
      ) as TierCustomization,
    [tierCustomization, luckExpectationByTier]
  );
  const allocationOptions = useMemo(
    () => ({ allowPoolArtifactSteals, protectedArtifactIds }),
    [allowPoolArtifactSteals, protectedArtifactIds]
  );
  const {
    recommendations: allRecs,
    progress,
    isComputing,
    error: recommendationError,
    start: startRecommendations,
    stop: stopRecommendations,
  } = useAsyncScoreUp();
  const cacheVersion = useScoreUpCacheStore((s) => s.version);
  const cacheGet = useScoreUpCacheStore((s) => s.get);
  const cacheSet = useScoreUpCacheStore((s) => s.set);
  const cacheClearKey = useScoreUpCacheStore((s) => s.clearKey);
  const [activeRunKey, setActiveRunKey] = useState<string | null>(null);
  const [recalculateNonce, setRecalculateNonce] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [equipDialogOpen, setEquipDialogOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ApplyTarget>({
    type: "tiers",
  });
  const [selectedApplyTiers, setSelectedApplyTiers] = useState<Tier[]>(
    APPLY_RECOMMENDATION_TIERS
  );

  const recommendationCacheKey = useMemo(() => {
    if (!activeAccount || !accountData || !hasAnyBuilds) return null;
    return `recommendations:${hashString(
      JSON.stringify({
        accountId: activeAccount.id,
        accountData,
        scores,
        tierAssignments,
        allowPoolArtifactSteals,
        respectFrozenArtifacts,
        protectedArtifactIds,
      })
    )}`;
  }, [
    activeAccount,
    accountData,
    allowPoolArtifactSteals,
    respectFrozenArtifacts,
    protectedArtifactIds,
    hasAnyBuilds,
    scores,
    tierAssignments,
  ]);

  const cachedRecommendations = recommendationCacheKey
    ? cacheGet(recommendationCacheKey)
    : undefined;
  void cacheVersion;

  useEffect(() => {
    void recalculateNonce;
    if (!accountData || !hasAnyBuilds || !recommendationCacheKey) {
      stopRecommendations();
      setActiveRunKey(null);
      return;
    }

    if (useScoreUpCacheStore.getState().get(recommendationCacheKey)) {
      stopRecommendations();
      setActiveRunKey(null);
      return;
    }

    setActiveRunKey(recommendationCacheKey);
    startRecommendations({
      accountData,
      scores,
      tierAssignments,
      tierCustomization: tierLuckCustomization,
      options: allocationOptions,
    });

    return stopRecommendations;
  }, [
    accountData,
    hasAnyBuilds,
    recommendationCacheKey,
    recalculateNonce,
    scores,
    tierAssignments,
    tierLuckCustomization,
    allocationOptions,
    startRecommendations,
    stopRecommendations,
  ]);

  useEffect(() => {
    if (
      !recommendationCacheKey ||
      activeRunKey !== recommendationCacheKey ||
      isComputing ||
      !allRecs
    ) {
      return;
    }

    cacheSet(recommendationCacheKey, {
      recommendations: allRecs,
      progress,
    });
  }, [
    recommendationCacheKey,
    activeRunKey,
    isComputing,
    allRecs,
    progress,
    cacheSet,
  ]);

  const displayedRecommendations =
    cachedRecommendations?.recommendations ??
    (activeRunKey === recommendationCacheKey ? allRecs : null);
  const displayedProgress =
    cachedRecommendations?.progress ??
    (activeRunKey === recommendationCacheKey
      ? progress
      : {
          completedTierCount: 0,
          totalTierCount: 0,
          currentTier: null,
        });
  const isCalculating = isComputing && activeRunKey === recommendationCacheKey;

  const handleTierLuckExpectationChange = useCallback(
    (tier: Tier, value: string) => {
      if (!value) return;
      const luckExpectation = value as LuckExpectation;
      if (
        accountData &&
        recommendationCacheKey &&
        displayedRecommendations &&
        !isCalculating
      ) {
        const recommendations = recomputeTierUpgrades(
          displayedRecommendations,
          accountData,
          tierAssignments,
          tier,
          luckExpectation,
          allocationOptions
        );
        cacheSet(recommendationCacheKey, {
          recommendations,
          progress: displayedProgress,
        });
      }
      setTierLuckExpectation(tier, luckExpectation);
    },
    [
      accountData,
      recommendationCacheKey,
      displayedRecommendations,
      tierAssignments,
      isCalculating,
      allocationOptions,
      cacheSet,
      displayedProgress,
      setTierLuckExpectation,
    ]
  );

  const handleRecalculate = () => {
    if (!recommendationCacheKey) return;
    cacheClearKey(recommendationCacheKey);
    setActiveRunKey(null);
    setRecalculateNonce((n) => n + 1);
  };

  // Build artifact lookup for resolving recommendation artifact IDs
  const artifactLookup = useMemo(
    () => (accountData ? buildArtifactLookup(accountData) : new Map()),
    [accountData]
  );

  // Group characters by tier, sorted by max recommendation impact
  const charactersByTier = useMemo(() => {
    if (!accountData || !displayedRecommendations) return {};

    const byTier: Record<
      string,
      {
        char: CharacterData;
        scoreResult: ArtifactScoreResult;
        recommendations: ScoreUpAction[];
        allocatedBuild: CharacterActions["allocatedBuild"];
        allocationStatus: "pending" | "allocated" | "unallocated";
      }[]
    > = {};
    for (const tier of tiers) {
      byTier[tier] = [];
    }

    for (const char of accountData.characters) {
      const scoreResult = scores[char.key];
      if (!scoreResult) continue;

      const assignment = tierAssignments[char.key];
      const tier = assignment ? assignment.tier : "Pool";

      const charRecs = displayedRecommendations.perCharacter[char.key];
      const recommendations = charRecs?.actions ?? [];
      const allocatedBuild = charRecs?.allocatedBuild ?? null;
      const allocationStatus =
        !charRecs && isCalculating
          ? "pending"
          : allocatedBuild
            ? "allocated"
            : "unallocated";

      if (!byTier[tier]) {
        if (!byTier.Pool) byTier.Pool = [];
        byTier.Pool.push({
          char,
          scoreResult,
          recommendations,
          allocatedBuild,
          allocationStatus,
        });
      } else {
        byTier[tier].push({
          char,
          scoreResult,
          recommendations,
          allocatedBuild,
          allocationStatus,
        });
      }
    }

    // Sort by max buildScoreDiff (highest improvement potential first)
    for (const tier of Object.keys(byTier)) {
      byTier[tier].sort((a, b) => {
        const aMax = Math.max(
          0,
          ...a.recommendations.map((r) => r.buildScoreDiff)
        );
        const bMax = Math.max(
          0,
          ...b.recommendations.map((r) => r.buildScoreDiff)
        );
        return bMax - aMax;
      });
    }

    return byTier;
  }, [
    accountData,
    scores,
    tierAssignments,
    displayedRecommendations,
    isCalculating,
  ]);

  const selectedApplyTierSet = useMemo(
    () => new Set(selectedApplyTiers),
    [selectedApplyTiers]
  );

  const recommendationAllocationsForApply = useMemo(() => {
    if (!displayedRecommendations) return [];
    return Object.values(displayedRecommendations.perCharacter)
      .filter(
        (entry) =>
          selectedApplyTierSet.has(entry.tier) && entry.allocatedBuild !== null
      )
      .map((entry) => ({
        characterId: entry.characterId,
        allocatedBuild: entry.allocatedBuild,
      }));
  }, [displayedRecommendations, selectedApplyTierSet]);

  const currentApplyAllocations = useMemo(() => {
    if (applyTarget.type === "character") {
      return [
        {
          characterId: applyTarget.characterId,
          allocatedBuild: applyTarget.allocatedBuild,
        },
      ];
    }
    return recommendationAllocationsForApply;
  }, [applyTarget, recommendationAllocationsForApply]);

  const applyTierCounts = useMemo(() => {
    const counts = Object.fromEntries(
      APPLY_RECOMMENDATION_TIERS.map((tier) => [tier, 0])
    ) as Record<(typeof APPLY_RECOMMENDATION_TIERS)[number], number>;
    if (!displayedRecommendations) return counts;
    for (const entry of Object.values(displayedRecommendations.perCharacter)) {
      if (entry.tier !== "Pool" && entry.allocatedBuild) {
        counts[entry.tier as keyof typeof counts] += 1;
      }
    }
    return counts;
  }, [displayedRecommendations]);

  const buildRecommendationEquipPayload = useCallback(
    () =>
      buildScoreUpEquipInstructions(
        currentApplyAllocations,
        accountData,
        artifactLookup
      ),
    [currentApplyAllocations, accountData, artifactLookup]
  );

  const handleOpenTierApply = useCallback(() => {
    setApplyTarget({ type: "tiers" });
    setEquipDialogOpen(true);
  }, []);

  const handleOpenCharacterApply = useCallback(
    (characterId: string) => {
      const entry = displayedRecommendations?.perCharacter[characterId];
      if (!entry?.allocatedBuild) return;
      setApplyTarget({
        type: "character",
        characterId,
        allocatedBuild: entry.allocatedBuild,
      });
      setEquipDialogOpen(true);
    },
    [displayedRecommendations]
  );

  const handleToggleApplyTier = useCallback((tier: Tier, checked: boolean) => {
    setSelectedApplyTiers((prev) => {
      if (checked) {
        return prev.includes(tier) ? prev : [...prev, tier];
      }
      return prev.filter((value) => value !== tier);
    });
  }, []);

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

  const hasRankedChars = accountData.characters.some((char) => {
    const tier = tierAssignments[char.key]?.tier || "Pool";
    return tier !== "Pool" && !tierCustomization[tier]?.hidden;
  });
  const progressValue =
    displayedProgress.totalTierCount > 0
      ? (displayedProgress.completedTierCount /
          displayedProgress.totalTierCount) *
        100
      : 0;
  const currentTierName = displayedProgress.currentTier
    ? tierCustomization[displayedProgress.currentTier]?.displayName ||
      t.tier(displayedProgress.currentTier)
    : null;
  const renderCalculationStatus = () => (
    <div className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
      <div className="bg-gradient-select border-b border-border/70 px-4 py-2.5 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm font-semibold">
          {t.ui("accountData.recommendationsCalculating")}
        </span>
        {currentTierName && (
          <span className="text-xs text-muted-foreground">
            {t.format(
              "accountData.recommendationsCurrentTier",
              currentTierName
            )}
          </span>
        )}
      </div>
      <div className="p-3 md:p-4 space-y-2">
        <Progress value={progressValue} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {t.format(
            "accountData.recommendationsProgress",
            displayedProgress.completedTierCount,
            displayedProgress.totalTierCount
          )}
        </p>
      </div>
    </div>
  );

  const renderRecalculateButton = () => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRecalculate}
      disabled={!recommendationCacheKey || isCalculating}
      title={t.ui("accountData.recalculateRecommendations")}
      className="h-7 gap-1.5 px-2 text-xs"
    >
      <RefreshCw
        className={isCalculating ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
      />
      <span className="hidden sm:inline">
        {t.ui("accountData.recalculateRecommendations")}
      </span>
    </Button>
  );

  const renderApplyButton = () => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleOpenTierApply}
      disabled={
        isCalculating ||
        !displayedRecommendations ||
        recommendationAllocationsForApply.length === 0
      }
      title={t.ui("accountData.applyRecommendationsToGame")}
      className="h-7 gap-1.5 px-2 text-xs"
    >
      <Monitor className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{t.ui("manager.applyToGame")}</span>
    </Button>
  );

  const renderPoolStealSetting = () => (
    <div className="flex items-center gap-2">
      <Checkbox
        id="recommendation-allow-pool-steals"
        checked={allowPoolArtifactSteals}
        onCheckedChange={(checked) =>
          setAllowPoolArtifactSteals(checked === true)
        }
      />
      <Label
        htmlFor="recommendation-allow-pool-steals"
        className="cursor-pointer whitespace-nowrap text-sm text-white"
        title={t.ui("accountData.allowPoolArtifactStealsDesc")}
      >
        {t.ui("accountData.allowPoolArtifactSteals")}
      </Label>
    </div>
  );

  const renderRespectFrozenArtifactsSetting = () => (
    <div className="flex items-center gap-2">
      <Checkbox
        id="recommendation-respect-frozen-artifacts"
        checked={respectFrozenArtifacts}
        onCheckedChange={(checked) =>
          setRespectFrozenArtifacts(checked === true)
        }
      />
      <Label
        htmlFor="recommendation-respect-frozen-artifacts"
        className="cursor-pointer whitespace-nowrap text-sm text-white"
        title={t.ui("accountData.respectFrozenArtifactsDesc")}
      >
        {t.format(
          "accountData.respectFrozenArtifacts",
          frozenArtifactIdsForRecommendations.length
        )}
      </Label>
      {frozenArtifactIdsForRecommendations.length > 0 && (
        <Link
          to="/team-comp/frozen"
          className="flex items-center gap-0.5 whitespace-nowrap text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
        >
          {t.ui("accountData.manageFrozen")}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );

  const renderApplyTierSelection = () => (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          {t.ui("accountData.applyRecommendationTiers")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t.ui("accountData.applyRecommendationTiersDesc")}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {APPLY_RECOMMENDATION_TIERS.map((tier) => {
          const id = `apply-recommendation-tier-${tier}`;
          const tierLabel = tierCustomization[tier]?.displayName ?? tier;
          return (
            <div
              key={tier}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Checkbox
                id={id}
                checked={selectedApplyTierSet.has(tier)}
                onCheckedChange={(checked) =>
                  handleToggleApplyTier(tier, checked === true)
                }
              />
              <Label
                htmlFor={id}
                className="cursor-pointer text-sm whitespace-nowrap"
              >
                {tierLabel}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({applyTierCounts[tier]})
                </span>
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderApplyCharacterSelection = () => {
    if (applyTarget.type !== "character") return null;
    const character = accountData.characters.find(
      (char) => char.key === applyTarget.characterId
    );
    if (!character) return null;

    return (
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-3">
          <ItemIcon
            characterId={character.key}
            badge={character.constellation}
            level={`Lv. ${character.level}`}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {t.ui("accountData.applyRecommendationCharacter")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.format(
                "accountData.applyRecommendationCharacterDesc",
                t.character(character.key)
              )}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ScrollLayout
      header={
        <div className="flex flex-wrap items-center gap-3 pb-2">
          <h2 className="text-xl font-bold text-white">
            {t.ui("accountData.recommendations")}
          </h2>
          <AccountDataHelpButton
            label={t.ui("buttons.help")}
            onClick={() => setHelpOpen(true)}
          />
          <AccountDataSourceAgeBadge lastUpdate={activeAccount?.lastUpdate} />
          {renderPoolStealSetting()}
          {renderRespectFrozenArtifactsSetting()}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {renderRecalculateButton()}
            {renderApplyButton()}
          </div>
        </div>
      }
      bodyClassName="space-y-4"
    >
      {!hasRankedChars && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
            <Info className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {t.ui("accountData.noRankedChars")}
          </p>
          <Button asChild variant="outline">
            <Link to="/tier-list/characters">
              {t.ui("accountData.insights.goToTierList")}
            </Link>
          </Button>
        </div>
      )}

      {isCalculating && renderCalculationStatus()}

      {recommendationError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
          {t.ui("accountData.recommendationsFailed")}
        </div>
      )}

      {tiers.map((tier) => {
        if (tier === "Pool") return null;
        const customization = tierCustomization[tier];
        if (customization?.hidden) return null;

        const chars = charactersByTier[tier] || [];
        if (chars.length === 0) return null;

        const displayName = customization?.displayName || t.tier(tier);
        const luckExpectation = luckExpectationByTier[tier];

        return (
          <div key={tier} className="space-y-3">
            {/* Tier Header */}
            <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-2">
              <h2 className="text-lg font-bold text-white pb-1">
                {displayName}
                <span className="text-base font-normal text-muted-foreground pl-2">
                  ({chars.length})
                </span>
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground font-medium">
                  {t.ui("accountData.luckExpectation.label")}:
                </span>
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={luckExpectation}
                  onValueChange={(value) =>
                    handleTierLuckExpectationChange(tier, value)
                  }
                  disabled={isCalculating}
                  className="bg-black/30 rounded-md p-0.5"
                >
                  <ToggleGroupItem
                    value="cautious"
                    title={t.format(
                      "accountData.luckExpectation.tooltip",
                      LUCK_MULTIPLIERS.cautious
                    )}
                    className="text-xs px-2 py-0 data-[state=on]:bg-primary/20"
                  >
                    {t.ui("accountData.luckExpectation.cautious")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="balanced"
                    title={t.format(
                      "accountData.luckExpectation.tooltip",
                      LUCK_MULTIPLIERS.balanced
                    )}
                    className="text-xs px-2 py-0 data-[state=on]:bg-primary/20"
                  >
                    {t.ui("accountData.luckExpectation.balanced")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="hopeful"
                    title={t.format(
                      "accountData.luckExpectation.tooltip",
                      LUCK_MULTIPLIERS.hopeful
                    )}
                    className="text-xs px-2 py-0 data-[state=on]:bg-primary/20"
                  >
                    {t.ui("accountData.luckExpectation.hopeful")}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Per-character cards — grid layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {chars.map(
                ({
                  char,
                  scoreResult,
                  recommendations,
                  allocatedBuild,
                  allocationStatus,
                }) => (
                  <ScoreUpCard
                    key={char.key}
                    char={char}
                    tier={tier}
                    recommendations={recommendations}
                    allocatedBuild={allocatedBuild}
                    allocationStatus={allocationStatus}
                    score={scoreResult}
                    artifactLookup={artifactLookup}
                    onApplyCharacter={handleOpenCharacterApply}
                  />
                )
              )}
            </div>
          </div>
        );
      })}

      {/* Pool tier info */}
      {(() => {
        const poolChars = accountData.characters.filter(
          (c) => (tierAssignments[c.key]?.tier || "Pool") === "Pool"
        );
        if (poolChars.length === 0) return null;
        const poolDisplayName =
          tierCustomization.Pool?.displayName || t.tier("Pool");
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-2">
              <h2 className="text-2xl font-bold text-white pb-1">
                {poolDisplayName}
              </h2>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-white/5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-sm text-muted-foreground">
                  {t.ui("accountData.insights.poolInfo")}
                </div>
                <Button asChild variant="outline">
                  <Link to="/tier-list/characters">
                    {t.ui("accountData.insights.goToTierList")}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {poolChars.map((c) => {
                const charInfo = charactersById[c.key];
                if (!charInfo) return null;
                return <ItemIcon key={c.key} characterId={c.key} size="md" />;
              })}
            </div>
          </div>
        );
      })()}

      {/* Hint: recommendations are quick suggestions */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        {t
          .ui("accountData.hint")
          .split("{0}")
          .map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <Link
                  to="/team-comp/damage"
                  className="underline text-foreground hover:text-primary"
                >
                  {t.ui("accountData.hintDamageLink")}
                </Link>
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
      </p>

      <ArtifactManagerDialog
        open={equipDialogOpen}
        onOpenChange={setEquipDialogOpen}
        job={{ type: "equip", build: buildRecommendationEquipPayload }}
        actionLabel={t.ui("manager.equipToGame")}
        actionDisabled={currentApplyAllocations.length === 0}
        idleContent={
          applyTarget.type === "tiers"
            ? renderApplyTierSelection()
            : renderApplyCharacterSelection()
        }
      />
      <ScoreUpHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ScrollLayout>
  );
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
