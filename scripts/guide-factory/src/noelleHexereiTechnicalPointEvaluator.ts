import { createHash } from "node:crypto";

import { betaEnabled } from "@/data/betaState";
import { charInfo } from "@/data/charInfo";
import type { MainStat, StatKey } from "@/data/enums";
import { getTalentParam } from "@/data/gameStatsLoader";
import type { StatEntry } from "@/data/types";
import { AVG_SUBSTAT_ROLL } from "@/lib/artifact/scoring/constants";
import {
  getMainStatValueAtLevel,
  toInternal,
} from "@/lib/artifact/scoring/utils";
import { buildBuffOverrides } from "@/lib/dmgcalc/core/comboBuffOverrides";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/dmgcalc/core/formulaCompiler";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type {
  BuffActivationMap,
  CalcContext,
  ComboFormula,
  DamageTag,
  FormulaEntry,
  OptionMap,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import { bootstrapGuideFactoryComputation } from "./computationReplay";
import {
  withScopedFormulaPartProjection,
  type FormulaPartProjectionSpec,
} from "./formulaPartProjection";
import { stableJson } from "./io";
import { NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST } from "./noelleHexereiEquipmentResponseSurface";

const ABSOLUTE_TOLERANCE = 1e-9;
const RELATIVE_TOLERANCE = 1e-12;

export const NOELLE_HEXEREI_POINT_WITNESSES =
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST.investmentWitnesses;
export type NoelleHexereiTechnicalPointWitness =
  (typeof NOELLE_HEXEREI_POINT_WITNESSES)[number];
export type NoelleHexereiTechnicalPointWitnessId =
  NoelleHexereiTechnicalPointWitness["witnessId"];
export type NoelleHexereiTechnicalPointProfileId =
  NoelleHexereiTechnicalPointWitness["profileId"];

export const NOELLE_HEXEREI_POINT_CIRCLET_STATS = ["cr", "cd"] as const;
export type NoelleHexereiTechnicalPointCircletStat =
  (typeof NOELLE_HEXEREI_POINT_CIRCLET_STATS)[number];

export const NOELLE_HEXEREI_POINT_REFINEMENTS = [1, 5] as const;
export type NoelleHexereiTechnicalPointRefinement =
  (typeof NOELLE_HEXEREI_POINT_REFINEMENTS)[number];

export const NOELLE_HEXEREI_POINT_NICOLE_MODES = [
  "all-theosis",
  "hexerei-theosis",
] as const;
export type NoelleHexereiTechnicalPointNicoleMode =
  (typeof NOELLE_HEXEREI_POINT_NICOLE_MODES)[number];

export const NOELLE_HEXEREI_POINT_HUSK_STACKS = [4, 0] as const;
export type NoelleHexereiTechnicalPointHuskStacks =
  (typeof NOELLE_HEXEREI_POINT_HUSK_STACKS)[number];

export const NOELLE_HEXEREI_POINT_PROBE_STATS = [
  "cr",
  "cd",
  "atk%",
  "def%",
] as const;
export type NoelleHexereiTechnicalPointProbeStat =
  (typeof NOELLE_HEXEREI_POINT_PROBE_STATS)[number];

export const NOELLE_HEXEREI_POINT_AVERAGE_ROLLS = {
  cr: AVG_SUBSTAT_ROLL.cr,
  cd: AVG_SUBSTAT_ROLL.cd,
  "atk%": AVG_SUBSTAT_ROLL["atk%"],
  "def%": AVG_SUBSTAT_ROLL["def%"],
} as const;

const NOELLE_GEO_NORMAL_TAG = {
  element: "Geo",
  ability: "normal",
  reaction: "none",
} as const satisfies DamageTag;

const NOELLE_PREFIX_PROJECTION_SPEC = {
  formulaId: "noelle-na",
  ownerCharId: "noelle",
  expectedOriginalPartCount: 4,
  projectedParts: [
    { sourcePartIndex: 0, hits: 5, semanticLabel: "N1" },
    { sourcePartIndex: 1, hits: 5, semanticLabel: "N2" },
    { sourcePartIndex: 2, hits: 3, semanticLabel: "N3" },
  ],
} as const satisfies FormulaPartProjectionSpec;

const TECHNICAL_COMBO = {
  id: "noelle-prefix-local-stat-priority-point",
  label: {
    en: "Noelle local-stat priority point",
    zh: "诺艾尔局部词条优先级单元",
  },
  lines: [
    {
      charId: "noelle",
      formulaId: "noelle-na",
      count: 1,
      forceOnField: true,
    },
  ],
} as const satisfies ComboFormula;

const TEAMMATE_FIXTURES =
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST.teammateFixtures;

export interface NoelleHexereiTechnicalPointRequest {
  witnessId: NoelleHexereiTechnicalPointWitnessId;
  sourceAlignedSands: "atk%" | "def%";
  circlet: NoelleHexereiTechnicalPointCircletStat;
  refinement: NoelleHexereiTechnicalPointRefinement;
  nicoleMode: NoelleHexereiTechnicalPointNicoleMode;
  huskStacks: NoelleHexereiTechnicalPointHuskStacks;
  probeStat: NoelleHexereiTechnicalPointProbeStat | null;
}

