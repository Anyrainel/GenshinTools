import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ArtifactIcon } from "@/components/shared/ArtifactIcon";
import type { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById } from "@/data/constants";
import type { ArtifactData, Slot } from "@/data/types";

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
  t,
}: {
  charId: string;
  artifactsObj: Record<string, ArtifactData>;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ARTIFACT_SLOTS.map((slot) => {
        const art = artifactsObj[slot];
        if (!art)
          return (
            <div
              key={slot}
              className="aspect-square rounded border border-dashed border-border/30 flex items-center justify-center bg-card/10 p-0.5"
            >
              <span className="text-[10px] text-muted-foreground/50 font-medium leading-tight text-center">
                {t.ui("accountData.unequipped")}
              </span>
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
              <ArtifactIcon
                artifact={art}
                artInfo={artifactsById[art.setKey]}
                slot={slot}
                size="md"
              />
            </div>
          </ArtifactDataHoverCard>
        );
      })}
    </div>
  );
}
