import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  buildKeqingIneffaArtifactGenerationPreflightReport,
  KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS,
} from "../src/keqingIneffaArtifactGenerationPreflight";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";

describe("Keqing-Ineffa artifact-generation preflight fixture", () => {
  it("passes equipment gates but refuses a reviewed generator experiment", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const before = structuredClone(repository);
    const report = await buildKeqingIneffaArtifactGenerationPreflightReport(
      repository,
      [],
    );

    expect(report).toMatchObject({
      classification: "artifact-generation-experiment-preflight",
      supportsGuideClaims: false,
      equipmentReadyForTechnicalProbe: true,
      readyForReviewedGeneratorExperiment: false,
      readyForGenerator: false,
      gates: {
        uniqueTeamCharacters: true,
        equipmentComplete: true,
        fixtureEvidenceConsistent: true,
        refinementsResolved: true,
        exactCandidatePairs: true,
        nativeTypesCompatible: true,
        artifactsInitiallyEnumerated: true,
        formulaDraftMatchesResolvedFixture: true,
        formulaPlanSourceMatches: true,
        formulaReadinessMatchesDraft: true,
        formulaPlanReady: false,
      },
      formulaDraftBinding: {
        assumptionClassification:
          "calculator-fixture-experiment-assumptions",
      },
      formulaReadiness: {
        reviewStatus: "unreviewed",
        readyForDamageReplay: false,
      },
    });
    expect(report.members).toHaveLength(4);
    expect(
      report.members.map(({ characterId, weapon }) => ({
        characterId,
        refinement: weapon.experimentRefinement,
        origin: weapon.refinementOrigin,
      })),
    ).toEqual([
      { characterId: "keqing", refinement: 1, origin: "experiment-policy" },
      { characterId: "ineffa", refinement: 1, origin: "experiment-policy" },
      { characterId: "furina", refinement: 1, origin: "experiment-policy" },
      { characterId: "xilonen", refinement: 1, origin: "experiment-policy" },
    ]);
    expect(report.blockers.map(({ code }) => code)).toEqual([
      "formula-plan-not-ready",
    ]);
    expect(repository).toEqual(before);
  });

  it("keeps the durable report byte-stable with current inputs", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const generatedFrom = await Promise.all(
      KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    );
    const expected = await buildKeqingIneffaArtifactGenerationPreflightReport(
      repository,
      generatedFrom,
    );
    const saved = await readFile(
      KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_REPORT_PATH,
      "utf8",
    );

    expect(saved).toBe(stableJson(expected));
  });
});
