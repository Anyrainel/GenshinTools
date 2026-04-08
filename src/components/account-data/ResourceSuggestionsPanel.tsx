/**
 * Panel in EvaluationView that lists craft/reroll suggestions grouped by
 * character tier. Suggestions are ordered by expected score gain within
 * each tier.
 */

import {
  ArtifactDataContent,
  ArtifactDataHoverCard,
} from "@/components/account-data/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import { type Tier, tiers } from "@/data/types";
import {
  type ResourceSuggestion,
  computeSuggestionPUpgrade,
  hashGlobalConfig,
  suggestionCacheKey,
} from "@/lib/account-data/resourceRecommendations";
import { cn, getAssetUrl } from "@/lib/utils";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { usePUpgradeCacheStore } from "@/stores/usePUpgradeCacheStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
import { useTierStore } from "@/stores/useTierStore";
import { ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";
import { forwardRef, useEffect, useMemo, useState } from "react";

const CRAFT_ICON = "/artifact/craft.webp";
const REROLL_ICON = "/artifact/reroll.webp";

const SuggestionCardBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { suggestion: ResourceSuggestion } & {
    cachedPUpgrade: number | undefined;
  }
>(function SuggestionCardBody(
  { suggestion, cachedPUpgrade, className, ...rest },
  ref
) {
  const { t } = useLanguage();
  const actionIcon = suggestion.kind === "craft" ? CRAFT_ICON : REROLL_ICON;
  const actionLabel =
    suggestion.kind === "craft"
      ? t.ui("evaluation.suggestCraft")
      : t.ui("evaluation.suggestReroll");
  const actionCount = (() => {
    const slot = suggestion.slot;
    if (slot === "flower" || slot === "plume") return 1;
    if (suggestion.kind === "reroll") return 2;
    // craft
    if (slot === "sands") return 2;
    if (slot === "circlet") return 3;
    if (slot === "goblet") return 4;
    return 1;
  })();
  const gainValue = suggestion.expectedScoreGain;
  const gain = `${gainValue >= 0 ? "+" : ""}${gainValue.toFixed(1)}`;
  const pctUpgrade =
    cachedPUpgrade === undefined ? null : Math.round(cachedPUpgrade * 100);

  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "flex items-start gap-2 px-2 py-1.5 rounded bg-muted/20 hover:bg-muted/40 min-w-0 text-left w-full",
        className
      )}
    >
      {/* Main icon: artifact slot. For reroll, hovering the icon shows the
          source artifact details (click-to-pin on desktop). */}
      {suggestion.kind === "reroll" && suggestion.sourceArtifact ? (
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
        {/* Row 1: action icon + action + slot */}
        <div className="flex items-center gap-1 text-sm">
          <img
            src={actionIcon}
            alt={actionLabel}
            className="w-6 h-6 shrink-0"
          />
          <span className="text-xs text-foreground/80 shrink-0">
            x{actionCount}
          </span>
          <span className="font-semibold shrink-0">{actionLabel}</span>
          <span className="text-foreground shrink-0">
            {t.slot(suggestion.slot)}
          </span>
          {suggestion.kind === "reroll" ? (
            <Search className="w-4 h-4 text-foreground/80 shrink-0 border border-border rounded p-0.5" />
          ) : null}
        </div>
        {/* Row 2: set name */}
        <div className="text-xs text-foreground truncate">
          {t.artifact(suggestion.setId)}
        </div>
        {/* Row 3: main stat · sub1 + sub2 */}
        <div className="flex items-center gap-1 text-xs text-foreground truncate">
          <span>{t.statShort(suggestion.mainStat)}</span>
          <span className="text-foreground/80">·</span>
          <span>
            {t.statShort(suggestion.lockedSubs[0])}
            <span className="text-foreground/80">+</span>
            {t.statShort(suggestion.lockedSubs[1])}
          </span>
        </div>
      </div>

      {/* Right-side metrics with labels, then character avatars below */}
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        {suggestion.characterIds.length > 0 ? (
          <div className="flex items-center gap-0.5">
            {suggestion.characterIds.map((charId) => {
              const charInfo = charactersById[charId];
              if (!charInfo) return null;
              return (
                <img
                  key={charId}
                  src={getAssetUrl(charInfo.imagePath)}
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

function SuggestionCard({
  suggestion,
  globalConfigHash,
}: {
  suggestion: ResourceSuggestion;
  globalConfigHash: string;
}) {
  const { t } = useLanguage();
  const cacheKey = suggestionCacheKey(suggestion, globalConfigHash);
  // Subscribe to version so this re-renders when the cache mutates.
  usePUpgradeCacheStore((s) => s.version);
  const cachedPUpgrade = usePUpgradeCacheStore.getState().cache.get(cacheKey);
  if (suggestion.kind === "reroll" && suggestion.sourceArtifact) {
    const art = suggestion.sourceArtifact;
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <SuggestionCardBody
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
    <SuggestionCardBody
      suggestion={suggestion}
      cachedPUpgrade={cachedPUpgrade}
    />
  );
}

function TierSection({
  tier,
  tierLabel,
  suggestions,
  collapsed,
  onToggleCollapsed,
  editable,
  threshold,
  minScore,
  onChangeThreshold,
  onChangeMinScore,
  globalConfigHash,
}: {
  tier: Tier;
  tierLabel: string;
  suggestions: ResourceSuggestion[];
  globalConfigHash: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  editable: boolean;
  threshold?: number;
  minScore?: number;
  onChangeThreshold?: (v: number) => void;
  onChangeMinScore?: (v: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex items-center gap-1 text-base font-bold tracking-wide text-foreground hover:bg-white/5 rounded px-1 py-0.5"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
          {tierLabel}
          <span className="text-sm text-foreground/80 ml-1">
            ({suggestions.length})
          </span>
        </button>
        {editable ? (
          <div className="flex items-center gap-3 text-sm text-foreground/80">
            <span className="flex items-center gap-1">
              {t.ui("evaluation.tierThresholds")}
              <TierNumberCell
                value={Math.round((threshold ?? 0) * 100)}
                max={100}
                ariaLabel={`Tier ${tier} completeness threshold (%)`}
                onChange={(v) => onChangeThreshold?.(v / 100)}
              />
              %
            </span>
            <span className="flex items-center gap-1">
              {t.ui("evaluation.minScoreDiff")}
              <TierNumberCell
                value={minScore ?? 0}
                min={-100}
                max={100}
                ariaLabel={`Tier ${tier} minimum score gain`}
                onChange={(v) => onChangeMinScore?.(v)}
              />
            </span>
          </div>
        ) : null}
      </div>
      {!collapsed && suggestions.length > 0 ? (
        <div className="grid gap-1 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {suggestions.map((s) => (
            <SuggestionCard
              key={`${s.kind}-${s.buildKey}-${s.slot}-${s.mainStat}-${s.lockedSubs.join("-")}-${s.sourceArtifact?.id ?? ""}`}
              suggestion={s}
              globalConfigHash={globalConfigHash}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TierNumberCell({
  value,
  min = 0,
  max,
  ariaLabel,
  onChange,
}: {
  value: number;
  min?: number;
  max: number;
  ariaLabel: string;
  onChange: (v: number) => void;
}) {
  // Local draft so intermediate states like "" or "-" don't snap back to 0
  // while the user is typing a negative number.
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <Input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      className="h-7 w-10 text-xs px-1 text-center"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9-]/g, "");
        const cleaned = raw.startsWith("-")
          ? `-${raw.slice(1).replace(/-/g, "")}`
          : raw.replace(/-/g, "");
        setDraft(cleaned);
        if (cleaned === "" || cleaned === "-") return;
        const n = Number.parseInt(cleaned, 10);
        if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
      onBlur={() => {
        if (draft === "" || draft === "-") {
          onChange(0);
          setDraft("0");
        }
      }}
    />
  );
}

export function ResourceSuggestionsPanel({
  suggestions,
}: {
  suggestions: ResourceSuggestion[];
}) {
  const { t } = useLanguage();
  const panelOpen = useResourceRecStore((s) => s.panelOpen);
  const setPanelOpen = useResourceRecStore((s) => s.setPanelOpen);
  const thresholds = useResourceRecStore((s) => s.thresholds);
  const setThreshold = useResourceRecStore((s) => s.setThreshold);
  const minScoreDiff = useResourceRecStore((s) => s.minScoreDiff);
  const setMinScoreDiff = useResourceRecStore((s) => s.setMinScoreDiff);
  const tierCustomization = useTierStore((s) => s.tierCustomization);
  const showCraft = useResourceRecStore((s) => s.showCraft);
  const showReroll = useResourceRecStore((s) => s.showReroll);
  const setShowCraft = useResourceRecStore((s) => s.setShowCraft);
  const setShowReroll = useResourceRecStore((s) => s.setShowReroll);
  const globalConfig = useArtifactScoreStore((s) => s.config.global);
  const globalConfigHash = useMemo(
    () => hashGlobalConfig(globalConfig),
    [globalConfig]
  );
  const clearPUpgradeCache = usePUpgradeCacheStore((s) => s.clear);

  // Async scheduler: compute pUpgrade for any suggestion not yet in cache,
  // yielding to the event loop between items so the UI stays responsive.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const s of suggestions) {
        if (cancelled) return;
        const key = suggestionCacheKey(s, globalConfigHash);
        if (usePUpgradeCacheStore.getState().cache.has(key)) continue;
        await new Promise((r) => setTimeout(r, 0));
        if (cancelled) return;
        const value = computeSuggestionPUpgrade(s, globalConfig);
        usePUpgradeCacheStore.getState().set(key, value);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suggestions, globalConfig, globalConfigHash]);

  // Filter by kind toggles, then group by tier.
  const filteredSuggestions = suggestions.filter(
    (s) =>
      (s.kind === "craft" && showCraft) || (s.kind === "reroll" && showReroll)
  );
  const byTier = new Map<Tier, ResourceSuggestion[]>();
  for (const t of tiers) byTier.set(t as Tier, []);
  for (const s of filteredSuggestions) {
    const arr = byTier.get(s.tier) ?? [];
    arr.push(s);
    byTier.set(s.tier, arr);
  }

  const totalCount = filteredSuggestions.length;
  const editableTiers: Tier[] = ["S", "A", "B", "C", "D"];
  const allTiers: Tier[] = ["S", "A", "B", "C", "D", "Pool"];

  const [collapsedTiers, setCollapsedTiers] = useState<Set<Tier>>(
    () => new Set()
  );
  const toggleTierCollapsed = (tier: Tier) => {
    setCollapsedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  return (
    <div className="border border-border/50 rounded-lg bg-gradient-card">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
        onClick={() => setPanelOpen(!panelOpen)}
      >
        {panelOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <img
          src={CRAFT_ICON}
          alt=""
          className="w-6 h-6 bg-black/20 rounded"
          aria-hidden="true"
        />
        <img
          src={REROLL_ICON}
          alt=""
          className="w-6 h-6 bg-black/20 rounded"
          aria-hidden="true"
        />
        <span className="font-semibold text-lg">
          {t.ui("evaluation.resourceSuggestions")}
        </span>
        <span className="text-sm text-foreground/80">({totalCount})</span>
      </button>
      {panelOpen ? (
        <div className="px-3 pb-3 space-y-3">
          <div className="flex items-center gap-6 flex-wrap border-b border-border/50 pt-3 pl-3">
            <span className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-foreground">
              <Checkbox
                checked={showCraft}
                onCheckedChange={(v) => setShowCraft(v === true)}
                className="h-5 w-5"
              />
              <img
                src={CRAFT_ICON}
                alt=""
                className="w-8 h-8 bg-black/20 rounded"
                aria-hidden="true"
              />
              {t.ui("evaluation.sanctifyingElixir")}
            </span>
            <span className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-foreground">
              <Checkbox
                checked={showReroll}
                onCheckedChange={(v) => setShowReroll(v === true)}
                className="h-5 w-5"
              />
              <img
                src={REROLL_ICON}
                alt=""
                className="w-8 h-8 bg-black/20 rounded"
                aria-hidden="true"
              />
              {t.ui("evaluation.dustOfEnlightenment")}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={clearPUpgradeCache}
              className="gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              {t.ui("evaluation.reassess")}
            </Button>
          </div>
          {totalCount === 0 ? (
            <p className="text-sm text-foreground/80 italic">
              {t.ui("evaluation.noSuggestions")}
            </p>
          ) : null}
          {allTiers.map((tier) => {
            const tierSuggestions = byTier.get(tier) ?? [];
            // Pool only renders when it has items; editable tiers always render
            // so their thresholds remain visible/editable.
            if (tier === "Pool" && tierSuggestions.length === 0) return null;
            const editable = editableTiers.includes(tier);
            const tierLabel =
              tierCustomization[tier]?.displayName ||
              (tier === "Pool"
                ? t.tier(tier)
                : `${t.ui("filters.sortByTier")} ${tier}`);
            return (
              <TierSection
                key={tier}
                tier={tier}
                tierLabel={tierLabel}
                suggestions={tierSuggestions}
                collapsed={collapsedTiers.has(tier)}
                onToggleCollapsed={() => toggleTierCollapsed(tier)}
                editable={editable}
                threshold={editable ? thresholds[tier] : undefined}
                minScore={editable ? minScoreDiff[tier] : undefined}
                onChangeThreshold={
                  editable ? (v) => setThreshold(tier, v) : undefined
                }
                onChangeMinScore={
                  editable ? (v) => setMinScoreDiff(tier, v) : undefined
                }
                globalConfigHash={globalConfigHash}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
