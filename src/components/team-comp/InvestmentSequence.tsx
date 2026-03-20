import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type {
  CharInvestment,
  InvestmentResult,
} from "@/lib/team-comp/investmentOptimizer";
import { getAssetUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface InvestmentSequenceProps {
  result: InvestmentResult;
}

/** Check if two CharInvestment states differ */
function investmentChanged(a: CharInvestment, b: CharInvestment): boolean {
  return (
    a.constellation !== b.constellation ||
    a.is5StarWeapon !== b.is5StarWeapon ||
    (a.is5StarWeapon && b.is5StarWeapon && a.refinement !== b.refinement)
  );
}

/** Diff two allocations to find which characters changed */
function diffAllocation(
  from: Record<string, CharInvestment>,
  to: Record<string, CharInvestment>
): { charId: string; from: CharInvestment; to: CharInvestment }[] {
  const diffs: { charId: string; from: CharInvestment; to: CharInvestment }[] =
    [];
  for (const cid of Object.keys(to)) {
    const f = from[cid];
    const t = to[cid];
    if (!f || !t) continue;
    if (investmentChanged(f, t)) {
      diffs.push({ charId: cid, from: f, to: t });
    }
  }
  return diffs;
}

type Edge = {
  fromJin: number;
  toJin: number;
  charId: string;
  from: CharInvestment;
  to: CharInvestment;
  damage: number;
  gainPct: number;
};

/** Collapse consecutive steps that only upgrade one character into a single edge */
function collapseSequence(sequence: InvestmentResult["sequence"]): Edge[] {
  if (sequence.length < 2) return [];

  const edges: Edge[] = [];
  let i = 1;

  while (i < sequence.length) {
    const prev = sequence[i - 1];
    const cur = sequence[i];
    const diffs = diffAllocation(prev.allocation, cur.allocation);

    if (diffs.length === 1) {
      // Single character changed -- try to collapse consecutive same-char upgrades
      const runCharId = diffs[0].charId;
      const runStart = i - 1;
      let runEnd = i;

      while (runEnd + 1 < sequence.length) {
        const nextDiffs = diffAllocation(
          sequence[runEnd].allocation,
          sequence[runEnd + 1].allocation
        );
        if (nextDiffs.length === 1 && nextDiffs[0].charId === runCharId) {
          runEnd++;
        } else {
          break;
        }
      }

      const baseDmg = sequence[runStart].damage;
      const endDmg = sequence[runEnd].damage;

      edges.push({
        fromJin: sequence[runStart].jin,
        toJin: sequence[runEnd].jin,
        charId: runCharId,
        from: sequence[runStart].allocation[runCharId],
        to: sequence[runEnd].allocation[runCharId],
        damage: endDmg,
        gainPct: baseDmg > 0 ? ((endDmg - baseDmg) / baseDmg) * 100 : 0,
      });

      i = runEnd + 1;
    } else {
      // Multiple characters changed or complex step
      for (const d of diffs) {
        edges.push({
          fromJin: prev.jin,
          toJin: cur.jin,
          charId: d.charId,
          from: d.from,
          to: d.to,
          damage: cur.damage,
          gainPct:
            prev.damage > 0
              ? ((cur.damage - prev.damage) / prev.damage) * 100
              : 0,
        });
      }
      i++;
    }
  }

  return edges;
}

/** Format a CharInvestment as a localized label */
function formatInvestment(
  inv: CharInvestment,
  fmtC: (n: number) => string,
  fmtR: (n: number) => string
): string {
  const c = fmtC(inv.constellation);
  return inv.is5StarWeapon ? `${c}${fmtR(inv.refinement)}` : c;
}

export function InvestmentSequence({ result }: InvestmentSequenceProps) {
  const { t } = useLanguage();
  const { sequence } = result;

  if (sequence.length < 2) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t.ui("teamComp.investNoSteps")}
      </p>
    );
  }

  const edges = collapseSequence(sequence);
  const fmtC = (n: number) => t.format("common.constellationFormat", n);
  const fmtR = (n: number) => t.format("common.refinementFormat", n);

  return (
    <div className="space-y-1">
      {/* Baseline node */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/30">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
          <span className="text-sm font-bold text-amber-400">
            {sequence[0].jin}
          </span>
        </div>
        <span className="text-sm font-medium">
          {t.ui("teamComp.investBaseline")}
        </span>
        <span className="text-xs font-mono ml-auto">
          {Math.round(sequence[0].damage).toLocaleString()}
        </span>
      </div>

      {/* Edges */}
      {edges.map((edge, i) => {
        const char = charactersById[edge.charId];
        return (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/30"
          >
            {/* Jin range */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
              <span className="text-sm font-bold text-amber-400">
                {edge.fromJin === edge.toJin - 1
                  ? edge.toJin
                  : `${edge.fromJin + 1}-${edge.toJin}`}
              </span>
            </div>

            {/* Character icon */}
            <div className="flex-shrink-0">
              {char ? (
                <img
                  src={getAssetUrl(char.imagePath)}
                  alt={edge.charId}
                  className="w-9 h-9 rounded-full border border-border"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-muted" />
              )}
            </div>

            {/* Upgrade info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="sr-only">
                  {t.ui("teamComp.investUpgrade")}:{" "}
                </span>
                <span className="text-sm font-medium truncate">
                  {t.character(edge.charId)}
                </span>
                <span className="text-xs font-mono">
                  {formatInvestment(edge.from, fmtC, fmtR)} →{" "}
                  {formatInvestment(edge.to, fmtC, fmtR)}
                </span>
              </div>
            </div>

            {/* Damage + gain */}
            <div className="flex flex-col items-end text-xs font-mono">
              <span>{Math.round(edge.damage).toLocaleString()}</span>
              <span
                className={cn(
                  edge.gainPct > 0
                    ? "text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                +{edge.gainPct.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
