import { Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArtifactDataHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { CharAvatar } from "@/components/shared/CharAvatar";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  OptionButton,
  OptionButtonCell,
  OptionButtonRow,
} from "@/components/ui/option-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { CalcContext, ComboFormula } from "@/domain/combat/damage/types";
import type { AccountData } from "@/domain/models";
import type {
  CharacterStatsMap,
  WeaponStatsMap,
} from "@/domain/reference/stats";
import type {
  CharacterReplacementFailure,
  CharacterReplacementMessage,
  CharacterReplacementResult,
  CharacterReplacementSettings,
  CharacterReplacementWorkerMessage,
  CharacterSlotReplacementRanking,
} from "@/domain/team/characterReplacementTypes";
import type { TeamComp, TeamSetupConfig } from "@/domain/team/types";
import { resolveRosterWeaponCopies } from "@/domain/team/weaponCopies";
import { useFreezeStore } from "@/stores/useFreezeStore";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
  CONTROLS_CLS,
} from "./cardStyles";
import { EnemyInputs, RollQualityInputs } from "./GeneratorControls";
import { TeamCharacterGrid } from "./TeamCharacterGrid";

interface CharacterReplacementDetailProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  accountData: AccountData | null;
  characterStats: CharacterStatsMap | null;
  weaponStats: WeaponStatsMap | null;
  objective: ComboFormula;
  calcContext: CalcContext;
  updateTeamComp: (id: string, next: TeamComp) => void;
  updateTeamSetupConfig: (
    id: string,
    updater:
      | Partial<TeamSetupConfig>
      | ((config: TeamSetupConfig) => TeamSetupConfig)
  ) => void;
  ignoredCharIds?: ReadonlySet<string>;
  onIgnoredCharIdsChange?: (ids: ReadonlySet<string>) => void;
}
type Submode = "replace" | "unowned";
type Outcome = Extract<CharacterReplacementMessage, { type: "result" }>;
interface LocalState {
  teamId: string;
  signature: string;
  mode: Submode;
  settings: CharacterReplacementSettings;
  outcome: Outcome | null;
  rankings: CharacterSlotReplacementRanking[];
  error: CharacterReplacementFailure | null;
}
const teamStates = new Map<string, LocalState>();
const teamModes = new Map<string, Submode>();

function defaultSettings(
  hasAccount: boolean,
  mode: Submode
): CharacterReplacementSettings {
  return {
    replaceSlots: [],
    pool: mode === "unowned" || hasAccount ? "owned-owned" : "all-any",
    artifactBasis: "generated",
    constellation4: 6,
    constellation5: 0,
    refinement34: 5,
    refinement5: 1,
  };
}

