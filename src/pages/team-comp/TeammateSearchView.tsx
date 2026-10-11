import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ArtifactDataHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { TeamCharacterGrid } from "@/components/team-comp/TeamCharacterGrid";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  TeammateSearchMessage,
  TeammateSearchResult,
  TeammateSearchSettings,
} from "@/lib/team-comp/teammateSearchTypes";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";

export function TeammateSearchView() {
  const { t } = useLanguage();
  const account = useAccountStore(getActiveAccount);
  const addTeam = useTeamStore((state) => state.addTeam);
  const updateSetup = useTeamStore((state) => state.updateTeamSetupConfig);
  const [fixedIds, setFixedIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<TeammateSearchSettings>({
    constellation4: null,
    constellation5: null,
    refinement34: null,
    refinement5: null,
  });
  const [progress, setProgress] = useState<Extract<
    TeammateSearchMessage,
    { type: "progress" }
  > | null>(null);
  const [outcome, setOutcome] = useState<Extract<
    TeammateSearchMessage,
    { type: "result" }
  > | null>(null);
  const [running, setRunning] = useState(false);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Account changes invalidate the running search and all results.
  useEffect(() => {
    worker.current?.terminate();
    worker.current = null;
    setFixedIds([]);
    setOutcome(null);
    setProgress(null);
    setRunning(false);
  }, [account?.data]);

  const invalidate = () => {
    setOutcome(null);
    setProgress(null);
  };
  const start = () => {
    if (!account || running) return;
    invalidate();
    setRunning(true);
    try {
      const taskWorker = new Worker(
        new URL(
          "../../lib/team-comp/teammateSearch.worker.ts",
          import.meta.url
        ),
        { type: "module" }
      );
      worker.current = taskWorker;
      taskWorker.onmessage = (event: MessageEvent<TeammateSearchMessage>) => {
        if (worker.current !== taskWorker) return;
        const message = event.data;
        if (message.type === "progress") setProgress(message);
        else {
          if (message.type === "error") toast.error(message.message);
          else setOutcome(message);
          setRunning(false);
          setProgress(null);
          taskWorker.terminate();
          worker.current = null;
        }
      };
      taskWorker.onerror = () => {
        toast.error(t.ui("teammateSearch.error"));
        taskWorker.terminate();
        worker.current = null;
        setRunning(false);
        setProgress(null);
      };
      taskWorker.postMessage({
        fixedIds,
        account: account.data,
        settings,
        excludedArtifactIds: [
          ...useFreezeStore.getState().getFrozenArtifactIds(),
        ],
      });
    } catch {
      toast.error(t.ui("teammateSearch.error"));
      setRunning(false);
    }
  };
  const save = (result: TeammateSearchResult) => {
    const id = addTeam({
      name: result.configs
        .map((config) => t.character(config.charId))
        .join(" / "),
      slots: result.configs.map((config) => ({
        charId: config.charId,
        weaponId: config.weaponId,
        artifactSet: config.artifactSet,
      })),
    });
    updateSetup(id, {
      charConfigs: Object.fromEntries(
        result.configs.map((config) => [
          config.charId,
          {
            level: config.charLevel,
            constellation: config.constellation,
            refinement: config.refinement,
            talentLevels: config.talentLevels,
          },
        ])
      ),
      damage: {
        formulaMode: "combo",
        combo: result.combo,
        calcContext: result.calcContext,
      },
    });
    useFreezeStore.getState().freezeCharacters(
      id,
      result.configs.map((config) => config.charId),
      result.artifactsByChar
    );
    toast.success(t.ui("teammateSearch.saved"));
  };
  if (!account)
    return (
      <ScrollLayout>
        <div className="rounded-xl border border-border bg-gradient-card p-6">
          <p>{t.ui("teammateSearch.noAccount")}</p>
          <Button asChild className="mt-4">
            <Link to="/account-data/characters">
              {t.ui("import.titleAccountData")}
            </Link>
          </Button>
        </div>
      </ScrollLayout>
    );

  return (
    <ScrollLayout>
      <div className="mx-auto max-w-6xl space-y-5 pt-3">
        <div>
          <h2 className="text-xl font-semibold">
            {t.ui("teammateSearch.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.ui("teammateSearch.description")}
          </p>
        </div>
        <section className="space-y-4 rounded-xl border border-border bg-gradient-card p-4">
          <h3 className="font-medium">{t.ui("teammateSearch.fixedMembers")}</h3>
          <div className="flex flex-wrap items-start gap-4">
            {fixedIds.map((charId, index) => (
              <div key={charId} className="flex items-start gap-2">
                <div className="space-y-1">
                  <ItemPicker
                    type="character"
                    value={charId}
                    triggerLabel={t.character(charId)}
                    onChange={(id) => {
                      setFixedIds((ids) =>
                        ids.map((old, i) => (i === index ? id : old))
                      );
                      invalidate();
                    }}
                    disabled={running}
                    filter={(item) =>
                      account.data.characters.some(
                        (char) => char.key === item.id
                      ) &&
                      (!fixedIds.includes(item.id) || item.id === charId)
                    }
                    showItemName
                    triggerSize="lg"
                  />
                  <div className="text-xs text-primary">
                    {index === 0 ? t.ui("teammateSearch.anchor") : ""}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={running}
                  aria-label={t.ui("teammateSearch.removeMember")}
                  onClick={() => {
                    setFixedIds((ids) => ids.filter((id) => id !== charId));
                    invalidate();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {fixedIds.length < 3 && (
              <div className="space-y-1">
                <ItemPicker
                  type="character"
                  value={null}
                  onChange={(id) => {
                    setFixedIds((ids) => [...ids, id]);
                    invalidate();
                  }}
                  disabled={running}
                  filter={(item) =>
                    account.data.characters.some(
                      (char) => char.key === item.id
                    ) && !fixedIds.includes(item.id)
                  }
                  placeholder={t.ui("teammateSearch.addMember")}
                />
                <p className="text-xs">{t.ui("teammateSearch.addMember")}</p>
              </div>
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              {t.ui("teammateSearch.settings")}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  [
                    "constellation4",
                    t.ui("teammateSearch.constellation4"),
                    0,
                    6,
                  ],
                  [
                    "constellation5",
                    t.ui("teammateSearch.constellation5"),
                    0,
                    6,
                  ],
                  ["refinement34", t.ui("teammateSearch.refinement34"), 1, 5],
                  ["refinement5", t.ui("teammateSearch.refinement5"), 1, 5],
                ] as const
              ).map(([key, label, min, max]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  {label}
                  <select
                    className="rounded-md border border-border bg-background p-2 text-foreground"
                    disabled={running}
                    value={settings[key] ?? "account"}
                    onChange={(event) => {
                      setSettings((old) => ({
                        ...old,
                        [key]:
                          event.target.value === "account"
                            ? null
                            : Number(event.target.value),
                      }));
                      invalidate();
                    }}
                  >
                    <option value="account">
                      {t.ui("teammateSearch.accountValue")}
                    </option>
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
            {t.ui("teammateSearch.assumptions")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={start} disabled={running || fixedIds.length === 0}>
              <Search className="mr-2 h-4 w-4" />
              {t.ui("teammateSearch.search")}
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
                {t.ui("teammateSearch.cancel")}
              </Button>
            )}
            {progress && (
              <p role="status" className="text-sm text-muted-foreground">
                {progress.phase === "screen"
                  ? t.ui("teammateSearch.screening")
                  : t.ui("teammateSearch.artifacts")}{" "}
                · {progress.step}/{progress.total} ·{" "}
                {progress.evaluated.toLocaleString()}{" "}
                {t.ui("teammateSearch.evaluated")}
              </p>
            )}
          </div>
        </section>
        {outcome && (
          <div role="status" className="text-sm text-muted-foreground">
            {outcome.evaluated.toLocaleString()}{" "}
            {t.ui("teammateSearch.evaluated")}
            {outcome.truncated && ` · ${t.ui("teammateSearch.partialSearch")}`}
            {outcome.skipped > 0 &&
              ` · ${outcome.skipped} ${t.ui("teammateSearch.skipped")}`}
          </div>
        )}
        {outcome?.results.length === 0 && (
          <p className="rounded-xl border border-border p-4">
            {t.ui("teammateSearch.noResults")}
          </p>
        )}
        {outcome?.results.map((result, rank) => (
          <section
            key={result.configs
              .map((config) => `${config.charId}:${config.weaponId}`)
              .join("|")}
            className="space-y-4 rounded-xl border border-border bg-gradient-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">
                #{rank + 1} · {Math.round(result.damage).toLocaleString()}{" "}
                {t.ui("teammateSearch.damage")}
                <span className="mt-1 block text-sm font-normal text-muted-foreground">
                  {rank === 0
                    ? t.ui("teammateSearch.highestDamage")
                    : t.format(
                        "teammateSearch.damageTradeoff",
                        (outcome.results[0].damage > 0
                          ? Math.max(
                              0,
                              (1 - result.damage / outcome.results[0].damage) *
                                100
                            )
                          : 0
                        ).toFixed(1)
                      )}
                </span>
              </h3>
              <Button variant="outline" size="sm" onClick={() => save(result)}>
                {t.ui("teammateSearch.saveTeam")}
              </Button>
            </div>
            <TeamCharacterGrid className="gap-2">
              {result.configs.map((config) => (
                <div key={config.charId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ItemIcon
                      characterId={config.charId}
                      badge={config.constellation}
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
                    <span className="text-xs">
                      {t.weapon(config.weaponId)} · R{config.refinement}
                    </span>
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
                              alt={`${t.artifact(artifact.setKey)} ${t.slot(artifact.slotKey)}`}
                              size="sm"
                            />
                          </ArtifactDataHoverCard>
                        )
                    )}
                  </div>
                </div>
              ))}
            </TeamCharacterGrid>
          </section>
        ))}
      </div>
    </ScrollLayout>
  );
}
