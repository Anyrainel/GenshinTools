import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type { SubStat } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { fmtDamage } from "@/lib/team-comp/displayFormatters";
import type { SubstatBudgetPreset } from "@/lib/team-comp/substatBudget";
import type { CalcContext } from "@/lib/team-comp/types";
import type { WeaponChoiceProgress } from "@/lib/team-comp/weaponChoice";
import { cn, getAssetUrl } from "@/lib/utils";
import type { WeaponChoiceResult, WeaponRanking } from "@/stores/useTeamStore";
import { Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { EnemyInputs, RollQualityInputs } from "./GeneratorControls";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

const CONTROLS_CLS =
  "flex flex-wrap items-center justify-center mb-3 gap-x-2 gap-y-1 md:gap-x-5 md:gap-y-2";

// Substat display order (most common optimization targets first)
const SUBSTAT_ORDER: SubStat[] = [
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "em",
  "er",
  "atk",
  "hp",
  "def",
];

// ─── Types ───

export interface WeaponChoiceCalcSettings {
  calcContext: CalcContext;
  rollMultiplier: number;
  substatBudget: SubstatBudgetPreset;
}

interface WeaponChoiceResultCardProps {
  charIds: string[];
  isComputing: boolean;
  result: WeaponChoiceResult | null;
  progress?: WeaponChoiceProgress;
  error: Error | null;
  onRun: (settings: WeaponChoiceCalcSettings) => void;
  onStop: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}

// ─── Character panel header (reused across all states) ───

function CharPanelHeader({
  charId,
  t,
}: {
  charId: string;
  t: WeaponChoiceResultCardProps["t"];
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-background/50">
      {charactersById[charId] && (
        <img
          src={getAssetUrl(charactersById[charId].imagePath)}
          alt={t.character(charId)}
          className="w-6 h-6 rounded-full shrink-0"
        />
      )}
      <span className="text-sm font-bold truncate">{t.character(charId)}</span>
    </div>
  );
}

// ─── Weapon entry hover card content ───

function WeaponDetailContent({
  entry,
  t,
}: {
  entry: WeaponRanking;
  t: WeaponChoiceResultCardProps["t"];
}) {
  const weapon = weaponsById[entry.weaponId];
  return (
    <div className="space-y-2 text-xs">
      {/* Header: weapon + artifact set icons */}
      <div className="flex items-center gap-2">
        <ItemIcon weaponId={entry.weaponId} size="xs" className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">
            {t.weapon(entry.weaponId)} R{entry.refinement}
          </div>
          <div className="text-muted-foreground">
            {entry.percentOfBest.toFixed(1)}%
          </div>
        </div>
        {entry.artifactSetIds && (
          <div className="flex gap-0.5 shrink-0">
            {entry.artifactSetIds.map((setId) => (
              <ItemIcon key={setId} artifactSetId={setId} size="xs" />
            ))}
          </div>
        )}
      </div>

      {/* Total damage */}
      <div className="flex justify-between border-t border-border pt-1.5">
        <span className="text-muted-foreground">
          {t.ui("teamComp.totalDamage")}
        </span>
        <span className="font-mono font-bold">{fmtDamage(entry.damage)}</span>
      </div>

      {/* Main stats */}
      {entry.mainStats && (
        <div className="border-t border-border pt-1.5">
          <div className="text-muted-foreground mb-1 font-semibold">
            {t.ui("teamComp.mainStats")}
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">
            {(
              [
                ["sands", entry.mainStats.sands],
                ["goblet", entry.mainStats.goblet],
                ["circlet", entry.mainStats.circlet],
              ] as const
            ).map(([slot, stat]) => (
              <div key={slot}>
                <div className="text-[10px] text-muted-foreground">
                  {t.slot(slot)}
                </div>
                <div className="font-semibold">{t.statShort(stat)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Substat allocation (roll counts) */}
      {entry.substatRolls && (
        <div className="border-t border-border pt-1.5">
          <div className="text-muted-foreground mb-1 font-semibold">
            {t.ui("teamComp.substatAllocation")}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {SUBSTAT_ORDER.filter(
              (s) =>
                entry.substatRolls![s] != null && entry.substatRolls![s]! > 0
            ).map((stat) => {
              const rolls = entry.substatRolls![stat]!;
              return (
                <div key={stat} className="flex justify-between">
                  <span className="text-muted-foreground">{t.stat(stat)}</span>
                  <span className="font-mono font-bold">
                    {Number.isInteger(rolls) ? rolls : rolls.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Per-character weapon ranking panel ───

/** Compute how many top entries to highlight.
 *  - All entries ≥99% baseline, capped at 5
 *  - Exception: if #1 is a 5★ R5, extend highlight to include its R1 entry (even if >5) */
function getHighlightCount(rankings: WeaponRanking[]): number {
  if (rankings.length === 0) return 0;
  let count = 0;
  for (const r of rankings) {
    if (r.percentOfBest >= 99) count++;
    else break;
  }
  count = Math.min(count, 5);

  const top = rankings[0];
  const topRes = weaponsById[top.weaponId];
  if (topRes?.rarity === 5 && top.refinement === 5) {
    const r1Idx = rankings.findIndex(
      (r) => r.weaponId === top.weaponId && r.refinement === 1
    );
    if (r1Idx >= 0) count = Math.max(count, r1Idx + 1);
  }

  return count;
}

function WeaponEntryRow({
  entry,
  idx,
  isTop,
  isMobile,
  t,
}: {
  entry: WeaponRanking;
  idx: number;
  isTop: boolean;
  isMobile: boolean;
  t: WeaponChoiceResultCardProps["t"];
}) {
  const weapon = weaponsById[entry.weaponId];
  const hasDetail = !!(entry.mainStats || entry.substatRolls);

  const row = (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 text-xs md:text-sm",
        isTop
          ? "bg-sky-900/30 border border-sky-600/30"
          : "border border-transparent",
        hasDetail && "cursor-default"
      )}
    >
      <span className="w-5 text-right text-muted-foreground font-mono shrink-0">
        {idx + 1}
      </span>
      {weapon && (
        <img
          src={getAssetUrl(weapon.imagePath)}
          alt={t.weapon(entry.weaponId)}
          className="w-6 h-6 md:w-7 md:h-7 object-cover shrink-0"
          draggable={false}
        />
      )}
      <span className="truncate flex-1 font-medium">
        {t.weapon(entry.weaponId)}
      </span>
      <span className="text-muted-foreground shrink-0">
        R{entry.refinement}
      </span>
      <span
        className={cn(
          "w-14 text-right font-mono font-bold shrink-0",
          isTop ? "text-sky-300" : "text-foreground"
        )}
      >
        {entry.percentOfBest.toFixed(1)}%
      </span>
    </div>
  );

  if (!hasDetail) return row;

  // Mobile: tap to open drawer
  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{row}</DrawerTrigger>
        <DrawerContent className="bg-popover border-t border-border">
          <DrawerTitle className="sr-only">
            {t.weapon(entry.weaponId)}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {t.weapon(entry.weaponId)} R{entry.refinement}
          </DrawerDescription>
          <div className="p-4 pt-2 safe-area-bottom max-w-sm mx-auto">
            <WeaponDetailContent entry={entry} t={t} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: hover card
  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>{row}</HoverCardTrigger>
      <HoverCardContent
        side="right"
        className="w-64 p-3 border-border bg-popover"
      >
        <WeaponDetailContent entry={entry} t={t} />
      </HoverCardContent>
    </HoverCard>
  );
}

function CharacterWeaponPanel({
  charId,
  rankings,
  isMobile,
  t,
}: {
  charId: string;
  rankings: WeaponRanking[];
  isMobile: boolean;
  t: WeaponChoiceResultCardProps["t"];
}) {
  const highlightCount = getHighlightCount(rankings);
  return (
    <div className="flex flex-col rounded-md border border-border bg-background/30 overflow-hidden">
      <CharPanelHeader charId={charId} t={t} />
      <div className="overflow-y-auto max-h-72 md:max-h-96">
        {rankings.map((entry, idx) => (
          <WeaponEntryRow
            key={`${entry.weaponId}-${entry.refinement}`}
            entry={entry}
            idx={idx}
            isTop={idx < highlightCount}
            isMobile={isMobile}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Card ───

export function WeaponChoiceResultCard({
  charIds,
  isComputing,
  result,
  progress,
  error,
  onRun,
  onStop,
  t,
}: WeaponChoiceResultCardProps) {
  const isMobile = useMediaQuery("(max-width: 1023px)");

  // Local settings state (not persisted)
  const [enemyLevel, setEnemyLevel] = useState<number | string>(110);
  const [enemyRes, setEnemyRes] = useState<number | string>(10);
  const [rollMultiplier, setRollMultiplier] = useState(0.85);
  const [substatBudget, setSubstatBudget] =
    useState<SubstatBudgetPreset>("8_6");

  const handleRun = useCallback(() => {
    const lvl = Number(enemyLevel) || 110;
    const res = Number(enemyRes) || 10;
    onRun({
      calcContext: {
        enemyLevel: lvl,
        enemyRes: res / 100,
        rollMultiplier,
        substatBudget,
      },
      rollMultiplier,
      substatBudget,
    });
  }, [onRun, enemyLevel, enemyRes, rollMultiplier, substatBudget]);

  const hasResult = result && Object.keys(result.perCharacter).length > 0;

  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <span className={CARD_TITLE_CLS}>
          {t.ui("teamComp.weaponChoiceResults")}
        </span>
      </CardHeader>
      <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
        {/* Settings row */}
        <div className={CONTROLS_CLS}>
          <EnemyInputs
            enemyLevel={enemyLevel}
            enemyRes={enemyRes}
            onEnemyLevelChange={setEnemyLevel}
            onEnemyResChange={setEnemyRes}
            t={t}
          />
          <RollQualityInputs
            rollMultiplier={rollMultiplier}
            substatBudget={substatBudget}
            onRollMultiplierChange={setRollMultiplier}
            onSubstatBudgetChange={setSubstatBudget}
            t={t}
          />

          {/* Run / Stop button */}
          <Button
            onClick={isComputing ? onStop : handleRun}
            variant={isComputing ? "destructive" : "default"}
            size="sm"
            className="shrink-0"
          >
            {isComputing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                {t.ui("common.stop")}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                {t.ui("teamComp.runAnalysis")}
              </>
            )}
          </Button>
        </div>

        {/* Progress bar */}
        {isComputing && (
          <div className="space-y-1">
            <Progress
              value={Math.round((progress?.overallProgress ?? 0) * 100)}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {progress?.currentChar
                ? `${t.character(progress.currentChar)}${progress.currentWeapon ? ` — ${t.weapon(progress.currentWeapon)}` : ""}`
                : t.ui("teamComp.weaponChoiceRunning")}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {/* Results grid — always show character panels when charIds exist */}
        {charIds.length > 0 ? (
          <div
            className={cn(
              "grid gap-2",
              isMobile ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-4"
            )}
          >
            {charIds.map((charId) => {
              const rankings = hasResult
                ? result.perCharacter[charId]
                : undefined;

              if (rankings && rankings.length > 0) {
                return (
                  <CharacterWeaponPanel
                    key={charId}
                    charId={charId}
                    rankings={rankings}
                    isMobile={isMobile}
                    t={t}
                  />
                );
              }

              return (
                <div
                  key={charId}
                  className="flex flex-col rounded-md border border-border bg-background/30 overflow-hidden"
                >
                  <CharPanelHeader charId={charId} t={t} />
                  <div className="flex flex-col items-center justify-center py-6 px-2">
                    {isComputing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : hasResult ? (
                      <p className="text-xs text-muted-foreground text-center">
                        {t.ui("teamComp.noCompatibleWeapons")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center">
                        {t.ui("teamComp.weaponChoiceEmpty")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t.ui("teamComp.analyzerNoResults")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
