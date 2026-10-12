import { Loader2, Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { weaponStatsResource } from "@/data/gameStatsLoader";
import type { AccountData, ArtifactData } from "@/data/types";
import { useAsyncComputation } from "@/hooks/useAsyncComputation";
import { useTeamInventory } from "@/hooks/useTeamInventory";
import type { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import { runAccountEquipmentSearch } from "@/lib/team-comp/accountEquipment";
import type {
  AccountEquipmentOptions,
  AccountEquipmentResult,
  AccountEquipmentYield,
} from "@/lib/team-comp/accountEquipmentTypes";
import { fmtDamage } from "@/lib/team-comp/displayFormatter";
import type { TeamComp, TeamSetupConfig } from "@/lib/team-comp/types";
import { ArtifactSlotGrid } from "./ArtifactSlotGrid";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

interface AccountEquipmentCardProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  accountData: AccountData | null;
  configs: TeamSlotConfig[];
  objectiveCombo: ComboFormula;
  calcContext: CalcContext;
  baseSheets: Record<string, StatSheet>;
  onApply: (result: AccountEquipmentResult) => void;
  onSave: (result: AccountEquipmentResult) => void;
}
export function AccountEquipmentCard({
  teamComp,
  setupConfig,
  accountData,
  configs,
  objectiveCombo,
  calcContext,
  baseSheets,
  onApply,
  onSave,
}: AccountEquipmentCardProps) {
  const { t } = useLanguage();
  const weaponStats = weaponStatsResource.use();
  const inventory = useTeamInventory(teamComp.id);
  const memberIds = teamComp.slots.flatMap((slot) =>
    slot.charId ? [slot.charId] : []
  );
  const configuredIds = new Set(configs.map((config) => config.charId));
  const inputsComplete =
    memberIds.length > 0 &&
    configuredIds.size === memberIds.length &&
    memberIds.every((id) => configuredIds.has(id));
  const computation = useAsyncComputation<
    AccountEquipmentYield,
    AccountEquipmentYield,
    AccountEquipmentOptions
  >(runAccountEquipmentSearch);
  const inputKey = JSON.stringify({
    teamComp,
    configs,
    setupConfig: {
      damage: setupConfig.damage,
      combatOptions: setupConfig.combatOptions,
      charConfigs: setupConfig.charConfigs,
    },
    objectiveCombo,
    calcContext,
    accountData,
    inventory,
  });
  const previousInput = useRef(inputKey);
  useEffect(() => {
    if (previousInput.current === inputKey) return;
    previousInput.current = inputKey;
    computation.reset();
  }, [inputKey, computation.reset]);
  const outcome =
    inputsComplete && computation.result?.kind === "result"
      ? computation.result.result
      : null;
  const progress =
    computation.result?.kind === "progress" ? computation.result : null;
  const gain =
    outcome && outcome.baselineDamage > 0
      ? (outcome.damage / outcome.baselineDamage - 1) * 100
      : null;
  return (
    <Card className={CARD_CLS}>
      <CardHeader className={CARD_HEADER_CLS}>
        <span className={CARD_TITLE_CLS}>
          {t.ui("teamComp.accountEquipmentTask")}
        </span>
      </CardHeader>
      <CardContent className={CARD_BODY_CLS}>
        <div className="p-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t.ui("teamComp.accountEquipmentDesc")}
          </p>
          {!accountData && (
            <p className="text-sm text-muted-foreground">
              {t.ui("teamComp.accountEquipmentNoAccount")}
            </p>
          )}
          {!inputsComplete && (
            <p className="text-sm text-muted-foreground">
              {t.ui("teamComp.accountEquipmentMissingWeapons")}
            </p>
          )}
          <Button
            size="sm"
            disabled={
              !accountData ||
              !weaponStats ||
              !inputsComplete ||
              !objectiveCombo.lines.some((line) => line.count > 0)
            }
            onClick={() => {
              if (computation.isComputing) {
                computation.stop();
                return;
              }
              if (!accountData || !weaponStats || !inputsComplete) return;
              computation.start({
                configs,
                setupConfig,
                accountData,
                weaponStats,
                combo: objectiveCombo,
                calcContext,
                inventory: inventory.availableArtifacts,
                perCharExtraArtifacts: inventory.perCharExtraArtifacts,
                forceReuseChars: inventory.forceReuseChars,
                baseSheets,
              });
            }}
          >
            {computation.isComputing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            {computation.isComputing
              ? t.ui("common.stop")
              : t.ui("teamComp.runAnalysis")}
          </Button>
          {progress && computation.isComputing && (
            <p className="text-xs text-muted-foreground">
              {t.ui("teamComp.weaponChoiceRunning")} ({progress.evaluated})
            </p>
          )}
          {computation.error && (
            <p role="alert" className="text-sm text-destructive">
              {computation.error.message}
            </p>
          )}
          {inputsComplete &&
            computation.result?.kind === "result" &&
            !outcome && (
              <p className="text-sm text-muted-foreground">
                {t.ui("teamComp.accountEquipmentUnavailable")}
              </p>
            )}
          {outcome && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {t.ui("teamComp.accountEquipmentBestFound")}
                </span>
                <span className="font-mono text-primary">
                  {fmtDamage(outcome.damage)}
                  {gain === null
                    ? ""
                    : ` (${gain >= 0 ? "+" : ""}${gain.toFixed(1)}%)`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {outcome.configs.map((config) => (
                  <div
                    key={config.charId}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <ItemIcon characterId={config.charId} size="xs" />
                    <ItemIcon weaponId={config.weaponId} size="xs" />
                    <span className="text-xs">
                      {t.format("common.refinementFormat", config.refinement)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {outcome.configs.map((config) => (
                  <details
                    key={config.charId}
                    className="rounded-md border border-border p-2"
                  >
                    <summary className="cursor-pointer text-sm font-semibold">
                      {t.character(config.charId)} ·{" "}
                      {t.ui("accountData.artifacts")}
                    </summary>
                    <ArtifactSlotGrid
                      artifactsObj={
                        Object.fromEntries(
                          Object.entries(
                            outcome.artifactsByChar[config.charId]
                          ).filter(([, artifact]) => artifact !== null)
                        ) as Record<string, ArtifactData>
                      }
                      t={t}
                    />
                  </details>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onApply(outcome)}>
                  {t.ui("teamComp.applyToRoster")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSave(outcome)}
                >
                  {t.ui("teamComp.applyAndSave")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.ui("teamComp.accountEquipmentApproximate")}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
