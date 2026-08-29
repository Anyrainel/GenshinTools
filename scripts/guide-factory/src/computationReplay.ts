import "@/lib/dmgcalc";

import type { Element, StatKey } from "@/data/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
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
  ExtraBuff,
  I18nLabel,
  OptionMap,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";

const ABSOLUTE_TOLERANCE = 1e-9;
const RELATIVE_TOLERANCE = 1e-12;

export type ReplayEvidence = {
  classification: "structural_smoke" | "authored_validation_target";
  supportsGuideClaims: boolean;
  notes: string[];
  sourceRefs: ReplayEvidenceRef[];
};

export type ReplayEvidenceRef = {
  kind: "knowledge_record";
  recordId: string;
  supports: (
    | "roster"
    | "selected_weapons"
    | "selected_artifact_sets"
    | "investment"
    | "damage_plan"
    | "artifact_stats"
  )[];
};

export type ReplayComboLine = {
  charId: string;
  formulaId: string;
  count: number;
  reaction: ReactionOverride | null;
  forceOnField: boolean;
};

export type ReplayCombo = {
  id: string;
  label: I18nLabel;
  lines: ReplayComboLine[];
};

export type ReplayTeamConfigs = readonly [
  TeamSlotConfig,
  TeamSlotConfig,
  TeamSlotConfig,
  TeamSlotConfig,
];

export interface DamageReplayInput {
  replayId: string;
  evidence: ReplayEvidence;
  teamConfigs: ReplayTeamConfigs;
  combatOptions: OptionMap;
  enemyAura: Element | null;
  extraBuffs: ExtraBuff[];
  calcContext: CalcContext;
  combo: ReplayCombo;
  artifactSheets: Record<string, StatSheet>;
  /** Formula-keyed overrides, e.g. `eula.eula-skill-tap`; null means none. */
  formulaBuffOverrides: Record<string, BuffActivationMap> | null;
}

export type DamageReplayOutput = {
  schemaVersion: 1;
  replayId: string;
  evidence: ReplayEvidence;
  inputs: {
    teamConfigs: TeamSlotConfig[];
    combatOptions: OptionMap;
    enemyAura: Element | null;
    extraBuffs: ExtraBuff[];
    calcContext: CalcContext;
    combo: ReplayCombo;
    formulaBuffOverrides: Record<string, BuffActivationMap> | null;
    artifactSheets: Record<
      string,
      { key: StatKey; filterKey: string; value: number }[]
    >;
  };
  validation: {
    formulaCoverage: {
      charId: string;
      formulaId: string;
      available: true;
    }[];
    computedBuffOverrides: Record<string, BuffActivationMap>;
    calculatorAgreement: {
      passed: true;
      directTotalDamage: number;
      compiledTotalDamage: number;
      absoluteDifference: number;
      allowedDifference: number;
    };
  };
  result: {
    totalDamage: number;
    lineDamages: {
      charId: string;
      formulaId: string;
      count: number;
      perHit: number;
      total: number;
    }[];
  };
};

let bootstrapPromise: Promise<void> | null = null;

/** Load static stats once. The module import above registers calculator entities. */
export function bootstrapGuideFactoryComputation(): Promise<void> {
  bootstrapPromise ??= Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]).then(() => undefined);
  return bootstrapPromise;
}

/**
 * Replay one fully specified damage fixture through both calculator paths.
 *
 * This function validates integration and numerical agreement only. Its output
 * carries the fixture's evidence label and must not be promoted into a guide
 * merely because the replay succeeds.
 */
