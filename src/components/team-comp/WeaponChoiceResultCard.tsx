import { ArrowRight, Loader2, Play } from "lucide-react";
import { type ReactNode, useCallback } from "react";
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
import {
  OptionButton,
  OptionButtonCell,
  OptionButtonRow,
} from "@/components/ui/option-button";
import { Progress } from "@/components/ui/progress";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { SubStat } from "@/data/enums";
import {
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/gameResources";
import type { ArtifactSetConfig } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DEFAULT_CALC_CONTEXT } from "@/lib/dmgcalc/constants";
import type { CalcContext } from "@/lib/dmgcalc/types";
import type { WeaponChoiceProgress } from "@/lib/team-comp/analyzer/weaponChoice";
import { fmtDamage } from "@/lib/team-comp/displayFormatter";
import type {
  ArtifactAssignmentSuggestion,
  ChoiceRanking,
  TeamComp,
  TeamSetupConfig,
  WeaponChoiceResult,
} from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
  CONTROLS_CLS,
} from "./cardStyles";
import {
  CharCrErSettings,
  EnemyInputs,
  RollQualityInputs,
} from "./GeneratorControls";

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

function getHalfSetStatLabel(
  halfSetId: string,
  t: WeaponChoiceResultCardProps["t"]
): string {
  const [statKey] = halfSetId.split("-");
  return statKey ? t.statShort(statKey) : halfSetId;
}

function getArtifactSetLabel(
  artifactSet: ArtifactSetConfig,
  t: WeaponChoiceResultCardProps["t"]
): string {
  if (artifactSet.type === "4pc") return t.artifact(artifactSet.setId);

  return artifactSet.halfSetIds
    .map((halfSetId) => getHalfSetStatLabel(halfSetId, t))
    .join(" + ");
}

function getArtifactAssignmentKey(
  artifactSet: ArtifactSetConfig | null
): string {
  if (!artifactSet) return "none";
  if (artifactSet.type === "4pc") return artifactSet.setId;
  return [...artifactSet.halfSetIds].sort().join("+");
}

function formatArtifactProgressTarget(
  target: string,
  t: WeaponChoiceResultCardProps["t"]
): string {
  if (!target.includes("+")) return t.artifact(target);
  return target
    .split("+")
    .map((halfSetId) => getHalfSetStatLabel(halfSetId, t))
    .join(" + ");
}

function ArtifactChoiceHoverIcon({
  artifactSet,
}: {
  artifactSet: ArtifactSetConfig;
}) {
  if (artifactSet.type === "4pc") {
    return (
      <ItemIcon
        artifactSetId={artifactSet.setId}
        size="sm"
        className="shrink-0"
      />
    );
  }

  return <ItemIcon halfSetIds={artifactSet.halfSetIds} size="sm" />;
}

function ArtifactChoiceRowIcon({
  artifactSet,
  label,
}: {
  artifactSet: ArtifactSetConfig;
  label: string;
}) {
  if (artifactSet.type === "4pc") {
    const artifact = artifactsById[artifactSet.setId];
    if (artifact) {
      return (
        <img
          src={getAssetUrl(artifact.imagePaths.flower)}
          alt={label}
          className="w-5 h-5 lg:w-7 lg:h-7 object-cover shrink-0"
          draggable={false}
        />
      );
    }
  }

  return (
    <div
      className={cn(
        "grid place-items-center shrink-0 rounded-md border border-border bg-background/50 font-bold text-muted-foreground",
        "w-5 h-5 lg:w-7 lg:h-7 text-xs"
      )}
    >
      2+2
    </div>
  );
}

interface WeaponChoiceResultCardProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactSetConfig | null)[];
  onTeamCompChange: (comp: TeamComp) => void;
  onSetupConfigChange: (
    updater:
      | Partial<TeamSetupConfig>
      | ((config: TeamSetupConfig) => TeamSetupConfig)
  ) => void;
  setChoiceResult: (
    mode: "weapon" | "artifact",
    result: WeaponChoiceResult | null
  ) => void;
  charIds: string[];
  isComputing: boolean;
  choiceMode: "weapon" | "artifact";
  onChoiceModeChange: (mode: "weapon" | "artifact") => void;
  result: WeaponChoiceResult | null;
  progress?: WeaponChoiceProgress;
  error: Error | null;
  onRun: () => void;
  onStop: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}

// ─── Character panel header (reused across all states) ───

