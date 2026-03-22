import { fmtStat } from "@/components/team-comp/displayFormatters";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById, charactersById } from "@/data/constants";
import type { AccountData, ArtifactData, Slot, SubStat } from "@/data/types";
import {
  getMainStatValueAtLevel,
  getSubstatAvgRoll,
} from "@/lib/account-data/scoring/utils";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { ArrowRightLeft, Check, ChevronDown, Package } from "lucide-react";
import { useMemo, useState } from "react";

const SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

type ArtifactStatus =
  | { type: "same" }
  | { type: "fromChar"; charId: string }
  | { type: "inventory" };

function buildArtifactOwnerMap(
  accountData: AccountData | null
): Map<string, string> {
  const map = new Map<string, string>();
  if (!accountData) return map;
  for (const char of accountData.characters) {
    for (const art of Object.values(char.artifacts)) {
      if (art) map.set(art.id, char.key);
    }
  }
  return map;
}

function getArtifactStatus(
  optimizedArt: ArtifactData | undefined,
  equippedArt: ArtifactData | undefined,
  charId: string,
  ownerMap: Map<string, string>
): ArtifactStatus {
  if (!optimizedArt) return { type: "same" };
  if (equippedArt && equippedArt.id === optimizedArt.id) {
    return { type: "same" };
  }
  const currentOwner = ownerMap.get(optimizedArt.id);
  if (currentOwner && currentOwner !== charId) {
    return { type: "fromChar", charId: currentOwner };
  }
  return { type: "inventory" };
}

function getRollCount(statKey: SubStat, value: number, rarity: number): number {
  const r = rarity === 4 || rarity === 5 ? rarity : 5;
  const avgRollValue = getSubstatAvgRoll(statKey, r as 4 | 5);
  if (!avgRollValue) return 0;
  return value / avgRollValue;
}

type Props = {
  team: Team;
  equippedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
  optimizedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
  accountData: AccountData | null;
  t: ReturnType<typeof useLanguage>["t"];
};

