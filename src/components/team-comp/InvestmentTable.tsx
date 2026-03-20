import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type {
  CharInvestment,
  InvestmentResult,
} from "@/lib/team-comp/investmentOptimizer";
import { getAssetUrl } from "@/lib/utils";

interface InvestmentTableProps {
  result: InvestmentResult;
  valueMode: "abs" | "pct";
  /** Character IDs in team order (slot 0-3) */
  charIds: string[];
}

type DiffEntry = {
  iconPath: string;
  name: string;
  label: string;
};

/** Compute structured diffs between two allocations */
function allocationDiffs(
  prev: Record<string, CharInvestment>,
  cur: Record<string, CharInvestment>,
  charIds: string[],
  fmt: {
    charName: (cid: string) => string;
    weaponName: (wid: string) => string;
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
      });
    }

    // Weapon type switch (4★↔5★) → show new weapon icon + name
    if (c.is5StarWeapon !== p.is5StarWeapon) {
      const wep = weaponsById[c.weaponId];
      const fromR = p.is5StarWeapon ? fmt.r(p.refinement) : "4★";
      const toR = c.is5StarWeapon ? fmt.r(c.refinement) : "4★";
      entries.push({
        iconPath: wep?.imagePath ?? "",
        name: fmt.weaponName(c.weaponId),
        label: `${fromR}→${toR}`,
      });
    } else if (c.is5StarWeapon && c.refinement !== p.refinement) {
      // Same 5★ weapon, refinement change → show weapon icon + name
      const wep = weaponsById[c.weaponId];
      entries.push({
        iconPath: wep?.imagePath ?? "",
        name: fmt.weaponName(c.weaponId),
        label: `${fmt.r(p.refinement)}→${fmt.r(c.refinement)}`,
      });
    }
  }
  return entries;
}

export function InvestmentTable({
  result,
  valueMode,
  charIds,
}: InvestmentTableProps) {
  const { t } = useLanguage();
  const { sequence } = result;

  if (sequence.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t.ui("teamComp.investNoSteps")}
      </p>
    );
  }

  const fmtC = (n: number) => t.format("common.constellationFormat", n);
  const fmtR = (n: number) => t.format("common.refinementFormat", n);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1.5 px-2 font-medium">
              {t.ui("teamComp.investJin")}
            </th>
            <th className="py-1.5 px-2 font-medium">
              {t.ui("teamComp.investAllocation")}
            </th>
            <th className="py-1.5 px-2 font-medium">
              {t.ui("teamComp.investDiff")}
            </th>
            <th className="py-1.5 px-2 font-medium text-right">
              {t.ui("buildCard.autoTuneDamageRatio")}
            </th>
            <th className="py-1.5 px-2 font-medium text-right">
              {t.ui("teamComp.investVsBase")}
            </th>
            <th className="py-1.5 px-2 font-medium text-right">
              {t.ui("teamComp.investVsPrev")}
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
                      weaponName: (wid) => t.weaponName(wid),
                      c: fmtC,
                      r: fmtR,
                    }
                  )
                : [];
            return (
              <tr
                key={i}
                className="border-b border-border/50 hover:bg-muted/30"
              >
                <td className="py-1.5 px-2 font-mono text-xs">{step.jin}</td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-2">
                    {charIds.map((cid) => {
                      const inv = step.allocation[cid];
                      if (!inv) return null;
                      const char = charactersById[cid];
                      return (
                        <div key={cid} className="flex items-center gap-0.5">
                          {char && (
                            <img
                              src={char.imagePath}
                              alt={cid}
                              className="w-5 h-5 rounded-full"
                              style={{ imageRendering: "auto" }}
                            />
                          )}
                          <span
                            className="text-xs font-mono"
                            title={
                              inv.is5StarWeapon
                                ? undefined
                                : t.ui("teamComp.noWeapon5Star")
                            }
                          >
                            {fmtC(inv.constellation)}
                            {inv.is5StarWeapon ? fmtR(inv.refinement) : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-xs">
                  {diffs.length > 0 ? (
                    <div className="flex items-center gap-3">
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
                          <span className="font-mono whitespace-nowrap">
                            {d.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-xs">
                  {Math.round(step.damage).toLocaleString()}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-xs">
                  {i === 0 ? (
                    <span className="text-muted-foreground">&mdash;</span>
                  ) : valueMode === "abs" ? (
                    <span className="text-emerald-400">
                      +{Math.round(step.gainVsBaseline).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-emerald-400">
                      +{step.gainVsBaselinePct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-xs">
                  {i === 0 ? (
                    <span className="text-muted-foreground">&mdash;</span>
                  ) : valueMode === "abs" ? (
                    <span className="text-emerald-400">
                      +{Math.round(step.gainVsPrev).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-emerald-400">
                      +{step.gainVsPrevPct.toFixed(1)}%
                    </span>
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
