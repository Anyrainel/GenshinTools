import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { CharAvatar } from "@/components/shared/CharAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import type { I18n } from "@/i18n/types";
import { cn } from "@/lib/utils";
import { fetchLabPreview } from "@/providers/preview/labPreview";
import type { LabPreview } from "@/providers/preview/labPreviewSchema";

function humanize(value: string) {
  return value.replaceAll(/[-_.]/g, " ");
}

function EvidenceValue({ value, t }: { value: unknown; t: I18n }) {
  if (value === null || value === undefined)
    return <span>{t.ui("labPreview.unresolved")}</span>;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value))
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={`${index}:${JSON.stringify(item)}`}>
            <EvidenceValue value={item} t={t} />
          </li>
        ))}
      </ul>
    );
  const item = value as Record<string, unknown>;
  const stats = Array.isArray(item.statIds)
    ? item.statIds.filter((stat): stat is string => typeof stat === "string")
    : [];
  const team = Array.isArray(item.orderedCharacterIds)
    ? item.orderedCharacterIds.filter(
        (id): id is string => typeof id === "string"
      )
    : [];
  const set =
    item.set && typeof item.set === "object"
      ? (item.set as Record<string, unknown>)
      : null;
  const weapon =
    item.sourceObservation && typeof item.sourceObservation === "object"
      ? (item.sourceObservation as Record<string, unknown>)
      : null;
  const talents =
    item.enteredTalentLevels && typeof item.enteredTalentLevels === "object"
      ? (item.enteredTalentLevels as Record<string, unknown>)
      : null;
  return (
    <div className="space-y-2">
      {stats.length > 0 && (
        <p className="font-medium">{stats.map(t.stat).join(" / ")}</p>
      )}
      {team.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {team.map((id) => (
            <span key={id} className="flex items-center gap-2">
              <CharAvatar charId={id} />
              {t.character(id)}
            </span>
          ))}
        </div>
      )}
      {set && typeof set.setId === "string" && (
        <p className="font-medium">
          {t.artifact(set.setId)} · {String(set.type)}
        </p>
      )}
      {weapon && typeof weapon.weaponId === "string" && (
        <>
          <p className="font-medium">{t.weapon(weapon.weaponId)}</p>
          <EvidenceValue value={weapon.sourceConditions} t={t} />
        </>
      )}
      {typeof item.constellation === "number" && (
        <p>
          C{item.constellation}
          {talents && (
            <>
              {" "}
              · {t.ability("normal")} {String(talents.auto)} /{" "}
              {t.ability("skill")} {String(talents.skill)} /{" "}
              {t.ability("burst")} {String(talents.burst)}
            </>
          )}
        </p>
      )}
      {Array.isArray(item.sourceConditions) &&
        item.sourceConditions.map((condition) => (
          <p key={String(condition)} className="text-sm">
            {String(condition)}
          </p>
        ))}
      <details className="text-sm">
        <summary className="cursor-pointer text-primary">
          {t.ui("labPreview.evidenceDetails")}
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function LabPreviewPage() {
  const { section } = useParams();
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const [data, setData] = useState<LabPreview | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    void fetchLabPreview(controller.signal, revision)
      .then((snapshot) => {
        if (!controller.signal.aborted) setData(snapshot);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [revision]);

  const views = [
    {
      id: "guides",
      title: t.ui("labPreview.guides"),
      description: t.ui("labPreview.guidesDescription"),
    },
    {
      id: "sources",
      title: t.ui("labPreview.sources"),
      description: t.ui("labPreview.sourcesDescription"),
    },
    {
      id: "optimizer",
      title: t.ui("labPreview.optimizer"),
      description: t.ui("labPreview.optimizerDescription"),
    },
  ];
  const draft =
    data?.drafts.find((item) => item.id === params.get("draft")) ??
    data?.drafts[0];
  const sourceCharacters = [
    ...new Set(data?.sources.map((source) => source.characterId) ?? []),
  ].sort((a, b) => t.character(a).localeCompare(t.character(b)));
  const character = params.get("character") ?? "noelle";
  const groups = [
    { id: "team", title: t.ui("labPreview.team") },
    { id: "weapon", title: t.ui("labPreview.weapon") },
    { id: "artifacts", title: t.ui("labPreview.artifacts") },
    { id: "substats", title: t.ui("labPreview.substats") },
    { id: "computation", title: t.ui("labPreview.computation") },
  ];
  if (section && !views.some((view) => view.id === section))
    return <Navigate to="/__lab" replace />;
  return (
    <PageLayout>
      <ScrollLayout
        header={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {t.ui("labPreview.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t.ui("labPreview.devOnly")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              {t.ui("labPreview.refresh")}
            </Button>
          </div>
        }
      >
        <div className="space-y-6 pt-3">
          <nav
            aria-label={t.ui("labPreview.title")}
            className="flex flex-wrap gap-2"
          >
            <Link
              to="/__lab"
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              {t.ui("labPreview.overview")}
            </Link>
            {views.map((view) => (
              <Link
                key={view.id}
                to={`/__lab/${view.id}`}
                className={cn(
                  "rounded-lg border border-border px-3 py-2 text-sm",
                  section === view.id && "bg-primary text-primary-foreground"
                )}
              >
                {view.title}
              </Link>
            ))}
          </nav>
          {!section && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {views.map((view) => (
                  <Link
                    key={view.id}
                    to={`/__lab/${view.id}`}
                    className="rounded-xl border border-border bg-gradient-card p-5"
                  >
                    <h2 className="font-semibold">{view.title}</h2>
                    <p className="mt-2 text-sm">{view.description}</p>
                  </Link>
                ))}
              </div>
              <section className="rounded-xl border border-border p-5">
                <h2 className="font-semibold">{t.ui("labPreview.existing")}</h2>
                <p className="mt-2 text-sm">
                  {t.ui("labPreview.existingDescription")}
                </p>
                <div className="mt-3 flex flex-wrap gap-4">
                  <Link
                    className="text-primary"
                    to="/team-comp/analysis?mode=energy"
                  >
                    {t.ui("teamComp.modeEnergy")}
                  </Link>
                  <Link className="text-primary" to="/archive/achievements">
                    {t.ui("archive.achievements")}
                  </Link>
                  <Link className="text-primary" to="/tier-list/artifacts">
                    {t.ui("archive.artifacts")}
                  </Link>
                </div>
              </section>
            </>
          )}
          {error && (
            <div role="alert" className="rounded-xl border border-border p-5">
              <p>{t.ui("labPreview.loadError")}</p>
              <p className="mt-2 text-sm">{t.ui("labPreview.rebuildHint")}</p>
            </div>
          )}
          {!data && !error && <p role="status">{t.ui("labPreview.loading")}</p>}
          {data && (
            <>
              <p className="text-xs text-muted-foreground">
                {t.ui("labPreview.snapshot")} ·{" "}
                {new Date(data.updatedAt).toLocaleString()}
              </p>
              {section === "guides" && (
                <>
                  <div className="rounded-xl border border-border bg-gradient-card p-5">
                    <h2 className="flex items-center gap-3 text-2xl font-semibold">
                      <CharAvatar charId="noelle" size={40} />
                      {t.character("noelle")} · {t.ui("labPreview.draft")}
                    </h2>
                    <p className="mt-3 text-sm">
                      {t.ui("labPreview.draftNotice")}
                    </p>
                  </div>
                  <fieldset
                    className="flex flex-wrap gap-2"
                    aria-label={t.ui("labPreview.request")}
                  >
                    {data.drafts.map((item) => (
                      <Button
                        key={item.id}
                        variant={draft?.id === item.id ? "default" : "outline"}
                        onClick={() => setParams({ draft: item.id })}
                      >
                        {item.requestId.toUpperCase()}
                      </Button>
                    ))}
                  </fieldset>
                  {draft && (
                    <>
                      <section className="rounded-xl border border-border p-5">
                        <h2 className="font-semibold">
                          {t.ui("labPreview.request")}
                        </h2>
                        <EvidenceValue
                          value={
                            draft.fields.find(
                              (item) => item.id === "request.entered"
                            )?.value
                          }
                          t={t}
                        />
                      </section>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {groups.map((group) => (
                          <section
                            key={group.id}
                            className="rounded-xl border border-border bg-gradient-card p-5"
                          >
                            <h2 className="mb-4 text-lg font-semibold">
                              {group.title}
                            </h2>
                            <div className="space-y-4">
                              {draft.fields
                                .filter((item) =>
                                  item.id.startsWith(`${group.id}.`)
                                )
                                .map((item) => (
                                  <div
                                    key={item.id}
                                    className="border-b border-border pb-3 last:border-b-0"
                                  >
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                      <h3 className="text-sm font-medium">
                                        {humanize(
                                          item.id
                                            .split(".")
                                            .slice(1)
                                            .join(" · ")
                                        )}
                                      </h3>
                                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                                        {humanize(item.state)}
                                      </span>
                                    </div>
                                    <EvidenceValue value={item.value} t={t} />
                                  </div>
                                ))}
                            </div>
                          </section>
                        ))}
                      </div>
                      <section className="rounded-xl border border-border p-5">
                        <h2 className="font-semibold">
                          {t.ui("labPreview.blockers")} ({draft.blockers.length}
                          )
                        </h2>
                        <p className="my-2 text-sm">
                          {t.ui("labPreview.blockersDescription")}
                        </p>
                        <ul className="grid gap-2 text-sm md:grid-cols-2">
                          {draft.blockers.map((item) => (
                            <li key={`${item.field}:${item.code}`}>
                              {humanize(item.code)}
                            </li>
                          ))}
                        </ul>
                      </section>
                    </>
                  )}
                </>
              )}
              {section === "sources" && (
                <>
                  <p>{t.ui("labPreview.sourcesDescription")}</p>
                  <Input
                    aria-label={t.ui("labPreview.search")}
                    placeholder={t.ui("labPreview.search")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <div className="flex max-h-52 flex-wrap gap-2 overflow-auto">
                    {sourceCharacters
                      .filter((id) =>
                        `${id} ${t.character(id)}`
                          .toLowerCase()
                          .includes(query.toLowerCase())
                      )
                      .map((id) => (
                        <Button
                          key={id}
                          variant={character === id ? "default" : "outline"}
                          onClick={() => setParams({ character: id })}
                        >
                          <CharAvatar charId={id} />
                          {t.character(id)}
                        </Button>
                      ))}
                  </div>
                  {data.sources
                    .filter((source) => source.characterId === character)
                    .map((source) => (
                      <section
                        key={source.id}
                        className="rounded-xl border border-border bg-gradient-card p-5"
                      >
                        <h2 className="font-semibold">
                          {t.character(source.characterId)} ·{" "}
                          {humanize(source.status)}
                        </h2>
                        <p className="my-2 break-all text-xs text-muted-foreground">
                          {source.id}
                        </p>
                        <div className="flex gap-3">
                          {source.links.map((link) => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary"
                            >
                              {link.source}
                            </a>
                          ))}
                        </div>
                        <EvidenceValue value={source.observations} t={t} />
                        <h3 className="mt-4 font-medium">
                          {t.ui("labPreview.unknowns")}
                        </h3>
                        <ul className="mt-2 list-inside list-disc text-sm">
                          {source.unknowns.map((unknown) => (
                            <li key={unknown}>{unknown}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                </>
              )}
              {section === "optimizer" && (
                <>
                  <p>{t.ui("labPreview.optimizerDescription")}</p>
                  <div className="overflow-auto rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {[
                            t.ui("labPreview.experiment"),
                            t.ui("labPreview.ratio"),
                            t.ui("labPreview.regressions"),
                            t.ui("teamComp.extraBuffsStatus"),
                            t.ui("labPreview.description"),
                          ].map((label) => (
                            <th key={label} className="p-3">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.optimizer.map((item) => (
                          <tr key={item.id} className="border-t border-border">
                            <td className="p-3">
                              {item.id}
                              <div className="text-xs text-muted-foreground">
                                {item.commit}
                              </div>
                            </td>
                            <td className="p-3 tabular-nums">
                              {item.ratio.toFixed(6)}
                            </td>
                            <td className="p-3">{item.regressions}</td>
                            <td className="p-3">{item.status}</td>
                            <td className="p-3">{item.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
