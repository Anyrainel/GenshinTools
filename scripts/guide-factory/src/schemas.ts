import { z } from "zod";

const IdSchema = z.string().min(1);
const UnknownsSchema = z.array(z.string().min(1)).default([]);

export const SourceLocatorSchema = z.union([
  z
    .object({
      file: z.string().min(1),
      recordId: z.string().min(1).optional(),
      jsonPointer: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      url: z.string().url(),
      heading: z.string().min(1).optional(),
      timestamp: z.string().min(1).optional(),
    })
    .strict(),
]);

export const ArtifactChoiceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("4pc"),
      setId: IdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("2pc+2pc"),
      halfSetIds: z.tuple([IdSchema, IdSchema]),
    })
    .strict(),
]);

export const LegacyArtifactChoiceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("4pc"),
      setId: IdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("2pc+2pc"),
      sourceSetIds: z.tuple([IdSchema, IdSchema]),
      normalizedHalfSetIds: z.tuple([IdSchema, IdSchema]).nullable(),
    })
    .strict(),
]);

export const WeightedStatSchema = z
  .object({
    stat: IdSchema,
    weight: z.number().finite().min(0).max(100),
  })
  .strict();

const RecommendationClassificationSchema = z.enum([
  "default",
  "recommended",
  "alternative",
  "conditional",
  "available-only",
]);

const RecommendationConditionsSchema = z.array(z.string().min(1)).default([]);
const RecommendationGroupingSchema = z.enum([
  "single",
  "alternatives",
  "tied",
]);
const RecommendationOrderingSchema = z.enum(["unranked", "ranked-groups"]);

export const WeaponRecommendationSchema = z
  .object({
    weaponIds: z.array(IdSchema).min(1),
    grouping: RecommendationGroupingSchema,
    classification: RecommendationClassificationSchema,
    conditions: RecommendationConditionsSchema,
  })
  .strict();

export const ArtifactRecommendationSchema = z
  .object({
    artifacts: z.array(ArtifactChoiceSchema).min(1),
    grouping: RecommendationGroupingSchema,
    classification: RecommendationClassificationSchema,
    conditions: RecommendationConditionsSchema,
  })
  .strict();

export const ArtifactPlanSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1).optional(),
    classification: RecommendationClassificationSchema,
    conditions: RecommendationConditionsSchema,
    assignments: z
      .array(
        z
          .object({
            characterId: IdSchema,
            artifact: ArtifactChoiceSchema,
          })
          .strict(),
      )
      .min(2),
  })
  .strict();

export const OrdinalStatRecommendationSchema = z
  .object({
    statIds: z.array(IdSchema).min(1),
    priority: z.number().int().positive().optional(),
    conditions: RecommendationConditionsSchema,
    target: z.string().min(1).optional(),
  })
  .strict();

export const MainStatRecommendationsSchema = z
  .object({
    sands: z.array(OrdinalStatRecommendationSchema).min(1),
    goblet: z.array(OrdinalStatRecommendationSchema).min(1),
    circlet: z.array(OrdinalStatRecommendationSchema).min(1),
  })
  .strict();

const ErWeaponConditionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("specific"),
      weaponIds: z.array(IdSchema).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("category"),
      weaponType: z.string().min(1),
      excludedWeaponIds: z.array(IdSchema).default([]),
    })
    .strict(),
]);

