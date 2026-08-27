import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnalyzerResult } from "@/lib/team-comp/analyzer/types";
import type {
  ChoiceResultCache,
  OptimizationResult,
  WeaponChoiceResult,
} from "@/lib/team-comp/types";
import { migrateTeamResultCacheStore } from "./migration/teamResultCache";
import { PersistedTeamResultCacheStoreSchema } from "./schemas";

type SerializedAnalyzerResult = Omit<
  AnalyzerResult,
  "bestAtTier" | "nodesByJin"
> & {
  bestAtTier: [
    number,
    AnalyzerResult["bestAtTier"] extends Map<number, infer V> ? V : never,
  ][];
  nodesByJin: [
    number,
    AnalyzerResult["nodesByJin"] extends Map<number, infer V> ? V : never,
  ][];
};

export interface TeamResultCacheEntry {
  optimizationResult?: OptimizationResult | null;
  investmentResult?: SerializedAnalyzerResult | null;
  weaponChoiceResult?: WeaponChoiceResult | null;
  artifactChoiceResult?: WeaponChoiceResult | null;
}

export type TeamResultCachePatch = Partial<TeamResultCacheEntry>;

interface TeamResultCacheState {
  resultsByTeamId: Record<string, TeamResultCacheEntry>;
  getForTeam: (teamId: string) => TeamResultCacheEntry | undefined;
  patchForTeam: (teamId: string, patch: TeamResultCachePatch) => void;
  getInvestmentResult: (teamId: string) => AnalyzerResult | undefined;
  setInvestmentResult: (teamId: string, result: AnalyzerResult | null) => void;
  setChoiceResult: (
    teamId: string,
    mode: "weapon" | "artifact",
    result: WeaponChoiceResult | null
  ) => void;
  clearChoiceResults: (teamId: string) => void;
  clearForTeam: (teamId: string) => void;
  clearAll: () => void;
}

function isEmptyEntry(entry: TeamResultCacheEntry): boolean {
  return (
    entry.optimizationResult === undefined &&
    entry.investmentResult === undefined &&
    entry.weaponChoiceResult === undefined &&
    entry.artifactChoiceResult === undefined
  );
}

function writeEntry(
  resultsByTeamId: Record<string, TeamResultCacheEntry>,
  teamId: string,
  entry: TeamResultCacheEntry
): Record<string, TeamResultCacheEntry> {
  const next = { ...resultsByTeamId };
  if (isEmptyEntry(entry)) delete next[teamId];
  else next[teamId] = entry;
  return next;
}

function serializeAnalyzerResult(
  result: AnalyzerResult
): SerializedAnalyzerResult {
  return {
    ...result,
    bestAtTier: [...result.bestAtTier.entries()],
    nodesByJin: [...result.nodesByJin.entries()],
  };
}

function deserializeAnalyzerResult(
  result: SerializedAnalyzerResult
): AnalyzerResult {
  return {
    ...result,
    bestAtTier: new Map(result.bestAtTier),
    nodesByJin: new Map(result.nodesByJin),
  };
}

function normalizeEntry(value: unknown): TeamResultCacheEntry {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  return {
    ...(raw.optimizationResult !== undefined
      ? {
          optimizationResult:
            raw.optimizationResult as OptimizationResult | null,
        }
      : {}),
    ...(raw.investmentResult !== undefined
      ? {
          investmentResult:
            raw.investmentResult as SerializedAnalyzerResult | null,
        }
      : {}),
    ...(raw.weaponChoiceResult !== undefined
      ? {
          weaponChoiceResult:
            raw.weaponChoiceResult as WeaponChoiceResult | null,
        }
      : {}),
    ...(raw.artifactChoiceResult !== undefined
      ? {
          artifactChoiceResult:
            raw.artifactChoiceResult as WeaponChoiceResult | null,
        }
      : {}),
  };
}

