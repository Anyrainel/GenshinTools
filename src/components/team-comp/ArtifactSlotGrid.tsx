import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById, charactersById } from "@/data/constants";
import type { ArtifactData, Slot } from "@/data/types";
import { cn, getAssetUrl } from "@/lib/utils";
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
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg border bg-black/15",
        isTarget ? "border-primary/40 bg-primary/5" : "border-border/15"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="shrink-0 rounded-full border border-border/20 overflow-hidden w-6 h-6 bg-secondary">
          <img
            src={getAssetUrl(charactersById[charId]?.imagePath)}
            alt={charId}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="font-bold text-xs truncate text-foreground/80">
          {t.character(charId)}
          {isTarget && <span className="text-primary/70 ml-1">★</span>}
        </span>
        {hasMismatch && (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[200px]">
              Equipped set differs from Team Roster goal
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1">
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
    </div>
  );
}
