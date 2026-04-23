/**
 * Dedicated page for resource spending suggestions (craft / reroll / level-up).
 * Computes suggestions from evaluation data and displays them grouped by tier.
 */

import { AccountDataNeedsBothState } from "@/components/account-data/AccountDataNeedsBothState";
import { ResourceHelpDialog } from "@/components/account-data/ResourceHelpDialog";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import {
  ArtifactDataContent,
  ArtifactDataHoverCard,
} from "@/components/shared/ArtifactDataHoverCard";
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
import { tiers } from "@/data/enums";
import type { Tier } from "@/data/enums";
import { charactersById } from "@/data/gameResources";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  evaluateAllBuilds,
  filterOwnedBuildGroups,
  selectActiveBuildsForAccount,
} from "@/lib/account-data/buildEvaluation";
import {
  type ResourceKind,
  type ResourceSuggestion,
  computeSuggestionPUpgrade,
  generateResourceSuggestions,
  hashGlobalConfig,
  suggestionCacheKey,
} from "@/lib/account-data/resourceTips";
import { cn, getAssetUrl } from "@/lib/utils";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { usePUpgradeCacheStore } from "@/stores/usePUpgradeCacheStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
import { useTierStore } from "@/stores/useTierStore";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  RefreshCw,
  Search,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useState } from "react";

const CRAFT_ICON = "/assets/craft.webp";
const REROLL_ICON = "/assets/reroll.webp";
const LEVELUP_ICON = "/assets/upgrde.webp";

// ─── Suggestion Card ─────────────────────────────────────────────

const SuggestionCardBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    suggestion: ResourceSuggestion;
    cachedPUpgrade: number | undefined;
  }