export interface NoelleHexereiTechnicalPointBuffTraceRow {
  providerCharId: string;
  buffKey: string;
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  implementationClass: string;
  staticEntries: StatEntry[];
  dynamicPhase: "none" | "mid" | "post";
  resolvedDynamicEntries: StatEntry[];
}

export interface NoelleHexereiTechnicalPointSheetEntry extends StatEntry {
  filterKey: string;
}

export interface NoelleHexereiTechnicalPointEvaluation {
  evaluationId: string;
  evaluationInputSha256: string;
  request: NoelleHexereiTechnicalPointRequest;
  witness: {
    profileId: NoelleHexereiTechnicalPointProfileId;
    constellation: 0 | 5 | 6;
    enteredTalentLevels: { auto: 10; skill: 1; burst: 9 | 10 };
    runtimeEffectiveTalentLevels: {
      auto: 10;
      skill: 1 | 4;
      burst: 9 | 10 | 12 | 13;
    };
    sourcePredicateSatisfiedByEnteredFacts: true;
    runtimeTalentEvidence: {
      expectedLevelsDerivedFromAuthenticatedCharacterMetadata: true;
      autoFormulaMultipliersMatchExpectedLevel: true;
      burstConversionMatchesExpectedLevel: true;
      skillLevelNotUsedByObjective: true;
    };
  };
  probe: {
    stat: NoelleHexereiTechnicalPointProbeStat | null;
    value: number;
    valueOrigin:
      | "not-applicable-baseline"
      | "current-AVG_SUBSTAT_ROLL-application-constant";
    independentOneRollNeighbor: boolean;
  };
  artifactSheet: {
    mainStats: [
      "hp",
      "atk",
      "atk%" | "def%",
      "geo%",
      NoelleHexereiTechnicalPointCircletStat,
    ];
    normalizedEntries: NoelleHexereiTechnicalPointSheetEntry[];
    normalizedEntriesSha256: string;
    substatEntryCount: 0 | 1;
    legalCompleteArtifactBuild: false;
  };
  runtimeTrace: {
    registeredBuffCount: number;
    registeredBuffLedgerSha256: string;
    applicableBuffCountForOnFieldNoelle: number;
    applicableBuffTraceSha256: string;
    buffTrace: NoelleHexereiTechnicalPointBuffTraceRow[];
    computedBuffOverrideKeys: string[];
    computedBuffOverrideCountDoesNotRepresentApplicableBuffCount: true;
    gestBuffCount: 3;
    gestDamageBonus: 0.3 | 0.62;
    gestCritDamage: 0.3 | 0.62;
    gestAttackSpeed: 0.1;
    huskCuriosityBuffCount: 0 | 1;
    huskDefenseBonus: 0 | 0.24;
    huskGeoDamageBonus: 0 | 0.24;
    huskFourPieceConfigured: true;
    huskTwoPieceDefenseBonus: 0.3;
    huskTwoPieceControlTeamBuildMaterialized: true;
    geoResonanceBuffCount: 2;
    geoResonanceDamageBonus: 0.15;
    geoResonanceResistanceReduction: 0.2;
    nicoleTheosisUpliftApplicableCountForNoelle: 0 | 1;
    nicoleTheosisUpliftRegisteredCount: 1;
    nicoleTheosisUpliftRegisteredTarget:
      | { receiver: "team" }
      | { receiver: "team"; factions: ["Hexerei"] };
    nicoleBaseKenosisApplicableCountForNoelle: 1;
    teammateWeaponBuffCount: 0;
    exactRequiredBuffValuesVerified: true;
    compilerVariableCount: number;
    compilerNoelleCharacterIndex: number;
    compilerErConstraintPresent: false;
  };
  formulaProjection: {
    projectedPartHits: [5, 5, 3];
    omittedPartIndexes: [3];
    originalEntryIdentityRestored: true;
    formulaIndexSizeRestored: true;
    formulaIndexOrderAndEntryIdentitiesRestored: true;
  };
  objective: {
    directTotal: number;
    compiledTotal: number;
    absoluteDifference: number;
    allowedDifference: number;
    directCompiledAgreement: true;
    resolvedNoelleStats: {
      atk: number;
      def: number;
      cr: number;
      cd: number;
      geoNormalDamageBonus: number;
    };
    numericClassification: "technical-fixture-local-only";
  };
  evaluationSha256: string;
}

