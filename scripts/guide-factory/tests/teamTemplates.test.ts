import { describe, expect, it } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import { consolidateKnowledge } from "../src/consolidation";
import { sha256File } from "../src/io";
import { REPOSITORY_ROOT } from "../src/paths";
import {
  GuideBuildRecommendationSchema,
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  type ManualObservationSnapshot,
  type SourceRegistry,
} from "../src/schemas";
import {
  validateKnowledgeRepository,
  validateManualObservationSnapshot,
} from "../src/validation";

const SHA256 = "0".repeat(64);
const PACKAGE_PATH = "package.json";
type ManualCharacterRoleRecord = Extract<
  ManualObservationSnapshot["records"][number],
  { kind: "character_role" }
>;

describe("guide-factory team templates", () => {
  it("models four slots with explicit alternative selector types", () => {
    const snapshot = ManualObservationSnapshotSchema.parse(manualSnapshot());
    const record = snapshot.records[0];

    expect(record?.kind).toBe("team_template");
    if (!record || record.kind !== "team_template") {
      throw new Error("Expected a team template fixture");
    }
    expect(record.slots).toHaveLength(4);
    expect(record.slots[1].options).toEqual([
      { type: "characters", characterIds: ["jean"] },
      { type: "roles", roleIds: ["team-wide-healer"] },
    ]);
    expect(record.slots[3].highlightedOptions).toEqual([
      { type: "characters", characterIds: ["escoffier"] },
      { type: "elements", elements: ["anemo"] },
      { type: "roles", roleIds: ["sustain"] },
    ]);

    const invalidElement = structuredClone(snapshot);
    const invalidRecord = invalidElement.records[0];
    if (!invalidRecord || invalidRecord.kind !== "team_template") {
      throw new Error("Expected a cloned team template fixture");
    }
    invalidRecord.slots[2].options = [
      { type: "elements", elements: ["Hydro" as "hydro"] },
    ];
    expect(
      ManualObservationSnapshotSchema.safeParse(invalidElement).success
    ).toBe(false);

    const invalidHighlight = structuredClone(snapshot);
    const invalidHighlightRecord = invalidHighlight.records[0];
    if (
      !invalidHighlightRecord ||
      invalidHighlightRecord.kind !== "team_template"
    ) {
      throw new Error("Expected a cloned team template fixture");
    }
    invalidHighlightRecord.slots[3].highlightedOptions = [
      { type: "any" } as never,
    ];
    expect(
      ManualObservationSnapshotSchema.safeParse(invalidHighlight).success
    ).toBe(false);
  });

  it("supports bounded constellation applicability", () => {
    const recommendation = {
      id: "furina-pre-c2-goblet",
      scope: "artifact-stats",
      minConstellation: 0,
      maxConstellation: 1,
      substats: [{ statIds: ["hp%"], conditions: [] }],
    };

    expect(GuideBuildRecommendationSchema.parse(recommendation)).toMatchObject({
      minConstellation: 0,
      maxConstellation: 1,
    });
    expect(
      GuideBuildRecommendationSchema.safeParse({
        ...recommendation,
        minConstellation: 2,
      }).success
    ).toBe(false);
  });

  it("validates character and reaction selectors without inventing a role catalog", async () => {
    const snapshot = ManualObservationSnapshotSchema.parse(manualSnapshot());
    const record = snapshot.records[0];
    if (!record || record.kind !== "team_template") {
      throw new Error("Expected a team template fixture");
    }
    record.slots[0].options = [
      { type: "characters", characterIds: ["unknown-character"] },
    ];
    record.slots[1].options = [
      { type: "roles", roleIds: ["source-defined-healer"] },
    ];
    record.slots[3].highlightedOptions = [
      { type: "characters", characterIds: ["unknown-highlight"] },
    ];
    record.reactions = ["unknown-reaction"];

    const diagnostics = validateManualObservationSnapshot(
      snapshot,
      await loadGameCatalogs(),
      "kqm"
    );
    expect(diagnostics.map(({ code }) => code)).toContain(
      "catalog.unknown_character"
    );
    expect(diagnostics.map(({ code }) => code)).toContain(
      "catalog.unknown_reaction"
    );
    expect(
      diagnostics.some(
        ({ code, path }) =>
          code === "catalog.unknown_character" &&
          path.includes("highlightedOptions")
      )
    ).toBe(true);
    expect(
      diagnostics.some(({ path }) => path.includes("roleIds"))
    ).toBe(false);
  });

  it("consolidates template provenance under a team-template ID", async () => {
    const fileSha256 = await sha256File(`${REPOSITORY_ROOT}/${PACKAGE_PATH}`);
    const snapshot = ManualObservationSnapshotSchema.parse(manualSnapshot());
    const repository = consolidateKnowledge({
      sourceRegistrySha256: SHA256,
      sourceRegistry: sourceRegistry(),
      genshinTools: emptyGenshinToolsSnapshot(fileSha256),
      legacy: emptyLegacySnapshot(fileSha256),
      manualSnapshots: [
        {
          expectedSourceId: "kqm",
          snapshot,
          snapshotFile: { path: PACKAGE_PATH, sha256: fileSha256 },
        },
      ],
    });
    const template = repository.records[0];
    const sourceTemplate = snapshot.records[0];
    if (!sourceTemplate || sourceTemplate.kind !== "team_template") {
      throw new Error("Expected a source team template");
    }

    expect(template).toMatchObject({
      id: "kqm:team-template:furina-hypercarry-template",
      kind: "team_template",
      status: "candidate",
      promotionEligible: false,
      unknowns: [
        "role selector matching is unresolved",
        "agent-assisted extraction has not been human-reviewed",
      ],
      sourceRefs: [
        {
          sourceId: "kqm",
          sourceRecordId: "furina-hypercarry-template",
          locator: {
            url: "https://example.com/furina",
            heading: "Teams",
          },
        },
      ],
    });
    if (!template || template.kind !== "team_template") {
      throw new Error("Expected a consolidated team template");
    }
    expect(template.slots).not.toBe(sourceTemplate.slots);
    expect(template.slots[0].options).not.toBe(
      sourceTemplate.slots[0].options
    );
    expect(template.slots[3].highlightedOptions).not.toBe(
      sourceTemplate.slots[3].highlightedOptions
    );
    expect(template.slots[3].highlightedOptions?.[0]).not.toBe(
      sourceTemplate.slots[3].highlightedOptions?.[0]
    );

    const parsedRepository = KnowledgeRepositorySchema.parse(repository);
    const parsedTemplate = parsedRepository.records[0];
    if (!parsedTemplate || parsedTemplate.kind !== "team_template") {
      throw new Error("Expected a consolidated team template");
    }
    parsedTemplate.slots[0].options = [
      { type: "characters", characterIds: ["unknown-character"] },
    ];
    parsedTemplate.reactions = ["unknown-reaction"];
    const diagnostics = validateKnowledgeRepository(parsedRepository, {
      catalogs: await loadGameCatalogs(),
      sourceRegistry: sourceRegistry(),
      genshinToolsSnapshot: emptyGenshinToolsSnapshot(fileSha256),
      legacySnapshot: emptyLegacySnapshot(fileSha256),
      manualSnapshots: [snapshot],
    });
    expect(diagnostics.map(({ code }) => code)).toContain(
      "catalog.unknown_character"
    );
    expect(diagnostics.map(({ code }) => code)).toContain(
      "catalog.unknown_reaction"
    );
  });

  it("keeps source record IDs unique across template records", async () => {
    const snapshot = manualSnapshot();
    snapshot.records.push(structuredClone(snapshot.records[0]));
    const diagnostics = validateManualObservationSnapshot(
      snapshot,
      await loadGameCatalogs(),
      "kqm"
    );

    expect(diagnostics.map(({ code }) => code)).toContain(
      "source_record.duplicate_id"
    );
  });

  it("reports duplicate source highlights without treating them as hard options", async () => {
    const snapshot = ManualObservationSnapshotSchema.parse(manualSnapshot());
    const record = snapshot.records[0];
    if (!record || record.kind !== "team_template") {
      throw new Error("Expected a team template fixture");
    }
    const highlight = record.slots[3].highlightedOptions?.[0];
    if (!highlight) throw new Error("Expected a highlighted option fixture");
    record.slots[3].highlightedOptions?.push(structuredClone(highlight));

    const diagnostics = validateManualObservationSnapshot(
      snapshot,
      await loadGameCatalogs(),
      "kqm"
    );

    expect(diagnostics.map(({ code }) => code)).toContain(
      "team_template.duplicate_highlighted_selector"
    );
    expect(diagnostics.map(({ code }) => code)).not.toContain(
      "team_template.redundant_any_selector"
    );
  });

  it("consolidates one source-scoped role observation without resolving the template globally", async () => {
    const fileSha256 = await sha256File(`${REPOSITORY_ROOT}/${PACKAGE_PATH}`);
    const snapshot = manualSnapshot();
    const sourceRole = manualCharacterRoleRecord();
    snapshot.records.push(sourceRole);

    expect(
      validateManualObservationSnapshot(
        snapshot,
        await loadGameCatalogs(),
        "kqm",
      ),
    ).toEqual([]);

    const repository = consolidateKnowledge({
      sourceRegistrySha256: SHA256,
      sourceRegistry: sourceRegistry(),
      genshinTools: emptyGenshinToolsSnapshot(fileSha256),
      legacy: emptyLegacySnapshot(fileSha256),
      manualSnapshots: [
        {
          expectedSourceId: "kqm",
          snapshot,
          snapshotFile: { path: PACKAGE_PATH, sha256: fileSha256 },
        },
      ],
    });
    const role = repository.records.find(
      (record) => record.kind === "character_role",
    );
    expect(role).toMatchObject({
      id: "kqm:character-role:furina-xilonen-healer-role",
      kind: "character_role",
      status: "candidate",
      promotionEligible: false,
      roleId: "team-wide-healer",
      appliesTo: {
        teamTemplateId: "kqm:team-template:furina-hypercarry-template",
        slotId: "healer",
      },
      members: [{ characterId: "xilonen", conditions: [] }],
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      unknowns: [
        "other source-listed healers were not captured",
        "agent-assisted extraction has not been human-reviewed",
      ],
    });
    if (!role || role.kind !== "character_role") {
      throw new Error("Expected a consolidated character-role record");
    }
    expect(role.members).not.toBe(sourceRole.members);
    expect(role.members[0]?.conditions).not.toBe(
      sourceRole.members[0]?.conditions,
    );

    expect(
      validateKnowledgeRepository(repository, {
        catalogs: await loadGameCatalogs(),
        sourceRegistry: sourceRegistry(),
        genshinToolsSnapshot: emptyGenshinToolsSnapshot(fileSha256),
        legacySnapshot: emptyLegacySnapshot(fileSha256),
        manualSnapshots: [snapshot],
      }),
    ).toEqual([]);
  });

  it("validates role member bounds, uniqueness, and catalog membership", async () => {
    const invalidBounds = manualSnapshot();
    const boundedRole = manualCharacterRoleRecord();
    boundedRole.members[0] = {
      characterId: "xilonen",
      minConstellation: 2,
      maxConstellation: 1,
      conditions: [],
    };
    invalidBounds.records.push(boundedRole);
    expect(
      ManualObservationSnapshotSchema.safeParse(invalidBounds).success,
    ).toBe(false);

    const explicitClaims = manualSnapshot();
    explicitClaims.records.push({
      ...manualCharacterRoleRecord(),
      exhaustiveness: "exhaustive",
      rankingClaim: "ordered",
    });
    expect(
      ManualObservationSnapshotSchema.safeParse(explicitClaims).success,
    ).toBe(true);

    const invalidMembers = manualSnapshot();
    const role = manualCharacterRoleRecord();
    role.members.push(
      structuredClone(role.members[0]),
      { characterId: "unknown-character", conditions: [] },
    );
    invalidMembers.records.push(role);
    const diagnostics = validateManualObservationSnapshot(
      invalidMembers,
      await loadGameCatalogs(),
      "kqm",
    );
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "character_role.duplicate_member",
        }),
        expect.objectContaining({
          severity: "warning",
          code: "catalog.unknown_character",
        }),
      ]),
    );
  });

  it("requires the scoped role to be a hard option rather than a highlight", async () => {
    const snapshot = manualSnapshot();
    const role = manualCharacterRoleRecord();
    role.roleId = "sustain";
    role.appliesTo.slotId = "flex";
    snapshot.records.push(role);

    const diagnostics = validateManualObservationSnapshot(
      snapshot,
      await loadGameCatalogs(),
      "kqm",
    );
    expect(diagnostics.map(({ code }) => code)).toContain(
      "character_role.role_not_in_hard_slot",
    );
  });

  it("rejects a role scope whose same-snapshot template target is missing", async () => {
    const snapshot = manualSnapshot();
    const role = manualCharacterRoleRecord();
    role.appliesTo.teamTemplateSourceRecordId = "missing-template";
    snapshot.records.push(role);

    const diagnostics = validateManualObservationSnapshot(
      snapshot,
      await loadGameCatalogs(),
      "kqm",
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "character_role.unknown_team_template",
        path: expect.stringContaining(
          ".appliesTo.teamTemplateSourceRecordId",
        ),
      }),
    );
  });

  it("rejects a role scope whose target record is not a template", async () => {
    const snapshot = manualSnapshot();
    const role = manualCharacterRoleRecord();
    role.appliesTo.teamTemplateSourceRecordId = role.sourceRecordId;
    snapshot.records.push(role);

    const diagnostics = validateManualObservationSnapshot(
      snapshot,
      await loadGameCatalogs(),
      "kqm",
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "character_role.scope_not_team_template",
        path: expect.stringContaining(
          ".appliesTo.teamTemplateSourceRecordId",
        ),
      }),
    );
  });

  it("rejects a role scope whose template slot is unknown", async () => {
    const snapshot = manualSnapshot();
    const role = manualCharacterRoleRecord();
    role.appliesTo.slotId = "missing-slot";
    snapshot.records.push(role);

    const diagnostics = validateManualObservationSnapshot(
      snapshot,
      await loadGameCatalogs(),
      "kqm",
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "character_role.unknown_slot",
        path: expect.stringContaining(".appliesTo.slotId"),
      }),
    );
  });

  it("rejects a consolidated role binding to a template from another source", async () => {
    const { fileSha256, repository, snapshot } =
      await consolidatedRoleFixture();
    const template = repository.records.find(
      (record) => record.kind === "team_template",
    );
    if (!template || template.kind !== "team_template") {
      throw new Error("Expected a consolidated team-template record");
    }
    template.sourceRefs = template.sourceRefs.map((reference) => ({
      ...reference,
      sourceId: "legacy-team-research",
    }));

    const diagnostics = validateKnowledgeRepository(repository, {
      catalogs: await loadGameCatalogs(),
      sourceRegistry: sourceRegistry(),
      genshinToolsSnapshot: emptyGenshinToolsSnapshot(fileSha256),
      legacySnapshot: emptyLegacySnapshot(fileSha256),
      manualSnapshots: [snapshot],
    });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "character_role.cross_source_team_template",
        path: expect.stringContaining(".appliesTo.teamTemplateId"),
      }),
    );
  });

  it("rejects a consolidated role binding to a same-source template from another page", async () => {
    const { fileSha256, repository, snapshot } =
      await consolidatedRoleFixture();
    const template = repository.records.find(
      (record) => record.kind === "team_template",
    );
    if (!template || template.kind !== "team_template") {
      throw new Error("Expected a consolidated team-template record");
    }
    template.sourceRefs = template.sourceRefs.map((reference) => ({
      ...reference,
      locator:
        "url" in reference.locator
          ? {
              ...reference.locator,
              url: "https://example.com/different-page",
            }
          : reference.locator,
    }));

    const diagnostics = validateKnowledgeRepository(repository, {
      catalogs: await loadGameCatalogs(),
      sourceRegistry: sourceRegistry(),
      genshinToolsSnapshot: emptyGenshinToolsSnapshot(fileSha256),
      legacySnapshot: emptyLegacySnapshot(fileSha256),
      manualSnapshots: [snapshot],
    });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "character_role.cross_page_team_template",
        path: expect.stringContaining(".appliesTo.teamTemplateId"),
      }),
    );
  });

  it("keeps consolidated role evidence candidate and promotion-ineligible", async () => {
    const { fileSha256, repository, snapshot } =
      await consolidatedRoleFixture();
    const role = repository.records.find(
      (record) => record.kind === "character_role",
    );
    if (!role || role.kind !== "character_role") {
      throw new Error("Expected a consolidated character-role record");
    }
    role.status = "accepted";
    role.promotionEligible = true;

    const diagnostics = validateKnowledgeRepository(repository, {
      catalogs: await loadGameCatalogs(),
      sourceRegistry: sourceRegistry(),
      genshinToolsSnapshot: emptyGenshinToolsSnapshot(fileSha256),
      legacySnapshot: emptyLegacySnapshot(fileSha256),
      manualSnapshots: [snapshot],
    });
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "character_role.invalid_status",
        }),
        expect.objectContaining({
          severity: "error",
          code: "character_role.promotion_eligible",
        }),
      ]),
    );
  });
});

