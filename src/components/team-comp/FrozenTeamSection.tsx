import { ChevronDown, ChevronUp, Flame, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";
import { StatSheetPanel } from "@/components/team-comp/StatSheetPanel";
import { SwapGuide } from "@/components/team-comp/SwapGuide";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
import { charactersById } from "@/data/gameResources";
import type { AccountData, ArtifactData, CharacterData } from "@/data/types";
import { teamCompToArrays } from "@/lib/team-comp/teamDeltas";
import type { TeamComp, TeamSetupConfig } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";

interface FrozenTeamSectionProps {
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  /** 1-based display index for the "Team N" label. */
  teamIndex: number;
  /** Character IDs currently frozen in the store. */
  frozenCharIds: string[];
  /** Per-char artifact data for chars pending re-freeze (owned by parent). */
  pendingRefreezeChars: Record<string, Record<Slot, ArtifactData | null>>;
  /** Merged artifact data (frozen + pending) for all displayed chars. */
  artifactsByChar: Record<string, Record<string, ArtifactData>>;
  accountData: AccountData | null;
  onUnfreezeChar: (charId: string) => void;
  onRefreezeChar: (charId: string) => void;
  onUnfreezeAll: () => void;
  onRefreezeAll: () => void;
}

export function FrozenTeamSection({
  teamComp,
  setupConfig,
  teamIndex,
  frozenCharIds,
  pendingRefreezeChars,
  artifactsByChar,
  accountData,
  onUnfreezeChar,
  onRefreezeChar,
  onUnfreezeAll,
  onRefreezeAll,
}: FrozenTeamSectionProps) {
  const { t } = useLanguage();

  const [swapGuideOpen, setSwapGuideOpen] = useState(false);
  const { characters, artifacts } = useMemo(
    () => teamCompToArrays(teamComp),
    [teamComp]
  );

  const frozenCharIdSet = useMemo(
    () => new Set(frozenCharIds),
    [frozenCharIds]
  );

  // Characters to display: frozen + pending refreeze, in team order
  const displayCharIds = useMemo(() => {
    const set = new Set(frozenCharIds);
    for (const cid of Object.keys(pendingRefreezeChars)) set.add(cid);
    return characters.filter((c): c is string => !!c && set.has(c));
  }, [frozenCharIds, pendingRefreezeChars, characters]);

  // Full team roster for the header row
  const fullRosterCharIds = useMemo(
    () => characters.filter((c): c is string => !!c),
    [characters]
  );

  const hasPendingRefreeze = Object.keys(pendingRefreezeChars).length > 0;
  const isFrozen = frozenCharIds.length > 0;

  const displayCharacters = useMemo(
    () => [
      displayCharIds[0] ?? null,
      displayCharIds[1] ?? null,
      displayCharIds[2] ?? null,
      displayCharIds[3] ?? null,
    ],
    [displayCharIds]
  );
  const displayArtifacts = useMemo(
    () =>
      displayCharacters.map((charId) => {
        if (!charId) return null;
        const originalIndex = characters.indexOf(charId);
        return originalIndex >= 0 ? (artifacts[originalIndex] ?? null) : null;
      }),
    [displayCharacters, characters, artifacts]
  );

  // Equipped artifacts for swap guide
  const equippedArtifactsByChar = useMemo(() => {
    const equipped: Record<string, Record<string, ArtifactData>> = {};
    for (const cid of characters) {
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
  }, [characters, accountData]);

  // Optimized artifacts for swap guide — use merged artifactsByChar (all displayed chars)
  const optimizedArtifactsByChar = artifactsByChar;

  // Nothing to display
  if (displayCharIds.length === 0) return null;

  return (
    <div className="bg-black/15 border border-border rounded-lg overflow-hidden">
      {/* Header: "Team N" label + full team roster avatars + i18n names */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-black/20 border-b border-border">
        <span className="text-xs md:text-sm text-muted-foreground font-medium shrink-0">
          {t.format("teamComp.teamIndex", teamIndex)}
        </span>
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {fullRosterCharIds.map((charId) => {
            const char = charactersById[charId];
            return (
              <span key={charId} className="flex items-center gap-1 shrink-0">
                <img
                  src={getAssetUrl(char?.imagePath)}
                  className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-black/20"
                  alt={charId}
                />
                <span className="font-bold text-xs md:text-sm text-foreground">
                  {t.character(charId)}
                </span>
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Swap Guide toggle — styled to match freeze/unfreeze buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSwapGuideOpen((v) => !v)}
            className={cn(
              "gap-1 md:gap-1.5 font-bold text-[10px] px-2 py-0.5 h-6 md:text-xs md:px-4 md:py-1 md:h-8 shadow-md",
              swapGuideOpen
                ? "border-primary/40 bg-primary/15 text-foreground ring-2 ring-primary/20 hover:!bg-primary/20"
                : "border-primary/30 bg-primary/10 text-foreground ring-2 ring-primary/15 hover:!bg-primary/15 hover:ring-primary/25"
            )}
          >
            {t.ui("teamComp.swapGuide")}
            {swapGuideOpen ? (
              <ChevronUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
            ) : (
              <ChevronDown className="w-3 h-3 md:w-3.5 md:h-3.5" />
            )}
          </Button>
          {/* Unfreeze All — DamageCard style */}
          {isFrozen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUnfreezeAll}
              className="gap-1 md:gap-1.5 font-bold text-[10px] px-2 py-0.5 h-6 md:text-xs md:px-4 md:py-1 md:h-8 shadow-md border-red-400/40 bg-red-500/10 text-red-300 ring-2 ring-red-400/20 hover:!bg-red-500/15 hover:!text-red-200 hover:ring-red-400/40"
            >
              <Flame className="w-3 h-3 md:w-3.5 md:h-3.5" />
              {t.ui("teamComp.unfreezeAll")}
            </Button>
          )}
          {/* Refreeze All — DamageCard style */}
          {hasPendingRefreeze && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreezeAll}
              className="gap-1 md:gap-1.5 font-bold text-[10px] px-2 py-0.5 h-6 md:text-xs md:px-4 md:py-1 md:h-8 shadow-md border-cyan-400/40 bg-cyan-500/10 text-cyan-300 ring-2 ring-cyan-400/20 hover:!bg-cyan-500/15 hover:!text-cyan-200 hover:ring-cyan-400/40"
            >
              <Snowflake className="w-3 h-3 md:w-3.5 md:h-3.5" />
              {t.ui("teamComp.freezeTeam")}
            </Button>
          )}
        </div>
      </div>

      {/* StatSheetPanel in preview mode — shows character + artifacts + freeze/unfreeze */}
      <div className="p-1 md:p-2">
        <StatSheetPanel
          characters={displayCharacters}
          artifacts={displayArtifacts}
          artifactsByChar={artifactsByChar}
          targetCharId=""
          highlightedStat={null}
          onStatHover={() => {}}
          t={t}
          frozenCharIds={frozenCharIdSet}
          onUnfreezeChar={onUnfreezeChar}
          onFreezeChar={onRefreezeChar}
          preview
        />
      </div>

      {/* Swap Guide — toggled via header button, no inner collapsible */}
      {swapGuideOpen && (
        <SwapGuide
          comp={teamComp}
          setupConfig={setupConfig}
          characters={characters}
          equippedArtifactsByChar={equippedArtifactsByChar}
          optimizedArtifactsByChar={optimizedArtifactsByChar}
          accountData={accountData}
          t={t}
          alwaysOpen
        />
      )}
    </div>
  );
}
