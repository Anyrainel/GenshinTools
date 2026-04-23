import { Plus, Snowflake, X } from "lucide-react";
import { ArtifactDataHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { cn } from "@/lib/utils";

export interface StandaloneArtifactEntry {
  art: ArtifactData;
  slot: Slot;
  isFrozen: boolean;
}

interface StandaloneArtifactsCardProps {
  artifacts: StandaloneArtifactEntry[];
  onFreezeClick: () => void;
  onClearArtifact: (artId: string) => void;
}

export function StandaloneArtifactsCard({
  artifacts,
  onFreezeClick,
  onClearArtifact,
}: StandaloneArtifactsCardProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-black/15 border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-black/20 border-b border-border">
        <Snowflake className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="font-bold text-sm text-foreground">
          {t.ui("teamComp.standaloneArtifacts")}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onFreezeClick}
          className="ml-auto gap-1.5 font-bold text-xs h-7 px-3 shadow-md border-cyan-400/40 bg-cyan-500/10 text-cyan-300 ring-2 ring-cyan-400/20 hover:!bg-cyan-500/15 hover:!text-cyan-200 hover:ring-cyan-400/40"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.ui("teamComp.freezeArtifact")}
        </Button>
      </div>

      {artifacts.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          {t.ui("teamComp.frozenEmpty")}
        </div>
      )}

      {artifacts.length > 0 && (
        <div className="px-2 py-1 md:px-3 md:py-2 flex flex-wrap gap-3">
          {artifacts.map(({ art, slot, isFrozen }) => (
            <div key={art.id} className="flex flex-col items-center gap-2">
              <ArtifactDataHoverCard artifact={art} slot={slot} side="top">
                <div className={cn(!isFrozen && "opacity-50")}>
                  <ItemIcon
                    artifactSetId={art.setKey}
                    slot={slot}
                    rarity={art.rarity}
                    lock={art.lock}
                    level={`+${art.level}`}
                    badge={art.astralMark ? "⭐" : undefined}
                    size="md"
                  />
                </div>
              </ArtifactDataHoverCard>
              <button
                type="button"
                onClick={() => onClearArtifact(art.id)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold border border-red-400/30 text-red-400/70 hover:text-red-300 hover:border-red-400/60 hover:bg-red-500/15 transition-colors cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
                {t.ui("common.clear")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
