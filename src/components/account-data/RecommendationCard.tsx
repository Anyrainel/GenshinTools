import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
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
import type { ArtifactData, CharacterData, Tier } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import type { Recommendation } from "@/lib/account-data/recommendationEngine";
import { PartyPopper } from "lucide-react";
import { memo } from "react";
import { ActionRecommendationCard } from "./ActionRecommendationCard";

interface RecommendationCardProps {
  char: CharacterData;
  tier?: Tier;
  recommendations?: Recommendation[];
  score?: ArtifactScoreResult;
  artifactLookup: Map<string, ArtifactData>;
}

function RecommendationCardComponent({
  char,
  tier,
  recommendations,
  score,
  artifactLookup,
}: RecommendationCardProps) {
  const { t } = useLanguage();
  const isCompact = !useMediaQuery("(min-width: 768px)");

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

  const getSetTypeLabel = () => {
    if (activeSets.length === 0) return null;
    const fourPcSet = activeSets.find(([, count]) => count >= 4);
    if (fourPcSet) return t.artifact(fourPcSet[0]);
    const twoPcSets = activeSets.filter(([, count]) => count >= 2);
    if (twoPcSets.length >= 2) return t.ui("buildCard.2pc+2pc");
    if (twoPcSets.length === 1) return t.artifact(twoPcSets[0][0]);
    return null;
  };

  const setTypeLabel = getSetTypeLabel();
  const recs = recommendations ?? [];

  return (
    <div className="w-full min-w-[280px]">
      <Card className="flex flex-col bg-black/10 border-border/50 transition-colors overflow-hidden">
        {/* Header: Character & Sets */}
        <div className="flex items-start p-3 pb-2 gap-2 md:gap-3 bg-gradient-select border-b border-border/40">
          <Tooltip>
            <TooltipTrigger>
              <ItemIcon
                imagePath={charInfo.imagePath}
                rarity={charInfo.rarity}
                badge={char.constellation}
                level={`Lv. ${char.level}`}
                size={isCompact ? "md" : "lg"}
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="p-0 border-none bg-transparent"
            >
              <CharacterTooltip characterId={char.key} />
            </TooltipContent>
          </Tooltip>

          <div className="flex flex-col min-w-0 flex-1 gap-0.5 md:gap-1">
            <div className="font-semibold text-base md:text-lg whitespace-nowrap text-white leading-none tracking-tight">
              {t.character(char.key)}
            </div>
            <div className="flex items-start gap-2">
              {setTypeLabel && (
                <div className="text-xs md:text-sm text-muted-foreground line-clamp-2 leading-tight flex-1 min-w-0">
                  {setTypeLabel}
                </div>
              )}
              {activeSets.length > 0 &&
                (() => {
                  const twoPcSets = activeSets.filter(
                    ([, count]) => count >= 2
                  );
                  const is2pc2pc = twoPcSets.length >= 2;

                  if (is2pc2pc) {
                    const halfSetId1 = artifactIdToHalfSetId[twoPcSets[0][0]];
                    const halfSetId2 = artifactIdToHalfSetId[twoPcSets[1][0]];
                    return (
                      <Tooltip>
                        <TooltipTrigger className="md:-mt-1">
                          <ItemIcon
                            imagePath={
                              artifactsById[twoPcSets[0][0]]?.imagePaths
                                .flower || ""
                            }
                            imagePath2={
                              artifactsById[twoPcSets[1][0]]?.imagePaths
                                .flower || ""
                            }
                            size={isCompact ? "xs" : "sm"}
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="p-0 border-none bg-transparent"
                        >
                          <MixedSetTooltip id1={halfSetId1} id2={halfSetId2} />
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Tooltip>
                      <TooltipTrigger className={isCompact ? "" : "-mt-1"}>
                        <ItemIcon
                          imagePath={
                            artifactsById[activeSets[0][0]]?.imagePaths
                              .flower || ""
                          }
                          rarity={artifactsById[activeSets[0][0]]?.rarity || 5}
                          size={isCompact ? "xs" : "sm"}
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
                  );
                })()}
            </div>
          </div>

          {score && (
            <ArtifactScoreHoverCard
              score={score}
              characterId={char.key}
              className="shrink-0 self-end"
            />
          )}
        </div>

        {/* Recommendations */}
        {tier !== "Pool" && (
          <CardContent className="p-0 flex-1 bg-black/10 flex flex-col justify-end">
            {recs.length === 0 ? (
              <div className="flex items-center justify-center gap-3 px-4 pt-2 pb-3 border-t border-primary/10">
                <div className="rounded-full bg-primary/20 w-8 h-8 flex items-center justify-center shrink-0">
                  <PartyPopper className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {t.ui("accountData.insights.allGood")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.ui("accountData.insights.allGoodDescription")}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-2 pb-3 px-3 border-t border-white/5">
                {recs.map((rec) => (
                  <ActionRecommendationCard
                    key={`${rec.slot}-${rec.actionType}`}
                    recommendation={rec}
                    artifactLookup={artifactLookup}
                    inline
                  />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export const RecommendationCard = memo(RecommendationCardComponent);
