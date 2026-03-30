import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useLanguage } from "@/contexts/LanguageContext";
import { weaponsById } from "@/data/constants";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { SubstatBudgetPreset } from "@/lib/team-comp/substatBudget";
import type { CalcContext } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { WeaponChoiceResult, WeaponRanking } from "@/stores/useTeamStore";
import { Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

// ─── Shared style constants (matching AnalyzerResultCard) ───

const LABEL_CLS =
  "font-semibold text-foreground/80 select-none whitespace-nowrap text-[10px] md:text-sm";

const CONTROLS_CLS =
  "flex flex-wrap items-center justify-center mb-3 gap-x-2 gap-y-1 md:gap-x-5 md:gap-y-2";

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
  error: Error | null;
  onRun: (settings: WeaponChoiceCalcSettings) => void;
  onStop: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}

// ─── Per-character weapon ranking panel ───

function CharacterWeaponPanel({
  charId,
  rankings,
  t,
}: {
  charId: string;
  rankings: WeaponRanking[];
  t: WeaponChoiceResultCardProps["t"];
}) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-background/30 overflow-hidden">
      <div className="px-2 py-1.5 border-b border-border bg-background/50">
        <span className="text-sm font-bold truncate">
          {t.character(charId)}
        </span>
      </div>
      <div className="overflow-y-auto max-h-72 md:max-h-96">
        {rankings.map((entry, idx) => {
          const weapon = weaponsById[entry.weaponId];
          const isBest = idx === 0;
          return (
            <div
              key={`${entry.weaponId}-${entry.refinement}`}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-xs md:text-sm",
                isBest
                  ? "bg-sky-900/30 border border-sky-600/30"
                  : "border border-transparent"
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
                  isBest ? "text-sky-300" : "text-foreground"
                )}
              >
                {entry.percentOfBest.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Card ───

export function WeaponChoiceResultCard({
  charIds,
  isComputing,
  result,
  error,
  onRun,
  onStop,
  t,
}: WeaponChoiceResultCardProps) {
  const isMobile = useMediaQuery("(max-width: 1023px)");

  // Local settings state (not persisted)
  const [enemyLevel, setEnemyLevel] = useState(110);
  const [enemyRes, setEnemyRes] = useState(10);
  const [rollMultiplier, setRollMultiplier] = useState(0.85);
  const [substatBudget, setSubstatBudget] =
    useState<SubstatBudgetPreset>("8_6");

  const handleRun = useCallback(() => {
    onRun({
      calcContext: {
        enemyLevel,
        enemyRes: enemyRes / 100,
        rollMultiplier,
        substatBudget,
      },
      rollMultiplier,
      substatBudget,
    });
  }, [onRun, enemyLevel, enemyRes, rollMultiplier, substatBudget]);

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
          {/* Enemy Level */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className={LABEL_CLS}>{t.ui("teamComp.enemyLevel")}</span>
            <Input
              type="text"
              inputMode="numeric"
              value={enemyLevel}
              placeholder="110"
              onChange={(e) => {
                const num = Number(e.target.value);
                if (!Number.isNaN(num)) setEnemyLevel(num);
              }}
              className="text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1"
            />
          </div>

          {/* Enemy Res */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className={LABEL_CLS}>{t.ui("teamComp.enemyRes")}</span>
            <div className="flex items-center gap-0">
              <Input
                type="number"
                value={enemyRes}
                placeholder="10"
                onChange={(e) => {
                  const num = Number(e.target.value);
                  if (!Number.isNaN(num)) setEnemyRes(num);
                }}
                className="text-center font-bold border-border/20 bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs h-6 w-8 px-0.5 py-0 leading-none md:text-sm md:h-7 md:w-10 md:px-1"
              />
              <span className="font-bold text-muted-foreground text-[10px] md:text-xs">
                %
              </span>
            </div>
          </div>

          {/* Roll Multiplier */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className={LABEL_CLS}>{t.ui("teamComp.rollMultiplier")}</span>
            <Select
              value={String(rollMultiplier)}
              onValueChange={(v) => setRollMultiplier(Number(v))}
            >
              <SelectTrigger className="font-bold border-border/20 bg-background/50 text-xs h-6 w-14 px-1 py-0 md:text-sm md:h-7 md:w-16 md:px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0].map((v) => (
                  <SelectItem key={v} value={String(v)}>
                    {v}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Substat Budget */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className={LABEL_CLS}>{t.ui("teamComp.substatBudget")}</span>
            <Select
              value={substatBudget}
              onValueChange={(v) => setSubstatBudget(v as SubstatBudgetPreset)}
            >
              <SelectTrigger className="font-bold border-border/20 bg-background/50 min-w-0 max-w-[9rem] text-xs h-6 px-1 py-0 md:text-sm md:h-7 md:max-w-[10rem] md:px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8_6">8/6 (5/4★)</SelectItem>
                <SelectItem value="8_7">8/7 (5/4★)</SelectItem>
                <SelectItem value="9_7">9/7 (5/4★)</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            <Progress value={0} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {t.ui("teamComp.weaponChoiceRunning")}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {/* Results grid */}
        {result ? (
          <div
            className={cn(
              "grid gap-2",
              isMobile ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-4"
            )}
          >
            {charIds.map((charId) => {
              const rankings = result.perCharacter[charId];
              if (!rankings || rankings.length === 0) {
                return (
                  <div
                    key={charId}
                    className="flex flex-col rounded-md border border-border bg-background/30 overflow-hidden"
                  >
                    <div className="px-2 py-1.5 border-b border-border bg-background/50">
                      <span className="text-sm font-bold truncate">
                        {t.character(charId)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground text-center py-4 px-2">
                      {t.ui("teamComp.noCompatibleWeapons")}
                    </p>
                  </div>
                );
              }
              return (
                <CharacterWeaponPanel
                  key={charId}
                  charId={charId}
                  rankings={rankings}
                  t={t}
                />
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
