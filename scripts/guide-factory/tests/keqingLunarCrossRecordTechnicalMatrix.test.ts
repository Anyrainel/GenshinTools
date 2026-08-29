import path from "node:path";
import { allSlots, type MainStat, type Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { GeneratorOptions } from "@/lib/team-comp/generator/generator";
import { describe, expect, it } from "vitest";
import { KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS } from "../src/keqingIneffaFormulaDraft";
import { KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS } from "../src/keqingLunarCrossRecordCompositionContract";
import {
  executePreparedKeqingLunarCrossRecordTechnicalMatrix,
  isCompleteKeqingLunarCrossRecordTechnicalMatrixReport,
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS,
  prepareKeqingLunarCrossRecordTechnicalMatrix,
  runKeqingLunarCrossRecordTechnicalMatrix,
  type KeqingLunarCrossRecordTechnicalMatrixInput,
  type KeqingLunarCrossRecordTechnicalMatrixPrepared,
} from "../src/keqingLunarCrossRecordTechnicalMatrix";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "../src/paths";
import { KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPORT_PATH } from "../src/paths";

const TARGET_TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const MH_COMPOSITION_ID =
  "guide-factory:keqing-lunar:marechaussee-hunter";
const NOTSU_COMPOSITION_ID =
  "guide-factory:keqing-lunar:night-of-the-skys-unveiling-one-nod-krai";
const CR_CIRCLET_CLAIM_ID =
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:circlet:1";
const TWO_NOD_NOTSU_CLAIM_ID =
  "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i:artifact:1:0";
const FORMULA_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json";
const LATTICE_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-lunar-source-conditioned-candidate-lattice.json";
const CONTRACT_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-lunar-cross-record-composition-contract.json";

describe("Keqing Lunar cross-record technical matrix", () => {
  it("derives exactly two source-conditioned targets with four exact records and no ordering", async () => {
    const input = await loadInput();
    const prepared = requirePrepared(
      prepareKeqingLunarCrossRecordTechnicalMatrix(input),
    );

    expect(prepared.composedTargets.map(({ compositionId }) => compositionId))
      .toEqual([MH_COMPOSITION_ID, NOTSU_COMPOSITION_ID]);
    expect(prepared.candidates).toHaveLength(2);
    expect(prepared.nodes).toHaveLength(8);
    expect(
      prepared.nodes.map(({ carryCharacterId, compositionId }) =>
        `${carryCharacterId}:${compositionId}`,
      ),
    ).toEqual(
      ["keqing", "ineffa", "furina", "xilonen"].flatMap((characterId) => [
        `${characterId}:${MH_COMPOSITION_ID}`,
        `${characterId}:${NOTSU_COMPOSITION_ID}`,
      ]),
    );

    const expectedRecordIds = {
      [MH_COMPOSITION_ID]: [
        "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
        "kqm:character-guide:keqing-lunar-charged-furina-marechaussee-hunter-luna-i",
        "kqm:character-guide:keqing-lunar-charged-general-mistsplitter-luna-i",
        TARGET_TEAM_ID,
      ],
      [NOTSU_COMPOSITION_ID]: [
        "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
        "kqm:character-guide:keqing-lunar-charged-general-mistsplitter-luna-i",
        "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i",
        TARGET_TEAM_ID,
      ],
    };
    for (const target of prepared.composedTargets) {
      expect(target).toMatchObject({
        kind: "composed-source-claims",
        characterId: "keqing",
        sands: ["atk%"],
        goblet: ["electro%", "atk%"],
        circlet: ["cd"],
        substats: ["cr", "cd", "atk%", "em"],
        sourcePriorityGroups: [["cr", "cd"], ["atk%"], ["em"]],
        withheldStatClaimIds: [CR_CIRCLET_CLAIM_ID],
        sourceAuthored: false,
      });
      expect(target.repositoryRecordIds).toEqual(
        expectedRecordIds[target.compositionId as keyof typeof expectedRecordIds],
      );
      expect(target.repositoryRecordIds).toEqual(
        [...target.repositoryRecordIds].sort(),
      );
      expect(target.equipmentClaimIds).toHaveLength(2);
      expect(
        Object.values(target.matchedStatClaimIds).flat(),
      ).toHaveLength(7);
      expect(target.equipmentClaimIds).not.toContain(TWO_NOD_NOTSU_CLAIM_ID);
    }
    expect(prepared.composedTargets[0].artifactSetId).toBe(
      "marechaussee_hunter",
    );
    expect(prepared.composedTargets[1].artifactSetId).toBe(
      "night_of_the_skys_unveiling",
    );
    expect(
      prepared.candidates.every(
        ({ validationTargets }) =>
          validationTargets.length === 4 &&
          validationTargets.filter(({ kind }) => kind === "repository-build")
            .length === 3,
      ),
    ).toBe(true);
    const teammateTargets = prepared.candidates[0].validationTargets.filter(
      ({ kind }) => kind === "repository-build",
    );
    expect(
      teammateTargets.find(({ characterId }) => characterId === "furina")
        ?.sands,
    ).toContain("er");
    expect(
      teammateTargets.find(({ characterId }) => characterId === "furina")
        ?.substats,
    ).toContain("er");
    expect(
      teammateTargets.find(({ characterId }) => characterId === "xilonen")
        ?.substats,
    ).toContain("er");
    expect(
      prepared.composedTargets.some(
        (target) =>
          target.sands.includes("er") || target.substats.includes("er"),
      ),
    ).toBe(false);
  });

  it("runs eight fresh sequential structural invocations and retains no comparative result", async () => {
    const input = await loadInput();
    const fake = createFakeEnvironment();
    const report = await runKeqingLunarCrossRecordTechnicalMatrix(
      input,
      fake.environment,
    );

    expect(fake.state.invocations, stableJson(report)).toBe(8);
    expect(new Set(fake.state.teamBuilds).size).toBe(8);
    expect(fake.state.maximumConcurrentInvocations).toBe(1);
    expect(report).toMatchObject({
      matrixStatus: "comparable",
      supportsGuideClaims: false,
      supportsSourceAuthoredBuildClaims: false,
      supportsArtifactRecommendations: false,
      supportsStatRecommendations: false,
      supportsArtifactSetComparison: false,
      supportsRankClaims: false,
      supportsWinnerClaims: false,
      supportsEnergyRecoveryClaims: false,
      crossRecordOrdering: "none",
      crossNodeObjectiveComparisonExecuted: false,
      artifactSetComparisonExecuted: false,
      evaluatedObjectiveValueRetained: false,
      numericalDamageRetained: false,
      executionAuthorization: {
        authorizedOnlyBy:
          "bounded-guide-factory-structural-experiment-policy",
        guideFactoryExperimentPolicyDeclared: true,
        thisCanonicalInputAuthorizedAfterPrevalidation: true,
        executionStarted: true,
        sourceAuthorized: false,
        compositionContractAuthorized: false,
        formulaFixtureAuthorized: false,
      },
      prevalidation: {
        status: "passed",
        canonicalComposedTargetCount: 2,
        candidateEnvelopeCount: 2,
        validationTargetCountPerCandidate: 4,
        noRunRuntimeReadyCandidateCount: 2,
        temporaryTeamBuildCount: 2,
        generatorInvoked: false,
      },
      executionAudit: {
        scheduling: "sequential",
        plannedGeneratorInvocationCount: 8,
        observedGeneratorInvocationCount: 8,
        uniqueTeamBuildInstanceCount: 8,
        maximumConcurrentGeneratorInvocationCount: 1,
        trustedValidatorRuntimeCallCount: 8,
        structurallyCompletedNodeCount: 8,
        partialStructuralOutputsDiscardedOnFailure: true,
      },
      matrix: {
        status: "complete-structurally",
        nodeCount: 8,
      },
      originLedger: {
        canonicalCompositionContract: {
          contractTechnicalExecutionAuthorized: false,
          crossRecordOrdering: "none",
        },
        sourceClaimTargets: {
          sourceAuthored: false,
          keqingStatTarget: {
            circlet: ["cd"],
            withheldClaimIds: [CR_CIRCLET_CLAIM_ID],
            energyRecoveryFree: true,
            usedAsGeneratorConstraint: false,
            usedAsScoringWeight: false,
            usedOnlyForPostGenerationObservation: true,
          },
          excludedClaimIds: [TWO_NOD_NOTSU_CLAIM_ID],
        },
        fixtureAssumptions: {
          nonArtifactFieldsAppliedForInternalGeneratorExecution: true,
          selectedArtifactFieldsApplied: false,
          selectedArtifactFieldsRetainedAsSeedProvenanceOnly: true,
          artifactAssignmentsOverriddenByMatrixNodes: true,
        },
        teammateEquipment: {
          weaponAndArtifactAssignmentsAppliedForInternalGeneratorExecution: true,
          repositoryStatTargetsUsedAsGeneratorConstraint: false,
          repositoryStatTargetsUsedAsScoringWeight: false,
          repositoryStatTargetsUsedOnlyForPostGenerationObservation: true,
        },
        energyRecovery: {
          computationExecuted: false,
          thresholdsUsed: false,
          sequenceUsed: false,
          floorOrAdequacyClaim: false,
          repositoryTargetsMayContainSourceRecordedKeys: true,
        },
      },
      issues: [],
    });
    expect(isCompleteKeqingLunarCrossRecordTechnicalMatrixReport(report)).toBe(
      true,
    );
    expect(
      isCompleteKeqingLunarCrossRecordTechnicalMatrixReport({
        ...report,
        matrixStatus: "not-comparable",
        matrix: null,
      }),
    ).toBe(false);
    expect(
      isCompleteKeqingLunarCrossRecordTechnicalMatrixReport({
        ...report,
        issues: [
          {
            code: "test.injected_issue",
            path: "test",
            message: "Injected completion-gate regression fixture.",
          },
        ],
      }),
    ).toBe(false);
    expect(
      isCompleteKeqingLunarCrossRecordTechnicalMatrixReport({
        ...report,
        matrix: report.matrix
          ? {
              ...report.matrix,
              nodes: report.matrix.nodes.slice(0, 7),
            }
          : null,
      }),
    ).toBe(false);
    expect(
      isCompleteKeqingLunarCrossRecordTechnicalMatrixReport({
        ...report,
        prevalidation: {
          ...report.prevalidation,
          noRunRuntimeReadyCandidateCount: 1,
        },
      }),
    ).toBe(false);
    expect(
      isCompleteKeqingLunarCrossRecordTechnicalMatrixReport({
        ...report,
        executionAudit: {
          ...report.executionAudit,
          structurallyCompletedNodeCount: 7,
        },
      }),
    ).toBe(false);
    expect(report.matrix?.nodes).toHaveLength(8);
    expect(
      report.matrix?.nodes.every(
        ({ validationTargetObservations }) =>
          validationTargetObservations.length === 4,
      ),
    ).toBe(true);
    expect(
      report.originLedger?.sourceClaimTargets.targets.map(
        ({ recordLocalSourceClassification }) =>
          recordLocalSourceClassification,
      ),
    ).toEqual(["default", "alternative"]);
    expect(
      report.originLedger?.fixtureAssumptions.assumptions.find(
        ({ characterId }) => characterId === "keqing",
      )?.selectedArtifact,
    ).toEqual({ type: "4pc", setId: "thundering_fury" });
    expect(
      new Set(report.matrix?.nodes.map(({ artifactSetId }) => artifactSetId)),
    ).toEqual(
      new Set(["marechaussee_hunter", "night_of_the_skys_unveiling"]),
    );
    expect(findForbiddenRetainedResultKeys(report)).toEqual([]);
  }, 120_000);

  it("fails closed before generation for stale or tampered canonical inputs", async () => {
    const cases: Array<{
      label: string;
      mutate: (input: KeqingLunarCrossRecordTechnicalMatrixInput) => void;
    }> = [
      {
        label: "formula-current-byte-hash",
        mutate: (input) => {
          input.formulaDraftGeneratedFrom[0].sha256 = "0".repeat(64);
        },
      },
      {
        label: "matrix-input-inventory",
        mutate: (input) => {
          input.generatedFrom.pop();
        },
      },
      {
        label: "direct-lattice-generated-from",
        mutate: (input) => {
          input.candidateLattice.generatedFrom[0].sha256 = "1".repeat(64);
        },
      },
      {
        label: "changed-team-condition-resolution-with-coherent-snapshot-hash",
        mutate: (input) => {
          const team = input.candidateLattice.lattice?.teams.find(
            ({ teamRecordId }) => teamRecordId === TARGET_TEAM_ID,
          );
          if (!team) throw new Error("Missing target team test fixture.");
          const cell = team.equipmentGroupCells.find(
            ({ conditionResolution }) =>
              conditionResolution === "matched-by-exact-team-facts",
          );
          if (!cell) throw new Error("Missing matched equipment cell fixture.");
          (
            cell as unknown as { conditionResolution: string }
          ).conditionResolution = "not-matched-by-exact-team-facts";
          bindSnapshotHash(input.contractGeneratedFrom, LATTICE_REPORT_PATH, input.candidateLattice);
          bindSnapshotHash(input.generatedFrom, LATTICE_REPORT_PATH, input.candidateLattice);
        },
      },
      {
        label: "tampered-durable-contract-with-coherent-snapshot-hash",
        mutate: (input) => {
          (
            input.serializedContract.compositions[0].artifact as unknown as {
              claimId: string;
            }
          ).claimId = TWO_NOD_NOTSU_CLAIM_ID;
          bindSnapshotHash(input.generatedFrom, CONTRACT_REPORT_PATH, input.serializedContract);
        },
      },
      {
        label: "formula-team-drift-with-coherent-snapshot-hash",
        mutate: (input) => {
          input.formulaDraft.assumptions.characters[0].constellation++;
          bindSnapshotHash(input.contractGeneratedFrom, FORMULA_REPORT_PATH, input.formulaDraft);
          bindSnapshotHash(input.generatedFrom, FORMULA_REPORT_PATH, input.formulaDraft);
        },
      },
      {
        label: "repository-guide-status-drift",
        mutate: (input) => {
          const guide = input.repository.records.find(
            (record) =>
              record.kind === "character_guide" &&
              record.id === "genshintools-presets:character-guide:furina",
          );
          if (!guide || guide.kind !== "character_guide") {
            throw new Error("Missing Furina guide fixture.");
          }
          guide.status = guide.status === "accepted" ? "baseline" : "accepted";
          bindSnapshotHash(
            input.formulaDraftGeneratedFrom,
            "scripts/guide-factory/data/knowledge/repository.json",
            input.repository,
          );
          bindSnapshotHash(
            input.generatedFrom,
            "scripts/guide-factory/data/knowledge/repository.json",
            input.repository,
          );
        },
      },
    ];

    for (const testCase of cases) {
      const input = await loadInput();
      testCase.mutate(input);
      const fake = createFakeEnvironment();
      const report = await runKeqingLunarCrossRecordTechnicalMatrix(
        input,
        fake.environment,
      );
      expect(fake.state.invocations, testCase.label).toBe(0);
      expect(report.matrixStatus, testCase.label).toBe("not-comparable");
      expect(report.matrix, testCase.label).toBeNull();
      expect(report.originLedger, testCase.label).toBeNull();
      expect(
        report.executionAuthorization
          .thisCanonicalInputAuthorizedAfterPrevalidation,
        testCase.label,
      ).toBe(false);
      expect(report.executionAuthorization.executionStarted, testCase.label)
        .toBe(false);
      expect(report.issues.length, testCase.label).toBeGreaterThan(0);
    }
  });

  it("rejects post-prepare payload mutation and forged or swapped capabilities with zero runs", async () => {
    const attacks: Array<{
      label: string;
      attack: (
        prepared: KeqingLunarCrossRecordTechnicalMatrixPrepared,
      ) => Promise<void> | void;
    }> = [
      {
        label: "derived-target-stat-mutation",
        attack: (prepared) => {
          prepared.composedTargets[0].circlet.push("cr");
        },
      },
      {
        label: "second-node-teammate-target-mutation",
        attack: (prepared) => {
          prepared.nodes[1].candidate.validationTargets[1].artifactSetId =
            "gladiators_finale";
        },
      },
      {
        label: "capability-hash-replacement",
        attack: (prepared) => {
          prepared.trustedCapability = {
            ...prepared.trustedCapability,
            authorityPayloadSha256: "0".repeat(64),
          };
        },
      },
      {
        label: "capability-validator-replacement",
        attack: (prepared) => {
          prepared.trustedCapability = {
            ...prepared.trustedCapability,
            validateComposedTarget: () => ({ valid: true }),
          };
        },
      },
      {
        label: "genuine-capability-swap",
        attack: async (prepared) => {
          const other = requirePrepared(
            prepareKeqingLunarCrossRecordTechnicalMatrix(await loadInput()),
          );
          prepared.trustedCapability = other.trustedCapability;
        },
      },
    ];

    for (const testCase of attacks) {
      const prepared = requirePrepared(
        prepareKeqingLunarCrossRecordTechnicalMatrix(await loadInput()),
      );
      await testCase.attack(prepared);
      const fake = createFakeEnvironment();
      const report =
        await executePreparedKeqingLunarCrossRecordTechnicalMatrix(
          prepared,
          fake.environment,
        );
      expect(fake.state.invocations, testCase.label).toBe(0);
      expect(report.matrixStatus, testCase.label).toBe("not-comparable");
      expect(report.matrix, testCase.label).toBeNull();
      expect(report.prevalidation.status, testCase.label).toBe("not-run");
      expect(report.issues[0]?.code, testCase.label).toMatch(
        /^prevalidation\./,
      );
    }
  });

  it("uses a private execution snapshot against mutation after execution starts", async () => {
    const prepared = requirePrepared(
      prepareKeqingLunarCrossRecordTechnicalMatrix(await loadInput()),
    );
    const fake = createFakeEnvironment({
      onInvocation: (ordinal) => {
        if (ordinal !== 1) return;
        prepared.repository.records.length = 0;
        prepared.formulaDraft.lines.length = 0;
        prepared.candidates[1].validationTargets.length = 0;
        prepared.nodes[7].candidate.artifactSetIdsByCharacter.keqing =
          "gladiators_finale";
      },
    });
    const promise = executePreparedKeqingLunarCrossRecordTechnicalMatrix(
      prepared,
      fake.environment,
    );
    prepared.composedTargets[0].circlet.push("cr");
    prepared.nodes[0].candidate.validationTargets.length = 0;
    const report = await promise;

    expect(fake.state.invocations).toBe(8);
    expect(report.matrixStatus).toBe("comparable");
    expect(report.matrix?.nodes).toHaveLength(8);
  }, 120_000);

  it("fails the whole matrix and stops at the first runtime failure", async () => {
    const fake = createFakeEnvironment({ failAtInvocation: 3 });
    const report = await runKeqingLunarCrossRecordTechnicalMatrix(
      await loadInput(),
      fake.environment,
    );

    expect(fake.state.invocations).toBe(3);
    expect(report).toMatchObject({
      matrixStatus: "not-comparable",
      matrix: null,
      originLedger: null,
      executionAuthorization: {
        guideFactoryExperimentPolicyDeclared: true,
        thisCanonicalInputAuthorizedAfterPrevalidation: true,
        executionStarted: true,
      },
      prevalidation: {
        status: "passed",
        candidateEnvelopeCount: 2,
        noRunRuntimeReadyCandidateCount: 2,
        generatorInvoked: false,
      },
      executionAudit: {
        observedGeneratorInvocationCount: 3,
        uniqueTeamBuildInstanceCount: 3,
        maximumConcurrentGeneratorInvocationCount: 1,
        structurallyCompletedNodeCount: 2,
        partialStructuralOutputsDiscardedOnFailure: true,
      },
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].path).toContain("node-03");
    expect(findForbiddenRetainedResultKeys(report)).toEqual([]);
  }, 120_000);

  it("keeps the ignored durable report tied to every current declared input byte", async () => {
    const saved = (await readJson(
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPORT_PATH,
    )) as Awaited<ReturnType<typeof runKeqingLunarCrossRecordTechnicalMatrix>>;
    const currentGeneratedFrom = await hashInputs(
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS,
    );

    expect(saved.matrixStatus).toBe("comparable");
    expect(saved.matrix?.nodes).toHaveLength(8);
    expect(saved.generatedFrom).toEqual(
      [...currentGeneratedFrom].sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      ),
    );
    expect(saved.inputBoundary.serializedContractAuthenticatedAgainstRebuild)
      .toBe(true);
    expect(saved.executionAudit.observedGeneratorInvocationCount).toBe(8);
    expect(saved.issues).toEqual([]);
  });
});

