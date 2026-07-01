import type {
  ProbProbability,
  RedesignedCharTiming,
  RedesignedInput,
  RedesignedResultItem,
  RedesignedSuperTableCol,
} from "./types";

const WEAPON_PROBS: Record<number, number> = {
  1: 0.1438, // Polearm
  2: 0.2146, // Catalyst/Claymore
  3: 0.2212, // Sword
  4: 0.1589, // Bow
};

export function getExpectedE0(e0: number | ProbProbability[]): number {
  if (typeof e0 === "number") return e0;
  return e0.reduce((acc, curr) => acc + curr.value * curr.prob, 0);
}

export function computeTiming(input: RedesignedInput): RedesignedCharTiming[] {
  if (input.customTiming && input.customTiming.length > 0) {
    return input.customTiming;
  }

  const result: RedesignedCharTiming[] = [];
  const seq = input.actionSequence;
  const T1 = input.axisLengths[0];

  const counts: Record<string, number> = {};
  const tIn: Record<string, number> = {};
  const tOut: Record<string, number> = {};

  for (const name of input.charOrders) {
    counts[name] = 0;
  }

  let t = 0;
  let currentChar: string | null = null;
  let lastCharOnField: string | null = null;

  for (let i = 0; i < seq.length; i++) {
    const char = seq[i];
    if (char >= "1" && char <= "4") {
      const idx = Number(char) - 1;
      if (idx < input.charOrders.length) {
        currentChar = input.charOrders[idx];
        lastCharOnField = currentChar;
      }
    } else if (currentChar) {
      let duration = 0;
      if (char === "Q" || char === "q") duration = input.actionCosts.Q;
      else if (char === "E" || char === "e") duration = input.actionCosts.E;
      else if (char === "A" || char === "a") duration = input.actionCosts.A;

      if (duration > 0) {
        if (tIn[currentChar] === undefined) {
          tIn[currentChar] = t;
        }
        t += duration;
        tOut[currentChar] = t;
        counts[currentChar] += 1;
      }
    }
  }

  for (const name of input.charOrders) {
    const finalIn = tIn[name] !== undefined ? tIn[name] : 0;
    let finalOut = tOut[name] !== undefined ? tOut[name] : 0;
    if (name === lastCharOnField) {
      finalOut = T1;
    }
    result.push({
      name,
      element: input.elements[name] ?? "None",
      actionCount: counts[name],
      tIn: finalIn,
      tOut: finalOut,
    });
  }

  return result;
}

export function computeGroupA(
  input: RedesignedInput,
  timings: RedesignedCharTiming[],
  concreteE0s?: Record<string, number>
): Record<
  string,
  { E: number; Q_same_front: number; Q_same_back: number; Q_diff_back: number }
> {
  const result: Record<
    string,
    {
      E: number;
      Q_same_front: number;
      Q_same_back: number;
      Q_diff_back: number;
    }
  > = {};
  const T1 = input.axisLengths[0];
  const tau = 1.24; // particle flight delay
  const din = 0.18; // input delay
  const lambda = 0.4; // off-field energy decay rate

  for (const char of timings) {
    const name = char.name;
    const cfg = input.particles[name];
    if (!cfg) {
      result[name] = { E: 0, Q_same_front: 0, Q_same_back: 0, Q_diff_back: 0 };
      continue;
    }

    // Force N=1 for instant generation
    const isInstant = cfg.tProd < 0.5;
    const N = isInstant ? 1 : Math.floor(cfg.tProd / cfg.delta) + 1;
    const dinN = din / N;
    const a = char.tIn + tau + dinN;

    let Pe = 0;
    for (let k = 0; k < N; k++) {
      const tk = a + k * cfg.delta;
      let w = 0;
      if (tk <= T1 && tk < char.tOut) {
        w = 1.0;
      } else if (tk <= T1 && tk >= char.tOut) {
        w = 1.0 - lambda;
      }
      Pe += w;
    }

    const e0Val =
      concreteE0s && concreteE0s[name] !== undefined
        ? concreteE0s[name]
        : getExpectedE0(cfg.e0);

    const E = e0Val * Pe;
    result[name] = {
      E,
      Q_same_front: 3.0 * E,
      Q_same_back: 1.8 * E,
      Q_diff_back: 0.6 * E,
    };
  }

  return result;
}

