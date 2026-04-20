import { ArtifactManagerDialog } from "@/components/artifact-manager/ArtifactManagerDialog";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById, charactersById } from "@/data/constants";
import type { AccountData, ArtifactData, Slot, SubStat } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getMainStatValueAtLevel } from "@/lib/account-data/scoring/utils";
import { buildEquipInstructions } from "@/lib/artifact-manager/instructions";
import {
  type ArtifactStatus,
  buildArtifactOwnerMap,
  getArtifactStatus,
  getRollCount,
} from "@/lib/artifact/inventory";
import { downloadElementAsImage } from "@/lib/downloadImage";
import { fmtStat } from "@/lib/team-comp/displayFormatter";
import { resolveBuildInfo } from "@/lib/team-comp/teamConfigUtils";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  Download,
  Monitor,
  Package,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

const SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

type Props = {
  team: Team;
  equippedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
  optimizedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
  accountData: AccountData | null;
  t: ReturnType<typeof useLanguage>["t"];
  /** When true, skip the collapsible wrapper — content is always shown. */
  alwaysOpen?: boolean;
};

export function SwapGuide({
  team,
  equippedArtifactsByChar,
  optimizedArtifactsByChar,
  accountData,
  t,
  alwaysOpen,
}: Props) {
  const [open, setOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    if (!exportRef.current) return;
    const charNames = team.characters
      .filter((id): id is string => id != null)
      .map((id) => t.character(id))
      .join("_");
    downloadElementAsImage(exportRef.current, charNames, t);
  }, [t, team.characters]);

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

  const [equipDialogOpen, setEquipDialogOpen] = useState(false);

  const buildEquipPayload = useCallback(
    () => buildEquipInstructions(team, optimizedArtifactsByChar, accountData),
    [team, optimizedArtifactsByChar, accountData]
  );

  if (changeCount === 0 && !alwaysOpen) return null;

  const content = (
    <div className="border-t border-border/10 bg-black/5">
      {/* Download button — hidden when no changes */}
      {changeCount > 0 && (
        <div className="flex justify-end gap-2 px-2 pt-1.5">
          <button
            type="button"
            onClick={() => setEquipDialogOpen(true)}
            className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium px-2 py-1 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title={t.ui("manager.equipToGame")}
          >
            <Monitor className="w-3 h-3" />
            <span className="hidden md:inline">
              {t.ui("manager.equipToGame")}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium px-2 py-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors"
            title={t.ui("teamComp.downloadSwapGuide")}
          >
            <Download className="w-3 h-3" />
            <span className="hidden md:inline">
              {t.ui("teamComp.downloadSwapGuide")}
            </span>
          </button>
        </div>
      )}

      {/* Hidden export container — icon headers + on-page slot rows */}
      <div
        style={{ position: "fixed", left: -9999, top: 0 }}
        aria-hidden="true"
      >
        <div ref={exportRef} style={{ width: 1400 }}>
          <div className="grid grid-cols-4 gap-px">
            {team.characters.map((charId, i) => {
              if (!charId) return <div key={i} />;
              return (
                <ExportColumn
                  key={charId}
                  charId={charId}
                  team={team}
                  equipped={equippedArtifactsByChar[charId] ?? {}}
                  optimized={optimizedArtifactsByChar[charId] ?? {}}
                  ownerMap={ownerMap}
                  accountData={accountData}
                  t={t}
                />
              );
            })}
          </div>
        </div>
      </div>

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
      <ArtifactManagerDialog
        open={equipDialogOpen}
        onOpenChange={setEquipDialogOpen}
        job={{ type: "equip", build: buildEquipPayload }}
        actionLabel={t.ui("manager.equipToGame")}
      />
    </div>
  );

  if (alwaysOpen) return content;

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

      <CollapsibleContent>{content}</CollapsibleContent>
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
      <div className="flex items-center gap-2 px-2 py-1 md:py-2 bg-black/20">
        <img
          src={getAssetUrl(char?.imagePath)}
          className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-black/20 shrink-0"
          alt={charId}
        />
        <span className="font-bold text-xs md:text-sm truncate text-foreground/70">
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

