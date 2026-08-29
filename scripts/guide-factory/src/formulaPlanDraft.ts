import type { ArtifactSetConfig } from "@/data/types";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TalentLevels, TeamSlotConfig } from "@/lib/dmgcalc/types";
import { bootstrapGuideFactoryComputation } from "./computationReplay";
import { KnowledgeTeamSchema, type KnowledgeRecord } from "./schemas";
import { investmentMatchesConcreteAssumption } from "./teamMemberInvestment";

export type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;

export type FormulaPlanCharacterAssumption = {
  charLevel: number;
  constellation: number;
  refinement: number;
  talentLevels: TalentLevels;
};

export type FormulaPlanDraftInput = {
  team: KnowledgeTeam;
  assumptions: Record<string, FormulaPlanCharacterAssumption>;
};

export type FormulaPlanDraftLine = {
  characterId: string;
  formulaId: string;
  count: number;
};

export type SourceTranslatedFormulaPlanLine = FormulaPlanDraftLine & {
  mappingBasis: string;
};

export type SourceFormulaCountClaim =
  | { type: "exact"; value: number }
  | { type: "range"; minimum: number; maximum: number };

export type SourceFormulaCountClaimLine = Omit<
  FormulaPlanDraftLine,
  "count"
> & {
  countClaim: SourceFormulaCountClaim;
  sourceTokenCoverage: "complete" | "partial";
  mappingBasis: string;
};

export type FormulaPlanCountComparison = {
  characterId: string;
  formulaId: string;
  sourceTranslatedCount: number;
  calculatorDefaultCount: number;
  relation:
    | "matches"
    | "source-translation-higher"
    | "calculator-default-higher";
  mappingBasis: string;
};

export type FormulaCountClaimComparison = {
  characterId: string;
  formulaId: string;
  sourceCountClaim: SourceFormulaCountClaim;
  calculatorDefaultCount: number;
  relation:
    | "matches"
    | "source-translation-higher"
    | "calculator-default-higher"
    | "calculator-default-within-source-range"
    | "calculator-default-below-source-range"
    | "calculator-default-above-source-range";
  sourceTokenCoverage: "complete" | "partial";
  mappingBasis: string;
};

export type FormulaPlanDraftOutput = {
  schemaVersion: 1;
  classification: "calculator-default-draft";
  supportsGuideClaims: false;
  sourceTeamRecordId: string;
  assumptions: {
    combatOptions: "calculator-defaults";
    characters: Array<
      FormulaPlanCharacterAssumption & {
        characterId: string;
        selectedWeaponId: string;
        selectedArtifact: ArtifactSetConfig;
      }
    >;
  };
  cautions: string[];
  lines: FormulaPlanDraftLine[];
  zeroCountAvailableFormulas: Array<{
    characterId: string;
    formulaId: string;
  }>;
};

const CAUTIONS = [
  "Formula counts come from calculator comboDescriptor implementation defaults, not source-reviewed rotation truth.",
  "This draft does not establish an optimal rotation, buff sequence, field-time plan, ER feasibility, or guide recommendation.",
  "Calculator combat options use their implementation defaults because the knowledge team does not provide option selections.",
  "Constellation- or option-gated formulas unavailable under the explicit assumptions are checked for catalog integrity but omitted from the draft.",
] as const;

/**
 * Turn one exact consolidated team into a calculator-default formula-count draft.
 *
 * This seam deliberately exposes calculator implementation defaults without
 * treating them as evidence. Every formula currently available at the supplied
 * investment appears exactly once: positive defaults in `lines`, and all other
 * available formulas in `zeroCountAvailableFormulas`.
 */
