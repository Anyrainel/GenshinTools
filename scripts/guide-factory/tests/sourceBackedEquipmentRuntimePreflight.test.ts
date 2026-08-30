import { describe, expect, it } from "vitest";
import { sha256Text, stableJson } from "../src/io";
import {
  buildSourceBackedEquipmentRuntimePreflight,
  isCompleteSourceBackedEquipmentRuntimePreflightReport,
  requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport,
  type SourceBackedEquipmentRuntimeObjectiveEnvelope,
  type SourceBackedEquipmentRuntimeOccurrenceResolution,
  type SourceBackedEquipmentRuntimePreflightEnvironment,
  type SourceBackedEquipmentRuntimePreflightInput,
  type SourceBackedEquipmentRuntimePreflightReport,
} from "../src/sourceBackedEquipmentRuntimePreflight";
import {
  buildSourceBackedEquipmentCandidateLattice,
  isCompleteSourceBackedEquipmentCandidateLattice,
  type SourceBackedEquipmentAxis,
  type SourceBackedEquipmentCandidateLatticeReport,
  type SourceBackedEquipmentJsonValue,
} from "../src/sourceBackedEquipmentCandidateLattice";

type SyntheticPayload = {
  [key: string]: SourceBackedEquipmentJsonValue;
  equipmentId: string;
  refinement: number | null;
  artifactType: "4pc" | null;
};

const MEMBERS = ["keqing", "ineffa", "furina", "xilonen"].map(
  (characterId) => ({
    teamMemberId: `member:${characterId}`,
    characterId,
  }),
);

const AXIS_SPECS = [
  {
    characterId: "keqing",
    equipmentKind: "weapon" as const,
    equipment: [
      { id: "lions_roar", refinement: 5 },
      { id: "the_black_sword", refinement: 5 },
      { id: "wolffang", refinement: 5 },
    ],
  },
  {
    characterId: "keqing",
    equipmentKind: "artifact" as const,
    equipment: [
      { id: "thundering_fury", refinement: null },
      { id: "gilded_dreams", refinement: null },
    ],
  },
  {
    characterId: "ineffa",
    equipmentKind: "weapon" as const,
    equipment: [{ id: "fractured_halo", refinement: 1 }],
  },
  {
    characterId: "ineffa",
    equipmentKind: "artifact" as const,
    equipment: [
      { id: "aubade_of_morningstar_and_moon", refinement: null },
    ],
  },
  {
    characterId: "furina",
    equipmentKind: "weapon" as const,
    equipment: [
      { id: "freedomsworn", refinement: 1 },
      { id: "key_of_khajnisut", refinement: 1 },
      { id: "splendor_of_tranquil_waters", refinement: 1 },
    ],
  },
  {
    characterId: "furina",
    equipmentKind: "artifact" as const,
    equipment: [
      { id: "golden_troupe", refinement: null },
      { id: "tenacity_of_the_millelith", refinement: null },
    ],
  },
  {
    characterId: "xilonen",
    equipmentKind: "weapon" as const,
    equipment: [{ id: "peak_patrol_song", refinement: 1 }],
  },
  {
    characterId: "xilonen",
    equipmentKind: "artifact" as const,
    equipment: [
      { id: "scroll_of_the_hero_of_cinder_city", refinement: null },
    ],
  },
] as const;

const OBJECTIVE_LINES = [
  { characterId: "furina", count: 1, formulaId: "furina-burst" },
  { characterId: "furina", count: 1, formulaId: "furina-skill-bubble" },
  { characterId: "ineffa", count: 1, formulaId: "ineffa-burst" },
  { characterId: "ineffa", count: 1, formulaId: "ineffa-skill-initial" },
  { characterId: "keqing", count: 1, formulaId: "keqing-burst" },
  { characterId: "keqing", count: 8, formulaId: "keqing-charged" },
  { characterId: "keqing", count: 2, formulaId: "keqing-skill-slash" },
  { characterId: "keqing", count: 2, formulaId: "keqing-stiletto" },
  { characterId: "xilonen", count: 2, formulaId: "xilonen-e-rush" },
  { characterId: "xilonen", count: 2, formulaId: "xilonen-normal-2" },
  { characterId: "xilonen", count: 1, formulaId: "xilonen-q-initial" },
] as const;

const EXPECTED_OBJECTIVE_SHA256 =
  "cb0f071bd5151936f010b3cbbcc6582233b0ae08f2aace0df654f2f58afe060a";

