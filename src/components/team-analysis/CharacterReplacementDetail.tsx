import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArtifactDataHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/domain/team/characterReplacementTypes";
import type { TeamComp, TeamSetupConfig } from "@/domain/team/types";
import { resolveRosterWeaponCopies } from "@/domain/team/weaponCopies";
import { useFreezeStore } from "@/stores/useFreezeStore";

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
  onSaveLoadout?: (result: CharacterReplacementResult) => void;
  ignoredCharIds?: ReadonlySet<string>;
  onIgnoredCharIdsChange?: (ids: ReadonlySet<string>) => void;
}
type Outcome = Extract<CharacterReplacementMessage, { type: "result" }>;
interface LocalState {
  teamId: string;
  signature: string;
  settings: CharacterReplacementSettings;
  outcome: Outcome | null;
  error: CharacterReplacementFailure | null;
  details?: string;
}
const teamStates = new Map<string, LocalState>();

function defaultSettings(hasAccount: boolean): CharacterReplacementSettings {
  return {
    replaceSlots: [],
    pool: hasAccount ? "owned-owned" : "all-any",
    artifactBasis: hasAccount ? "account" : "generated",
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
  onSaveLoadout,
  ignoredCharIds,
  onIgnoredCharIdsChange,
}: CharacterReplacementDetailProps) {
  const { t } = useLanguage();
  const reservedLoadouts = useFreezeStore((state) => state.frozenTeamLoadouts);
  const reservedIds = useFreezeStore((state) => state.frozenArtifactIds);
  const reuseMode = useFreezeStore((state) => state.reuseMode);
  const signature = JSON.stringify({
    teamComp,
    setupConfig,
    accountData,
    objective,
    calcContext,
    reservedLoadouts,
    reservedIds,
    reuseMode,
    ignoredCharIds: [...(ignoredCharIds ?? [])],
  });
  const initial = (): LocalState => {
    const cached = teamStates.get(teamComp.id);
    return {
      teamId: teamComp.id,
      signature,
      settings: cached?.settings ?? defaultSettings(!!accountData),
      outcome: cached?.signature === signature ? cached.outcome : null,
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: The serialized input snapshot invalidates runs/results while retaining per-team controls.
  useEffect(() => {
    worker.current?.terminate();
    worker.current = null;
    setRunning(false);
    setProgress(null);
    setLocal((current) =>
      current.teamId === teamComp.id
        ? {
            ...current,
            signature,
            outcome: current.signature === signature ? current.outcome : null,
            error: null,
          }
        : initial()
    );
  }, [teamComp.id, signature]);
  useEffect(() => {
    if (local.teamId === teamComp.id && local.signature === signature)
      teamStates.set(local.teamId, local);
  }, [local, teamComp.id, signature]);
  useEffect(() => () => worker.current?.terminate(), []);
  const active =
    local.teamId === teamComp.id && local.signature === signature
      ? local
      : initial();
  const settings = active.settings;
  const updateSettings = (patch: Partial<CharacterReplacementSettings>) =>
    setLocal({
      ...active,
      settings: { ...settings, ...patch },
      outcome: null,
      error: null,
    });
  const errorText = (reason: CharacterReplacementFailure): string => {
    switch (reason) {
      case "invalid-slots":
        return t.ui("charactersMode.errors.invalidSlots");
      case "no-objective":
        return t.ui("charactersMode.errors.noObjective");
      case "single-source":
        return t.ui("charactersMode.errors.singleSource");
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
  const sourceInReplacement =
    (setupConfig.damage?.formulaMode ?? "single") === "single" &&
    objective.lines.some((line) =>
      settings.replaceSlots.some(
        (index) => teamComp.slots[index]?.charId === line.charId
      )
    );
  const start = () => {
    if (running || !characterStats || !weaponStats) return;
    setLocal({ ...active, outcome: null, error: null });
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
        event: MessageEvent<CharacterReplacementMessage>
      ) => {
        if (
          worker.current !== taskWorker ||
          latestSignature.current !== signature
        )
          return;
        const message = event.data;
        if (message.type === "progress") setProgress(message);
        else {
          setLocal({
            ...active,
            outcome: message.type === "result" ? message : null,
            error: message.type === "error" ? message.reason : null,
            details: message.type === "error" ? message.details : undefined,
          });
          setRunning(false);
          setProgress(null);
          taskWorker.terminate();
          worker.current = null;
        }
      };
      taskWorker.onerror = () => {
        if (worker.current !== taskWorker) return;
        setLocal({ ...active, error: "calculator-error", outcome: null });
        setRunning(false);
        taskWorker.terminate();
        worker.current = null;
      };
      taskWorker.postMessage({
        teamComp,
        setupConfig,
        accountData,
        objective,
        calcContext,
        settings,
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
      setLocal({ ...active, error: "calculator-error", outcome: null });
      setRunning(false);
    }
  };
  const apply = (result: CharacterReplacementResult) => {
    const slots = teamComp.slots.map((slot) => ({ ...slot }));
    result.configs.forEach((config, index) => {
      const slotIndex = result.slotIndexes[index];
      slots[slotIndex].artifactSet = config.artifactSet;
      if (settings.replaceSlots.includes(slotIndex))
        slots[slotIndex] = {
          charId: config.charId,
          weaponId: config.weaponId,
          artifactSet: config.artifactSet,
        };
    });
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
        if (settings.replaceSlots.includes(slotIndex))
          charConfigs[config.charId] = {
            ...charConfigs[config.charId],
            level: config.charLevel,
            constellation: config.constellation,
            refinement: config.refinement,
            talentLevels: config.talentLevels,
          };
        else if (
          beforeCopies[slotIndex].refinement === config.refinement &&
          afterCopies[slotIndex].refinement !== config.refinement
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
  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border border-border bg-gradient-card p-4">
        <div>
          <h3 className="font-semibold">{t.ui("charactersMode.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.ui("charactersMode.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {teamComp.slots.map((slot, index) => (
            <label
              key={index}
              htmlFor={`replace-slot-${teamComp.id}-${index}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2"
            >
              <Checkbox
                id={`replace-slot-${teamComp.id}-${index}`}
                disabled={running}
                checked={settings.replaceSlots.includes(index)}
                onCheckedChange={(checked) =>
                  updateSettings({
                    replaceSlots: checked
                      ? [...settings.replaceSlots, index]
                      : settings.replaceSlots.filter(
                          (value) => value !== index
                        ),
                  })
                }
              />
              {slot.charId ? (
                <>
                  <ItemIcon characterId={slot.charId} size="xs" />
                  <span className="text-sm">{t.character(slot.charId)}</span>
                </>
              ) : (
                <span className="text-sm">
                  {t.format("charactersMode.emptySlot", index + 1)}
                </span>
              )}
            </label>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={running || !accountData}
          onClick={() =>
            updateSettings({
              replaceSlots: teamComp.slots.flatMap((slot, index) =>
                slot.charId &&
                !accountData?.characters.some(
                  (char) => char.key === slot.charId
                )
                  ? [index]
                  : []
              ),
            })
          }
        >
          {t.ui("charactersMode.replaceUnowned")}
        </Button>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>{t.ui("charactersMode.candidatePool")}</span>
            <select
              className="block w-full rounded-md border border-border bg-background p-2 text-foreground"
              value={settings.pool}
              disabled={running}
              onChange={(event) =>
                updateSettings({
                  pool: event.target
                    .value as CharacterReplacementSettings["pool"],
                })
              }
            >
              <option value="owned-owned">
                {t.ui("charactersMode.ownedOwned")}
              </option>
              <option value="owned-any">
                {t.ui("charactersMode.ownedAny")}
              </option>
              <option value="all-any">{t.ui("charactersMode.allAny")}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>{t.ui("charactersMode.artifactBasis")}</span>
            <select
              className="block w-full rounded-md border border-border bg-background p-2 text-foreground"
              value={settings.artifactBasis}
              disabled={running}
              onChange={(event) =>
                updateSettings({
                  artifactBasis: event.target
                    .value as CharacterReplacementSettings["artifactBasis"],
                })
              }
            >
              <option value="account">
                {t.ui("charactersMode.accountArtifacts")}
              </option>
              <option value="generated">
                {t.ui("charactersMode.generatedArtifacts")}
              </option>
            </select>
          </label>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            {t.ui("charactersMode.hypotheticalRanks")}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {t.ui("charactersMode.rankDescription")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                className="flex items-center justify-between gap-2 text-sm"
              >
                {label}
                <select
                  className="rounded-md border border-border bg-background p-2"
                  value={settings[key]}
                  disabled={running}
                  onChange={(event) =>
                    updateSettings({ [key]: Number(event.target.value) })
                  }
                >
                  {Array.from(
                    { length: max - min + 1 },
                    (_, index) => index + min
                  ).map((value) => (
                    <option key={value} value={value}>
                      {key.startsWith("constellation") ? "C" : "R"}
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
        <p className="text-xs text-muted-foreground">
          {t.ui("charactersMode.assumptions")}
        </p>
        {sourceInReplacement && (
          <p role="alert" className="text-sm text-primary">
            {t.ui("charactersMode.errors.singleSource")}
          </p>
        )}
        {active.error && (
          <div role="alert" className="space-y-1 text-sm text-primary">
            <p>{errorText(active.error)}</p>
            {active.details && (
              <p className="text-xs text-muted-foreground">{active.details}</p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={
              running ||
              !settings.replaceSlots.length ||
              sourceInReplacement ||
              !characterStats ||
              !weaponStats
            }
            onClick={start}
          >
            <Search className="mr-2 h-4 w-4" />
            {t.ui("charactersMode.search")}
          </Button>
          {running && (
            <Button
              variant="outline"
              onClick={() => {
                worker.current?.terminate();
                worker.current = null;
                setRunning(false);
                setProgress(null);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              {t.ui("common.cancel")}
            </Button>
          )}
          {progress && (
            <p role="status" className="text-sm text-muted-foreground">
              {progress.phase === "screen"
                ? t.ui("charactersMode.screening")
                : t.ui("charactersMode.refining")}{" "}
              {progress.step}/{progress.total} ·{" "}
              {progress.evaluated.toLocaleString()}{" "}
              {t.ui("charactersMode.evaluated")}
            </p>
          )}
        </div>
      </section>
      {active.outcome && (
        <p role="status" className="text-sm text-muted-foreground">
          {active.outcome.evaluated.toLocaleString()}{" "}
          {t.ui("charactersMode.evaluated")} ·{" "}
          {t.ui("charactersMode.bestFound")}
          {active.outcome.partial ? ` · ${t.ui("charactersMode.partial")}` : ""}
          {active.outcome.skipped
            ? ` · ${active.outcome.skipped} ${t.ui("charactersMode.skipped")}`
            : ""}
        </p>
      )}
      {active.outcome?.results.map((result, rank) => {
        const best = active.outcome!.results[0].damage;
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
                  {t.format("charactersMode.tradeoff", tradeoff)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => apply(result)}
                >
                  {t.ui("charactersMode.applyRoster")}
                </Button>
                {result.artifactBasis === "account" && onSaveLoadout && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      apply(result);
                      onSaveLoadout(result);
                    }}
                  >
                    {t.ui("charactersMode.saveLoadout")}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {result.configs.map((config, index) => (
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
                        {result.weaponInstanceIds[index]
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
      })}
    </div>
  );
}
