import {
  actionDuration,
  calculateTeamER,
} from "@/lib/ercalc/erCalculator";
import type {
  ERTimeline,
  ParticleMode,
  TeamMember,
} from "@/lib/ercalc/types";
import type { KnowledgeRepository } from "./schemas";

export const DIONA_ER_ENGINE_INPUT_PATHS = [
  "scripts/guide-factory/src/dionaErCalibration.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  "src/lib/ercalc/erCalculator.ts",
  "src/lib/ercalc/artifactEnergy.ts",
  "src/lib/ercalc/constants.ts",
  "src/lib/ercalc/types.ts",
  "src/lib/ercalc/utils.ts",
  "src/lib/ercalc/weaponEnergy.ts",
  "src/data/ercalc/particles.json",
  "src/data/ercalc/selfEnergy-fontaine.json",
  "src/data/ercalc/selfEnergy-inazuma.json",
  "src/data/ercalc/selfEnergy-liyue.json",
  "src/data/ercalc/selfEnergy-mondstadt.json",
  "src/data/ercalc/selfEnergy-natlan.json",
  "src/data/ercalc/selfEnergy-nod-krai.json",
  "src/data/ercalc/selfEnergy-none.json",
  "src/data/ercalc/selfEnergy-snezhnaya.json",
  "src/data/ercalc/selfEnergy-sumeru.json",
] as const;

export interface DionaErCalibrationReport {
  schemaVersion: 1;
  fixtureId: "kqm-diona-favonius-er-v1";
  status: "assumption-incomplete";
  promotionEligible: false;
  source: {
    knowledgeRecordId: string;
    pageBandPercent: [number, number];
    supportingDisplayedPercent: number;
    supportingCalculationPercent: number;
    supportingSheetCell: "N38";
    rotation: string;
    durationSeconds: number;
  };
  engineInputs: Array<{ path: string; sha256: string }>;
  engineScenario: {
    team: TeamMember[];
    timeline: ERTimeline;
    ordinalDurationSeconds: number;
    unmodeledSourceDurationSeconds: number;
  };
  normalizationDecisions: {
    calcMode: "full-energy-repeat";
    dionaWeapon: { id: "favonius_warbow"; refinementEncoding: 0 };
    favoniusProcs: Array<{ actionIndex: number; count: 1 }>;
    favoniusCooldownTreatment: "explicit-proc-not-engine-validated";
    unspecifiedTeammateConstellations: 0;
    periodicProcs: 0;
    enemyDrops: 0;
    sourceAssumptionsImplemented: string[];
    sourceAssumptionsNotImplemented: string[];
    actionMapping: Array<{ sourceSegment: string; engineActions: string[] }>;
  };
  unresolved: string[];
  outputs: Array<{
    particleMode: ParticleMode;
    diona: {
      erPercent: number;
      deltaFromSupportingCalculation: number;
      withinPageBand: boolean;
      matchesSupportingCalculation: boolean;
      bindingQIndex: number | null;
      hasQ: boolean;
      energyAt100: {
        particles: number;
        scalable: number;
        flat: number;
      };
    };
  }>;
}

const KQM_DIONA_ENERGY_ID =
  "kqm:energy-guidance:c6-diona-mavuika-citlali-bennett-er";

const TEAM: TeamMember[] = [
  {
    id: "mavuika",
    element: "Pyro",
    burstCost: 0,
    constellation: 0,
    weaponType: "Claymore",
  },
  {
    id: "bennett",
    element: "Pyro",
    burstCost: 60,
    constellation: 0,
    weaponType: "Sword",
  },
  {
    id: "diona",
    element: "Cryo",
    burstCost: 80,
    constellation: 6,
    weaponId: "favonius_warbow",
    refinement: 0,
    weaponType: "Bow",
  },
  {
    id: "citlali",
    element: "Cryo",
    burstCost: 60,
    constellation: 0,
    weaponType: "Catalyst",
  },
];

const TIMELINE: ERTimeline = {
  periodic: [],
  actions: [
    { char: "mavuika", action: "E" },
    { char: "bennett", action: "E" },
    { char: "bennett", action: "NA" },
    { char: "diona", action: "holdE", favoniusProc: true },
    { char: "diona", action: "Q" },
    { char: "bennett", action: "Q" },
    { char: "citlali", action: "E" },
    { char: "citlali", action: "Q" },
    { char: "citlali", action: "NA" },
    { char: "citlali", action: "NA" },
    { char: "mavuika", action: "Q" },
  ],
};

