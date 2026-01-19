import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById, charactersById } from "@/data/constants";
import { type CharacterData, tiers } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";
import { useMemo } from "react";

interface SummaryViewProps {
  scores: Record<string, ArtifactScoreResult>;
}

export function SummaryView({ scores }: SummaryViewProps) {
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

    for (const tier of tiers) {
      byTier[tier] = [];
    }

    for (const char of accountData.characters) {
      const scoreResult = scores[char.key];
      if (!scoreResult || !scoreResult.isComplete) continue;

      const assignment = tierAssignments[char.key];
      const tier = assignment ? assignment.tier : "Pool";

      if (!byTier[tier]) {
        if (!byTier.Pool) byTier.Pool = [];
        byTier.Pool.push({ char, scoreResult });
      } else {
        byTier[tier].push({ char, scoreResult });
      }
    }

    for (const tier of Object.keys(byTier)) {
      byTier[tier].sort(
        (a, b) =>
          b.scoreResult.mainScore +
          b.scoreResult.subScore -
          (a.scoreResult.mainScore + a.scoreResult.subScore)
      );
    }

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
              <span className="text-base font-normal text-muted-foreground ml-2">
                ({chars.length})
              </span>
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {chars.map(({ char, scoreResult }) => {
                const charInfo = charactersById[char.key];
                if (!charInfo) return null;

                const artifactCounts: Record<string, number> = {};
                for (const art of Object.values(char.artifacts)) {
                  if (art?.setKey) {
                    artifactCounts[art.setKey] =
                      (artifactCounts[art.setKey] || 0) + 1;
                  }
                }

                let activeSetIds: string[] = [];
                const set4pc = Object.keys(artifactCounts).find(
                  (key) => artifactCounts[key] >= 4
                );

                if (set4pc) {
                  activeSetIds = [set4pc];
                } else {
                  const sets2pc = Object.keys(artifactCounts).filter(
                    (key) => artifactCounts[key] >= 2
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
                            size="xl"
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
                                      activeSetIds.length === 1 ? "sm" : "xs"
                                    }
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
                        className="text-2xl font-black italic tracking-tighter"
                      />
                    ) : (
                      <div className="px-1.5 py-0 rounded bg-black/20 border border-white/5 text-muted-foreground text-sm">
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
}