export async function evaluateNoelleHexereiTechnicalPoint(
  request: NoelleHexereiTechnicalPointRequest,
): Promise<NoelleHexereiTechnicalPointEvaluation> {
  assertNonBetaRuntime();
  assertAverageRollConstants();
  assertRequestAxes(request);
  await bootstrapGuideFactoryComputation();

  const witness = requireWitness(request.witnessId);
  assertWitnessBoundary(witness, request);
  const runtimeEffectiveTalentLevels =
    deriveExpectedRuntimeEffectiveTalentLevels(witness);
  const probeValue =
    request.probeStat == null
      ? 0
      : NOELLE_HEXEREI_POINT_AVERAGE_ROLLS[request.probeStat];
  const artifactSheet = buildArtifactSheet(
    request.sourceAlignedSands,
    request.circlet,
    request.probeStat,
    probeValue,
  );
  const normalizedEntries = sheetEntries(artifactSheet);
  const configs = buildTeamConfigs(witness, request.refinement);
  const combatOptions: OptionMap = {
    durin: "white",
    nicole: request.nicoleMode,
    husk_of_opulent_dreams: String(request.huskStacks),
  };
  const calcContext = cloneCalcContext();
  const sheets = buildTeamSheets(artifactSheet);
  const teamBuild = new TeamBuild(
    configs,
    combatOptions,
    undefined,
    [],
    undefined,
    calcContext,
  );
  const huskHalfSetEvidence = assertHuskTwoPieceRuntimeContribution(
    teamBuild,
    configs,
    combatOptions,
    calcContext,
  );
  const originalEntry = teamBuild.catalog.formulaIndex.get("noelle-na");
  if (
    !originalEntry ||
    originalEntry.owner !== "noelle" ||
    originalEntry.parts.length !== 4
  ) {
    throw new Error("CP56 Noelle formula boundary drifted before projection.");
  }
  assertAutoFormulaMultipliersMatchExpectedLevel(
    originalEntry,
    runtimeEffectiveTalentLevels.auto,
  );
  const originalFormulaIndex = [...teamBuild.catalog.formulaIndex.entries()];

  teamBuild.teamStats.setArtifacts(sheets, calcContext);
  const buffTrace = buildApplicableBuffTrace(teamBuild, sheets, calcContext);
  const requiredBuffs = assertRequiredBuffMaterialization(
    teamBuild,
    buffTrace,
    request,
  );
  assertBurstConversionMatchesExpectedLevel(
    teamBuild,
    buffTrace,
    runtimeEffectiveTalentLevels.burst,
  );
  const registeredBuffLedger = teamBuild.buffLedger.allBuffs.map(
    ({ buffKey }) => buffKey,
  );

  const scoped = await withScopedFormulaPartProjection(
    teamBuild.catalog,
    NOELLE_PREFIX_PROJECTION_SPEC,
    async () => {
      const buffOverrides =
        buildBuffOverrides(
          TECHNICAL_COMBO.lines,
          teamBuild,
          sheets,
          calcContext,
        ) ?? {};
      const directTotal = teamBuild.getComboDamageResult(
        TECHNICAL_COMBO,
        sheets,
        calcContext,
        buffOverrides,
      ).totalDamage;
      const compiled = compileComboTeamDamage(
        teamBuild,
        TECHNICAL_COMBO,
        ["noelle"],
        sheets,
        calcContext,
        toCompilerBuffOverrides(buffOverrides),
      );
      const charIdx = compiled.charIdxMap?.get("noelle");
      if (charIdx == null) {
        throw new Error("CP56 compiler omitted the Noelle variable index.");
      }
      if (compiled.evaluateEr !== undefined) {
        throw new Error("CP56 unexpectedly constructed an ER constraint.");
      }
      const vars = new Float64Array(compiled.numVars);
      fillVarsFromSheet(artifactSheet, compiled.varMapping, charIdx, vars);
      const compiledTotal = compiled.evaluate(vars);
      const absoluteDifference = Math.abs(directTotal - compiledTotal);
      const allowedDifference = comparisonTolerance(
        directTotal,
        compiledTotal,
      );
      if (absoluteDifference > allowedDifference) {
        throw new Error(
          `CP56 direct/compiled mismatch: ${absoluteDifference} > ${allowedDifference}.`,
        );
      }
      const finalSheet = teamBuild.getTeamStats(
        sheets,
        "noelle",
        calcContext,
      ).noelle;
      if (!finalSheet) throw new Error("CP56 final Noelle sheet is missing.");
      return {
        buffOverrideKeys: Object.keys(buffOverrides).sort(compareText),
        compilerVariableCount: compiled.numVars,
        compilerNoelleCharacterIndex: charIdx,
        directTotal: normalizeNumber(directTotal),
        compiledTotal: normalizeNumber(compiledTotal),
        absoluteDifference: normalizeNumber(absoluteDifference),
        allowedDifference: normalizeNumber(allowedDifference),
        resolvedNoelleStats: observeResolvedStats(finalSheet),
      };
    },
  );

  const afterFormulaIndex = [...teamBuild.catalog.formulaIndex.entries()];
  if (
    teamBuild.catalog.formulaIndex.get("noelle-na") !== originalEntry ||
    stableJson(afterFormulaIndex.map(([id]) => id)) !==
      stableJson(originalFormulaIndex.map(([id]) => id)) ||
    !afterFormulaIndex.every(
      ([, entry], index) => entry === originalFormulaIndex[index]?.[1],
    ) ||
    !scoped.restoration.originalEntryIdentityRestored ||
    !scoped.restoration.formulaIndexSizeRestored ||
    !scoped.restoration.formulaIndexOrderAndEntryIdentitiesRestored
  ) {
    throw new Error("CP56 formula projection did not restore its local catalog.");
  }

  const evaluationId = pointId(request);
  const evaluationInput = {
    request,
    witness,
    configs,
    combatOptions,
    calcContext,
    normalizedEntries,
    projectionSpec: NOELLE_PREFIX_PROJECTION_SPEC,
  };
  const withoutHash = {
    evaluationId,
    evaluationInputSha256: hashValue(evaluationInput),
    request: structuredClone(request),
    witness: {
      profileId: witness.profileId,
      constellation: witness.constellation,
      enteredTalentLevels: structuredClone(witness.enteredTalentLevels),
      runtimeEffectiveTalentLevels,
      sourcePredicateSatisfiedByEnteredFacts: true as const,
      runtimeTalentEvidence: {
        expectedLevelsDerivedFromAuthenticatedCharacterMetadata: true as const,
        autoFormulaMultipliersMatchExpectedLevel: true as const,
        burstConversionMatchesExpectedLevel: true as const,
        skillLevelNotUsedByObjective: true as const,
      },
    },
    probe: {
      stat: request.probeStat,
      value: probeValue,
      valueOrigin:
        request.probeStat == null
          ? ("not-applicable-baseline" as const)
          : ("current-AVG_SUBSTAT_ROLL-application-constant" as const),
      independentOneRollNeighbor: request.probeStat != null,
    },
    artifactSheet: {
      mainStats: [
        "hp",
        "atk",
        request.sourceAlignedSands,
        "geo%",
        request.circlet,
      ] as [
        "hp",
        "atk",
        "atk%" | "def%",
        "geo%",
        NoelleHexereiTechnicalPointCircletStat,
      ],
      normalizedEntries,
      normalizedEntriesSha256: hashValue(normalizedEntries),
      substatEntryCount: (request.probeStat == null ? 0 : 1) as 0 | 1,
      legalCompleteArtifactBuild: false as const,
    },
    runtimeTrace: {
      registeredBuffCount: registeredBuffLedger.length,
      registeredBuffLedgerSha256: hashValue(registeredBuffLedger),
      applicableBuffCountForOnFieldNoelle: buffTrace.length,
      applicableBuffTraceSha256: hashValue(buffTrace),
      buffTrace,
      computedBuffOverrideKeys: scoped.value.buffOverrideKeys,
      computedBuffOverrideCountDoesNotRepresentApplicableBuffCount:
        true as const,
      ...requiredBuffs,
      ...huskHalfSetEvidence,
      compilerVariableCount: scoped.value.compilerVariableCount,
      compilerNoelleCharacterIndex:
        scoped.value.compilerNoelleCharacterIndex,
      compilerErConstraintPresent: false as const,
    },
    formulaProjection: {
      projectedPartHits: [5, 5, 3] as [5, 5, 3],
      omittedPartIndexes: [3] as [3],
      originalEntryIdentityRestored: true as const,
      formulaIndexSizeRestored: true as const,
      formulaIndexOrderAndEntryIdentitiesRestored: true as const,
    },
    objective: {
      directTotal: scoped.value.directTotal,
      compiledTotal: scoped.value.compiledTotal,
      absoluteDifference: scoped.value.absoluteDifference,
      allowedDifference: scoped.value.allowedDifference,
      directCompiledAgreement: true as const,
      resolvedNoelleStats: scoped.value.resolvedNoelleStats,
      numericClassification: "technical-fixture-local-only" as const,
    },
  };
  return { ...withoutHash, evaluationSha256: hashValue(withoutHash) };
}

