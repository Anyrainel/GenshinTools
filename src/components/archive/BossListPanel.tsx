import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  bossMatchesSearch,
  getBossDisplayName,
  getBossImagePath,
  getBossInfo,
  getCurrentSchedule,
  getScheduleActiveDates,
  getScheduleName,
  schedules,
} from "@/data/leylineBoss";
import { cn } from "@/lib/utils";
import { Fragment, useMemo } from "react";
import { BossIcon } from "./BossDetailPanel";

function useBossListTranslations() {
  const { language } = useLanguage();
  return useMemo(
    () => ({
      bossName: (id: number) => getBossDisplayName(id, language),
      scheduleName: (id: number) => getScheduleName(id, language),
    }),
    [language]
  );
}

export function BossListPanel({
  selectedBossId,
  onSelect,
  searchQuery,
}: {
  selectedBossId: number | null;
  onSelect: (id: number) => void;
  searchQuery: string;
}) {
  const { t } = useLanguage();
  const boss = useBossListTranslations();
  const currentSchedule = useMemo(() => getCurrentSchedule(), []);
  const reversedSchedules = useMemo(() => [...schedules].reverse(), []);
  const query = searchQuery.trim().toLowerCase();

  return (
    <div className="space-y-0.5">
      {reversedSchedules.map((schedule) => {
        const isCurrent = currentSchedule?.id === schedule.id;
        const scheduleName = boss.scheduleName(schedule.id);
        const { open: openDate, close: closeDate } =
          getScheduleActiveDates(schedule);
        const dateStr = `${t.shortDate(openDate)} – ${t.shortDate(closeDate)}`;

        const matchingBossIds = schedule.boss_ids.filter((bossId) =>
          bossMatchesSearch(bossId, query)
        );

        if (query && matchingBossIds.length === 0) return null;

        return (
          <Fragment key={schedule.id}>
            <Label className="text-sm text-muted-foreground px-2 pt-3 pb-0.5 flex items-center gap-1.5">
              <span className="truncate">{scheduleName}</span>
              {isCurrent && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs py-0 px-1.5 leading-tight">
                  Live
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {dateStr}
              </span>
            </Label>

            {matchingBossIds.map((bossId) => {
              const info = getBossInfo(bossId);
              if (!info) return null;
              const name = boss.bossName(bossId);
              const imagePath = getBossImagePath(bossId);
              const isSelected = selectedBossId === bossId;

              return (
                <button
                  key={`${schedule.id}-${bossId}`}
                  type="button"
                  onClick={() => onSelect(bossId)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left",
                    isSelected
                      ? "bg-primary/15 ring-1 ring-primary/30"
                      : "hover:bg-accent/50"
                  )}
                >
                  <BossIcon imagePath={imagePath} name={name} size="sm" />
                  <span className="text-sm font-medium truncate flex-1">
                    {name}
                  </span>
                </button>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

export function BossGrid({
  onSelect,
  searchQuery,
}: {
  onSelect: (id: number) => void;
  searchQuery: string;
}) {
  const { t } = useLanguage();
  const boss = useBossListTranslations();
  const currentSchedule = useMemo(() => getCurrentSchedule(), []);
  const reversedSchedules = useMemo(() => [...schedules].reverse(), []);
  const query = searchQuery.trim().toLowerCase();

  return (
    <div className="space-y-3 p-2">
      {reversedSchedules.map((schedule) => {
        const isCurrent = currentSchedule?.id === schedule.id;
        const scheduleName = boss.scheduleName(schedule.id);
        const { open: openDate, close: closeDate } =
          getScheduleActiveDates(schedule);
        const dateStr = `${t.shortDate(openDate)} – ${t.shortDate(closeDate)}`;

        const matchingBossIds = schedule.boss_ids.filter((bossId) =>
          bossMatchesSearch(bossId, query)
        );

        if (query && matchingBossIds.length === 0) return null;

        return (
          <div key={schedule.id}>
            <div className="flex items-center gap-1.5 px-1 pb-1.5">
              <span className="text-sm font-medium text-muted-foreground truncate">
                {scheduleName}
              </span>
              {isCurrent && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs py-0 px-1.5 leading-tight">
                  Live
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {dateStr}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {matchingBossIds.map((bossId) => {
                const info = getBossInfo(bossId);
                if (!info) return null;
                const name = boss.bossName(bossId);
                const imagePath = getBossImagePath(bossId);

                return (
                  <button
                    key={bossId}
                    type="button"
                    onClick={() => onSelect(bossId)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <BossIcon imagePath={imagePath} name={name} size="md" />
                    <span className="text-sm text-foreground text-center line-clamp-2 w-full leading-tight">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