describe("source-backed equipment runtime materialization preflight", () => {
  it("materializes all 36 nodes with exact configs and formula coverage but preserves source non-readiness", async () => {
    const input = buildInput();
    const before = structuredClone(input);
    const report = await buildSourceBackedEquipmentRuntimePreflight(input);

    expect(sha256Text(stableJson(OBJECTIVE_LINES))).toBe(
      EXPECTED_OBJECTIVE_SHA256,
    );
    expect(report).toMatchObject({
      validationStatus: "materialized-objective-not-ready",
      comparisonStatus: "not-run",
      supportsGuideClaims: false,
      supportsEquipmentRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsOptimality: false,
      supportsEnergyRequirements: false,
      energyRecoveryInputsUsed: false,
      inputBoundary: {
        latticeComplete: true,
        memberCount: 4,
        axisCount: 8,
        expectedCombinationCount: "36",
        maximumCombinationCount: "36",
        latticeNodeCount: 36,
        callerExpectedNodeCount: "36",
        occurrenceResolutionCount: 14,
        exactOccurrenceResolutionClosure: true,
      },
      objectiveBoundary: {
        formulaLineHashMatches: true,
        sourceBindingEstablishedByCore: false,
        sourceReadyForEvaluation: false,
        envelope: {
          expectedFormulaLineCount: 11,
          formulaLinesSha256: EXPECTED_OBJECTIVE_SHA256,
          reviewStatus: "unreviewed",
          sourceBindingEstablishedByCaller: true,
          sourceReadiness: {
            readyForDamageReplay: false,
          },
        },
      },
      execution: {
        scheduling: "sequential",
        environmentId: "existing-team-build-runtime-v1",
        bootstrapCalls: 1,
        plannedMaterializationCount: 36,
        observedMaterializationCalls: 36,
        freshTeamBuildCount: 36,
        materializedNodeCount: 36,
        runtimeReadyNodeCount: 36,
        evaluatorReadyNodeCount: 0,
        objectiveFormulaAvailabilityChecks: 396,
        unresolvedFormulaReferenceAvailabilityChecks: 180,
        generatorCalls: 0,
        replayCalls: 0,
        damageEvaluationCalls: 0,
        scoringCalls: 0,
        rankingCalls: 0,
        energyRecoveryCalls: 0,
      },
    });
    expect(report.objectiveBoundary.blockers).toHaveLength(8);
    expect(report.objectiveBoundary.blockers.map(({ code }) => code)).toEqual([
      "translation-unreviewed",
      "partial-token-mapping",
      ...Array(5).fill("unresolved-formula-mapping"),
      "unresolved-source-token",
    ]);
    expect(report.nodes).toHaveLength(36);
    expect(
      report.nodes.every(
        (node) =>
          node.materializationStatus === "materialized" &&
          node.runtimeReady &&
          !node.readyForEvaluator &&
          node.selections.length === 8 &&
          node.resolvedEquipment?.length === 4 &&
          node.materializedConfigs?.length === 4 &&
          node.objectiveFormulaCoverage.length === 11 &&
          node.objectiveFormulaCoverage.every(({ available }) => available) &&
          node.unresolvedFormulaReferenceCoverage.length === 5 &&
          node.unresolvedFormulaReferenceCoverage.every(
            ({ available }) => available,
          ) &&
          node.blockers.length === 8,
      ),
    ).toBe(true);
    expect(report.nodes[0].materializedConfigs).toEqual([
      expect.objectContaining({
        charId: "keqing",
        weaponId: "lions_roar",
        refinement: 5,
        artifactSet: { type: "4pc", setId: "thundering_fury" },
      }),
      expect.objectContaining({
        charId: "ineffa",
        weaponId: "fractured_halo",
        refinement: 1,
        artifactSet: {
          type: "4pc",
          setId: "aubade_of_morningstar_and_moon",
        },
      }),
      expect.objectContaining({
        charId: "furina",
        weaponId: "freedomsworn",
        refinement: 1,
        artifactSet: { type: "4pc", setId: "golden_troupe" },
      }),
      expect.objectContaining({
        charId: "xilonen",
        weaponId: "peak_patrol_song",
        refinement: 1,
        artifactSet: {
          type: "4pc",
          setId: "scroll_of_the_hero_of_cinder_city",
        },
      }),
    ]);
    expect(input).toEqual(before);
    expect(isCompleteSourceBackedEquipmentRuntimePreflightReport(report)).toBe(
      true,
    );
    expect(() =>
      requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(report),
    ).not.toThrow();
  });

  it("can expose evaluator readiness only for an exact reviewed and fully bound objective without unresolved mappings", async () => {
    const input = buildInput();
    input.objective.reviewStatus = "reviewed";
    input.objective.unresolvedMappings = [];
    input.objective.formulaLines[0].reaction = null;
    input.objective.formulaLines[0].forceOnField = true;
    input.objective.formulaLinesSha256 = sha256Text(
      stableJson(input.objective.formulaLines),
    );
    input.objective.sourceReadiness = {
      readyForDamageReplay: true,
      blockers: [],
      mappingSummary: {
        comparisons: 11,
        exactClaims: 11,
        rangeClaims: 0,
        completeTokenMappings: 11,
        partialTokenMappings: 0,
        unresolvedMappings: 0,
        nonNullFormulaUnresolvedMappings: 0,
        nullFormulaUnresolvedMappings: 0,
        sourceAbsentMappings: 2,
      },
    };
    const report = await buildSourceBackedEquipmentRuntimePreflight(input);

    expect(report.validationStatus).toBe("ready-for-evaluator");
    expect(report.objectiveBoundary.sourceReadyForEvaluation).toBe(true);
    expect(report.objectiveBoundary.blockers).toEqual([]);
    expect(report.execution.evaluatorReadyNodeCount).toBe(36);
    expect(report.nodes.every(({ readyForEvaluator }) => readyForEvaluator)).toBe(
      true,
    );
    expect(report.objectiveBoundary.envelope.formulaLines[0]).toEqual({
      characterId: "furina",
      formulaId: "furina-burst",
      count: 1,
      reaction: null,
      forceOnField: true,
    });
    expect(isCompleteSourceBackedEquipmentRuntimePreflightReport(report)).toBe(
      true,
    );
  });

  it.each([
    ["missing occurrence", (input: MutableInput) => input.occurrenceResolutions.pop()],
    [
      "extra occurrence",
      (input: MutableInput) =>
        input.occurrenceResolutions.push({
          ...input.occurrenceResolutions[0],
          occurrenceId: "synthetic:extra",
        }),
    ],
    [
      "duplicate occurrence",
      (input: MutableInput) =>
        input.occurrenceResolutions.push({
          ...input.occurrenceResolutions[0],
        }),
    ],
    [
      "payload hash mismatch",
      (input: MutableInput) =>
        (input.occurrenceResolutions[0].latticePayloadSha256 = "0".repeat(64)),
    ],
    [
      "non-4pc artifact",
      (input: MutableInput) =>
        Object.assign(
          input.occurrenceResolutions.find(
            ({ equipmentKind }) => equipmentKind === "artifact",
          ) as object,
          { artifactSet: { type: "2pc+2pc", halfSetIds: ["1", "2"] } },
        ),
    ],
    [
      "ER field",
      (input: MutableInput) =>
        Object.assign(input.occurrenceResolutions[0], { erFloor: 130 }),
    ],
    [
      "ER field in source lattice payload",
      (input: MutableInput) =>
        Object.assign(
          input.lattice.lattice?.groups[0].occurrences[0].payload ?? {},
          { erFloor: 130 },
        ),
    ],
    [
      "unknown top-level runtime ER field",
      (input: MutableInput) =>
        Object.assign(input.runtimeAssumptions, { erFloor: 130 }),
    ],
    [
      "unknown input-root field",
      (input: MutableInput) => Object.assign(input, { ignored: true }),
    ],
    [
      "unknown occurrence-resolution field",
      (input: MutableInput) =>
        Object.assign(input.occurrenceResolutions[0], { ignored: true }),
    ],
    [
      "unknown investment field",
      (input: MutableInput) =>
        Object.assign(input.runtimeAssumptions.investments[0], {
          ignored: true,
        }),
    ],
    [
      "unknown unresolved-mapping field",
      (input: MutableInput) =>
        Object.assign(input.objective.unresolvedMappings[0], {
          ignored: true,
        }),
    ],
    [
      "non-boolean caller source binding",
      (input: MutableInput) =>
        Object.assign(input.objective, {
          sourceBindingEstablishedByCaller: "yes",
        }),
    ],
    [
      "formula hash drift",
      (input: MutableInput) => (input.objective.formulaLines[0].count = 2),
    ],
    [
      "count drift",
      (input: MutableInput) =>
        (input.runtimeAssumptions.expectedNodeCount = "35"),
    ],
    [
      "cap drift",
      (input: MutableInput) =>
        (input.lattice.preflight.maximumCombinationCount = "35"),
    ],
    [
      "partial node",
      (input: MutableInput) => input.lattice.lattice?.nodes[0].selections.pop(),
    ],
    [
      "duplicate node",
      (input: MutableInput) => {
        if (input.lattice.lattice) {
          input.lattice.lattice.nodes[1] = structuredClone(
            input.lattice.lattice.nodes[0],
          );
        }
      },
    ],
  ])("fails closed before bootstrap on %s", async (_name, mutate) => {
    const input = buildInput();
    mutate(input);
    let bootstrapCalls = 0;
    const environment: SourceBackedEquipmentRuntimePreflightEnvironment = {
      environmentId: "never-bootstrap-invalid-input",
      async bootstrap() {
        bootstrapCalls += 1;
      },
      materialize() {
        throw new Error("materialize must not run for invalid input");
      },
    };

    const report = await buildSourceBackedEquipmentRuntimePreflight(
      input,
      environment,
    );
    expect(report.validationStatus).toBe("withheld-invalid-input");
    expect(report.execution.bootstrapCalls).toBe(0);
    expect(report.execution.observedMaterializationCalls).toBe(0);
    expect(report.execution.generatorCalls).toBe(0);
    expect(report.execution.replayCalls).toBe(0);
    expect(bootstrapCalls).toBe(0);
    expect(isCompleteSourceBackedEquipmentRuntimePreflightReport(report)).toBe(
      false,
    );
    expect(() =>
      requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(report),
    ).not.toThrow();
  });

  it.each([
    [
      "missing registry entity",
      (input: MutableInput) => {
        const weapon = input.occurrenceResolutions.find(
          ({ equipmentKind }) => equipmentKind === "weapon",
        );
        if (weapon?.equipmentKind === "weapon") {
          weapon.weaponId = "synthetic_missing_weapon";
        }
      },
      "runtime.materialization_failed",
    ],
    [
      "missing objective formula",
      (input: MutableInput) => {
        input.objective.formulaLines[0].formulaId = "synthetic-missing-formula";
        input.objective.formulaLinesSha256 = sha256Text(
          stableJson(input.objective.formulaLines),
        );
      },
      "runtime.objective_formula_unavailable",
    ],
  ])("withholds the whole preflight when one runtime node fails: %s", async (
    _name,
    mutate,
    expectedCode,
  ) => {
    const input = buildInput();
    mutate(input);
    const report = await buildSourceBackedEquipmentRuntimePreflight(input);

    expect(report.validationStatus).toBe("withheld-incomplete-materialization");
    expect(report.comparisonStatus).toBe("not-run");
    expect(report.execution.generatorCalls).toBe(0);
    expect(report.execution.replayCalls).toBe(0);
    expect(
      report.nodes.some(({ blockers }) =>
        blockers.some(({ code }) => code === expectedCode),
      ),
    ).toBe(true);
    expect(isCompleteSourceBackedEquipmentRuntimePreflightReport(report)).toBe(
      false,
    );
  });

  it.each([
    [
      "capability",
      (report: MutableReport) =>
        ((report.capabilities.ranking as boolean) = true),
    ],
    [
      "issue array",
      (report: MutableReport) =>
        report.issues.push({ code: "mutated", path: "x", message: "x" }),
    ],
    [
      "caution array",
      (report: MutableReport) => report.cautions.reverse(),
    ],
    [
      "selection",
      (report: MutableReport) => report.nodes[0].selections.pop(),
    ],
    [
      "config",
      (report: MutableReport) => {
        const config = report.nodes[0].materializedConfigs?.[0];
        if (config) config.weaponId = "mutated";
      },
    ],
    [
      "formula coverage",
      (report: MutableReport) =>
        (report.nodes[0].objectiveFormulaCoverage[0].available = false),
    ],
    [
      "execution count",
      (report: MutableReport) =>
        (report.execution.freshTeamBuildCount -= 1),
    ],
    [
      "source lattice hash",
      (report: MutableReport) =>
        (report.authentication.sourceLatticeSha256 = "0".repeat(64)),
    ],
  ])("whole-report authentication rejects post-build %s mutation", async (
    _name,
    mutate,
  ) => {
    const report = await buildSourceBackedEquipmentRuntimePreflight(
      buildInput(),
    );
    mutate(report);

    expect(() =>
      requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(report),
    ).toThrow(/incomplete, inconsistent, or mutated/);
    expect(isCompleteSourceBackedEquipmentRuntimePreflightReport(report)).toBe(
      false,
    );
  });
});

