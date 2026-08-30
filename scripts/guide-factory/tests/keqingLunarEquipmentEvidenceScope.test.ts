import characterStatsInput from "@/data/game/character_stats.json";
import { describe, expect, it } from "vitest";
import {
  authenticateKeqingLunarEquipmentScope,
  deriveKeqingLunarEquipmentScopeCandidate,
  KEQING_LUNAR_EQUIPMENT_SCOPE_EXPECTATION,
  type KeqingLunarEquipmentScopeInput,
} from "../src/keqingLunarEquipmentEvidenceScope";
import { buildKeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import { readJson } from "../src/io";
import {
  loadManualSnapshotInputs,
  type ManualSnapshotInput,
} from "../src/manualSnapshots";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  SOURCE_REGISTRY_PATH,
} from "../src/paths";
import {
  type KnowledgeRepository,
  KnowledgeRepositorySchema,
  type ManualObservationSnapshot,
  ManualObservationSnapshotSchema,
  type ManualSnapshotIndex,
  ManualSnapshotIndexSchema,
  type SourceRegistry,
  SourceRegistrySchema,
} from "../src/schemas";

const SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json";
const SOURCE_RECORD_ID =
  "keqing-lunar-charged-general-mistsplitter-luna-i";
const REPOSITORY_RECORD_ID = `kqm:character-guide:${SOURCE_RECORD_ID}`;