export function CharacterReplacementDetail({
  teamComp,
  setupConfig,
  accountData,
  characterStats,
  weaponStats,
  objective,
  calcContext,
  updateTeamComp,
  updateTeamSetupConfig,
  ignoredCharIds,
  onIgnoredCharIdsChange,
}: CharacterReplacementDetailProps) {
  const { t } = useLanguage();
  const reservedIds = useFreezeStore((state) => state.frozenArtifactIds);
  const reuseMode = useFreezeStore((state) => state.reuseMode);
  const signature = JSON.stringify({
    teamComp,
    setupConfig,
    accountData,
    objective,
    calcContext,
    ignoredCharIds: [...(ignoredCharIds ?? [])],
  });
  const initial = (
    mode: Submode = teamModes.get(teamComp.id) ?? "replace"
  ): LocalState => {
    const cached = teamStates.get(`${teamComp.id}:${mode}`);
    return {
      teamId: teamComp.id,
      signature,
      mode,
      settings: cached?.settings ?? defaultSettings(!!accountData, mode),
      outcome: cached?.signature === signature ? cached.outcome : null,
      rankings: cached?.signature === signature ? cached.rankings : [],
      error: null,
    };
  };
  const [local, setLocal] = useState<LocalState>(initial);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Extract<
    CharacterReplacementMessage,
    { type: "progress" }
  > | null>(null);
  const worker = useRef<Worker | null>(null);
  const latestSignature = useRef(signature);
  latestSignature.current = signature;
  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    setRunning(false);
    setProgress(null);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: Actual shared inputs invalidate results while per-team/submode controls remain cached.
  useEffect(() => {
    stop();
    setLocal((current) =>
      current.teamId === teamComp.id
        ? {
            ...current,
            signature,
            outcome: current.signature === signature ? current.outcome : null,
            rankings: current.signature === signature ? current.rankings : [],
            error: null,
          }
        : initial()
    );
  }, [teamComp.id, signature]);
  useEffect(() => {
    if (local.teamId === teamComp.id && local.signature === signature) {
      teamStates.set(`${local.teamId}:${local.mode}`, local);
      teamModes.set(local.teamId, local.mode);
    }
  }, [local, teamComp.id, signature]);
  useEffect(() => () => worker.current?.terminate(), []);
  const active =
    local.teamId === teamComp.id && local.signature === signature
      ? local
      : initial();
  const settings = active.settings;
  const rosterSlots = Array.from(
    { length: 4 },
    (_, index) =>
      teamComp.slots[index] ?? {
        charId: null,
        weaponId: null,
        artifactSet: null,
      }
  );
  const unownedSlots = teamComp.slots.flatMap((slot, index) =>
    slot.charId &&
    !accountData?.characters.some((char) => char.key === slot.charId)
      ? [index]
      : []
  );
  const switchMode = (mode: Submode) => {
    if (mode === active.mode) return;
    stop();
    teamStates.set(`${teamComp.id}:${active.mode}`, active);
    teamModes.set(teamComp.id, mode);
    setLocal(initial(mode));
  };
  const updateSettings = (patch: Partial<CharacterReplacementSettings>) => {
    stop();
    setLocal({
      ...active,
      settings: { ...settings, ...patch },
      outcome: null,
      rankings: [],
      error: null,
    });
  };
  const updateContext = (patch: Partial<CalcContext>) =>
    updateTeamSetupConfig(teamComp.id, (current) => ({
      ...current,
      damage: {
        ...current.damage,
        calcContext: { ...current.damage?.calcContext, ...patch },
      },
    }));
  const errorText = (reason: CharacterReplacementFailure): string => {
    switch (reason) {
      case "invalid-slots":
        return t.ui("charactersMode.errors.invalidSlots");
      case "no-objective":
        return t.ui("charactersMode.errors.noObjective");
      case "single-source":
        return t.ui("charactersMode.slotUnavailable");
      case "no-account":
        return t.ui("charactersMode.errors.noAccount");
      case "fixed-copy-shortage":
        return t.ui("charactersMode.errors.copyShortage");
      case "not-enough-characters":
        return t.ui("charactersMode.errors.notEnough");
      case "no-results":
        return t.ui("charactersMode.errors.noResults");
      default:
        return t.ui("charactersMode.errors.calculator");
    }
  };
  const start = () => {
    if (running || !characterStats || !weaponStats) return;
    setLocal({ ...active, outcome: null, rankings: [], error: null });
    setRunning(true);
    try {
      const taskWorker = new Worker(
        new URL(
          "../../services/combat/characterReplacement.worker.ts",
          import.meta.url
        ),
        { type: "module" }
      );
      worker.current = taskWorker;
      taskWorker.onmessage = (
        event: MessageEvent<CharacterReplacementWorkerMessage>
      ) => {
        if (
          worker.current !== taskWorker ||
          latestSignature.current !== signature
        )
          return;
        const message = event.data;
        if (message.type === "progress") setProgress(message);
        else if (message.type === "slot-result")
          setLocal((current) => ({
            ...current,
            rankings: [
              ...current.rankings.filter(
                (ranking) => ranking.slotIndex !== message.ranking.slotIndex
              ),
              message.ranking,
            ].sort((a, b) => a.slotIndex - b.slotIndex),
          }));
        else {
          setLocal({
            ...active,
            rankings:
              message.type === "independent-result" ? message.rankings : [],
            outcome: message.type === "result" ? message : null,
            error: message.type === "error" ? message.reason : null,
          });
          setRunning(false);
          setProgress(null);
          taskWorker.terminate();
          worker.current = null;
        }
      };
      taskWorker.onerror = () => {
        if (worker.current !== taskWorker) return;
        setLocal({
          ...active,
          error: "calculator-error",
          outcome: null,
          rankings: [],
        });
        stop();
      };
      taskWorker.postMessage({
        task: active.mode === "replace" ? "independent" : "joint",
        teamComp,
        setupConfig,
        accountData,
        objective,
        calcContext,
        settings: {
          ...settings,
          artifactBasis: "generated",
          replaceSlots: active.mode === "unowned" ? unownedSlots : [],
        },
        excludedArtifactIds: [
          ...useFreezeStore.getState().getFrozenArtifactIds(teamComp.id),
        ],
        ignoredCharIds: [...(ignoredCharIds ?? [])],
        inventoryReservations: {
          teams: useFreezeStore.getState().frozenTeams,
          reuseMode,
          standaloneIds: reservedIds,
        },
      });
    } catch {
      setLocal({
        ...active,
        error: "calculator-error",
        outcome: null,
        rankings: [],
      });
      setRunning(false);
    }
  };
  const apply = (result: CharacterReplacementResult, slotIndex?: number) => {
    const replacements =
      result.replacementSlots ??
      (slotIndex === undefined ? unownedSlots : [slotIndex]);
    const previewSlots = rosterSlots.map((slot) => ({ ...slot }));
    result.configs.forEach((config, index) => {
      const slotIndex = result.slotIndexes[index];
      previewSlots[slotIndex].artifactSet = config.artifactSet;
      if (replacements.includes(slotIndex))
        previewSlots[slotIndex] = {
          charId: config.charId,
          weaponId: config.weaponId,
          artifactSet: config.artifactSet,
        };
    });
    const slots = previewSlots.filter((slot) => slot.charId);
    updateTeamComp(teamComp.id, { ...teamComp, slots });
    onIgnoredCharIdsChange?.(new Set(result.ignoredCharIds));
    updateTeamSetupConfig(teamComp.id, (current) => {
      const charConfigs = { ...current.charConfigs };
      const beforeCopies = resolveRosterWeaponCopies(
        teamComp,
        current,
        accountData
      );
      const afterCopies = resolveRosterWeaponCopies(
        { ...teamComp, slots },
        current,
        accountData
      );
      result.configs.forEach((config, index) => {
        const slotIndex = result.slotIndexes[index];
        if (replacements.includes(slotIndex))
          charConfigs[config.charId] = {
            ...charConfigs[config.charId],
            level: config.charLevel,
            constellation: config.constellation,
            refinement: config.refinement,
            talentLevels: config.talentLevels,
          };
        else if (
          beforeCopies[slotIndex]?.refinement === config.refinement &&
          afterCopies[slots.findIndex((slot) => slot.charId === config.charId)]
            ?.refinement !== config.refinement
        ) {
          // A new earlier slot may change account-copy ordering. Keep the preview's effective rank.
          charConfigs[config.charId] = {
            ...charConfigs[config.charId],
            refinement: config.refinement,
          };
        }
      });
      return {
        ...current,
        charConfigs,
        damage: {
          ...current.damage,
          ...((current.damage?.formulaMode ?? "single") === "combo"
            ? { combo: result.combo }
            : {}),
        },
      };
    });
    toast.success(t.ui("charactersMode.applied"));
  };
  const renderResult = (
    result: CharacterReplacementResult,
    rank: number,
    outcome: Outcome,
    slotIndex?: number
  ) => {
    const best = outcome.results[0].damage;
    const tradeoff =
      best > 0 ? ((100 * (best - result.damage)) / best).toFixed(1) : "0.0";
    let labels: Record<string, string> = {};
    try {
      const team = new TeamBuild(
        result.configs,
        setupConfig.combatOptions,
        setupConfig.damage?.enemyAura,
        setupConfig.damage?.extraBuffs,
        undefined,
        calcContext
      );
      labels = Object.fromEntries(
        [...team.catalog.formulaIndex].map(([id, formula]) => [
          id,
          t.resolveLabel(formula.label),
        ])
      );
    } catch {
      /* IDs remain inspectable if a registry entry becomes unavailable. */
    }
    return (
      <section
        key={result.configs.map((config) => config.charId).join("|")}
        className="space-y-4 rounded-xl border border-border bg-gradient-card p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">
              #{rank + 1} · {Math.round(result.damage).toLocaleString()}{" "}
              {t.ui("charactersMode.damage")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {outcome.baselineDamage && outcome.baselineDamage > 0
                ? t.format(
                    "charactersMode.changeVsCurrent",
                    (
                      100 *
                      (result.damage / outcome.baselineDamage - 1)
                    ).toFixed(1)
                  )
                : t.format("charactersMode.tradeoff", tradeoff)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => apply(result, slotIndex)}
            >
              {t.ui("charactersMode.applyRoster")}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {result.configs
            .filter((_, index) =>
              (
                result.replacementSlots ??
                (slotIndex === undefined ? unownedSlots : [slotIndex])
              ).includes(result.slotIndexes[index])
            )
            .map((config) => (
              <div key={config.charId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <ItemIcon
                    characterId={config.charId}
                    badge={config.constellation}
                    level={`Lv.${config.charLevel}`}
                    size="md"
                  />
                  <span className="text-sm font-medium">
                    {t.character(config.charId)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ItemIcon
                    weaponId={config.weaponId}
                    badge={config.refinement}
                    size="sm"
                  />
                  <div>
                    <p className="text-xs">
                      {t.weapon(config.weaponId)} · R{config.refinement}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.weaponInstanceIds[
                        result.configs.findIndex(
                          (member) => member.charId === config.charId
                        )
                      ]
                        ? t.ui("charactersMode.ownedCopy")
                        : t.ui("charactersMode.hypotheticalWeapon")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {Object.values(result.artifactsByChar[config.charId]).map(
                    (artifact) =>
                      artifact && (
                        <ArtifactDataHoverCard
                          key={artifact.id}
                          artifact={artifact}
                          slot={artifact.slotKey}
                          side="top"
                        >
                          <ItemIcon
                            artifactSetId={artifact.setKey}
                            slot={artifact.slotKey}
                            rarity={artifact.rarity}
                            level={`+${artifact.level}`}
                            size="xs"
                          />
                        </ArtifactDataHoverCard>
                      )
                  )}
                </div>
              </div>
            ))}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            {t.ui("charactersMode.inspectCounts")}
          </summary>
          <div className="mt-2 space-y-1">
            {result.combo.lines.map((line, index) => (
              <div
                key={`${line.charId}:${line.formulaId}:${index}`}
                className="flex flex-wrap justify-between gap-2 text-xs"
              >
                <span>
                  {t.character(line.charId)} ·{" "}
                  {labels[line.formulaId] ?? line.formulaId}
                  {line.reaction?.reaction
                    ? ` · ${t.reaction(line.reaction.reaction)}`
                    : ""}
                </span>
                <span>×{line.count}</span>
              </div>
            ))}
          </div>
        </details>
      </section>
    );
  };

  return (
    <Card className={CARD_CLS} data-character-comparison>
      <CardHeader className={CARD_HEADER_CLS}>
        <h3 className={CARD_TITLE_CLS}>
          <Users className="h-4 w-4" />
          {t.ui("charactersMode.title")}
        </h3>
      </CardHeader>
      <OptionButtonRow>
        <OptionButtonCell>
          <OptionButton
            selected={active.mode === "replace"}
            onClick={() => switchMode("replace")}
            title={t.ui("charactersMode.replace")}
          />
        </OptionButtonCell>
        <OptionButtonCell>
          <OptionButton
            selected={active.mode === "unowned"}
            onClick={() => switchMode("unowned")}
            title={t.ui("charactersMode.unowned")}
          />
        </OptionButtonCell>
      </OptionButtonRow>
      <CardContent className={CARD_BODY_CLS}>
        <div className={CONTROLS_CLS}>
          <EnemyInputs
            enemyLevel={calcContext.enemyLevel}
            enemyRes={calcContext.enemyRes * 100}
            onEnemyLevelChange={(raw) => {
              const value = Number.parseFloat(raw);
              if (Number.isFinite(value)) updateContext({ enemyLevel: value });
            }}
            onEnemyResChange={(raw) => {
              const value = Number.parseFloat(raw);
              if (Number.isFinite(value))
                updateContext({ enemyRes: value / 100 });
            }}
            t={t}
          />
          <RollQualityInputs
            rollMultiplier={calcContext.rollMultiplier}
            onRollMultiplierChange={(value) =>
              updateContext({ rollMultiplier: value })
            }
            substatBudget={calcContext.substatBudget}
            onSubstatBudgetChange={(value) =>
              updateContext({ substatBudget: value })
            }
            t={t}
          />
        </div>
        <div className="mb-3 grid min-w-0 gap-2 sm:grid-cols-2">
          <label
            htmlFor={`${teamComp.id}-character-pool`}
            className="grid min-w-0 gap-1 text-sm sm:grid-cols-2 sm:items-center"
          >
            <span>{t.ui("charactersMode.candidatePool")}</span>
            <Select
              value={settings.pool}
              onValueChange={(value) =>
                updateSettings({
                  pool: value as CharacterReplacementSettings["pool"],
                })
              }
            >
              <SelectTrigger
                id={`${teamComp.id}-character-pool`}
                aria-label={t.ui("charactersMode.candidatePool")}
                className="w-full min-w-0 [&>span]:min-w-0 [&>span]:truncate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owned-owned">
                  {t.ui("charactersMode.ownedOwned")}
                </SelectItem>
                <SelectItem value="owned-any">
                  {t.ui("charactersMode.ownedAny")}
                </SelectItem>
                {active.mode === "replace" && (
                  <SelectItem value="all-any">
                    {t.ui("charactersMode.allAny")}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </label>
          {(
            [
              ["constellation4", t.ui("charactersMode.constellation4"), 0, 6],
              ["constellation5", t.ui("charactersMode.constellation5"), 0, 6],
              ["refinement34", t.ui("charactersMode.refinement34"), 1, 5],
              ["refinement5", t.ui("charactersMode.refinement5"), 1, 5],
            ] as const
          ).map(([key, label, min, max]) => (
            <label
              key={key}
              htmlFor={`${teamComp.id}-character-${key}`}
              className="grid min-w-0 gap-1 text-sm sm:grid-cols-2 sm:items-center"
            >
              <span>{label}</span>
              <Select
                value={String(settings[key])}
                onValueChange={(value) =>
                  updateSettings({ [key]: Number(value) })
                }
              >
                <SelectTrigger
                  id={`${teamComp.id}-character-${key}`}
                  aria-label={label}
                  className="w-full min-w-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: max - min + 1 },
                    (_, index) => index + min
                  ).map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {key.startsWith("constellation") ? "C" : "R"}
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={start}
            disabled={
              running ||
              !characterStats ||
              !weaponStats ||
              (active.mode === "unowned" &&
                (!accountData || !unownedSlots.length))
            }
          >
            <Search className="mr-2 h-4 w-4" />
            {t.ui("charactersMode.search")}
          </Button>
          {running && (
            <Button variant="outline" onClick={stop}>
              <X className="mr-2 h-4 w-4" />
              {t.ui("common.cancel")}
            </Button>
          )}
          {progress && (
            <span role="status" className="text-xs text-muted-foreground">
              {progress.phase === "screen"
                ? t.ui("charactersMode.screening")
                : t.ui("charactersMode.refining")}{" "}
              · {progress.evaluated.toLocaleString()}
            </span>
          )}
        </div>
        {active.error && (
          <p role="alert" className="mb-2 text-sm text-primary">
            {errorText(active.error)}
          </p>
        )}
        {active.mode === "unowned" && !accountData && (
          <p className="text-sm text-primary">
            {t.ui("charactersMode.errors.noAccount")}
          </p>
        )}
        {active.mode === "unowned" && accountData && !unownedSlots.length && (
          <p className="text-sm text-muted-foreground">
            {t.ui("charactersMode.noUnowned")}
          </p>
        )}
        {active.mode === "replace" ? (
          (running || active.rankings.length > 0) && (
            <TeamCharacterGrid>
              {rosterSlots.map((slot, slotIndex) => {
                const ranking = active.rankings.find(
                  (entry) => entry.slotIndex === slotIndex
                );
                const fixedSource =
                  (setupConfig.damage?.formulaMode ?? "single") === "single" &&
                  objective.lines.some((line) => line.charId === slot.charId);
                return (
                  <section
                    key={slotIndex}
                    data-replacement-slot={slotIndex}
                    className="space-y-2 rounded-lg border border-border p-2"
                  >
                    <h4 className="flex items-center gap-2 font-semibold">
                      {slot.charId && (
                        <CharAvatar charId={slot.charId} size={24} />
                      )}
                      <span>
                        {slot.charId
                          ? t.character(slot.charId)
                          : t.format("charactersMode.emptySlot", slotIndex + 1)}
                      </span>
                    </h4>
                    {fixedSource ? (
                      <p className="text-xs text-muted-foreground">
                        {t.ui("charactersMode.slotUnavailable")}
                      </p>
                    ) : ranking?.outcome.type === "error" ? (
                      <p className="text-xs text-primary">
                        {errorText(ranking.outcome.reason)}
                      </p>
                    ) : ranking?.outcome.type === "result" ? (
                      ranking.outcome.results.map((result, rank) =>
                        renderResult(
                          result,
                          rank,
                          ranking.outcome as Outcome,
                          slotIndex
                        )
                      )
                    ) : null}
                  </section>
                );
              })}
            </TeamCharacterGrid>
          )
        ) : (
          <div className="space-y-2">
            {active.outcome?.results.map((result, rank) =>
              renderResult(result, rank, active.outcome!)
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
