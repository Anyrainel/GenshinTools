import type { Slot } from "@/data/enums";
import { artifactHalfSetsById } from "@/data/gameResources";

export interface ConcreteTwoPieceSetPair {
  halfSet1SetKey: string;
  halfSet2SetKey: string;
}

interface ArtifactSetKey {
  setKey: string;
}

export function enumerateConcreteTwoPieceSetPairs(
  halfSet1: string | undefined,
  halfSet2: string | undefined,
  availableSetKeys?: ReadonlySet<string>
): ConcreteTwoPieceSetPair[] {
  const firstSetKeys = getConcreteSetKeysForHalfSet(halfSet1, availableSetKeys);
  const secondSetKeys = getConcreteSetKeysForHalfSet(
    halfSet2,
    availableSetKeys
  );
  const sameHalfSet = halfSet1 === halfSet2;
  const pairs: ConcreteTwoPieceSetPair[] = [];

  for (let firstIndex = 0; firstIndex < firstSetKeys.length; firstIndex++) {
    const firstSetKey = firstSetKeys[firstIndex];
    const secondStart = sameHalfSet ? firstIndex + 1 : 0;
    for (
      let secondIndex = secondStart;
      secondIndex < secondSetKeys.length;
      secondIndex++
    ) {
      const secondSetKey = secondSetKeys[secondIndex];
      if (firstSetKey === secondSetKey) continue;
      pairs.push({
        halfSet1SetKey: firstSetKey,
        halfSet2SetKey: secondSetKey,
      });
    }
  }

  return pairs;
}

export function findActiveConcreteTwoPieceSetPair(
  artifacts: Partial<Record<Slot, ArtifactSetKey | null | undefined>>,
  halfSet1: string | undefined,
  halfSet2: string | undefined
): ConcreteTwoPieceSetPair | null {
  const countsBySetKey = countArtifactsBySetKey(artifacts);
  for (const pair of enumerateConcreteTwoPieceSetPairs(halfSet1, halfSet2)) {
    const firstCount = countsBySetKey.get(pair.halfSet1SetKey) ?? 0;
    const secondCount = countsBySetKey.get(pair.halfSet2SetKey) ?? 0;
    if (firstCount >= 2 && secondCount >= 2) return pair;
  }
  return null;
}

export function countArtifactsBySetKey(
  artifacts: Partial<Record<Slot, ArtifactSetKey | null | undefined>>
): Map<string, number> {
  const countsBySetKey = new Map<string, number>();
  for (const artifact of Object.values(artifacts)) {
    if (!artifact) continue;
    countsBySetKey.set(
      artifact.setKey,
      (countsBySetKey.get(artifact.setKey) ?? 0) + 1
    );
  }
  return countsBySetKey;
}

function getConcreteSetKeysForHalfSet(
  halfSetId: string | undefined,
  availableSetKeys: ReadonlySet<string> | undefined
): string[] {
  if (!halfSetId) return [];
  const halfSet = artifactHalfSetsById[halfSetId];
  if (!halfSet) return [];
  if (!availableSetKeys) return [...halfSet.setIds];
  return halfSet.setIds.filter((setKey) => availableSetKeys.has(setKey));
}