function manualSnapshot(): ManualObservationSnapshot {
  return ManualObservationSnapshotSchema.parse({
    schemaVersion: 1,
    sourceId: "kqm",
    capturedAt: "2026-08-29",
    page: {
      title: "Furina Quick Guide",
      url: "https://example.com/furina",
      publisher: "KQM",
      sourceVersion: "Luna II",
      attributionNote: "Paraphrased test fixture.",
    },
    records: [
      {
        kind: "team_template",
        sourceRecordId: "furina-hypercarry-template",
        locator: {
          url: "https://example.com/furina",
          heading: "Teams",
        },
        supportingLocators: [],
        extraction: {
          method: "agent-assisted",
          reviewStatus: "unreviewed",
        },
        label: "Furina hypercarry template",
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "none",
        slots: [
          {
            id: "furina",
            options: [{ type: "characters", characterIds: ["furina"] }],
          },
          {
            id: "healer",
            options: [
              { type: "characters", characterIds: ["jean"] },
              { type: "roles", roleIds: ["team-wide-healer"] },
            ],
          },
          {
            id: "element-flex",
            options: [
              { type: "elements", elements: ["hydro", "anemo"] },
            ],
          },
          {
            id: "flex",
            options: [{ type: "any" }],
            highlightedOptions: [
              { type: "characters", characterIds: ["escoffier"] },
              { type: "elements", elements: ["anemo"] },
              { type: "roles", roleIds: ["sustain"] },
            ],
          },
        ],
        reactions: ["vaporize"],
        unknowns: ["role selector matching is unresolved"],
      },
    ],
  });
}