export const ErTargetSchema = z
  .object({
    minPercent: z.number().finite().min(100),
    maxPercent: z.number().finite().min(100),
    supportingCalculationPercent: z.number().finite().min(100).optional(),
    supportingDisplayedPercent: z.number().finite().min(100).optional(),
    weapon: ErWeaponConditionSchema.optional(),
    conditions: RecommendationConditionsSchema,
    assumptions: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .refine((target) => target.maxPercent >= target.minPercent, {
    message: "ER target maximum must not be lower than its minimum.",
    path: ["maxPercent"],
  })
  .refine(
    (target) =>
      target.supportingDisplayedPercent == null ||
      (target.supportingDisplayedPercent >= target.minPercent &&
        target.supportingDisplayedPercent <= target.maxPercent),
    {
      message: "Supporting displayed ER must fall inside the public range.",
      path: ["supportingDisplayedPercent"],
    },
  )
  .refine(
    (target) =>
      target.supportingCalculationPercent == null ||
      target.supportingDisplayedPercent == null ||
      Math.round(target.supportingCalculationPercent) ===
        target.supportingDisplayedPercent,
    {
      message:
        "Supporting displayed ER must equal the rounded calculation value.",
      path: ["supportingDisplayedPercent"],
    },
  );

export const GuideBuildRecommendationSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1).optional(),
    scope: z.enum([
      "weapons",
      "artifact-sets",
      "artifact-stats",
      "energy",
      "combined",
    ]),
    minConstellation: z.number().int().min(0).max(6).optional(),
    maxConstellation: z.number().int().min(0).max(6).optional(),
    roles: z.array(IdSchema).default([]),
    weaponOrdering: RecommendationOrderingSchema.optional(),
    weaponRecommendations: z
      .array(WeaponRecommendationSchema)
      .min(1)
      .optional(),
    artifactOrdering: RecommendationOrderingSchema.optional(),
    artifactRecommendations: z
      .array(ArtifactRecommendationSchema)
      .min(1)
      .optional(),
    mainStats: MainStatRecommendationsSchema.optional(),
    substats: z.array(OrdinalStatRecommendationSchema).min(1).optional(),
    erTargets: z.array(ErTargetSchema).min(1).optional(),
  })
  .strict()
  .refine(
    (recommendation) =>
      recommendation.minConstellation == null ||
      recommendation.maxConstellation == null ||
      recommendation.maxConstellation >= recommendation.minConstellation,
    {
      message:
        "Maximum constellation must not be lower than minimum constellation.",
      path: ["maxConstellation"],
    }
  )
  .refine(
    (recommendation) =>
      recommendation.weaponRecommendations != null ||
      recommendation.artifactRecommendations != null ||
      recommendation.mainStats != null ||
      recommendation.substats != null ||
      recommendation.erTargets != null,
    { message: "A guide recommendation must contain at least one claim." }
  );

export const RotationObservationSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1),
    notation: z.string().min(1),
    durationSeconds: z.number().finite().positive().optional(),
    unresolvedSegments: z.array(z.string().min(1)).default([]),
    assumptions: z.array(z.string().min(1)).default([]),
  })
  .strict();

const SourceRevisionSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            path: z.string().min(1),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

const PresetTeamMemberSchema = z
  .object({
    characterId: IdSchema,
    selectedWeaponId: IdSchema.nullable(),
    selectedArtifact: ArtifactChoiceSchema.nullable(),
    erFloorPercent: z.number().finite().min(100).optional(),
  })
  .strict();

export const PresetTeamRecordSchema = z
  .object({
    kind: z.literal("team"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    name: z.string().min(1).optional(),
    members: z.array(PresetTeamMemberSchema).length(4),
    reactions: z.array(IdSchema).optional(),
    unknowns: UnknownsSchema,
  })
  .strict();

export const PresetBuildRecordSchema = z
  .object({
    sourceRecordId: IdSchema,
    visible: z.boolean(),
    name: z.string().min(1).optional(),
    minConstellation: z.number().int().min(0).max(6).optional(),
    artifact: ArtifactChoiceSchema,
    styles: z.array(IdSchema).optional(),
    roles: z.array(IdSchema).optional(),
    sands: z.array(WeightedStatSchema),
    goblet: z.array(WeightedStatSchema),
    circlet: z.array(WeightedStatSchema),
    substats: z.array(WeightedStatSchema),
  })
  .strict();

export const PresetCharacterGuideRecordSchema = z
  .object({
    kind: z.literal("character_guide"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    characterId: IdSchema,
    weaponOrder: z.array(IdSchema).optional(),
    builds: z.array(PresetBuildRecordSchema),
    unknowns: UnknownsSchema,
  })
  .strict();

export const GenshinToolsPresetSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceId: z.literal("genshintools-presets"),
    capturedAt: z.string().date(),
    sourceRevision: SourceRevisionSchema,
    teams: z.array(PresetTeamRecordSchema),
    characterGuides: z.array(PresetCharacterGuideRecordSchema),
  })
  .strict();

