import { Plus, Snowflake, X } from "lucide-react";
import { ArtifactDataHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/domain/enums";
import type { ArtifactData } from "@/domain/models";
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
    <div className="overflow-hidden rounded-xl border border-foreground/20 bg-gradient-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-foreground/15 bg-gradient-select px-3 py-2">
        <Snowflake className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-bold text-sm text-foreground">
          {t.ui("teamComp.standaloneArtifacts")}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onFreezeClick}
          className="ml-auto h-8 gap-1.5 border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-foreground hover:bg-primary/20"
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
                className="flex cursor-pointer items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
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
