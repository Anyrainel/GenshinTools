import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type {
  CharInvestment,
  InvestmentResult,
} from "@/lib/team-comp/investmentOptimizer";
import { getAssetUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface InvestmentSequenceProps {
  result: InvestmentResult;
}

/** Diff two allocations to find individual changes (constellation and refinement separately) */
function diffAllocationDetailed(
  from: Record<string, CharInvestment>,
  to: Record<string, CharInvestment>
): {
  charId: string;
  type: "constellation" | "weapon-switch" | "refinement";
  fromLabel: string;
  toLabel: string;
  /** Icon entity: charId for constellation, weaponId for weapon changes */
  iconCharId?: string;
  iconWeaponId?: string;
}[] {
  const entries: {
    charId: string;
    type: "constellation" | "weapon-switch" | "refinement";
    fromLabel: string;
    toLabel: string;
    iconCharId?: string;
    iconWeaponId?: string;
  }[] = [];

  for (const cid of Object.keys(to)) {
    const f = from[cid];
    const t = to[cid];
    if (!f || !t) continue;

    // Constellation change
    if (t.constellation !== f.constellation) {
      entries.push({
        charId: cid,
        type: "constellation",
        fromLabel: `C${f.constellation}`,
        toLabel: `C${t.constellation}`,
        iconCharId: cid,
      });
    }

    // Weapon switch (4★↔5★)
    if (t.is5StarWeapon !== f.is5StarWeapon) {
      entries.push({
        charId: cid,
        type: "weapon-switch",
        fromLabel: f.is5StarWeapon ? `R${f.refinement}` : "4★",
        toLabel: t.is5StarWeapon ? `R${t.refinement}` : "4★",
        iconWeaponId: t.weaponId,
      });
    } else if (t.is5StarWeapon && t.refinement !== f.refinement) {
      // Same 5★ weapon, refinement change
      entries.push({
        charId: cid,
        type: "refinement",
        fromLabel: `R${f.refinement}`,
        toLabel: `R${t.refinement}`,
        iconWeaponId: t.weaponId,
      });
    }
  }

  return entries;
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

  const fmtC = (n: number) => t.format("common.constellationFormat", n);
  const fmtR = (n: number) => t.format("common.refinementFormat", n);

  // Build edges: one per step, each change as a separate entry
  type Edge = {
    jin: number;
    charId: string;
    type: "constellation" | "weapon-switch" | "refinement";
    fromLabel: string;
    toLabel: string;
    iconCharId?: string;
    iconWeaponId?: string;
    damage: number;
    gainPct: number;
  };

  const edges: Edge[] = [];
  for (let i = 1; i < sequence.length; i++) {
    const prev = sequence[i - 1];
    const cur = sequence[i];
    const diffs = diffAllocationDetailed(prev.allocation, cur.allocation);

    for (const d of diffs) {
      // Localize the labels
      let fromLabel: string;
      let toLabel: string;
      if (d.type === "constellation") {
        const fromC = Number.parseInt(d.fromLabel.slice(1));
        const toC = Number.parseInt(d.toLabel.slice(1));
        fromLabel = fmtC(fromC);
        toLabel = fmtC(toC);
      } else if (d.type === "weapon-switch") {
        fromLabel =
          d.fromLabel === "4★"
            ? "4★"
            : fmtR(Number.parseInt(d.fromLabel.slice(1)));
        toLabel =
          d.toLabel === "4★" ? "4★" : fmtR(Number.parseInt(d.toLabel.slice(1)));
      } else {
        fromLabel = fmtR(Number.parseInt(d.fromLabel.slice(1)));
        toLabel = fmtR(Number.parseInt(d.toLabel.slice(1)));
      }

      edges.push({
        jin: cur.jin,
        charId: d.charId,
        type: d.type,
        fromLabel,
        toLabel,
        iconCharId: d.iconCharId,
        iconWeaponId: d.iconWeaponId,
        damage: cur.damage,
        gainPct:
          prev.damage > 0
            ? ((cur.damage - prev.damage) / prev.damage) * 100
            : 0,
      });
    }
  }

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
        // Resolve icon
        let iconSrc: string | undefined;
        let iconAlt = "";
        if (edge.iconCharId) {
          const char = charactersById[edge.iconCharId];
          iconSrc = char ? getAssetUrl(char.imagePath) : undefined;
          iconAlt = edge.iconCharId;
        } else if (edge.iconWeaponId) {
          const wep = weaponsById[edge.iconWeaponId];
          iconSrc = wep ? getAssetUrl(wep.imagePath) : undefined;
          iconAlt = edge.iconWeaponId;
        }

        // Display name
        const displayName =
          edge.type === "constellation"
            ? t.character(edge.charId)
            : edge.iconWeaponId
              ? t.weaponName(edge.iconWeaponId)
              : t.character(edge.charId);

        return (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/30"
          >
            {/* Jin */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
              <span className="text-sm font-bold text-amber-400">
                {edge.jin}
              </span>
            </div>

            {/* Icon */}
            <div className="flex-shrink-0">
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt={iconAlt}
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
                  {displayName}
                </span>
                <span className="text-xs font-mono">
                  {edge.fromLabel} → {edge.toLabel}
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
