import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById } from "@/data/constants";
import type { ArtifactData, Slot } from "@/data/types";
import type { Team } from "@/stores/useTeamStore";
import { AlertTriangle } from "lucide-react";
import { detectEquippedSets, setsMatch } from "./teamOptUtils";

const ARTIFACT_SLOTS: Slot[] = [
  "flower",
  "plume",
  "sands",
  "goblet",
  "circlet",
];

export function ArtifactSlotGrid({
  charId,
  artifactsObj,
  isTarget,
  goalConfig,
  t,
}: {
  charId: string;
  artifactsObj: Record<string, ArtifactData>;
  isTarget?: boolean;
  goalConfig?: Team["artifacts"][number];
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const equippedList = Object.values(artifactsObj);
  const equipped = detectEquippedSets(equippedList);
  const hasMismatch = goalConfig && !setsMatch(goalConfig, equipped);

  return (
    <div className="flex items-center gap-2">
      <div className="grid grid-cols-5 gap-1.5 flex-1">
        {ARTIFACT_SLOTS.map((slot) => {
          const art = artifactsObj[slot];
          if (!art)
            return (
              <div
                key={slot}
                className="aspect-square rounded border border-dashed border-border/30 flex items-center justify-center opacity-20 bg-card/10 text-[8px] uppercase font-bold text-muted-foreground"
              >
                {t.slot(slot).slice(0, 1)}
              </div>
            );
          return (
            <ArtifactDataHoverCard
              key={slot}
              artifact={art}
              slot={slot}
              side="bottom"
            >
              <div className="cursor-help">
                <ItemIcon
                  imagePath={artifactsById[art.setKey]?.imagePaths[slot]}
                  rarity={art.rarity}
                  size="sm"
                />
              </div>
            </ArtifactDataHoverCard>
          );
        })}
      </div>
      {hasMismatch && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div className="bg-amber-500/10 p-1.5 rounded flex items-center justify-center shrink-0 h-10 w-10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[200px]">
            Equipped set differs from Team Roster goal
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