type MutableInput = SourceBackedEquipmentRuntimePreflightInput<SyntheticPayload>;
type MutableReport = SourceBackedEquipmentRuntimePreflightReport;

function buildInput(): MutableInput {
  const lattice = buildSyntheticLattice();
  if (!isCompleteSourceBackedEquipmentCandidateLattice(lattice)) {
    throw new Error("Synthetic lattice fixture must be complete.");
  }
  const occurrenceResolutions: SourceBackedEquipmentRuntimeOccurrenceResolution[] =
    lattice.lattice.groups.flatMap((group) => {
      const domain = lattice.lattice.domains.find(({ groupIds }) =>
        groupIds.includes(group.groupId),
      );
      if (!domain) throw new Error(`Missing domain for ${group.groupId}.`);
      return group.occurrences.map(({ occurrenceId, payload }) => {
        const base = {
          occurrenceId,
          axisId: domain.axisId,
          groupId: group.groupId,
          teamMemberId: domain.teamMemberId,
          characterId: domain.characterId,
          latticePayloadSha256: sha256Text(stableJson(payload)),
        };
        return domain.equipmentKind === "weapon"
          ? {
              ...base,
              equipmentKind: "weapon" as const,
              weaponId: payload.equipmentId,
              refinement: requiredNumber(payload.refinement),
            }
          : {
              ...base,
              equipmentKind: "artifact" as const,
              artifactSet: {
                type: "4pc" as const,
                setId: payload.equipmentId,
              },
            };
      });
    });
  return {
    lattice,
    occurrenceResolutions,
    objective: buildObjective(),
    runtimeAssumptions: {
      assumptionsId: "synthetic-c0-r1-r5-level90-v1",
      expectedNodeCount: "36",
      investments: MEMBERS.map(({ teamMemberId, characterId }) => ({
        teamMemberId,
        characterId,
        charLevel: 90,
        constellation: 0,
        talentLevels: { auto: 10, skill: 10, burst: 10 },
      })),
      combatOptions: {},
      enemyAura: null,
      extraBuffs: [],
      calcContext: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      carryCharacterIds: ["keqing", "ineffa", "furina", "xilonen"],
      energyRecoveryThresholds: null,
      perCharacterConstraints: null,
    },
  };
}