function manualCharacterRoleRecord(): ManualCharacterRoleRecord {
  return {
    kind: "character_role",
    sourceRecordId: "furina-xilonen-healer-role",
    locator: {
      url: "https://example.com/furina",
      heading: "Notable teammates > Xilonen",
    },
    supportingLocators: [],
    extraction: {
      method: "agent-assisted",
      reviewStatus: "unreviewed",
    },
    roleId: "team-wide-healer",
    appliesTo: {
      teamTemplateSourceRecordId: "furina-hypercarry-template",
      slotId: "healer",
    },
    members: [{ characterId: "xilonen", conditions: [] }],
    exhaustiveness: "non-exhaustive",
    rankingClaim: "none",
    unknowns: ["other source-listed healers were not captured"],
  };
}

async function consolidatedRoleFixture() {
  const fileSha256 = await sha256File(`${REPOSITORY_ROOT}/${PACKAGE_PATH}`);
  const snapshot = manualSnapshot();
  snapshot.records.push(manualCharacterRoleRecord());
  const repository = consolidateKnowledge({
    sourceRegistrySha256: SHA256,
    sourceRegistry: sourceRegistry(),
    genshinTools: emptyGenshinToolsSnapshot(fileSha256),
    legacy: emptyLegacySnapshot(fileSha256),
    manualSnapshots: [
      {
        expectedSourceId: "kqm",
        snapshot,
        snapshotFile: { path: PACKAGE_PATH, sha256: fileSha256 },
      },
    ],
  });
  return { fileSha256, repository, snapshot };
}