function requireWitness(
  witnessId: NoelleHexereiTechnicalPointWitnessId,
): NoelleHexereiTechnicalPointWitness {
  const matches = NOELLE_HEXEREI_POINT_WITNESSES.filter(
    (witness) => witness.witnessId === witnessId,
  );
  if (matches.length !== 1) {
    throw new Error(`CP56 expected one witness ${witnessId}.`);
  }
  return matches[0];
}

function assertWitnessBoundary(
  witness: NoelleHexereiTechnicalPointWitness,
  request: NoelleHexereiTechnicalPointRequest,
): void {
  const lower =
    witness.constellation <= 5 && witness.enteredTalentLevels.burst === 9;
  const high =
    witness.constellation >= 6 || witness.enteredTalentLevels.burst >= 10;
  const expectedProfile = lower
    ? "noelle-lower-investment-artifact-profile-v1"
    : high
      ? "noelle-high-investment-artifact-profile-v1"
      : null;
  if (
    lower === high ||
    expectedProfile !== witness.profileId ||
    request.sourceAlignedSands !== witness.sourceAlignedSands
  ) {
    throw new Error(`CP56 witness/source-aligned Sands drifted for ${witness.witnessId}.`);
  }
}

function assertRequestAxes(
  request: NoelleHexereiTechnicalPointRequest,
): void {
  const expectedKeys = [
    "circlet",
    "huskStacks",
    "nicoleMode",
    "probeStat",
    "refinement",
    "sourceAlignedSands",
    "witnessId",
  ];
  if (
    stableJson(Object.keys(request).sort(compareText)) !==
      stableJson(expectedKeys) ||
    !NOELLE_HEXEREI_POINT_CIRCLET_STATS.includes(request.circlet) ||
    !NOELLE_HEXEREI_POINT_REFINEMENTS.includes(request.refinement) ||
    !NOELLE_HEXEREI_POINT_NICOLE_MODES.includes(request.nicoleMode) ||
    !NOELLE_HEXEREI_POINT_HUSK_STACKS.includes(request.huskStacks) ||
    !(
      request.probeStat === null ||
      NOELLE_HEXEREI_POINT_PROBE_STATS.includes(request.probeStat)
    )
  ) {
    throw new Error("CP56 technical point request contains an unsupported axis value.");
  }
}

