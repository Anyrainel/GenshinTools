import { beforeAll, describe, expect, it } from "vitest";
import {
  buildManualConditionArrayCoverageCore,
  extractManualConditionOccurrences,
  verifyExactRawConditionPropertyCoverage,
  verifyManualConditionRepositoryParity,
  type BuildManualConditionArrayCoverageCoreInput,
  type ManualConditionArrayCoverageCore,
  type ManualConditionSnapshotInput,
} from "../src/manualConditionArrayCoverage";
import { readJson, sha256Text, stableJson } from "../src/io";
import { ManualSnapshotIndexSchema } from "../src/schemas";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
} from "../src/paths";

let fixture: BuildManualConditionArrayCoverageCoreInput;
let core: ManualConditionArrayCoverageCore;

beforeAll(async () => {
  const manualIndexInput = await readJson(MANUAL_SNAPSHOT_INDEX_PATH);
  const index = ManualSnapshotIndexSchema.parse(manualIndexInput);
  const manualSnapshotInputs = await Promise.all(
    index.snapshots.map(async ({ path }) => ({
      path,
      snapshotInput: await readJson(path),
    })),
  );
  fixture = {
    manualIndexInput,
    manualSnapshotInputs,
    repositoryInput: await readJson(KNOWLEDGE_REPOSITORY_PATH),
  };
  core = buildManualConditionArrayCoverageCore(fixture);
});

