import { SetConfig, SlotConfig, SubStat, MainStat, MainStatPlus, MainStatSlot } from '../data/types';
import { statPoolWithWeights, elementalMainStats } from '../data/constants';

type SlotKind = 'flowerPlume' | 'sands' | 'goblet' | 'circlet';

const SUBSTAT_DRAW_COUNT = 4;

const MAIN_STAT_POOLS: Record<MainStatSlot, Record<MainStat, number>> = {
  sands: statPoolWithWeights.sands as Record<MainStat, number>,
  goblet: statPoolWithWeights.goblet as Record<MainStat, number>,
  circlet: statPoolWithWeights.circlet as Record<MainStat, number>
};

const SUBSTAT_POOL = statPoolWithWeights.substat as Record<SubStat, number>;

export interface SlotChanceResult {
  flowerPlume: number;
  sands: number;
  goblet: number;
  circlet: number;
}

export function computeSlotChances(config: SetConfig): SlotChanceResult {
  return {
    flowerPlume: computeSlotChance('flowerPlume', config.flowerPlume),
    sands: computeSlotChance('sands', config.sands),
    goblet: computeSlotChance('goblet', config.goblet),
    circlet: computeSlotChance('circlet', config.circlet)
  };
}

export function computeSlotChance(slot: SlotKind, slotConfig: SlotConfig): number {
  if (slotConfig.minStatCount <= 0 && slotConfig.mustPresent.length === 0) {
    return 1;
  }

  if (slot === 'flowerPlume') {
    return (computeSubstatSuccessProbability('hp', slotConfig) + computeSubstatSuccessProbability('atk', slotConfig)) / 2;
  }

  const mainStatPool = MAIN_STAT_POOLS[slot];
  const totalWeight = Object.values(mainStatPool).reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const choices = resolveMainStatChoices(slotConfig.mainStats, slot, mainStatPool);
  const effectiveChoices = choices.length > 0 ? choices : Object.keys(mainStatPool).map(stat => ({
    stat: stat as MainStatPlus,
    weight: mainStatPool[stat as MainStat] ?? 0
  }));

  let probability = 0;

  for (const choice of effectiveChoices) {
    if (choice.weight <= 0) continue;
    const mainProb = choice.weight / totalWeight;
    probability += mainProb * computeSubstatSuccessProbability(choice.stat as MainStatPlus, slotConfig);
  }

  return probability;
}

function computeSubstatSuccessProbability(mainStat: MainStatPlus, slotConfig: SlotConfig): number {
  const pool = Object.entries(SUBSTAT_POOL)
    .filter(([stat]) => stat !== mainStat)
    .map(([stat, weight]) => ({ stat: stat as SubStat, weight }));

  if (pool.length < SUBSTAT_DRAW_COUNT) {
    return 0;
  }

  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const mainStatCovers = (stat: SubStat) => stat === mainStat;
  const effectiveMust = Array.from(new Set(slotConfig.mustPresent))
    .filter(stat => !mainStatCovers(stat));

  if (effectiveMust.length > SUBSTAT_DRAW_COUNT) {
    return 0;
  }

  const poolIndexByStat = new Map<SubStat, number>();
  pool.forEach((entry, index) => {
    poolIndexByStat.set(entry.stat, index);
  });

  for (const stat of effectiveMust) {
    if (!poolIndexByStat.has(stat)) {
      return 0;
    }
  }

  const weights = pool.map(entry => entry.weight);
  const memo = new Map<number, number>();
  memo.set(0, 1);

  const combinationIterator = createCombinationIterator(pool.length, SUBSTAT_DRAW_COUNT);

  let probability = 0;

  combinationIterator(indices => {
    const combination = indices.map(index => pool[index].stat);
    if (!effectiveMust.every(stat => combination.includes(stat))) {
      return;
    }
    if (!checkSlotMatch(combination, mainStat, slotConfig)) {
      return;
    }
    const mask = indices.reduce((acc, index) => acc | (1 << index), 0);
    probability += subsetProbability(mask, weights, totalWeight, memo);
  });

  return probability;
}

function checkSlotMatch(selectedSubstats: SubStat[], mainStat: MainStatPlus, slotConfig: SlotConfig): boolean {
  const available = new Set<SubStat>(selectedSubstats);
  if (SUBSTAT_POOL[mainStat as SubStat] !== undefined) {
    available.add(mainStat as SubStat);
  }

  for (const must of slotConfig.mustPresent) {
    if (!available.has(must)) {
      return false;
    }
  }

  let matchCount = 0;
  for (const stat of slotConfig.substats) {
    if (available.has(stat)) {
      matchCount++;
    }
  }

  return matchCount >= slotConfig.minStatCount;
}

type CombinationIterator = (callback: (indices: number[]) => void) => void;

function createCombinationIterator(n: number, k: number): CombinationIterator {
  return (callback: (indices: number[]) => void) => {
    const indices: number[] = [];

    const backtrack = (start: number, depth: number) => {
      if (depth === k) {
        callback([...indices]);
        return;
      }

      for (let i = start; i <= n - (k - depth); i++) {
        indices[depth] = i;
        backtrack(i + 1, depth + 1);
      }
    };

    if (k <= n && k > 0) {
      backtrack(0, 0);
    }
  };
}

function subsetProbability(
  mask: number,
  weights: number[],
  totalWeight: number,
  memo: Map<number, number>
): number {
  if (memo.has(mask)) {
    return memo.get(mask)!;
  }

  let subsetWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    if (mask & (1 << i)) {
      subsetWeight += weights[i];
    }
  }

  let value = 0;

  for (let i = 0; i < weights.length; i++) {
    if (!(mask & (1 << i))) continue;
    const weight = weights[i];
    const maskWithout = mask & ~(1 << i);
    const sumWithout = subsetWeight - weight;
    const denominator = totalWeight - sumWithout;
    if (denominator <= 0) continue;
    value += (weight / denominator) * subsetProbability(maskWithout, weights, totalWeight, memo);
  }

  memo.set(mask, value);
  return value;
}

interface MainStatChoice {
  stat: MainStatPlus;
  weight: number;
}

function resolveMainStatChoices(
  mainStats: MainStatPlus[],
  slot: Exclude<SlotKind, 'flower' | 'plume'>,
  pool: Record<MainStat, number>
): MainStatChoice[] {
  const choices: MainStatChoice[] = [];
  const seen = new Set<MainStatPlus>();

  const includeStat = (stat: MainStatPlus) => {
    if (seen.has(stat)) return;
    seen.add(stat);

    if (stat === 'elemental%') {
      const weightSum = elementalMainStats.reduce((sum, elemStat) => sum + (pool[elemStat] ?? 0), 0);
      if (weightSum > 0) {
        choices.push({ stat, weight: weightSum });
      }
    } else {
      const weight = pool[stat as MainStat] ?? 0;
      if (weight > 0) {
        choices.push({ stat, weight });
      }
    }
  };

  if (mainStats.length === 0) {
    Object.keys(pool).forEach(stat => includeStat(stat as MainStat));
    return choices;
  }

  mainStats.forEach(includeStat);
  return choices;
}