const LegacyTeamMemberSchema = z
  .object({
    characterId: IdSchema,
    selectedWeaponId: IdSchema.nullable(),
    selectedArtifact: LegacyArtifactChoiceSchema.nullable(),
  })
  .strict();

export const LegacyTeamRecordSchema = z
  .object({
    kind: z.literal("team"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    name: z.string().min(1).optional(),
    reactionLabel: z.string().min(1).optional(),
    sourceDpsIndex: z.number().finite().optional(),
    members: z.array(LegacyTeamMemberSchema).length(4),
    unknowns: UnknownsSchema,
  })
  .strict();

export const LegacyTeamSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceId: z.literal("legacy-team-research"),
    capturedAt: z.string().date(),
    sourceGeneratedAt: z.string().min(1).optional(),
    sourceRevision: SourceRevisionSchema,
    upstreamDomains: z.array(z.string().min(1)),
    records: z.array(LegacyTeamRecordSchema),
  })
  .strict();

const ManualExtractionSchema = z.discriminatedUnion("reviewStatus", [
  z
    .object({
      method: z.enum(["manual", "agent-assisted"]),
      reviewStatus: z.literal("unreviewed"),
    })
    .strict(),
  z
    .object({
      method: z.enum(["manual", "agent-assisted"]),
      reviewStatus: z.literal("reviewed"),
      reviewer: z.string().min(1),
      reviewedAt: z.string().date(),
    })
    .strict(),
]);

const ManualTeamMemberSchema = z
  .object({
    characterId: IdSchema,
    constellation: z.number().int().min(0).max(6).optional(),
    minConstellation: z.number().int().min(0).max(6).optional(),
    maxConstellation: z.number().int().min(0).max(6).optional(),
    weaponOrdering: RecommendationOrderingSchema.optional(),
    weaponRecommendations: z.array(WeaponRecommendationSchema),
    artifactOrdering: RecommendationOrderingSchema.optional(),
    artifactRecommendations: z.array(ArtifactRecommendationSchema),
    mainStats: MainStatRecommendationsSchema.optional(),
    substats: z.array(OrdinalStatRecommendationSchema).optional(),
    erTargets: z.array(ErTargetSchema),
  })
  .strict()
  .superRefine((member, context) => {
    if (
      member.constellation != null &&
      (member.minConstellation != null || member.maxConstellation != null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Exact constellation must not be combined with constellation bounds.",
        path: ["constellation"],
      });
    }
    if (
      member.minConstellation != null &&
      member.maxConstellation != null &&
      member.maxConstellation < member.minConstellation
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Maximum constellation must not be lower than minimum constellation.",
        path: ["maxConstellation"],
      });
    }
  });

