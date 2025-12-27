import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";
import { ArtifactScoreResult } from "@/lib/artifactScore";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { charactersById, artifactsById } from "@/data/constants";
import { CharacterData, tiers } from "@/data/types";
import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SummaryViewProps {
  scores: Record<string, ArtifactScoreResult>;
}

export const SummaryView = ({ scores }: SummaryViewProps) => {
  const { t } = useLanguage();
  const { accountData } = useAccountStore();
  const { tierAssignments, tierCustomization } = useTierStore();

  const charactersByTier = useMemo(() => {
    if (!accountData) return {};

    const byTier: Record<
      string,
      {
        char: CharacterData;
        scoreResult: ArtifactScoreResult;
      }[]
    > = {};

    tiers.forEach((tier) => {
      byTier[tier] = [];
    });

    accountData.characters.forEach((char) => {
      const scoreResult = scores[char.key];
      if (!scoreResult || !scoreResult.isComplete) return;

      const assignment = tierAssignments[char.key];
      const tier = assignment ? assignment.tier : "Pool";

      if (!byTier[tier]) {
        if (!byTier["Pool"]) byTier["Pool"] = [];
        byTier["Pool"].push({ char, scoreResult });
      } else {
        byTier[tier].push({ char, scoreResult });
      }
    });

    Object.keys(byTier).forEach((tier) => {
      byTier[tier].sort(
        (a, b) =>
          b.scoreResult.mainScore +
          b.scoreResult.subScore -
          (a.scoreResult.mainScore + a.scoreResult.subScore),
      );
    });

    return byTier;
  }, [accountData, scores, tierAssignments]);

  if (!accountData) return null;

  return (
    <div className="space-y-8 pb-10">
      {tiers.map((tier) => {
        const customization = tierCustomization[tier];
        if (customization?.hidden) return null;

        const chars = charactersByTier[tier] || [];
        if (chars.length === 0) return null;

        const displayName = customization?.displayName || t.ui(`tiers.${tier}`);

        return (
          <div key={tier} className="space-y-3">
            <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">
              {displayName}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({chars.length})
              </span>
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
              {chars.map(({ char, scoreResult }) => {
                const charInfo = charactersById[char.key];
                if (!charInfo) return null;

                const artifactCounts: Record<string, number> = {};
                Object.values(char.artifacts).forEach((art) => {
                  if (art && art.setKey) {
                    artifactCounts[art.setKey] =
                      (artifactCounts[art.setKey] || 0) + 1;
                  }
                });

                let activeSetIds: string[] = [];
                const set4pc = Object.keys(artifactCounts).find(
                  (key) => artifactCounts[key] >= 4,
                );

                if (set4pc) {
                  activeSetIds = [set4pc];
                } else {
                  const sets2pc = Object.keys(artifactCounts).filter(
                    (key) => artifactCounts[key] >= 2,
                  );
                  activeSetIds = sets2pc.slice(0, 2);
                }

                return (
                  <div
                    key={char.key}
                    className="flex flex-col items-center bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex flex-row items-end justify-center gap-1.5 mb-1.5">
                      {/* Character Icon + Tooltip */}
                      <Tooltip>
                        <TooltipTrigger>
                          <ItemIcon
                            imagePath={charInfo.imagePath}
                            rarity={charInfo.rarity}
                            size="w-12 h-12"
                            className="shadow-md"
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="p-0 border-none bg-transparent"
                        >
                          <CharacterTooltip characterId={char.key} />
                        </TooltipContent>
                      </Tooltip>

                      {/* Artifact Icons */}
                      {activeSetIds.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {activeSetIds.map((setId) => {
                            const artInfo = artifactsById[setId];
                            if (!artInfo) return null;
                            return (
                              <Tooltip key={setId}>
                                <TooltipTrigger>
                                  <ItemIcon
                                    imagePath={artInfo.imagePaths.flower}
                                    rarity={artInfo.rarity}
                                    size={
                                      activeSetIds.length > 1
                                        ? "w-6 h-6"
                                        : "w-9 h-9"
                                    }
                                    className="shadow-sm"
                                  />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  className="p-0 border-none bg-transparent"
                                >
                                  <ArtifactTooltip
                                    setId={setId}
                                    hideFourPieceEffect={
                                      activeSetIds.length > 1
                                    }
                                  />
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Score + HoverCard */}
                    {scoreResult ? (
                      <ArtifactScoreHoverCard
                        score={scoreResult}
                        className="text-lg font-black italic tracking-tighter"
                      />
                    ) : (
                      <div className="px-1.5 py-0 rounded bg-black/20 border border-white/5 text-muted-foreground text-xs">
                        N/A
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
