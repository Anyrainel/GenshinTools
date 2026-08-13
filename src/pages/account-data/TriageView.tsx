import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccountDataNeedsBothState } from "@/components/account-data/AccountDataNeedsBothState";
import { AccountDataSourceAgeBadge } from "@/components/account-data/AccountDataSourceAge";
import {
  type SortDimension,
  TriageHeader,
} from "@/components/account-data/TriageHeader";
import {
  TriageTabContent,
  type TriageTabContentHandle,
} from "@/components/account-data/TriageTabContent";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
import { artifactIdToHalfSetId } from "@/data/gameResources";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { buildTriageInstructions } from "@/lib/account-data/manager/instructions";
import {
  QUALITY_TIER_RANK,
  QUALITY_TIERS,
} from "@/lib/account-data/triage/constants";
import { runTriage } from "@/lib/account-data/triage/triageEngine";
import type {
  FlexPattern,
  QualityTier,
  TriageDecision,
} from "@/lib/account-data/triage/types";
import {
  selectEnabledBuildGroups,
  useBuildsStore,
} from "@/stores/useBuildsStore";
import {
  selectActiveTriageSettings,
  useTriageStore,
} from "@/stores/useTriageStore";

interface TriageViewProps {
  onOpenImport?: () => void;
  onShowTour?: () => void;
}

const SLOT_ORDER: Record<string, number> = {
  flower: 0,
  plume: 1,
  sands: 2,
  goblet: 3,
  circlet: 4,
};

export function TriageView({ onOpenImport, onShowTour }: TriageViewProps) {
  const { t } = useLanguage();
  const activeAccount = useActiveAccount();
  const accountData = activeAccount?.data ?? null;
  const buildGroups = useBuildsStore(selectEnabledBuildGroups);

  const tabContentRef = useRef<TriageTabContentHandle | null>(null);

  const settings = useTriageStore(selectActiveTriageSettings);
  const setSettings = useTriageStore((s) => s.setSettings);

  const [tierFilter, setTierFilter] = useState<Set<QualityTier>>(
    new Set(QUALITY_TIERS)
  );
  const [halfSetFilter, setHalfSetFilter] = useState<Set<string>>(new Set());
  const [slotFilter, setSlotFilter] = useState<Set<Slot>>(new Set());

  const [activeSortDim, setActiveSortDim] = useState<SortDimension>("name");
  const [activeSortDir, setActiveSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = useCallback(
    (dim: SortDimension) => {
      if (activeSortDim === dim) {
        setActiveSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setActiveSortDim(dim);
        setActiveSortDir("desc");
      }
    },
    [activeSortDim]
  );

  const toggleTier = (tier: QualityTier) => {
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        if (next.size > 1) next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  const deferredSettings = useDeferredValue(settings);
  const deferredBuildGroups = useDeferredValue(buildGroups);
  const isStale =
    deferredSettings !== settings || deferredBuildGroups !== buildGroups;

  const { decisions, flexPatterns } = useMemo(() => {
    if (!accountData)
      return {
        decisions: [] as TriageDecision[],
        flexPatterns: [] as FlexPattern[],
      };
    return runTriage(accountData, deferredBuildGroups, deferredSettings);
  }, [accountData, deferredBuildGroups, deferredSettings]);

  const hasSP = useCallback(
    (d: TriageDecision) =>
      d.specialRules.includes("levelProtected") ||
      d.specialRules.includes("equippedProtected"),
    []
  );
  const passesTier = useCallback(
    (d: TriageDecision) => tierFilter.has(d.decidingResult?.tier ?? "fodder"),
    [tierFilter]
  );
  const passesFilters = useCallback(
    (d: TriageDecision) =>
      passesTier(d) &&
      (halfSetFilter.size === 0 ||
        halfSetFilter.has(artifactIdToHalfSetId[d.artifact.setKey] ?? "")) &&
      (slotFilter.size === 0 || slotFilter.has(d.artifact.slotKey)),
    [passesTier, halfSetFilter, slotFilter]
  );
  const sortDecisions = useCallback(
    (arr: TriageDecision[]) => {
      const compareName = (a: TriageDecision, b: TriageDecision) => {
        const aa = a.artifact;
        const bb = b.artifact;
        return (
          aa.setKey.localeCompare(bb.setKey) ||
          (SLOT_ORDER[aa.slotKey] ?? 9) - (SLOT_ORDER[bb.slotKey] ?? 9) ||
          aa.mainStatKey.localeCompare(bb.mainStatKey)
        );
      };
      const compareTier = (a: TriageDecision, b: TriageDecision) =>
        QUALITY_TIER_RANK[a.decidingResult?.tier ?? "fodder"] -
        QUALITY_TIER_RANK[b.decidingResult?.tier ?? "fodder"];
      const compareLevel = (a: TriageDecision, b: TriageDecision) =>
        b.artifact.level - a.artifact.level;

      const cmpMap: Record<
        SortDimension,
        (a: TriageDecision, b: TriageDecision) => number
      > = { name: compareName, tier: compareTier, level: compareLevel };

      const defaultOrder: SortDimension[] = ["name", "tier", "level"];
      const ordered = activeSortDim
        ? [activeSortDim, ...defaultOrder.filter((d) => d !== activeSortDim)]
        : defaultOrder;

      return arr.sort((a, b) => {
        for (const dim of ordered) {
          const raw = cmpMap[dim](a, b);
          if (raw === 0) continue;
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

  const lockArtifacts = useMemo(
    () => recommendLock.map((d) => d.artifact),
    [recommendLock]
  );
  const unlockArtifacts = useMemo(
    () => recommendUnlock.map((d) => d.artifact),
    [recommendUnlock]
  );
  const buildManagerInstructions = useCallback(
    () => buildTriageInstructions(lockArtifacts, unlockArtifacts),
    [lockArtifacts, unlockArtifacts]
  );

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

  const hasAnyBuilds = buildGroups.length > 0;

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
        <TriageHeader
          t={t}
          settings={settings}
          onSettingsChange={setSettings}
          flexPatterns={flexPatterns}
          decisions={decisions}
          tierFilter={tierFilter}
          onToggleTier={toggleTier}
          halfSetFilter={halfSetFilter}
          onHalfSetFilterChange={setHalfSetFilter}
          slotFilter={slotFilter}
          onSlotFilterChange={setSlotFilter}
          activeSortDim={activeSortDim}
          activeSortDir={activeSortDir}
          onToggleSort={toggleSort}
          buildManagerInstructions={buildManagerInstructions}
          tabContentRef={tabContentRef}
          sourceAgeBadge={
            <AccountDataSourceAgeBadge lastUpdate={activeAccount?.lastUpdate} />
          }
        />
      }
    >
      <TriageTabContent
        t={t}
        isStale={isStale}
        recommendLock={recommendLock}
        recommendUnlock={recommendUnlock}
        noAction={noAction}
        noChange={noChange}
        handleRef={tabContentRef}
      />
    </ScrollLayout>
  );
}