describe("Keqing Lunar equipment semantic scope", () => {
  it("authenticates the exact current evidence dependencies and recommendation parities", async () => {
    const fixture = await loadFixture();
    const scoped = authenticateKeqingLunarEquipmentScope(scopeInput(fixture));

    expect(scoped.audit).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      scopeId: KEQING_LUNAR_EQUIPMENT_SCOPE_EXPECTATION.scopeId,
      selector: {
        manifestSha256:
          KEQING_LUNAR_EQUIPMENT_SCOPE_EXPECTATION.manifestSha256,
      },
      scopeProjectionSha256:
        KEQING_LUNAR_EQUIPMENT_SCOPE_EXPECTATION.scopeProjectionSha256,
    });
    expect(scoped.audit.dependencies).toHaveLength(8);
    expect(scoped.audit.parities).toHaveLength(17);
    expect(scoped.audit.parities.every(({ status }) => status === "exact")).toBe(
      true,
    );
    expect(scoped.snapshot.records).toHaveLength(17);
    expect(scoped.repositoryRecords).toHaveLength(22);
    expect(scoped).not.toHaveProperty("repository");
    expect(Object.keys(scoped.characterFacts)).toHaveLength(9);
    expect(scoped.characterFacts.keqing).toEqual({
      region: "Liyue",
      weaponType: "Sword",
    });
  });

  it("keeps the complete report stable under unrelated repository, snapshot, index, registry, character-fact, and file-hash additions", async () => {
    const fixture = await loadFixture();
    const baseline = buildReport(fixture);
    const changed = structuredClone(fixture);

    const unrelatedRepositoryRecord = structuredClone(
      requiredRepositoryRecord(changed.repository, REPOSITORY_RECORD_ID),
    );
    unrelatedRepositoryRecord.id =
      "kqm:character-guide:unrelated-future-guide-scope-test";
    changed.repository.records.push(unrelatedRepositoryRecord);
    changed.repository.sourceRegistrySha256 = "f".repeat(64);
    changed.repository.generatedFrom.push({
      sourceId: "kqm",
      files: [
        {
          path: "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json",
          sha256: "e".repeat(64),
        },
      ],
    });

    const snapshotInput = requiredSnapshotInput(changed.manualInputs);
    const snapshot = structuredClone(snapshotInput.snapshot) as {
      records?: unknown;
    };
    if (!Array.isArray(snapshot.records)) {
      throw new Error("Keqing snapshot fixture has no records array.");
    }
    snapshot.records.push({
      kind: "future-unrelated-record-kind",
      sourceRecordId: "unrelated-future-manual-record-scope-test",
      payload: { deliberately: "outside the selected schema" },
    });
    snapshotInput.snapshot = snapshot;
    snapshotInput.snapshotFile.sha256 = "f".repeat(64);

    changed.manualIndex.snapshots.push({
      sourceId: "kqm",
      path: "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json",
    });
    const unrelatedSource = structuredClone(changed.sourceRegistry.sources[0]);
    unrelatedSource.id = "unrelated-future-source-scope-test";
    changed.sourceRegistry.sources.push(unrelatedSource);
    changed.characterFacts.xiao = {
      region: "Liyue",
      weaponType: "Polearm",
    };

    expect(buildReport(changed)).toEqual(baseline);
  });

  it("rejects missing and duplicate exact selected records", async () => {
    const fixture = await loadFixture();

    const missing = structuredClone(fixture);
    missing.repository.records = missing.repository.records.filter(
      ({ id }) => id !== REPOSITORY_RECORD_ID,
    );
    expect(
      rejectionCodes(
        deriveKeqingLunarEquipmentScopeCandidate(scopeInput(missing)),
      ),
    ).toContain("selection.required_key_missing");

    const duplicated = structuredClone(fixture);
    duplicated.repository.records.push(
      structuredClone(
        requiredRepositoryRecord(duplicated.repository, REPOSITORY_RECORD_ID),
      ),
    );
    expect(
      rejectionCodes(
        deriveKeqingLunarEquipmentScopeCandidate(scopeInput(duplicated)),
      ),
    ).toContain("selection.required_key_duplicated");

    const duplicateManual = structuredClone(fixture);
    const snapshotInput = requiredSnapshotInput(duplicateManual.manualInputs);
    const snapshot = ManualObservationSnapshotSchema.parse(
      snapshotInput.snapshot,
    );
    snapshot.records.push(
      structuredClone(requiredManualRecord(snapshot, SOURCE_RECORD_ID)),
    );
    snapshotInput.snapshot = snapshot;
    expect(
      rejectionCodes(
        deriveKeqingLunarEquipmentScopeCandidate(scopeInput(duplicateManual)),
      ),
    ).toContain("selection.required_key_duplicated");
  });

  it("rejects selected semantic drift and recommendation parity mismatches", async () => {
    const fixture = await loadFixture();
    const drifted = structuredClone(fixture);
    const guide = requiredRepositoryRecord(
      drifted.repository,
      REPOSITORY_RECORD_ID,
    );
    guide.status = "accepted";
    expect(() =>
      authenticateKeqingLunarEquipmentScope(scopeInput(drifted)),
    ).toThrow(/authentication\.scope_projection_mismatch/);

    const parityMismatch = structuredClone(fixture);
    const parityGuide = requiredRepositoryRecord(
      parityMismatch.repository,
      REPOSITORY_RECORD_ID,
    );
    const recommendation = parityGuide.recommendations?.[0];
    const firstWeapon = recommendation?.weaponRecommendations?.[0]?.weaponIds[0];
    if (!recommendation || !firstWeapon) {
      throw new Error("Missing exact Mistsplitter recommendation fixture.");
    }
    recommendation.weaponRecommendations?.[0]?.weaponIds.splice(
      0,
      1,
      "primordial_jade_cutter",
    );
    expect(
      rejectionCodes(
        deriveKeqingLunarEquipmentScopeCandidate(scopeInput(parityMismatch)),
      ),
    ).toContain("parity.normalized_payload_mismatch");
  });

  it("authenticates the exact snapshot envelope, index, registry, and nine character fact rows", async () => {
    const fixture = await loadFixture();

    const envelopeDrift = structuredClone(fixture);
    const snapshotInput = requiredSnapshotInput(envelopeDrift.manualInputs);
    const snapshot = ManualObservationSnapshotSchema.parse(
      snapshotInput.snapshot,
    );
    snapshot.capturedAt = "2026-08-30";
    snapshotInput.snapshot = snapshot;
    expect(() =>
      authenticateKeqingLunarEquipmentScope(scopeInput(envelopeDrift)),
    ).toThrow(/authentication\.scope_projection_mismatch/);

    const indexDrift = structuredClone(fixture);
    const indexEntry = indexDrift.manualIndex.snapshots.find(
      ({ path }) => path === SNAPSHOT_PATH,
    );
    if (!indexEntry) throw new Error("Missing Keqing manual index fixture.");
    indexEntry.sourceId = "gcsim";
    expect(() =>
      authenticateKeqingLunarEquipmentScope(scopeInput(indexDrift)),
    ).toThrow(/authentication\.scope_projection_mismatch/);

    const registryDrift = structuredClone(fixture);
    const registryEntry = registryDrift.sourceRegistry.sources.find(
      ({ id }) => id === "kqm",
    );
    if (!registryEntry) throw new Error("Missing KQM registry fixture.");
    registryEntry.permission = "permission-required";
    expect(() =>
      authenticateKeqingLunarEquipmentScope(scopeInput(registryDrift)),
    ).toThrow(/authentication\.scope_projection_mismatch/);

    const regionDrift = structuredClone(fixture);
    const ainoFacts = regionDrift.characterFacts.aino;
    if (!ainoFacts) throw new Error("Missing Aino character facts fixture.");
    ainoFacts.region = "Mondstadt";
    expect(() =>
      authenticateKeqingLunarEquipmentScope(scopeInput(regionDrift)),
    ).toThrow(/authentication\.scope_projection_mismatch/);

    const weaponTypeDrift = structuredClone(fixture);
    const keqingFacts = weaponTypeDrift.characterFacts.keqing;
    if (!keqingFacts) throw new Error("Missing Keqing character facts fixture.");
    keqingFacts.weaponType = "Claymore";
    expect(() =>
      authenticateKeqingLunarEquipmentScope(scopeInput(weaponTypeDrift)),
    ).toThrow(/authentication\.scope_projection_mismatch/);
  });
});

