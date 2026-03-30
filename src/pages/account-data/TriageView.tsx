import { FlexPatternDialog } from "@/components/account-data/FlexPatternDialog";
import { TriageCard } from "@/components/account-data/TriageCard";
import { TriageHelpDialog } from "@/components/account-data/TriageHelpDialog";
import { FilterChip } from "@/components/archive/FilterChip";
import { ArtifactManagerDialog } from "@/components/artifact-manager/ArtifactManagerDialog";
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
import { allHalfSetIds, artifactIdToHalfSetId } from "@/data/constants";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  type FlexPattern,
  type TriageDecision,
  type TriageSettings,
  runTriage,
} from "@/lib/account-data/triage";
import { buildTriageInstructions } from "@/lib/artifact-manager/instructions";
import { TRIAGE_TIER_COLORS, cn } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useTriageStore } from "@/stores/useTriageStore";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Lock,
  LockOpen,
  Monitor,
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
import { Link } from "react-router-dom";

const TIER_KEY = {
  P: "triage.tier.P",
  Q: "triage.tier.Q",
  N: "triage.tier.N",
  T: "triage.tier.T",
} as const;

const TIER_COLOR = TRIAGE_TIER_COLORS.text;

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

  const [managerOpen, setManagerOpen] = useState(false);

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
  const [halfSetFilter, setHalfSetFilter] = useState<Set<string>>(new Set());
  const toggleHalfSet = (hsId: string) => {
    setHalfSetFilter((prev) => {
      const next = new Set(prev);
      if (next.has(hsId)) next.delete(hsId);
      else next.add(hsId);
      return next;
    });
  };

  type SortDimension = "tier" | "name" | "level";
  const [activeSortDim, setActiveSortDim] = useState<SortDimension>("name");
  const [activeSortDir, setActiveSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = useCallback(
    (dim: SortDimension) => {
      if (activeSortDim === dim) {
        // Same button: toggle direction
        setActiveSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        // Different button: activate with desc (natural/default direction)
        setActiveSortDim(dim);
        setActiveSortDir("desc");
      }
    },
    [activeSortDim]
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

  const buildManagerInstructions = useCallback(
    () => buildTriageInstructions(decisions),
    [decisions]
  );

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
  const passesFilters = useCallback(
    (d: TriageDecision) =>
      passesTier(d) &&
      (halfSetFilter.size === 0 ||
        halfSetFilter.has(artifactIdToHalfSetId[d.artifact.setKey] ?? "")),
    [passesTier, halfSetFilter]
  );
  const sortDecisions = useCallback(
    (arr: TriageDecision[]) => {
      const compareName = (a: TriageDecision, b: TriageDecision) => {
        const aa = a.artifact;
        const bb = b.artifact;
        return (
          aa.setKey.localeCompare(bb.setKey) ||
          (slotOrder[aa.slotKey] ?? 9) - (slotOrder[bb.slotKey] ?? 9) ||
          aa.mainStatKey.localeCompare(bb.mainStatKey)
        );
      };
      const compareTier = (a: TriageDecision, b: TriageDecision) =>
        (tierRankMap[a.decidingResult?.tier ?? "T"] ?? 3) -
        (tierRankMap[b.decidingResult?.tier ?? "T"] ?? 3);
      const compareLevel = (a: TriageDecision, b: TriageDecision) =>
        b.artifact.level - a.artifact.level;

      const cmpMap: Record<
        SortDimension,
        (a: TriageDecision, b: TriageDecision) => number
      > = { name: compareName, tier: compareTier, level: compareLevel };

      // Default order: name → tier → level
      const defaultOrder: SortDimension[] = ["name", "tier", "level"];
      // If user picked a dimension, put it first, then the rest in default order
      const ordered = activeSortDim
        ? [activeSortDim, ...defaultOrder.filter((d) => d !== activeSortDim)]
        : defaultOrder;

      return arr.sort((a, b) => {
        for (const dim of ordered) {
          const raw = cmpMap[dim](a, b);
          if (raw === 0) continue;
          // Invert only the active dimension when desc; others keep default direction
          return dim === activeSortDim && activeSortDir === "asc" ? -raw : raw;
        }
        return 0;
      });
    },
    [activeSortDim, activeSortDir]
  );

  const recommendLock = useMemo(
    () =>
      sortDecisions(
        decisions.filter(
          (d) =>
            d.label === "lock" &&
            !d.artifact.lock &&
            !hasSP(d) &&
            passesFilters(d)
        )
      ),
    [decisions, hasSP, passesFilters, sortDecisions]
  );

  const noAction = useMemo(
    () => sortDecisions(decisions.filter((d) => hasSP(d) && passesFilters(d))),
    [decisions, hasSP, passesFilters, sortDecisions]
  );

  const recommendUnlock = useMemo(
    () =>
      sortDecisions(
        decisions.filter(
          (d) =>
            d.label === "unlock" &&
            d.artifact.lock &&
            !hasSP(d) &&
            passesFilters(d)
        )
      ),
    [decisions, hasSP, passesFilters, sortDecisions]
  );

  // "No change" = everything not in the other 3 tabs
  const noChange = useMemo(() => {
    const otherIds = new Set([
      ...recommendLock.map((d) => d.artifact.id),
      ...recommendUnlock.map((d) => d.artifact.id),
      ...noAction.map((d) => d.artifact.id),
    ]);
    return sortDecisions(
      decisions.filter((d) => !otherIds.has(d.artifact.id) && passesFilters(d))
    );
  }, [
    decisions,
    recommendLock,
    recommendUnlock,
    noAction,
    passesFilters,
    sortDecisions,
  ]);

  if (!accountData || buildGroups.length === 0) {
    return (
      <ScrollLayout>
        <div className="flex flex-col items-center pt-16 md:pt-24 h-full p-4">
          <div className="flex flex-col items-center text-center space-y-6 max-w-lg">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
              <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
                <ShieldAlert className="w-12 h-12 text-primary opacity-80" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {t.ui("triage.noData")}
              </h3>
              <p className="text-muted-foreground text-base max-w-md mx-auto">
                {t.ui("triage.noDataDesc")}
              </p>
            </div>
            <Button asChild size="lg" className="gap-2">
              <Link to="/artifact-filter">
                <ExternalLink className="w-4 h-4" />
                {t.ui("evaluation.goToBuilds")}
              </Link>
            </Button>
          </div>
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
    <ScrollLayout
      header={
        <div className="px-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
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
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5"
              onClick={() => setManagerOpen(true)}
            >
              <Monitor className="h-4 w-4" />
              {t.ui("manager.applyToGame")}
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm">
              {t
                .ui("triage.subtitle")
                .replace("{0}", totalArtifacts.toString())}
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
                  <span
                    className={cn("text-sm font-semibold", TIER_COLOR[tier])}
                  >
                    {tierCounts[tier]}
                  </span>
                  <span className="text-sm">{t.ui(TIER_KEY[tier])}</span>
                </FilterChip>
              ))}
            </div>
            {/* Sort controls */}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <span className="text-sm font-medium text-foreground">
                {t.ui("filters.sort")}
              </span>
              {(
                [
                  ["name", "triage.sortByName"],
                  ["tier", "triage.sortByTier"],
                  ["level", "common.level"],
                ] as const
              ).map(([dim, labelKey]) => {
                const isActive = activeSortDim === dim;
                return (
                  <button
                    key={dim}
                    type="button"
                    onClick={() => toggleSort(dim)}
                    className={cn(
                      "inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-colors border min-w-[4.5rem]",
                      isActive
                        ? "bg-primary/40 text-primary-foreground border-primary/40"
                        : "bg-secondary text-secondary-foreground border-primary/40 hover:bg-secondary/80"
                    )}
                  >
                    {t.ui(labelKey)}
                    {isActive ? (
                      activeSortDir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 opacity-30" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-sm font-medium text-foreground shrink-0">
              {t.ui("triage.filterByHalfSet")}
            </span>
            {allHalfSetIds.map((hsId) => (
              <FilterChip
                key={hsId}
                active={halfSetFilter.size === 0 || halfSetFilter.has(hsId)}
                onClick={() => toggleHalfSet(hsId)}
              >
                {t.halfSetShort(hsId)}
              </FilterChip>
            ))}
          </div>
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
          <ArtifactManagerDialog
            open={managerOpen}
            onOpenChange={setManagerOpen}
            buildInstructions={buildManagerInstructions}
            actionLabel={t.ui("manager.applyToGame")}
          />
        </div>
      }
    >
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
              "data-[state=inactive]:text-foreground/70 data-[state=active]:bg-green-500/30 data-[state=active]:text-green-400 data-[state=active]:border-green-500/30",
            red: "data-[state=inactive]:text-foreground/70 data-[state=active]:bg-red-500/30 data-[state=active]:text-red-400 data-[state=active]:border-red-500/30",
            amber:
              "data-[state=inactive]:text-foreground/70 data-[state=active]:bg-amber-500/30 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/30",
            slate:
              "data-[state=inactive]:text-foreground/70 data-[state=active]:bg-sky-500/30 data-[state=active]:text-sky-400 data-[state=active]:border-sky-500/30",
          };
          return (
            <>
              <TabsList className="w-full bg-card/80 backdrop-blur-md h-auto gap-1 grid grid-cols-2 sm:grid-cols-4 sticky top-0 z-20">
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