function deriveExpectedRuntimeEffectiveTalentLevels(
  witness: NoelleHexereiTechnicalPointWitness,
): NoelleHexereiTechnicalPointEvaluation["witness"]["runtimeEffectiveTalentLevels"] {
  const info = charInfo.noelle;
  if (info.c3Talent !== "E" || info.c5Talent !== "Q") {
    throw new Error("CP56 authenticated Noelle talent metadata drifted.");
  }
  const expected = {
    auto: witness.enteredTalentLevels.auto,
    skill:
      witness.enteredTalentLevels.skill +
      (witness.constellation >= 3 ? 3 : 0),
    burst:
      witness.enteredTalentLevels.burst +
      (witness.constellation >= 5 ? 3 : 0),
  };
  if (stableJson(expected) !== stableJson(witness.runtimeEffectiveTalentLevels)) {
    throw new Error(`CP56 effective talents drifted for ${witness.witnessId}.`);
  }
  return expected as NoelleHexereiTechnicalPointEvaluation["witness"]["runtimeEffectiveTalentLevels"];
}

function assertAutoFormulaMultipliersMatchExpectedLevel(
  entry: FormulaEntry,
  effectiveAutoLevel: number,
): void {
  const observed = entry.parts.map(({ formula }) =>
    normalizeNumber(formula.talentMultiplier),
  );
  const expected = [0, 1, 2, 3].map((paramIndex) =>
    normalizeNumber(
      getTalentParam("noelle", "A", effectiveAutoLevel - 1, paramIndex),
    ),
  );
  if (stableJson(observed) !== stableJson(expected)) {
    throw new Error("CP56 Noelle Normal talent evidence drifted.");
  }
}

function assertBurstConversionMatchesExpectedLevel(
  teamBuild: TeamBuild,
  buffTrace: readonly NoelleHexereiTechnicalPointBuffTraceRow[],
  effectiveBurstLevel: number,
): void {
  const preNoelle = teamBuild.teamStats.getAllPreStats("noelle").noelle;
  if (!preNoelle) throw new Error("CP56 Noelle pre-stat sheet is missing.");
  const qRows = buffTrace.filter(
    ({ providerCharId, source }) =>
      providerCharId === "noelle" &&
      source.type === "character" &&
      source.id === "noelle" &&
      source.origin === "Q",
  );
  const resolvedAtk = qRows.flatMap(({ resolvedDynamicEntries }) =>
    resolvedDynamicEntries.filter(({ key }) => key === "atk"),
  );
  if (qRows.length !== 1 || resolvedAtk.length !== 1) {
    throw new Error("CP56 Noelle Burst conversion trace is not unique.");
  }
  const expected =
    preNoelle.get("def", null) *
    getTalentParam("noelle", "Q", effectiveBurstLevel - 1, 2);
  if (
    Math.abs(expected - resolvedAtk[0].value) >
    comparisonTolerance(expected, resolvedAtk[0].value)
  ) {
    throw new Error("CP56 Noelle Burst talent evidence drifted.");
  }
}

function buildTeamConfigs(
  witness: NoelleHexereiTechnicalPointWitness,
  refinement: NoelleHexereiTechnicalPointRefinement,
): TeamSlotConfig[] {
  return [
    {
      charId: "noelle",
      charLevel: 90,
      constellation: witness.constellation,
      weaponId: "gest_of_the_mighty_wolf",
      refinement,
      artifactSet: { type: "4pc", setId: "husk_of_opulent_dreams" },
      talentLevels: { ...witness.enteredTalentLevels },
    },
    ...TEAMMATE_FIXTURES.map((fixture) => ({
      ...fixture,
      talentLevels: { ...fixture.talentLevels },
    })),
  ];
}

function buildArtifactSheet(
  sands: "atk%" | "def%",
  circlet: NoelleHexereiTechnicalPointCircletStat,
  probeStat: NoelleHexereiTechnicalPointProbeStat | null,
  probeValue: number,
): StatSheet {
  const entries: StatEntry[] = [
    mainStatEntry("hp"),
    mainStatEntry("atk"),
    mainStatEntry(sands),
    mainStatEntry("geo%"),
    mainStatEntry(circlet),
  ];
  if (probeStat != null) entries.push({ key: probeStat, value: probeValue });
  return new StatSheet(entries);
}

function mainStatEntry(stat: MainStat): StatEntry {
  return {
    key: stat as StatKey,
    value: toInternal(stat, getMainStatValueAtLevel(stat, 5, 20)),
  };
}

function buildTeamSheets(noelle: StatSheet): Record<string, StatSheet> {
  return {
    noelle,
    durin: new StatSheet([]),
    nicole: new StatSheet([]),
    xilonen: new StatSheet([]),
  };
}