export async function replayTeamDamage(
  input: DamageReplayInput
): Promise<DamageReplayOutput> {
  validateReplayInput(input);
  await bootstrapGuideFactoryComputation();

  const teamConfigs = input.teamConfigs.map(cloneTeamConfig);
  const teamBuild = new TeamBuild(
    teamConfigs,
    input.combatOptions,
    input.enemyAura ?? undefined,
    input.extraBuffs,
    undefined,
    input.calcContext
  );
  const combo = toEngineCombo(input.combo);
  const availableFormulas = teamBuild.catalog.getFormulaIds();
  const formulaCoverage = combo.lines.map((line) => {
    if (!availableFormulas[line.charId]?.[line.formulaId]) {
      throw new Error(
        `Replay ${input.replayId}: formula ${line.charId}.${line.formulaId} ` +
          "is unavailable for the configured team and investment."
      );
    }
    return {
      charId: line.charId,
      formulaId: line.formulaId,
      available: true as const,
    };
  });

  const computedBuffOverrides = buildBuffOverrides(
    combo.lines,
    teamBuild,
    input.artifactSheets,
    input.calcContext,
    input.formulaBuffOverrides ?? undefined
  );
  const direct = teamBuild.getComboDamageResult(
    combo,
    input.artifactSheets,
    input.calcContext,
    computedBuffOverrides
  );

  // The compiler accepts line overrides under `line:{index}` keys, whereas the
  // interpreted path accepts numeric line indices.
  const compilerBuffOverrides = computedBuffOverrides
    ? Object.fromEntries(
        Object.entries(computedBuffOverrides).map(([lineIndex, activation]) => [
          `line:${lineIndex}`,
          activation,
        ])
      )
    : undefined;
  const charIds = teamConfigs.map((config) => config.charId);
  const compiled = compileComboTeamDamage(
    teamBuild,
    combo,
    charIds,
    input.artifactSheets,
    input.calcContext,
    compilerBuffOverrides
  );
  const vars = new Float64Array(compiled.numVars);
  for (const charId of charIds) {
    const charIdx = compiled.charIdxMap?.get(charId);
    if (charIdx == null) {
      throw new Error(
        `Replay ${input.replayId}: compiler did not expose variables for ${charId}.`
      );
    }
    fillVarsFromSheet(
      input.artifactSheets[charId],
      compiled.varMapping,
      charIdx,
      vars
    );
  }
  const compiledTotalDamage = compiled.evaluate(vars);
  const absoluteDifference = Math.abs(
    direct.totalDamage - compiledTotalDamage
  );
  const allowedDifference = Math.max(
    ABSOLUTE_TOLERANCE,
    RELATIVE_TOLERANCE *
      Math.max(1, Math.abs(direct.totalDamage), Math.abs(compiledTotalDamage))
  );
  if (absoluteDifference > allowedDifference) {
    throw new Error(
      `Replay ${input.replayId}: direct damage ${direct.totalDamage} and ` +
        `compiled damage ${compiledTotalDamage} differ by ${absoluteDifference}, ` +
        `above tolerance ${allowedDifference}.`
    );
  }

  return {
    schemaVersion: 1,
    replayId: input.replayId,
    evidence: cloneEvidence(input.evidence),
    inputs: {
      teamConfigs,
      combatOptions: sortTextRecord(input.combatOptions),
      enemyAura: input.enemyAura,
      extraBuffs: input.extraBuffs.map(cloneExtraBuff),
      calcContext: cloneCalcContext(input.calcContext),
      combo: cloneReplayCombo(input.combo),
      formulaBuffOverrides:
        input.formulaBuffOverrides == null
          ? null
          : serializeFormulaBuffOverrides(input.formulaBuffOverrides),
      artifactSheets: serializeArtifactSheets(input.artifactSheets),
    },
    validation: {
      formulaCoverage,
      computedBuffOverrides: serializeBuffOverrides(computedBuffOverrides),
      calculatorAgreement: {
        passed: true,
        directTotalDamage: normalizeNumber(direct.totalDamage),
        compiledTotalDamage: normalizeNumber(compiledTotalDamage),
        absoluteDifference: normalizeNumber(absoluteDifference),
        allowedDifference: normalizeNumber(allowedDifference),
      },
    },
    result: {
      totalDamage: normalizeNumber(direct.totalDamage),
      lineDamages: direct.lineDamages.map((line, index) => ({
        charId: combo.lines[index].charId,
        formulaId: combo.lines[index].formulaId,
        count: combo.lines[index].count,
        perHit: normalizeNumber(line.perHit),
        total: normalizeNumber(line.total),
      })),
    },
  };
}