export function SlotRow({
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
        isSame ? "bg-black/10" : "bg-gradient-card"
      )}
    >
      {/* Left column: set info + main stat */}
      <div className="flex flex-col md:gap-0.5 min-w-0 w-[45%] shrink-0">
        {/* Set icon + name + slot/status */}
        <div className="flex items-center gap-1 min-w-0">
          {setIcon && (
            <img
              src={getAssetUrl(setIcon)}
              alt={setName}
              className="w-3 h-3 md:w-5 md:h-5 lg:w-6 lg:h-6 object-contain rounded-sm bg-secondary/50 shrink-0"
            />
          )}
          <span
            className={cn(
              "md:text-xs lg:text-sm font-semibold text-foreground/80 truncate leading-snug",
              setName.length >= (/[\u4e00-\u9fff]/.test(setName) ? 6 : 12)
                ? "text-[8px]"
                : "text-[10px]"
            )}
          >
            {setName}
          </span>
        </div>

        {/* Slot name + status badge */}
        <div className="flex items-center gap-1 md:gap-1.5 leading-snug">
          <span className="text-[10px] md:text-[11px] lg:text-xs text-foreground/80 capitalize whitespace-nowrap shrink-0">
            {t.slot(slot)}
          </span>
          <StatusBadge status={status} t={t} />
        </div>

        {/* Roll count */}
        {artifact.totalRolls !== undefined && (
          <span className="text-[10px] md:text-[11px] lg:text-xs text-muted-foreground leading-snug">
            {t
              .ui("accountData.totalRolls")
              .replace("{0}", String(artifact.totalRolls))}
          </span>
        )}

        {/* Main stat line: name +level value */}
        <div className="flex items-baseline gap-0.5 md:gap-1 leading-none">
          <span
            className={cn(
              "text-[10px] md:text-xs lg:text-sm font-semibold truncate text-amber-100"
            )}
          >
            {t.statMin(artifact.mainStatKey)}
          </span>
          <span
            className={cn(
              "text-[8px] md:text-[10px] lg:text-xs font-mono tabular-nums shrink-0",
              getRarityColor(artifact.rarity, "text")
            )}
          >
            +{artifact.level}
          </span>
          <span className="text-[10px] md:text-xs lg:text-sm font-mono font-semibold text-amber-100 ml-auto shrink-0">
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
      <div className="flex items-center gap-0.5 text-[10px] md:text-[11px] lg:text-xs text-green-400 font-medium leading-none whitespace-nowrap">
        <Check className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0" />
        <span className="hidden md:inline">{t.ui("accountData.equipped")}</span>
      </div>
    );
  }

  if (status.type === "fromChar") {
    return (
      <div className="flex items-center gap-0.5 text-[10px] md:text-[11px] lg:text-xs text-amber-400 font-medium leading-none whitespace-nowrap">
        <ArrowRightLeft className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0" />
        <span className="hidden md:inline truncate">
          {t.character(status.charId)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 text-[10px] md:text-[11px] lg:text-xs text-sky-400 font-medium leading-none whitespace-nowrap">
      <Package className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0" />
      <span className="hidden md:inline">
        {t.ui("teamComp.swapStatusInventory")}
      </span>
    </div>
  );
}

// ─── Export-only column: icon header + on-page slot rows ───
export function ExportColumn({
  charId,
  team,
  equipped,
  optimized,
  ownerMap,
  accountData,
  t,
}: {
  charId: string;
  team: Team;
  equipped: Record<string, ArtifactData>;
  optimized: Record<string, ArtifactData>;
  ownerMap: Map<string, string>;
  accountData: AccountData | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const char = charactersById[charId];
  const { charLevel, charConst, weaponId, weaponRefine, artConfig } =
    resolveBuildInfo(charId, team, accountData);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Build info header — icons only */}
      <div className="flex items-end gap-1.5 md:gap-4 px-1 md:px-4 py-1 md:py-2 bg-black/10">
        {char && (
          <ItemIcon
            characterId={charId}
            badge={`${charConst}`}
            level={`Lv.${charLevel}`}
            size={isDesktop ? "lg" : "sm"}
          />
        )}
        {weaponId && (
          <ItemIcon
            weaponId={weaponId}
            badge={`${weaponRefine}`}
            level="Lv.90"
            size={isDesktop ? "md" : "xs"}
          />
        )}
        {artConfig && artConfig.type === "4pc" && (
          <ItemIcon
            artifactSetId={artConfig.setId}
            size={isDesktop ? "sm" : "xs"}
          />
        )}
        {artConfig && artConfig.type === "2pc+2pc" && (
          <ItemIcon
            halfSetIds={[artConfig.id1, artConfig.id2]}
            size={isDesktop ? "sm" : "xs"}
          />
        )}
      </div>

      {/* Artifact slot rows — same components as on-page */}
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
