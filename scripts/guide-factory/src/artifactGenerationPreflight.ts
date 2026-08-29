import characterStatsInput from "@/data/game/character_stats.json";
import { betaArtifactIds } from "@/data/gameResources";
import { buildArtifactSetChoiceCandidates } from "@/lib/team-comp/analyzer/weaponChoice";
import type {
  FormulaPlanReadinessAssessment,
  FormulaPlanReadinessBlocker,
} from "./formulaPlanReadiness";
import type { FormulaPlanDraftOutput } from "./formulaPlanDraft";
import type { SourceBackedEquipmentScenario } from "./sourceBackedEquipmentScenario";
import {
  KnowledgeTeamSchema,
  type ArtifactChoice,
  type KnowledgeRecord,
} from "./schemas";
import {
  buildMirroredWeaponCandidateDomain,
  type MirroredWeaponCandidate,
  type MirroredWeaponCandidateDomain,
} from "./weaponChoiceSearchCoverage";

export const ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS = [
  "scripts/guide-factory/src/artifactGenerationPreflight.ts",
  "scripts/guide-factory/src/formulaPlanReadiness.ts",
  "scripts/guide-factory/src/sourceBackedEquipmentScenario.ts",
  "scripts/guide-factory/src/weaponChoiceSearchCoverage.ts",
  "scripts/guide-factory/src/schemas.ts",
  "src/data/betaState.ts",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
  "src/data/gameResources.ts",
  "src/data/resources.ts",
  "src/data/resources_beta.ts",
  "src/lib/team-comp/analyzer/weaponChoice.ts",
] as const;

export const COMPARISON_BASELINE_REFINEMENT_POLICY = {
  id: "comparison-baseline-v1",
  explicitFixtureRefinement: "preserve-and-validate",
  unspecifiedThreeOrFourStar: 5,
  unspecifiedFiveStar: 1,
} as const;

type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;
type TeamMember = KnowledgeTeam["members"][number];
type FixtureEvidence = SourceBackedEquipmentScenario["evidence"][number];

export interface ArtifactGenerationPreflightEnvironment {
  weaponCandidateDomain: MirroredWeaponCandidateDomain;
  characterWeaponTypes: Readonly<Record<string, string | undefined>>;
  initialFourPieceArtifactSetIds: ReadonlySet<string>;
}

export interface ArtifactGenerationPreflightInput {
  fixture: SourceBackedEquipmentScenario;
  formulaDraft: FormulaPlanDraftOutput;
  formulaReadiness: FormulaPlanReadinessAssessment;
}

export type ArtifactGenerationPreflightBlockerCode =
  | "duplicate-team-character"
  | "missing-selected-weapon"
  | "weapon-outside-released-candidate-domain"
  | "explicit-refinement-not-candidate"
  | "policy-refinement-not-candidate"
  | "unknown-character-native-weapon-type"
  | "native-weapon-type-mismatch"
  | "missing-selected-artifact"
  | "artifact-not-in-initial-grammar"
  | "missing-fixture-evidence"
  | "duplicate-fixture-evidence"
  | "fixture-evidence-weapon-mismatch"
  | "fixture-evidence-artifact-mismatch"
  | "fixture-evidence-for-non-member"
  | "formula-draft-source-team-mismatch"
  | "formula-draft-member-mismatch"
  | "formula-draft-equipment-mismatch"
  | "formula-draft-refinement-mismatch"
  | "formula-draft-investment-mismatch"
  | "formula-plan-source-team-mismatch"
  | "formula-readiness-draft-mismatch"
  | "formula-plan-not-ready";

export interface ArtifactGenerationPreflightBlocker {
  code: ArtifactGenerationPreflightBlockerCode;
  message: string;
  characterId?: string;
}

