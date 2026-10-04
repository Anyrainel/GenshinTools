import { CharAvatar } from "@/components/shared/CharAvatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { allSlots } from "@/data/enums";
import { artifactsById } from "@/data/gameResources";
import type { TriageStatistics } from "@/lib/account-data/triage/types";
import { getAssetUrl } from "@/lib/utils";

export function TriageStatisticsPanel({
  statistics,
  view,
}: {
  statistics: TriageStatistics;
  view: "sets" | "builds";
}) {
  const { t } = useLanguage();
  if (view === "builds") {
    return (
      <div className="space-y-3 text-sm">
        <p>
          {t
            .ui("triage.help.activeBuildTotal")
            .replace("{0}", String(statistics.totalBuilds))}
        </p>
        <p className="text-muted-foreground">
          {t.ui("triage.help.activeBuildDetail")}
        </p>
        {statistics.characters.length === 0 && (
          <p>{t.ui("triage.help.noActiveBuilds")}</p>
        )}
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 font-medium">
                {t.ui("teamComp.analyzerChar")}
              </th>
              <th className="py-2 text-right font-medium">
                {t.ui("triage.help.buildCountColumn")}
              </th>
            </tr>
          </thead>
          <tbody>
            {statistics.characters.map((row) => (
              <tr key={row.characterId} className="border-b border-border">
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <CharAvatar charId={row.characterId} size={24} />
                    {t.character(row.characterId)}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {row.buildCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
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
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 font-medium">
              {t.ui("triage.help.setColumn")}
            </th>
            <th className="py-2 pl-2 text-right font-medium">
              {t.ui("triage.detail.demand")}
            </th>
            <th className="py-2 pl-2 text-right font-medium">
              {t.ui("triage.help.inventoryColumn")}
            </th>
          </tr>
        </thead>
        <tbody>
          {statistics.sets.map((row) => {
            const image =
              row.source.type === "4pc"
                ? artifactsById[row.source.setKey]?.imagePaths.flower
                : null;
            return (
              <tr key={row.key} className="border-b border-border align-top">
                <td className="py-2">
                  <details>
                    <summary className="cursor-pointer">
                      {image && (
                        <img
                          src={getAssetUrl(image)}
                          alt=""
                          className="mr-1 inline-block h-6 w-6 object-contain"
                        />
                      )}
                      {row.source.type === "4pc"
                        ? t.artifact(row.source.setKey)
                        : row.source.type === "2pc"
                          ? t.halfSetShort(row.source.halfSetId)
                          : ""}
                      {row.source.type === "2pc" && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {t.ui("triage.help.sharedPool")}
                        </span>
                      )}
                    </summary>
                    <dl className="mt-2 space-y-1 text-xs">
                      {allSlots.map((slot) => (
                        <div
                          key={slot}
                          className="flex items-center justify-between gap-2"
                        >
                          <dt>{t.slot(slot)}</dt>
                          <dd className="tabular-nums">
                            {row.slots[slot].demand} / {row.slots[slot].supply}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.ui("triage.help.slotNumbers")}
                    </p>
                  </details>
                </td>
                <td className="py-2 pl-2 text-right tabular-nums">
                  {row.demand}
                </td>
                <td className="py-2 pl-2 text-right tabular-nums">
                  {row.supply}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
