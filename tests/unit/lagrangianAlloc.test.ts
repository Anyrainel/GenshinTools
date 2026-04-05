import {
  DEFAULT_LAGRANGIAN_CONFIG,
  findContestedArtifacts,
  runLagrangianAllocation,
} from "@/lib/team-comp/optimizer/lagrangianAlloc";
import type { ArtifactTuple, TopKEntry } from "@/lib/team-comp/optimizer/types";
import { describe, expect, it } from "vitest";

// ─── Helpers ───

function makeEntry(damage: number, ids: string[]): TopKEntry {
  return {
    damage,
    result: null,
    artifacts: [null, null, null, null, null] as ArtifactTuple,
    artifactIds: new Set(ids),
  };
}

const emptySlots = () => ({
  flower: null,
  plume: null,
  sands: null,
  goblet: null,
  circlet: null,
});

// ─── findContestedArtifacts ───

describe("findContestedArtifacts", () => {
  it("returns empty map when no overlap", () => {
    const topK = {
      charA: [makeEntry(100, ["a1", "a2", "a3", "a4", "a5"])],
      charB: [makeEntry(90, ["b1", "b2", "b3", "b4", "b5"])],
    };
    const result = findContestedArtifacts(["charA", "charB"], topK);
    expect(result.size).toBe(0);
  });

  it("detects shared artifact between two characters", () => {
    const shared = "shared-1";
    const topK = {
      charA: [
        makeEntry(100, [shared, "a2", "a3", "a4", "a5"]),
        makeEntry(95, [shared, "a6", "a7", "a8", "a9"]),
      ],
      charB: [
        makeEntry(90, [shared, "b2", "b3", "b4", "b5"]),
        makeEntry(85, [shared, "b6", "b7", "b8", "b9"]),
      ],
    };
    const result = findContestedArtifacts(["charA", "charB"], topK);
    expect(result.has(shared)).toBe(true);
    expect(result.get(shared)!.size).toBe(2);
  });

  it("ignores artifacts below minUsageFraction", () => {
    const topK = {
      charA: Array.from({ length: 10 }, (_, i) =>
        i === 0
          ? makeEntry(100, ["rare", "a2", "a3", "a4", "a5"])
          : makeEntry(90, [`a${i}1`, `a${i}2`, `a${i}3`, `a${i}4`, `a${i}5`])
      ),
      charB: [makeEntry(80, ["rare", "b2", "b3", "b4", "b5"])],
    };
    const result = findContestedArtifacts(["charA", "charB"], topK, 0.2);
    expect(result.size).toBe(0);
  });

  it("handles empty top-K for a character", () => {
    const topK = {
      charA: [makeEntry(100, ["a1", "a2", "a3", "a4", "a5"])],
      charB: [],
    };
    const result = findContestedArtifacts(["charA", "charB"], topK);
    expect(result.size).toBe(0);
  });
});

// ─── runLagrangianAllocation ───

describe("runLagrangianAllocation", () => {
  it("returns unchanged result when no contested artifacts", () => {
    const topK = {
      charA: [makeEntry(100, ["a1", "a2", "a3", "a4", "a5"])],
      charB: [makeEntry(90, ["b1", "b2", "b3", "b4", "b5"])],
    };
    const currentArts = { charA: emptySlots(), charB: emptySlots() };
    const result = runLagrangianAllocation({
      charIds: ["charA", "charB"],
      topKByChar: topK,
      currentBestDamage: 190,
      currentBestArtifacts: currentArts,
      evalTeamDamage: () => 190,
      charPriorityOrder: ["charA", "charB"],
    });
    expect(result.improved).toBe(false);
    expect(result.iterations).toBe(0);
    expect(result.gap).toBe(0);
  });

  it("resolves conflict by pricing contested artifact away from one character", () => {
    const shared = "shared-flower";
    const topK = {
      charA: [
        makeEntry(100, [shared, "a2", "a3", "a4", "a5"]),
        makeEntry(80, ["a6", "a2", "a3", "a4", "a5"]),
      ],
      charB: [
        makeEntry(90, [shared, "b2", "b3", "b4", "b5"]),
        makeEntry(85, ["b6", "b2", "b3", "b4", "b5"]),
      ],
    };
    const currentArts = { charA: emptySlots(), charB: emptySlots() };

    const result = runLagrangianAllocation({
      charIds: ["charA", "charB"],
      topKByChar: topK,
      currentBestDamage: 170,
      currentBestArtifacts: currentArts,
      evalTeamDamage: () => 185,
      charPriorityOrder: ["charA", "charB"],
    });

    expect(result.bestFeasibleDamage).toBeGreaterThanOrEqual(170);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.gap).toBeGreaterThanOrEqual(0);
  });

  it("respects time deadline", () => {
    const shared = "shared-1";
    const topK = {
      charA: [makeEntry(100, [shared, "a2", "a3", "a4", "a5"])],
      charB: [makeEntry(90, [shared, "b2", "b3", "b4", "b5"])],
    };
    const currentArts = { charA: emptySlots(), charB: emptySlots() };

    const result = runLagrangianAllocation({
      charIds: ["charA", "charB"],
      topKByChar: topK,
      currentBestDamage: 100,
      currentBestArtifacts: currentArts,
      evalTeamDamage: () => 100,
      charPriorityOrder: ["charA", "charB"],
      deadline: performance.now() - 1,
    });

    expect(result.iterations).toBe(0);
  });

  it("stops at plateau limit", () => {
    const shared = "shared-1";
    const topK = {
      charA: [makeEntry(100, [shared, "a2", "a3", "a4", "a5"])],
      charB: [makeEntry(90, [shared, "b2", "b3", "b4", "b5"])],
    };
    const currentArts = { charA: emptySlots(), charB: emptySlots() };

    const result = runLagrangianAllocation({
      charIds: ["charA", "charB"],
      topKByChar: topK,
      currentBestDamage: 100,
      currentBestArtifacts: currentArts,
      evalTeamDamage: () => 80,
      charPriorityOrder: ["charA", "charB"],
      config: { plateauLimit: 2 },
    });

    expect(result.iterations).toBeLessThanOrEqual(
      DEFAULT_LAGRANGIAN_CONFIG.maxIterations
    );
  });

  it("reports gap between upper bound and feasible damage", () => {
    const shared = "shared-1";
    const topK = {
      charA: [
        makeEntry(100, [shared, "a2", "a3", "a4", "a5"]),
        makeEntry(70, ["a6", "a7", "a8", "a9", "a10"]),
      ],
      charB: [
        makeEntry(90, [shared, "b2", "b3", "b4", "b5"]),
        makeEntry(60, ["b6", "b7", "b8", "b9", "b10"]),
      ],
    };
    const currentArts = { charA: emptySlots(), charB: emptySlots() };

    const result = runLagrangianAllocation({
      charIds: ["charA", "charB"],
      topKByChar: topK,
      currentBestDamage: 0,
      currentBestArtifacts: currentArts,
      evalTeamDamage: () => 160,
      charPriorityOrder: ["charA", "charB"],
    });

    expect(result.gap).toBeGreaterThanOrEqual(0);
    expect(result.upperBound).toBeGreaterThanOrEqual(result.bestFeasibleDamage);
  });
});