export interface ArtifactGenerationPreflightMember {
  characterId: string;
  fixtureInvestment: TeamMember["investment"];
  weapon: {
    weaponId: string | null;
    rarity: number | null;
    fixtureRefinement: number | null;
    experimentRefinement: number | null;
    refinementOrigin: "fixture-explicit" | "experiment-policy" | "unresolved";
    candidateRefinements: number[];
    exactCandidatePair: boolean;
    weaponTypeFromStats: string | null;
    characterNativeWeaponType: string | null;
    nativeTypeCompatibility: "compatible" | "mismatched" | "unknown";
  };
  artifact: {
    choice: ArtifactChoice | null;
    initialGrammarCoverage:
      | "enumerated-initially"
      | "not-enumerated-initially"
      | "missing";
    failureReason?:
      | "two-piece-choice-is-not-in-initial-grammar"
      | "four-piece-set-is-not-in-initial-grammar";
  };
  fixtureEvidence: {
    characterGuideId: string;
    guideStatus: FixtureEvidence["guideStatus"];
    weaponOrderIndex: number;
    buildSourceRecordId: string;
    guideSourceRefs: FixtureEvidence["guideSourceRefs"];
  } | null;
  ready: boolean;
  blockerCodes: ArtifactGenerationPreflightBlockerCode[];
}

export interface ArtifactGenerationPreflightReport {
  schemaVersion: 1;
  classification: "artifact-generation-experiment-preflight";
  supportsGuideClaims: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  sourceTeamRecordId: string;
  fixtureClassification: SourceBackedEquipmentScenario["classification"];
  refinementPolicy: typeof COMPARISON_BASELINE_REFINEMENT_POLICY;
  members: ArtifactGenerationPreflightMember[];
  gates: {
    uniqueTeamCharacters: boolean;
    equipmentComplete: boolean;
    fixtureEvidenceConsistent: boolean;
    refinementsResolved: boolean;
    exactCandidatePairs: boolean;
    nativeTypesCompatible: boolean;
    artifactsInitiallyEnumerated: boolean;
    formulaDraftMatchesResolvedFixture: boolean;
    formulaPlanSourceMatches: boolean;
    formulaReadinessMatchesDraft: boolean;
    formulaPlanReady: boolean;
  };
  formulaDraftBinding: {
    sourceTeamRecordId: string;
    assumptionClassification: "calculator-fixture-experiment-assumptions";
    characters: Array<{
      characterId: string;
      charLevel: number;
      constellation: number;
      selectedWeaponId: string;
      selectedArtifact: ArtifactChoice;
      refinement: number;
      talentLevels: { auto: number; skill: number; burst: number };
    }>;
  };
  formulaReadiness: {
    sourceTeamRecordId: string;
    reviewStatus: FormulaPlanReadinessAssessment["reviewStatus"];
    readyForDamageReplay: boolean;
    positiveDefaultCoverage: Omit<
      FormulaPlanReadinessAssessment["positiveDefaultCoverage"],
      "rows"
    >;
    blockers: FormulaPlanReadinessBlocker[];
  };
  equipmentReadyForTechnicalProbe: boolean;
  readyForReviewedGeneratorExperiment: boolean;
  readyForGenerator: boolean;
  blockers: ArtifactGenerationPreflightBlocker[];
  cautions: [
    "Resolved refinements are experiment inputs, not source facts or weapon recommendations.",
    "Initial artifact-grammar coverage only proves that the analyzer can name the selected four-piece set.",
    "readyForGenerator is an evidence-policy gate for a reviewed experiment, not a statement that the runtime is merely technically executable.",
    "This preflight runs no artifact generator, damage calculation, ranking, or energy calculation.",
  ];
  prohibitedInterpretations: [
    "generated-build",
    "damage-result",
    "score",
    "rank",
    "winner",
    "guide-recommendation",
  ];
}

const DEFAULT_ENVIRONMENT: ArtifactGenerationPreflightEnvironment = {
  weaponCandidateDomain: buildMirroredWeaponCandidateDomain(),
  characterWeaponTypes: Object.fromEntries(
    Object.entries(characterStatsInput).map(([characterId, stats]) => [
      characterId,
      stats.weaponType,
    ]),
  ),
  initialFourPieceArtifactSetIds: buildInitialArtifactSetIds(),
};

/**
 * Resolve the minimum explicit inputs required before a source-backed fixture
 * may be passed to the artifact generator.
 *
 * This function performs validation and policy resolution only. It never runs
 * the generator or evaluates damage.
 */