function validateReplayInput(input: DamageReplayInput): void {
  if (!input.replayId) throw new Error("Damage replay requires a replayId.");
  if (input.evidence.notes.length === 0) {
    throw new Error(`Replay ${input.replayId}: evidence notes cannot be empty.`);
  }
  if (
    input.evidence.classification === "structural_smoke" &&
    input.evidence.supportsGuideClaims
  ) {
    throw new Error(
      `Replay ${input.replayId}: structural smoke tests cannot support guide claims.`
    );
  }

  const charIds = input.teamConfigs.map((config) => config.charId);
  if (new Set(charIds).size !== input.teamConfigs.length) {
    throw new Error(`Replay ${input.replayId}: team characters must be unique.`);
  }
  for (const config of input.teamConfigs) {
    if (!config.charId || !config.weaponId) {
      throw new Error(
        `Replay ${input.replayId}: every team slot requires character and weapon IDs.`
      );
    }
    requireFinite(input.replayId, `${config.charId}.charLevel`, config.charLevel);
    requireIntegerRange(
      input.replayId,
      `${config.charId}.charLevel`,
      config.charLevel,
      1,
      100
    );
    requireFinite(
      input.replayId,
      `${config.charId}.constellation`,
      config.constellation
    );
    requireIntegerRange(
      input.replayId,
      `${config.charId}.constellation`,
      config.constellation,
      0,
      6
    );
    requireFinite(
      input.replayId,
      `${config.charId}.refinement`,
      config.refinement
    );
    requireIntegerRange(
      input.replayId,
      `${config.charId}.refinement`,
      config.refinement,
      1,
      5
    );
    if (!config.talentLevels) {
      throw new Error(
        `Replay ${input.replayId}: ${config.charId} must specify all talent levels.`
      );
    }
    requireFinite(
      input.replayId,
      `${config.charId}.talentLevels.auto`,
      config.talentLevels.auto
    );
    requireFinite(
      input.replayId,
      `${config.charId}.talentLevels.skill`,
      config.talentLevels.skill
    );
    requireFinite(
      input.replayId,
      `${config.charId}.talentLevels.burst`,
      config.talentLevels.burst
    );
    for (const [talent, level] of Object.entries(config.talentLevels)) {
      requireIntegerRange(
        input.replayId,
        `${config.charId}.talentLevels.${talent}`,
        level,
        1,
        15
      );
    }
  }

  requireFinite(input.replayId, "calcContext.enemyLevel", input.calcContext.enemyLevel);
  requireFinite(input.replayId, "calcContext.enemyRes", input.calcContext.enemyRes);
  requireFinite(
    input.replayId,
    "calcContext.rollMultiplier",
    input.calcContext.rollMultiplier
  );

  if (input.combo.lines.length === 0) {
    throw new Error(`Replay ${input.replayId}: combo must contain a formula line.`);
  }
  for (const line of input.combo.lines) {
    if (!charIds.includes(line.charId)) {
      throw new Error(
        `Replay ${input.replayId}: combo character ${line.charId} is not on the team.`
      );
    }
    if (!line.formulaId) {
      throw new Error(`Replay ${input.replayId}: formulaId cannot be empty.`);
    }
    requireFinite(input.replayId, `${line.formulaId}.count`, line.count);
    if (line.count <= 0) {
      throw new Error(
        `Replay ${input.replayId}: ${line.formulaId} count must be positive.`
      );
    }
  }

  const sheetIds = Object.keys(input.artifactSheets).sort();
  const expectedSheetIds = [...charIds].sort();
  if (sheetIds.join("\0") !== expectedSheetIds.join("\0")) {
    throw new Error(
      `Replay ${input.replayId}: artifact sheets must exactly match team characters ` +
        `(${expectedSheetIds.join(", ")}).`
    );
  }
  for (const charId of charIds) {
    if (!(input.artifactSheets[charId] instanceof StatSheet)) {
      throw new Error(
        `Replay ${input.replayId}: ${charId} artifact sheet is not a StatSheet.`
      );
    }
  }
}