const ManualCharacterGuideRecordSchema = z
  .object({
    kind: z.literal("character_guide"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    supportingLocators: z.array(SourceLocatorSchema).default([]),
    extraction: ManualExtractionSchema,
    characterId: IdSchema,
    recommendation: GuideBuildRecommendationSchema,
    unknowns: UnknownsSchema,
  })
  .strict();

const ManualTeamRecordSchema = z
  .object({
    kind: z.literal("team"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    supportingLocators: z.array(SourceLocatorSchema).default([]),
    extraction: ManualExtractionSchema,
    label: z.string().min(1).optional(),
    intent: z.enum(["example", "prescriptive"]),
    exhaustiveness: z.enum(["non-exhaustive", "exhaustive", "unspecified"]),
    rankingClaim: z.enum(["none", "ordered", "unordered"]),
    members: z.array(ManualTeamMemberSchema).length(4),
    artifactPlans: z.array(ArtifactPlanSchema).min(1).optional(),
    reactions: z.array(IdSchema).optional(),
    rotations: z.array(RotationObservationSchema),
    unknowns: UnknownsSchema,
  })
  .strict();

export const GenshinElementSchema = z.enum([
  "anemo",
  "cryo",
  "dendro",
  "electro",
  "geo",
  "hydro",
  "pyro",
]);

const TeamTemplateCharacterSelectorSchema = z
  .object({
    type: z.literal("characters"),
    characterIds: z.array(IdSchema).min(1),
  })
  .strict();

const TeamTemplateElementSelectorSchema = z
  .object({
    type: z.literal("elements"),
    elements: z.array(GenshinElementSchema).min(1),
  })
  .strict();

const TeamTemplateRoleSelectorSchema = z
  .object({
    type: z.literal("roles"),
    roleIds: z.array(IdSchema).min(1),
  })
  .strict();

export const TeamTemplateHighlightedSelectorSchema = z.discriminatedUnion(
  "type",
  [
    TeamTemplateCharacterSelectorSchema,
    TeamTemplateElementSelectorSchema,
    TeamTemplateRoleSelectorSchema,
  ]
);

export const TeamTemplateSelectorSchema = z.discriminatedUnion("type", [
  TeamTemplateCharacterSelectorSchema,
  TeamTemplateElementSelectorSchema,
  TeamTemplateRoleSelectorSchema,
  z
    .object({
      type: z.literal("any"),
    })
    .strict(),
]);

export const TeamTemplateSlotSchema = z
  .object({
    id: IdSchema,
    options: z.array(TeamTemplateSelectorSchema).min(1),
    highlightedOptions: z
      .array(TeamTemplateHighlightedSelectorSchema)
      .min(1)
      .optional(),
  })
  .strict();

export const ManualTeamTemplateRecordSchema = z
  .object({
    kind: z.literal("team_template"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    supportingLocators: z.array(SourceLocatorSchema).default([]),
    extraction: ManualExtractionSchema,
    label: z.string().min(1).optional(),
    intent: z.enum(["example", "prescriptive"]),
    exhaustiveness: z.enum(["non-exhaustive", "exhaustive", "unspecified"]),
    rankingClaim: z.enum(["none", "ordered", "unordered"]),
    slots: z.array(TeamTemplateSlotSchema).length(4),
    reactions: z.array(IdSchema).optional(),
    unknowns: UnknownsSchema,
  })
  .strict();

export const CharacterRoleMemberSchema = z
  .object({
    characterId: IdSchema,
    minConstellation: z.number().int().min(0).max(6).optional(),
    maxConstellation: z.number().int().min(0).max(6).optional(),
    conditions: RecommendationConditionsSchema,
  })
  .strict()
  .refine(
    (member) =>
      member.minConstellation == null ||
      member.maxConstellation == null ||
      member.maxConstellation >= member.minConstellation,
    {
      message:
        "Maximum constellation must not be lower than minimum constellation.",
      path: ["maxConstellation"],
    },
  );

export const ManualCharacterRoleRecordSchema = z
  .object({
    kind: z.literal("character_role"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    supportingLocators: z.array(SourceLocatorSchema).default([]),
    extraction: ManualExtractionSchema,
    roleId: IdSchema,
    appliesTo: z
      .object({
        teamTemplateSourceRecordId: IdSchema,
        slotId: IdSchema,
      })
      .strict(),
    members: z.array(CharacterRoleMemberSchema).min(1),
    exhaustiveness: z.enum(["non-exhaustive", "exhaustive", "unspecified"]),
    rankingClaim: z.enum(["none", "ordered", "unordered"]),
    unknowns: UnknownsSchema,
  })
  .strict();

const ManualEnergyGuidanceRecordSchema = z
  .object({
    kind: z.literal("energy_guidance"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    supportingLocators: z.array(SourceLocatorSchema).default([]),
    extraction: ManualExtractionSchema,
    characterId: IdSchema,
    constellation: z.number().int().min(0).max(6).optional(),
    teamContext: z
      .object({
        requiredCharacterIds: z.array(IdSchema),
        oneOfCharacterIds: z.array(IdSchema),
      })
      .strict(),
    targets: z.array(ErTargetSchema).min(1),
    rotation: RotationObservationSchema.optional(),
    unknowns: UnknownsSchema,
  })
  .strict();

export const SourceFormulaCountSchema = z
  .object({
    sourceToken: IdSchema,
    label: z.string().min(1),
    count: z.number().int().positive(),
  })
  .strict();

const SourceFormulaCountsSchema = z.array(SourceFormulaCountSchema).min(1);

export const ManualRotationFixtureRecordSchema = z
  .object({
    kind: z.literal("rotation_fixture"),
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
    supportingLocators: z.array(SourceLocatorSchema).default([]),
    extraction: ManualExtractionSchema,
    characterId: IdSchema,
    rotation: RotationObservationSchema,
    formulaCounts: SourceFormulaCountsSchema,
    unknowns: UnknownsSchema,
  })
  .strict();

export const ManualObservationRecordSchema = z.discriminatedUnion("kind", [
  ManualCharacterGuideRecordSchema,
  ManualCharacterRoleRecordSchema,
  ManualTeamRecordSchema,
  ManualTeamTemplateRecordSchema,
  ManualEnergyGuidanceRecordSchema,
  ManualRotationFixtureRecordSchema,
]);

export const ManualObservationSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceId: IdSchema,
    capturedAt: z.string().date(),
    page: z
      .object({
        title: z.string().min(1),
        url: z.string().url(),
        publisher: z.string().min(1),
        sourceVersion: z.string().min(1).optional(),
        attributionNote: z.string().min(1),
      })
      .strict(),
    records: z.array(ManualObservationRecordSchema).min(1),
  })
  .strict();

export const ManualSnapshotIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    snapshots: z
      .array(
        z
          .object({
            sourceId: IdSchema,
            path: z.string().min(1),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export const SourceManifestSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    homepage: z.string().url().nullable(),
    kind: z.enum([
      "internal",
      "editorial",
      "structured-editorial",
      "simulation",
      "computation-reference",
      "account-data",
      "empirical",
    ]),
    status: z.enum(["active", "planned", "blocked", "reference"]),
    ingestionMode: z.enum([
      "internal-adapter",
      "manual-observation",
      "local-simulation",
      "permission-blocked",
      "reference-only",
      "user-initiated-only",
    ]),
    permission: z.enum([
      "internal",
      "mixed",
      "unknown",
      "permission-required",
      "open-source-code",
      "api-restricted",
    ]),
    recordFormat: z.enum([
      "genshintools-presets-v1",
      "legacy-team-research-v1",
      "manual-observation-v1",
      "structured-external-v1",
      "simulation-evidence-v1",
      "account-observation-v1",
      "none",
    ]),
    checkedAt: z.string().date(),
    notes: z.array(z.string().min(1)),
  })
  .strict();

export const SourceRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.array(SourceManifestSchema),
  })
  .strict();

const SourceReferenceSchema = z
  .object({
    sourceId: IdSchema,
    sourceRecordId: IdSchema,
    locator: SourceLocatorSchema,
  })
  .strict();

export const InvestmentSchema = z
  .discriminatedUnion("status", [
    z.object({ status: z.literal("unspecified") }).strict(),
    z
      .object({
        status: z.literal("partial"),
        constellation: z.number().int().min(0).max(6).optional(),
        minConstellation: z.number().int().min(0).max(6).optional(),
        maxConstellation: z.number().int().min(0).max(6).optional(),
        talentLevels: z
          .tuple([
            z.number().int().min(1),
            z.number().int().min(1),
            z.number().int().min(1),
          ])
          .optional(),
      })
      .strict(),
    z
      .object({
        status: z.literal("specified"),
        constellation: z.number().int().min(0).max(6),
        talentLevels: z.tuple([
          z.number().int().min(1),
          z.number().int().min(1),
          z.number().int().min(1),
        ]),
      })
      .strict(),
  ])
  .superRefine((investment, context) => {
    if (investment.status !== "partial") return;
    if (
      investment.constellation != null &&
      (investment.minConstellation != null ||
        investment.maxConstellation != null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Exact constellation must not be combined with constellation bounds.",
        path: ["constellation"],
      });
    }
    if (
      investment.minConstellation != null &&
      investment.maxConstellation != null &&
      investment.maxConstellation < investment.minConstellation
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Maximum constellation must not be lower than minimum constellation.",
        path: ["maxConstellation"],
      });
    }
  });

