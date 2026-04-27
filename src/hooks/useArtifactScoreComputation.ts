import { useEffect, useMemo } from "react";
import type { Build } from "@/data/types";
import {
  useActiveAccountData,
  useActiveAccountScores,
} from "@/hooks/useActiveAccount";
import { useAllValidResolvedBuilds } from "@/hooks/useResolvedBuilds";
import { computeCharWeaponNonArtifactCr } from "@/lib/account-data/crBudget";
import {
  type ArtifactScoreResult,
  scoreWithBuilds,
} from "@/lib/artifact/scoring/artifactScore";
import { areBuildsEqual } from "@/lib/artifact-builds/buildUtils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";

export function useArtifactScoreComputation(): void {
  const accountData = useActiveAccountData();
  const staleScoreCharIds = useAccountStore((s) => s.staleScoreCharIds);
  const mergeScores = useAccountStore((s) => s.mergeScores);
  const scores = useActiveAccountScores();
  const scoreConfig = useArtifactScoreStore((s) => s.config);
  const buildGroups = useAllValidResolvedBuilds();

  const resolvedBuildsMap = useMemo(() => {
    const map: Record<string, Build[]> = {};
    for (const group of buildGroups) {
      const visible = group.builds.filter((b) => b.visible);
      if (visible.length > 0) {
        map[group.characterId] = visible;
      }
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
    if (charsToScore.length === 0) return;
    const timer = setTimeout(() => {
      const results: Record<string, ArtifactScoreResult | null> = {};
      for (const char of charsToScore) {
        const builds = resolvedBuildsMap[char.key] ?? [];
        results[char.key] = scoreWithBuilds(
          char,
          builds,
          scoreConfig.global,
          computeCharWeaponNonArtifactCr(char)
        );
      }
      mergeScores(results);
    }, 50);
    return () => clearTimeout(timer);
  }, [charsToScore, scoreConfig, mergeScores, resolvedBuildsMap]);
}