describe("manual condition-array extraction", () => {
  it("exhaustively extracts the nine indexed snapshots and 72 records", () => {
    expect(core.extraction.snapshots).toEqual([
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-diona-manual.json",
        sourceId: "kqm",
        recordCount: 5,
        occurrenceCount: 26,
      },
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-furina-manual.json",
        sourceId: "kqm",
        recordCount: 14,
        occurrenceCount: 24,
      },
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-itto-manual.json",
        sourceId: "kqm",
        recordCount: 7,
        occurrenceCount: 15,
      },
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
        sourceId: "kqm",
        recordCount: 24,
        occurrenceCount: 41,
      },
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-klee-manual.json",
        sourceId: "kqm",
        recordCount: 7,
        occurrenceCount: 15,
      },
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-kokomi-manual.json",
        sourceId: "kqm",
        recordCount: 2,
        occurrenceCount: 5,
      },
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json",
        sourceId: "kqm",
        recordCount: 5,
        occurrenceCount: 16,
      },
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json",
        sourceId: "kqm",
        recordCount: 7,
        occurrenceCount: 21,
      },
      {
        path: "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json",
        sourceId: "kqm",
        recordCount: 1,
        occurrenceCount: 0,
      },
    ]);
    expect(core.extraction.summary).toEqual({
      snapshotCount: 9,
      manualRecordCount: 72,
      occurrenceCount: 163,
      emptyCount: 20,
      nonemptyCount: 143,
      uniqueOrderedArrayCount: 105,
      stringOccurrenceCount: 177,
      uniqueStringCount: 114,
      byClaimAxis: {
        "weapon-recommendation": 45,
        "artifact-recommendation": 40,
        "main-stat": 41,
        substat: 22,
        "er-target": 3,
        "artifact-plan": 1,
        "character-role-member": 11,
      },
      structuralEr: {
        occurrenceCount: 3,
        emptyCount: 0,
        nonemptyCount: 3,
        uniqueOrderedArrayCount: 3,
        stringOccurrenceCount: 3,
        uniqueStringCount: 3,
      },
      notStructuralEnergy: {
        occurrenceCount: 160,
        emptyCount: 20,
        nonemptyCount: 140,
        uniqueOrderedArrayCount: 102,
        stringOccurrenceCount: 174,
        uniqueStringCount: 111,
      },
    });
  });

  it("preserves every exact ordered source array, stable path, subject, hash, and extraction boundary", () => {
    const sourceByPath = new Map(
      fixture.manualSnapshotInputs.map(({ path, snapshotInput }) => [
        path,
        snapshotInput,
      ]),
    );

    for (const occurrence of core.extraction.occurrences) {
      const snapshot = sourceByPath.get(occurrence.snapshotPath);
      expect(readSchemaPath(snapshot, occurrence.manualPath)).toEqual(
        occurrence.conditions,
      );
      expect(occurrence.conditionsSha256).toBe(
        sha256Text(stableJson(occurrence.conditions)),
      );
      expect(occurrence.occurrenceId).toBe(
        `${occurrence.sourceId}:${occurrence.recordKind}:${occurrence.sourceRecordId}:${occurrence.manualClaimPath}`,
      );
      expect(occurrence.extraction).toEqual({
        method: "agent-assisted",
        reviewStatus: "unreviewed",
      });
      expect(occurrence.repositoryPath).not.toContain("recommendation.");
      expect(occurrence.subject).not.toBe("");
      if (occurrence.claimAxis === "artifact-plan") {
        expect(occurrence.subject).toBe("team-level");
      } else {
        expect(occurrence.subject).not.toBe("team-level");
      }
      if (occurrence.claimAxis === "main-stat") {
        expect(["sands", "goblet", "circlet"]).toContain(
          occurrence.mainStatSlot,
        );
      } else {
        expect(occurrence.mainStatSlot).toBeUndefined();
      }
    }

    expect(
      new Set(core.extraction.occurrences.map(({ occurrenceId }) => occurrenceId))
        .size,
    ).toBe(163);
    expect(
      core.extraction.occurrences.find(
        ({ occurrenceId }) =>
          occurrenceId ===
          "kqm:character_guide:furina-artifact-sets-luna-ii:recommendation.artifactRecommendations[3].conditions",
      ),
    ).toMatchObject({
      snapshotPath:
        "scripts/guide-factory/data/source-snapshots/kqm-furina-manual.json",
      subject: "furina",
      manualPath:
        "records[0].recommendation.artifactRecommendations[3].conditions",
      repositoryRecordId:
        "kqm:character-guide:furina-artifact-sets-luna-ii",
      repositoryPath:
        "recommendations[0].artifactRecommendations[3].conditions",
    });
  });

  it("marks only the er-target claim axis as structurally energy-related", () => {
    const structuralEr = core.extraction.occurrences.filter(
      ({ structuralEnergyDimension }) =>
        structuralEnergyDimension === "structural-er",
    );
    expect(structuralEr).toHaveLength(3);
    expect(
      structuralEr.every(({ claimAxis }) => claimAxis === "er-target"),
    ).toBe(true);
    expect(
      core.extraction.occurrences.every(
        ({ claimAxis, structuralEnergyDimension }) =>
          (claimAxis === "er-target") ===
          (structuralEnergyDimension === "structural-er"),
      ),
    ).toBe(true);
    expect(
      structuralEr.map(
        ({ sourceRecordId, subject, manualClaimPath, conditions }) => ({
          sourceRecordId,
          subject,
          manualClaimPath,
          conditions,
        }),
      ),
    ).toEqual([
      {
        sourceRecordId: "c6-diona-mavuika-citlali-bennett-er",
        subject: "diona",
        manualClaimPath: "targets[0].conditions",
        conditions: ["C6 Diona uses Sacrificial Bow."],
      },
      {
        sourceRecordId: "c6-diona-mavuika-citlali-bennett-er",
        subject: "diona",
        manualClaimPath: "targets[1].conditions",
        conditions: ["C6 Diona uses Favonius Warbow."],
      },
      {
        sourceRecordId: "c6-diona-mavuika-citlali-bennett-er",
        subject: "diona",
        manualClaimPath: "targets[2].conditions",
        conditions: ["C6 Diona uses another Bow."],
      },
    ]);
  });

  it("retains duplicate strings and makes both order and multiplicity hash-significant", () => {
    const target = core.extraction.occurrences.find(
      ({ occurrenceId }) =>
        occurrenceId ===
        "kqm:character_guide:furina-artifact-sets-luna-ii:recommendation.artifactRecommendations[3].conditions",
    );
    if (target == null || target.conditions.length !== 2) {
      throw new Error("Missing two-condition Furina fixture.");
    }

    const manualSnapshotInputs = structuredClone(
      fixture.manualSnapshotInputs,
    ) as ManualConditionSnapshotInput[];
    const snapshot = manualSnapshotInputs.find(
      ({ path }) => path === target.snapshotPath,
    );
    if (snapshot == null) throw new Error("Missing Furina manual snapshot.");
    const duplicated = [
      target.conditions[0] ?? "",
      target.conditions[0] ?? "",
      target.conditions[1] ?? "",
    ];
    writeSchemaPath(snapshot.snapshotInput, target.manualPath, duplicated);

    const extraction = extractManualConditionOccurrences(
      fixture.manualIndexInput,
      manualSnapshotInputs,
    );
    const changed = extraction.occurrences.find(
      ({ occurrenceId }) => occurrenceId === target.occurrenceId,
    );
    expect(changed?.conditions).toEqual(duplicated);
    expect(changed?.conditionsSha256).toBe(sha256Text(stableJson(duplicated)));
    expect(changed?.conditionsSha256).not.toBe(target.conditionsSha256);
    expect(extraction.summary.stringOccurrenceCount).toBe(178);

    const reversed = {
      ...target,
      conditions: [...target.conditions].reverse(),
      conditionsSha256: sha256Text(
        stableJson([...target.conditions].reverse()),
      ),
    };
    expect(
      verifyManualConditionRepositoryParity(
        [reversed],
        fixture.repositoryInput,
      ),
    ).toMatchObject({
      status: "mismatch",
      occurrenceCount: 1,
      exactMatchCount: 0,
      mismatchCount: 1,
      rows: [
        {
          occurrenceId: target.occurrenceId,
          status: "ordered-array-mismatch",
          exactOrderedArrayMatch: false,
        },
      ],
    });
  });

  it("fails closed when raw input adds an unknown future conditions field", () => {
    const manualSnapshotInputs = structuredClone(fixture.manualSnapshotInputs);
    const firstSnapshot = manualSnapshotInputs[0]?.snapshotInput as
      | { records?: Array<Record<string, unknown>> }
      | undefined;
    const firstRecord = firstSnapshot?.records?.[0];
    if (firstRecord == null) throw new Error("Missing raw snapshot fixture.");
    firstRecord.futureRecommendation = {
      conditions: ["A future schema condition the extractor does not know."],
    };

    const firstInput = manualSnapshotInputs[0];
    if (firstInput == null) throw new Error("Missing raw snapshot fixture.");
    const emitted = core.extraction.occurrences.filter(
      ({ snapshotPath }) => snapshotPath === firstInput.path,
    );
    expect(() =>
      verifyExactRawConditionPropertyCoverage(
        firstInput.snapshotInput,
        firstInput.path,
        emitted,
      ),
    ).toThrow("raw-only [records[0].futureRecommendation.conditions]");
  });

  it("fails closed when schema defaults recreate a missing raw conditions property", () => {
    const target = core.extraction.occurrences.find(
      ({ claimAxis }) => claimAxis === "weapon-recommendation",
    );
    if (target == null) throw new Error("Missing weapon condition fixture.");

    const manualSnapshotInputs = structuredClone(fixture.manualSnapshotInputs);
    const snapshot = manualSnapshotInputs.find(
      ({ path }) => path === target.snapshotPath,
    );
    if (snapshot == null) throw new Error("Missing target snapshot fixture.");
    deleteSchemaPath(snapshot.snapshotInput, target.manualPath);

    expect(() =>
      extractManualConditionOccurrences(
        fixture.manualIndexInput,
        manualSnapshotInputs,
      ),
    ).toThrow(`extractor-only [${target.manualPath}]`);
  });

  it("rejects wrong-shape, extractor-only, duplicate, and payload-mismatched condition paths", () => {
    const manualSnapshotInputs = structuredClone(fixture.manualSnapshotInputs);
    const firstInput = manualSnapshotInputs[0];
    const firstSnapshot = firstInput?.snapshotInput as
      | { records?: Array<Record<string, unknown>> }
      | undefined;
    const firstRecord = firstSnapshot?.records?.[0];
    if (firstInput == null || firstRecord == null) {
      throw new Error("Missing raw snapshot fixture.");
    }
    firstRecord.futureRecommendation = { conditions: "not-an-array" };
    expect(() =>
      extractManualConditionOccurrences(
        fixture.manualIndexInput,
        manualSnapshotInputs,
      ),
    ).toThrow("must be a string array");

    const emitted = core.extraction.occurrences.filter(
      ({ snapshotPath }) => snapshotPath === firstInput.path,
    );
    const originalInput = fixture.manualSnapshotInputs[0];
    if (originalInput == null) throw new Error("Missing original snapshot fixture.");
    expect(() =>
      verifyExactRawConditionPropertyCoverage(
        originalInput.snapshotInput,
        firstInput.path,
        emitted,
      ),
    ).not.toThrow();

    const extractorOnly = structuredClone(emitted);
    extractorOnly[0]!.manualPath = `${extractorOnly[0]!.manualPath}.moved`;
    expect(() =>
      verifyExactRawConditionPropertyCoverage(
        originalInput.snapshotInput,
        firstInput.path,
        extractorOnly,
      ),
    ).toThrow("extractor-only");

    const duplicate = [...emitted, structuredClone(emitted[0]!)];
    expect(() =>
      verifyExactRawConditionPropertyCoverage(
        originalInput.snapshotInput,
        firstInput.path,
        duplicate,
      ),
    ).toThrow("Duplicate extractor conditions path");

    const payloadMismatch = structuredClone(emitted);
    const nonempty = payloadMismatch.find(({ conditions }) => conditions.length > 0);
    if (nonempty == null) throw new Error("Missing nonempty condition fixture.");
    nonempty.conditions = [...nonempty.conditions, "Drifted payload."];
    expect(() =>
      verifyExactRawConditionPropertyCoverage(
        originalInput.snapshotInput,
        firstInput.path,
        payloadMismatch,
      ),
    ).toThrow("ordered conditions payload mismatch");
  });

  it("requires the input set to match the manual index exactly", () => {
    expect(() =>
      extractManualConditionOccurrences(
        fixture.manualIndexInput,
        fixture.manualSnapshotInputs.slice(1),
      ),
    ).toThrow("is missing indexed snapshot");

    expect(() =>
      extractManualConditionOccurrences(fixture.manualIndexInput, [
        ...fixture.manualSnapshotInputs,
        {
          path: "scripts/guide-factory/data/source-snapshots/unindexed-manual.json",
          snapshotInput: fixture.manualSnapshotInputs[0]?.snapshotInput,
        },
      ]),
    ).toThrow("received unindexed snapshots");

    const changedIndex = structuredClone(
      ManualSnapshotIndexSchema.parse(fixture.manualIndexInput),
    );
    const first = changedIndex.snapshots[0];
    if (first == null) throw new Error("Missing manual index fixture.");
    first.sourceId = "different-source";
    expect(() =>
      extractManualConditionOccurrences(
        changedIndex,
        fixture.manualSnapshotInputs,
      ),
    ).toThrow("but the index declares different-source");
  });
});