function buildSyntheticLattice(): SourceBackedEquipmentCandidateLatticeReport<SyntheticPayload> {
  const sourceConditions: string[] = [];
  const axes: Array<SourceBackedEquipmentAxis<SyntheticPayload>> =
    AXIS_SPECS.map((spec, axisIndex) => {
      const teamMemberId = `member:${spec.characterId}`;
      const axisId = `synthetic:${spec.characterId}:${spec.equipmentKind}`;
      return {
        axisId,
        teamMemberId,
        characterId: spec.characterId,
        equipmentKind: spec.equipmentKind,
        groups: spec.equipment.map((equipment, groupIndex) => {
          const groupId = `${axisId}:group:${groupIndex}`;
          const occurrenceId = `${groupId}:occurrence:0`;
          const payload: SyntheticPayload = {
            equipmentId: equipment.id,
            refinement: equipment.refinement,
            artifactType:
              spec.equipmentKind === "artifact" ? "4pc" : null,
          };
          return {
            groupId,
            teamMemberId,
            characterId: spec.characterId,
            equipmentKind: spec.equipmentKind,
            provenance: {
              sourceId: "synthetic-source",
              sourceRecordId: `synthetic-record:${axisIndex}`,
              repositoryRecordId: `synthetic-repository:${axisIndex}`,
              recommendationId: `synthetic-recommendation:${axisIndex}`,
            },
            recommendationOrdering: null,
            groupIndex,
            grouping: "single" as const,
            classification: null,
            sourceLocalRank: null,
            sourceListIndex: groupIndex,
            sourceConditions,
            sourceConditionsSha256: sha256Text(stableJson(sourceConditions)),
            occurrences: [
              {
                occurrenceId,
                claimId: `synthetic-claim:${axisIndex}:${groupIndex}`,
                listIndex: 0,
                alternativeIndex: null,
                tieIndex: null,
                energyDerivation: "not-er-derived" as const,
                payload,
              },
            ],
          };
        }),
      };
    });
  return buildSourceBackedEquipmentCandidateLattice({
    request: {
      requestId: "synthetic-runtime-preflight-request",
      assumptions: { exactTeam: true },
    },
    evaluation: {
      evaluationId: "synthetic-materialization-only",
      assumptions: { evaluationExecuted: false },
    },
    teamMembers: MEMBERS,
    axes,
    bounds: {
      expectedCombinationCount: "36",
      maximumCombinationCount: "36",
    },
  });
}