function normalizeResultsByTeamId(
  resultsByTeamId: Record<string, unknown>
): Record<string, TeamResultCacheEntry> {
  return Object.fromEntries(
    Object.entries(resultsByTeamId)
      .map(([teamId, entry]) => [teamId, normalizeEntry(entry)] as const)
      .filter(([, entry]) => !isEmptyEntry(entry))
  );
}

export function choiceResultsFromTeamResultCache(
  entry: TeamResultCacheEntry | undefined
): ChoiceResultCache {
  return {
    ...(entry?.weaponChoiceResult !== undefined
      ? { weapon: entry.weaponChoiceResult }
      : {}),
    ...(entry?.artifactChoiceResult !== undefined
      ? { artifact: entry.artifactChoiceResult }
      : {}),
  };
}

function setInvestmentResultOnEntry(
  entry: TeamResultCacheEntry | undefined,
  result: AnalyzerResult | null
): TeamResultCacheEntry {
  return {
    ...(entry ?? {}),
    investmentResult: result ? serializeAnalyzerResult(result) : null,
  };
}

function setChoiceResultOnEntry(
  entry: TeamResultCacheEntry | undefined,
  mode: "weapon" | "artifact",
  result: WeaponChoiceResult | null
): TeamResultCacheEntry {
  return {
    ...(entry ?? {}),
    [mode === "weapon" ? "weaponChoiceResult" : "artifactChoiceResult"]: result,
  };
}

function clearChoiceResultsFromEntry(
  entry: TeamResultCacheEntry | undefined
): TeamResultCacheEntry {
  const {
    weaponChoiceResult: _weaponChoiceResult,
    artifactChoiceResult: _artifactChoiceResult,
    ...rest
  } = entry ?? {};
  return rest;
}

export const useTeamResultCacheStore = create<TeamResultCacheState>()(
  persist(
    (set, get) => ({
      resultsByTeamId: {},

      getForTeam: (teamId) => get().resultsByTeamId[teamId],

      patchForTeam: (teamId, patch) =>
        set((state) => ({
          resultsByTeamId: writeEntry(state.resultsByTeamId, teamId, {
            ...(state.resultsByTeamId[teamId] ?? {}),
            ...patch,
          }),
        })),

      getInvestmentResult: (teamId) => {
        const result = get().resultsByTeamId[teamId]?.investmentResult;
        return result ? deserializeAnalyzerResult(result) : undefined;
      },

      setInvestmentResult: (teamId, result) =>
        set((state) => ({
          resultsByTeamId: writeEntry(
            state.resultsByTeamId,
            teamId,
            setInvestmentResultOnEntry(state.resultsByTeamId[teamId], result)
          ),
        })),

      setChoiceResult: (teamId, mode, result) =>
        set((state) => ({
          resultsByTeamId: writeEntry(
            state.resultsByTeamId,
            teamId,
            setChoiceResultOnEntry(state.resultsByTeamId[teamId], mode, result)
          ),
        })),

      clearChoiceResults: (teamId) =>
        set((state) => ({
          resultsByTeamId: writeEntry(
            state.resultsByTeamId,
            teamId,
            clearChoiceResultsFromEntry(state.resultsByTeamId[teamId])
          ),
        })),

      clearForTeam: (teamId) =>
        set((state) => {
          const next = { ...state.resultsByTeamId };
          delete next[teamId];
          return { resultsByTeamId: next };
        }),

      clearAll: () => set({ resultsByTeamId: {} }),
    }),
    {
      name: "team-result-cache",
      version: 2,
      migrate: migrateTeamResultCacheStore,
      partialize: (state) => ({ resultsByTeamId: state.resultsByTeamId }),
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedTeamResultCacheStoreSchema.safeParse(persistedState);
        const persisted = parsed.success
          ? parsed.data
          : PersistedTeamResultCacheStoreSchema.parse({});
        return {
          ...currentState,
          resultsByTeamId: normalizeResultsByTeamId(persisted.resultsByTeamId),
        };
      },
    }
  )
);
