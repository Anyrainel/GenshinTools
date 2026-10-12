import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  collectOwnedWeaponChoices,
  getCompatibleOwnedWeaponChoices,
} from "@/domain/combat/analyzer/weaponChoiceCandidates";
import type { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type {
  ComboFormula,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import { resolveCalcContext } from "@/domain/combat/damage/utils";
import type { AccountData } from "@/domain/models";
import { weaponStatsResource } from "@/domain/reference/stats";
import { buildWeaponChoiceCharConfigs } from "@/domain/team/teamConfigUtils";
import { teamCompToArrays } from "@/domain/team/teamDeltas";
import type {
  ChoiceResultCache,
  TeamComp,
  TeamSetupConfig,
  WeaponChoiceResult,
} from "@/domain/team/types";
import { useAsyncWeaponChoice } from "@/hooks/useAsyncWeaponChoice";
import { useResource } from "@/hooks/useResource";
import {
  choiceResultsFromTeamResultCache,
  useTeamResultCacheStore,
} from "@/stores/useTeamResultCacheStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { WeaponChoiceResultCard } from "./WeaponChoiceResultCard";

interface BuildComparisonPanelProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  accountData: AccountData | null;
  teamBuild: TeamBuild | null;
  configs: TeamSlotConfig[];
  objectiveCombo: ComboFormula;
}

export function BuildComparisonPanel({
  teamComp,
  setupConfig,
  accountData,
  teamBuild,
  configs,
  objectiveCombo,
}: BuildComparisonPanelProps) {
  const { t } = useLanguage();
  const weaponStats = useResource(weaponStatsResource);
  const updateTeamComp = useTeamStore((s) => s.updateTeamComp);
  const updateTeamSetupConfig = useTeamStore((s) => s.updateTeamSetupConfig);
  const resultCache = useTeamResultCacheStore(
    (s) => s.resultsByTeamId[teamComp.id]
  );
  const setChoiceResult = useTeamResultCacheStore((s) => s.setChoiceResult);
  const clearChoiceResults = useTeamResultCacheStore(
    (s) => s.clearChoiceResults
  );
  const [comparison, setComparison] = useState<"all" | "owned" | "artifact">(
    "all"
  );
  const mode = comparison === "artifact" ? "artifact" : "weapon";
  const owned = comparison === "owned";
  const { characters, weapons, artifacts } = useMemo(
    () => teamCompToArrays(teamComp),
    [teamComp]
  );
  const ownedChoices = useMemo(
    () => (accountData ? collectOwnedWeaponChoices(accountData) : []),
    [accountData]
  );
  const {
    result: computed,
    isComputing,
    error,
    start,
    stop,
  } = useAsyncWeaponChoice();
  const [localResults, setLocalResults] = useState<ChoiceResultCache>({});
  const [ownedResult, setOwnedResult] = useState<WeaponChoiceResult | null>(
    null
  );
  const inputKey = JSON.stringify({
    teamComp,
    configs,
    objectiveCombo,
    damage: setupConfig.damage,
    combat: setupConfig.combatOptions,
    requirements: setupConfig.charConfigs,
  });
  const ownedInputKey = JSON.stringify(ownedChoices);
  const previousOwnedInput = useRef(ownedInputKey);
  const previousInput = useRef(inputKey);
  const runInput = useRef<string | null>(null);
  const runOwned = useRef(false);
  const updateSetup = useCallback(
    (
      updater:
        | Partial<TeamSetupConfig>
        | ((config: TeamSetupConfig) => TeamSetupConfig)
    ) => updateTeamSetupConfig(teamComp.id, updater),
    [teamComp.id, updateTeamSetupConfig]
  );

  useEffect(() => {
    if (previousOwnedInput.current === ownedInputKey) return;
    previousOwnedInput.current = ownedInputKey;
    setOwnedResult(null);
    if (runOwned.current) {
      runInput.current = null;
      stop();
    }
  }, [ownedInputKey, stop]);

  useEffect(() => {
    if (previousInput.current === inputKey) return;
    previousInput.current = inputKey;
    runInput.current = null;
    stop();
    setLocalResults({});
    setOwnedResult(null);
    clearChoiceResults(teamComp.id);
  }, [inputKey, stop, clearChoiceResults, teamComp.id]);

  useEffect(() => {
    if (!computed || runInput.current !== inputKey) return;
    const result: WeaponChoiceResult = {
      mode: computed.mode,
      timestamp: computed.timestamp,
      perCharacter: computed.perCharacter,
      artifactAssignmentSuggestion: computed.artifactAssignmentSuggestion,
    };
    if (runOwned.current && computed.mode === "weapon") setOwnedResult(result);
    else {
      setLocalResults((prev) => ({ ...prev, [computed.mode]: result }));
      if (computed.done)
        setChoiceResult(teamComp.id, computed.mode, result, inputKey);
    }
  }, [computed, inputKey, setChoiceResult, teamComp.id]);

  const run = () => {
    if (!teamBuild || !weaponStats) return;
    runInput.current = inputKey;
    runOwned.current = owned;
    start({
      mode,
      baseConfigs: configs,
      charConfigs: buildWeaponChoiceCharConfigs(
        teamComp,
        setupConfig,
        accountData
      ),
      combo: objectiveCombo,
      calcContext: resolveCalcContext(setupConfig.damage?.calcContext),
      weaponStats,
      opts: setupConfig.combatOptions ?? {},
      enemyAura: setupConfig.damage?.enemyAura,
      extraBuffs: setupConfig.damage?.extraBuffs,
      ownedWeaponChoices: owned ? ownedChoices : undefined,
    });
  };
  const persist = (
    resultMode: "weapon" | "artifact",
    result: WeaponChoiceResult | null
  ) => {
    if (owned && resultMode === "weapon") setOwnedResult(result);
    else {
      setLocalResults((prev) => ({ ...prev, [resultMode]: result }));
      setChoiceResult(teamComp.id, resultMode, result, inputKey);
    }
  };
  if (!teamBuild || !weaponStats) return null;
  const cached = choiceResultsFromTeamResultCache(resultCache);
  if (resultCache?.weaponChoiceInputKey !== inputKey) cached.weapon = undefined;
  if (resultCache?.artifactChoiceInputKey !== inputKey)
    cached.artifact = undefined;
  return (
    <WeaponChoiceResultCard
      teamComp={teamComp}
      setupConfig={setupConfig}
      characters={characters}
      weapons={weapons}
      artifacts={artifacts}
      teamMeta={teamBuild.teamMeta}
      onTeamCompChange={(comp) => updateTeamComp(comp.id, comp)}
      onSetupConfigChange={updateSetup}
      setChoiceResult={persist}
      charIds={characters.filter((id): id is string => id !== null)}
      isComputing={isComputing}
      choiceMode={mode}
      ownedWeaponsOnly={owned}
      onComparisonChange={(next) => {
        stop();
        runInput.current = null;
        setComparison(next);
      }}
      hasAccount={accountData !== null}
      hasOwnedCompatibleWeapons={configs.some(
        (config) =>
          getCompatibleOwnedWeaponChoices(
            ownedChoices,
            weaponStats[config.weaponId]?.type ?? "",
            weaponStats
          ).length > 0
      )}
      runDisabled={owned && !accountData}
      result={
        owned ? ownedResult : (localResults[mode] ?? cached[mode] ?? null)
      }
      progress={computed?.progress}
      error={error}
      onRun={run}
      onStop={stop}
      t={t}
    />
  );
}
