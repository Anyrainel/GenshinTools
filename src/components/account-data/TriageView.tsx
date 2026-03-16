import { TriageCard } from "@/components/account-data/TriageCard";
import { FilterChip } from "@/components/archive/FilterChip";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  type FlexPattern,
  type TriageDecision,
  type TriageSettings,
  runTriage,
} from "@/lib/account-data/triage";
import { cn } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useTriageStore } from "@/stores/useTriageStore";
import {
  CheckCircle2,
  Lock,
  LockOpen,
  Puzzle,
  Settings,
  ShieldAlert,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const TIER_KEY = {
  P: "triage.tier.P",
  Q: "triage.tier.Q",
  N: "triage.tier.N",
  T: "triage.tier.T",
} as const;

// ---------------------------------------------------------------------------
// Grid column count (read from actual DOM grid via ResizeObserver)
// ---------------------------------------------------------------------------

function useGridCols() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(1);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const colCount = getComputedStyle(el).gridTemplateColumns.split(" ").length;
    setCols(colCount);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return { gridRef: ref, cols };
}

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
      {/* Section 1: Protection */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t.ui("triage.settingsProtection")}
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t.ui("triage.levelProtection")}</Label>
            <span className="text-sm font-mono">
              +{settings.levelProtection}
            </span>
          </div>
          <Slider
            value={[settings.levelProtection]}
            onValueChange={([v]) => update("levelProtection", v)}
            min={4}
            max={20}
            step={4}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label
            className="text-sm cursor-pointer"
            htmlFor="equippedProtection"
          >
            {t.ui("triage.equippedProtect")}
          </Label>
          <Switch
            id="equippedProtection"
            checked={settings.equippedProtection}
            onCheckedChange={(v) => update("equippedProtection", v)}
          />
        </div>
      </div>

      {/* Section 2: Thresholds */}
      <div className="border-t border-border pt-3 space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t.ui("triage.settingsThreshold")}
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">
              {t.ui("triage.mainStatThreshold")}
            </Label>
            <span className="text-sm font-mono">
              {settings.mainStatThreshold}
            </span>
          </div>
          <Slider
            value={[settings.mainStatThreshold]}
            onValueChange={([v]) => update("mainStatThreshold", v)}
            min={50}
            max={100}
            step={5}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">
              {t.ui("triage.optionalSubThreshold")}
            </Label>
            <span className="text-sm font-mono">
              {settings.optionalSubThreshold}
            </span>
          </div>
          <Slider
            value={[settings.optionalSubThreshold]}
            onValueChange={([v]) => update("optionalSubThreshold", v)}
            min={10}
            max={80}
            step={5}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm cursor-pointer" htmlFor="ownedOnly">
            {t.ui("triage.ownedOnly")}
          </Label>
          <Switch
            id="ownedOnly"
            checked={settings.ownedOnly}
            onCheckedChange={(v) => update("ownedOnly", v)}
          />
        </div>
      </div>

      {/* Section 3: Custom keep rules */}
      <div className="border-t border-border pt-3 space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t.ui("triage.settingsKeepRules")}
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t.ui("triage.setSlotKeep")}</Label>
            <span className="text-sm font-mono">{settings.setSlotKeep}</span>
          </div>
          <Slider
            value={[settings.setSlotKeep]}
            onValueChange={([v]) => update("setSlotKeep", v)}
            min={1}
            max={5}
            step={1}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t.ui("triage.neutralKeep")}</Label>
            <span className="text-sm font-mono">{settings.neutralKeep}</span>
          </div>
          <Slider
            value={[settings.neutralKeep]}
            onValueChange={([v]) => update("neutralKeep", v)}
            min={1}
            max={5}
            step={1}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t.ui("triage.qualityMargin")}</Label>
            <span className="text-sm font-mono">{settings.qualityMargin}</span>
          </div>
          <Slider
            value={[settings.qualityMargin]}
            onValueChange={([v]) => update("qualityMargin", v)}
            min={1}
            max={5}
            step={1}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flex Pattern Dialog
// ---------------------------------------------------------------------------