interface Fixture {
  repository: KnowledgeRepository;
  manualInputs: ManualSnapshotInput[];
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
  characterFacts: Record<
    string,
    { region: string | undefined; weaponType: string | undefined } | undefined
  >;
}

async function loadFixture(): Promise<Fixture> {
  const [repositoryInput, manualIndexInput, sourceRegistryInput] =
    await Promise.all([
      readJson(KNOWLEDGE_REPOSITORY_PATH),
      readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      readJson(SOURCE_REGISTRY_PATH),
    ]);
  const manualIndex = ManualSnapshotIndexSchema.parse(manualIndexInput);
  const sourceRegistry = SourceRegistrySchema.parse(sourceRegistryInput);
  return {
    repository: KnowledgeRepositorySchema.parse(repositoryInput),
    manualInputs: await loadManualSnapshotInputs(manualIndex, sourceRegistry),
    manualIndex,
    sourceRegistry,
    characterFacts: Object.fromEntries(
      Object.entries(characterStatsInput).map(([characterId, stats]) => [
        characterId,
        { region: stats.region, weaponType: stats.weaponType },
      ]),
    ),
  };
}

function scopeInput(fixture: Fixture): KeqingLunarEquipmentScopeInput {
  return {
    repository: fixture.repository,
    manualInputs: fixture.manualInputs,
    manualIndex: fixture.manualIndex,
    sourceRegistry: fixture.sourceRegistry,
    characterFacts: fixture.characterFacts,
  };
}

function buildReport(fixture: Fixture) {
  return buildKeqingLunarEquipmentEvidenceValidationReport(
    fixture.repository,
    fixture.manualInputs,
    {
      manualIndex: fixture.manualIndex,
      sourceRegistry: fixture.sourceRegistry,
    },
    [],
    { characterFacts: fixture.characterFacts },
  );
}

function rejectionCodes(
  result: ReturnType<typeof deriveKeqingLunarEquipmentScopeCandidate>,
): string[] {
  if (result.status !== "rejected") {
    throw new Error("Expected rejected Keqing semantic-scope candidate.");
  }
  return result.issues.map(({ code }) => code);
}

function requiredSnapshotInput(
  inputs: ManualSnapshotInput[],
): ManualSnapshotInput {
  const matches = inputs.filter(
    ({ snapshotFile }) => snapshotFile.path === SNAPSHOT_PATH,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one Keqing snapshot input, found ${matches.length}.`);
  }
  return matches[0];
}

function requiredManualRecord(
  snapshot: ManualObservationSnapshot,
  sourceRecordId: string,
): Extract<
  ManualObservationSnapshot["records"][number],
  { kind: "character_guide" }
> {
  const record = snapshot.records.find(
    (candidate) =>
      candidate.kind === "character_guide" &&
      candidate.sourceRecordId === sourceRecordId,
  );
  if (!record || record.kind !== "character_guide") {
    throw new Error(`Missing manual record ${sourceRecordId}.`);
  }
  return record;
}

function requiredRepositoryRecord(
  repository: KnowledgeRepository,
  id: string,
): Extract<KnowledgeRepository["records"][number], { kind: "character_guide" }> {
  const record = repository.records.find(
    (candidate) => candidate.kind === "character_guide" && candidate.id === id,
  );
  if (!record || record.kind !== "character_guide") {
    throw new Error(`Missing repository guide ${id}.`);
  }
  return record;
}
