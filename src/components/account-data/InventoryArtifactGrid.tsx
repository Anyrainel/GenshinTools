import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import type { ArtifactData } from "@/data/types";
import { cn } from "@/lib/utils";

export type TaggedArtifact = ArtifactData & { equipped: boolean };

interface InventoryArtifactGridProps {
  artifacts: TaggedArtifact[];
  iconSize: "lg" | "xl";
  isEditMode: boolean;
  onArtifactClick: (a: TaggedArtifact) => void;
}

export function InventoryArtifactGrid({
  artifacts,
  iconSize,
  isEditMode,
  onArtifactClick,
}: InventoryArtifactGridProps) {
  return (
    <div className="flex flex-wrap gap-3 px-2">
      {artifacts.map((a) => {
        const badge = a.astralMark ? "⭐" : undefined;

        const iconContent = (
          <div
            className={cn(
              "relative rounded-md overflow-hidden group transition-transform hover:scale-105 duration-200",
              isEditMode ? "cursor-pointer" : "cursor-help"
            )}
            onClick={isEditMode ? () => onArtifactClick(a) : undefined}
          >
            <ItemIcon
              artifactSetId={a.setKey}
              slot={a.slotKey}
              rarity={a.rarity}
              badge={badge}
              lock={a.lock}
              level={`+${a.level}`}
              size={iconSize}
            />
            {a.equipped && (
              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-green-400 shadow-sm" />
            )}
          </div>
        );

        if (isEditMode) {
          return <div key={a.id}>{iconContent}</div>;
        }

        return (
          <ArtifactDataHoverCard
            key={a.id}
            artifact={a}
            slot={a.slotKey}
            side="right"
          >
            {iconContent}
          </ArtifactDataHoverCard>
        );
      })}
    </div>
  );
}