export function buildDionaErCalibrationReport(
  repository: KnowledgeRepository,
  engineInputs: Array<{ path: string; sha256: string }>
): DionaErCalibrationReport {
  const source = repository.records.find(
    (record) => record.id === KQM_DIONA_ENERGY_ID
  );
  if (!source || source.kind !== "energy_guidance") {
    throw new Error(`Missing KQM Diona ER guidance ${KQM_DIONA_ENERGY_ID}`);
  }
  const favoniusTarget = source.targets.find(
    (target) =>
      target.weapon?.type === "specific" &&
      target.weapon.weaponIds.includes("favonius_warbow")
  );
  if (
    !favoniusTarget ||
    favoniusTarget.supportingCalculationPercent == null ||
    favoniusTarget.supportingDisplayedPercent == null ||
    !source.rotation?.durationSeconds
  ) {
    throw new Error("KQM Diona Favonius target lacks supporting source evidence");
  }

  const pageBand: [number, number] = [
    favoniusTarget.minPercent,
    favoniusTarget.maxPercent,
  ];
  const supportingCalculation =
    favoniusTarget.supportingCalculationPercent;
  const ordinalDurationSeconds = TIMELINE.actions.reduce(
    (total, action) => total + actionDuration(action.action),
    0
  );
  const outputs = (["expected", "max"] as const).map((particleMode) => {
    const results = calculateTeamER(TEAM, TIMELINE, {
      calcMode: "full-energy-repeat",
      particleMode,
    });
    const diona = results.find(({ characterId }) => characterId === "diona");
    if (!diona) throw new Error(`Missing Diona ${particleMode} ER result`);
    return {
      particleMode,
      diona: {
        erPercent: diona.erNeeded,
        deltaFromSupportingCalculation:
          diona.erNeeded - supportingCalculation,
        withinPageBand:
          diona.erNeeded >= pageBand[0] && diona.erNeeded <= pageBand[1],
        matchesSupportingCalculation:
          Math.abs(diona.erNeeded - supportingCalculation) < 1e-6,
        bindingQIndex: diona.bindingQIndex ?? null,
        hasQ: diona.hasQ,
        energyAt100: {
          particles: diona.energyBreakdown.particleEnergy,
          scalable: diona.energyBreakdown.scalableEnergy,
          flat: diona.energyBreakdown.flatEnergy,
        },
      },
    };
  });

  return {
    schemaVersion: 1,
    fixtureId: "kqm-diona-favonius-er-v1",
    status: "assumption-incomplete",
    promotionEligible: false,
    source: {
      knowledgeRecordId: source.id,
      pageBandPercent: pageBand,
      supportingDisplayedPercent:
        favoniusTarget.supportingDisplayedPercent,
      supportingCalculationPercent: supportingCalculation,
      supportingSheetCell: "N38",
      rotation: source.rotation.notation,
      durationSeconds: source.rotation.durationSeconds,
    },
    engineInputs: [...engineInputs].sort((left, right) =>
      left.path.localeCompare(right.path)
    ),
    engineScenario: {
      team: TEAM.map((member) => ({ ...member })),
      timeline: {
        actions: TIMELINE.actions.map((action) => ({ ...action })),
        periodic: TIMELINE.periodic.map((proc) => ({ ...proc })),
      },
      ordinalDurationSeconds,
      unmodeledSourceDurationSeconds:
        source.rotation.durationSeconds - ordinalDurationSeconds,
    },
    normalizationDecisions: {
      calcMode: "full-energy-repeat",
      dionaWeapon: {
        id: "favonius_warbow",
        refinementEncoding: 0,
      },
      favoniusProcs: [{ actionIndex: 3, count: 1 }],
      favoniusCooldownTreatment: "explicit-proc-not-engine-validated",
      unspecifiedTeammateConstellations: 0,
      periodicProcs: 0,
      enemyDrops: 0,
      sourceAssumptionsImplemented: [],
      sourceAssumptionsNotImplemented: [
        "safe particle RNG",
        "default enemy particles",
      ],
      actionMapping: [
        { sourceSegment: "Mavuika E", engineActions: ["E"] },
        { sourceSegment: "Bennett E N1", engineActions: ["E", "NA"] },
        { sourceSegment: "Diona hEQ", engineActions: ["holdE", "Q"] },
        { sourceSegment: "Bennett Q", engineActions: ["Q"] },
        {
          sourceSegment: "Citlali EQ N2",
          engineActions: ["E", "Q", "NA", "NA"],
        },
        {
          sourceSegment: "Mavuika Q combo",
          engineActions: ["Q", "combo unresolved"],
        },
      ],
    },
    unresolved: [
      "mathematical meaning of safe particle RNG",
      "event-model meaning and timing of default enemy particles",
      "whether one Favonius proc is guaranteed for the source target",
      "constellations of Mavuika, Bennett, and Citlali",
      "whether the raw sheet value or rounded page band is the eventual acceptance target",
      "energy-relevant expansion and duration of Mavuika Q combo",
      "engine validation of Favonius cooldown across the 20-second source rotation",
    ],
    outputs,
  };
}
