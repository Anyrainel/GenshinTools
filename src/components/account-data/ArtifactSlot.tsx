import { ArtifactData } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn, getAssetUrl } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { artifactsById } from "@/data/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatDisplay } from "./StatDisplay";

interface ArtifactSlotProps {
  artifact?: ArtifactData;
  slot: string;
}

export const ArtifactSlot = ({ artifact, slot }: ArtifactSlotProps) => {
  const { t } = useLanguage();

  if (!artifact) {
    return (
      <div className="aspect-square bg-muted/20 rounded border border-border/30 flex items-center justify-center text-xs text-muted-foreground/50">
        {slot.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  const artInfo = artifactsById[artifact.setKey];
  const name = t.artifact(artifact.setKey);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "aspect-square relative rounded border bg-card/50 overflow-hidden group cursor-help",
            THEME.rarity.border[
              artifact.rarity as keyof typeof THEME.rarity.border
            ],
          )}
        >
          {artInfo && (
            <img
              src={getAssetUrl(artInfo.imagePath)}
              alt={name}
              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
            />
          )}
          <div className="absolute bottom-0 right-0 bg-black/60 px-1 text-[10px] text-white font-mono">
            +{artifact.level}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="p-0 border-none bg-transparent">
        <div className="w-64 bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-2 text-slate-100 shadow-xl">
          <div className="border-b border-slate-700 pb-2">
            <div
              className={cn(
                "font-bold text-sm",
                THEME.rarity.text[
                  artifact.rarity as keyof typeof THEME.rarity.text
                ],
              )}
            >
              {name}
            </div>
            <div className="text-xs text-slate-400 capitalize">
              {t.ui(`computeFilters.${slot}`)}
            </div>
          </div>
          <div className="flex justify-between items-center text-xs font-bold text-amber-200">
            <span>{t.statShort(artifact.mainStatKey)}</span>
            <span>+{artifact.level}</span>
          </div>
          <div className="space-y-0.5 pt-1">
            {Object.entries(artifact.substats).map(([key, value]) => (
              <StatDisplay key={key} statKey={key} value={value} />
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
