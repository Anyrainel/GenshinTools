import { describe, expect, it } from "vitest";
import {
  type PackerCharacter,
  type PackerColumn,
  packColumns,
  packColumnsBeam,
} from "@/lib/account-data/columnPacker";

/** Brute-force optimum for verifying packColumns against ground truth. */
function bruteForceBest(chars: PackerCharacter[]): {
  totalScore: number;
  byCharacter: Record<string, PackerColumn | null>;
} {
  const n = chars.length;
  let best = 0;
  let bestPick: (PackerColumn | null)[] = new Array(n).fill(null);

  function dfs(
    i: number,
    claimed: Set<string>,
    score: number,
    pick: (PackerColumn | null)[]
  ) {
    if (i === n) {
      if (score > best) {
        best = score;
        bestPick = pick.slice();
      }
      return;
    }
    // Try each column for char i
    for (const col of chars[i].columns) {
      let conflict = false;
      for (const id of col.artifactIds) {
        if (claimed.has(id)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;
      for (const id of col.artifactIds) claimed.add(id);
      pick[i] = col;
      dfs(i + 1, claimed, score + col.score, pick);
      pick[i] = null;
      for (const id of col.artifactIds) claimed.delete(id);
    }
    // Skip branch
    pick[i] = null;
    dfs(i + 1, claimed, score, pick);
  }

  dfs(0, new Set(), 0, new Array(n).fill(null));
  const out: Record<string, PackerColumn | null> = {};
  for (let i = 0; i < n; i++) out[chars[i].characterId] = bestPick[i];
  return { totalScore: best, byCharacter: out };
}

function col(score: number, ids: string[]): PackerColumn {
  return { artifactIds: ids, score };
}

describe("packColumns", () => {
  it("returns empty assignment when no characters", () => {
    const r = packColumns([]);
    expect(r.totalScore).toBe(0);
    expect(r.byCharacter).toEqual({});
  });

  it("picks each char's top column when no conflicts exist", () => {
    const chars: PackerCharacter[] = [
      { characterId: "A", columns: [col(100, ["a1", "a2"]), col(80, ["a3"])] },
      { characterId: "B", columns: [col(90, ["b1", "b2"]), col(70, ["b3"])] },
    ];
    const r = packColumns(chars);
    expect(r.totalScore).toBe(190);
    expect(r.byCharacter.A?.artifactIds).toEqual(["a1", "a2"]);
    expect(r.byCharacter.B?.artifactIds).toEqual(["b1", "b2"]);
  });

  it("resolves a conflict by giving up a slightly-better column for one char", () => {
    // A's top wants x1,x2 (100). B's top also wants x1,x3 (95). Only one can take x1.
    // Best joint: A takes x1,x2 (100) + B takes b2 (50) = 150
    // Alt: A takes a3 (80) + B takes x1,x3 (95) = 175 → better.
    const chars: PackerCharacter[] = [
      { characterId: "A", columns: [col(100, ["x1", "x2"]), col(80, ["a3"])] },
      { characterId: "B", columns: [col(95, ["x1", "x3"]), col(50, ["b2"])] },
    ];
    const r = packColumns(chars);
    const bf = bruteForceBest(chars);
    expect(r.totalScore).toBe(bf.totalScore);
    expect(r.totalScore).toBe(175);
  });

  it("matches brute-force optimum on a 4-char, 5-column random instance", () => {
    // Small randomized scenario with intentional artifact overlaps.
    const chars: PackerCharacter[] = [
      {
        characterId: "C0",
        columns: [
          col(120, ["g1", "p1", "s1", "go1", "ci1"]),
          col(115, ["g2", "p1", "s1", "go1", "ci1"]),
          col(110, ["g1", "p2", "s2", "go2", "ci2"]),
          col(100, ["g3", "p3", "s3", "go3", "ci3"]),
          col(90, ["g4", "p4", "s4", "go4", "ci4"]),
        ],
      },
      {
        characterId: "C1",
        columns: [
          col(118, ["g1", "p2", "s1", "go2", "ci3"]),
          col(112, ["g2", "p2", "s5", "go5", "ci5"]),
          col(105, ["g3", "p3", "s6", "go6", "ci6"]),
          col(95, ["g4", "p4", "s7", "go7", "ci7"]),
          col(85, ["g5", "p5", "s8", "go8", "ci8"]),
        ],
      },
      {
        characterId: "C2",
        columns: [
          col(110, ["g2", "p1", "s2", "go3", "ci4"]),
          col(105, ["g6", "p6", "s9", "go9", "ci9"]),
          col(100, ["g7", "p7", "s10", "go10", "ci10"]),
          col(90, ["g8", "p8", "s11", "go11", "ci11"]),
          col(80, ["g9", "p9", "s12", "go12", "ci12"]),
        ],
      },
      {
        characterId: "C3",
        columns: [
          col(105, ["g3", "p2", "s3", "go4", "ci5"]),
          col(100, ["g10", "p10", "s13", "go13", "ci13"]),
          col(95, ["g11", "p11", "s14", "go14", "ci14"]),
          col(90, ["g12", "p12", "s15", "go15", "ci15"]),
          col(85, ["g13", "p13", "s16", "go16", "ci16"]),
        ],
      },
    ];
    const r = packColumns(chars);
    const bf = bruteForceBest(chars);
    expect(r.totalScore).toBe(bf.totalScore);
  });

  it("skips a character when all its columns are over-claimed", () => {
    // A claims everything B wants. B should end up with null assignment.
    const chars: PackerCharacter[] = [
      { characterId: "A", columns: [col(100, ["x1", "x2", "x3", "x4", "x5"])] },
      { characterId: "B", columns: [col(50, ["x1"])] },
    ];
    const r = packColumns(chars);
    expect(r.totalScore).toBe(100);
    expect(r.byCharacter.A?.artifactIds).toEqual([
      "x1",
      "x2",
      "x3",
      "x4",
      "x5",
    ]);
    expect(r.byCharacter.B).toBeNull();
  });

  it("handles characters with empty column lists", () => {
    const chars: PackerCharacter[] = [
      { characterId: "A", columns: [col(100, ["x1"])] },
      { characterId: "B", columns: [] },
    ];
    const r = packColumns(chars);
    expect(r.totalScore).toBe(100);
    expect(r.byCharacter.B).toBeNull();
  });

  it("beam packer resolves conflicts and keeps assignments disjoint", () => {
    const chars: PackerCharacter[] = [
      {
        characterId: "A",
        columns: [
          col(100, ["x1", "a2", "a3", "a4", "a5"]),
          col(92, ["a1", "a2", "a3", "a4", "a5"]),
        ],
      },
      {
        characterId: "B",
        columns: [
          col(99, ["x1", "b2", "b3", "b4", "b5"]),
          col(70, ["b1", "b2", "b3", "b4", "b5"]),
        ],
      },
      {
        characterId: "C",
        columns: [col(80, ["c1", "c2", "c3", "c4", "c5"])],
      },
    ];

    const r = packColumnsBeam(chars, { beamWidth: 4, repairSweeps: 1 });
    expect(r.totalScore).toBe(271);

    const used = new Set<string>();
    for (const picked of Object.values(r.byCharacter)) {
      if (!picked) continue;
      for (const id of picked.artifactIds) {
        expect(used.has(id)).toBe(false);
        used.add(id);
      }
    }
  });
});

// ─── Seeded fuzz ───

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function randomColumn(
  rand: () => number,
  universe: string[],
  minIds: number,
  maxIds: number
): PackerColumn {
  const size = randInt(rand, minIds, maxIds);
  const remaining = [...universe];
  const ids: string[] = [];
  while (ids.length < size && remaining.length > 0) {
    const idx = Math.floor(rand() * remaining.length);
    ids.push(remaining.splice(idx, 1)[0]);
  }
  return col(randInt(rand, 10, 150), ids);
}

function randomChars(
  rand: () => number,
  charCount: number,
  universe: string[],
  colRange: { min: number; max: number },
  idRange: { min: number; max: number }
): PackerCharacter[] {
  return Array.from({ length: charCount }, (_, c) => {
    const columns = Array.from(
      { length: randInt(rand, colRange.min, colRange.max) },
      () => randomColumn(rand, universe, idRange.min, idRange.max)
    );
    columns.sort((a, b) => b.score - a.score);
    return { characterId: `C${c}`, columns };
  });
}

/** Greedy baseline using packColumnsBeam's difficulty ordering. */
function difficultyOrderGreedyScore(chars: PackerCharacter[]): number {
  const ordered = [...chars].sort((a, b) => {
    const aTop = a.columns[0]?.score ?? 0;
    const bTop = b.columns[0]?.score ?? 0;
    const aSpread =
      aTop - (a.columns[Math.min(4, a.columns.length - 1)]?.score ?? 0);
    const bSpread =
      bTop - (b.columns[Math.min(4, b.columns.length - 1)]?.score ?? 0);
    return bSpread - aSpread || bTop - aTop;
  });

  const claimed = new Set<string>();
  let total = 0;
  for (const char of ordered) {
    for (const candidate of char.columns) {
      if (candidate.artifactIds.some((id) => claimed.has(id))) continue;
      for (const id of candidate.artifactIds) claimed.add(id);
      total += candidate.score;
      break;
    }
  }
  return total;
}

function collectChosen(
  byCharacter: Record<string, PackerColumn | null>
): PackerColumn[] {
  return Object.values(byCharacter).filter(
    (c): c is PackerColumn => c !== null
  );
}

function expectDisjoint(columns: PackerColumn[], label: string): void {
  const used = new Set<string>();
  for (const chosen of columns) {
    for (const id of chosen.artifactIds) {
      expect(used.has(id), `${label}: artifact ${id} claimed twice`).toBe(
        false
      );
      used.add(id);
    }
  }
}

describe("packColumns seeded fuzz", () => {
  it("equals the brute-force optimum on seeded 3-char x 3-column instances", () => {
    const universe = Array.from({ length: 7 }, (_, i) => `u${i}`);
    for (let seed = 1; seed <= 20; seed++) {
      const rand = mulberry32(seed * 2654435761 + 1);
      const chars = randomChars(
        rand,
        3,
        universe,
        { min: 3, max: 3 },
        { min: 2, max: 3 }
      );

      const r = packColumns(chars);
      const bf = bruteForceBest(chars);
      expect(r.totalScore, `seed ${seed}`).toBe(bf.totalScore);

      const chosen = collectChosen(r.byCharacter);
      expectDisjoint(chosen, `seed ${seed}`);
      expect(
        chosen.reduce((sum, c) => sum + c.score, 0),
        `seed ${seed}: totalScore must equal sum of chosen columns`
      ).toBe(r.totalScore);
    }
  });
});

describe("packColumnsBeam seeded fuzz", () => {
  it("returns disjoint assignments scoring at least the difficulty-order greedy baseline", () => {
    const universe = Array.from({ length: 14 }, (_, i) => `a${i}`);
    for (let seed = 1; seed <= 50; seed++) {
      const rand = mulberry32(seed * 7919 + 3);
      const chars = randomChars(
        rand,
        randInt(rand, 4, 6),
        universe,
        { min: 2, max: 5 },
        { min: 3, max: 5 }
      );

      const r = packColumnsBeam(chars);
      const chosen = collectChosen(r.byCharacter);
      expectDisjoint(chosen, `seed ${seed}`);
      expect(
        chosen.reduce((sum, c) => sum + c.score, 0),
        `seed ${seed}: totalScore must equal sum of chosen columns`
      ).toBe(r.totalScore);
      expect(
        r.totalScore,
        `seed ${seed}: beam below greedy baseline`
      ).toBeGreaterThanOrEqual(difficultyOrderGreedyScore(chars));
    }
  });
});
