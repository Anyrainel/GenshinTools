import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  SwapGuide,
  buildArtifactOwnerMap,
} from "@/components/team-comp/SwapGuide";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById, charactersById } from "@/data/constants";
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  Slot,
} from "@/data/types";
import { downloadElementAsImage } from "@/lib/downloadImage";
import { cn, getAssetUrl } from "@/lib/utils";
import type { FrozenTeam } from "@/stores/useFreezeStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import type { Team } from "@/stores/useTeamStore";
import { Download, Snowflake } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";

const SLOTS: Slot[] = ["flower", "plume", "sands", "goblet", "circlet"];

interface FrozenTeamSectionProps {
  teamId: string;
  team: Team;
  frozenTeam: FrozenTeam;
  accountData: AccountData | null;
}

export function FrozenTeamSection({
  teamId,
  team,
  frozenTeam,
  accountData,
}: FrozenTeamSectionProps) {
  const { t } = useLanguage();
  const unfreezeTeam = useFreezeStore((s) => s.unfreezeTeam);
  const unfreezeCharacters = useFreezeStore((s) => s.unfreezeCharacters);
  const exportRef = useRef<HTMLDivElement>(null);

  const frozenCharIds = frozenTeam.frozenCharIds;

  // Build equipped artifacts for swap guide
  const equippedArtifactsByChar = useMemo(() => {
    const equipped: Record<string, Record<string, ArtifactData>> = {};
    for (const cid of team.characters) {
      if (!cid) continue;
      const acctChar = accountData?.characters.find(
        (c: CharacterData) => c.key === cid
      );
      equipped[cid] = (acctChar?.artifacts || {}) as Record<
        string,
        ArtifactData
      >;
    }
    return equipped;
  }, [team.characters, accountData]);

  const optimizedArtifactsByChar = useMemo(() => {
    const optimized: Record<string, Record<string, ArtifactData>> = {};
    for (const [cid, artsBySlot] of Object.entries(
      frozenTeam.artifactsByChar
    )) {
      const slotMap: Record<string, ArtifactData> = {};
      for (const [slot, art] of Object.entries(artsBySlot)) {
        if (art) slotMap[slot] = art;
      }
      optimized[cid] = slotMap;
    }
    return optimized;
  }, [frozenTeam.artifactsByChar]);

  const handleDownload = useCallback(() => {
    if (!exportRef.current) return;
    const name = team.name || t.ui("app.print");
    downloadElementAsImage(exportRef.current, name, t);
  }, [t, team.name]);

  return (
    <div className="bg-black/15 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-black/20 border-b border-border">
        {/* Team name + frozen indicator */}
        <Snowflake className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="font-bold text-sm text-foreground truncate">
          {team.name || `Team ${teamId.slice(0, 6)}`}
        </span>

        {/* Character portraits in header */}
        <div className="flex items-center gap-1 ml-1">
          {team.characters.map((charId, i) => {
            if (!charId) return null;
            const isFrozen = frozenCharIds.includes(charId);
            return (
              <ItemIcon
                key={charId}
                characterId={charId}
                size="xs"
                frozen={isFrozen}
                className={cn(!isFrozen && "opacity-40")}
              />
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Download button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            {t.ui("app.print")}
          </Button>

          {/* Unfreeze All */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => unfreezeTeam(teamId)}
            className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
          >
            {t.ui("teamComp.unfreezeAll")}
          </Button>
        </div>
      </div>

      {/* Character cards */}
      <div
        ref={exportRef}
        className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/10 p-1 md:p-2"
      >
        {frozenCharIds.map((charId) => (
          <FrozenCharCard
            key={charId}
            charId={charId}
            teamId={teamId}
            frozenTeam={frozenTeam}
            onUnfreeze={() => unfreezeCharacters(teamId, [charId])}
          />
        ))}
      </div>

      {/* Swap Guide */}
      <SwapGuide
        team={team}
        equippedArtifactsByChar={equippedArtifactsByChar}
        optimizedArtifactsByChar={optimizedArtifactsByChar}
        accountData={accountData}
        t={t}
      />
    </div>
  );
}

// ─── Per-character frozen card ───

function FrozenCharCard({
  charId,
  teamId,
  frozenTeam,
  onUnfreeze,
}: {
  charId: string;
  teamId: string;
  frozenTeam: FrozenTeam;
  onUnfreeze: () => void;
}) {
  const { t } = useLanguage();
  const char = charactersById[charId];
  const charArtifacts = frozenTeam.artifactsByChar[charId];

  return (
    <div className="flex flex-col bg-black/15 border border-border/10 rounded-lg overflow-hidden">
      {/* Character header */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-black/20">
        <ItemIcon characterId={charId} size="sm" frozen />
        <span className="font-bold text-xs md:text-sm truncate text-foreground">
          {t.character(charId)}
        </span>
      </div>

      {/* Artifact slot icons */}
      <div className="flex items-center justify-center gap-1 px-2 py-2">
        {SLOTS.map((slot) => {
          const art = charArtifacts?.[slot];
          if (!art) {
            return (
              <div
                key={slot}
                className="w-8 h-8 rounded bg-black/20 border border-border/10 flex items-center justify-center"
              >
                <span className="text-[10px] text-muted-foreground">—</span>
              </div>
            );
          }

          const artInfo = artifactsById[art.setKey];
          const slotIcon = artInfo?.imagePaths?.[slot] || "";

          return (
            <ArtifactDataHoverCard key={slot} artifact={art} slot={slot}>
              <button
                type="button"
                className="w-8 h-8 rounded bg-black/20 border border-cyan-500/20 hover:border-cyan-400/50 transition-colors overflow-hidden cursor-pointer"
              >
                {slotIcon ? (
                  <img
                    src={getAssetUrl(slotIcon)}
                    alt={t.slot(slot)}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground">?</span>
                )}
              </button>
            </ArtifactDataHoverCard>
          );
        })}
      </div>

      {/* Unfreeze button */}
      <div className="px-2 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnfreeze}
          className="w-full h-6 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
        >
          {t.ui("teamComp.unfreezeChar")}
        </Button>
      </div>
    </div>
  );
}
