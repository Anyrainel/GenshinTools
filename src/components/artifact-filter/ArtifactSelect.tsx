import { useState, memo, useMemo, useCallback } from "react";
import { artifactHalfSets } from "@/data/resources";
import { artifactsById, sortedArtifacts } from "@/data/constants";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAssetUrl } from "@/lib/utils";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip"; // Import the shared tooltip

interface ArtifactSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}

function ArtifactSelectComponent({
  value,
  onValueChange,
  placeholder,
}: ArtifactSelectProps) {
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Memoize translated artifact data alongside an id-indexed lookup (recompute only when language changes)
  const { list: artifactList, lookup: artifactLookup } = useMemo(() => {
    const list = sortedArtifacts.map((set) => ({
      id: set.id,
      imagePath: set.imagePath,
      name: t.artifact(set.id),
      effects: t.artifactEffects(set.id),
    }));

    const lookup = Object.fromEntries(
      list.map((item) => [item.id, item] as const),
    ) as Record<string, (typeof list)[number]>;

    return { list, lookup };
  }, [t]);

  const selectedArtifact = value ? (artifactLookup[value] ?? null) : null;

  // Handle menu open change
  const handleOpenChange = useCallback((open: boolean) => {
    setIsMenuOpen(open);
  }, []);

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      onOpenChange={handleOpenChange}
    >
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>
          <SelectTrigger className={"w-32 h-32 p-0 border-2 border-border/50"}>
            <div className="w-full h-full rounded flex flex-col items-center justify-center">
              {selectedArtifact ? (
                <>
                  <img
                    src={getAssetUrl(selectedArtifact.imagePath)}
                    alt={selectedArtifact.name}
                    loading="lazy"
                    className="w-20 h-20 object-contain"
                  />
                  <span className="text-xs font-medium mt-1 text-center leading-tight px-1">
                    {selectedArtifact.name}
                  </span>
                </>
              ) : (
                <div className="text-muted-foreground text-center">
                  <div className="text-4xl mb-1">?</div>
                  <span className="text-xs">{placeholder}</span>
                </div>
              )}
            </div>
          </SelectTrigger>
        </TooltipTrigger>
        {value && !isMenuOpen && (
          <TooltipContent
            side="bottom"
            align="start"
            className="p-0 border-0 bg-transparent shadow-none z-[60]"
          >
            <ArtifactTooltip setId={value} />
          </TooltipContent>
        )}
      </Tooltip>

      <SelectContent
        className="w-96 overflow-y-auto max-h-96"
        side="right"
        align="start"
      >
        <div className="grid grid-cols-2 gap-0.5 p-0.5">
          {artifactList.map((artifact, index) => (
            <Tooltip key={artifact.id} disableHoverableContent>
              <TooltipTrigger asChild>
                <SelectItem
                  value={artifact.id}
                  className={`p-1 h-auto data-[highlighted]:bg-accent ${
                    value === artifact.id ? "bg-accent/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-1 w-full max-w-[180px]">
                    <img
                      src={getAssetUrl(artifact.imagePath)}
                      alt={artifact.name}
                      loading="lazy"
                      className="w-10 h-10 object-contain flex-shrink-0"
                    />
                    <span className="text-xs font-medium leading-tight text-left flex-1 whitespace-normal">
                      {artifact.name}
                    </span>
                  </div>
                </SelectItem>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="p-0 border-0 bg-transparent shadow-none z-[60]"
                align="start"
                sideOffset={index % 2 === 0 ? 195 : 9}
              >
                <ArtifactTooltip setId={artifact.id} />
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}

export const ArtifactSelect = memo(ArtifactSelectComponent, (prev, next) => {
  return prev.value === next.value && prev.placeholder === next.placeholder;
});

interface ArtifactSelectHalfProps {
  value: number | undefined;
  onValueChange: (value: number) => void;
  placeholder: string;
}

function ArtifactSelectHalfComponent({
  value,
  onValueChange,
  placeholder,
}: ArtifactSelectHalfProps) {
  const { language } = useLanguage();

  // Memoize effect text computation for all half sets and expose an id-indexed lookup for O(1) access
  const { list: halfSetList, lookup: halfSetLookup } = useMemo(() => {
    const list = artifactHalfSets.map((halfSet) => ({
      id: halfSet.id,
      text:
        language === "zh"
          ? halfSet.normalizedEffectTextZh
          : halfSet.normalizedEffectTextEn,
      setIds: halfSet.setIds,
    }));

    const lookup = Object.fromEntries(
      list.map((item) => [item.id, item] as const),
    ) as Record<number, (typeof list)[number]>;

    return { list, lookup };
  }, [language]);

  const selectedHalfSet =
    value !== undefined ? (halfSetLookup[value] ?? null) : null;
  const displayValue = selectedHalfSet ? selectedHalfSet.text : placeholder;

  return (
    <div className="px-1">
      <Select
        value={value?.toString() || ""}
        onValueChange={(val) => onValueChange(parseInt(val))}
      >
        <SelectTrigger className="w-full min-h-8 h-auto text-xs px-2 py-1 [&>span]:line-clamp-2">
          <SelectValue placeholder={placeholder}>{displayValue}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-96 overflow-y-auto">
          {halfSetList.map((halfSet) => (
            <SelectItem key={halfSet.id} value={halfSet.id.toString()}>
              <div className="flex items-center gap-2">
                <span className="text-xs max-w-80 break-words leading-tight">
                  {halfSet.text}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  {halfSet.setIds.map((setId) => {
                    const artifact = artifactsById[setId];
                    return (
                      <img
                        key={setId}
                        src={getAssetUrl(artifact?.imagePath)}
                        alt={artifact?.id || setId}
                        loading="lazy"
                        className="w-6 h-6 object-contain"
                      />
                    );
                  })}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const ArtifactSelectHalf = memo(
  ArtifactSelectHalfComponent,
  (prev, next) => {
    return prev.value === next.value && prev.placeholder === next.placeholder;
  },
);
