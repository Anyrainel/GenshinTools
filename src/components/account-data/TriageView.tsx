import { ArtifactDataContent } from "@/components/account-data/ArtifactDataHoverCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById } from "@/data/constants";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  DEFAULT_TRIAGE_SETTINGS,
  type TriageDecision,
  type TriageLabel,
  type TriageSettings,
  runTriage,
} from "@/lib/account-data/triage";
import { cn, getRarityColor } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import {
  ChevronDown,
  ChevronUp,
  Lock,
  LockOpen,
  Settings,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Settings Panel
// ---------------------------------------------------------------------------

function TriageSettingsPanel({
  settings,
  onChange,
  t,
}: {
  settings: TriageSettings;
  onChange: (s: TriageSettings) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const update = <K extends keyof TriageSettings>(
    key: K,
    value: TriageSettings[K]
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4 w-72">
      {/* Toggle settings */}
      {(
        [
          ["doubleCritLockEnabled", t.ui("triage.doubleCritLock")],
          ["erHoardingEnabled", t.ui("triage.erHoarding")],
          ["rareEmbryoEnabled", t.ui("triage.rareEmbryoLock")],
          ["maxLevelProtection", t.ui("triage.maxLevelProtect")],
          ["equippedProtection", t.ui("triage.equippedProtect")],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <Label className="text-sm cursor-pointer" htmlFor={key}>
            {label}
          </Label>
          <Switch
            id={key}
            checked={settings[key] as boolean}
            onCheckedChange={(v) => update(key, v)}
          />
        </div>
      ))}

      <div className="border-t border-border pt-3 space-y-3">
        {/* Minimum keep slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t.ui("triage.minimumKeep")}</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {settings.minimumKeep}
            </span>
          </div>
          <Slider
            value={[settings.minimumKeep]}
            onValueChange={([v]) => update("minimumKeep", v)}
            min={0}
            max={3}
            step={1}
          />
        </div>

        {/* Surplus buffer slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t.ui("triage.surplusBuffer")}</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {settings.surplusBuffer}
            </span>
          </div>
          <Slider
            value={[settings.surplusBuffer]}
            onValueChange={([v]) => update("surplusBuffer", v)}
            min={0}
            max={5}
            step={1}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact Card (compact)
// ---------------------------------------------------------------------------

function TriageArtifactCard({
  decision,
  t,
  expanded,
  onToggle,
}: {
  decision: TriageDecision;
  t: ReturnType<typeof useLanguage>["t"];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { artifact } = decision;
  const artInfo = artifactsById[artifact.setKey];
  const setName = t.artifact(artifact.setKey);

  const labelColor: Record<TriageLabel, string> = {
    LOCK: "text-green-400",
    BORDERLINE: "text-amber-400",
    FODDER: "text-red-400",
  };

  const labelBg: Record<TriageLabel, string> = {
    LOCK: "bg-green-500/10 border-green-500/20",
    BORDERLINE: "bg-amber-500/10 border-amber-500/20",
    FODDER: "bg-red-500/10 border-red-500/20",
  };

  // Source label for the deciding embryo
  const sourceLabel = decision.decidingResult
    ? (() => {
        const src = decision.decidingResult.embryo.demand.demandSource;
        if (src.type === "4pc") return t.ui("computeFilters.fourPc");
        if (src.type === "2pc") return t.ui("computeFilters.twoPc");
        return t.ui("triage.rulePrefixFlex");
      })()
    : null;

  const charId = decision.decidingResult?.embryo.demand.characterId;
  const charName = charId ? t.character(charId) : null;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors cursor-pointer",
        labelBg[decision.label]
      )}
      onClick={onToggle}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Artifact icon */}
          {artInfo && (
            <ItemIcon
              imagePath={artInfo.imagePaths[artifact.slotKey]}
              rarity={artifact.rarity}
              level={`+${artifact.level}`}
              lock={artifact.lock}
              size="sm"
            />
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium truncate",
                  getRarityColor(artifact.rarity, "text")
                )}
              >
                {setName}
              </span>
              {decision.decidingResult?.embryo.isRareEmbryo && (
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span>{t.slot(artifact.slotKey)}</span>
              <span>·</span>
              <span>{t.statShort(artifact.mainStatKey)}</span>
              {sourceLabel && charName && (
                <>
                  <span>·</span>
                  <span>
                    {sourceLabel} {t.ui("triage.for")} {charName}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Label badge */}
          <Badge
            variant="outline"
            className={cn("shrink-0 text-xs", labelColor[decision.label])}
          >
            {decision.label === "LOCK"
              ? t.ui("triage.lock")
              : decision.label === "BORDERLINE"
                ? t.ui("triage.borderline")
                : t.ui("triage.fodder")}
          </Badge>

          {/* Expand toggle */}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            {/* Artifact preview */}
            <div className="flex justify-center">
              <ArtifactDataContent
                artifact={artifact}
                slot={artifact.slotKey}
                showIcon
                compact
              />
            </div>

            {/* Reason */}
            {decision.decidingResult && (
              <div className="text-xs text-muted-foreground space-y-1 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">
                    {t.ui("triage.reason")}:
                  </span>
                  <span>
                    [{decision.decidingResult.ruleId}]{" "}
                    {decision.decidingResult.reason}
                  </span>
                </div>

                {/* Special rules */}
                {decision.specialRules.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>{decision.specialRules.join(", ")}</span>
                  </div>
                )}

                {/* Substat grades for all matches */}
                {decision.allResults.length > 1 && (
                  <div className="mt-1 space-y-0.5">
                    {decision.allResults.map((r, i) => {
                      const src = r.embryo.demand.demandSource;
                      const prefix =
                        src.type === "4pc"
                          ? "4pc"
                          : src.type === "2pc"
                            ? "2pc"
                            : "flex";
                      const char = t.character(r.embryo.demand.characterId);
                      const g = r.embryo.grade;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "text-xs flex items-center gap-1",
                            r === decision.decidingResult
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          <span className="font-mono">{prefix}</span>
                          <span>{char}</span>
                          <span className="text-muted-foreground">
                            ({g.coreCount}c {g.valuableCount}v {g.unwantedCount}
                            w)
                          </span>
                          <span
                            className={cn(
                              r.label === "LOCK"
                                ? "text-green-400"
                                : r.label === "FODDER"
                                  ? "text-red-400"
                                  : "text-amber-400"
                            )}
                          >
                            [{r.ruleId}]
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export function TriageView() {
  const { t } = useLanguage();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data ?? null;
  const buildGroups = useAllResolvedBuilds();

  const [settings, setSettings] = useState<TriageSettings>(
    DEFAULT_TRIAGE_SETTINGS
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Run triage computation
  const decisions = useMemo(() => {
    if (!accountData) return [];
    return runTriage(accountData, buildGroups, settings);
  }, [accountData, buildGroups, settings]);

  // Split into two recommendation lists:
  // 1. Unlocked artifacts that should be locked (label = LOCK, artifact.lock = false)
  // 2. Locked artifacts that should be unlocked (label = FODDER, artifact.lock = true)
  const recommendLock = useMemo(
    () =>
      decisions
        .filter((d) => d.label === "LOCK" && !d.artifact.lock)
        .sort(
          (a, b) =>
            (b.decidingResult?.embryo.grade.coreCount ?? 0) -
            (a.decidingResult?.embryo.grade.coreCount ?? 0)
        ),
    [decisions]
  );

  const recommendUnlock = useMemo(
    () =>
      decisions
        .filter(
          (d) =>
            (d.label === "FODDER" || d.label === "BORDERLINE") &&
            d.artifact.lock
        )
        .sort((a, b) => {
          // FODDER before BORDERLINE
          if (a.label !== b.label) return a.label === "FODDER" ? -1 : 1;
          return 0;
        }),
    [decisions]
  );

  if (!accountData || buildGroups.length === 0) {
    return (
      <ScrollLayout className="px-4 py-8">
        <div className="text-center text-muted-foreground">
          {t.ui("triage.noData")}
        </div>
      </ScrollLayout>
    );
  }

  const totalArtifacts = decisions.length;
  const lockCount = decisions.filter((d) => d.label === "LOCK").length;
  const borderCount = decisions.filter((d) => d.label === "BORDERLINE").length;
  const fodderCount = decisions.filter((d) => d.label === "FODDER").length;

  return (
    <ScrollLayout className="px-4 py-4 pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t.ui("triage.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t.ui("triage.subtitle").replace("{0}", totalArtifacts.toString())}
            <span className="ml-2">
              <span className="text-green-400">{lockCount}</span>
              {" / "}
              <span className="text-amber-400">{borderCount}</span>
              {" / "}
              <span className="text-red-400">{fodderCount}</span>
            </span>
          </p>
        </div>

        {/* Settings popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="w-4 h-4" />
              {t.ui("triage.settings")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto">
            <TriageSettingsPanel
              settings={settings}
              onChange={setSettings}
              t={t}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* No recommendations */}
      {recommendLock.length === 0 && recommendUnlock.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {t.ui("triage.noRecommendations")}
        </div>
      )}

      {/* Recommend Lock section */}
      {recommendLock.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold">
              {t.ui("triage.recommendLock")}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {recommendLock.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {t.ui("triage.recommendLockDesc")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recommendLock.map((d) => (
              <TriageArtifactCard
                key={d.artifact.id}
                decision={d}
                t={t}
                expanded={expandedIds.has(d.artifact.id)}
                onToggle={() => toggleExpanded(d.artifact.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recommend Unlock section */}
      {recommendUnlock.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <LockOpen className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold">
              {t.ui("triage.recommendUnlock")}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {recommendUnlock.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {t.ui("triage.recommendUnlockDesc")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recommendUnlock.map((d) => (
              <TriageArtifactCard
                key={d.artifact.id}
                decision={d}
                t={t}
                expanded={expandedIds.has(d.artifact.id)}
                onToggle={() => toggleExpanded(d.artifact.id)}
              />
            ))}
          </div>
        </section>
      )}
    </ScrollLayout>
  );
}