function buildApplicableBuffTrace(
  teamBuild: TeamBuild,
  sheets: Record<string, StatSheet>,
  calcContext: CalcContext,
): NoelleHexereiTechnicalPointBuffTraceRow[] {
  teamBuild.teamStats.setArtifacts(sheets, calcContext);
  const pre = teamBuild.teamStats.getAllPreStats("noelle");
  const mid = teamBuild.teamStats.getAllMidStats("noelle");
  const postKeys = new Set(
    teamBuild.buffLedger
      .getDynamicPost("noelle", "noelle")
      .map(({ buffKey }) => buffKey),
  );
  const midKeys = new Set(
    teamBuild.buffLedger
      .getDynamicMid("noelle", "noelle")
      .map(({ buffKey }) => buffKey),
  );
  return teamBuild.buffLedger
    .getApplicable("noelle", "noelle")
    .map(({ buff, providerCharId, buffKey }) => {
      const dynamicPhase: NoelleHexereiTechnicalPointBuffTraceRow["dynamicPhase"] =
        postKeys.has(buffKey) ? "post" : midKeys.has(buffKey) ? "mid" : "none";
      const stats = dynamicPhase === "post" ? mid : pre;
      const ownerStats = stats[providerCharId];
      const resolvedDynamicEntries =
        dynamicPhase === "none" || !ownerStats
          ? []
          : buff.dynamicBuffs(ownerStats, Object.values(stats));
      return {
        providerCharId,
        buffKey,
        source: structuredClone(buff.source) as Record<string, unknown>,
        target: structuredClone(buff.target) as Record<string, unknown>,
        implementationClass: buff.constructor.name || "StatBuff",
        staticEntries: structuredClone(buff.staticBuffs),
        dynamicPhase,
        resolvedDynamicEntries: structuredClone(resolvedDynamicEntries),
      };
    })
    .sort((left, right) => compareText(left.buffKey, right.buffKey));
}

function assertRequiredBuffMaterialization(
  teamBuild: TeamBuild,
  buffTrace: readonly NoelleHexereiTechnicalPointBuffTraceRow[],
  request: NoelleHexereiTechnicalPointRequest,
): Pick<
  NoelleHexereiTechnicalPointEvaluation["runtimeTrace"],
  | "gestBuffCount"
  | "gestDamageBonus"
  | "gestCritDamage"
  | "gestAttackSpeed"
  | "huskCuriosityBuffCount"
  | "huskDefenseBonus"
  | "huskGeoDamageBonus"
  | "geoResonanceBuffCount"
  | "geoResonanceDamageBonus"
  | "geoResonanceResistanceReduction"
  | "nicoleTheosisUpliftApplicableCountForNoelle"
  | "nicoleTheosisUpliftRegisteredCount"
  | "nicoleTheosisUpliftRegisteredTarget"
  | "nicoleBaseKenosisApplicableCountForNoelle"
  | "teammateWeaponBuffCount"
  | "exactRequiredBuffValuesVerified"
