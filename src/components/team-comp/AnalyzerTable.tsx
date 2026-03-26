import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type { AnalyzerResult, CharInvestment } from "@/lib/team-comp/analyzer";
import { getAssetUrl } from "@/lib/utils";

interface AnalyzerTableProps {
  result: AnalyzerResult;
  /** Character IDs in team order (slot 0-3) */
  charIds: string[];
}

type DiffEntry = {
  iconPath: string;
  name: string;
  label: string;
  /** "up" = increase (green), "down" = decrease (red) */
  direction: "up" | "down";
};

/** Compute structured diffs between two allocations */
function allocationDiffs(
  prev: Record<string, CharInvestment>,
  cur: Record<string, CharInvestment>,
  charIds: string[],
  fmt: {
    charName: (cid: string) => string;
    weapon: (wid: string) => string;
    c: (n: number) => string;
    r: (n: number) => string;
  }
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  for (const cid of charIds) {
    const p = prev[cid];
    const c = cur[cid];
    if (!p || !c) continue;

    // Constellation change → show character icon + name
    if (c.constellation !== p.constellation) {
      const char = charactersById[cid];
      entries.push({
        iconPath: char?.imagePath ?? "",
        name: fmt.charName(cid),
        label: `${fmt.c(p.constellation)}→${fmt.c(c.constellation)}`,
        direction: c.constellation > p.constellation ? "up" : "down",
      });
    }

    // Weapon type switch (4★↔5★) → show new weapon icon + name
    if (c.is5StarWeapon !== p.is5StarWeapon) {
      const wep = weaponsById[c.weaponId];
      const fromR = p.is5StarWeapon ? fmt.r(p.refinement) : "4★";
      const toR = c.is5StarWeapon ? fmt.r(c.refinement) : "4★";
      entries.push({
        iconPath: wep?.imagePath ?? "",
        name: fmt.weapon(c.weaponId),
        label: `${fromR}→${toR}`,
        // Switching from 4★ to 5★ is an upgrade
        direction: c.is5StarWeapon ? "up" : "down",
      });
    } else if (c.is5StarWeapon && c.refinement !== p.refinement) {
      // Same 5★ weapon, refinement change → show weapon icon + name
      const wep = weaponsById[c.weaponId];
      entries.push({
        iconPath: wep?.imagePath ?? "",
        name: fmt.weapon(c.weaponId),
        label: `${fmt.r(p.refinement)}→${fmt.r(c.refinement)}`,
        direction: c.refinement > p.refinement ? "up" : "down",
      });
    }
  }
  return entries;
}

export function AnalyzerTable({ result, charIds }: AnalyzerTableProps) {
  const { t } = useLanguage();
  const { sequence } = result;

  if (sequence.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t.ui("teamComp.analyzerNoSteps")}
      </p>
    );
  }

  const fmtC = (n: number) => t.format("common.constellationFormat", n);
  const fmtR = (n: number) => t.format("common.refinementFormat", n);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[600px] text-xs md:text-sm">
        <thead>
          <tr className="border-b border-border text-left whitespace-nowrap">
            <th className="py-1.5 px-2 font-medium">
              {t.ui("teamComp.analyzerJin")}
            </th>
            {charIds.map((cid) => (
              <th
                key={cid}
                className="py-1.5 px-2 font-medium text-center whitespace-nowrap"
              >
                {t.character(cid)}
              </th>
            ))}
            <th className="py-1.5 px-2 font-medium text-right">
              {t.ui("common.damage")}
            </th>
            <th className="py-1.5 px-2 font-medium text-right">
              {t.ui("teamComp.analyzerVsPrev")}
            </th>
            <th className="py-1.5 px-2 font-medium">
              {t.ui("teamComp.analyzerDiff")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sequence.map((step, i) => {
            const diffs =
              i > 0
                ? allocationDiffs(
                    sequence[i - 1].allocation,
                    step.allocation,
                    charIds,
                    {
                      charName: (cid) => t.character(cid),
                      weapon: (wid) => t.weapon(wid),
                      c: fmtC,
                      r: fmtR,
                    }
                  ).sort((a, b) =>
                    a.direction === b.direction
                      ? 0
                      : a.direction === "down"
                        ? -1
                        : 1
                  )
                : [];
            return (
              <tr
                key={i}
                className="border-b border-muted-foreground hover:bg-muted/30"
              >
                <td className="py-1.5 px-2 text-amber-400 whitespace-nowrap">
                  {step.jin}
                </td>
                {charIds.map((cid) => {
                  const inv = step.allocation[cid];
                  if (!inv) return <td key={cid} />;
                  const char = charactersById[cid];
                  return (
                    <td key={cid} className="py-1.5 px-2 whitespace-nowrap">
                      <div className="flex items-center justify-start gap-0.5">
                        {char && (
                          <img
                            src={getAssetUrl(char.imagePath)}
                            alt={cid}
                            className="w-5 h-5 rounded-full"
                            style={{ imageRendering: "auto" }}
                          />
                        )}
                        <span
                          className="text-xs md:text-sm whitespace-nowrap text-slate-400"
                          title={
                            inv.is5StarWeapon
                              ? undefined
                              : t.ui("teamComp.noWeapon5Star")
                          }
                        >
                          {t.format(
                            "common.constellationRefinementCompact",
                            inv.constellation,
                            inv.is5StarWeapon ? inv.refinement : 0
                          )}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="py-1.5 px-2 text-right text-xs whitespace-nowrap">
                  {Math.round(step.damage).toLocaleString()} (
                  {(100 + step.gainVsBaselinePct).toFixed(1)}%)
                </td>
                <td className="py-1.5 px-2 text-right text-xs">
                  {i === 0 ? (
                    <span className="text-muted-foreground">&mdash;</span>
                  ) : (
                    <span className="text-emerald-400">
                      +{step.gainVsPrevPct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-xs">
                  {diffs.length > 0 ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      {diffs.map((d, j) => (
                        <div key={j} className="flex items-center gap-1">
                          {d.iconPath && (
                            <img
                              src={getAssetUrl(d.iconPath)}
                              alt=""
                              className="w-5 h-5 rounded-full"
                              style={{ imageRendering: "auto" }}
                            />
                          )}
                          <span className="whitespace-nowrap">{d.name}</span>
                          <span
                            className={`whitespace-nowrap ${d.direction === "up" ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {d.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