const SelectedWeaponSchema = z
  .object({
    weaponId: IdSchema,
    refinement: z.number().int().min(1).max(5).optional(),
  })
  .strict();

const DamagePlanSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1),
    durationSeconds: z.number().finite().positive().optional(),
    lines: z
      .array(
        z
          .object({
            characterId: IdSchema,
            formulaId: IdSchema,
            count: z.number().finite().positive(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

const KnowledgeTeamMemberSchema = z
  .object({
    characterId: IdSchema,
    investment: InvestmentSchema,
    selectedWeapon: SelectedWeaponSchema.nullable(),
    selectedArtifact: ArtifactChoiceSchema.nullable(),
    weaponOrdering: RecommendationOrderingSchema.optional(),
    weaponRecommendations: z
      .array(WeaponRecommendationSchema)
      .min(1)
      .optional(),
    artifactOrdering: RecommendationOrderingSchema.optional(),
    artifactRecommendations: z
      .array(ArtifactRecommendationSchema)
      .min(1)
      .optional(),
    mainStats: MainStatRecommendationsSchema.optional(),
    substats: z.array(OrdinalStatRecommendationSchema).min(1).optional(),
    erFloorPercent: z.number().finite().min(100).optional(),
    erTargets: z.array(ErTargetSchema).min(1).optional(),
  })
  .strict();

const KnowledgeStatusSchema = z.enum([
  "baseline",
  "candidate",
  "contested",
  "accepted",
  "rejected",
]);

export const KnowledgeTeamSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("team"),
    status: KnowledgeStatusSchema,
    promotionEligible: z.boolean().optional(),
    label: z.string().min(1).optional(),
    intent: z.enum(["example", "prescriptive"]).optional(),
    exhaustiveness: z
      .enum(["non-exhaustive", "exhaustive", "unspecified"])
      .optional(),
    rankingClaim: z.enum(["none", "ordered", "unordered"]).optional(),
    members: z.array(KnowledgeTeamMemberSchema).length(4),
    artifactPlans: z.array(ArtifactPlanSchema).min(1).optional(),
    reactions: z.array(IdSchema).optional(),
    damagePlans: z.array(DamagePlanSchema),
    rotations: z.array(RotationObservationSchema).optional(),
    sourceRefs: z.array(SourceReferenceSchema).min(1),
    unknowns: UnknownsSchema,
  })
  .strict();

export const KnowledgeTeamTemplateSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("team_template"),
    status: KnowledgeStatusSchema,
    promotionEligible: z.boolean().optional(),
    label: z.string().min(1).optional(),
    intent: z.enum(["example", "prescriptive"]),
    exhaustiveness: z.enum(["non-exhaustive", "exhaustive", "unspecified"]),
    rankingClaim: z.enum(["none", "ordered", "unordered"]),
    slots: z.array(TeamTemplateSlotSchema).length(4),
    reactions: z.array(IdSchema).optional(),
    sourceRefs: z.array(SourceReferenceSchema).min(1),
    unknowns: UnknownsSchema,
  })
  .strict();

export const KnowledgeCharacterRoleSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("character_role"),
    status: KnowledgeStatusSchema,
    promotionEligible: z.boolean().optional(),
    roleId: IdSchema,
    appliesTo: z
      .object({
        teamTemplateId: IdSchema,
        slotId: IdSchema,
      })
      .strict(),
    members: z.array(CharacterRoleMemberSchema).min(1),
    exhaustiveness: z.enum(["non-exhaustive", "exhaustive", "unspecified"]),
    rankingClaim: z.enum(["none", "ordered", "unordered"]),
    sourceRefs: z.array(SourceReferenceSchema).min(1),
    unknowns: UnknownsSchema,
  })
  .strict();

export const KnowledgeEnergyGuidanceSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("energy_guidance"),
    status: KnowledgeStatusSchema,
    promotionEligible: z.boolean().optional(),
    characterId: IdSchema,
    constellation: z.number().int().min(0).max(6).optional(),
    teamContext: z
      .object({
        requiredCharacterIds: z.array(IdSchema),
        oneOfCharacterIds: z.array(IdSchema),
      })
      .strict(),
    targets: z.array(ErTargetSchema).min(1),
    rotation: RotationObservationSchema.optional(),
    sourceRefs: z.array(SourceReferenceSchema).min(1),
    unknowns: UnknownsSchema,
  })
  .strict();

export const KnowledgeRotationFixtureSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("rotation_fixture"),
    status: KnowledgeStatusSchema,
    promotionEligible: z.boolean().optional(),
    characterId: IdSchema,
    rotation: RotationObservationSchema,
    formulaCounts: SourceFormulaCountsSchema,
    sourceRefs: z.array(SourceReferenceSchema).min(1),
    unknowns: UnknownsSchema,
  })
  .strict();

export const KnowledgeCharacterGuideSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("character_guide"),
    status: KnowledgeStatusSchema,
    promotionEligible: z.boolean().optional(),
    characterId: IdSchema,
    weaponOrder: z.array(IdSchema).optional(),
    builds: z.array(PresetBuildRecordSchema),
    recommendations: z.array(GuideBuildRecommendationSchema).optional(),
    sourceRefs: z.array(SourceReferenceSchema).min(1),
    unknowns: UnknownsSchema,
  })
  .strict();

export const KnowledgeRecordSchema = z.discriminatedUnion("kind", [
  KnowledgeTeamSchema,
  KnowledgeTeamTemplateSchema,
  KnowledgeCharacterRoleSchema,
  KnowledgeCharacterGuideSchema,
  KnowledgeEnergyGuidanceSchema,
  KnowledgeRotationFixtureSchema,
]);

export const KnowledgeRepositorySchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceRegistrySha256: z.string().regex(/^[a-f0-9]{64}$/),
    generatedFrom: z.array(
      z
        .object({
          sourceId: IdSchema,
          files: z.array(
            z
              .object({
                path: z.string().min(1),
                sha256: z.string().regex(/^[a-f0-9]{64}$/),
              })
              .strict()
          ),
        })
        .strict()
    ),
    records: z.array(KnowledgeRecordSchema),
  })
  .strict();

export type ArtifactChoice = z.infer<typeof ArtifactChoiceSchema>;
export type GenshinToolsPresetSnapshot = z.infer<
  typeof GenshinToolsPresetSnapshotSchema
>;
export type KnowledgeRecord = z.infer<typeof KnowledgeRecordSchema>;
export type KnowledgeRepository = z.infer<typeof KnowledgeRepositorySchema>;
export type LegacyTeamSnapshot = z.infer<typeof LegacyTeamSnapshotSchema>;
export type LegacyArtifactChoice = z.infer<
  typeof LegacyArtifactChoiceSchema
>;
export type ManualObservationSnapshot = z.infer<
  typeof ManualObservationSnapshotSchema
>;
export type ManualSnapshotIndex = z.infer<typeof ManualSnapshotIndexSchema>;
export type SourceLocator = z.infer<typeof SourceLocatorSchema>;
export type SourceRegistry = z.infer<typeof SourceRegistrySchema>;
