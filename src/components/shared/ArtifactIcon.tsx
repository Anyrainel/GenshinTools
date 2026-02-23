import { ItemIcon } from "@/components/shared/ItemIcon";
import type { artifactsById } from "@/data/constants";
import type { ArtifactData, Slot } from "@/data/types";

export interface ArtifactIconProps {
  artifact: ArtifactData;
  artInfo?: (typeof artifactsById)[string];
  slot: Slot;
  size?: React.ComponentProps<typeof ItemIcon>["size"];
}

/** Simple artifact icon display without hover behavior */
export function ArtifactIcon({
  artifact,
  artInfo,
  slot,
  size = "md",
}: ArtifactIconProps) {
  const badge = artifact.astralMark ? "⭐" : undefined;
  const imagePath = artInfo?.imagePaths?.[slot] || "";

  return (
    <div className="relative shrink-0">
      <ItemIcon
        imagePath={imagePath}
        rarity={artifact.rarity}
        badge={badge}
        lock={artifact.lock}
        level={`+${artifact.level}`}
        size={size}
      />
    </div>
  );
}