function requirePrepared(
  preparation: ReturnType<
    typeof prepareKeqingLunarCrossRecordTechnicalMatrix
  >,
): KeqingLunarCrossRecordTechnicalMatrixPrepared {
  if (!preparation.ready) {
    throw new Error(
      `Expected ready matrix preparation: ${stableJson(preparation.report.issues)}`,
    );
  }
  return preparation.prepared;
}

async function loadInput(): Promise<KeqingLunarCrossRecordTechnicalMatrixInput> {
  const [
    repository,
    candidateLattice,
    formulaDraft,
    serializedContract,
    formulaDraftGeneratedFrom,
    contractGeneratedFrom,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH),
    readJson(KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH),
    readJson(KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH),
    hashInputs(KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS),
    hashInputs(KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS),
    hashInputs(KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS),
  ]);
  return {
    repository,
    candidateLattice,
    formulaDraft,
    serializedContract,
    formulaDraftGeneratedFrom,
    contractGeneratedFrom,
    generatedFrom,
  } as KeqingLunarCrossRecordTechnicalMatrixInput;
}

async function hashInputs(
  relativePaths: readonly string[],
): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    relativePaths.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    })),
  );
}

function bindSnapshotHash(
  entries: Array<{ path: string; sha256: string }>,
  relativePath: string,
  value: unknown,
): void {
  const matches = entries.filter(({ path }) => path === relativePath);
  if (matches.length !== 1) {
    throw new Error(`Expected one hash entry for ${relativePath}.`);
  }
  matches[0].sha256 = sha256Text(stableJson(value));
}

