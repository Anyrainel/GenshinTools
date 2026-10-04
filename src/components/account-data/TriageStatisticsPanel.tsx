import { ChevronRight, ExternalLink } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { CharAvatar } from "@/components/shared/CharAvatar";
import { TRIAGE_TIER_COLORS } from "@/components/shared/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { allSlots } from "@/data/enums";
import { artifactsById } from "@/data/gameResources";
import type {
  QualityTier,
  TriageStatistics,
} from "@/lib/account-data/triage/types";
import { cn, getAssetUrl } from "@/lib/utils";

function TierSupply({ supply }: { supply: Record<QualityTier, number> }) {
  const { t } = useLanguage();
  const tiers = [
    { tier: "prime" as const, label: t.ui("triage.tier.prime") },
    { tier: "solid" as const, label: t.ui("triage.tier.solid") },
    { tier: "filler" as const, label: t.ui("triage.tier.filler") },
    { tier: "fodder" as const, label: t.ui("triage.tier.fodder") },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
      {tiers.map(({ tier, label }) => (
        <div key={tier} className="flex justify-between gap-1">
          <dt className={TRIAGE_TIER_COLORS.text[tier]}>{label}</dt>
          <dd className="tabular-nums">{supply[tier]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TriageStatisticsPanel({
  statistics,
  view,
  onNavigate,
}: {
  statistics: TriageStatistics;
  view: "sets" | "builds";
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(new Set<string>());
  if (view === "builds")
    return (
      <div className="space-y-3 text-sm">
        <p>
          {t
            .ui("triage.help.buildTotals")
            .replace("{0}", String(statistics.totalBuilds))
            .replace("{1}", String(statistics.totalActiveBuilds))}
        </p>
        <p className="text-muted-foreground">
          {t.ui("triage.help.activeBuildDetail")}
        </p>
        {statistics.totalActiveBuilds === 0 && (
          <p>{t.ui("triage.help.noActiveBuilds")}</p>
        )}
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 font-medium">
                {t.ui("teamComp.analyzerChar")}
              </th>
              <th className="py-2 px-2 text-right font-medium">
                {t.ui("triage.help.totalBuildColumn")}
              </th>
              <th className="py-2 text-right font-medium">
                {t.ui("triage.help.activeBuildColumn")}
              </th>
            </tr>
          </thead>
          <tbody>
            {statistics.characters.map((row) => (
              <tr key={row.characterId} className="border-b border-border">
                <td className="py-2">
                  <Link
                    to={`/artifact-filter/configure?char=${row.characterId}`}
                    onClick={onNavigate}
                    className="flex items-center gap-2 hover:underline"
                    aria-label={t
                      .ui("triage.help.viewCharacterBuilds")
                      .replace("{0}", t.character(row.characterId))}
                  >
                    <CharAvatar charId={row.characterId} size={24} />
                    {t.character(row.characterId)}
                    <ExternalLink
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {row.totalBuildCount}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {row.activeBuildCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
        <span>
          {t.ui("triage.help.gapColumn")}: {statistics.totalGap}
        </span>
        <span>
          {t.ui("triage.help.totalDemand")}: {statistics.totalDemand}
        </span>
        <span>
          {t.ui("triage.help.totalInventory")}: {statistics.totalSupply}
        </span>
      </div>
      <p className="text-muted-foreground">
        {t.ui("triage.help.setStatisticsDetail")}
      </p>
      <p className="text-muted-foreground">
        {t.ui("triage.help.sharedPoolDetail")}
      </p>
      {statistics.sets.length === 0 && (
        <p>{t.ui("triage.help.noSetStatistics")}</p>
      )}
      <table className="w-full table-fixed text-left text-xs sm:text-sm">
        <colgroup>
          <col className="w-[33%]" />
          <col className="w-[10%]" />
          <col className="w-[17%]" />
          <col className="w-[40%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 font-medium">
              {t.ui("triage.help.setColumn")}
            </th>
            <th className="py-2 pl-2 text-right font-medium">
              {t.ui("triage.help.gapColumn")}
            </th>
            <th className="py-2 pl-2 text-right font-medium">
              {t.ui("triage.detail.demand")}
            </th>
            <th className="py-2 pl-2 font-medium">
              {t.ui("triage.help.tierSupplyColumn")}
            </th>
          </tr>
        </thead>
        <tbody>
          {statistics.sets.map((row) => {
            const image =
              row.source.type === "4pc"
                ? artifactsById[row.source.setKey]?.imagePaths.flower
                : null;
            const name =
              row.source.type === "4pc"
                ? t.artifact(row.source.setKey)
                : row.source.type === "2pc"
                  ? t.halfSetShort(row.source.halfSetId)
                  : "";
            return (
              <Fragment key={row.key}>
                <tr className="border-b border-border align-top">
                  <td className="py-2">
                    <button
                      type="button"
                      aria-expanded={expanded.has(row.key)}
                      className="flex w-full min-w-0 items-start gap-1 text-left"
                      onClick={() =>
                        setExpanded((previous) => {
                          const next = new Set(previous);
                          if (next.has(row.key)) next.delete(row.key);
                          else next.add(row.key);
                          return next;
                        })
                      }
                    >
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 sm:h-4 sm:w-4 shrink-0 mt-0.5",
                          expanded.has(row.key) && "rotate-90"
                        )}
                        aria-hidden="true"
                      />
                      {image && (
                        <img
                          src={getAssetUrl(image)}
                          alt=""
                          className="h-4 w-4 sm:h-6 sm:w-6 shrink-0 object-contain"
                        />
                      )}
                      <span className="min-w-0 break-words">
                        {name}
                        {row.source.type === "2pc" && (
                          <span className="block text-xs text-muted-foreground">
                            {t.ui("triage.help.sharedPool")}
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums">
                    {row.gap}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums">
                    {row.demand}
                  </td>
                  <td className="py-2 pl-2">
                    <TierSupply supply={row.supplyByTier} />
                  </td>
                </tr>
                {expanded.has(row.key) && (
                  <tr>
                    <td colSpan={4} className="pb-3">
                      <table className="w-full table-fixed text-left text-xs">
                        <colgroup>
                          <col className="w-[33%]" />
                          <col className="w-[10%]" />
                          <col className="w-[17%]" />
                          <col className="w-[40%]" />
                        </colgroup>
                        <thead className="sr-only">
                          <tr>
                            <th>{t.ui("triage.filterBySlot")}</th>
                            <th>{t.ui("triage.help.gapColumn")}</th>
                            <th>{t.ui("triage.detail.demand")}</th>
                            <th>{t.ui("triage.help.tierSupplyColumn")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allSlots.map((slot) => (
                            <tr key={slot}>
                              <th scope="row" className="py-1 font-normal">
                                {t.slot(slot)}
                              </th>
                              <td className="py-1 px-2 text-right tabular-nums">
                                {row.slots[slot].gap}
                              </td>
                              <td className="py-1 px-2 text-right tabular-nums">
                                {row.slots[slot].demand}
                              </td>
                              <td className="py-1 pl-2">
                                <TierSupply
                                  supply={row.slots[slot].supplyByTier}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
