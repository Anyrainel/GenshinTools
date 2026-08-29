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