export function SwapGuide({
  team,
  equippedArtifactsByChar,
  optimizedArtifactsByChar,
  accountData,
  t,
}: Props) {
  const [open, setOpen] = useState(false);

  const ownerMap = useMemo(
    () => buildArtifactOwnerMap(accountData),
    [accountData]
  );

  const changeCount = useMemo(() => {
    let count = 0;
    for (const charId of team.characters) {
      if (!charId) continue;
      const equipped = equippedArtifactsByChar[charId] ?? {};
      const optimized = optimizedArtifactsByChar[charId] ?? {};
      for (const slot of SLOTS) {
        const eqArt = equipped[slot];
        const optArt = optimized[slot];
        if (optArt && (!eqArt || eqArt.id !== optArt.id)) count++;
      }
    }
    return count;
  }, [team.characters, equippedArtifactsByChar, optimizedArtifactsByChar]);

  if (changeCount === 0) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="bg-black/15 border border-border/20 rounded-lg overflow-hidden"
    >
      <CollapsibleTrigger className="flex justify-between items-center w-full px-2 py-2 md:px-4 md:py-3 hover:bg-white/5 transition-colors">
        <div className="text-xs md:text-sm font-bold flex items-center gap-1.5 md:gap-2">
          {t.ui("teamComp.swapGuide")}
          <span className="bg-black/20 font-mono px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs text-muted-foreground">
            {changeCount}{" "}
            {changeCount === 1
              ? t.ui("teamComp.swapGuideChange")
              : t.ui("teamComp.swapGuideChanges")}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-border/10 bg-black/5">
          {/* 2x2 on small screens, 4x1 on large — same as StatSheetPanel */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 xl:gap-2 p-1 md:p-2">
            {team.characters.map((charId, i) => {
              if (!charId) return <div key={i} />;
              const equipped = equippedArtifactsByChar[charId] ?? {};
              const optimized = optimizedArtifactsByChar[charId] ?? {};

              return (
                <CharacterSwapColumn
                  key={charId}
                  charId={charId}
                  equipped={equipped}
                  optimized={optimized}
                  ownerMap={ownerMap}
                  t={t}
                />
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Per-character column ───

function CharacterSwapColumn({
  charId,
  equipped,
  optimized,
  ownerMap,
  t,
}: {
  charId: string;
  equipped: Record<string, ArtifactData>;
  optimized: Record<string, ArtifactData>;
  ownerMap: Map<string, string>;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const char = charactersById[charId];

  return (
    <div className="flex flex-col bg-black/15 border border-border/10 rounded-lg overflow-hidden">
      {/* Character header */}
      <div className="flex items-center gap-2 p-2 bg-black/20 border-b border-border/10">
        <img
          src={getAssetUrl(char?.imagePath)}
          className="w-7 h-7 rounded-full bg-black/20 shrink-0"
          alt={charId}
        />
        <span className="font-bold text-sm truncate text-foreground/70">
          {t.character(charId)}
        </span>
      </div>

      {/* 5 artifact slots stacked vertically */}
      <div className="flex flex-col divide-y divide-border">
        {SLOTS.map((slot) => {
          const optArt = optimized[slot];
          const eqArt = equipped[slot];
          const status = getArtifactStatus(optArt, eqArt, charId, ownerMap);

          if (!optArt) {
            return (
              <div
                key={slot}
                className="px-2 py-1.5 flex items-center justify-center text-[10px] text-muted-foreground"
              >
                —
              </div>
            );
          }

          return (
            <SlotRow
              key={slot}
              artifact={optArt}
              slot={slot}
              status={status}
              t={t}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Per-slot row: two-column layout ───

function SlotRow({
  artifact,
  slot,
  status,
  t,
}: {
  artifact: ArtifactData;
  slot: Slot;
  status: ArtifactStatus;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const artInfo = artifactsById[artifact.setKey];
  const setIcon = artInfo?.imagePaths?.[slot] || "";
  const setName = t.artifact(artifact.setKey);
  const isSame = status.type === "same";

  const substats = Object.entries(artifact.substats ?? {}) as [
    SubStat,
    number,
  ][];
  const unactivated = Object.entries(artifact.unactivatedSubstats ?? {}).filter(
    ([, v]) => v != null
  ) as [SubStat, number][];
  const mainStatValue = getMainStatValueAtLevel(
    artifact.mainStatKey,
    artifact.rarity,
    artifact.level
  );

  return (
    <div
      className={cn(
        "flex px-1 md:px-2 2xl:px-4 py-1 2xl:py-2 gap-2 md:gap-3 2xl:gap-4",
        isSame ? "opacity-80" : "bg-gradient-card"
      )}
    >
      {/* Left column: set info + main stat */}
      <div className="flex flex-col gap-0.5 min-w-0 w-[45%] shrink-0">
        {/* Set icon + name */}
        <div className="flex items-center gap-1 min-w-0">
          {setIcon && (
            <img
              src={getAssetUrl(setIcon)}
              alt={setName}
              className="w-5 h-5 lg:w-6 lg:h-6 object-contain rounded-sm bg-secondary/50 shrink-0"
            />
          )}
          <span className="text-[10px] md:text-xs lg:text-sm font-semibold text-foreground/80 truncate leading-tight">
            {setName}
          </span>
        </div>

        {/* Slot name + status badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] md:text-[11px] lg:text-xs text-foreground/80 capitalize">
            {t.slot(slot)}
          </span>
          <StatusBadge status={status} t={t} />
        </div>

        {/* Roll count */}
        {artifact.totalRolls !== undefined && (
          <span className="text-[10px] md:text-[11px] lg:text-xs text-muted-foreground">
            {t
              .ui("accountData.totalRolls")
              .replace("{0}", String(artifact.totalRolls))}
          </span>
        )}

        {/* Main stat line: name +level value */}
        <div className="flex items-baseline gap-1 leading-none">
          <span
            className={cn(
              "text-xs lg:text-sm font-bold truncate text-amber-100"
            )}
          >
            {t.statMin(artifact.mainStatKey)}
          </span>
          <span
            className={cn(
              "text-[10px] lg:text-xs font-mono tabular-nums shrink-0",
              getRarityColor(artifact.rarity, "text")
            )}
          >
            +{artifact.level}
          </span>
          <span className="text-xs lg:text-sm font-mono font-bold text-amber-100 ml-auto shrink-0">
            {fmtStat(artifact.mainStatKey, mainStatValue, false, true)}
          </span>
        </div>
      </div>

      {/* Right column: substats */}
      <div className="flex flex-col gap-0 flex-1 min-w-0 justify-center">
        {substats.map(([key, val]) => {
          const rollCount = getRollCount(key, val, artifact.rarity);
          return (
            <div
              key={key}
              className="flex items-center gap-0.5 lg:gap-1 2xl:gap-2 text-[10px] md:text-xs lg:text-sm text-gray-200 leading-snug"
            >
              <span className="truncate">{t.statMin(key)}</span>
              <span className="text-[10px] md:text-[11px] lg:text-xs px-0.5 rounded bg-white/10 text-amber-200/80 font-mono tabular-nums shrink-0">
                {rollCount.toFixed(1)}
              </span>
              <span className="ml-auto font-mono tabular-nums shrink-0">
                {fmtStat(key, val, false, true)}
              </span>
            </div>
          );
        })}
        {unactivated.map(([key, val]) => (
          <div
            key={key}
            className="flex items-center gap-0.5 text-[10px] md:text-xs lg:text-sm text-muted-foreground leading-snug"
          >
            <span className="truncate">{t.statMin(key)}</span>
            <span className="ml-auto font-mono tabular-nums shrink-0">
              {fmtStat(key, val, false, true)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status badge ───

function StatusBadge({
  status,
  t,
}: {
  status: ArtifactStatus;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (status.type === "same") {
    return (
      <div className="flex items-center gap-0.5 text-[10px] md:text-[11px] lg:text-xs text-green-400 font-medium leading-none">
        <Check className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0" />
        <span>{t.ui("accountData.equipped")}</span>
      </div>
    );
  }

  if (status.type === "fromChar") {
    return (
      <div className="flex items-center gap-0.5 text-[10px] md:text-[11px] lg:text-xs text-amber-400 font-medium leading-none">
        <ArrowRightLeft className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0" />
        <span className="truncate">{t.character(status.charId)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 text-[10px] md:text-[11px] lg:text-xs text-sky-400 font-medium leading-none">
      <Package className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0" />
      <span>{t.ui("teamComp.swapStatusInventory")}</span>
    </div>
  );
}