function CharPanelHeader({
  charId,
  scopeHint,
  t,
}: {
  charId: string;
  scopeHint?: string;
  t: WeaponChoiceResultCardProps["t"];
}) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-1.5 lg:gap-1.5 lg:px-2 border-b border-border bg-background/50">
      {charactersById[charId] && (
        <img
          src={getAssetUrl(charactersById[charId].imagePath)}
          alt={t.character(charId)}
          className="w-5 h-5 lg:w-6 lg:h-6 rounded-full shrink-0"
        />
      )}
      <span className="text-xs md:text-sm lg:text-xs xl:text-sm font-bold truncate">
        {t.character(charId)}
      </span>
      {scopeHint && (
        <span className="text-xs text-muted-foreground shrink-0">
          {scopeHint}
        </span>
      )}
    </div>
  );
}

// ─── Weapon entry hover card content ───

function WeaponDetailContent({
  entry,
  characters,
  weapons,
  charId,
  t,
}: {
  entry: ChoiceRanking;
  characters?: (string | null)[];
  weapons?: (string | null)[];
  charId: string;
  t: WeaponChoiceResultCardProps["t"];
}) {
  const charIndex = characters?.indexOf(charId) ?? -1;
  const currentWeaponId = weapons && charIndex >= 0 ? weapons[charIndex] : null;

  return (
    <div className="space-y-2 text-xs">
      {/* Header: weapon + artifact set icons */}
      <div className="flex items-center gap-2">
        {entry.type === "artifact" ? (
          <ArtifactChoiceHoverIcon artifactSet={entry.artifactSet} />
        ) : (
          <ItemIcon weaponId={entry.weaponId} size="xs" className="shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">
            {entry.type === "artifact"
              ? getArtifactSetLabel(entry.artifactSet, t)
              : `${t.weapon(entry.weaponId)} R${entry.refinement}`}
          </div>
          <div className="text-muted-foreground">
            {entry.percentOfBest.toFixed(1)}%
          </div>
        </div>
        {entry.type === "artifact" && currentWeaponId ? (
          <ItemIcon weaponId={currentWeaponId} size="xs" className="shrink-0" />
        ) : entry.artifactSetIds ? (
          <div className="flex gap-0.5 shrink-0">
            {entry.artifactSetIds.map((setId) => (
              <ItemIcon key={setId} artifactSetId={setId} size="xs" />
            ))}
          </div>
        ) : null}
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
function getHighlightCount(rankings: ChoiceRanking[]): number {
  if (rankings.length === 0) return 0;
  let count = 0;
  for (const r of rankings) {
    if (r.percentOfBest >= 99) count++;
    else break;
  }
  count = Math.min(count, 5);

  const top = rankings[0];
  if (top.type === "artifact") return count;
  const topRes = weaponsById[top.weaponId];
  if (topRes?.rarity === 5 && top.refinement === 5) {
    const r1Idx = rankings.findIndex(
      (r) =>
        r.type !== "artifact" &&
        r.weaponId === top.weaponId &&
        r.refinement === 1
    );
    if (r1Idx >= 0) count = Math.max(count, r1Idx + 1);
  }

  return count;
}

function WeaponEntryRow({
  entry,
  characters,
  weapons,
  charId,
  idx,
  isTop,
  isMobile,
  t,
}: {
  entry: ChoiceRanking;
  characters?: (string | null)[];
  weapons?: (string | null)[];
  charId: string;
  idx: number;
  isTop: boolean;
  isMobile: boolean;
  t: WeaponChoiceResultCardProps["t"];
}) {
  let icon: ReactNode = null;
  let label = "";
  let detailLabel = "";
  let refinementLabel: ReactNode = null;

  if (entry.type === "artifact") {
    label = getArtifactSetLabel(entry.artifactSet, t);
    detailLabel = label;
    icon = (
      <ArtifactChoiceRowIcon artifactSet={entry.artifactSet} label={label} />
    );
  } else {
    const weapon = weaponsById[entry.weaponId];
    label = t.weapon(entry.weaponId);
    detailLabel = `${label} R${entry.refinement}`;
    refinementLabel = (
      <span className="text-muted-foreground shrink-0">
        R{entry.refinement}
      </span>
    );
    if (weapon) {
      icon = (
        <img
          src={getAssetUrl(weapon.imagePath)}
          alt={label}
          className="w-5 h-5 lg:w-7 lg:h-7 object-cover shrink-0"
          draggable={false}
        />
      );
    }
  }

  const hasDetail = !!(entry.mainStats || entry.substatRolls);

  const row = (
    <div
      className={cn(
        "flex items-center gap-1 px-1 py-1 text-xs md:text-sm lg:gap-1.5 lg:px-2 lg:text-xs xl:text-sm",
        isTop
          ? "bg-sky-900/30 border border-sky-600/30"
          : "border border-transparent",
        hasDetail && "cursor-default"
      )}
    >
      <span className="w-4 lg:w-5 text-right text-muted-foreground font-mono shrink-0">
        {idx + 1}
      </span>
      {icon}
      <span className="truncate flex-1 font-medium">{label}</span>
      {refinementLabel}
      <span
        className={cn(
          "w-11 lg:w-14 text-right font-mono font-bold shrink-0",
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
          <DrawerTitle className="sr-only">{label}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {detailLabel}
          </DrawerDescription>
          <div className="p-4 pt-2 safe-area-bottom max-w-sm mx-auto">
            <WeaponDetailContent
              entry={entry}
              characters={characters}
              weapons={weapons}
              charId={charId}
              t={t}
            />
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
        <WeaponDetailContent
          entry={entry}
          characters={characters}
          weapons={weapons}
          charId={charId}
          t={t}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

/** Exported for reuse in preview components */
export function CharacterWeaponPanel({
  charId,
  characters,
  weapons,
  rankings,
  scopeHint,
  isMobile,
  t,
}: {
  charId: string;
  characters?: (string | null)[];
  weapons?: (string | null)[];
  rankings: ChoiceRanking[];
  scopeHint?: string;
  isMobile: boolean;
  t: WeaponChoiceResultCardProps["t"];
}) {
  const highlightCount = getHighlightCount(rankings);
  return (
    <div className="flex flex-col rounded-md border border-border bg-background/30 overflow-hidden">
      <CharPanelHeader charId={charId} scopeHint={scopeHint} t={t} />
      <div className="overflow-y-auto max-h-72 md:max-h-96">
        {rankings.map((entry, idx) => (
          <WeaponEntryRow
            key={
              entry.type === "artifact"
                ? `artifact-${entry.artifactSetIds.join("-")}`
                : `${entry.weaponId}-${entry.refinement}`
            }
            entry={entry}
            characters={characters}
            weapons={weapons}
            charId={charId}
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

function ArtifactAssignmentCard({
  suggestion,
  teamComp,
  characters,
  artifacts,
  result,
  onTeamCompChange,
  setChoiceResult,
  t,
}: {
  suggestion: ArtifactAssignmentSuggestion;
  teamComp: TeamComp;
  characters: (string | null)[];
  artifacts: (ArtifactSetConfig | null)[];
  result: WeaponChoiceResult;
  onTeamCompChange: (comp: TeamComp) => void;
  setChoiceResult: (
    mode: "weapon" | "artifact",
    result: WeaponChoiceResult | null
  ) => void;
  t: WeaponChoiceResultCardProps["t"];
}) {
  const improvement = Math.max(0, suggestion.percentImprovement);
  const hasImprovement = improvement > 0.05;

  const handleApply = useCallback(() => {
    const assignmentByChar = new Map(
      suggestion.assignments.map(({ charId, artifactSet }) => [
        charId,
        artifactSet,
      ])
    );
    const nextArtifacts = [...artifacts];
    characters.forEach((charId, index) => {
      if (!charId || !assignmentByChar.has(charId)) return;
      nextArtifacts[index] = assignmentByChar.get(charId) ?? null;
    });

    const nextResult: WeaponChoiceResult = {
      ...result,
      artifactAssignmentSuggestion: {
        ...suggestion,
        currentDamage: suggestion.bestDamage,
        percentImprovement: 0,
      },
    };

    onTeamCompChange({
      ...teamComp,
      slots: teamComp.slots.map((slot, index) => ({
        ...slot,
        artifactSet: nextArtifacts[index] ?? null,
      })),
    });
    setChoiceResult("artifact", nextResult);
  }, [
    artifacts,
    characters,
    onTeamCompChange,
    result,
    setChoiceResult,
    suggestion,
    teamComp,
  ]);

  return (
    <div className="rounded-md border border-border bg-background/30 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">
            {t.ui("teamComp.artifactAssignmentSuggestion")}
          </span>
          <span
            className={cn(
              "text-xs font-semibold",
              hasImprovement
                ? "text-amber-400/80 tabular-nums"
                : "text-muted-foreground"
            )}
          >
            {hasImprovement
              ? `${t.ui("teamComp.artifactAssignmentImprovesBy")} +${improvement.toFixed(1)}%`
              : t.ui("teamComp.artifactAssignmentNoChange")}
          </span>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-6 px-2 py-1 text-xs"
          onClick={handleApply}
          disabled={!hasImprovement}
        >
          {t.ui("teamComp.artifactAssignmentApply")}
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-2 p-3 md:gap-6">
        {suggestion.assignments.map(({ charId, artifactSet }) => {
          const label = artifactSet
            ? getArtifactSetLabel(artifactSet, t)
            : t.ui("common.none");
          const charIndex = characters.indexOf(charId);
          const currentArtifactSet =
            charIndex >= 0 ? (artifacts[charIndex] ?? null) : null;
          const assignmentChanged =
            getArtifactAssignmentKey(currentArtifactSet) !==
            getArtifactAssignmentKey(artifactSet);
          return (
            <div key={charId} className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                {artifactSet ? (
                  <ArtifactChoiceRowIcon
                    artifactSet={artifactSet}
                    label={label}
                  />
                ) : (
                  <div className="w-6 h-6 md:w-7 md:h-7 shrink-0" />
                )}
              </div>
              <ArrowRight
                strokeWidth={4}
                className={cn(
                  "w-4 h-4 shrink-0",
                  assignmentChanged
                    ? "text-amber-400/80"
                    : "text-muted-foreground"
                )}
              />
              <div className="flex items-center gap-1.5 min-w-0">
                {charactersById[charId] && (
                  <img
                    src={getAssetUrl(charactersById[charId].imagePath)}
                    alt={t.character(charId)}
                    className="w-6 h-6 rounded-full shrink-0"
                    draggable={false}
                  />
                )}
                <div className="min-w-0">
                  <div className="max-w-24 truncate text-xs font-semibold md:max-w-32">
                    {t.character(charId)}
                  </div>
                  <div className="max-w-24 truncate text-xs text-muted-foreground md:max-w-32">
                    {label}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Card ───

export function WeaponChoiceResultCard({
  teamComp,
  setupConfig,
  characters,
  weapons,
  artifacts,
  onTeamCompChange,
  onSetupConfigChange,
  setChoiceResult,
  charIds,
  isComputing,
  choiceMode,
  onChoiceModeChange,
  result,
  progress,
  error,
  onRun,
  onStop,
  t,
}: WeaponChoiceResultCardProps) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const ctx = setupConfig.damage?.calcContext ?? {};

  const patchCtx = useCallback(
    (patch: Partial<CalcContext>) => {
      onSetupConfigChange((config) => ({
        ...config,
        damage: {
          ...(config.damage ?? {}),
          calcContext: { ...(config.damage?.calcContext ?? {}), ...patch },
        },
      }));
    },
    [onSetupConfigChange]
  );

  const hasResult = result && Object.keys(result.perCharacter).length > 0;
  const scopeHint = t.ui("teamComp.choiceOthersUnchanged");
  const formatProgressTarget = useCallback(
    (target?: string) => {
      if (!target) return "";
      const label =
        choiceMode === "artifact"
          ? formatArtifactProgressTarget(target, t)
          : t.weapon(target);
      return ` - ${label}`;
    },
    [choiceMode, t]
  );

  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <span className={CARD_TITLE_CLS}>
          {t.ui("teamComp.weaponChoiceResults")}
        </span>
      </CardHeader>
      <OptionButtonRow>
        {(
          [
            {
              key: "weapon" as const,
              label: "teamComp.choiceModeWeapon" as const,
              desc: "teamComp.choiceModeWeaponDesc" as const,
            },
            {
              key: "artifact" as const,
              label: "teamComp.choiceModeArtifact" as const,
              desc: "teamComp.choiceModeArtifactDesc" as const,
            },
          ] as const
        ).map(({ key, label, desc }) => (
          <OptionButtonCell key={key}>
            <OptionButton
              selected={choiceMode === key}
              onClick={() => onChoiceModeChange(key)}
              title={t.ui(label)}
              subtitle={t.ui(desc)}
            />
          </OptionButtonCell>
        ))}
      </OptionButtonRow>
      <CardContent className={cn(CARD_BODY_CLS, "space-y-2")}>
        {/* Per-character CR/ER settings */}
        <CharCrErSettings
          characters={characters}
          charConfigs={setupConfig.charConfigs}
          onCharConfigsChange={(charConfigs) =>
            onSetupConfigChange({ charConfigs })
          }
          t={t}
        />

        {/* Settings row */}
        <div className={CONTROLS_CLS}>
          <EnemyInputs
            enemyLevel={ctx.enemyLevel ?? ""}
            enemyRes={
              ctx.enemyRes != null ? Math.round(ctx.enemyRes * 100) : ""
            }
            onEnemyLevelChange={(raw) => {
              const num = Number(raw);
              if (!Number.isNaN(num)) patchCtx({ enemyLevel: num });
            }}
            onEnemyResChange={(raw) => {
              const num = Number(raw);
              if (!Number.isNaN(num)) patchCtx({ enemyRes: num / 100 });
            }}
            t={t}
          />
          <RollQualityInputs
            rollMultiplier={
              ctx.rollMultiplier ?? DEFAULT_CALC_CONTEXT.rollMultiplier
            }
            substatBudget={
              ctx.substatBudget ?? DEFAULT_CALC_CONTEXT.substatBudget
            }
            onRollMultiplierChange={(v) => patchCtx({ rollMultiplier: v })}
            onSubstatBudgetChange={(v) => patchCtx({ substatBudget: v })}
            t={t}
          />

          <Button
            onClick={isComputing ? onStop : onRun}
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

        {/* Progress chips with ring spinners */}
        {isComputing && (
          <div className="space-y-1.5">
            <Progress
              value={Math.round((progress?.overallProgress ?? 0) * 100)}
              className="h-2"
            />
            {progress?.chars && progress.chars.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {progress.chars.map((cp) => {
                  const pct = cp.total > 0 ? cp.done / cp.total : 1;
                  const isDone = pct >= 1;
                  const target = formatProgressTarget(
                    cp.currentTarget ?? cp.currentWeapon
                  );
                  const r = 7;
                  const circ = 2 * Math.PI * r;
                  const offset = circ * (1 - pct);
                  return (
                    <span
                      key={cp.charId}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${isDone ? "border-border text-muted-foreground" : "border-primary/30 text-foreground"}`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 18 18"
                        className="shrink-0"
                      >
                        <circle
                          cx="9"
                          cy="9"
                          r={r}
                          fill="none"
                          strokeWidth="2.5"
                          className="stroke-muted"
                        />
                        <circle
                          cx="9"
                          cy="9"
                          r={r}
                          fill="none"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          className={
                            isDone
                              ? "stroke-muted-foreground"
                              : "stroke-primary"
                          }
                          strokeDasharray={circ}
                          strokeDashoffset={offset}
                          transform="rotate(-90 9 9)"
                        />
                      </svg>
                      {t.character(cp.charId)} {Math.round(pct * 100)}%{target}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t.ui("teamComp.weaponChoiceRunning")}
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {choiceMode === "artifact" && result?.artifactAssignmentSuggestion && (
          <ArtifactAssignmentCard
            suggestion={result.artifactAssignmentSuggestion}
            teamComp={teamComp}
            characters={characters}
            artifacts={artifacts}
            result={result}
            onTeamCompChange={onTeamCompChange}
            setChoiceResult={setChoiceResult}
            t={t}
          />
        )}

        {/* Results grid — always show character panels when charIds exist */}
        {charIds.length > 0 ? (
          <div className={cn("grid grid-cols-2 gap-2 lg:grid-cols-4")}>
            {charIds.map((charId) => {
              const rankings = hasResult
                ? result.perCharacter[charId]
                : undefined;

              if (rankings && rankings.length > 0) {
                return (
                  <CharacterWeaponPanel
                    key={charId}
                    charId={charId}
                    characters={characters}
                    weapons={weapons}
                    rankings={rankings}
                    scopeHint={scopeHint}
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
                  <CharPanelHeader
                    charId={charId}
                    scopeHint={scopeHint}
                    t={t}
                  />
                  <div className="flex flex-col items-center justify-center py-6 px-2">
                    {isComputing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : hasResult ? (
                      <p className="text-xs text-muted-foreground text-center">
                        {t.ui(
                          choiceMode === "artifact"
                            ? "teamComp.noCompatibleArtifactSets"
                            : "teamComp.noCompatibleWeapons"
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center">
                        {t.ui(
                          choiceMode === "artifact"
                            ? "teamComp.artifactChoiceEmpty"
                            : "teamComp.weaponChoiceEmpty"
                        )}
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