function FlexPatternDialog({
  open,
  onOpenChange,
  flexPatterns,
  settings,
  onSettingsChange,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flexPatterns: FlexPattern[];
  settings: TriageSettings;
  onSettingsChange: (s: TriageSettings) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const togglePattern = (fp: FlexPattern) => {
    const disabled = settings.disabledFlexPatterns;
    const next = disabled.includes(fp.key)
      ? disabled.filter((k) => k !== fp.key)
      : [...disabled, fp.key];
    onSettingsChange({ ...settings, disabledFlexPatterns: next });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("triage.flexPatterns")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("triage.flexDialogDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Special lock rules */}
          {(
            [
              ["doubleCritLockEnabled", t.ui("triage.doubleCritLock")],
              ["erHoardingEnabled", t.ui("triage.erHoarding")],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                settings[key]
                  ? "border-purple-500/20 bg-purple-500/5"
                  : "border-border opacity-50"
              )}
            >
              <Switch
                checked={settings[key] as boolean}
                onCheckedChange={(v) =>
                  onSettingsChange({ ...settings, [key]: v })
                }
              />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}

          {/* Separator */}
          {flexPatterns.length > 0 && (
            <div className="border-t border-border my-1" />
          )}

          {/* Flex patterns */}
          {flexPatterns.map((fp) => {
            const enabled = !settings.disabledFlexPatterns.includes(fp.key);
            return (
              <div
                key={fp.key}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  enabled
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-border opacity-50"
                )}
              >
                <Switch
                  checked={enabled}
                  onCheckedChange={() => togglePattern(fp)}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
                    <span>{t.slot(fp.slot)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{t.statShort(fp.mainStat)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>
                      {fp.requiredSubs.map((s) => t.statShort(s)).join("+")}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {(fp.rarity * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
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

  const settings = useTriageStore((s) => s.settings);
  const setSettings = useTriageStore((s) => s.setSettings);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { gridRef, cols: gridCols } = useGridCols();

  const toggleRow = (tab: string, index: number) => {
    const row = Math.floor(index / gridCols);
    const key = `${tab}:${row}`;
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isRowExpanded = (tab: string, index: number) =>
    expandedRows.has(`${tab}:${Math.floor(index / gridCols)}`);
  const [flexOpen, setFlexOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState<Set<string>>(
    new Set(["P", "Q", "N", "T"])
  );

  // Defer heavy inputs so UI stays responsive during recomputation
  const deferredSettings = useDeferredValue(settings);
  const deferredBuildGroups = useDeferredValue(buildGroups);
  const isStale =
    deferredSettings !== settings || deferredBuildGroups !== buildGroups;

  const toggleTier = (tier: string) => {
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        if (next.size > 1) next.delete(tier); // keep at least one
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  const { decisions, flexPatterns } = useMemo(() => {
    if (!accountData)
      return {
        decisions: [] as TriageDecision[],
        flexPatterns: [] as FlexPattern[],
      };
    return runTriage(accountData, deferredBuildGroups, deferredSettings);
  }, [accountData, deferredBuildGroups, deferredSettings]);

  const tierRankMap: Record<string, number> = { P: 0, Q: 1, N: 2, T: 3 };
  const slotOrder: Record<string, number> = {
    flower: 0,
    plume: 1,
    sands: 2,
    goblet: 3,
    circlet: 4,
  };
  const hasSP = useCallback(
    (d: TriageDecision) =>
      d.specialRules.includes("SP3") || d.specialRules.includes("SP4"),
    []
  );
  const passesTier = useCallback(
    (d: TriageDecision) => tierFilter.has(d.decidingResult?.tier ?? "T"),
    [tierFilter]
  );
  const sortDecisions = useCallback(
    (arr: TriageDecision[]) =>
      arr.sort((a, b) => {
        const aa = a.artifact;
        const bb = b.artifact;
        return (
          aa.setKey.localeCompare(bb.setKey) ||
          (slotOrder[aa.slotKey] ?? 9) - (slotOrder[bb.slotKey] ?? 9) ||
          aa.mainStatKey.localeCompare(bb.mainStatKey) ||
          (tierRankMap[a.decidingResult?.tier ?? "T"] ?? 3) -
            (tierRankMap[b.decidingResult?.tier ?? "T"] ?? 3) ||
          bb.level - aa.level
        );
      }),
    []
  );

  const recommendLock = useMemo(
    () =>
      sortDecisions(
        decisions.filter(
          (d) =>
            d.label === "lock" && !d.artifact.lock && !hasSP(d) && passesTier(d)
        )
      ),
    [decisions, hasSP, passesTier, sortDecisions]
  );

  const noAction = useMemo(
    () => sortDecisions(decisions.filter((d) => hasSP(d) && passesTier(d))),
    [decisions, hasSP, passesTier, sortDecisions]
  );

  const recommendUnlock = useMemo(
    () =>
      sortDecisions(
        decisions.filter(
          (d) =>
            d.label === "unlock" &&
            d.artifact.lock &&
            !hasSP(d) &&
            passesTier(d)
        )
      ),
    [decisions, hasSP, passesTier, sortDecisions]
  );

  // "No change" = everything not in the other 3 tabs
  const noChange = useMemo(() => {
    const otherIds = new Set([
      ...recommendLock.map((d) => d.artifact.id),
      ...recommendUnlock.map((d) => d.artifact.id),
      ...noAction.map((d) => d.artifact.id),
    ]);
    return sortDecisions(
      decisions.filter((d) => !otherIds.has(d.artifact.id) && passesTier(d))
    );
  }, [
    decisions,
    recommendLock,
    recommendUnlock,
    noAction,
    passesTier,
    sortDecisions,
  ]);

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
  const tierCounts = { P: 0, Q: 0, N: 0, T: 0 };
  for (const d of decisions) {
    const tier = d.decidingResult?.tier ?? "T";
    tierCounts[tier as keyof typeof tierCounts]++;
  }

  return (
    <ScrollLayout className="px-4 py-4 pb-20 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold">{t.ui("triage.title")}</h2>
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
          {/* Flex pattern dialog trigger */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setFlexOpen(true)}
          >
            <Puzzle className="w-4 h-4" />
            {t.ui("triage.flexPatterns")}
            {flexPatterns.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-0.5">
                {flexPatterns.length}
              </Badge>
            )}
          </Button>
        </div>
        <p className="text-sm">
          {t.ui("triage.subtitle").replace("{0}", totalArtifacts.toString())}
        </p>
        <div className="flex items-center gap-1.5">
          {(["P", "Q", "N", "T"] as const).map((tier) => (
            <FilterChip
              key={tier}
              active={tierFilter.has(tier)}
              onClick={() => toggleTier(tier)}
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  tier === "P"
                    ? "text-amber-300"
                    : tier === "Q"
                      ? "text-purple-300"
                      : tier === "N"
                        ? "text-blue-300"
                        : "text-zinc-400"
                )}
              >
                {tierCounts[tier]}
              </span>
              <span className="text-sm">{t.ui(TIER_KEY[tier])}</span>
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Flex Pattern Dialog */}
      <FlexPatternDialog
        open={flexOpen}
        onOpenChange={setFlexOpen}
        flexPatterns={flexPatterns}
        settings={settings}
        onSettingsChange={setSettings}
        t={t}
      />

      {/* Tabs */}
      <Tabs
        defaultValue="lock"
        className={cn(
          isStale && "opacity-60 pointer-events-none transition-opacity"
        )}
      >
        {(() => {
          const tabs = [
            {
              value: "lock",
              labelKey: "triage.recommendLock",
              descKey: "triage.recommendLockDesc",
              icon: Lock,
              color: "green",
              items: recommendLock,
              isProtected: false,
            },
            {
              value: "unlock",
              labelKey: "triage.recommendUnlock",
              descKey: "triage.recommendUnlockDesc",
              icon: LockOpen,
              color: "red",
              items: recommendUnlock,
              isProtected: false,
            },
            {
              value: "protected",
              labelKey: "triage.noActionNeeded",
              descKey: "triage.noActionDesc",
              icon: ShieldAlert,
              color: "amber",
              items: noAction,
              isProtected: true,
            },
            {
              value: "nochange",
              labelKey: "triage.noChange",
              descKey: "triage.noChangeDesc",
              icon: CheckCircle2,
              color: "slate",
              items: noChange,
              isProtected: false,
            },
          ] as const;
          const colorClass = {
            green:
              "data-[state=active]:bg-green-500/15 data-[state=active]:text-green-400 data-[state=active]:border-green-500/30",
            red: "data-[state=active]:bg-red-500/15 data-[state=active]:text-red-400 data-[state=active]:border-red-500/30",
            amber:
              "data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/30",
            slate:
              "data-[state=active]:bg-slate-500/15 data-[state=active]:text-slate-300 data-[state=active]:border-slate-500/30",
          };
          return (
            <>
              <TabsList className="w-full bg-transparent border border-border p-1 h-auto gap-1 grid grid-cols-2 sm:grid-cols-4">
                {tabs.map(
                  ({ value, labelKey, descKey, icon: Icon, color, items }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      title={t.ui(descKey)}
                      className={cn(
                        "gap-1.5 data-[state=active]:border data-[state=active]:shadow-none rounded-md",
                        colorClass[color]
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.ui(labelKey)}
                      <Badge variant="secondary" className="text-xs ml-0.5">
                        {items.length}
                      </Badge>
                    </TabsTrigger>
                  )
                )}
              </TabsList>
              {tabs.map(({ value, items, isProtected }) => (
                <TabsContent key={value} value={value}>
                  {items.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {t.ui("triage.noRecommendations")}
                    </div>
                  ) : (
                    <div
                      ref={gridRef}
                      className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                    >
                      {items.map((d, i) => (
                        <TriageCard
                          key={d.artifact.id}
                          decision={d}
                          t={t}
                          expanded={isRowExpanded(value, i)}
                          onToggle={() => toggleRow(value, i)}
                          isProtected={isProtected}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </>
          );
        })()}
      </Tabs>
    </ScrollLayout>
  );
}