function createFakeEnvironment(options: {
  failAtInvocation?: number;
  onInvocation?: (ordinal: number, generatorOptions: GeneratorOptions) => void;
} = {}) {
  const state = {
    invocations: 0,
    activeInvocations: 0,
    maximumConcurrentInvocations: 0,
    teamBuilds: [] as object[],
  };
  return {
    state,
    environment: {
      runGenerator(generatorOptions: GeneratorOptions) {
        state.invocations++;
        const ordinal = state.invocations;
        state.teamBuilds.push(generatorOptions.teamBuild);
        options.onInvocation?.(ordinal, generatorOptions);
        return (async function* () {
          state.activeInvocations++;
          state.maximumConcurrentInvocations = Math.max(
            state.maximumConcurrentInvocations,
            state.activeInvocations,
          );
          try {
            await Promise.resolve();
            if (ordinal === options.failAtInvocation) {
              throw new TypeError(`injected matrix failure ${ordinal}`);
            }
            yield makeFinalResult(generatorOptions);
          } finally {
            state.activeInvocations--;
          }
        })();
      },
    },
  };
}

function makeFinalResult(options: GeneratorOptions) {
  return {
    artifactsByChar: Object.fromEntries(
      options.teamBuild.configs.map(({ charId, artifactSet }) => {
        if (artifactSet?.type !== "4pc") {
          throw new Error(`Expected four-piece assignment for ${charId}.`);
        }
        return [charId, makeArtifacts(charId, artifactSet.setId)];
      }),
    ),
    sheetsByChar: Object.fromEntries(
      options.teamBuild.configs.map(({ charId }) => [charId, new StatSheet([])]),
    ),
    phase: "done",
    progress: 1,
    done: true,
  } as const;
}

function makeArtifacts(
  characterId: string,
  setId: string,
): Record<Slot, ArtifactData> {
  const mainStats: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "electro%",
    circlet: "cd",
  };
  return Object.fromEntries(
    allSlots.map((slot) => [
      slot,
      {
        id: `gen-${characterId}-${slot}`,
        setKey: setId,
        slotKey: slot,
        level: 20,
        rarity: 5,
        mainStatKey: mainStats[slot],
        lock: false,
        substats: { em: 20 },
      },
    ]),
  ) as Record<Slot, ArtifactData>;
}

function findForbiddenRetainedResultKeys(value: unknown): string[] {
  const forbidden = new Set([
    "artifactsbychar",
    "sheetsbychar",
    "progress",
    "damage",
    "objective",
    "objectivevalue",
    "score",
    "rank",
    "ranking",
    "winner",
    "idealrolls",
  ]);
  return collectObjectKeys(value).filter((key) =>
    forbidden.has(key.toLowerCase()),
  );
}

function collectObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectObjectKeys);
  if (value == null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectObjectKeys(child),
  ]);
}
