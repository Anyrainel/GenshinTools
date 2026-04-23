import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CharacterEffect } from "@/data/types";
import { cn } from "@/lib/utils";

export function EffectCard({ effect }: { effect: CharacterEffect }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg bg-card/50 border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors cursor-pointer"
      >
        <span className="flex-1 text-left font-semibold text-sm">
          {effect.name}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30">
          <div
            className="text-sm text-muted-foreground py-2 leading-relaxed skill-desc"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Kit HTML from scraping pipeline
            dangerouslySetInnerHTML={{ __html: effect.descHtml }}
          />
        </div>
      )}
    </div>
  );
}
