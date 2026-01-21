import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById } from "@/data/constants";
import { THEME } from "@/lib/styles";
import { cn } from "@/lib/utils";

interface ArtifactTooltipProps {
  setId: string;
  hideFourPieceEffect?: boolean;
}

export function ArtifactTooltip({
  setId,
  hideFourPieceEffect,
}: ArtifactTooltipProps) {
  const { t } = useLanguage();
  const artifact = artifactsById[setId];

  if (!artifact) return null;

  const name = t.artifact(artifact.id);
  const effects = t.artifactEffects(artifact.id);

  return (
    <div className="w-[320px] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header */}
      <div
        className={cn(
          "p-3 border-b border-white/10 flex items-start gap-3 relative overflow-hidden",
          THEME.rarity.bg[artifact.rarity]
        )}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1">
          <h3 className="font-bold text-lg leading-tight text-white mb-1 drop-shadow-md">
            {name}
            <span className="mx-3 text-yellow-400">
              {"★".repeat(artifact.rarity)}
            </span>
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 bg-slate-900/95">
        <div className="text-sm text-slate-300 leading-relaxed">
          <span className="text-slate-400 font-medium mr-1">[2]</span>
          {effects[0] || "???"}
        </div>
        {!hideFourPieceEffect && (
          <div className="text-sm text-slate-300 leading-relaxed">
            <span className="text-slate-400 font-medium mr-1">[4]</span>
            {effects[1] || "???"}
          </div>
        )}
      </div>
    </div>
  );
}