export function computeGroupB(
  input: RedesignedInput
): Record<string, { avg: number; min: number; max: number }> {
  const result: Record<string, { avg: number; min: number; max: number }> = {};

  for (const name of input.charOrders) {
    const cfg = input.recoveries[name];
    if (!cfg || cfg.S <= 0) {
      result[name] = { avg: 0, min: 0, max: 0 };
      continue;
    }

    let sumAvg = 0;
    let sumMin = 0;
    let sumMax = 0;

    for (const tuple of cfg.tuples) {
      const term = (cfg.S - tuple.a - cfg.dIn) / tuple.b;
      const avgTerm = Math.max(0, term);
      sumAvg += tuple.k * tuple.lambda * avgTerm;

      const minTerm = Math.max(0, Math.floor(term));
      sumMin += tuple.k * tuple.lambda * minTerm;

      const maxTerm = Math.max(0, Math.ceil(term));
      sumMax += tuple.k * tuple.lambda * maxTerm;
    }

    const weaponProb = WEAPON_PROBS[cfg.P] ?? 0;
    const avg =
      cfg.n > 0 ? sumAvg / cfg.n + cfg.V * weaponProb : cfg.V * weaponProb;
    const min = cfg.n > 0 ? sumMin / cfg.n : 0;
    const max = cfg.n > 0 ? sumMax / cfg.n + cfg.V : cfg.V;

    result[name] = { avg, min, max };
  }

  return result;
}

export function calculateER(
  input: RedesignedInput,
  timings: RedesignedCharTiming[],
  groupA: Record<
    string,
    {
      E: number;
      Q_same_front: number;
      Q_same_back: number;
      Q_diff_back: number;
    }
  >,
  groupB: Record<string, { avg: number; min: number; max: number }>
): RedesignedResultItem[] {
  const result: RedesignedResultItem[] = [];

  for (const char of timings) {
    const name = char.name;
    const req = input.burstRequirements[name];
    if (!req) continue;

    const element = char.element;

    // Calculate Sigma Q for this character:
    // Sigma Q = target's Q_same_front + sum(other same-element Q_same_back) + sum(other diff-element Q_diff_back)
    let sigmaQ = groupA[name]?.Q_same_front ?? 0;
    for (const other of timings) {
      if (other.name === name) continue;
      const otherQ = groupA[other.name];
      if (!otherQ) continue;
      if (other.element === element) {
        sigmaQ += otherQ.Q_same_back;
      } else {
        sigmaQ += otherQ.Q_diff_back;
      }
    }

    const recB = groupB[name] ?? { avg: 0, min: 0, max: 0 };

    const demandLabels: string[] = [];
    const demands: number[] = [];

    if (req.type === "regular") {
      const D = req.regularCost ?? 60;
      demandLabels.push(`D=${D}`);
      demands.push(D);
    } else {
      if (req.specialFixedCount && req.specialFixedCount > 0) {
        demandLabels.push("D_min");
        demands.push(req.specialFixedCost ?? 0);
      }
      demandLabels.push("D_avg");
      const dAvg =
        (req.specialFixedCount ?? 0) * (req.specialFixedCost ?? 0) +
        (req.specialAdditionalCost ?? 0) / (req.specialInterval ?? 1);
      demands.push(dAvg);

      demandLabels.push("D_peak");
      const dPeak =
        (req.specialFixedCount ?? 0) * (req.specialFixedCost ?? 0) +
        (req.specialAdditionalCost ?? 0);
      demands.push(dPeak);
    }

    const erNeeded: RedesignedResultItem["erNeeded"] = {};

    for (let dIdx = 0; dIdx < demands.length; dIdx++) {
      const label = demandLabels[dIdx];
      const D = demands[dIdx];

      const solve = (B: number) => {
        const num = D - B;
        if (num <= 0) return 0; // Overflow
        if (sigmaQ <= 0) return Number.POSITIVE_INFINITY;
        return num / sigmaQ;
      };

      const erAvg = solve(recB.avg);
      const erMin = solve(recB.max); // maximum recovery yields minimum ER needed
      const erMax = solve(recB.min); // minimum recovery yields maximum ER needed

      const recommended = erAvg === 0 ? 1.0 : Math.ceil(erAvg * 20) / 20; // Round up to nearest 5% (1.0 = 100%)

      erNeeded[label] = {
        avg: erAvg * 100,
        min: erMin * 100,
        max: erMax * 100,
        recommended: recommended * 100,
      };
    }

    // Get particle choices breakdown
    const cfg = input.particles[name];
    const qOptions: RedesignedResultItem["qValues"]["options"] = [];
    if (cfg) {
      if (typeof cfg.e0 === "number") {
        qOptions.push({ val: groupA[name].Q_same_front, prob: 1.0 });
      } else {
        const Pe = groupA[name].E / getExpectedE0(cfg.e0); // backtrack Pe
        for (const prob of cfg.e0) {
          qOptions.push({
            val: 3.0 * prob.value * Pe,
            prob: prob.prob,
          });
        }
      }
    }

    result.push({
      name,
      element,
      burstType: req.type,
      demandLabels,
      demands,
      qValues: {
        expected: groupA[name]?.Q_same_front ?? 0,
        options: qOptions,
      },
      rValues: recB,
      erNeeded,
    });
  }

  return result;
}