function emptyGenshinToolsSnapshot(sha256: string) {
  return {
    schemaVersion: 1 as const,
    sourceId: "genshintools-presets" as const,
    capturedAt: "2026-08-29",
    sourceRevision: { files: [{ path: PACKAGE_PATH, sha256 }] },
    teams: [],
    characterGuides: [],
  };
}

function emptyLegacySnapshot(sha256: string) {
  return {
    schemaVersion: 1 as const,
    sourceId: "legacy-team-research" as const,
    capturedAt: "2026-08-29",
    sourceRevision: { files: [{ path: PACKAGE_PATH, sha256 }] },
    upstreamDomains: [],
    records: [],
  };
}

function sourceRegistry(): SourceRegistry {
  return {
    schemaVersion: 1,
    sources: [
      {
        id: "genshintools-presets",
        name: "GenshinTools presets",
        homepage: null,
        kind: "internal",
        status: "active",
        ingestionMode: "internal-adapter",
        permission: "internal",
        recordFormat: "genshintools-presets-v1",
        checkedAt: "2026-08-29",
        notes: [],
      },
      {
        id: "legacy-team-research",
        name: "Legacy research",
        homepage: null,
        kind: "internal",
        status: "active",
        ingestionMode: "internal-adapter",
        permission: "internal",
        recordFormat: "legacy-team-research-v1",
        checkedAt: "2026-08-29",
        notes: [],
      },
      {
        id: "kqm",
        name: "KQM",
        homepage: "https://example.com",
        kind: "editorial",
        status: "active",
        ingestionMode: "manual-observation",
        permission: "mixed",
        recordFormat: "manual-observation-v1",
        checkedAt: "2026-08-29",
        notes: [],
      },
    ],
  };
}
