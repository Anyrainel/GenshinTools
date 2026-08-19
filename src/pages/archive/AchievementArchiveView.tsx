import { Check, Medal, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { achievementTextResource } from "@/data/gameDataLoader";
import type { Achievement, AchievementCategory } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  achievementCategoryMatchesStatusFilter,
  achievementSeriesMatchesFilters,
  buildAchievementVideoSearchUrl,
  groupAchievementSeries,
} from "@/lib/achievement/utils";
import { cn, getAssetUrl } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useAchievementStore } from "@/stores/useAchievementStore";

type AchievementStatus = "unfinished" | "finished";

const STATUS_OPTIONS: AchievementStatus[] = ["unfinished", "finished"];
const VERSION_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const EMPTY_EARNED_IDS: number[] = [];

function CategoryList({
  categories,
  achievementsByCategory,
  earnedIds,
  selectedCategoryId,
  onSelect,
}: {
  categories: readonly AchievementCategory[];
  achievementsByCategory: ReadonlyMap<number, readonly Achievement[]>;
  earnedIds: ReadonlySet<number>;
  selectedCategoryId: number | null;
  onSelect: (categoryId: number) => void;
}) {
  return (
    <div className="space-y-1">
      {categories.map((category) => {
        const achievements = achievementsByCategory.get(category.id) ?? [];
        const finished = achievements.filter((item) =>
          earnedIds.has(item.id)
        ).length;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-left transition-colors",
              selectedCategoryId === category.id
                ? "bg-primary/15 ring-1 ring-primary/30"
                : "hover:bg-accent/50"
            )}
          >
            <span className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Medal className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {category.name}
                </span>
                <span className="text-xs text-foreground/80">
                  {finished} / {achievements.length}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AchievementSeriesCard({
  series,
  earnedIds,
  onStatusChange,
}: {
  series: readonly Achievement[];
  earnedIds: ReadonlySet<number>;
  onStatusChange: (
    seriesIds: number[],
    achievementId: number,
    finished: boolean
  ) => void;
}) {
  const { language, t } = useLanguage();
  const seriesIds = useMemo(() => series.map((item) => item.id), [series]);

  return (
    <Card className="overflow-hidden border-border/70 bg-card/60">
      <div className="min-w-0 divide-y divide-border">
        {series.map((achievement) => {
          const finished = earnedIds.has(achievement.id);
          return (
            <div
              key={achievement.id}
              className={cn(
                "flex min-w-0 items-stretch px-2 py-2 transition-colors sm:px-3",
                finished ? "bg-primary/20" : "bg-card/40"
              )}
            >
              <div className="flex w-12 shrink-0 items-center justify-center sm:w-14">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "font-medium leading-tight",
                        finished ? "text-foreground" : "text-foreground/80"
                      )}
                    >
                      {achievement.name}
                    </span>
                    {achievement.version && (
                      <Badge
                        variant="secondary"
                        className="px-1.5 py-0 text-[11px]"
                      >
                        {achievement.version}
                      </Badge>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      finished ? "text-foreground/80" : "text-foreground/70"
                    )}
                  >
                    {achievement.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
                  <a
                    href={buildAchievementVideoSearchUrl(
                      "youtube",
                      achievement.name,
                      language
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.format(
                      "archive.searchYouTube",
                      achievement.name
                    )}
                    title={t.format("archive.searchYouTube", achievement.name)}
                    className="group flex h-10 w-[4.5rem] items-center justify-center rounded-md px-1 outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <img
                      src={getAssetUrl("assets/brands/youtube.webp")}
                      alt=""
                      className="max-h-5 max-w-full object-contain opacity-80 transition-opacity group-hover:opacity-100"
                    />
                  </a>
                  <a
                    href={buildAchievementVideoSearchUrl(
                      "bilibili",
                      achievement.name,
                      language
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.format(
                      "archive.searchBilibili",
                      achievement.name
                    )}
                    title={t.format("archive.searchBilibili", achievement.name)}
                    className="group flex h-10 w-[4.5rem] items-center justify-center rounded-md px-1 outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <img
                      src={getAssetUrl("assets/brands/bilibili.webp")}
                      alt=""
                      className="max-h-5 max-w-full object-contain opacity-80 transition-opacity group-hover:opacity-100"
                    />
                  </a>
                  <button
                    type="button"
                    aria-pressed={finished}
                    aria-label={t.format(
                      finished
                        ? "archive.markAchievementUnfinished"
                        : "archive.markAchievementFinished",
                      achievement.name
                    )}
                    onClick={() =>
                      onStatusChange(seriesIds, achievement.id, !finished)
                    }
                    className="group flex size-10 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md border transition-colors",
                        finished
                          ? "border-primary bg-primary text-primary-foreground group-hover:bg-primary/80"
                          : "border-foreground/70 text-foreground group-hover:border-primary group-hover:bg-primary/10 group-hover:text-primary"
                      )}
                    >
                      {finished && <Check className="size-4" />}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CategoryProgressBanner({
  category,
  achievements,
  earnedIds,
}: {
  category: AchievementCategory;
  achievements: readonly Achievement[];
  earnedIds: ReadonlySet<number>;
}) {
  const finished = achievements.filter((achievement) =>
    earnedIds.has(achievement.id)
  ).length;
  const total = achievements.length;
  const percentage = total === 0 ? 0 : Math.round((finished / total) * 100);

  return (
    <div className="sticky top-0 z-20 pb-2">
      <div className="flex items-center gap-3 rounded-lg border-2 border-primary bg-[color-mix(in_hsl,hsl(var(--card))_85%,hsl(var(--primary))_15%)] px-3 py-2 shadow-sm">
        <h2 className="min-w-0 max-w-[14rem] text-base font-semibold leading-tight sm:text-lg">
          {category.name}
        </h2>
        <div className="min-w-20 flex-1">
          <Progress
            value={percentage}
            aria-label={`${category.name}: ${finished} / ${total}`}
            className="mt-1.5 h-2"
          />
          <div className="mt-1 text-center text-xs text-foreground/70">
            {finished} / {total}
          </div>
        </div>
        <div className="w-14 shrink-0 text-right text-base font-semibold tabular-nums text-foreground sm:text-lg">
          {percentage}%
        </div>
      </div>
    </div>
  );
}

function AchievementFilterToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  versionFilter,
  onVersionFilterChange,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: ReadonlySet<AchievementStatus>;
  onStatusFilterChange: (values: Set<AchievementStatus>) => void;
  versionFilter: ReadonlySet<number>;
  onVersionFilterChange: (values: Set<number>) => void;
}) {
  const { t } = useLanguage();

  return (
    <ArchiveToolbar
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder={t.ui("archive.achievementSearchPlaceholder")}
    >
      <FilterChipGroup
        options={STATUS_OPTIONS}
        selectedValues={statusFilter}
        onSelectedValuesChange={onStatusFilterChange}
        getKey={(status) => status}
        getLabel={(status) =>
          t.ui(
            status === "unfinished"
              ? "archive.achievementUnfinished"
              : "archive.achievementFinished"
          )
        }
        emptyMeansAll={false}
        className="contents"
      />
      <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
      <FilterChipGroup
        options={VERSION_OPTIONS}
        selectedValues={versionFilter}
        onSelectedValuesChange={onVersionFilterChange}
        getKey={(version) => String(version)}
        getLabel={(version) => `v${version}.x`}
        emptyMeansAll
        className="contents"
      />
    </ArchiveToolbar>
  );
}

export function AchievementArchiveView() {
  const { language, t } = useLanguage();
  const achievementData = achievementTextResource.use(language);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const activeAccountId = useAccountStore((state) => state.activeAccountId);
  const earnedIdList = useAchievementStore((state) =>
    activeAccountId === null
      ? EMPTY_EARNED_IDS
      : (state.earnedIdsByProfileId[activeAccountId] ?? EMPTY_EARNED_IDS)
  );
  const setSeriesAchievementStatus = useAchievementStore(
    (state) => state.setSeriesAchievementStatus
  );
  const earnedIds = useMemo(() => new Set(earnedIdList), [earnedIdList]);
  const [filterSnapshot, setFilterSnapshot] = useState<{
    profileId: number | null;
    earnedIds: number[];
  }>(() => ({ profileId: activeAccountId, earnedIds: [...earnedIdList] }));
  const filterEarnedIds = useMemo(
    () =>
      new Set(
        filterSnapshot.profileId === activeAccountId
          ? filterSnapshot.earnedIds
          : earnedIdList
      ),
    [activeAccountId, earnedIdList, filterSnapshot]
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<AchievementStatus>>(
    () => new Set(["unfinished"])
  );
  const [versionFilter, setVersionFilter] = useState<Set<number>>(
    () => new Set()
  );

  const refreshFilterSnapshot = useCallback(() => {
    setFilterSnapshot({
      profileId: activeAccountId,
      earnedIds: [...earnedIdList],
    });
  }, [activeAccountId, earnedIdList]);

  useEffect(() => {
    if (filterSnapshot.profileId !== activeAccountId) {
      refreshFilterSnapshot();
    }
  }, [activeAccountId, filterSnapshot.profileId, refreshFilterSnapshot]);

  const handleCategorySelect = useCallback(
    (categoryId: number) => {
      refreshFilterSnapshot();
      setSelectedCategoryId(categoryId);
    },
    [refreshFilterSnapshot]
  );
  const handleStatusFilterChange = useCallback(
    (values: Set<AchievementStatus>) => {
      refreshFilterSnapshot();
      setStatusFilter(values);
    },
    [refreshFilterSnapshot]
  );
  const handleVersionFilterChange = useCallback(
    (values: Set<number>) => {
      refreshFilterSnapshot();
      setVersionFilter(values);
    },
    [refreshFilterSnapshot]
  );

  const categories = useMemo(
    () =>
      [...(achievementData?.categories ?? [])].sort(
        (left, right) => left.order - right.order || left.id - right.id
      ),
    [achievementData]
  );
  const achievementsByCategory = useMemo(() => {
    const byCategory = new Map<number, Achievement[]>();
    for (const achievement of achievementData?.achievements ?? []) {
      const items = byCategory.get(achievement.categoryId);
      if (items) items.push(achievement);
      else byCategory.set(achievement.categoryId, [achievement]);
    }
    return byCategory;
  }, [achievementData]);

  const visibleCategories = useMemo(
    () =>
      categories.filter((category) =>
        achievementCategoryMatchesStatusFilter(
          achievementsByCategory.get(category.id) ?? [],
          statusFilter,
          filterEarnedIds
        )
      ),
    [achievementsByCategory, categories, filterEarnedIds, statusFilter]
  );

  useEffect(() => {
    if (!isDesktop) return;
    if (visibleCategories.length === 0) {
      if (selectedCategoryId !== null) setSelectedCategoryId(null);
      return;
    }
    if (
      !visibleCategories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(visibleCategories[0].id);
    }
  }, [isDesktop, selectedCategoryId, visibleCategories]);

  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId
  );
  const visibleSeries = useMemo(() => {
    if (selectedCategoryId === null) return [];
    return groupAchievementSeries(
      achievementsByCategory.get(selectedCategoryId) ?? []
    ).filter((series) =>
      achievementSeriesMatchesFilters(
        series,
        searchQuery,
        statusFilter,
        versionFilter,
        filterEarnedIds
      )
    );
  }, [
    achievementsByCategory,
    filterEarnedIds,
    searchQuery,
    selectedCategoryId,
    statusFilter,
    versionFilter,
  ]);

  const handleStatusChange = useCallback(
    (seriesIds: number[], achievementId: number, finished: boolean) => {
      if (activeAccountId === null) {
        toast.info(t.ui("archive.achievementNeedsAccount"));
        return;
      }
      setSeriesAchievementStatus(
        activeAccountId,
        seriesIds,
        achievementId,
        finished
      );
    },
    [activeAccountId, setSeriesAchievementStatus, t]
  );

  if (!achievementData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t.ui("archive.loadingAchievements")}
      </div>
    );
  }

  const categoryList = (
    <CategoryList
      categories={visibleCategories}
      achievementsByCategory={achievementsByCategory}
      earnedIds={earnedIds}
      selectedCategoryId={selectedCategoryId}
      onSelect={handleCategorySelect}
    />
  );
  const achievementToolbar = (
    <AchievementFilterToolbar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      statusFilter={statusFilter}
      onStatusFilterChange={handleStatusFilterChange}
      versionFilter={versionFilter}
      onVersionFilterChange={handleVersionFilterChange}
    />
  );

  return (
    <SidebarDetailLayout
      header={achievementToolbar}
      sidebar={categoryList}
      mobileGrid={categoryList}
      hasSelection={selectedCategoryId !== null}
      onBack={() => setSelectedCategoryId(null)}
      backLabel={t.ui("archive.achievementCategories")}
      sidebarWidth="w-1/3 max-w-[18rem]"
    >
      {selectedCategory ? (
        <div className="pb-4">
          {!isDesktop && <div className="pb-1">{achievementToolbar}</div>}
          <CategoryProgressBanner
            category={selectedCategory}
            achievements={achievementsByCategory.get(selectedCategory.id) ?? []}
            earnedIds={earnedIds}
          />
          {visibleSeries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t.ui("archive.noAchievementResults")}
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleSeries.map((series) => (
                <AchievementSeriesCard
                  key={series[0].id}
                  series={series}
                  earnedIds={earnedIds}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </SidebarDetailLayout>
  );
}
