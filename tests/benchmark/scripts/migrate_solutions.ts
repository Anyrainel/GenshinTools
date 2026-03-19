#!/usr/bin/env tsx
/**
 * One-time migration: remap old team IDs in solutions.json to new preset IDs.
 * Matches teams by sorted character list + formulaId.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

interface Solution {
  artifactAssignment: Record<string, Record<string, string>>;
  recordedDamage: number;
  foundAt: string;
  algorithm: string;
}

interface Problem {
  teamId: string;
  teamName: string;
  characters: string[];
  carryCharId: string;
  formulaId: string;
  solutions: Solution[];
}

interface SolutionStore {
  accountFrozenAt: string;
  sourceAccountFile: string;
  problems: Record<string, Problem>;
}

interface CachedProblem {
  key: string;
  teamId: string;
  teamName: string;
  characters: string[];
  carryCharId: string;
  formulaId: string;
}

interface ProblemCache {
  refreshedAt: string;
  problems: CachedProblem[];
}

const SOLUTIONS_PATH = resolve("tests/benchmark/data/solutions.json");
const PROBLEMS_PATH = resolve("tests/benchmark/data/problems.json");

const solutions: SolutionStore = JSON.parse(readFileSync(SOLUTIONS_PATH, "utf-8"));
const problemCache: ProblemCache = JSON.parse(readFileSync(PROBLEMS_PATH, "utf-8"));

// Build lookup: sorted chars + formulaId → new cached problem
const newByChars = new Map<string, CachedProblem[]>();
for (const p of problemCache.problems) {
  const sortedChars = [...p.characters].sort().join(",");
  const key = `${sortedChars}::${p.formulaId}`;
  const arr = newByChars.get(key);
  if (arr) arr.push(p);
  else newByChars.set(key, [p]);
}

// Remap solutions
const newProblems: Record<string, Problem> = {};
let migrated = 0;
let skipped = 0;

for (const [, problem] of Object.entries(solutions.problems)) {
  const sortedChars = [...problem.characters].sort().join(",");
  const lookupKey = `${sortedChars}::${problem.formulaId}`;
  const candidates = newByChars.get(lookupKey);

  if (!candidates || candidates.length !== 1) {
    console.log(`SKIP: ${problem.characters.join("/")}::${problem.formulaId} (${candidates ? "multi-match" : "no match"})`);
    skipped++;
    continue;
  }

  const newProblem = candidates[0];
  const newKey = newProblem.key;

  if (!newProblems[newKey]) {
    newProblems[newKey] = {
      teamId: newProblem.teamId,
      teamName: newProblem.teamName,
      characters: newProblem.characters,
      carryCharId: newProblem.carryCharId,
      formulaId: newProblem.formulaId,
      solutions: [],
    };
  }

  for (const sol of problem.solutions) {
    newProblems[newKey].solutions.push(sol);
  }
  migrated++;
}

const newStore: SolutionStore = {
  accountFrozenAt: solutions.accountFrozenAt,
  sourceAccountFile: solutions.sourceAccountFile,
  problems: newProblems,
};

writeFileSync(SOLUTIONS_PATH, JSON.stringify(newStore, null, 2));
const totalSolutions = Object.values(newProblems).reduce((s, p) => s + p.solutions.length, 0);
console.log(`\nMigrated ${migrated} problems (${totalSolutions} solutions), skipped ${skipped}`);
