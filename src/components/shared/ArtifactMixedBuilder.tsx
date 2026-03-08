import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ArtifactMixedBuilderProps {
  mixedSlot1: string | number | null;
  mixedSlot2: string | number | null;
  pickingSlot: 1 | 2 | null;
  setPickingSlot: (slot: 1 | 2 | null) => void;
  isMixedComplete: boolean;
  confirmMixedSet: () => void;
}

export function ArtifactMixedBuilder({
  mixedSlot1,
  mixedSlot2,
  pickingSlot,
  setPickingSlot,
  isMixedComplete,
  confirmMixedSet,
}: ArtifactMixedBuilderProps) {
  const { t } = useLanguage();

  return (
    <div className="px-3 pb-3 shrink-0 flex gap-2 items-center border-b bg-muted/20 pt-2">
      <Button
        type="button"
        variant={pickingSlot === 1 ? "default" : "outline"}
        className={cn(
          "flex-1 h-12 relative",
          !pickingSlot && mixedSlot1 && "border-primary/50"
        )}
        onClick={() => setPickingSlot(pickingSlot === 1 ? null : 1)}
      >
        {mixedSlot1 ? (
          <span className="text-xs line-clamp-2 leading-tight">
            {t.artifactHalfSet(mixedSlot1)}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {t.ui("buildCard.effect1")}
          </span>
        )}
      </Button>

      <span className="text-muted-foreground font-bold">+</span>

      <Button
        type="button"
        variant={pickingSlot === 2 ? "default" : "outline"}
        className={cn(
          "flex-1 h-12 relative",
          !pickingSlot && mixedSlot2 && "border-primary/50"
        )}
        onClick={() => setPickingSlot(pickingSlot === 2 ? null : 2)}
      >
        {mixedSlot2 ? (
          <span className="text-xs line-clamp-2 leading-tight">
            {t.artifactHalfSet(mixedSlot2)}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {t.ui("buildCard.effect2")}
          </span>
        )}
      </Button>

      <Button
        type="button"
        size="icon"
        disabled={!isMixedComplete}
        onClick={confirmMixedSet}
        className={cn(
          "shrink-0",
          isMixedComplete ? "animate-pulse" : "opacity-50"
        )}
      >
        <Check className="h-4 w-4" />
      </Button>
    </div>
  );
}
