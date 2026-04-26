import {
  ArrowUpRight,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Gem,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import {
  ArtifactComparisonHoverCard,
  ArtifactDataHoverCard,
} from "@/components/shared/ArtifactDataHoverCard";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { allSlots, type Slot, type StatKey, type Tier } from "@/data/enums";
import { artifactIdToHalfSetId, charactersById } from "@/data/gameResources";
import {
  resolveCharacterStats,
  resolveWeaponStats,
} from "@/data/gameStatsLoader";
import type { ArtifactData, CharacterData, StatEntry } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { OptimizedBuild } from "@/lib/account-data/buildOptimizer";
import type { ScoreUpAction } from "@/lib/account-data/scoreUpEngine";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { HALF_SET_STATS } from "@/lib/dmgcalc/impl/artifact2pc";
import { fmtStat } from "@/lib/team-comp/displayFormatter";
import { cn } from "@/lib/utils";
import { ScoreUpActionCard } from "./ScoreUpActionCard";

interface ScoreUpCardProps {
  char: CharacterData;
  tier?: Tier;
  recommendations?: ScoreUpAction[];
  allocatedBuild?: OptimizedBuild | null;
  score?: ArtifactScoreResult;
  artifactLookup: Map<string, ArtifactData>;
}

type DetailView = "swap" | "upgrade";

const STAT_ROWS: StatKey[] = [
  "hp",
  "atk",
  "def",
  "em",
  "er",
  "cr",
  "cd",
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
];

const SCALED_STAT_KEYS = new Set(["atk", "hp", "def"]);

function getCompactEnglishCharacterName(
  name: string,
  language: string
): string {
  if (language !== "en" || name.length <= 15 || !name.includes(" ")) {
    return name;
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;

  return parts.reduce((shortest, part) =>
    part.length < shortest.length ? part : shortest
  );
}

function resolveBuildArtifact(
  artifact: OptimizedBuild["artifacts"][Slot] | undefined,
  artifactLookup: Map<string, ArtifactData>
): ArtifactData | null {
  if (!artifact) return null;
  return artifactLookup.get(artifact.id) ?? (artifact as ArtifactData);
}

function ArtifactStrip({
  artifacts,
  beforeArtifacts,
  t,
  compact,
  changedSlots,
  changeLabel,
  keepLabel,
  emptyMode = "blank",
}: {
  artifacts: Partial<Record<Slot, ArtifactData | null>>;
  beforeArtifacts?: Partial<Record<Slot, ArtifactData | null>>;
  t: ReturnType<typeof useLanguage>["t"];
  compact: boolean;
  changedSlots?: ReadonlySet<Slot>;
  changeLabel?: string;
  keepLabel?: string;
  emptyMode?: "blank" | "placeholder";
}) {
  const showChangeLabels = !!changedSlots && !!changeLabel && !!keepLabel;

  return (
    <div className="grid grid-cols-5 gap-0.5 md:gap-1 lg:gap-1.5">
      {allSlots.map((slot) => {
        const art = artifacts[slot] ?? null;
        const beforeArt = beforeArtifacts?.[slot] ?? null;
        const isChanged = changedSlots?.has(slot) ?? false;
        const tile = (
          <div
            className={cn(
              "flex min-w-0 flex-col items-center",
              art && "cursor-pointer"
            )}
            role={art ? "button" : undefined}
            tabIndex={art ? 0 : undefined}
          >
            {showChangeLabels && (
              <div className="mb-1.5 h-4 text-center">
                <span
                  className={cn(
                    "text-xs font-bold leading-4",
                    isChanged ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {isChanged ? changeLabel : keepLabel}
                </span>
              </div>
            )}
            {art ? (
              <div className="w-fit">
                <ItemIcon
                  artifactSetId={art.setKey}
                  slot={slot}
                  rarity={art.rarity}
                  lock={art.lock}
                  level={`+${art.level}`}
                  badge={art.astralMark ? "⭐" : undefined}
                  size={compact ? "xs" : "md"}
                />
              </div>
            ) : (
              <div
                className={cn(
                  "aspect-square rounded",
                  emptyMode === "blank" && "invisible",
                  emptyMode === "placeholder" &&
                    "flex items-center justify-center border border-dashed border-border/30 bg-card/10 p-0.5"
                )}
              >
                {emptyMode === "placeholder" && (
                  <span className="text-xs font-medium leading-tight text-muted-foreground">
                    {t.ui("accountData.unequipped")}
                  </span>
                )}
              </div>
            )}
          </div>
        );

        if (!art) return <div key={slot}>{tile}</div>;
        if (isChanged) {
          return (
            <ArtifactComparisonHoverCard
              key={slot}
              beforeArtifact={beforeArt ?? undefined}
              afterArtifact={art}
              slot={slot}
              currentLabel={t.ui("accountData.current")}
              upgradeLabel={t.ui("accountData.insights.bestAllocation")}
            >
              {tile}
            </ArtifactComparisonHoverCard>
          );
        }
        return (
          <ArtifactDataHoverCard key={slot} artifact={art} slot={slot}>
            {tile}
          </ArtifactDataHoverCard>
        );
      })}
    </div>
  );
}

function HeaderWeaponIcon({
  weapon,
  size,
}: {
  weapon: CharacterData["weapon"];
  size: "xs" | "sm" | "md";
}) {
  if (!weapon) return null;
  return (
    <Tooltip>
      <TooltipTrigger>
        <ItemIcon
          weaponId={weapon.key}
          badge={weapon.refinement}
          level={`Lv. ${weapon.level}`}
          size={size}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="p-0 border-none bg-transparent">
        <WeaponTooltip weaponId={weapon.key} />
      </TooltipContent>
    </Tooltip>
  );
}

function buildIdleStatSheet(
  artifacts: Partial<Record<Slot, ArtifactData | null>>,
  charId: string,
  charLevel: number,
  weapon: CharacterData["weapon"]
): StatSheet {
  const baseEntries: StatEntry[] = [];

  try {
    baseEntries.push(...resolveCharacterStats(charId, charLevel));
  } catch {}

  if (weapon) {
    try {
      baseEntries.push(...resolveWeaponStats(weapon.key));
    } catch {}
  }

  const halfSetCounts = new Map<string, number>();
  for (const slot of allSlots) {
    const art = artifacts[slot];
    if (art) {
      const halfSetId = artifactIdToHalfSetId[art.setKey];
      if (halfSetId)
        halfSetCounts.set(halfSetId, (halfSetCounts.get(halfSetId) ?? 0) + 1);
    }
  }
  for (const [halfSetId, count] of halfSetCounts) {
    if (count >= 2) {
      const stats = HALF_SET_STATS[halfSetId];
      if (stats) baseEntries.push(...stats);
    }
  }

  return new StatSheet(baseEntries).merge(
    StatSheet.fromArtifacts(allSlots.map((s) => artifacts[s]))
  );
}

function buildStatRows(
  beforeArtifacts: Partial<Record<Slot, ArtifactData | null>>,
  afterArtifacts: Partial<Record<Slot, ArtifactData | null>>,
  charId: string,
  charLevel: number,
  weapon: CharacterData["weapon"]
) {
  const before = buildIdleStatSheet(beforeArtifacts, charId, charLevel, weapon);
  const after = buildIdleStatSheet(afterArtifacts, charId, charLevel, weapon);
  return STAT_ROWS.map((key) => {
    const beforeValue = SCALED_STAT_KEYS.has(key)
      ? before.get(key, null)
      : before.getRaw(key);
    const afterValue = SCALED_STAT_KEYS.has(key)
      ? after.get(key, null)
      : after.getRaw(key);
    return { key, beforeValue, afterValue, diff: afterValue - beforeValue };
  }).filter(
    (row) =>
      Math.abs(row.beforeValue) > 0.000001 ||
      Math.abs(row.afterValue) > 0.000001
  );
}

function AllocationStatTable({
  rows,
  t,
  singleColumn = false,
}: {
  rows: ReturnType<typeof buildStatRows>;
  t: ReturnType<typeof useLanguage>["t"];
  singleColumn?: boolean;
}) {
  return (
    <table className="w-full border-collapse text-xs xl:text-sm">
      <thead>
        <tr className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <th className="text-left font-bold py-1 pr-2 whitespace-nowrap">
            {t.ui("teamComp.stats")}
          </th>
          {singleColumn ? (
            <th className="text-right font-bold py-1 px-1 whitespace-nowrap">
              {t.ui("accountData.insights.statValue")}
            </th>
          ) : (
            <>
              <th className="text-right font-bold py-1 px-1 whitespace-nowrap">
                {t.ui("accountData.current")}
              </th>
              <th className="text-right font-bold py-1 px-1 whitespace-nowrap">
                {t.ui("accountData.upgrade")}
              </th>
              <th className="text-right font-bold py-1 pl-1 whitespace-nowrap">
                {t.ui("teamComp.gain")}
              </th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            className="cursor-default hover:bg-white/5 transition-colors"
          >
            <td className="py-1 pr-2 whitespace-nowrap">{t.stat(row.key)}</td>
            {singleColumn ? (
              <td className="py-1 px-1 text-right font-mono font-medium whitespace-nowrap text-foreground">
                {fmtStat(row.key, row.beforeValue)}
              </td>
            ) : (
              <>
                <td className="py-1 px-1 text-right font-mono font-medium whitespace-nowrap text-muted-foreground">
                  {fmtStat(row.key, row.beforeValue)}
                </td>
                <td className="py-1 px-1 text-right font-mono font-medium whitespace-nowrap text-foreground">
                  {fmtStat(row.key, row.afterValue)}
                </td>
                <td
                  className={cn(
                    "py-1 pl-1 text-right font-mono font-semibold whitespace-nowrap",
                    row.diff > 0
                      ? "text-emerald-400"
                      : row.diff < 0
                        ? "text-rose-400"
                        : "text-muted-foreground"
                  )}
                >
                  {row.diff > 0 ? "+" : ""}
                  {fmtStat(row.key, row.diff)}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScoreUpCardComponent({
  char,
  tier,
  recommendations,
  allocatedBuild,
  score,
  artifactLookup,
}: ScoreUpCardProps) {
  const { t, language } = useLanguage();
  const [activeView, setActiveView] = useState<DetailView | null>(null);
  const isCompact = !useMediaQuery("(min-width: 768px)");
  const isXl = useMediaQuery("(min-width: 1280px)");
  const showChevrons = isXl;
  const headerIconSize = isXl ? "md" : isCompact ? "xs" : "sm";

  // Set Bonus Logic
  const setCounts: Record<string, number> = {};
  for (const a of Object.values(char.artifacts || {})) {
    if (a) {
      setCounts[a.setKey] = (setCounts[a.setKey] || 0) + 1;
    }
  }

  const activeSets = Object.entries(setCounts)
    .filter((entry): entry is [string, number] => entry[1] >= 2)
    .sort((a, b) => b[1] - a[1]);

  type SetInfo =
    | { type: "4pc"; setId: string; label: string }
    | { type: "2pc"; setId: string; label: string }
    | { type: "2pc+2pc"; setId1: string; setId2: string; label: string }
    | null;

  const setInfo = ((): SetInfo => {
    if (activeSets.length === 0) return null;
    const fourPcSet = activeSets.find(([, count]) => count >= 4);
    if (fourPcSet)
      return {
        type: "4pc",
        setId: fourPcSet[0],
        label: t.artifact(fourPcSet[0]),
      };
    const twoPcSets = activeSets.filter(([, count]) => count >= 2);
    if (twoPcSets.length >= 2)
      return {
        type: "2pc+2pc",
        setId1: twoPcSets[0][0],
        setId2: twoPcSets[1][0],
        label: t.ui("buildCard.2pc+2pc"),
      };
    if (twoPcSets.length === 1)
      return {
        type: "2pc",
        setId: twoPcSets[0][0],
        label: t.artifact(twoPcSets[0][0]),
      };
    return null;
  })();
  const recs = recommendations ?? [];
  const allocationRecs = recs.filter((rec) => rec.actionType !== "upgrade");
  const upgradeRecs = recs.filter((rec) => rec.actionType === "upgrade");
  const changedSlots = useMemo(
    () => new Set(allocationRecs.map((rec) => rec.slot)),
    [allocationRecs]
  );
  const currentArtifacts = useMemo(() => {
    const result: Partial<Record<Slot, ArtifactData | null>> = {};
    for (const slot of allSlots) result[slot] = char.artifacts[slot] ?? null;
    return result;
  }, [char.artifacts]);
  const allocationArtifacts = useMemo(() => {
    const result: Partial<Record<Slot, ArtifactData | null>> = {};
    if (!allocatedBuild) return result;
    for (const slot of allSlots) {
      result[slot] = resolveBuildArtifact(
        allocatedBuild.artifacts[slot],
        artifactLookup
      );
    }
    return result;
  }, [allocatedBuild, artifactLookup]);
  const statRows = useMemo(
    () =>
      buildStatRows(
        currentArtifacts,
        allocationArtifacts,
        char.key,
        char.level,
        char.weapon
      ),
    [currentArtifacts, allocationArtifacts, char.key, char.level, char.weapon]
  );
  const currentNormalizedScore = score
    ? Math.min(300, Math.max(0, Math.round(score.normalized.normalizedScore)))
    : null;
  const normalizedAllocationScore =
    allocatedBuild && score
      ? Math.min(
          300,
          Math.max(
            0,
            Math.round(allocatedBuild.finalScore * score.normalized.normalizer)
          )
        )
      : null;
  const normalizedScoreGain =
    normalizedAllocationScore != null && currentNormalizedScore != null
      ? normalizedAllocationScore - currentNormalizedScore
      : null;

  const charInfo = charactersById[char.key];
  if (!charInfo) return null;
  const characterName = getCompactEnglishCharacterName(
    t.character(char.key),
    language
  );

  return (
    <div className="w-full min-w-[280px]">
      <Card className="flex flex-col bg-gradient-card border-border/50 transition-colors overflow-hidden shadow-lg">
        {/* Header: Character & Sets */}
        <div className="flex items-start p-3 pb-2 gap-2 md:gap-3 bg-gradient-select border-b border-border/40">
          <Tooltip>
            <TooltipTrigger>
              <ItemIcon
                characterId={char.key}
                badge={char.constellation}
                level={`Lv. ${char.level}`}
                size={headerIconSize}
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="p-0 border-none bg-transparent"
            >
              <CharacterTooltip characterId={char.key} />
            </TooltipContent>
          </Tooltip>

          <div className="flex flex-col min-w-0 flex-1 gap-0.5 md:gap-1">
            <div className="truncate font-semibold text-xs md:text-sm text-white leading-none tracking-tight">
              {characterName}
            </div>
            <div className="min-w-0">
              {setInfo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs text-muted-foreground line-clamp-2 leading-tight cursor-default">
                      {setInfo.label}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="p-0 border-none bg-transparent"
                  >
                    {setInfo.type === "2pc+2pc" ? (
                      <MixedSetTooltip
                        set1={setInfo.setId1}
                        set2={setInfo.setId2}
                      />
                    ) : (
                      <ArtifactTooltip
                        setId={setInfo.setId}
                        hideFourPieceEffect={setInfo.type === "2pc"}
                      />
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              <Link
                to={`/artifact-filter/configure?char=${char.key}`}
                className="mt-0.5 flex w-fit items-center gap-0.5 text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
              >
                {t.ui("accountData.viewBuilds")}
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {score && (
            <div className="shrink-0">
              <ArtifactScoreHoverCard
                score={score}
                characterId={char.key}
                compact
              />
            </div>
          )}
          <div className="shrink-0">
            <HeaderWeaponIcon weapon={char.weapon} size={headerIconSize} />
          </div>
        </div>

        {/* Recommendations */}
        {tier !== "Pool" && (
          <CardContent className="p-0 flex-1 flex flex-col">
            {allocatedBuild && (
              <section className="p-0 md:p-1 lg:p-2 border-t border-border/10">
                <div className="flex items-center gap-1 pr-1 text-xs md:text-sm font-bold tabular-nums">
                  <span className="text-foreground/80 ml-1">
                    {t.ui("accountData.insights.bestAllocationScoreLabel")}
                  </span>
                  {normalizedAllocationScore != null && (
                    <>
                      <span className="text-amber-400">
                        {normalizedAllocationScore}
                      </span>
                      {normalizedScoreGain != null &&
                        normalizedScoreGain !== 0 && (
                          <span
                            className={cn(
                              "font-bold",
                              normalizedScoreGain > 0
                                ? "text-emerald-400"
                                : "text-amber-400"
                            )}
                          >
                            ({normalizedScoreGain > 0 ? "+" : ""}
                            {normalizedScoreGain})
                          </span>
                        )}
                    </>
                  )}
                </div>
                <ArtifactStrip
                  artifacts={allocationArtifacts}
                  beforeArtifacts={currentArtifacts}
                  t={t}
                  compact={isCompact}
                  changedSlots={changedSlots}
                  changeLabel={t.ui("accountData.insights.swap")}
                  keepLabel={t.ui("accountData.insights.keep")}
                  emptyMode="placeholder"
                />
              </section>
            )}

            {allocatedBuild && (
              <div className="flex items-stretch gap-1 px-2 py-1.5 bg-black/10 border-t border-border/10">
                {(
                  [
                    {
                      mode: "swap" as const,
                      label: "accountData.insights.swapDetails" as const,
                    },
                    {
                      mode: "upgrade" as const,
                      label: "accountData.insights.additionalUpgrades" as const,
                    },
                  ] as const
                ).map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setActiveView((prev) => (prev === mode ? null : mode))
                    }
                    className={cn(
                      "flex-1 flex items-center justify-center text-xs font-semibold px-1.5 py-1 rounded-full transition-all",
                      showChevrons && "gap-0.5",
                      activeView === mode
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80 hover:bg-white/5"
                    )}
                  >
                    {t.ui(label)}
                    {showChevrons &&
                      (activeView === mode ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      ))}
                  </button>
                ))}
              </div>
            )}

            {activeView === "swap" && (
              <div className="bg-black/20 px-2 pb-2 pt-2 border-t border-border/10">
                {allocationRecs.length === 0 && (
                  <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                    <CheckCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-primary font-medium">
                      {t.ui("accountData.insights.noArtifactSwaps")}
                    </span>
                  </div>
                )}
                <AllocationStatTable
                  rows={statRows}
                  t={t}
                  singleColumn={allocationRecs.length === 0}
                />
              </div>
            )}

            {activeView === "upgrade" && (
              <div className="space-y-2 bg-black/20 px-3 pb-3 pt-2 border-t border-border/10">
                {upgradeRecs.length > 0 ? (
                  upgradeRecs.map((rec) => (
                    <ScoreUpActionCard
                      key={[
                        rec.slot,
                        rec.actionType,
                        rec.sourceArtifactId,
                        rec.currentArtifactId,
                        rec.swapSlot,
                        rec.swapArtifactId,
                        rec.upgradeStrategy,
                      ].join("-")}
                      recommendation={rec}
                      artifactLookup={artifactLookup}
                      inline
                    />
                  ))
                ) : (
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    <Gem className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      {t.ui("accountData.insights.noUpgradeSuggestions")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export const ScoreUpCard = memo(ScoreUpCardComponent);
