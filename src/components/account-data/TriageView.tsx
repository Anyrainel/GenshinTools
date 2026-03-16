import { FlexPatternDialog } from "@/components/account-data/FlexPatternDialog";
import { TriageCard } from "@/components/account-data/TriageCard";
import { TriageHelpDialog } from "@/components/account-data/TriageHelpDialog";
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
  CircleHelp,
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

const TIER_COLOR: Record<string, string> = {
  P: "text-amber-300",
  Q: "text-purple-300",
  N: "text-blue-300",
  T: "text-zinc-400",
};

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

  const SliderRow = ({
    labelKey,
    settingsKey,
    min,
    max,
    step,
    prefix = "",
  }: {
    labelKey: string;
    settingsKey: keyof TriageSettings;
    min: number;
    max: number;
    step: number;
    prefix?: string;
  }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{t.ui(labelKey)}</Label>
        <span className="text-sm font-mono">
          {prefix}
          {settings[settingsKey] as number}
        </span>
      </div>
      <Slider
        value={[settings[settingsKey] as number]}
        onValueChange={([v]) => update(settingsKey, v as never)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );

  const SwitchRow = ({
    id,
    labelKey,
    settingsKey,
  }: {
    id: string;
    labelKey: string;
    settingsKey: keyof TriageSettings;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm cursor-pointer" htmlFor={id}>
        {t.ui(labelKey)}
      </Label>
      <Switch
        id={id}
        checked={settings[settingsKey] as boolean}
        onCheckedChange={(v) => update(settingsKey, v as never)}
      />
    </div>
  );

  const SectionHeading = ({ labelKey }: { labelKey: string }) => (
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {t.ui(labelKey)}
    </h4>
  );

  return (
    <div className="space-y-4 w-72">
      <div className="space-y-3">
        <SectionHeading labelKey="triage.settingsProtection" />
        <SliderRow
          labelKey="triage.levelProtection"
          settingsKey="levelProtection"
          min={4}
          max={20}
          step={4}
          prefix="+"
        />
        <SwitchRow
          id="equippedProtection"
          labelKey="triage.equippedProtect"
          settingsKey="equippedProtection"
        />
      </div>
      <div className="border-t border-border pt-3 space-y-3">
        <SectionHeading labelKey="triage.settingsThreshold" />
        <SliderRow
          labelKey="triage.mainStatThreshold"
          settingsKey="mainStatThreshold"
          min={50}
          max={100}
          step={5}
        />
        <SliderRow
          labelKey="triage.optionalSubThreshold"
          settingsKey="optionalSubThreshold"
          min={10}
          max={80}
          step={5}
        />
        <SwitchRow
          id="ownedOnly"
          labelKey="triage.ownedOnly"
          settingsKey="ownedOnly"
        />
      </div>
      <div className="border-t border-border pt-3 space-y-3">
        <SectionHeading labelKey="triage.settingsKeepRules" />
        <SliderRow
          labelKey="triage.setSlotKeep"
          settingsKey="setSlotKeep"
          min={1}
          max={5}
          step={1}
        />
        <SliderRow
          labelKey="triage.neutralKeep"
          settingsKey="neutralKeep"
          min={1}
          max={5}
          step={1}
        />
        <SliderRow
          labelKey="triage.qualityMargin"
          settingsKey="qualityMargin"
          min={1}
          max={5}
          step={1}
        />
      </div>
    </div>
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
  const [helpOpen, setHelpOpen] = useState(false);
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
        <div className="flex items-center gap-2">
          <p className="text-sm">
            {t.ui("triage.subtitle").replace("{0}", totalArtifacts.toString())}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="ml-1.5 inline-flex align-text-bottom text-amber-400 hover:text-amber-300 transition-colors"
            >
              <CircleHelp className="size-4" />
            </button>
          </p>
          <div className="flex items-center gap-1.5 ml-2">
            {(["P", "Q", "N", "T"] as const).map((tier) => (
              <FilterChip
                key={tier}
                active={tierFilter.has(tier)}
                onClick={() => toggleTier(tier)}
              >
                <span className={cn("text-sm font-semibold", TIER_COLOR[tier])}>
                  {tierCounts[tier]}
                </span>
                <span className="text-sm">{t.ui(TIER_KEY[tier])}</span>
              </FilterChip>
            ))}
          </div>
        </div>
        <p className="text-sm italic text-right -mt-1 bg-gradient-to-r from-amber-400 to-pink-400 bg-clip-text text-transparent">
          {t.ui("triage.autoLockWip")}
        </p>
        {/* Dialogs (portaled, no layout impact) */}
        <TriageHelpDialog open={helpOpen} onOpenChange={setHelpOpen} t={t} />
        <FlexPatternDialog
          open={flexOpen}
          onOpenChange={setFlexOpen}
          flexPatterns={flexPatterns}
          settings={settings}
          onSettingsChange={setSettings}
          t={t}
        />
      </div>

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