> {
  const gestValue = request.refinement === 1 ? 0.3 : 0.62;
  const gestRows = buffTrace
    .filter(
      ({ providerCharId, source }) =>
        providerCharId === "noelle" &&
        source.type === "weapon" &&
        source.id === "gest_of_the_mighty_wolf",
    )
    .map(compactBuffTraceRow)
    .sort(compareStableValues);
  const expectedGestRows = [
    {
      source: {
        type: "weapon",
        id: "gest_of_the_mighty_wolf",
        origin: `R${request.refinement}`,
      },
      target: { receiver: "self" },
      implementationClass: "StatBuff",
      staticEntries: [{ key: "atkSpd%", value: 0.1 }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
    {
      source: {
        type: "weapon",
        id: "gest_of_the_mighty_wolf",
        origin: `R${request.refinement}`,
        triggers: ["normal", "E", "charge"],
      },
      target: { receiver: "self" },
      implementationClass: "StatBuff",
      staticEntries: [{ key: "cd", value: gestValue }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
    {
      source: {
        type: "weapon",
        id: "gest_of_the_mighty_wolf",
        origin: `R${request.refinement}`,
        triggers: ["normal", "E", "charge"],
      },
      target: { receiver: "self" },
      implementationClass: "StatBuff",
      staticEntries: [{ key: "dmg%", value: gestValue }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
  ].sort(compareStableValues);
  const huskRows = buffTrace.filter(
    ({ providerCharId, source }) =>
      providerCharId === "noelle" &&
      source.type === "artifactSet" &&
      source.id === "husk_of_opulent_dreams",
  ).map(compactBuffTraceRow);
  const expectedHuskRows =
    request.huskStacks === 4
      ? [
          {
            source: {
              type: "artifactSet",
              id: "husk_of_opulent_dreams",
              triggers: ["geo-hit"],
            },
            target: { receiver: "self" },
            implementationClass: "StatBuff",
            staticEntries: [
              { key: "def%", value: 0.24 },
              { key: "geo%", value: 0.24 },
            ],
            dynamicPhase: "none",
            resolvedDynamicEntries: [],
          },
        ]
      : [];
  const geoRows = buffTrace
    .filter(
    ({ providerCharId, source }) =>
      providerCharId === "resonance" &&
      source.type === "teamResonance" &&
      source.id === "geo",
    )
    .map(compactBuffTraceRow)
    .sort(compareStableValues);
  const expectedGeoRows = [
    {
      source: {
        type: "teamResonance",
        id: "geo",
        internalKey: "res-shred",
        triggers: ["damage"],
      },
      target: { receiver: "team", filter: { elements: ["Geo"] } },
      implementationClass: "StatBuff",
      staticEntries: [{ key: "resReduction%", value: 0.2 }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
    {
      source: {
        type: "teamResonance",
        id: "geo",
        triggers: ["shielded", "lunarCrystallize"],
      },
      target: { receiver: "team" },
      implementationClass: "StatBuff",
      staticEntries: [{ key: "dmg%", value: 0.15 }],
      dynamicPhase: "none",
      resolvedDynamicEntries: [],
    },
  ].sort(compareStableValues);
  const nicoleP1Rows = buffTrace.filter(
    ({ providerCharId, source }) =>
      providerCharId === "nicole" &&
      source.type === "character" &&
      source.id === "nicole" &&
      source.origin === "P1",
  );
  const registeredNicoleP1Rows = teamBuild.buffLedger.allBuffs
    .filter(
      ({ buff, providerCharId }) =>
        providerCharId === "nicole" &&
        buff.source.type === "character" &&
        buff.source.id === "nicole" &&
        buff.source.origin === "P1",
    )
    .map(({ buff, providerCharId }) => ({
      providerCharId,
      source: structuredClone(buff.source) as Record<string, unknown>,
      target: structuredClone(buff.target) as Record<string, unknown>,
      implementationClass: buff.constructor.name || "StatBuff",
      staticEntries: structuredClone(buff.staticBuffs),
    }));
  const nicoleKenosisRows = buffTrace.filter(
    ({ providerCharId, source, implementationClass }) =>
      providerCharId === "nicole" &&
      source.type === "character" &&
      source.id === "nicole" &&
      source.origin === "E" &&
      implementationClass === "ScalingBuff",
  );
  const nicolePreStats = teamBuild.teamStats.getAllPreStats("noelle").nicole;
  if (!nicolePreStats) {
    throw new Error("CP56 Nicole pre-stat sheet is missing.");
  }
  const kenosisRatio = getTalentParam("nicole", "E", 0, 4);
  const kenosisCap = getTalentParam("nicole", "E", 0, 5);
  const expectedKenosisValue = Math.min(
    nicolePreStats.get("atk", null) * kenosisRatio,
    kenosisCap,
  );
  const expectedNicoleKenosisRows = [
    {
      source: {
        type: "character",
        id: "nicole",
        triggers: ["E"],
        origin: "E",
      },
      target: { receiver: "team" },
      implementationClass: "ScalingBuff",
      staticEntries: [],
      dynamicPhase: "mid",
      resolvedDynamicEntries: [{ key: "atk", value: expectedKenosisValue }],
    },
  ];
  const expectedNicoleP1Rows =
    request.nicoleMode === "all-theosis"
      ? [
          {
            source: {
              type: "character",
              id: "nicole",
              triggers: ["E"],
              origin: "P1",
            },
            target: { receiver: "team" },
            implementationClass: "StatBuff",
            staticEntries: [{ key: "atk", value: 300 }],
            dynamicPhase: "none",
            resolvedDynamicEntries: [],
          },
        ]
      : [];
  const expectedNicoleRegisteredTarget =
    request.nicoleMode === "all-theosis"
      ? ({ receiver: "team" } as const)
      : ({ receiver: "team", factions: ["Hexerei"] } as const);
  const expectedRegisteredNicoleP1Rows = [
    {
      providerCharId: "nicole",
      source: {
        type: "character",
        id: "nicole",
        triggers: ["E"],
        origin: "P1",
      },
      target: expectedNicoleRegisteredTarget,
      implementationClass: "StatBuff",
      staticEntries: [{ key: "atk", value: 300 }],
    },
  ];
  const teammateWeaponBuffCount = teamBuild.buffLedger.allBuffs.filter(
    ({ buff }) =>
      buff.source.type === "weapon" &&
      ["travelers_handy_sword", "otherworldly_story"].includes(
        buff.source.id,
      ),
  ).length;
  const expectedHuskCount = request.huskStacks === 4 ? 1 : 0;
  const expectedHuskValue = request.huskStacks === 4 ? 0.24 : 0;
  const expectedNicoleP1Count = request.nicoleMode === "all-theosis" ? 1 : 0;
  if (
    stableJson(gestRows) !== stableJson(expectedGestRows) ||
    stableJson(huskRows) !== stableJson(expectedHuskRows) ||
    stableJson(geoRows) !== stableJson(expectedGeoRows) ||
    stableJson(nicoleP1Rows.map(compactBuffTraceRow)) !==
      stableJson(expectedNicoleP1Rows) ||
    stableJson(registeredNicoleP1Rows) !==
      stableJson(expectedRegisteredNicoleP1Rows) ||
    stableJson(nicoleKenosisRows.map(compactBuffTraceRow)) !==
      stableJson(expectedNicoleKenosisRows) ||
    teammateWeaponBuffCount !== 0
  ) {
    throw new Error(
      `CP56 required buff materialization drifted for ${pointId(request)}.`,
    );
  }
  return {
    gestBuffCount: 3,
    gestDamageBonus: gestValue,
    gestCritDamage: gestValue,
    gestAttackSpeed: 0.1,
    huskCuriosityBuffCount: expectedHuskCount,
    huskDefenseBonus: expectedHuskValue,
    huskGeoDamageBonus: expectedHuskValue,
    geoResonanceBuffCount: 2,
    geoResonanceDamageBonus: 0.15,
    geoResonanceResistanceReduction: 0.2,
    nicoleTheosisUpliftApplicableCountForNoelle: expectedNicoleP1Count,
    nicoleTheosisUpliftRegisteredCount: 1,
    nicoleTheosisUpliftRegisteredTarget: structuredClone(
      expectedNicoleRegisteredTarget,
    ),
    nicoleBaseKenosisApplicableCountForNoelle: 1,
    teammateWeaponBuffCount: 0,
    exactRequiredBuffValuesVerified: true,
  };
}

function assertHuskTwoPieceRuntimeContribution(
  teamBuild: TeamBuild,
  configs: readonly TeamSlotConfig[],
  combatOptions: OptionMap,
  calcContext: CalcContext,
): Pick<
  NoelleHexereiTechnicalPointEvaluation["runtimeTrace"],
  | "huskFourPieceConfigured"
  | "huskTwoPieceDefenseBonus"
  | "huskTwoPieceControlTeamBuildMaterialized"
> {
  const noelleConfigs = configs.filter(({ charId }) => charId === "noelle");
  if (
    noelleConfigs.length !== 1 ||
    stableJson(noelleConfigs[0].artifactSet) !==
      stableJson({ type: "4pc", setId: "husk_of_opulent_dreams" })
  ) {
    throw new Error("CP56 Noelle is not configured with exactly one 4pc Husk set.");
  }
  const controlConfigs: TeamSlotConfig[] = configs.map((config) => ({
    ...config,
    artifactSet: config.charId === "noelle" ? null : config.artifactSet,
    talentLevels: {
      auto: config.talentLevels?.auto ?? 1,
      skill: config.talentLevels?.skill ?? 1,
      burst: config.talentLevels?.burst ?? 1,
    },
  }));
  const controlBuild = new TeamBuild(
    controlConfigs,
    { ...combatOptions },
    undefined,
    [],
    undefined,
    { ...calcContext },
  );
  const withHusk = teamBuild.charBuilds.noelle?.baseStatSheet;
  const withoutHusk = controlBuild.charBuilds.noelle?.baseStatSheet;
  if (!withHusk || !withoutHusk) {
    throw new Error("CP56 Husk half-set control is missing Noelle base stats.");
  }
  const observedDefenseBonus = normalizeNumber(
    withHusk.getRaw("def%") - withoutHusk.getRaw("def%"),
  );
  if (observedDefenseBonus !== 0.3) {
    throw new Error(
      `CP56 Husk two-piece runtime contribution drifted to ${observedDefenseBonus}.`,
    );
  }
  return {
    huskFourPieceConfigured: true,
    huskTwoPieceDefenseBonus: 0.3,
    huskTwoPieceControlTeamBuildMaterialized: true,
  };
}

function compactBuffTraceRow(
  row: NoelleHexereiTechnicalPointBuffTraceRow,
): Omit<NoelleHexereiTechnicalPointBuffTraceRow, "providerCharId" | "buffKey"> {
  return {
    source: row.source,
    target: row.target,
    implementationClass: row.implementationClass,
    staticEntries: row.staticEntries,
    dynamicPhase: row.dynamicPhase,
    resolvedDynamicEntries: row.resolvedDynamicEntries,
  };
}

function compareStableValues(left: unknown, right: unknown): number {
  return compareText(stableJson(left), stableJson(right));
}

function sheetEntries(sheet: StatSheet): NoelleHexereiTechnicalPointSheetEntry[] {
  return [...sheet.dump()]
    .map(({ key, filterKey, value }) => ({
      key,
      filterKey,
      value: normalizeNumber(value),
    }))
    .sort((left, right) =>
      compareText(
        `${left.key}\0${left.filterKey}`,
        `${right.key}\0${right.filterKey}`,
      ),
    );
}

function observeResolvedStats(sheet: StatSheet): {
  atk: number;
  def: number;
  cr: number;
  cd: number;
  geoNormalDamageBonus: number;
} {
  return {
    atk: normalizeNumber(sheet.get("atk", null)),
    def: normalizeNumber(sheet.get("def", null)),
    cr: normalizeNumber(sheet.get("cr", null)),
    cd: normalizeNumber(sheet.get("cd", null)),
    geoNormalDamageBonus: normalizeNumber(
      sheet.get("dmg%", NOELLE_GEO_NORMAL_TAG),
    ),
  };
}

function cloneCalcContext(): CalcContext {
  return {
    enemyLevel: 100,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  };
}

function toCompilerBuffOverrides(
  overrides: Record<number, BuffActivationMap>,
): Record<string, BuffActivationMap> {
  return Object.fromEntries(
    Object.entries(overrides).map(([lineIndex, activation]) => [
      `line:${lineIndex}`,
      activation,
    ]),
  );
}

function pointId(request: NoelleHexereiTechnicalPointRequest): string {
  return [
    request.witnessId,
    request.sourceAlignedSands,
    request.circlet,
    `r${request.refinement}`,
    request.nicoleMode,
    `husk${request.huskStacks}`,
    request.probeStat ?? "baseline",
  ].join(":");
}

function assertAverageRollConstants(): void {
  const expected = {
    cr: 0.03305,
    cd: 0.06605,
    "atk%": 0.049550000000000004,
    "def%": 0.06194999999999999,
  };
  if (stableJson(NOELLE_HEXEREI_POINT_AVERAGE_ROLLS) !== stableJson(expected)) {
    throw new Error("CP56 average substat roll constants drifted.");
  }
}

function assertNonBetaRuntime(): void {
  if (betaEnabled() || process.env.__BETA_ENABLED_OVERRIDE__ === "true") {
    throw new Error("CP56 requires the authenticated non-beta runtime branch.");
  }
}

function comparisonTolerance(left: number, right: number): number {
  return Math.max(
    ABSOLUTE_TOLERANCE,
    RELATIVE_TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right)),
  );
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`CP56 encountered non-finite numeric output ${value}.`);
  }
  return Number(value.toPrecision(15));
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
