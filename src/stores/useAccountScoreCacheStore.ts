import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountProfileId } from "@/lib/account-data/types";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { PersistedAccountScoreCacheStoreSchema } from "./schemas";

export type AccountScoreMap = Record<string, ArtifactScoreResult | null>;
export type ScoreStaleness = string[] | true;

const EMPTY_SCORES: AccountScoreMap = {};
const EMPTY_STALE: string[] = [];

interface AccountScoreCacheStore {
  scoresByProfileId: Record<AccountProfileId, AccountScoreMap>;
  staleScoreCharIdsByProfileId: Record<AccountProfileId, ScoreStaleness>;

  getScores: (profileId: AccountProfileId | null) => AccountScoreMap;
  getStaleScoreCharIds: (profileId: AccountProfileId | null) => ScoreStaleness;
  setScores: (profileId: AccountProfileId, scores: AccountScoreMap) => void;
  mergeScores: (profileId: AccountProfileId, scores: AccountScoreMap) => void;
  invalidateScores: (profileId?: AccountProfileId, charIds?: string[]) => void;
  renameProfileCache: (
    currentId: AccountProfileId,
    newId: AccountProfileId
  ) => void;
  deleteProfileCache: (profileId: AccountProfileId) => void;
  clearAllScores: () => void;
}

function nextStaleness(
  current: ScoreStaleness | undefined,
  charIds?: string[]
): ScoreStaleness {
  if (!charIds) return true;
  if (current === true) return true;

  const existing = new Set(current ?? []);
  let changed = false;
  for (const id of charIds) {
    if (!existing.has(id)) {
      existing.add(id);
      changed = true;
    }
  }
  return changed ? [...existing] : (current ?? EMPTY_STALE);
}

function clearScoredStaleness(
  current: ScoreStaleness | undefined,
  scores: AccountScoreMap
): ScoreStaleness {
  if (current === true) return EMPTY_STALE;
  if (!current || current.length === 0) return EMPTY_STALE;

  const scored = new Set(Object.keys(scores));
  const remaining = current.filter((id) => !scored.has(id));
  return remaining.length > 0 ? remaining : EMPTY_STALE;
}

export const useAccountScoreCacheStore = create<AccountScoreCacheStore>()(
  persist(
    (set, get) => ({
      scoresByProfileId: {},
      staleScoreCharIdsByProfileId: {},

      getScores: (profileId) =>
        profileId === null
          ? EMPTY_SCORES
          : (get().scoresByProfileId[profileId] ?? EMPTY_SCORES),

      getStaleScoreCharIds: (profileId) =>
        profileId === null
          ? EMPTY_STALE
          : (get().staleScoreCharIdsByProfileId[profileId] ?? EMPTY_STALE),

      setScores: (profileId, scores) =>
        set((state) => ({
          scoresByProfileId: {
            ...state.scoresByProfileId,
            [profileId]: scores,
          },
          staleScoreCharIdsByProfileId: {
            ...state.staleScoreCharIdsByProfileId,
            [profileId]: EMPTY_STALE,
          },
        })),

      mergeScores: (profileId, scores) =>
        set((state) => ({
          scoresByProfileId: {
            ...state.scoresByProfileId,
            [profileId]: {
              ...(state.scoresByProfileId[profileId] ?? EMPTY_SCORES),
              ...scores,
            },
          },
          staleScoreCharIdsByProfileId: {
            ...state.staleScoreCharIdsByProfileId,
            [profileId]: clearScoredStaleness(
              state.staleScoreCharIdsByProfileId[profileId],
              scores
            ),
          },
        })),

      invalidateScores: (profileId, charIds) =>
        set((state) => {
          const next = { ...state.staleScoreCharIdsByProfileId };
          const profileIds =
            profileId === undefined
              ? new Set([
                  ...Object.keys(state.scoresByProfileId).map(Number),
                  ...Object.keys(state.staleScoreCharIdsByProfileId).map(
                    Number
                  ),
                ])
              : new Set([profileId]);

          for (const id of profileIds) {
            next[id] = nextStaleness(next[id], charIds);
          }
          return { staleScoreCharIdsByProfileId: next };
        }),

      renameProfileCache: (currentId, newId) =>
        set((state) => {
          if (currentId === newId) return state;
          const scoresByProfileId = { ...state.scoresByProfileId };
          const staleScoreCharIdsByProfileId = {
            ...state.staleScoreCharIdsByProfileId,
          };

          if (scoresByProfileId[currentId]) {
            scoresByProfileId[newId] = scoresByProfileId[currentId];
            delete scoresByProfileId[currentId];
          }
          if (staleScoreCharIdsByProfileId[currentId]) {
            staleScoreCharIdsByProfileId[newId] =
              staleScoreCharIdsByProfileId[currentId];
            delete staleScoreCharIdsByProfileId[currentId];
          }

          return { scoresByProfileId, staleScoreCharIdsByProfileId };
        }),

      deleteProfileCache: (profileId) =>
        set((state) => {
          const scoresByProfileId = { ...state.scoresByProfileId };
          const staleScoreCharIdsByProfileId = {
            ...state.staleScoreCharIdsByProfileId,
          };
          delete scoresByProfileId[profileId];
          delete staleScoreCharIdsByProfileId[profileId];
          return { scoresByProfileId, staleScoreCharIdsByProfileId };
        }),

      clearAllScores: () =>
        set({ scoresByProfileId: {}, staleScoreCharIdsByProfileId: {} }),
    }),
    {
      name: "account-score-cache-storage",
      version: 1,
      partialize: (state) => ({
        scoresByProfileId: state.scoresByProfileId,
        staleScoreCharIdsByProfileId: state.staleScoreCharIdsByProfileId,
      }),
      merge: (persistedState, currentState) => {
        const parsed =
          PersistedAccountScoreCacheStoreSchema.safeParse(persistedState);
        const persisted = parsed.success
          ? (parsed.data as Partial<AccountScoreCacheStore>)
          : {};
        return parsed.success
          ? { ...currentState, ...persisted }
          : currentState;
      },
    }
  )
);

export function invalidateScores(charIds?: string[]): void {
  useAccountScoreCacheStore.getState().invalidateScores(undefined, charIds);
}