export function buildArtifactGenerationPreflight(
  input: ArtifactGenerationPreflightInput,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
  environment: ArtifactGenerationPreflightEnvironment = DEFAULT_ENVIRONMENT,
): ArtifactGenerationPreflightReport {
  const team = KnowledgeTeamSchema.parse(input.fixture.team);
  const candidateIndex = buildCandidateIndex(
    environment.weaponCandidateDomain.candidates,
  );
  const blockers: ArtifactGenerationPreflightBlocker[] = [];
  const characterIds = team.members.map(({ characterId }) => characterId);
  const uniqueTeamCharacters = new Set(characterIds).size === characterIds.length;
  if (!uniqueTeamCharacters) {
    blockers.push({
      code: "duplicate-team-character",
      message: `Preflight ${team.id} requires four distinct team characters.`,
    });
  }

  const evidenceByCharacter = indexFixtureEvidence(
    input.fixture,
    new Set(characterIds),
    blockers,
  );
  const members = team.members.map((member) =>
    buildMemberPreflight(
      member,
      evidenceByCharacter,
      candidateIndex,
      environment,
      blockers,
    ),
  );

  const formulaDraftMatchesResolvedFixture = validateFormulaDraftBinding(
    team,
    members,
    input.formulaDraft,
    blockers,
  );
  const formulaReadinessMatchesDraft = validateFormulaReadinessBinding(
    input.formulaDraft,
    input.formulaReadiness,
    blockers,
  );

  const formulaPlanSourceMatches =
    input.formulaDraft.sourceTeamRecordId === input.fixture.sourceTeamRecordId &&
    input.formulaReadiness.sourceTeamRecordId ===
      input.formulaDraft.sourceTeamRecordId &&
    input.fixture.sourceTeamRecordId === team.id;
  if (!formulaPlanSourceMatches) {
    blockers.push({
      code: "formula-plan-source-team-mismatch",
      message:
        `Preflight ${team.id} received formula draft/readiness for ` +
        `${input.formulaDraft.sourceTeamRecordId}/${input.formulaReadiness.sourceTeamRecordId}.`,
    });
  }
  if (!input.formulaReadiness.readyForDamageReplay) {
    blockers.push({
      code: "formula-plan-not-ready",
      message:
        `Preflight ${team.id} cannot authorize a reviewed artifact-generator ` +
        `experiment while the formula plan has ` +
        `${input.formulaReadiness.blockers.length} blocker(s).`,
    });
  }

  const gates = {
    uniqueTeamCharacters,
    equipmentComplete: members.every(
      ({ weapon, artifact }) =>
        weapon.weaponId != null && artifact.choice != null,
    ),
    fixtureEvidenceConsistent: members.every(
      ({ fixtureEvidence, blockerCodes }) =>
        fixtureEvidence != null &&
        !blockerCodes.some((code) => code.startsWith("fixture-evidence-")),
    ) &&
      !blockers.some(({ code }) => code.startsWith("fixture-evidence-")),
    refinementsResolved: members.every(
      ({ weapon }) => weapon.experimentRefinement != null,
    ),
    exactCandidatePairs: members.every(
      ({ weapon }) => weapon.exactCandidatePair,
    ),
    nativeTypesCompatible: members.every(
      ({ weapon }) => weapon.nativeTypeCompatibility === "compatible",
    ),
    artifactsInitiallyEnumerated: members.every(
      ({ artifact }) =>
        artifact.initialGrammarCoverage === "enumerated-initially",
    ),
    formulaDraftMatchesResolvedFixture,
    formulaPlanSourceMatches,
    formulaReadinessMatchesDraft,
    formulaPlanReady: input.formulaReadiness.readyForDamageReplay,
  };
  const equipmentReadyForTechnicalProbe = Object.entries(gates)
    .filter(([gate]) => gate !== "formulaPlanReady")
    .every(([, passed]) => passed);
  const readyForReviewedGeneratorExperiment =
    Object.values(gates).every(Boolean) && blockers.length === 0;

  return {
    schemaVersion: 1,
    classification: "artifact-generation-experiment-preflight",
    supportsGuideClaims: false,
    generatedFrom: generatedFrom
      .map((file) => ({ ...file }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    sourceTeamRecordId: team.id,
    fixtureClassification: input.fixture.classification,
    refinementPolicy: { ...COMPARISON_BASELINE_REFINEMENT_POLICY },
    members,
    gates,
    formulaDraftBinding: {
      sourceTeamRecordId: input.formulaDraft.sourceTeamRecordId,
      assumptionClassification: "calculator-fixture-experiment-assumptions",
      characters: input.formulaDraft.assumptions.characters
        .map((assumption) => ({
          characterId: assumption.characterId,
          charLevel: assumption.charLevel,
          constellation: assumption.constellation,
          selectedWeaponId: assumption.selectedWeaponId,
          selectedArtifact: cloneArtifact(assumption.selectedArtifact),
          refinement: assumption.refinement,
          talentLevels: { ...assumption.talentLevels },
        }))
        .sort((left, right) => left.characterId.localeCompare(right.characterId)),
    },
    formulaReadiness: {
      sourceTeamRecordId: input.formulaReadiness.sourceTeamRecordId,
      reviewStatus: input.formulaReadiness.reviewStatus,
      readyForDamageReplay: input.formulaReadiness.readyForDamageReplay,
      positiveDefaultCoverage: {
        total: input.formulaReadiness.positiveDefaultCoverage.total,
        mapped: input.formulaReadiness.positiveDefaultCoverage.mapped,
        unresolved: input.formulaReadiness.positiveDefaultCoverage.unresolved,
        sourceAbsent:
          input.formulaReadiness.positiveDefaultCoverage.sourceAbsent,
        unclassified:
          input.formulaReadiness.positiveDefaultCoverage.unclassified,
      },
      blockers: input.formulaReadiness.blockers.map(cloneFormulaBlocker),
    },
    equipmentReadyForTechnicalProbe,
    readyForReviewedGeneratorExperiment,
    readyForGenerator: readyForReviewedGeneratorExperiment,
    blockers: blockers.sort(compareBlockers),
    cautions: [
      "Resolved refinements are experiment inputs, not source facts or weapon recommendations.",
      "Initial artifact-grammar coverage only proves that the analyzer can name the selected four-piece set.",
      "readyForGenerator is an evidence-policy gate for a reviewed experiment, not a statement that the runtime is merely technically executable.",
      "This preflight runs no artifact generator, damage calculation, ranking, or energy calculation.",
    ],
    prohibitedInterpretations: [
      "generated-build",
      "damage-result",
      "score",
      "rank",
      "winner",
      "guide-recommendation",
    ],
  };
}

interface CandidateIndex {
  byWeaponId: Map<string, MirroredWeaponCandidate[]>;
  byPair: Set<string>;
}

function buildCandidateIndex(
  candidates: readonly MirroredWeaponCandidate[],
): CandidateIndex {
  const byWeaponId = new Map<string, MirroredWeaponCandidate[]>();
  const byPair = new Set<string>();
  for (const candidate of candidates) {
    const pair = candidatePairKey(candidate.weaponId, candidate.refinement);
    if (byPair.has(pair)) {
      throw new Error(`Artifact-generation preflight repeats candidate ${pair}.`);
    }
    byPair.add(pair);
    const existing = byWeaponId.get(candidate.weaponId) ?? [];
    if (
      existing.some(
        ({ rarity, weaponType }) =>
          rarity !== candidate.rarity || weaponType !== candidate.weaponType,
      )
    ) {
      throw new Error(
        `Artifact-generation preflight has inconsistent metadata for ${candidate.weaponId}.`,
      );
    }
    existing.push({ ...candidate });
    byWeaponId.set(candidate.weaponId, existing);
  }
  for (const candidatesForWeapon of byWeaponId.values()) {
    candidatesForWeapon.sort(
      (left, right) => left.refinement - right.refinement,
    );
  }
  return { byWeaponId, byPair };
}

function buildMemberPreflight(
  member: TeamMember,
  evidenceByCharacter: ReadonlyMap<string, FixtureEvidence[]>,
  candidateIndex: CandidateIndex,
  environment: ArtifactGenerationPreflightEnvironment,
  reportBlockers: ArtifactGenerationPreflightBlocker[],
): ArtifactGenerationPreflightMember {
  const memberBlockers: ArtifactGenerationPreflightBlocker[] = [];
  const addBlocker = (
    code: ArtifactGenerationPreflightBlockerCode,
    message: string,
  ) => {
    const blocker = { code, message, characterId: member.characterId };
    memberBlockers.push(blocker);
    reportBlockers.push(blocker);
  };

  const selectedWeapon = member.selectedWeapon;
  const weaponId = selectedWeapon?.weaponId ?? null;
  const weaponCandidates =
    weaponId == null ? [] : (candidateIndex.byWeaponId.get(weaponId) ?? []);
  const candidateRefinements = weaponCandidates.map(
    ({ refinement }) => refinement,
  );
  const candidateMetadata = weaponCandidates[0];
  if (weaponId == null) {
    addBlocker(
      "missing-selected-weapon",
      `Preflight member ${member.characterId} has no selected weapon.`,
    );
  } else if (!candidateMetadata) {
    addBlocker(
      "weapon-outside-released-candidate-domain",
      `Weapon ${weaponId} is outside the released mirrored candidate domain.`,
    );
  }

  const fixtureRefinement = selectedWeapon?.refinement ?? null;
  const experimentRefinement =
    fixtureRefinement ??
    (candidateMetadata == null
      ? null
      : candidateMetadata.rarity <= 4
        ? COMPARISON_BASELINE_REFINEMENT_POLICY.unspecifiedThreeOrFourStar
        : COMPARISON_BASELINE_REFINEMENT_POLICY.unspecifiedFiveStar);
  const refinementOrigin =
    fixtureRefinement != null
      ? ("fixture-explicit" as const)
      : experimentRefinement != null
        ? ("experiment-policy" as const)
        : ("unresolved" as const);
  const exactCandidatePair =
    weaponId != null &&
    experimentRefinement != null &&
    candidateIndex.byPair.has(
      candidatePairKey(weaponId, experimentRefinement),
    );
  if (weaponId != null && experimentRefinement != null && !exactCandidatePair) {
    addBlocker(
      fixtureRefinement == null
        ? "policy-refinement-not-candidate"
        : "explicit-refinement-not-candidate",
      fixtureRefinement == null
        ? `Policy refinement R${experimentRefinement} is not a candidate for ${weaponId}.`
        : `Explicit fixture refinement R${experimentRefinement} is not a candidate for ${weaponId}.`,
    );
  }

  const characterNativeWeaponType =
    environment.characterWeaponTypes[member.characterId] ?? null;
  const weaponTypeFromStats = candidateMetadata?.weaponType ?? null;
  const nativeTypeCompatibility =
    characterNativeWeaponType == null || weaponTypeFromStats == null
      ? ("unknown" as const)
      : characterNativeWeaponType === weaponTypeFromStats
        ? ("compatible" as const)
        : ("mismatched" as const);
  if (characterNativeWeaponType == null) {
    addBlocker(
      "unknown-character-native-weapon-type",
      `Character ${member.characterId} has no native weapon type in released stats.`,
    );
  } else if (
    weaponTypeFromStats != null &&
    nativeTypeCompatibility === "mismatched"
  ) {
    addBlocker(
      "native-weapon-type-mismatch",
      `${member.characterId} uses ${characterNativeWeaponType}, but ${weaponId} is ${weaponTypeFromStats}.`,
    );
  }

  const artifact = classifyArtifact(
    member.selectedArtifact,
    environment.initialFourPieceArtifactSetIds,
  );
  if (artifact.initialGrammarCoverage === "missing") {
    addBlocker(
      "missing-selected-artifact",
      `Preflight member ${member.characterId} has no selected artifact choice.`,
    );
  } else if (artifact.initialGrammarCoverage === "not-enumerated-initially") {
    addBlocker(
      "artifact-not-in-initial-grammar",
      `Artifact choice for ${member.characterId} is not in the initial four-piece grammar.`,
    );
  }

  const evidence = evidenceByCharacter.get(member.characterId) ?? [];
  const singleEvidence = evidence.length === 1 ? evidence[0] : null;
  if (evidence.length === 0) {
    addBlocker(
      "missing-fixture-evidence",
      `Preflight member ${member.characterId} has no equipment evidence.`,
    );
  } else if (evidence.length > 1) {
    addBlocker(
      "duplicate-fixture-evidence",
      `Preflight member ${member.characterId} has ${evidence.length} equipment evidence rows.`,
    );
  }
  if (
    singleEvidence != null &&
    weaponId != null &&
    singleEvidence.weaponId !== weaponId
  ) {
    addBlocker(
      "fixture-evidence-weapon-mismatch",
      `Equipment evidence names ${singleEvidence.weaponId}, not ${weaponId}, for ${member.characterId}.`,
    );
  }
  if (
    singleEvidence != null &&
    member.selectedArtifact != null &&
    !artifactChoicesEqual(
      singleEvidence.build.artifact,
      member.selectedArtifact,
    )
  ) {
    addBlocker(
      "fixture-evidence-artifact-mismatch",
      `Equipment evidence and selected artifact differ for ${member.characterId}.`,
    );
  }

  return {
    characterId: member.characterId,
    fixtureInvestment: cloneInvestment(member.investment),
    weapon: {
      weaponId,
      rarity: candidateMetadata?.rarity ?? null,
      fixtureRefinement,
      experimentRefinement,
      refinementOrigin,
      candidateRefinements,
      exactCandidatePair,
      weaponTypeFromStats,
      characterNativeWeaponType,
      nativeTypeCompatibility,
    },
    artifact,
    fixtureEvidence:
      singleEvidence == null
        ? null
        : {
            characterGuideId: singleEvidence.characterGuideId,
            guideStatus: singleEvidence.guideStatus,
            weaponOrderIndex: singleEvidence.weaponOrderIndex,
            buildSourceRecordId: singleEvidence.buildSourceRecordId,
            guideSourceRefs: singleEvidence.guideSourceRefs.map(
              cloneSourceReference,
            ),
          },
    ready: memberBlockers.length === 0,
    blockerCodes: memberBlockers.map(({ code }) => code).sort(compareText),
  };
}

function indexFixtureEvidence(
  fixture: SourceBackedEquipmentScenario,
  teamCharacterIds: ReadonlySet<string>,
  blockers: ArtifactGenerationPreflightBlocker[],
): Map<string, FixtureEvidence[]> {
  const byCharacter = new Map<string, FixtureEvidence[]>();
  for (const evidence of fixture.evidence) {
    if (!teamCharacterIds.has(evidence.characterId)) {
      blockers.push({
        code: "fixture-evidence-for-non-member",
        characterId: evidence.characterId,
        message: `Equipment evidence names non-member ${evidence.characterId}.`,
      });
      continue;
    }
    const rows = byCharacter.get(evidence.characterId) ?? [];
    rows.push(evidence);
    byCharacter.set(evidence.characterId, rows);
  }
  return byCharacter;
}

function validateFormulaDraftBinding(
  team: KnowledgeTeam,
  members: readonly ArtifactGenerationPreflightMember[],
  draft: FormulaPlanDraftOutput,
  blockers: ArtifactGenerationPreflightBlocker[],
): boolean {
  if (draft.sourceTeamRecordId !== team.id) {
    blockers.push({
      code: "formula-draft-source-team-mismatch",
      message: `Formula draft ${draft.sourceTeamRecordId} does not belong to ${team.id}.`,
    });
  }

  const assumptionsByCharacter = new Map<
    string,
    FormulaPlanDraftOutput["assumptions"]["characters"]
  >();
  for (const assumption of draft.assumptions.characters) {
    const rows = assumptionsByCharacter.get(assumption.characterId) ?? [];
    rows.push(assumption);
    assumptionsByCharacter.set(assumption.characterId, rows);
  }
  const teamIds = members.map(({ characterId }) => characterId).sort(compareText);
  const draftIds = draft.assumptions.characters
    .map(({ characterId }) => characterId)
    .sort(compareText);
  if (
    teamIds.length !== draftIds.length ||
    teamIds.some((characterId, index) => characterId !== draftIds[index])
  ) {
    blockers.push({
      code: "formula-draft-member-mismatch",
      message:
        `Formula draft characters (${draftIds.join(", ")}) do not exactly match ` +
        `fixture characters (${teamIds.join(", ")}).`,
    });
  }

  for (const member of members) {
    const assumptions = assumptionsByCharacter.get(member.characterId) ?? [];
    if (assumptions.length !== 1) {
      blockers.push({
        code: "formula-draft-member-mismatch",
        characterId: member.characterId,
        message: `Formula draft has ${assumptions.length} rows for ${member.characterId}.`,
      });
      continue;
    }
    const assumption = assumptions[0];
    if (
      member.weapon.weaponId == null ||
      assumption.selectedWeaponId !== member.weapon.weaponId ||
      member.artifact.choice == null ||
      !artifactChoicesEqual(
        assumption.selectedArtifact,
        member.artifact.choice,
      )
    ) {
      blockers.push({
        code: "formula-draft-equipment-mismatch",
        characterId: member.characterId,
        message: `Formula draft equipment does not match the resolved fixture for ${member.characterId}.`,
      });
    }
    if (
      member.weapon.experimentRefinement == null ||
      assumption.refinement !== member.weapon.experimentRefinement
    ) {
      blockers.push({
        code: "formula-draft-refinement-mismatch",
        characterId: member.characterId,
        message:
          `Formula draft refinement R${assumption.refinement} does not match ` +
        `the resolved fixture refinement for ${member.characterId}.`,
      });
    }
    const fixtureMember = team.members.find(
      ({ characterId }) => characterId === member.characterId,
    );
    if (
      fixtureMember != null &&
      !investmentMatchesAssumption(fixtureMember.investment, assumption)
    ) {
      blockers.push({
        code: "formula-draft-investment-mismatch",
        characterId: member.characterId,
        message:
          `Formula draft investment assumptions conflict with explicit fixture ` +
          `investment for ${member.characterId}.`,
      });
    }
  }

  return !blockers.some(({ code }) => code.startsWith("formula-draft-"));
}

function validateFormulaReadinessBinding(
  draft: FormulaPlanDraftOutput,
  readiness: FormulaPlanReadinessAssessment,
  blockers: ArtifactGenerationPreflightBlocker[],
): boolean {
  const expectedAvailable = [
    ...draft.lines.map(({ characterId, formulaId, count }) => ({
      characterId,
      formulaId,
      count,
    })),
    ...draft.zeroCountAvailableFormulas.map(({ characterId, formulaId }) => ({
      characterId,
      formulaId,
      count: 0,
    })),
  ];
  const expectedPositive = draft.lines.map(
    ({ characterId, formulaId, count }) => ({
      characterId,
      formulaId,
      count,
    }),
  );
  const actualAvailable = readiness.availableFormulaCoverage.rows.map(
    ({ characterId, formulaId, calculatorDefaultCount }) => ({
      characterId,
      formulaId,
      count: calculatorDefaultCount,
    }),
  );
  const actualPositive = readiness.positiveDefaultCoverage.rows.map(
    ({ characterId, formulaId, calculatorDefaultCount }) => ({
      characterId,
      formulaId,
      count: calculatorDefaultCount,
    }),
  );
  const matches =
    formulaInventorySignature(expectedAvailable) ===
      formulaInventorySignature(actualAvailable) &&
    formulaInventorySignature(expectedPositive) ===
      formulaInventorySignature(actualPositive) &&
    readiness.availableFormulaCoverage.total === actualAvailable.length &&
    readiness.positiveDefaultCoverage.total === actualPositive.length;
  if (!matches) {
    blockers.push({
      code: "formula-readiness-draft-mismatch",
      message:
        `Formula readiness inventory does not match formula draft ` +
        `${draft.sourceTeamRecordId}.`,
    });
  }
  return matches;
}

function formulaInventorySignature(
  rows: readonly { characterId: string; formulaId: string; count: number }[],
): string {
  return rows
    .map(({ characterId, formulaId, count }) =>
      JSON.stringify([characterId, formulaId, count]),
    )
    .sort(compareText)
    .join("\n");
}

function investmentMatchesAssumption(
  investment: TeamMember["investment"],
  assumption: FormulaPlanDraftOutput["assumptions"]["characters"][number],
): boolean {
  if (investment.status === "unspecified") return true;
  if (
    investment.constellation != null &&
    investment.constellation !== assumption.constellation
  ) {
    return false;
  }
  if (investment.talentLevels != null) {
    const [auto, skill, burst] = investment.talentLevels;
    if (
      auto !== assumption.talentLevels.auto ||
      skill !== assumption.talentLevels.skill ||
      burst !== assumption.talentLevels.burst
    ) {
      return false;
    }
  }
  return true;
}

function classifyArtifact(
  artifact: ArtifactChoice | null,
  initialFourPieceArtifactSetIds: ReadonlySet<string>,
): ArtifactGenerationPreflightMember["artifact"] {
  if (artifact == null) {
    return { choice: null, initialGrammarCoverage: "missing" };
  }
  const choice = cloneArtifact(artifact);
  if (artifact.type === "2pc+2pc") {
    return {
      choice,
      initialGrammarCoverage: "not-enumerated-initially",
      failureReason: "two-piece-choice-is-not-in-initial-grammar",
    };
  }
  if (!initialFourPieceArtifactSetIds.has(artifact.setId)) {
    return {
      choice,
      initialGrammarCoverage: "not-enumerated-initially",
      failureReason: "four-piece-set-is-not-in-initial-grammar",
    };
  }
  return { choice, initialGrammarCoverage: "enumerated-initially" };
}

function buildInitialArtifactSetIds(): ReadonlySet<string> {
  const setIds = buildArtifactSetChoiceCandidates().map((candidate) => {
    if (candidate.artifactSet.type !== "4pc") {
      throw new Error(
        "Artifact-generation preflight expected an initial four-piece candidate.",
      );
    }
    return candidate.artifactSet.setId;
  });
  const betaLeaks = setIds.filter((setId) => betaArtifactIds.has(setId));
  if (betaLeaks.length > 0) {
    throw new Error(
      `Artifact-generation preflight initial grammar contains beta sets: ${betaLeaks.join(", ")}.`,
    );
  }
  if (new Set(setIds).size !== setIds.length) {
    throw new Error(
      "Artifact-generation preflight initial grammar repeats an artifact set.",
    );
  }
  return new Set(setIds);
}

function cloneFormulaBlocker(
  blocker: FormulaPlanReadinessBlocker,
): FormulaPlanReadinessBlocker {
  return { ...blocker };
}

function cloneArtifact(artifact: ArtifactChoice): ArtifactChoice {
  return artifact.type === "4pc"
    ? { type: "4pc", setId: artifact.setId }
    : {
        type: "2pc+2pc",
        halfSetIds: [artifact.halfSetIds[0], artifact.halfSetIds[1]],
      };
}

function artifactChoicesEqual(
  left: ArtifactChoice,
  right: ArtifactChoice,
): boolean {
  return JSON.stringify(cloneArtifact(left)) === JSON.stringify(cloneArtifact(right));
}

function cloneInvestment(
  investment: TeamMember["investment"],
): TeamMember["investment"] {
  if (investment.status === "unspecified") return { status: "unspecified" };
  if (investment.status === "partial") {
    return {
      status: "partial",
      ...(investment.constellation == null
        ? {}
        : { constellation: investment.constellation }),
      ...(investment.talentLevels == null
        ? {}
        : { talentLevels: [...investment.talentLevels] }),
    };
  }
  return {
    status: "specified",
    constellation: investment.constellation,
    talentLevels: [...investment.talentLevels],
  };
}

function cloneSourceReference(
  reference: FixtureEvidence["guideSourceRefs"][number],
): FixtureEvidence["guideSourceRefs"][number] {
  return { ...reference, locator: { ...reference.locator } };
}

function candidatePairKey(weaponId: string, refinement: number): string {
  return `${weaponId}@R${refinement}`;
}

function compareBlockers(
  left: ArtifactGenerationPreflightBlocker,
  right: ArtifactGenerationPreflightBlocker,
): number {
  return (
    compareText(left.code, right.code) ||
    compareText(left.characterId ?? "", right.characterId ?? "") ||
    compareText(left.message, right.message)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