describe("manual condition-array repository parity", () => {
  it("maps all 163 occurrences to exact ordered arrays in the consolidated repository", () => {
    expect(core.repositoryParity).toMatchObject({
      status: "exact",
      occurrenceCount: 163,
      exactMatchCount: 163,
      mismatchCount: 0,
      statusCounts: {
        exact: 163,
        "missing-record": 0,
        "ambiguous-record": 0,
        "source-reference-mismatch": 0,
        "missing-path": 0,
        "invalid-condition-array": 0,
        "ordered-array-mismatch": 0,
      },
    });
    expect(core.repositoryParity.rows).toHaveLength(163);
    for (const row of core.repositoryParity.rows) {
      const occurrence = core.extraction.occurrences.find(
        ({ occurrenceId }) => occurrenceId === row.occurrenceId,
      );
      expect(occurrence).toBeDefined();
      expect(row.status).toBe("exact");
      expect(row.exactOrderedArrayMatch).toBe(true);
      expect(row.repositoryConditions).toEqual(occurrence?.conditions);
      expect(row.repositoryConditionsSha256).toBe(
        occurrence?.conditionsSha256,
      );
      expect(row.repositoryJsonPath?.endsWith(occurrence?.repositoryPath ?? ""))
        .toBe(true);
    }
  });
});

