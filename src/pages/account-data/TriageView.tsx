import {
  type SortDimension,
  TriageHeader,
} from "@/components/account-data/TriageHeader";
import { TriageTabContent } from "@/components/account-data/TriageTabContent";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactIdToHalfSetId } from "@/data/constants";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  type FlexPattern,
  type TriageDecision,
  type TriageSettings,
  runTriage,
} from "@/lib/account-data/triage";
import { buildTriageInstructions } from "@/lib/artifact-manager/instructions";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useTriageStore } from "@/stores/useTriageStore";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export function TriageView() {
  const { t } = useLanguage();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data ?? null;
  const buildGroups = useAllResolvedBuilds();

  const settings = useTriageStore((s) => s.settings);
  const setSettings = useTriageStore((s) => s.setSettings);

  const [tierFilter, setTierFilter] = useState<Set<string>>(
    new Set(["P", "Q", "N", "T"])
  );
  const [halfSetFilter, setHalfSetFilter] = useState<Set<string>>(new Set());

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

  const toggleTier = (tier: string) => {
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

  const toggleHalfSet = (hsId: string) => {
    setHalfSetFilter((prev) => {
      const next = new Set(prev);
      if (next.has(hsId)) next.delete(hsId);
      else next.add(hsId);
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
          onToggleHalfSet={toggleHalfSet}
          activeSortDim={activeSortDim}
          activeSortDir={activeSortDir}
          onToggleSort={toggleSort}
          buildManagerInstructions={buildManagerInstructions}
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
      />
    </ScrollLayout>
  );
}
