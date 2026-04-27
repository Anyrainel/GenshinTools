import { Search } from "lucide-react";
import { forwardRef } from "react";
import {
  ArtifactDataContent,
  ArtifactDataHoverCard,
} from "@/components/shared/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/gameResources";
import type { ResourceSuggestion } from "@/lib/account-data/resourceTips";
import { suggestionCacheKey } from "@/lib/account-data/resourceTips";
import { cn, getAssetUrl } from "@/lib/utils";
import { usePUpgradeCacheStore } from "@/stores/usePUpgradeCacheStore";

const CRAFT_ICON = "/assets/craft.webp";
const REROLL_ICON = "/assets/reroll.webp";
const LEVELUP_ICON = "/assets/upgrde.webp";

const ResourceSuggestionCardBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    suggestion: ResourceSuggestion;
    cachedPUpgrade: number | undefined;
  }
>(function ResourceSuggestionCardBody(
  { suggestion, cachedPUpgrade, className, ...rest },
  ref
) {
  const { t } = useLanguage();
  const actionIcon =
    suggestion.kind === "craft"
      ? CRAFT_ICON
      : suggestion.kind === "reroll"
        ? REROLL_ICON
        : LEVELUP_ICON;
  const actionLabel =
    suggestion.kind === "craft"
      ? t.ui("evaluation.suggestCraft")
      : suggestion.kind === "reroll"
        ? t.ui("evaluation.suggestReroll")
        : t.ui("evaluation.suggestLevelup");
  const actionColor =
    suggestion.kind === "craft"
      ? "text-violet-400"
      : suggestion.kind === "reroll"
        ? "text-amber-400"
        : "text-sky-400";
  const gainValue = suggestion.expectedScoreGain;
  const gain = `${gainValue >= 0 ? "+" : ""}${gainValue.toFixed(1)}`;
  const pctUpgrade =
    cachedPUpgrade === undefined ? null : Math.round(cachedPUpgrade * 100);

  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "flex items-start gap-2.5 px-3 py-2 rounded-lg border border-border bg-muted/15 hover:bg-muted/50 hover:border-primary/70 min-w-0 text-left w-full transition-colors",
        className
      )}
    >
      {(suggestion.kind === "reroll" || suggestion.kind === "levelup") &&
      suggestion.sourceArtifact ? (
        <ArtifactDataHoverCard
          artifact={suggestion.sourceArtifact}
          slot={suggestion.slot}
        >
          <button
            type="button"
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ItemIcon
              artifactSetId={suggestion.setId}
              slot={suggestion.slot}
              size="md"
            />
          </button>
        </ArtifactDataHoverCard>
      ) : (
        <div className="shrink-0">
          <ItemIcon
            artifactSetId={suggestion.setId}
            slot={suggestion.slot}
            size="md"
          />
        </div>
      )}

      <div className="flex-1 min-w-0 leading-tight space-y-0.5">
        <div className="flex items-center gap-1 text-sm">
          <img
            src={getAssetUrl(actionIcon)}
            alt={actionLabel}
            className="w-6 h-6 shrink-0"
          />
          {suggestion.actionBadge.type === "count" ? (
            <span className="text-xs text-foreground/80 shrink-0">
              x{suggestion.actionBadge.value}
            </span>
          ) : (
            <span className="text-xs text-foreground/80 shrink-0">
              Lv{suggestion.actionBadge.value}
            </span>
          )}
          <span className={cn("font-semibold shrink-0", actionColor)}>
            {actionLabel}
          </span>
          <span className="text-foreground shrink-0">
            {t.slot(suggestion.slot)}
          </span>
          {suggestion.kind === "reroll" ? (
            <Search className="w-4 h-4 text-foreground/80 shrink-0 border border-border rounded p-0.5" />
          ) : null}
        </div>
        <div className="text-xs text-foreground truncate">
          {t.artifact(suggestion.setId)}
        </div>
        <div className="flex items-center gap-1 text-xs text-foreground truncate">
          <span>{t.statShort(suggestion.displayStats.main)}</span>
          <span className="text-foreground/80">·</span>
          <span>
            {t.statShort(suggestion.displayStats.subs[0])}
            <span className="text-foreground/80">+</span>
            {t.statShort(suggestion.displayStats.subs[1])}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 gap-0.5">
        {suggestion.characterIds.length > 0 ? (
          <div className="flex items-center gap-0.5">
            {suggestion.characterIds.map((charId) => {
              const info = charactersById[charId];
              if (!info) return null;
              return (
                <img
                  key={charId}
                  src={getAssetUrl(info.imagePath)}
                  alt={t.character(charId)}
                  title={t.character(charId)}
                  className="w-6 h-6 rounded-full bg-black/30 object-cover"
                />
              );
            })}
          </div>
        ) : null}
        <span className="font-mono text-emerald-400 text-sm leading-none">
          {gain}
          <span className="text-xs text-foreground/80 ml-0.5 font-sans">
            {t.ui("evaluation.gainLabel")}
          </span>
        </span>
        <span className="font-mono text-amber-400 text-sm leading-none">
          {pctUpgrade === null ? "…" : `${pctUpgrade}%`}
          <span className="text-xs text-foreground/80 ml-0.5 font-sans">
            {t.ui("evaluation.pUpgradeLabel")}
          </span>
        </span>
      </div>
    </div>
  );
});

export function ResourceSuggestionCard({
  suggestion,
  globalConfigHash,
}: {
  suggestion: ResourceSuggestion;
  globalConfigHash: string;
}) {
  const { t } = useLanguage();
  const cacheKey = suggestionCacheKey(suggestion, globalConfigHash);
  usePUpgradeCacheStore((s) => s.version);
  const cachedPUpgrade = usePUpgradeCacheStore.getState().cache.get(cacheKey);
  if (
    (suggestion.kind === "reroll" || suggestion.kind === "levelup") &&
    suggestion.sourceArtifact
  ) {
    const art = suggestion.sourceArtifact;
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <ResourceSuggestionCardBody
            suggestion={suggestion}
            cachedPUpgrade={cachedPUpgrade}
            className="cursor-pointer"
          />
        </DrawerTrigger>
        <DrawerContent className="bg-slate-950/95 border-t border-white/10">
          <DrawerTitle className="sr-only">
            {t.ui("accountData.artifactDetails")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {t.artifact(art.setKey)} - {t.slot(suggestion.slot)}
          </DrawerDescription>
          <div className="p-4 pt-0 safe-area-bottom flex justify-center">
            <ArtifactDataContent
              artifact={art}
              slot={suggestion.slot}
              showIcon
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <ResourceSuggestionCardBody
      suggestion={suggestion}
      cachedPUpgrade={cachedPUpgrade}
    />
  );
}