function buildObjective(): SourceBackedEquipmentRuntimeObjectiveEnvelope {
  return {
    objectiveId: "synthetic-keqing-lunar-authored-translation-v1",
    sourceTeamRecordId:
      "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
    sourceRotationRecordId:
      "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
    sourceRotationId: "sample-rotation",
    expectedFormulaLineCount: 11,
    formulaLines: OBJECTIVE_LINES.map((line) => ({ ...line })),
    formulaLinesSha256: EXPECTED_OBJECTIVE_SHA256,
    reviewStatus: "unreviewed",
    sourceBindingEstablishedByCaller: true,
    unresolvedMappings: [
      {
        characterId: "keqing",
        sourceToken: "8[N1] within 5[N1C] + 3[N1C]",
        calculatorFormulaId: null,
        reason: "No C0 Keqing Normal Attack formula is mapped.",
      },
      {
        characterId: "ineffa",
        sourceToken: "E (Birgitta discharges after cast)",
        calculatorFormulaId: "ineffa-birgitta",
        reason: "The source does not establish duration or hit count.",
      },
      {
        characterId: "furina",
        sourceToken: "ED (Salon Members after cast)",
        calculatorFormulaId: "furina-salon-total",
        reason: "The source does not establish duration or hit count.",
      },
      ...["ineffa", "keqing", "furina"].map((characterId) => ({
        characterId,
        sourceToken: "Lunar-Charged occurrences and ownership",
        calculatorFormulaId: `rx-lunarCharged-${characterId}`,
        reason: "The source does not establish trigger count or ownership.",
      })),
    ],
    sourceReadiness: {
      readyForDamageReplay: false,
      blockers: [
        {
          code: "translation-unreviewed",
          message: "The source-to-formula translation has not been reviewed.",
        },
        {
          code: "partial-token-mapping",
          characterId: "keqing",
          formulaId: "keqing-charged",
          message:
            "Source token mapping for keqing.keqing-charged is partial.",
        },
        ...[
          ["furina", "furina-salon-total", "ED (Salon Members after cast)"],
          [
            "furina",
            "rx-lunarCharged-furina",
            "Lunar-Charged occurrences and ownership",
          ],
          [
            "ineffa",
            "ineffa-birgitta",
            "E (Birgitta discharges after cast)",
          ],
          [
            "ineffa",
            "rx-lunarCharged-ineffa",
            "Lunar-Charged occurrences and ownership",
          ],
          [
            "keqing",
            "rx-lunarCharged-keqing",
            "Lunar-Charged occurrences and ownership",
          ],
        ].map(([characterId, formulaId, sourceToken]) => ({
          code: "unresolved-formula-mapping" as const,
          characterId,
          formulaId,
          sourceToken,
          message: `Mapping for ${characterId}.${formulaId} remains unresolved.`,
        })),
        {
          code: "unresolved-source-token",
          characterId: "keqing",
          sourceToken: "8[N1] within 5[N1C] + 3[N1C]",
          message: "The source token has no resolved calculator formula.",
        },
      ],
      mappingSummary: {
        comparisons: 11,
        exactClaims: 11,
        rangeClaims: 0,
        completeTokenMappings: 10,
        partialTokenMappings: 1,
        unresolvedMappings: 6,
        nonNullFormulaUnresolvedMappings: 5,
        nullFormulaUnresolvedMappings: 1,
        sourceAbsentMappings: 2,
      },
    },
  };
}

function requiredNumber(value: number | null): number {
  if (value === null) throw new Error("Expected a numeric refinement.");
  return value;
}