export async function draftCalculatorDefaultFormulaPlan(
  input: FormulaPlanDraftInput
): Promise<FormulaPlanDraftOutput> {
  const team = KnowledgeTeamSchema.parse(input.team);
  const teamConfigs = buildTeamConfigs(team, input.assumptions);

  await bootstrapGuideFactoryComputation();

  const teamBuild = new TeamBuild(teamConfigs, {});
  const availableByCharacter = teamBuild.catalog.getFormulaIds();
  const allByCharacter = teamBuild.catalog.getAllFormulaIds();
  const lines: FormulaPlanDraftLine[] = [];
  const zeroCountAvailableFormulas: FormulaPlanDraftOutput["zeroCountAvailableFormulas"] =
    [];

  for (const config of teamConfigs) {
    const characterId = config.charId;
    const combo = teamBuild.catalog.getCombo(characterId);
    const allFormulas = allByCharacter[characterId];
    const availableFormulas = availableByCharacter[characterId];
    if (!allFormulas || !availableFormulas) {
      throw new Error(
        `Formula-plan draft ${team.id}: calculator has no formula catalog for ${characterId}.`
      );
    }

    for (const formulaId of Object.keys(combo).sort()) {
      if (!allFormulas[formulaId]) {
        throw new Error(
          `Formula-plan draft ${team.id}: comboDescriptor formula ` +
            `${characterId}.${formulaId} does not exist in the calculator catalog.`
        );
      }
      requireNonNegativeFiniteCount(
        team.id,
        characterId,
        formulaId,
        combo[formulaId]
      );
    }

    for (const formulaId of Object.keys(availableFormulas).sort()) {
      const count = combo[formulaId] ?? 0;
      requireNonNegativeFiniteCount(team.id, characterId, formulaId, count);
      if (count > 0) {
        lines.push({ characterId, formulaId, count });
      } else {
        zeroCountAvailableFormulas.push({ characterId, formulaId });
      }
    }
  }

  return {
    schemaVersion: 1,
    classification: "calculator-default-draft",
    supportsGuideClaims: false,
    sourceTeamRecordId: team.id,
    assumptions: {
      combatOptions: "calculator-defaults",
      characters: teamConfigs.map((config) => ({
        characterId: config.charId,
        charLevel: config.charLevel,
        constellation: config.constellation,
        selectedWeaponId: config.weaponId,
        refinement: config.refinement,
        selectedArtifact: cloneArtifactSet(config.artifactSet),
        talentLevels: { ...requiredTalentLevels(config) },
      })),
    },
    cautions: [...CAUTIONS],
    lines,
    zeroCountAvailableFormulas,
  };
}

/**
 * Compare a manually translated source rotation with calculator defaults.
 *
 * This validates only formula availability and count syntax. It does not prove
 * that the source action-to-formula mapping is correct; callers must retain
 * mapping notes and a separate review state for that judgment.
 */
export function compareSourceTranslatedFormulaPlan(
  draft: FormulaPlanDraftOutput,
  sourceLines: SourceTranslatedFormulaPlanLine[]
): {
  formulaComparisons: FormulaPlanCountComparison[];
  mismatches: FormulaPlanCountComparison[];
} {
  const calculatorCounts = calculatorFormulaCounts(draft);
  const seen = new Set<string>();
  const formulaComparisons = sourceLines
    .map((sourceLine): FormulaPlanCountComparison => {
      const key = `${sourceLine.characterId}\0${sourceLine.formulaId}`;
      if (seen.has(key)) {
        throw new Error(
          `Source-translated formula plan repeats ${sourceLine.characterId}.${sourceLine.formulaId}.`
        );
      }
      seen.add(key);
      if (!Number.isFinite(sourceLine.count) || sourceLine.count <= 0) {
        throw new Error(
          `Source-translated formula plan ${sourceLine.characterId}.${sourceLine.formulaId} count must be positive and finite.`
        );
      }
      if (!sourceLine.mappingBasis.trim()) {
        throw new Error(
          `Source-translated formula plan ${sourceLine.characterId}.${sourceLine.formulaId} requires a mapping basis.`
        );
      }
      const calculatorDefaultCount = calculatorCounts.get(key);
      if (calculatorDefaultCount == null) {
        throw new Error(
          `Source-translated formula plan references unavailable calculator formula ${sourceLine.characterId}.${sourceLine.formulaId}.`
        );
      }
      const relation =
        sourceLine.count === calculatorDefaultCount
          ? "matches"
          : sourceLine.count > calculatorDefaultCount
            ? "source-translation-higher"
            : "calculator-default-higher";
      return {
        characterId: sourceLine.characterId,
        formulaId: sourceLine.formulaId,
        sourceTranslatedCount: sourceLine.count,
        calculatorDefaultCount,
        relation,
        mappingBasis: sourceLine.mappingBasis,
      };
    })
    .sort(
      (left, right) =>
        left.characterId.localeCompare(right.characterId) ||
        left.formulaId.localeCompare(right.formulaId)
    );

  return {
    formulaComparisons,
    mismatches: formulaComparisons.filter(
      ({ relation }) => relation !== "matches"
    ),
  };
}

/**
 * Compare source count claims that can be exact or branch-dependent ranges.
 *
 * This still validates only formula availability and count syntax. A range
 * records uncertainty already present in the source rotation; it is not a
 * license to tune the range around a calculator default. `sourceTokenCoverage`
 * also makes partial mappings such as the Charged Attack portion of N1C
 * explicit without claiming that the full source token was represented.
 */