function readSchemaPath(value: unknown, schemaPath: string): unknown {
  const tokens = schemaPath.match(/[^.[\]]+|\d+/g) ?? [];
  let current = value;
  for (const token of tokens) {
    if (Array.isArray(current) && /^\d+$/.test(token)) {
      current = current[Number(token)];
    } else if (current != null && typeof current === "object") {
      current = (current as Record<string, unknown>)[token];
    } else {
      return undefined;
    }
  }
  return current;
}

function writeSchemaPath(
  value: unknown,
  schemaPath: string,
  replacement: unknown,
): void {
  const tokens = schemaPath.match(/[^.[\]]+|\d+/g) ?? [];
  const last = tokens.pop();
  if (last == null) throw new Error(`Invalid schema path ${schemaPath}.`);
  const parent = readSchemaPath(value, tokens.join("."));
  if (Array.isArray(parent) && /^\d+$/.test(last)) {
    parent[Number(last)] = replacement;
  } else if (parent != null && typeof parent === "object") {
    (parent as Record<string, unknown>)[last] = replacement;
  } else {
    throw new Error(`Missing parent for schema path ${schemaPath}.`);
  }
}

function deleteSchemaPath(value: unknown, schemaPath: string): void {
  const tokens = schemaPath.match(/[^.[\]]+|\d+/g) ?? [];
  const last = tokens.pop();
  if (last == null) throw new Error(`Invalid schema path ${schemaPath}.`);
  const parent = readSchemaPath(value, tokens.join("."));
  if (parent == null || typeof parent !== "object" || Array.isArray(parent)) {
    throw new Error(`Missing object parent for schema path ${schemaPath}.`);
  }
  if (!Object.hasOwn(parent, last)) {
    throw new Error(`Missing raw property for schema path ${schemaPath}.`);
  }
  delete (parent as Record<string, unknown>)[last];
}
