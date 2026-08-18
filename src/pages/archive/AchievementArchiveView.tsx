import { Check, Circle, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { achievementTextResource } from "@/data/gameDataLoader";
import type { Achievement, AchievementCategory } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  achievementSeriesMatchesFilters,
  groupAchievementSeries,
} from "@/lib/achievement/utils";
import { cn } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useAchievementStore } from "@/stores/useAchievementStore";

type AchievementStatus = "unfinished" | "finished";

const STATUS_OPTIONS: AchievementStatus[] = ["unfinished", "finished"];
const VERSION_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const EMPTY_EARNED_IDS: number[] = [];

function videoSearchUrl(site: "youtube" | "bilibili", name: string): string {
  const query = encodeURIComponent(name);
  return site === "youtube"
    ? `https://www.youtube.com/results?search_query=${query}`
    : `https://search.bilibili.com/all?keyword=${query}`;
}

// Simple Icons brand paths (CC0): https://github.com/simple-icons/simple-icons
function YouTubeLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function BilibiliLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z" />
    </svg>
  );
}

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
            <span className="block text-sm font-medium">{category.name}</span>
            <span className="text-xs text-muted-foreground">
              {finished} / {achievements.length}
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
  const { t } = useLanguage();
  const seriesIds = useMemo(() => series.map((item) => item.id), [series]);

  return (
    <Card className="overflow-hidden">
      <div className="flex min-w-0">
        <div className="flex w-12 shrink-0 items-center justify-center border-r border-border bg-muted/30 sm:w-14">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 divide-y divide-border">
          {series.map((achievement) => {
            const finished = earnedIds.has(achievement.id);
            return (
              <div
                key={achievement.id}
                className={cn(
                  "flex min-w-0 flex-col items-stretch gap-2 px-3 py-3 transition-colors sm:flex-row sm:items-center sm:px-4",
                  finished ? "bg-primary/10" : "bg-card"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "font-medium leading-tight",
                        finished ? "text-foreground" : "text-foreground/60"
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
                      finished ? "text-muted-foreground" : "text-foreground/40"
                    )}
                  >
                    {achievement.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={videoSearchUrl("youtube", achievement.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t.format(
                        "archive.searchYouTube",
                        achievement.name
                      )}
                      title={t.format(
                        "archive.searchYouTube",
                        achievement.name
                      )}
                    >
                      <YouTubeLogo />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={videoSearchUrl("bilibili", achievement.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t.format(
                        "archive.searchBilibili",
                        achievement.name
                      )}
                      title={t.format(
                        "archive.searchBilibili",
                        achievement.name
                      )}
                    >
                      <BilibiliLogo />
                    </a>
                  </Button>
                  <Button
                    variant={finished ? "default" : "outline"}
                    size="icon"
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
                  >
                    {finished ? <Check /> : <Circle />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
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

  useEffect(() => {
    if (!isDesktop || categories.length === 0) return;
    if (!categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, isDesktop, selectedCategoryId]);

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
        earnedIds
      )
    );
  }, [
    achievementsByCategory,
    earnedIds,
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
      categories={categories}
      achievementsByCategory={achievementsByCategory}
      earnedIds={earnedIds}
      selectedCategoryId={selectedCategoryId}
      onSelect={setSelectedCategoryId}
    />
  );
  const achievementToolbar = (
    <AchievementFilterToolbar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      versionFilter={versionFilter}
      onVersionFilterChange={setVersionFilter}
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
        <div className="space-y-3 pb-4">
          {!isDesktop && <div className="pb-1">{achievementToolbar}</div>}
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-lg font-semibold">{selectedCategory.name}</h2>
            <span className="text-xs text-muted-foreground">
              {visibleSeries.length} {t.ui("archive.achievementSeries")}
            </span>
          </div>
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
