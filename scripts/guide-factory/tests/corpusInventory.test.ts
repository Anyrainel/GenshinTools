import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildKnowledgeCorpusInventoryReport,
  KNOWLEDGE_CORPUS_INVENTORY_INPUT_PATHS,
  type CorpusInventoryEvidenceCounts,
} from "../src/corpusInventory";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
} from "../src/paths";
import {
  KnowledgeRepositorySchema,
  SourceRegistrySchema,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type SourceRegistry,
} from "../src/schemas";

describe("knowledge corpus inventory", () => {
  it("keeps the durable report byte-stable with current inputs", async () => {
    const { repository, registry } = await loadInputs();
    const generatedFrom = await Promise.all(
      KNOWLEDGE_CORPUS_INVENTORY_INPUT_PATHS.map(async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      })),
    );
    const expected = buildKnowledgeCorpusInventoryReport(
      repository,
      registry,
      generatedFrom,
    );
    const saved = await readFile(KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH, "utf8");

    expect(saved).toBe(stableJson(expected));
  });

  it("is deterministic and keeps presence separate from quality", async () => {
    const { repository, registry } = await loadInputs();
    const first = buildKnowledgeCorpusInventoryReport(repository, registry, []);
    const second = buildKnowledgeCorpusInventoryReport(repository, registry, []);

    expect(stableJson(first)).toBe(stableJson(second));
    expect(first.schemaVersion).toBe(2);
    expect(first.classification).toBe("descriptive-inventory");
    expect(first.supportsGuideClaims).toBe(false);
    expect(first.prohibitedInterpretations).toEqual([
      "quality-score",
      "recommendation",
      "source-vote",
      "source-average",
      "ranking",
    ]);
    expect(first.totals.records).toBe(repository.records.length);
    expect(sumValues(first.totals.byKind)).toBe(first.totals.records);
    expect(sumValues(first.totals.byStatus)).toBe(first.totals.records);
    expect(first.sources.map(({ sourceId }) => sourceId)).toEqual(
      first.sources.map(({ sourceId }) => sourceId).sort(),
    );
    expect(first.characters.map(({ characterId }) => characterId)).toEqual(
      first.characters.map(({ characterId }) => characterId).sort(),
    );

    const furina = first.characters.find(
      ({ characterId }) => characterId === "furina",
    );
    expect(furina).toMatchObject({
      presence: "both",
      baseline: { sourceIds: ["genshintools-presets"] },
      externalEditorial: { sourceIds: ["kqm"] },
    });
    expect(furina?.baseline.recordCount).toBeGreaterThan(0);
    expect(furina?.externalEditorial.recordCount).toBeGreaterThan(0);
  });

  it("counts one multi-source record once overall and once per attributed source", async () => {
    const { repository, registry } = await loadInputs();
    const sourceTeam = repository.records.find(
      (record) => record.kind === "team" && record.status === "baseline",
    );
    if (!sourceTeam) throw new Error("Missing baseline team fixture.");

    const record = structuredClone(sourceTeam);
    record.sourceRefs.push({
      sourceId: "kqm",
      sourceRecordId: "synthetic-shared-record",
      locator: { url: "https://example.invalid/shared" },
    });
    const syntheticRepository: KnowledgeRepository = {
      ...repository,
      generatedFrom: repository.generatedFrom.filter(({ sourceId }) =>
        ["genshintools-presets", "kqm"].includes(sourceId),
      ),
      records: [record],
    };

    const report = buildKnowledgeCorpusInventoryReport(
      syntheticRepository,
      registry,
      [],
    );
    expect(report.totals.records).toBe(1);
    expect(report.totals.sourceAttributedRecords).toBe(2);
    expect(
      report.sources.find(({ sourceId }) => sourceId === "genshintools-presets")
        ?.records,
    ).toBe(1);
    expect(
      report.sources.find(({ sourceId }) => sourceId === "kqm")?.records,
    ).toBe(1);
  });

  it("reports energy records by kind and status without counting ER evidence", async () => {
    const { repository, registry } = await loadInputs();
    const energyRecord = repository.records.find(
      (record) => record.kind === "energy_guidance",
    );
    if (!energyRecord) throw new Error("Missing energy-guidance fixture.");

    const energyOnlyRepository: KnowledgeRepository = {
      ...repository,
      generatedFrom: repository.generatedFrom.filter(
        ({ sourceId }) => sourceId === energyRecord.sourceRefs[0]?.sourceId,
      ),
      records: [energyRecord],
    };
    const report = buildKnowledgeCorpusInventoryReport(
      energyOnlyRepository,
      registry,
      [],
    );

    expect(report.totals).toMatchObject({
      records: 1,
      byKind: { energy_guidance: 1 },
      byStatus: { candidate: 1 },
      evidence: emptyEvidence(),
    });
    expect(report.characters).toEqual([]);
    expect(report.definitions.erExclusion).toContain(
      "do not contribute to evidence",
    );
  });

  it("does not expand element, role, or any template selectors into characters", async () => {
    const { repository, registry } = await loadInputs();
    const template = repository.records.find(
      (record) => record.kind === "team_template",
    );
    if (!template) throw new Error("Missing team-template fixture.");

    const templateOnlyRepository: KnowledgeRepository = {
      ...repository,
      generatedFrom: repository.generatedFrom.filter(
        ({ sourceId }) => sourceId === template.sourceRefs[0]?.sourceId,
      ),
      records: [template],
    };
    const report = buildKnowledgeCorpusInventoryReport(
      templateOnlyRepository,
      registry,
      [],
    );
    const explicitIds = template.slots.flatMap((slot) =>
      slot.options.flatMap((option) =>
        option.type === "characters" ? option.characterIds : [],
      ),
    );

    expect(report.totals.evidence.teamTemplateRecords).toBe(1);
    expect(report.totals.evidence.exactTeamRecords).toBe(0);
    expect(report.characters.map(({ characterId }) => characterId)).toEqual(
      [...new Set(explicitIds)].sort(),
    );
  });

  it("inventories named role members without counting them as build evidence", async () => {
    const { repository, registry } = await loadInputs();
    const role: Extract<KnowledgeRecord, { kind: "character_role" }> = {
      id: "kqm:character-role:synthetic-xilonen-healer",
      kind: "character_role",
      status: "candidate",
      promotionEligible: false,
      roleId: "healer",
      appliesTo: {
        teamTemplateId:
          "kqm:team-template:furina-team-template-hypercarry-mono",
        slotId: "healer",
      },
      members: [{ characterId: "xilonen", conditions: [] }],
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      sourceRefs: [
        {
          sourceId: "kqm",
          sourceRecordId: "synthetic-xilonen-healer",
          locator: {
            url: "https://keqingmains.com/q/furina-quickguide/",
            heading: "Teams > Notable Teammates",
          },
        },
      ],
      unknowns: [],
    };
    const roleOnlyRepository: KnowledgeRepository = {
      ...repository,
      generatedFrom: repository.generatedFrom.filter(
        ({ sourceId }) => sourceId === "kqm",
      ),
      records: [role],
    };
    const report = buildKnowledgeCorpusInventoryReport(
      roleOnlyRepository,
      registry,
      [],
    );

    expect(report.totals).toMatchObject({
      records: 1,
      byKind: { character_role: 1 },
      evidence: emptyEvidence(),
    });
    expect(report.characters).toEqual([
      expect.objectContaining({
        characterId: "xilonen",
        presence: "external-only",
        externalEditorial: { recordCount: 1, sourceIds: ["kqm"] },
      }),
    ]);
  });

  it("counts coupled artifact-plan assignments as explicit artifact evidence", async () => {
    const { repository, registry } = await loadInputs();
    const team = repository.records.find(
      ({ id }) =>
        id ===
        "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example",
    );
    if (!team || team.kind !== "team") {
      throw new Error("Missing Kokomi coupled artifact-plan fixture.");
    }
    const sourceId = team.sourceRefs[0]?.sourceId;
    if (!sourceId) throw new Error("Kokomi team has no source attribution.");
    const teamOnlyRepository: KnowledgeRepository = {
      ...repository,
      generatedFrom: repository.generatedFrom.filter(
        (generated) => generated.sourceId === sourceId,
      ),
      records: [team],
    };
    const report = buildKnowledgeCorpusInventoryReport(
      teamOnlyRepository,
      registry,
      [],
    );
    const memberArtifactOccurrences = team.members.reduce(
      (memberTotal, member) =>
        memberTotal +
        (member.selectedArtifact == null ? 0 : 1) +
        (member.artifactRecommendations?.reduce(
          (groupTotal, group) => groupTotal + group.artifacts.length,
          0,
        ) ?? 0),
      0,
    );
    const planAssignmentOccurrences =
      team.artifactPlans?.reduce(
        (planTotal, plan) => planTotal + plan.assignments.length,
        0,
      ) ?? 0;

    expect(planAssignmentOccurrences).toBe(2);
    expect(report.totals.evidence).toMatchObject({
      recordsWithArtifacts: 1,
      artifactChoiceOccurrences:
        memberArtifactOccurrences + planAssignmentOccurrences,
    });
  });
});

async function loadInputs(): Promise<{
  repository: KnowledgeRepository;
  registry: SourceRegistry;
}> {
  const [repositoryInput, registryInput] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(SOURCE_REGISTRY_PATH),
  ]);
  return {
    repository: KnowledgeRepositorySchema.parse(repositoryInput),
    registry: SourceRegistrySchema.parse(registryInput),
  };
}

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function emptyEvidence(): CorpusInventoryEvidenceCounts {
  return {
    recordsWithWeapons: 0,
    weaponIdOccurrences: 0,
    recordsWithArtifacts: 0,
    artifactChoiceOccurrences: 0,
    recordsWithMainStats: 0,
    mainStatGroups: 0,
    mainStatIdOccurrences: 0,
    recordsWithSubstats: 0,
    substatGroups: 0,
    substatIdOccurrences: 0,
    exactTeamRecords: 0,
    teamTemplateRecords: 0,
    exactTeamRecordsWithRotations: 0,
    exactTeamRotationEntries: 0,
  };
}
