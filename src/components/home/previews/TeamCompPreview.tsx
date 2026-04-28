import {
  ChevronsUpDown,
  Crosshair,
  Download,
  Medal,
  Monitor,
  Snowflake,
  TrendingUp,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { CharacterWeaponPanel } from "@/components/team-comp/WeaponChoiceResultCard";
import { Button } from "@/components/ui/button";
import type { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/gameResources";
import { cn, getAssetUrl } from "@/lib/utils";
import { AnimatedTabPreview, type TabDef } from "./AnimatedTabPreview";
import {
  PREVIEW_FORMULA_LABEL,
  PREVIEW_FROZEN_ARTIFACTS,
  PREVIEW_INVESTMENT_CHAR_IDS,
  PREVIEW_WEAPON_RANKINGS,
} from "./previewData";

type PreviewProps = { t: ReturnType<typeof useLanguage>["t"] };

const tabs: TabDef[] = [
  { icon: Crosshair, labelKey: "teamComp.tabDamage" },
  { icon: Snowflake, labelKey: "teamComp.tabFrozen" },
  { icon: TrendingUp, labelKey: "teamComp.tabInvestment" },
  { icon: Medal, labelKey: "teamComp.tabWeaponChoice" },
];

/* Edges: [fromId, toId, isBest] — gold only when both endpoints are optimal */
const INVESTMENT_EDGES: [string, string, boolean][] = [
  ["0", "1", true],
  ["0", "2", false],
  ["1", "3", true],
  ["2", "3", false],
];

export default function TeamCompPreview({ t }: PreviewProps) {
  return (
    <AnimatedTabPreview
      tabs={tabs}
      t={t}
      panels={[
        {
          content: <DamageContent t={t} />,
          descKey: "greeting.previewDamage",
        },
        {
          content: <FrozenContent t={t} />,
          descKey: "greeting.previewFrozen",
        },
        {
          content: <InvestmentContent t={t} />,
          descKey: "greeting.previewInvestment",
        },
        {
          content: <WeaponContent t={t} />,
          descKey: "greeting.previewWeapon",
        },
      ]}
    />
  );
}

/** Damage — total damage card */
function DamageContent({ t }: PreviewProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs">
        <img
          src={getAssetUrl(charactersById.mavuika?.imagePath)}
          alt="mavuika"
          className="w-6 h-6 rounded-full bg-black/20"
          draggable={false}
        />
        <span className="text-amber-400 font-semibold px-1 rounded bg-amber-400/15 text-[10px]">
          {t.format("common.constellationFormat", 1)}
        </span>
        <span className="font-semibold text-foreground">
          {t.resolveLabel(PREVIEW_FORMULA_LABEL)}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
          <span className="px-1 rounded bg-muted border border-border">−</span>
          <span className="font-bold text-foreground">5</span>
          <span className="px-1 rounded bg-muted border border-border">+</span>
        </span>
      </div>
      <div
        className={cn(
          "flex items-center justify-center rounded-xl select-none",
          "gap-1.5 px-3 py-1.5",
          "bg-card/70 border border-primary/30 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.12)]"
        )}
      >
        <div className="flex items-center gap-0">
          <span className="inline-flex items-center gap-0.5 text-amber-400 font-semibold text-sm px-1 shrink-0">
            {t.ui("teamComp.critModeExpected")}
            <ChevronsUpDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
          </span>
          <div className="text-primary font-semibold tracking-wide whitespace-nowrap leading-none text-sm">
            {t.ui("teamComp.totalDamage")}
          </div>
        </div>
        <div className="text-foreground font-[math] font-black drop-shadow-sm text-3xl">
          10,427,853
        </div>
      </div>
    </div>
  );
}

/** Frozen — character card matching StatSheetPanel's frozen visual */
function FrozenContent({ t }: PreviewProps) {
  const charId = "furina";
  const char = charactersById[charId];
  const slots = ["flower", "plume", "sands", "goblet", "circlet"] as const;

  return (
    <div className="space-y-2">
      <div className="bg-black/15 border rounded-lg overflow-hidden border-border/10 ring-1 ring-cyan-400/30 shadow-[0_0_12px_rgba(34,211,238,0.06)]">
        {/* Header — matches StatSheetPanel header */}
        <div className="flex items-center gap-2 p-2 bg-black/20 border-b border-border/10">
          {char && (
            <img
              src={getAssetUrl(char.imagePath)}
              className="w-7 h-7 rounded-full bg-black/20 shrink-0"
              alt={charId}
              draggable={false}
            />
          )}
          <span className="font-bold text-sm truncate text-foreground/70">
            {t.character(charId)}
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-1 h-6 px-2.5 rounded-md text-xs font-bold border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20 whitespace-nowrap">
            <Snowflake className="w-3 h-3 shrink-0" />
            {t.ui("teamComp.freezeChar")}
          </span>
        </div>
        {/* Artifacts grid — matches ArtifactSlotGrid layout with frozen-card overlay */}
        <div className="p-1 md:p-2 frozen-card">
          <div className="grid grid-cols-5 gap-0.5 md:gap-1 lg:gap-1.5">
            {slots.map((slot) => (
              <ItemIcon
                key={slot}
                artifactSetId={PREVIEW_FROZEN_ARTIFACTS[slot].setKey}
                slot={slot}
                rarity={5}
                lock
                level={`+${PREVIEW_FROZEN_ARTIFACTS[slot].level}`}
                badge={
                  PREVIEW_FROZEN_ARTIFACTS[slot].astralMark ? "⭐" : undefined
                }
                size="md"
                frozen
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-2">
        <Button
          size="sm"
          className="gap-1.5 text-xs pointer-events-none bg-black text-white"
        >
          <Monitor className="size-3.5" />
          {t.ui("manager.equipToGame")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs pointer-events-none border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
        >
          <Download className="size-3.5" />
          {t.ui("teamComp.downloadSwapGuide")}
        </Button>
      </div>
    </div>
  );
}

/** Investment — static analyzer sequence with nodes */
function InvestmentContent({ t }: PreviewProps) {
  const charIds = PREVIEW_INVESTMENT_CHAR_IDS;
  const fmtC = (n: number) => t.format("common.constellationFormat", n);
  const fmtR = (n: number) => t.format("common.refinementFormat", n);

  const rows = [
    [
      {
        id: "0",
        jin: 0,
        isBest: true,
        pct: "100.0",
        chars: [{ id: charIds[0], c: 0, r: 0 }],
      },
    ],
    [
      {
        id: "1",
        jin: 1,
        isBest: true,
        pct: "112.3",
        chars: [{ id: charIds[0], c: 1, r: 0 }],
      },
      {
        id: "2",
        jin: 1,
        isBest: false,
        pct: "108.7",
        chars: [{ id: charIds[0], c: 0, r: 1 }],
      },
    ],
    [
      {
        id: "3",
        jin: 2,
        isBest: true,
        pct: "121.5",
        chars: [{ id: charIds[0], c: 1, r: 1 }],
      },
    ],
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; isBest: boolean }[]
  >([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const result: typeof lines = [];
    for (const [fromId, toId, isBest] of INVESTMENT_EDGES) {
      const fromEl = nodeRefs.current.get(fromId);
      const toEl = nodeRefs.current.get(toId);
      if (!fromEl || !toEl) continue;
      const fR = fromEl.getBoundingClientRect();
      const tR = toEl.getBoundingClientRect();
      result.push({
        x1: fR.left + fR.width / 2 - cRect.left,
        y1: fR.bottom - cRect.top,
        x2: tR.left + tR.width / 2 - cRect.left,
        y2: tR.top - cRect.top,
        isBest,
      });
    }
    setLines(result);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* SVG edge overlay — matches AnalyzerSequence */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", zIndex: 0 }}
      >
        {lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={
              line.isBest ? "rgb(217 119 6)" : "hsl(var(--muted-foreground))"
            }
            strokeWidth={1.5}
            strokeDasharray={line.isBest ? undefined : "4 2"}
          />
        ))}
      </svg>

      {/* Rows */}
      <div className="relative" style={{ zIndex: 1 }}>
        {rows.map((row, ri) => (
          <div
            key={ri}
            className="flex justify-center items-center py-1.5 gap-2"
          >
            {row.map((node) => (
              <div
                key={node.id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(node.id, el);
                  else nodeRefs.current.delete(node.id);
                }}
                className={cn(
                  "flex items-center gap-1 p-1 rounded border text-xs leading-none whitespace-nowrap",
                  node.isBest
                    ? "border-amber-600 bg-card"
                    : "border-muted-foreground bg-card"
                )}
              >
                <span className="font-mono font-bold text-amber-400 shrink-0">
                  {node.jin}
                </span>
                {node.chars.map((ch) => {
                  const charInfo = charactersById[ch.id];
                  return (
                    <div
                      key={ch.id}
                      className="flex items-center gap-0.5 shrink-0"
                    >
                      {charInfo && (
                        <img
                          src={getAssetUrl(charInfo.imagePath)}
                          alt={ch.id}
                          className="w-6 h-6 rounded-full"
                          draggable={false}
                        />
                      )}
                      <span className="font-mono text-[11px]">
                        {fmtC(ch.c)}
                        {fmtR(ch.r)}
                      </span>
                    </div>
                  );
                })}
                <span
                  className={cn(
                    "font-mono shrink-0",
                    node.isBest ? "text-emerald-400" : "text-slate-400"
                  )}
                >
                  {node.pct}%
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Weapon — real CharacterWeaponPanel */
function WeaponContent({ t }: PreviewProps) {
  return (
    <div className="pointer-events-none">
      <CharacterWeaponPanel
        charId="skirk"
        rankings={PREVIEW_WEAPON_RANKINGS}
        isMobile={false}
        t={t}
      />
    </div>
  );
}