export function compareSourceFormulaCountClaims(
  draft: FormulaPlanDraftOutput,
  sourceLines: SourceFormulaCountClaimLine[]
): {
  formulaComparisons: FormulaCountClaimComparison[];
  discrepancies: FormulaCountClaimComparison[];
} {
  const calculatorCounts = calculatorFormulaCounts(draft);
  const seen = new Set<string>();
  const formulaComparisons = sourceLines
    .map((sourceLine): FormulaCountClaimComparison => {
      const key = `${sourceLine.characterId}\0${sourceLine.formulaId}`;
      if (seen.has(key)) {
        throw new Error(
          `Source formula count claims repeat ${sourceLine.characterId}.${sourceLine.formulaId}.`
        );
      }
      seen.add(key);
      if (!sourceLine.mappingBasis.trim()) {
        throw new Error(
          `Source formula count claim ${sourceLine.characterId}.${sourceLine.formulaId} requires a mapping basis.`
        );
      }
      if (
        sourceLine.sourceTokenCoverage !== "complete" &&
        sourceLine.sourceTokenCoverage !== "partial"
      ) {
        throw new Error(
          `Source formula count claim ${sourceLine.characterId}.${sourceLine.formulaId} has invalid source-token coverage.`
        );
      }
      const calculatorDefaultCount = calculatorCounts.get(key);
      if (calculatorDefaultCount == null) {
        throw new Error(
          `Source formula count claim references unavailable calculator formula ${sourceLine.characterId}.${sourceLine.formulaId}.`
        );
      }
      const sourceCountClaim = validateAndCloneSourceCountClaim(
        sourceLine.characterId,
        sourceLine.formulaId,
        sourceLine.countClaim
      );
      const relation = compareCountClaim(
        sourceCountClaim,
        calculatorDefaultCount
      );
      return {
        characterId: sourceLine.characterId,
        formulaId: sourceLine.formulaId,
        sourceCountClaim,
        calculatorDefaultCount,
        relation,
        sourceTokenCoverage: sourceLine.sourceTokenCoverage,
        mappingBasis: sourceLine.mappingBasis,
      };
    })
    .sort(
      (left, right) =>
        left.characterId.localeCompare(right.characterId) ||
        left.formulaId.localeCompare(right.formulaId)
    );

  return {
    formulaComparisons,
    discrepancies: formulaComparisons.filter(
      ({ relation }) =>
        relation !== "matches" &&
        relation !== "calculator-default-within-source-range"
    ),
  };
}

function calculatorFormulaCounts(
  draft: FormulaPlanDraftOutput
): Map<string, number> {
  return new Map(
    [
      ...draft.lines,
      ...draft.zeroCountAvailableFormulas.map((line) => ({
        ...line,
        count: 0,
      })),
    ].map((line) => [`${line.characterId}\0${line.formulaId}`, line.count])
  );
}

function validateAndCloneSourceCountClaim(
  characterId: string,
  formulaId: string,
  countClaim: SourceFormulaCountClaim
): SourceFormulaCountClaim {
  if (countClaim.type === "exact") {
    if (!Number.isFinite(countClaim.value) || countClaim.value <= 0) {
      throw new Error(
        `Source formula count claim ${characterId}.${formulaId} exact value must be positive and finite.`
      );
    }
    return { type: "exact", value: countClaim.value };
  }

  if (
    !Number.isFinite(countClaim.minimum) ||
    !Number.isFinite(countClaim.maximum) ||
    countClaim.minimum < 0 ||
    countClaim.maximum <= 0 ||
    countClaim.minimum >= countClaim.maximum
  ) {
    throw new Error(
      `Source formula count claim ${characterId}.${formulaId} range must have finite 0 <= minimum < maximum.`
    );
  }
  return {
    type: "range",
    minimum: countClaim.minimum,
    maximum: countClaim.maximum,
  };
}

function compareCountClaim(
  countClaim: SourceFormulaCountClaim,
  calculatorDefaultCount: number
): FormulaCountClaimComparison["relation"] {
  if (countClaim.type === "exact") {
    if (countClaim.value === calculatorDefaultCount) return "matches";
    return countClaim.value > calculatorDefaultCount
      ? "source-translation-higher"
      : "calculator-default-higher";
  }
  if (calculatorDefaultCount < countClaim.minimum) {
    return "calculator-default-below-source-range";
  }
  if (calculatorDefaultCount > countClaim.maximum) {
    return "calculator-default-above-source-range";
  }
  return "calculator-default-within-source-range";
}