export function generateSuperTable(
  input: RedesignedInput,
  timings: RedesignedCharTiming[],
  groupB: Record<string, { avg: number; min: number; max: number }>
): RedesignedSuperTableCol[] {
  // Find which characters have probability distributions
  const probChars: { name: string; options: ProbProbability[] }[] = [];
  for (const name of input.charOrders) {
    const cfg = input.particles[name];
    if (cfg && Array.isArray(cfg.e0)) {
      probChars.push({ name, options: cfg.e0 });
    }
  }

  if (probChars.length === 0) {
    return [];
  }

  // Generate Cartesian product of all options
  const combinations: {
    e0s: Record<string, number>;
    prob: number;
    header: string;
  }[] = [];

  const recurse = (
    idx: number,
    currentE0s: Record<string, number>,
    currentProb: number,
    path: string[]
  ) => {
    if (idx === probChars.length) {
      combinations.push({
        e0s: { ...currentE0s },
        prob: currentProb,
        header: path.join("\n"),
      });
      return;
    }

    const char = probChars[idx];
    for (const opt of char.options) {
      currentE0s[char.name] = opt.value;
      path.push(`${char.name}: ${opt.value} (${(opt.prob * 100).toFixed(0)}%)`);
      recurse(idx + 1, currentE0s, currentProb * opt.prob, path);
      path.pop();
    }
  };

  recurse(0, {}, 1.0, []);

  const cols: RedesignedSuperTableCol[] = [];

  for (const comb of combinations) {
    // Compute Group A for this combination
    const groupA = computeGroupA(input, timings, comb.e0s);
    // Run ER calc
    const items = calculateER(input, timings, groupA, groupB);

    const cells: Record<string, string> = {};
    for (const item of items) {
      // Find default demand label (first one, e.g. D=60 or D_avg)
      const label = item.demandLabels.includes("D_avg")
        ? "D_avg"
        : item.demandLabels[0];
      const er = item.erNeeded[label];
      if (er) {
        if (er.avg === 0) {
          cells[item.name] = "溢出";
        } else {
          cells[item.name] =
            `${er.avg.toFixed(2)}% (${er.min.toFixed(2)}%, ${er.max.toFixed(2)}%)`;
        }
      }
    }

    cols.push({
      header: comb.header,
      prob: comb.prob,
      cells,
    });
  }

  return cols;
}

export function runRedesignedCalculation(input: RedesignedInput): {
  timings: RedesignedCharTiming[];
  groupA: Record<
    string,
    {
      E: number;
      Q_same_front: number;
      Q_same_back: number;
      Q_diff_back: number;
    }
  >;
  groupB: Record<string, { avg: number; min: number; max: number }>;
  erResults: RedesignedResultItem[];
  superTable: RedesignedSuperTableCol[];
} {
  const timings = computeTiming(input);
  const groupB = computeGroupB(input);
  const groupA = computeGroupA(input, timings);
  const erResults = calculateER(input, timings, groupA, groupB);
  const superTable = generateSuperTable(input, timings, groupB);

  return { timings, groupA, groupB, erResults, superTable };
}