>(function SuggestionCardBody(
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
  const actionCount =
    suggestion.kind === "levelup"
      ? null
      : (() => {
          const slot = suggestion.slot;
          if (slot === "flower" || slot === "plume") return 1;
          if (suggestion.kind === "reroll") return 2;
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
            src={actionIcon}
            alt={actionLabel}
            className="w-6 h-6 shrink-0"
          />
          {actionCount != null ? (
            <span className="text-xs text-foreground/80 shrink-0">
              x{actionCount}
            </span>
          ) : (
            <span className="text-xs text-foreground/80 shrink-0">
              Lv{suggestion.sourceArtifact?.level ?? 0}
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
          <span>{t.statShort(suggestion.mainStat)}</span>
          <span className="text-foreground/80">·</span>
          <span>
            {t.statShort(suggestion.lockedSubs[0])}
            <span className="text-foreground/80">+</span>
            {t.statShort(suggestion.lockedSubs[1])}
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

function SuggestionCard({
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

// ─── Tier Section ────────────────────────────────────────────────

function TierSection({
  tier,
  tierLabel,
  suggestions,
  collapsed,
  onToggleCollapsed,
  editable,
  threshold,
  minScoreCraft,
  minScoreReroll,
  minScoreLevelup,
  showCraft,
  showReroll,
  showLevelup,
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
  minScoreCraft?: number;
  minScoreReroll?: number;
  minScoreLevelup?: number;
  showCraft: boolean;
  showReroll: boolean;
  showLevelup: boolean;
  onChangeThreshold?: (v: number) => void;
  onChangeMinScore?: (kind: ResourceKind, v: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="border border-border/50 rounded-lg bg-gradient-card">
      {/* biome-ignore lint/a11y/useSemanticElements: div with role=button avoids nested interactive elements (inputs inside) */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleCollapsed}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleCollapsed();
          }
        }}
        className="flex items-center gap-2 flex-wrap px-3 py-2 cursor-pointer select-none hover:bg-white/5 rounded-t-lg"
      >
        <span className="flex items-center gap-1 text-base font-bold tracking-wide text-foreground">
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
          {tierLabel}
          <span className="text-sm text-foreground/80 ml-1">
            ({suggestions.length})
          </span>
        </span>
        {editable ? (
          <div
            className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-foreground/80"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1 ml-2 md:ml-4">
              {t.ui("evaluation.tierThresholds")}
              <TierNumberCell
                value={Math.round((threshold ?? 0) * 100)}
                max={100}
                ariaLabel={`Tier ${tier} completeness threshold (%)`}
                onChange={(v) => onChangeThreshold?.(v / 100)}
              />
              %
            </span>
            <span className="flex items-center gap-1.5 ml-2 md:ml-4">
              {t.ui("evaluation.minScoreDiff")}
              <span
                className={cn(
                  "inline-flex items-center gap-0.5",
                  !showLevelup && "opacity-40 pointer-events-none"
                )}
              >
                <span className="text-xs text-sky-400">
                  {t.ui("evaluation.suggestLevelup")}
                </span>
                <TierNumberCell
                  value={minScoreLevelup ?? 0}
                  min={-100}
                  max={100}
                  ariaLabel={`Tier ${tier} levelup min score gain`}
                  onChange={(v) => onChangeMinScore?.("levelup", v)}
                />
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5",
                  !showCraft && "opacity-40 pointer-events-none"
                )}
              >
                <span className="text-xs text-violet-400">
                  {t.ui("evaluation.suggestCraft")}
                </span>
                <TierNumberCell
                  value={minScoreCraft ?? 0}
                  min={-100}
                  max={100}
                  ariaLabel={`Tier ${tier} craft min score gain`}
                  onChange={(v) => onChangeMinScore?.("craft", v)}
                />
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5",
                  !showReroll && "opacity-40 pointer-events-none"
                )}
              >
                <span className="text-xs text-amber-400">
                  {t.ui("evaluation.suggestReroll")}
                </span>
                <TierNumberCell
                  value={minScoreReroll ?? 0}
                  min={-100}
                  max={100}
                  ariaLabel={`Tier ${tier} reroll min score gain`}
                  onChange={(v) => onChangeMinScore?.("reroll", v)}
                />
              </span>
            </span>
          </div>
        ) : null}
      </div>
      {!collapsed && suggestions.length > 0 ? (
        <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 px-3 pb-3">
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
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <Input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      className="h-7 w-10 text-xs px-1 text-center border-border bg-muted/40"
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

// ─── Resource Kind Toggle ────────────────────────────────────────

function KindToggle({
  icon,
  label,
  checked,
  count,
  onCheckedChange,
}: {
  icon: string;
  label: string;
  checked: boolean;
  count: number;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a Radix primitive wrapping an input
    <label className="flex items-center gap-1.5 md:gap-2.5 cursor-pointer select-none rounded-lg border border-border/50 bg-gradient-card px-2 py-1.5 md:px-3 md:py-2 hover:bg-muted/30 transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="h-3 w-3 md:h-4 md:w-4"
      />
      <img
        src={icon}
        alt=""
        className="w-5 h-5 md:w-7 md:h-7"
        aria-hidden="true"
      />
      <span className="text-xs md:text-sm font-medium text-foreground">
        {label}
      </span>
      <span className="hidden md:inline text-sm text-foreground font-mono ml-auto">
        {count}
      </span>
    </label>
  );
}

// ─── Main View ───────────────────────────────────────────────────

interface ResourceViewProps {
  onOpenImport?: () => void;
  onShowTour?: () => void;
}

export function ResourceView({ onOpenImport, onShowTour }: ResourceViewProps) {
  const { t } = useLanguage();
  const accountData = useActiveAccountData();
  const buildGroups = useAllResolvedBuilds();
  const hasAnyBuilds = buildGroups.some((g) => g.builds.some((b) => b.visible));
  const scoreConfig = useArtifactScoreStore((s) => s.config);
  const tierAssignments = useTierStore((s) => s.tierAssignments);
  const tierCustomization = useTierStore((s) => s.tierCustomization);
  const recThresholds = useResourceRecStore((s) => s.thresholds);
  const recMinScoreDiff = useResourceRecStore((s) => s.minScoreDiff);
  const showCraft = useResourceRecStore((s) => s.showCraft);
  const showReroll = useResourceRecStore((s) => s.showReroll);
  const showLevelup = useResourceRecStore((s) => s.showLevelup);
  const setShowCraft = useResourceRecStore((s) => s.setShowCraft);
  const setShowReroll = useResourceRecStore((s) => s.setShowReroll);
  const setShowLevelup = useResourceRecStore((s) => s.setShowLevelup);
  const setThreshold = useResourceRecStore((s) => s.setThreshold);
  const setMinScoreDiff = useResourceRecStore((s) => s.setMinScoreDiff);

  const globalConfig = useArtifactScoreStore((s) => s.config.global);
  const globalConfigHash = useMemo(
    () => hashGlobalConfig(globalConfig),
    [globalConfig]
  );
  const clearPUpgradeCache = usePUpgradeCacheStore((s) => s.clear);
  const [recomputeTrigger, setRecomputeTrigger] = useState(0);

  const activeBuildGroups = useMemo(() => {
    if (!accountData) return [];
    return selectActiveBuildsForAccount(buildGroups, accountData);
  }, [buildGroups, accountData]);

  const suggestions = useMemo(() => {
    if (!accountData) return [];
    const ownedGroups = filterOwnedBuildGroups(activeBuildGroups, accountData);
    const ownedSetGroups = evaluateAllBuilds(
      ownedGroups,
      accountData,
      scoreConfig.global,
      true
    );
    return generateResourceSuggestions(
      ownedSetGroups,
      accountData,
      tierAssignments,
      recThresholds,
      recMinScoreDiff,
      scoreConfig.global
    );
  }, [
    activeBuildGroups,
    accountData,
    tierAssignments,
    recThresholds,
    recMinScoreDiff,
    scoreConfig.global,
  ]);

  // Async pUpgrade scheduler
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputeTrigger intentionally re-fires the effect when cache is cleared
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
  }, [suggestions, globalConfig, globalConfigHash, recomputeTrigger]);

  const craftCount = suggestions.filter((s) => s.kind === "craft").length;
  const rerollCount = suggestions.filter((s) => s.kind === "reroll").length;
  const levelupCount = suggestions.filter((s) => s.kind === "levelup").length;

  // Filter by kind toggles, group by tier
  const filteredSuggestions = suggestions.filter(
    (s) =>
      (s.kind === "craft" && showCraft) ||
      (s.kind === "reroll" && showReroll) ||
      (s.kind === "levelup" && showLevelup)
  );
  const byTier = new Map<Tier, ResourceSuggestion[]>();
  for (const tier of tiers) byTier.set(tier as Tier, []);
  for (const s of filteredSuggestions) {
    const arr = byTier.get(s.tier) ?? [];
    arr.push(s);
    byTier.set(s.tier, arr);
  }

  const editableTiers: Tier[] = ["S", "A", "B", "C", "D"];
  const allTiers: Tier[] = ["S", "A", "B", "C", "D", "Pool"];

  const [collapsedTiers, setCollapsedTiers] = useState<Set<Tier>>(
    () => new Set()
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const toggleTierCollapsed = (tier: Tier) => {
    setCollapsedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  if (!accountData || !hasAnyBuilds) {
    return (
      <ScrollLayout>
        <AccountDataNeedsBothState
          needsAccountData={!accountData}
          needsBuilds={!hasAnyBuilds}
          onOpenImport={onOpenImport}
          onShowTour={onShowTour}
        />
      </ScrollLayout>
    );
  }

  return (
    <ScrollLayout
      header={
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">
              {t.ui("evaluation.resourceSuggestions")}
            </h2>
            <span className="text-sm text-muted-foreground">
              ({suggestions.length})
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              <CircleHelp className="size-4" />
            </button>
            <div className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearPUpgradeCache();
                setRecomputeTrigger((n) => n + 1);
              }}
              className="gap-1 text-foreground"
            >
              <RefreshCw className="w-4 h-4" />
              {t.ui("evaluation.reassess")}
            </Button>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
            <KindToggle
              icon={LEVELUP_ICON}
              label={t.ui("evaluation.sanctifyingEssence")}
              checked={showLevelup}
              count={levelupCount}
              onCheckedChange={setShowLevelup}
            />
            <KindToggle
              icon={CRAFT_ICON}
              label={t.ui("evaluation.sanctifyingElixir")}
              checked={showCraft}
              count={craftCount}
              onCheckedChange={setShowCraft}
            />
            <KindToggle
              icon={REROLL_ICON}
              label={t.ui("evaluation.dustOfEnlightenment")}
              checked={showReroll}
              count={rerollCount}
              onCheckedChange={setShowReroll}
            />
          </div>
        </div>
      }
      bodyClassName="space-y-4"
    >
      {filteredSuggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic pt-4">
          {t.ui("evaluation.noSuggestions")}
        </p>
      ) : null}
      {allTiers.map((tier) => {
        const tierSuggestions = byTier.get(tier) ?? [];
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
            threshold={editable ? recThresholds[tier] : undefined}
            minScoreCraft={editable ? recMinScoreDiff.craft[tier] : undefined}
            minScoreReroll={editable ? recMinScoreDiff.reroll[tier] : undefined}
            minScoreLevelup={
              editable ? recMinScoreDiff.levelup[tier] : undefined
            }
            onChangeThreshold={
              editable ? (v) => setThreshold(tier, v) : undefined
            }
            showCraft={showCraft}
            showReroll={showReroll}
            showLevelup={showLevelup}
            onChangeMinScore={
              editable ? (kind, v) => setMinScoreDiff(kind, tier, v) : undefined
            }
            globalConfigHash={globalConfigHash}
          />
        );
      })}
      <ResourceHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ScrollLayout>
  );
}