function buildTeamConfigs(
  team: KnowledgeTeam,
  assumptions: Record<string, FormulaPlanCharacterAssumption>
): TeamSlotConfig[] {
  if (team.members.length !== 4) {
    throw new Error(
      `Formula-plan draft ${team.id}: an exact team must contain four members.`
    );
  }

  const characterIds = team.members.map((member) => member.characterId);
  if (new Set(characterIds).size !== 4) {
    throw new Error(
      `Formula-plan draft ${team.id}: team characters must be unique.`
    );
  }

  const assumptionIds = Object.keys(assumptions).sort();
  const expectedIds = [...characterIds].sort();
  if (assumptionIds.join("\0") !== expectedIds.join("\0")) {
    throw new Error(
      `Formula-plan draft ${team.id}: assumptions must exactly match team ` +
        `characters (${expectedIds.join(", ")}).`
    );
  }

  const configs = team.members.map((member): TeamSlotConfig => {
    if (!member.selectedWeapon) {
      throw new Error(
        `Formula-plan draft ${team.id}: ${member.characterId} requires a selected weapon.`
      );
    }
    if (!member.selectedArtifact) {
      throw new Error(
        `Formula-plan draft ${team.id}: ${member.characterId} requires a selected artifact set.`
      );
    }

    const assumption = assumptions[member.characterId];
    validateAssumption(team.id, member.characterId, assumption);
    if (
      !investmentMatchesConcreteAssumption(member.investment, assumption)
    ) {
      throw new Error(
        `Formula-plan draft ${team.id}: concrete investment assumptions for ` +
          `${member.characterId} conflict with the team's explicit investment.`,
      );
    }
    return {
      charId: member.characterId,
      charLevel: assumption.charLevel,
      constellation: assumption.constellation,
      weaponId: member.selectedWeapon.weaponId,
      refinement: assumption.refinement,
      artifactSet: cloneArtifactSet(member.selectedArtifact),
      talentLevels: { ...assumption.talentLevels },
    };
  });

  return configs;
}

function validateAssumption(
  teamId: string,
  characterId: string,
  assumption: FormulaPlanCharacterAssumption | undefined
): asserts assumption is FormulaPlanCharacterAssumption {
  if (!assumption) {
    throw new Error(
      `Formula-plan draft ${teamId}: missing assumptions for ${characterId}.`
    );
  }
  requireIntegerRange(
    teamId,
    characterId,
    "charLevel",
    assumption.charLevel,
    1,
    100
  );
  requireIntegerRange(
    teamId,
    characterId,
    "constellation",
    assumption.constellation,
    0,
    6
  );
  requireIntegerRange(
    teamId,
    characterId,
    "refinement",
    assumption.refinement,
    1,
    5
  );
  const talentKeys = assumption.talentLevels
    ? Object.keys(assumption.talentLevels).sort()
    : [];
  if (talentKeys.join("\0") !== "auto\0burst\0skill") {
    throw new Error(
      `Formula-plan draft ${teamId}: ${characterId} must explicitly specify ` +
        "auto, skill, and burst talent levels."
    );
  }
  for (const [talent, level] of Object.entries(assumption.talentLevels)) {
    requireIntegerRange(
      teamId,
      characterId,
      `talentLevels.${talent}`,
      level,
      1,
      15
    );
  }
}

function requireIntegerRange(
  teamId: string,
  characterId: string,
  field: string,
  value: number,
  minimum: number,
  maximum: number
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Formula-plan draft ${teamId}: ${characterId}.${field} must be an ` +
        `integer from ${minimum} to ${maximum}.`
    );
  }
}

function requireNonNegativeFiniteCount(
  teamId: string,
  characterId: string,
  formulaId: string,
  count: number
): void {
  if (!Number.isFinite(count) || count < 0) {
    throw new Error(
      `Formula-plan draft ${teamId}: ${characterId}.${formulaId} has invalid ` +
        `calculator-default count ${count}.`
    );
  }
}

function cloneArtifactSet(
  artifactSet: ArtifactSetConfig | null
): ArtifactSetConfig {
  if (!artifactSet) {
    throw new Error("Formula-plan draft requires a selected artifact set.");
  }
  return artifactSet.type === "4pc"
    ? { ...artifactSet }
    : { ...artifactSet, halfSetIds: [...artifactSet.halfSetIds] };
}

function requiredTalentLevels(config: TeamSlotConfig): TalentLevels {
  if (!config.talentLevels) {
    throw new Error(
      `Formula-plan draft: ${config.charId} is missing explicit talent levels.`
    );
  }
  return config.talentLevels;
}
