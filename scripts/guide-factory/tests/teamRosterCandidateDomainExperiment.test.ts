import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
} from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";
import type { TeamRosterCandidateTemplateReport } from "../src/teamRosterCandidateDomain";
import {
  buildTeamRosterCandidateDomainExperimentFixture,
  runTeamRosterCandidateDomainExperiment,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS,
  TEAM_ROSTER_CANDIDATE_DOMAIN_TEMPLATE_IDS,
} from "../src/teamRosterCandidateDomainExperiment";

const ELECTRO_CHARGED_TEMPLATE_ID =
  "kqm:team-template:furina-team-template-electro-charged";
const FREEZE_TEMPLATE_ID = "kqm:team-template:furina-team-template-freeze";
const QUICKBLOOM_TEMPLATE_ID =
  "kqm:team-template:furina-team-template-quickbloom";
const VAPORIZE_TEMPLATE_ID =
  "kqm:team-template:furina-team-template-vaporize";

describe("team-roster candidate-domain experiment", () => {
  it("builds the bounded real domain deterministically without recommendation claims", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const fixture =
      await buildTeamRosterCandidateDomainExperimentFixture(repository);

    expect(fixture.coreInput.templates.map(({ id }) => id)).toEqual(
      TEAM_ROSTER_CANDIDATE_DOMAIN_TEMPLATE_IDS,
    );
    expect(fixture.templateBoundary).toMatchObject({
      selectedTemplateCount: 6,
      roleSelectorPolicy:
        "withhold-template-if-any-slot-option-is-unresolved-role",
      highlightedOptionsPolicy: "annotation-only",
      expectedRoleSelectorWithheldTemplateIds: [
        "kqm:team-template:furina-team-template-hypercarry-mono",
        "kqm:team-template:keqing-team-template-lunar-charged",
      ],
      repositoryRoleSelectorTemplateIds: [
        "kqm:team-template:furina-team-template-hypercarry-mono",
        "kqm:team-template:keqing-team-template-lunar-charged",
      ],
    });
    expect(fixture.releasedCatalogBoundary).toMatchObject({
      source: "stable-resources",
      fullStableCharacterCount: 139,
      eligibleCharacterCount: 125,
      excludedSpecialAvatarForms: { count: 14 },
    });
    expect(fixture.coreInput.releasedCharacters).toHaveLength(125);
    expect(
      fixture.coreInput.releasedCharacters.some(({ characterId }) =>
        /^(?:manekin|manekina)_/.test(characterId),
      ),
    ).toBe(false);
    const travelers = fixture.coreInput.releasedCharacters.filter(
      ({ characterId }) => characterId.startsWith("traveler_"),
    );
    expect(travelers).toHaveLength(7);
    expect(
      new Set(travelers.map(({ playableIdentityId }) => playableIdentityId)),
    ).toEqual(new Set(["traveler"]));

    const generatedFrom = await hashInputs();
    const report = await runTeamRosterCandidateDomainExperiment(
      repository,
      generatedFrom,
    );
    const repeated = await runTeamRosterCandidateDomainExperiment(
      repository,
      generatedFrom,
    );
    const durable = await readJson(
      TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
    );

    expect(repeated).toEqual(report);
    expect(durable).toEqual(report);
    expect(report.comparisonStatus).toBe("comparable");
    expect(
      report.templateBoundary.roleSelectorWithholdingMatchesExpectation,
    ).toBe(true);
    expect(new Set(report.generatedFrom.map(({ path }) => path)).size).toBe(
      report.generatedFrom.length,
    );
    expect(report.domain.failures).toEqual([]);
    expect(report.domain.allHoldoutsMatch).toBe(true);
    expect(report.validationEvidenceBoundary.allTargetsMatch).toBe(true);
    expect(report.releasedCatalogBoundary).toMatchObject({
      fullStableCharacterCount: 139,
      eligibleCharacterCount: 125,
    });
    expect(report.domain.catalogBoundary).toMatchObject({
      characterCount: 125,
      characterIdsSha256:
        "070e664f88275374348f80e340b2ac1515ed5abe4a0b24029d84baa843f2b87f",
      playableIdentityCount: 119,
    });
    expect(report.domain.catalogBoundary.sharedPlayableIdentityGroups).toEqual([
      {
        playableIdentityId: "traveler",
        characterIds: [
          "traveler_anemo",
          "traveler_cryo",
          "traveler_dendro",
          "traveler_electro",
          "traveler_geo",
          "traveler_hydro",
          "traveler_pyro",
        ],
      },
    ]);

    expect(
      report.domain.templates.map(({ templateId, status }) => ({
        templateId,
        status,
      })),
    ).toEqual([
      { templateId: ELECTRO_CHARGED_TEMPLATE_ID, status: "comparable" },
      { templateId: FREEZE_TEMPLATE_ID, status: "comparable" },
      {
        templateId:
          "kqm:team-template:furina-team-template-hypercarry-mono",
        status: "withheld-unresolved-role",
      },
      { templateId: QUICKBLOOM_TEMPLATE_ID, status: "comparable" },
      { templateId: VAPORIZE_TEMPLATE_ID, status: "comparable" },
      {
        templateId: "kqm:team-template:keqing-team-template-lunar-charged",
        status: "withheld-unresolved-role",
      },
    ]);

    expectTemplateCounts(template(report, ELECTRO_CHARGED_TEMPLATE_ID), {
      validOrdered: 84_846,
      rejectedOrdered: 16_811,
      acceptedOrdered: 68_035,
      acceptedCanonical: 41_866,
      acceptedSha256:
        "4d66f3bb35094bcd58d8de54519ffb19c12d9ffaaf3063fb9255154a05c31d37",
    });
    expectTemplateCounts(template(report, FREEZE_TEMPLATE_ID), {
      validOrdered: 98_718,
      rejectedOrdered: 0,
      acceptedOrdered: 98_718,
      acceptedCanonical: 57_607,
      acceptedSha256:
        "9db83c959d91bbe0d952c5fed76798c02ff8ec82aca3b963f18eeb6b23fd8db7",
    });
    expectTemplateCounts(template(report, QUICKBLOOM_TEMPLATE_ID), {
      validOrdered: 31_412,
      rejectedOrdered: 0,
      acceptedOrdered: 31_412,
      acceptedCanonical: 27_413,
      acceptedSha256:
        "ca46c4eae8fa5caa01e095bb78c8279f4c330c64ac80c4b47f21fa15ec328a9b",
    });
    expect(
      template(report, QUICKBLOOM_TEMPLATE_ID).assignmentMultiplicityHistogram,
    ).toContainEqual({ assignmentCount: 2, rosterCount: 3_999 });
    expectTemplateCounts(template(report, VAPORIZE_TEMPLATE_ID), {
      validOrdered: 124_292,
      rejectedOrdered: 0,
      acceptedOrdered: 124_292,
      acceptedCanonical: 77_477,
      acceptedSha256:
        "34c96c4bb3df24c69f71a1a074defe1e959dbd1872f8dce6e146b18447e83e1e",
    });

    expect(report.domain.holdouts).toHaveLength(20);
    expect(
      report.domain.holdouts.every(
        ({ matchesExpectation }) => matchesExpectation,
      ),
    ).toBe(true);
    expect(
      report.domain.holdouts.every(
        ({ bindingMultiplicityMatchesExpectation }) =>
          bindingMultiplicityMatchesExpectation === true,
      ),
    ).toBe(true);
    expect(report.validationEvidenceBoundary).toMatchObject({
      targetAssociationCount: 20,
      uniqueRepositoryTeamRecordCount: 19,
      samePageAuthoredDomainChecks: {
        targetCount: 2,
        uniqueRepositoryTeamRecordCount: 2,
      },
      crossSourceInternalBaselineOverlap: {
        targetCount: 17,
        uniqueRepositoryTeamRecordCount: 16,
      },
      explicitRuntimeGateNegatives: {
        targetCount: 2,
        uniqueRepositoryTeamRecordCount: 2,
      },
      baselineOverlapCompletenessAgainstCurrentTemplateCoverage: true,
      independentGameplayValidation: {
        status: "not-supplied",
        targetCount: 0,
        supportsGameplayValidation: false,
      },
      recordedReactionRelationships: {
        "aligned-with-template": { targetCount: 14 },
        "different-from-template": { targetCount: 4 },
        "not-recorded": { targetCount: 2 },
      },
    });
    const negativeOutcomes = report.domain.holdouts.filter(
      ({ expectedOutcome }) => expectedOutcome === "reaction-rejected",
    );
    expect(negativeOutcomes).toHaveLength(2);
    expect(
      negativeOutcomes.map(
        ({ actualOutcome, structuralMembership, acceptedMembership }) => ({
          actualOutcome,
          structuralMembership,
          acceptedMembership,
        }),
      ),
    ).toEqual([
      {
        actualOutcome: "reaction-rejected",
        structuralMembership: true,
        acceptedMembership: false,
      },
      {
        actualOutcome: "reaction-rejected",
        structuralMembership: true,
        acceptedMembership: false,
      },
    ]);
    const boundTargets = report.domain.holdouts.filter(
      ({ sourceSlotBinding }) => sourceSlotBinding !== null,
    );
    expect(boundTargets).toHaveLength(3);
    expect(
      boundTargets.every(
        ({ sourceSlotBindingMembership }) => sourceSlotBindingMembership,
      ),
    ).toBe(true);
    expect(
      boundTargets.map(({ targetId, sourceSlotBindingBasis }) => ({
        targetId,
        sourceSlotBindingBasis,
      })),
    ).toEqual([
      {
        targetId:
          "runtime-negative:keqing-ineffa-furina-xilonen-as-electro-charged",
        sourceSlotBindingBasis: "cross-page-audit-fit",
      },
      {
        targetId: "same-page:furina-alhaitham-shinobu-nahida-quickbloom",
        sourceSlotBindingBasis: "same-page-inferred-fit",
      },
      {
        targetId: "same-page:furina-nahida-cyno-baizhu-quickbloom",
        sourceSlotBindingBasis: "same-page-inferred-fit",
      },
    ]);

    expect(report).toMatchObject({
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsRankClaims: false,
      supportsGameplayValidation: false,
      energyRecoveryInputsUsed: false,
    });
    expect(report.domain.claimFlags).toEqual({
      supportsRanking: false,
      supportsRecommendation: false,
      supportsDamageComparison: false,
      supportsOptimality: false,
      supportsIndependentGameplayValidation: false,
      usesEnergyRecovery: false,
    });
    const serialized = stableJson(report);
    expect(serialized).not.toContain('"candidateRosters"');
    expect(serialized).not.toContain('"rankings"');
    expect(serialized.length).toBeLessThan(60_000);
    expect(
      report.domain.templates.every((entry) =>
        entry.slotPools.every((slot) => !("resolvedCharacterIds" in slot)),
      ),
    ).toBe(true);
  });

  it("fails closed when runtime reaction-gate preparation or evaluation fails", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    let prepareFailureEvaluateCalls = 0;
    const prepareFailure = await runTeamRosterCandidateDomainExperiment(
      repository,
      [],
      {
        prepare: async () => {
          throw new Error("injected preparation failure");
        },
        evaluate: () => {
          prepareFailureEvaluateCalls += 1;
          return { accepted: true, byReaction: {} };
        },
      },
    );

    expect(prepareFailureEvaluateCalls).toBe(0);
    expect(prepareFailure.comparisonStatus).toBe("not-comparable");
    expect(prepareFailure.domain.allHoldoutsMatch).toBe(false);
    expect(prepareFailure.validationEvidenceBoundary.allTargetsMatch).toBe(
      false,
    );
    expect(
      prepareFailure.domain.templates.filter(
        ({ status }) => status === "not-comparable",
      ),
    ).toHaveLength(4);
    expect(prepareFailure.domain.failures).toContainEqual(
      expect.objectContaining({ code: "reaction-gate-prepare-failed" }),
    );

    let evaluationCalls = 0;
    const evaluationFailure = await runTeamRosterCandidateDomainExperiment(
      repository,
      [],
      {
        evaluate: () => {
          evaluationCalls += 1;
          throw new Error("injected evaluation failure");
        },
      },
    );
    expect(evaluationCalls).toBe(4);
    expect(evaluationFailure.comparisonStatus).toBe("not-comparable");
    expect(evaluationFailure.domain.allHoldoutsMatch).toBe(false);
    expect(
      evaluationFailure.domain.templates.filter(
        ({ status }) => status === "not-comparable",
      ),
    ).toHaveLength(4);
    expect(evaluationFailure.domain.failures).toContainEqual(
      expect.objectContaining({ code: "reaction-gate-evaluate-failed" }),
    );
  });
});

function template(
  report: Awaited<ReturnType<typeof runTeamRosterCandidateDomainExperiment>>,
  templateId: string,
): TeamRosterCandidateTemplateReport {
  const found = report.domain.templates.find(
    (entry) => entry.templateId === templateId,
  );
  if (!found) throw new Error(`Missing template report ${templateId}.`);
  return found;
}

function expectTemplateCounts(
  report: TeamRosterCandidateTemplateReport,
  expected: {
    validOrdered: number;
    rejectedOrdered: number;
    acceptedOrdered: number;
    acceptedCanonical: number;
    acceptedSha256: string;
  },
): void {
  expect(report.status).toBe("comparable");
  expect(report.validOrderedAssignmentCount).toBe(expected.validOrdered);
  expect(report.reactionGate).toMatchObject({
    status: "completed",
    rejectedOrderedAssignmentCount: expected.rejectedOrdered,
    acceptedOrderedAssignmentCount: expected.acceptedOrdered,
    acceptedCanonicalRosterCount: expected.acceptedCanonical,
  });
  expect(report.reactionAcceptedDomainSha256).toBe(expected.acceptedSha256);
}

async function hashInputs(): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  );
}