function toEngineCombo(combo: ReplayCombo): ComboFormula {
  return {
    id: combo.id,
    label: { ...combo.label },
    lines: combo.lines.map((line) => ({
      charId: line.charId,
      formulaId: line.formulaId,
      count: line.count,
      ...(line.reaction ? { reaction: { ...line.reaction } } : {}),
      forceOnField: line.forceOnField,
    })),
  };
}

function cloneTeamConfig(config: TeamSlotConfig): TeamSlotConfig {
  return {
    ...config,
    artifactSet:
      config.artifactSet?.type === "4pc"
        ? { ...config.artifactSet }
        : config.artifactSet?.type === "2pc+2pc"
          ? {
              ...config.artifactSet,
              halfSetIds: [...config.artifactSet.halfSetIds],
            }
          : null,
    talentLevels: config.talentLevels ? { ...config.talentLevels } : undefined,
  };
}

function cloneEvidence(evidence: ReplayEvidence): ReplayEvidence {
  return {
    ...evidence,
    notes: [...evidence.notes],
    sourceRefs: evidence.sourceRefs.map((sourceRef) => ({
      ...sourceRef,
      supports: [...sourceRef.supports],
    })),
  };
}

function cloneReplayCombo(combo: ReplayCombo): ReplayCombo {
  return {
    id: combo.id,
    label: { ...combo.label },
    lines: combo.lines.map((line) => ({
      ...line,
      reaction: line.reaction ? { ...line.reaction } : null,
    })),
  };
}

function cloneExtraBuff(buff: ExtraBuff): ExtraBuff {
  return {
    ...buff,
    stats: buff.stats.map((stat) => ({ ...stat })),
  };
}

function cloneCalcContext(context: CalcContext): CalcContext {
  return {
    ...context,
    ...(context.perCharCrTarget
      ? { perCharCrTarget: sortNumberRecord(context.perCharCrTarget) }
      : {}),
  };
}

function serializeArtifactSheets(
  sheets: Record<string, StatSheet>
): Record<string, { key: StatKey; filterKey: string; value: number }[]> {
  const result: Record<
    string,
    { key: StatKey; filterKey: string; value: number }[]
  > = {};
  for (const charId of Object.keys(sheets).sort()) {
    result[charId] = [...sheets[charId].dump()]
      .map((entry) => ({ ...entry, value: normalizeNumber(entry.value) }))
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key) ||
          left.filterKey.localeCompare(right.filterKey) ||
          left.value - right.value
      );
  }
  return result;
}

function serializeBuffOverrides(
  overrides: Record<number, BuffActivationMap> | undefined
): Record<string, BuffActivationMap> {
  if (!overrides) return {};
  const result: Record<string, BuffActivationMap> = {};
  for (const lineIndex of Object.keys(overrides).sort(
    (left, right) => Number(left) - Number(right)
  )) {
    result[lineIndex] = serializeActivation(overrides[Number(lineIndex)]);
  }
  return result;
}

function serializeFormulaBuffOverrides(
  overrides: Record<string, BuffActivationMap>
): Record<string, BuffActivationMap> {
  return Object.fromEntries(
    Object.entries(overrides)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([formulaKey, activation]) => [
        formulaKey,
        serializeActivation(activation),
      ])
  );
}

function serializeActivation(activation: BuffActivationMap): BuffActivationMap {
  const result: BuffActivationMap = {};
  for (const buffKey of Object.keys(activation).sort()) {
    result[buffKey] = Object.fromEntries(
      Object.entries(activation[buffKey])
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([partIndex, hits]) => [partIndex, normalizeNumber(hits)])
    );
  }
  return result;
}

function sortTextRecord(record: OptionMap): OptionMap {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right))
  );
}

function sortNumberRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeNumber(value)])
  );
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot normalize non-finite computation value: ${value}.`);
  }
  if (Object.is(value, -0)) return 0;
  return Number(value.toPrecision(15));
}

function requireFinite(replayId: string, field: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Replay ${replayId}: ${field} must be finite.`);
  }
}

function requireIntegerRange(
  replayId: string,
  field: string,
  value: number,
  minimum: number,
  maximum: number
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Replay ${replayId}: ${field} must be an integer from ${minimum} to ${maximum}.`
    );
  }
}
