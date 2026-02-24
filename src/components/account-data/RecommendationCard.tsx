import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { DoubleItemIcon } from "@/components/shared/DoubleItemIcon";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactIdToHalfSetId,
  artifactsById,
  charactersById,
} from "@/data/constants";
import type { CharacterData, Tier } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import type { Insight } from "@/lib/account-data/insightEngine";
import { memo } from "react";
import { InsightList } from "./InsightList";

interface RecommendationCardProps {
  char: CharacterData;
  tier?: Tier;
  insights?: Insight[];
  score?: ArtifactScoreResult;
}

function RecommendationCardComponent({
  char,
  tier,
  insights,
  score,
}: RecommendationCardProps) {
  const { t } = useLanguage();

  const charInfo = charactersById[char.key];
  if (!charInfo) return null;

  // Set Bonus Logic
  const setCounts: Record<string, number> = {};
  for (const a of Object.values(char.artifacts || {})) {
    if (a) {
      setCounts[a.setKey] = (setCounts[a.setKey] || 0) + 1;
    }
  }

  const activeSets = Object.entries(setCounts)
    .filter((entry): entry is [string, number] => entry[1] >= 2)
    .sort((a, b) => b[1] - a[1]);

  // Determine set type label
  const getSetTypeLabel = () => {
    if (activeSets.length === 0) return null;

    // Check for 4pc (single set with 4+ pieces)
    const fourPcSet = activeSets.find(([, count]) => count >= 4);
    if (fourPcSet) {
      return t.artifact(fourPcSet[0]); // Return set name
    }

    // Check for 2+2 (two sets with 2+ pieces each)
    const twoPcSets = activeSets.filter(([, count]) => count >= 2);
    if (twoPcSets.length >= 2) {
      return t.ui("buildCard.2pc+2pc");
    }

    // Single 2pc set
    if (twoPcSets.length === 1) {
      return t.artifact(twoPcSets[0][0]);
    }

    return null;
  };

  const setTypeLabel = getSetTypeLabel();

  return (
    <div className="w-full min-w-[280px]">
      <Card className="flex flex-col bg-black/10 border-border/50 transition-colors overflow-hidden">
        {/* Header: Character & Sets */}
        <div className="flex items-start p-3 gap-3 bg-gradient-select border-b border-border/40">
          {/* Character Icon */}
          <Tooltip>
            <TooltipTrigger>
              <ItemIcon
                imagePath={charInfo.imagePath}
                rarity={charInfo.rarity}
                badge={char.constellation}
                level={`Lv. ${char.level}`}
                size="lg"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="p-0 border-none bg-transparent"
            >
              <CharacterTooltip characterId={char.key} />
            </TooltipContent>
          </Tooltip>

          {/* Character Name + Set Name */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="font-bold text-xl truncate text-white leading-tight">
              {t.character(char.key)}
            </div>
            {setTypeLabel && (
              <div className="text-sm text-muted-foreground line-clamp-2 leading-tight mt-1">
                {setTypeLabel}
              </div>
            )}
          </div>

          {/* Primary Artifact Icon - Uses DoubleItemIcon for 2+2pc sets */}
          {activeSets.length > 0 &&
            (() => {
              const twoPcSets = activeSets.filter(([, count]) => count >= 2);
              const is2pc2pc = twoPcSets.length >= 2;

              if (is2pc2pc) {
                // 2+2pc: Show double icon with both sets
                const halfSetId1 = artifactIdToHalfSetId[twoPcSets[0][0]];
                const halfSetId2 = artifactIdToHalfSetId[twoPcSets[1][0]];
                return (
                  <div className="self-end">
                    <Tooltip>
                      <TooltipTrigger>
                        <DoubleItemIcon
                          imagePath1={
                            artifactsById[twoPcSets[0][0]]?.imagePaths.flower ||
                            ""
                          }
                          imagePath2={
                            artifactsById[twoPcSets[1][0]]?.imagePaths.flower ||
                            ""
                          }
                          size="md"
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="p-0 border-none bg-transparent"
                      >
                        <MixedSetTooltip id1={halfSetId1} id2={halfSetId2} />
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              }

              // 4pc or single 2pc: Show single icon
              return (
                <div className="self-end">
                  <Tooltip>
                    <TooltipTrigger>
                      <ItemIcon
                        imagePath={
                          artifactsById[activeSets[0][0]]?.imagePaths.flower ||
                          ""
                        }
                        rarity={artifactsById[activeSets[0][0]]?.rarity || 5}
                        size="md"
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="p-0 border-none bg-transparent"
                    >
                      <ArtifactTooltip
                        setId={activeSets[0][0]}
                        hideFourPieceEffect={activeSets[0][1] < 4}
                      />
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })()}

          {/* Artifact Score - Bottom Right */}
          {score?.substatScore.isComplete && (
            <div className="flex flex-col gap-0 items-end justify-end leading-none shrink-0 self-end pb-2">
              <span className="text-muted-foreground font-bold text-xs leading-none">
                {t.ui("accountData.score")}
              </span>
              <ArtifactScoreHoverCard
                score={score}
                characterId={char.key}
                className="italic tracking-tighter leading-none text-2xl font-extrabold mt-1"
              />
            </div>
          )}
        </div>

        {/* Insights - Skip for pool tier */}
        {tier !== "Pool" && (
          <CardContent className="p-0 flex-1 bg-black/10 flex flex-col justify-end">
            <InsightList
              insights={insights ?? []}
              isComplete={score?.substatScore.isComplete}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export const RecommendationCard = memo(RecommendationCardComponent);
