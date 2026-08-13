import { useEffect, useMemo } from "react";
import type { Build } from "@/data/types";
import {
  useActiveAccountData,
  useActiveAccountScores,
} from "@/hooks/useActiveAccount";
import { getCrBudget } from "@/lib/account-data/maxCrBuff";
import {
  type ArtifactScoreResult,
  scoreWithBuilds,
} from "@/lib/artifact/scoring/artifactScore";
import { areBuildsEqual } from "@/lib/artifact-builds/buildUtils";
import { useAccountScoreCacheStore } from "@/stores/useAccountScoreCacheStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import {
  selectEnabledBuildGroups,
  useBuildsStore,
} from "@/stores/useBuildsStore";

const EMPTY_STALE_SCORE_CHAR_IDS: string[] = [];

export function useArtifactScoreComputation(): void {
  const accountData = useActiveAccountData();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const staleScoreCharIds = useAccountScoreCacheStore((s) =>
    activeAccountId === null
      ? EMPTY_STALE_SCORE_CHAR_IDS
      : (s.staleScoreCharIdsByProfileId[activeAccountId] ??
        EMPTY_STALE_SCORE_CHAR_IDS)
  );
  const mergeScores = useAccountScoreCacheStore((s) => s.mergeScores);
  const scores = useActiveAccountScores();
  const scoreConfig = useArtifactScoreStore((s) => s.config);
  const buildGroups = useBuildsStore(selectEnabledBuildGroups);

  const resolvedBuildsMap = useMemo(() => {
    const map: Record<string, Build[]> = {};
    for (const group of buildGroups) {
      map[group.characterId] = group.builds;
    }
    return map;
  }, [buildGroups]);

  const resolvedBuildById = useMemo(() => {
    const map = new Map<string, Build>();
    for (const group of buildGroups) {
      for (const build of group.builds) {
        map.set(build.id, build);
      }
    }
    return map;
  }, [buildGroups]);

  const charsToScore = useMemo(() => {
    if (!accountData || accountData.characters.length === 0) return [];
    return accountData.characters.filter((c) => {
      if (
        staleScoreCharIds === true ||
        (staleScoreCharIds.length > 0 && staleScoreCharIds.includes(c.key))
      ) {
        return true;
      }
      if (!(c.key in scores)) return true;
      const score = scores[c.key];
      if (score === null) return (resolvedBuildsMap[c.key]?.length ?? 0) > 0;
      const scoredBuild = score.buildMatch.build;
      const resolvedBuild = resolvedBuildById.get(scoredBuild.id);
      return !resolvedBuild || !areBuildsEqual(scoredBuild, resolvedBuild);
    });
  }, [
    accountData,
    staleScoreCharIds,
    scores,
    resolvedBuildsMap,
    resolvedBuildById,
  ]);

  useEffect(() => {
    if (activeAccountId === null) return;
    if (charsToScore.length === 0) return;
    const timer = setTimeout(() => {
      const results: Record<string, ArtifactScoreResult | null> = {};
      for (const char of charsToScore) {
        const builds = resolvedBuildsMap[char.key] ?? [];
        results[char.key] = scoreWithBuilds(
          char,
          builds,
          scoreConfig.global,
          // Resolver form: the CR budget includes the matched build's
          // artifact-set CR, matching the scoreUp engine's budget.
          (build) =>
            getCrBudget({
              characterId: char.key,
              characterLevel: char.level,
              constellation: char.constellation,
              weaponId: char.weapon?.key,
              weaponRefinement: char.weapon?.refinement,
              artifact: build,
            }).totalNonArtifactCr
        );
      }
      mergeScores(activeAccountId, results);
    }, 50);
    return () => clearTimeout(timer);
  }, [
    activeAccountId,
    charsToScore,
    scoreConfig,
    mergeScores,
    resolvedBuildsMap,
  ]);
}
