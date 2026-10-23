import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnalyzerResult } from "@/domain/combat/analyzer/types";
import type {
  ChoiceResultCache,
  WeaponChoiceResult,
} from "@/domain/team/types";
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
  investmentResult?: SerializedAnalyzerResult | null;
  investmentInputKey?: string;
  weaponChoiceResult?: WeaponChoiceResult | null;
  weaponChoiceInputKey?: string;
  artifactChoiceResult?: WeaponChoiceResult | null;
  artifactChoiceInputKey?: string;
}

interface TeamResultCacheState {
  resultsByTeamId: Record<string, TeamResultCacheEntry>;
  getForTeam: (teamId: string) => TeamResultCacheEntry | undefined;
  getInvestmentResult: (
    teamId: string,
    inputKey?: string
  ) => AnalyzerResult | undefined;
  setInvestmentResult: (
    teamId: string,
    result: AnalyzerResult | null,
    inputKey?: string
  ) => void;
  setChoiceResult: (
    teamId: string,
    mode: "weapon" | "artifact",
    result: WeaponChoiceResult | null,
    inputKey?: string
  ) => void;
  clearChoiceResults: (teamId: string) => void;
  clearForTeam: (teamId: string) => void;
  clearAll: () => void;
}

function isEmptyEntry(entry: TeamResultCacheEntry): boolean {
  return (
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
    ...(typeof raw.investmentInputKey === "string"
      ? { investmentInputKey: raw.investmentInputKey }
      : {}),
    ...(typeof raw.weaponChoiceInputKey === "string"
      ? { weaponChoiceInputKey: raw.weaponChoiceInputKey }
      : {}),
    ...(typeof raw.artifactChoiceInputKey === "string"
      ? { artifactChoiceInputKey: raw.artifactChoiceInputKey }
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
  result: AnalyzerResult | null,
  inputKey?: string
): TeamResultCacheEntry {
  return {
    ...(entry ?? {}),
    investmentResult: result ? serializeAnalyzerResult(result) : null,
    investmentInputKey: result ? inputKey : undefined,
  };
}

function setChoiceResultOnEntry(
  entry: TeamResultCacheEntry | undefined,
  mode: "weapon" | "artifact",
  result: WeaponChoiceResult | null,
  inputKey?: string
): TeamResultCacheEntry {
  return {
    ...(entry ?? {}),
    [mode === "weapon" ? "weaponChoiceResult" : "artifactChoiceResult"]: result,
    [mode === "weapon" ? "weaponChoiceInputKey" : "artifactChoiceInputKey"]:
      result ? inputKey : undefined,
  };
}

function clearChoiceResultsFromEntry(
  entry: TeamResultCacheEntry | undefined
): TeamResultCacheEntry {
  const {
    weaponChoiceResult: _weaponChoiceResult,
    artifactChoiceResult: _artifactChoiceResult,
    weaponChoiceInputKey: _weaponChoiceInputKey,
    artifactChoiceInputKey: _artifactChoiceInputKey,
    ...rest
  } = entry ?? {};
  return rest;
}

export const useTeamResultCacheStore = create<TeamResultCacheState>()(
  persist(
    (set, get) => ({
      resultsByTeamId: {},

      getForTeam: (teamId) => get().resultsByTeamId[teamId],

      getInvestmentResult: (teamId, inputKey) => {
        const entry = get().resultsByTeamId[teamId];
        if (inputKey !== undefined && entry?.investmentInputKey !== inputKey)
          return undefined;
        const result = entry?.investmentResult;
        return result ? deserializeAnalyzerResult(result) : undefined;
      },

      setInvestmentResult: (teamId, result, inputKey) =>
        set((state) => ({
          resultsByTeamId: writeEntry(
            state.resultsByTeamId,
            teamId,
            setInvestmentResultOnEntry(
              state.resultsByTeamId[teamId],
              result,
              inputKey
            )
          ),
        })),

      setChoiceResult: (teamId, mode, result, inputKey) =>
        set((state) => ({
          resultsByTeamId: writeEntry(
            state.resultsByTeamId,
            teamId,
            setChoiceResultOnEntry(
              state.resultsByTeamId[teamId],
              mode,
              result,
              inputKey
            )
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
      version: 9,
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
