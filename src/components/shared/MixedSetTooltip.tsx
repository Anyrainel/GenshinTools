import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactIdToHalfSetId,
  artifactsById,
} from "@/data/constants";
import type { ArtifactHalfSet } from "@/data/types";
import { cn, getAssetUrl } from "@/lib/utils";

type MixedSetTooltipProps =
  | { id1: number; id2: number }
  | { set1: string; set2: string };

export function MixedSetTooltip(props: MixedSetTooltipProps) {
  const { t } = useLanguage();

  let id1: number;
  let id2: number;

  if ("set1" in props) {
    id1 = artifactIdToHalfSetId[props.set1];
    id2 = artifactIdToHalfSetId[props.set2];
  } else {
    id1 = props.id1;
    id2 = props.id2;
  }

  const half1 = artifactHalfSetsById[id1];
  const half2 = artifactHalfSetsById[id2];

  if (!half1 || !half2) return null;

  const renderHalf = (half: ArtifactHalfSet) => {
    // Effect name is the effect description
    const effect = t.artifactHalfSet(half.id);

    return (
      <div className="space-y-1.5">
        <div className="text-sm text-slate-300 leading-relaxed">
          <span className="text-slate-400 font-medium mr-1">[2]</span>
          {effect}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {half.setIds.map((sid: string) => {
            const art = artifactsById[sid];
            if (!art) return null;
            return (
              <div
                key={sid}
                className="w-9 h-9 rounded border border-white/10 overflow-hidden bg-slate-800 shrink-0"
              >
                <img
                  src={getAssetUrl(art.imagePaths.flower)}
                  className="w-full h-full object-cover"
                  alt={art.id}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl text-slate-100 select-none">
      {/* Header matching ArtifactTooltip */}
      <div
        className={cn(
          "p-3 border-b border-white/10 flex items-start gap-3 relative overflow-hidden",
          "bg-rarity-5" // Hardcoded for 2pc+2pc which is always considered max rarity
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
        <div className="relative z-10 flex-1">
          <h3 className="font-bold text-lg leading-tight text-white mb-1 drop-shadow-md">
            {t.ui("buildCard.2pc+2pc")}
            <span className="mx-3 text-yellow-400">{"★".repeat(5)}</span>
          </h3>
        </div>
      </div>

      <div className="p-3 space-y-4 bg-slate-900/95">
        {renderHalf(half1)}
        {renderHalf(half2)}
      </div>
    </div>
  );
}
