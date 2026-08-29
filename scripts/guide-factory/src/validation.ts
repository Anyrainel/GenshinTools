import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ZodError } from "zod";
import type { GameCatalogs } from "./catalogs";
import { stableJson } from "./io";
import { manualSourceRegistryProblem } from "./manualSnapshots";
import {
  FACTORY_ROOT,
  REPOSITORY_ROOT,
} from "./paths";
import {
  GenshinToolsPresetSnapshotSchema,
  KnowledgeRepositorySchema,
  LegacyTeamSnapshotSchema,
  ManualObservationSnapshotSchema,
  SourceRegistrySchema,
  type ArtifactChoice,
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type LegacyArtifactChoice,
  type LegacyTeamSnapshot,
  type ManualObservationSnapshot,
  type SourceLocator,
  type SourceRegistry,
} from "./schemas";

export type ValidationSeverity = "error" | "warning";

export interface ValidationDiagnostic {
  severity: ValidationSeverity;
  code: string;
  path: string;
  message: string;
}

export type Diagnostic = ValidationDiagnostic;

export interface KnowledgeValidationContext {
  catalogs: GameCatalogs;
  sourceRegistry: SourceRegistry;
  expectedSourceRegistrySha256?: string;
  genshinToolsSnapshot?: GenshinToolsPresetSnapshot;
  legacySnapshot?: LegacyTeamSnapshot;
  manualSnapshots?: ManualObservationSnapshot[];
}

type ManualRecord = ManualObservationSnapshot["records"][number];
type ManualGuideRecommendation = Extract<
  ManualRecord,
  { kind: "character_guide" }
>["recommendation"];
type ManualTeamMember = Extract<ManualRecord, { kind: "team" }>["members"][number];
type TeamTemplateSlot = Extract<
  ManualRecord,
  { kind: "team_template" }
>["slots"][number];
type TeamTemplateSelector = TeamTemplateSlot["options"][number];
type KnowledgeTeamMember = Extract<
  KnowledgeRecord,
  { kind: "team" }
>["members"][number];
type ArtifactPlan = NonNullable<
  Extract<KnowledgeRecord, { kind: "team" }>["artifactPlans"]
>[number];

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

const APPLICATION_ROOTS = ["src", "worker", "functions", "public"] as const;
const APPLICATION_ENTRYPOINTS = ["index.html", "vite.config.ts"] as const;

export function validateSourceRegistry(input: unknown): ValidationDiagnostic[] {
  const parsed = SourceRegistrySchema.safeParse(input);
  if (!parsed.success) return zodDiagnostics("registry", parsed.error);

  const diagnostics: ValidationDiagnostic[] = [];
  checkDuplicateValues(
    parsed.data.sources.map(({ id }) => id),
    "registry.sources",
    "source.duplicate_id",
    diagnostics
  );

  return diagnostics;
}

export function validateGenshinToolsSnapshot(
  input: unknown,
  catalogs: GameCatalogs
): ValidationDiagnostic[] {
  const parsed = GenshinToolsPresetSnapshotSchema.safeParse(input);
  if (!parsed.success)
    return zodDiagnostics("genshintools-presets", parsed.error);

  const snapshot = parsed.data;
  const diagnostics: ValidationDiagnostic[] = [];
  const sourcePath = "genshintools-presets";

  validateSourceRevision(
    snapshot.sourceRevision.files,
    sourcePath,
    diagnostics
  );
  checkDuplicateValues(
    [
      ...snapshot.teams.map(({ sourceRecordId }) => sourceRecordId),
      ...snapshot.characterGuides.map(({ sourceRecordId }) => sourceRecordId),
    ],
    sourcePath,
    "source_record.duplicate_id",
    diagnostics
  );

  const revisionPaths = new Set(
    snapshot.sourceRevision.files.map(({ path: filePath }) => filePath)
  );
  for (const [teamIndex, team] of snapshot.teams.entries()) {
    const teamPath = `${sourcePath}.teams[${teamIndex}]`;
    validateLocatorFile(team.locator, revisionPaths, teamPath, diagnostics);
    validateTeamMembers(team.members, teamPath, catalogs, "error", diagnostics);
    validateReactionIds(team.reactions, teamPath, catalogs, "error", diagnostics);
  }

  const buildRecordIds: string[] = [];
  for (const [guideIndex, guide] of snapshot.characterGuides.entries()) {
    const guidePath = `${sourcePath}.characterGuides[${guideIndex}]`;
    validateLocatorFile(guide.locator, revisionPaths, guidePath, diagnostics);
    validateCharacterId(
      guide.characterId,
      `${guidePath}.characterId`,
      catalogs,
      "error",
      diagnostics
    );
    validateWeaponOrder(
      guide.weaponOrder,
      guide.characterId,
      `${guidePath}.weaponOrder`,
      catalogs,
      "error",
      diagnostics
    );
    checkDuplicateValues(
      guide.builds.map(({ sourceRecordId }) => sourceRecordId),
      `${guidePath}.builds`,
      "build.duplicate_id",
      diagnostics
    );
    for (const [buildIndex, build] of guide.builds.entries()) {
      buildRecordIds.push(build.sourceRecordId);
      validateBuild(
        build,
        `${guidePath}.builds[${buildIndex}]`,
        catalogs,
        "error",
        diagnostics
      );
    }
  }
  checkDuplicateValues(
    buildRecordIds,
    `${sourcePath}.characterGuides.builds`,
    "build.duplicate_global_id",
    diagnostics
  );

  return diagnostics;
}

export function validateLegacySnapshot(
  input: unknown,
  catalogs: GameCatalogs
): ValidationDiagnostic[] {
  const parsed = LegacyTeamSnapshotSchema.safeParse(input);
  if (!parsed.success)
    return zodDiagnostics("legacy-team-research", parsed.error);

  const snapshot = parsed.data;
  const diagnostics: ValidationDiagnostic[] = [];
  const sourcePath = "legacy-team-research";
  validateSourceRevision(
    snapshot.sourceRevision.files,
    sourcePath,
    diagnostics
  );
  checkDuplicateValues(
    snapshot.records.map(({ sourceRecordId }) => sourceRecordId),
    `${sourcePath}.records`,
    "source_record.duplicate_id",
    diagnostics
  );
  checkDuplicateValues(
    snapshot.upstreamDomains,
    `${sourcePath}.upstreamDomains`,
    "source.duplicate_upstream_domain",
    diagnostics
  );

  const revisionPaths = new Set(
    snapshot.sourceRevision.files.map(({ path: filePath }) => filePath)
  );
  for (const [recordIndex, record] of snapshot.records.entries()) {
    const recordPath = `${sourcePath}.records[${recordIndex}]`;
    validateLocatorFile(record.locator, revisionPaths, recordPath, diagnostics);
    checkDuplicateValues(
      record.members.map(({ characterId }) => characterId),
      `${recordPath}.members`,
      "team.duplicate_character",
      diagnostics
    );
    for (const [memberIndex, member] of record.members.entries()) {
      if (member.selectedArtifact) {
        validateLegacyArtifactChoice(
          member.selectedArtifact,
          `${recordPath}.members[${memberIndex}].selectedArtifact`,
          catalogs,
          diagnostics
        );
      }
    }
    if (
      record.sourceDpsIndex != null &&
      (!Number.isInteger(record.sourceDpsIndex) ||
        record.sourceDpsIndex < 0 ||
        record.sourceDpsIndex >= record.members.length)
    ) {
      diagnostics.push({
        severity: "warning",
        code: "team.invalid_source_dps_index",
        path: `${recordPath}.sourceDpsIndex`,
        message: `Expected a member index from 0 to ${record.members.length - 1}, received ${record.sourceDpsIndex}.`,
      });
    }
  }

  return diagnostics;
}

export function validateManualObservationSnapshot(
  input: unknown,
  catalogs: GameCatalogs,
  expectedSourceId?: string
): ValidationDiagnostic[] {
  const parsed = ManualObservationSnapshotSchema.safeParse(input);
  if (!parsed.success) return zodDiagnostics("manual-observation", parsed.error);

  const snapshot = parsed.data;
  const diagnostics: ValidationDiagnostic[] = [];
  const sourcePath = `manual-observation.${snapshot.sourceId}`;
  if (expectedSourceId && snapshot.sourceId !== expectedSourceId) {
    diagnostics.push({
      severity: "error",
      code: "provenance.unexpected_source_id",
      path: `${sourcePath}.sourceId`,
      message: `Expected source ID ${expectedSourceId}, received ${snapshot.sourceId}.`,
    });
  }
  checkDuplicateValues(
    snapshot.records.map(({ sourceRecordId }) => sourceRecordId),
    `${sourcePath}.records`,
    "source_record.duplicate_id",
    diagnostics
  );

  for (const [recordIndex, record] of snapshot.records.entries()) {
    const recordPath = `${sourcePath}.records[${recordIndex}]`;
    validateManualLocator(
      record.locator,
      `${recordPath}.locator`,
      diagnostics,
      { expectedPageUrl: snapshot.page.url, requireHeading: true }
    );
    for (const [locatorIndex, locator] of record.supportingLocators.entries()) {
      validateManualLocator(
        locator,
        `${recordPath}.supportingLocators[${locatorIndex}]`,
        diagnostics
      );
    }

    if (record.kind === "character_guide") {
      validateCharacterId(
        record.characterId,
        `${recordPath}.characterId`,
        catalogs,
        "warning",
        diagnostics
      );
      validateGuideRecommendation(
        record.recommendation,
        record.characterId,
        `${recordPath}.recommendation`,
        catalogs,
        "warning",
        diagnostics
      );
      continue;
    }

    if (record.kind === "energy_guidance") {
      validateCharacterId(
        record.characterId,
        `${recordPath}.characterId`,
        catalogs,
        "warning",
        diagnostics
      );
      for (const [index, characterId] of [
        ...record.teamContext.requiredCharacterIds,
        ...record.teamContext.oneOfCharacterIds,
      ].entries()) {
        validateCharacterId(
          characterId,
          `${recordPath}.teamContext.characters[${index}]`,
          catalogs,
          "warning",
          diagnostics
        );
      }
      checkDuplicateValues(
        [
          ...record.teamContext.requiredCharacterIds,
          ...record.teamContext.oneOfCharacterIds,
        ],
        `${recordPath}.teamContext`,
        "team.duplicate_character",
        diagnostics
      );
      validateErTargets(
        record.targets,
        record.characterId,
        `${recordPath}.targets`,
        catalogs,
        "warning",
        diagnostics
      );
      if (record.rotation) {
        validateRotationObservation(
          record.rotation,
          `${recordPath}.rotation`,
          diagnostics
        );
      }
      continue;
    }

    if (record.kind === "team_template") {
      validateTeamTemplateSlots(
        record.slots,
        `${recordPath}.slots`,
        catalogs,
        "warning",
        diagnostics
      );
      validateReactionIds(
        record.reactions,
        recordPath,
        catalogs,
        "warning",
        diagnostics
      );
      continue;
    }

    checkDuplicateValues(
      record.members.map(({ characterId }) => characterId),
      `${recordPath}.members`,
      "team.duplicate_character",
      diagnostics
    );
    for (const [memberIndex, member] of record.members.entries()) {
      const memberPath = `${recordPath}.members[${memberIndex}]`;
      validateCharacterId(
        member.characterId,
        `${memberPath}.characterId`,
        catalogs,
        "warning",
        diagnostics
      );
      validateRecommendationClaims(
        member,
        member.characterId,
        memberPath,
        catalogs,
        "warning",
        diagnostics
      );
    }
    validateArtifactPlans(
      record.artifactPlans ?? [],
      new Set(record.members.map(({ characterId }) => characterId)),
      `${recordPath}.artifactPlans`,
      catalogs,
      "warning",
      diagnostics
    );
    validateReactionIds(
      record.reactions,
      recordPath,
      catalogs,
      "warning",
      diagnostics
    );
    checkDuplicateValues(
      record.rotations.map(({ id }) => id),
      `${recordPath}.rotations`,
      "rotation.duplicate_id",
      diagnostics
    );
    for (const [rotationIndex, rotation] of record.rotations.entries()) {
      validateRotationObservation(
        rotation,
        `${recordPath}.rotations[${rotationIndex}]`,
        diagnostics
      );
    }
  }

  return diagnostics;
}

export function validateManualSnapshotCollection(
  snapshots: readonly ManualObservationSnapshot[],
  sourceRegistry: SourceRegistry
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const seen = new Map<string, string>();
  for (const [snapshotIndex, snapshot] of snapshots.entries()) {
    validateManualSnapshotSourceRegistryEntry(
      snapshot.sourceId,
      `manual-snapshots[${snapshotIndex}].sourceId`,
      sourceRegistry,
      diagnostics
    );
    for (const [recordIndex, record] of snapshot.records.entries()) {
      const key = `${snapshot.sourceId}:${record.sourceRecordId}`;
      const recordPath = `manual-snapshots[${snapshotIndex}].records[${recordIndex}]`;
      const previous = seen.get(key);
      if (previous) {
        diagnostics.push({
          severity: "error",
          code: "source_record.duplicate_cross_snapshot_id",
          path: `${recordPath}.sourceRecordId`,
          message: `Source record ${key} duplicates ${previous}.`,
        });
      } else {
        seen.set(key, `${recordPath}.sourceRecordId`);
      }
    }
  }
  return diagnostics;
}

function validateGuideRecommendation(
  recommendation: ManualGuideRecommendation,
  characterId: string,
  recommendationPath: string,
  catalogs: GameCatalogs,
  catalogSeverity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  validateRecommendationClaims(
    recommendation,
    characterId,
    recommendationPath,
    catalogs,
    catalogSeverity,
    diagnostics
  );
  const expectedClaim = {
    weapons: (recommendation.weaponRecommendations?.length ?? 0) > 0,
    "artifact-sets":
      (recommendation.artifactRecommendations?.length ?? 0) > 0,
    "artifact-stats":
      recommendation.mainStats != null ||
      (recommendation.substats?.length ?? 0) > 0,
    energy: (recommendation.erTargets?.length ?? 0) > 0,
    combined: true,
  }[recommendation.scope];
  if (!expectedClaim) {
    diagnostics.push({
      severity: "error",
      code: "recommendation.scope_without_claim",
      path: `${recommendationPath}.scope`,
      message: `Scope ${recommendation.scope} has no corresponding recommendation claim.`,
    });
  }
}

function validateRecommendationClaims(
  claims: ManualGuideRecommendation | ManualTeamMember | KnowledgeTeamMember,
  characterId: string,
  claimsPath: string,
  catalogs: GameCatalogs,
  catalogSeverity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  const weaponRecommendations = claims.weaponRecommendations ?? [];
  if (weaponRecommendations.length > 0 && !claims.weaponOrdering) {
    diagnostics.push({
      severity: "error",
      code: "ranking.missing_ordering_claim",
      path: `${claimsPath}.weaponOrdering`,
      message: "Weapon recommendations must state whether the source ranks them.",
    });
  }
  for (const [groupIndex, group] of weaponRecommendations.entries()) {
    validateRecommendationGroupSize(
      group.grouping,
      group.weaponIds.length,
      `${claimsPath}.weaponRecommendations[${groupIndex}]`,
      diagnostics
    );
    validateOrderingGrouping(
      claims.weaponOrdering,
      group.grouping,
      `${claimsPath}.weaponRecommendations[${groupIndex}].grouping`,
      diagnostics
    );
    checkDuplicateValues(
      group.weaponIds,
      `${claimsPath}.weaponRecommendations[${groupIndex}].weaponIds`,
      "ranking.duplicate_choice",
      diagnostics
    );
    for (const [weaponIndex, weaponId] of group.weaponIds.entries()) {
      validateWeaponId(
        weaponId,
        characterId,
        `${claimsPath}.weaponRecommendations[${groupIndex}].weaponIds[${weaponIndex}]`,
        catalogs,
        catalogSeverity,
        diagnostics
      );
    }
  }

  const artifactRecommendations = claims.artifactRecommendations ?? [];
  if (artifactRecommendations.length > 0 && !claims.artifactOrdering) {
    diagnostics.push({
      severity: "error",
      code: "ranking.missing_ordering_claim",
      path: `${claimsPath}.artifactOrdering`,
      message: "Artifact recommendations must state whether the source ranks them.",
    });
  }
  for (const [groupIndex, group] of artifactRecommendations.entries()) {
    validateRecommendationGroupSize(
      group.grouping,
      group.artifacts.length,
      `${claimsPath}.artifactRecommendations[${groupIndex}]`,
      diagnostics
    );
    validateOrderingGrouping(
      claims.artifactOrdering,
      group.grouping,
      `${claimsPath}.artifactRecommendations[${groupIndex}].grouping`,
      diagnostics
    );
    for (const [artifactIndex, artifact] of group.artifacts.entries()) {
      validateArtifactChoice(
        artifact,
        `${claimsPath}.artifactRecommendations[${groupIndex}].artifacts[${artifactIndex}]`,
        catalogs,
        catalogSeverity,
        diagnostics
      );
    }
  }

  if (claims.mainStats) {
    for (const slot of ["sands", "goblet", "circlet"] as const) {
      validateOrdinalStats(
        claims.mainStats[slot],
        catalogs.mainStatsBySlot[slot],
        `${claimsPath}.mainStats.${slot}`,
        diagnostics
      );
    }
  }
  if (claims.substats) {
    validateOrdinalStats(
      claims.substats,
      catalogs.substatIds,
      `${claimsPath}.substats`,
      diagnostics
    );
  }
  if (claims.erTargets) {
    validateErTargets(
      claims.erTargets,
      characterId,
      `${claimsPath}.erTargets`,
      catalogs,
      catalogSeverity,
      diagnostics
    );
  }
}

function validateRecommendationGroupSize(
  grouping: "single" | "alternatives" | "tied",
  choiceCount: number,
  groupPath: string,
  diagnostics: ValidationDiagnostic[]
): void {
  const valid = grouping === "single" ? choiceCount === 1 : choiceCount >= 2;
  if (!valid) {
    diagnostics.push({
      severity: "error",
      code: "ranking.invalid_group_size",
      path: `${groupPath}.grouping`,
      message:
        grouping === "single"
          ? "A single recommendation must contain exactly one choice."
          : `A ${grouping} group must contain at least two choices.`,
    });
  }
}

function validateOrderingGrouping(
  ordering: "unranked" | "ranked-groups" | undefined,
  grouping: "single" | "alternatives" | "tied",
  groupingPath: string,
  diagnostics: ValidationDiagnostic[]
): void {
  const invalid =
    (ordering === "unranked" && grouping === "tied") ||
    (ordering === "ranked-groups" && grouping === "alternatives");
  if (!invalid) return;
  diagnostics.push({
    severity: "error",
    code: "ranking.inconsistent_grouping",
    path: groupingPath,
    message:
      ordering === "unranked"
        ? "An unranked source cannot assert a tied rank group."
        : "A ranked source must represent equal ranks as tied groups, not alternatives.",
  });
}

function validateOrdinalStats(
  groups: ReadonlyArray<{
    statIds: string[];
    priority?: number;
  }>,
  allowed: ReadonlySet<string>,
  groupsPath: string,
  diagnostics: ValidationDiagnostic[]
): void {
  const prioritiesPresent = groups.map(({ priority }) => priority != null);
  if (
    prioritiesPresent.some(Boolean) &&
    !prioritiesPresent.every(Boolean)
  ) {
    diagnostics.push({
      severity: "error",
      code: "ranking.partial_priorities",
      path: groupsPath,
      message: "A stat recommendation list must prioritize every group or none of them.",
    });
  }
  let lastPriority = 0;
  for (const [groupIndex, group] of groups.entries()) {
    checkDuplicateValues(
      group.statIds,
      `${groupsPath}[${groupIndex}].statIds`,
      "ranking.duplicate_choice",
      diagnostics
    );
    if (group.priority != null && group.priority < lastPriority) {
      diagnostics.push({
        severity: "error",
        code: "ranking.non_ascending_priority",
        path: `${groupsPath}[${groupIndex}].priority`,
        message: "Ordinal priority groups must appear in ascending order.",
      });
    }
    lastPriority = group.priority ?? lastPriority;
    for (const [statIndex, statId] of group.statIds.entries()) {
      if (!allowed.has(statId)) {
        diagnostics.push({
          severity: "warning",
          code: "stat.invalid_for_slot",
          path: `${groupsPath}[${groupIndex}].statIds[${statIndex}]`,
          message: `Stat ${statId} is not valid in this recommendation slot.`,
        });
      }
    }
  }
}

function validateErTargets(
  targets: ReadonlyArray<{
    weapon?:
      | { type: "specific"; weaponIds: string[] }
      | {
          type: "category";
          weaponType: string;
          excludedWeaponIds: string[];
        };
  }>,
  characterId: string,
  targetsPath: string,
  catalogs: GameCatalogs,
  catalogSeverity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  for (const [targetIndex, target] of targets.entries()) {
    if (!target.weapon) continue;
    const weaponIds =
      target.weapon.type === "specific"
        ? target.weapon.weaponIds
        : target.weapon.excludedWeaponIds;
    if (target.weapon.type === "category") {
      const characterWeaponType = catalogs.characterWeaponTypes.get(characterId);
      if (
        characterWeaponType &&
        target.weapon.weaponType !== characterWeaponType
      ) {
        diagnostics.push({
          severity: catalogSeverity,
          code: "catalog.weapon_category_mismatch",
          path: `${targetsPath}[${targetIndex}].weapon.weaponType`,
          message: `${characterId} uses ${characterWeaponType}, but the ER target names ${target.weapon.weaponType}.`,
        });
      }
    }
    checkDuplicateValues(
      weaponIds,
      `${targetsPath}[${targetIndex}].weapon.weaponIds`,
      "ranking.duplicate_choice",
      diagnostics
    );
    for (const [weaponIndex, weaponId] of weaponIds.entries()) {
      validateWeaponId(
        weaponId,
        characterId,
        `${targetsPath}[${targetIndex}].weapon.weaponIds[${weaponIndex}]`,
        catalogs,
        catalogSeverity,
        diagnostics
      );
    }
  }
}

function validateManualLocator(
  locator: SourceLocator,
  locatorPath: string,
  diagnostics: ValidationDiagnostic[],
  options?: { expectedPageUrl?: string; requireHeading?: boolean }
): void {
  if ("file" in locator) {
    diagnostics.push({
      severity: "error",
      code: "provenance.manual_locator_requires_url",
      path: locatorPath,
      message: "Manual external observations require a URL locator.",
    });
    return;
  }
  if (options?.expectedPageUrl && locator.url !== options.expectedPageUrl) {
    diagnostics.push({
      severity: "error",
      code: "provenance.primary_locator_page_mismatch",
      path: `${locatorPath}.url`,
      message: `Primary locator ${locator.url} does not match snapshot page ${options.expectedPageUrl}.`,
    });
  }
  if (options?.requireHeading && !locator.heading) {
    diagnostics.push({
      severity: "error",
      code: "provenance.primary_locator_requires_heading",
      path: `${locatorPath}.heading`,
      message: "A primary manual observation locator requires a page heading.",
    });
  }
}

function validateRotationObservation(
  rotation: {
    notation: string;
    unresolvedSegments: string[];
  },
  rotationPath: string,
  diagnostics: ValidationDiagnostic[]
): void {
  for (const [segmentIndex, segment] of rotation.unresolvedSegments.entries()) {
    if (!rotation.notation.includes(segment)) {
      diagnostics.push({
        severity: "error",
        code: "rotation.unresolved_segment_not_found",
        path: `${rotationPath}.unresolvedSegments[${segmentIndex}]`,
        message: `Unresolved segment ${segment} is absent from the recorded notation.`,
      });
    }
  }
}

export function validateKnowledgeRepository(
  input: unknown,
  context: KnowledgeValidationContext
): ValidationDiagnostic[] {
  const parsed = KnowledgeRepositorySchema.safeParse(input);
  if (!parsed.success) return zodDiagnostics("knowledge", parsed.error);

  const repository = parsed.data;
  const diagnostics: ValidationDiagnostic[] = [];
  const manifests = new Map(
    context.sourceRegistry.sources.map((source) => [source.id, source])
  );
  const generatedSourceIds = new Set<string>();

  for (const [snapshotIndex, snapshot] of (
    context.manualSnapshots ?? []
  ).entries()) {
    validateManualSnapshotSourceRegistryEntry(
      snapshot.sourceId,
      `knowledge.manualSnapshots[${snapshotIndex}].sourceId`,
      context.sourceRegistry,
      diagnostics
    );
  }

  if (
    context.expectedSourceRegistrySha256 &&
    repository.sourceRegistrySha256 !== context.expectedSourceRegistrySha256
  ) {
    diagnostics.push({
      severity: "error",
      code: "provenance.registry_hash_mismatch",
      path: "knowledge.sourceRegistrySha256",
      message: "The knowledge repository was generated from a different source registry revision.",
    });
  }

  for (const [sourceIndex, generated] of repository.generatedFrom.entries()) {
    const generatedPath = `knowledge.generatedFrom[${sourceIndex}]`;
    if (generatedSourceIds.has(generated.sourceId)) {
      diagnostics.push({
        severity: "error",
        code: "provenance.duplicate_generated_source",
        path: `${generatedPath}.sourceId`,
        message: `Source ${generated.sourceId} appears more than once in generatedFrom.`,
      });
    }
    generatedSourceIds.add(generated.sourceId);
    if (!manifests.has(generated.sourceId)) {
      diagnostics.push({
        severity: "error",
        code: "provenance.unknown_generated_source",
        path: `${generatedPath}.sourceId`,
        message: `Unknown source registry ID ${generated.sourceId}.`,
      });
    }
    if (generated.files.length === 0) {
      diagnostics.push({
        severity: "error",
        code: "provenance.empty_file_list",
        path: `${generatedPath}.files`,
        message: "A generated source must name at least one input file.",
      });
    }
    checkDuplicateValues(
      generated.files.map(({ path: filePath }) => filePath),
      `${generatedPath}.files`,
      "provenance.duplicate_file",
      diagnostics
    );
    for (const [fileIndex, file] of generated.files.entries()) {
      validateRepositoryFileHash(
        file.path,
        file.sha256,
        `${generatedPath}.files[${fileIndex}]`,
        diagnostics
      );
    }
  }

  checkDuplicateValues(
    repository.records.map(({ id }) => id),
    "knowledge.records",
    "knowledge.duplicate_record_id",
    diagnostics
  );

  const sourceRecordCatalog = buildSourceRecordCatalog(context);
  for (const [recordIndex, record] of repository.records.entries()) {
    const recordPath = `knowledge.records[${recordIndex}]`;
    const catalogSeverity = catalogSeverityFor(record);
    validateKnowledgeRecord(
      record,
      recordPath,
      context.catalogs,
      catalogSeverity,
      diagnostics
    );
    validateSourceReferences(
      record,
      recordPath,
      manifests,
      generatedSourceIds,
      sourceRecordCatalog,
      diagnostics
    );
  }

  return diagnostics;
}

function validateManualSnapshotSourceRegistryEntry(
  sourceId: string,
  sourcePath: string,
  sourceRegistry: SourceRegistry,
  diagnostics: ValidationDiagnostic[]
): void {
  const problem = manualSourceRegistryProblem(sourceId, sourceRegistry);
  if (problem == null) return;

  diagnostics.push({
    severity: "error",
    code:
      problem.kind === "missing"
        ? "provenance.manual_source_missing"
        : problem.kind === "duplicate"
          ? "provenance.manual_source_registry_duplicate"
          : "provenance.manual_source_format_mismatch",
    path: sourcePath,
    message: problem.message,
  });
}

export async function validateWorkspaceBoundary(): Promise<
  ValidationDiagnostic[]
> {
  const diagnostics: ValidationDiagnostic[] = [];
  const importPattern =
    /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["'][^"']*(?:scripts[\\/])?guide-factory(?:[\\/][^"']*)?["']/g;
  const applicationFiles = new Set<string>();

  for (const rootName of APPLICATION_ROOTS) {
    const rootPath = path.join(REPOSITORY_ROOT, rootName);
    if (!(await pathExists(rootPath))) continue;
    for (const filePath of await listFiles(rootPath)) {
      if (!TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue;
      applicationFiles.add(filePath);
    }
  }

  for (const entrypoint of APPLICATION_ENTRYPOINTS) {
    const filePath = path.join(REPOSITORY_ROOT, entrypoint);
    if (await pathExists(filePath)) applicationFiles.add(filePath);
  }

  for (const filePath of applicationFiles) {
    const content = await readFile(filePath, "utf8");
    if (!importPattern.test(content)) {
      importPattern.lastIndex = 0;
      continue;
    }
    importPattern.lastIndex = 0;
    diagnostics.push({
      severity: "error",
      code: "boundary.application_import",
      path: repositoryRelative(filePath),
      message:
        "Application and Worker code must not import the offline guide-factory workspace.",
    });
  }

  return diagnostics;
}

export function formatDiagnostics(
  diagnostics: readonly ValidationDiagnostic[]
): string {
  return [...diagnostics]
    .sort((left, right) => {
      if (left.severity !== right.severity)
        return left.severity === "error" ? -1 : 1;
      return (
        left.path.localeCompare(right.path) ||
        left.code.localeCompare(right.code) ||
        left.message.localeCompare(right.message)
      );
    })
    .map(
      ({ severity, code, path: diagnosticPath, message }) =>
        `${severity.toUpperCase()} ${code} ${diagnosticPath}: ${message}`
    )
    .join("\n");
}

function validateKnowledgeRecord(
  record: KnowledgeRecord,
  recordPath: string,
  catalogs: GameCatalogs,
  catalogSeverity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  if (record.kind === "team") {
    validateTeamMembers(
      record.members,
      recordPath,
      catalogs,
      catalogSeverity,
      diagnostics
    );
    validateReactionIds(
      record.reactions,
      recordPath,
      catalogs,
      catalogSeverity,
      diagnostics
    );
    checkDuplicateValues(
      record.damagePlans.map(({ id }) => id),
      `${recordPath}.damagePlans`,
      "damage_plan.duplicate_id",
      diagnostics
    );
    const memberIds = new Set(record.members.map(({ characterId }) => characterId));
    for (const [memberIndex, member] of record.members.entries()) {
      validateRecommendationClaims(
        member,
        member.characterId,
        `${recordPath}.members[${memberIndex}]`,
        catalogs,
        catalogSeverity,
        diagnostics
      );
    }
    validateArtifactPlans(
      record.artifactPlans ?? [],
      memberIds,
      `${recordPath}.artifactPlans`,
      catalogs,
      catalogSeverity,
      diagnostics
    );
    for (const [planIndex, plan] of record.damagePlans.entries()) {
      for (const [lineIndex, line] of plan.lines.entries()) {
        if (!memberIds.has(line.characterId)) {
          diagnostics.push({
            severity: "error",
            code: "damage_plan.non_member_owner",
            path: `${recordPath}.damagePlans[${planIndex}].lines[${lineIndex}].characterId`,
            message: `Formula owner ${line.characterId} is not a member of this team.`,
          });
        }
      }
    }
    for (const [rotationIndex, rotation] of (
      record.rotations ?? []
    ).entries()) {
      validateRotationObservation(
        rotation,
        `${recordPath}.rotations[${rotationIndex}]`,
        diagnostics
      );
    }
    return;
  }

  if (record.kind === "team_template") {
    validateTeamTemplateSlots(
      record.slots,
      `${recordPath}.slots`,
      catalogs,
      catalogSeverity,
      diagnostics
    );
    validateReactionIds(
      record.reactions,
      recordPath,
      catalogs,
      catalogSeverity,
      diagnostics
    );
    return;
  }

  validateCharacterId(
    record.characterId,
    `${recordPath}.characterId`,
    catalogs,
    catalogSeverity,
    diagnostics
  );
  if (record.kind === "energy_guidance") {
    for (const [index, characterId] of [
      ...record.teamContext.requiredCharacterIds,
      ...record.teamContext.oneOfCharacterIds,
    ].entries()) {
      validateCharacterId(
        characterId,
        `${recordPath}.teamContext.characters[${index}]`,
        catalogs,
        catalogSeverity,
        diagnostics
      );
    }
    validateErTargets(
      record.targets,
      record.characterId,
      `${recordPath}.targets`,
      catalogs,
      catalogSeverity,
      diagnostics
    );
    if (record.rotation) {
      validateRotationObservation(
        record.rotation,
        `${recordPath}.rotation`,
        diagnostics
      );
    }
    return;
  }
  validateWeaponOrder(
    record.weaponOrder,
    record.characterId,
    `${recordPath}.weaponOrder`,
    catalogs,
    catalogSeverity,
    diagnostics
  );
  checkDuplicateValues(
    record.builds.map(({ sourceRecordId }) => sourceRecordId),
    `${recordPath}.builds`,
    "build.duplicate_id",
    diagnostics
  );
  for (const [buildIndex, build] of record.builds.entries()) {
    validateBuild(
      build,
      `${recordPath}.builds[${buildIndex}]`,
      catalogs,
      catalogSeverity,
      diagnostics
    );
  }
  for (const [recommendationIndex, recommendation] of (
    record.recommendations ?? []
  ).entries()) {
    validateGuideRecommendation(
      recommendation,
      record.characterId,
      `${recordPath}.recommendations[${recommendationIndex}]`,
      catalogs,
      catalogSeverity,
      diagnostics
    );
  }
}

function validateArtifactPlans(
  plans: readonly ArtifactPlan[],
  memberIds: ReadonlySet<string>,
  plansPath: string,
  catalogs: GameCatalogs,
  catalogSeverity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  checkDuplicateValues(
    plans.map(({ id }) => id),
    plansPath,
    "artifact_plan.duplicate_id",
    diagnostics
  );
  for (const [planIndex, plan] of plans.entries()) {
    const planPath = `${plansPath}[${planIndex}]`;
    checkDuplicateValues(
      plan.assignments.map(({ characterId }) => characterId),
      `${planPath}.assignments`,
      "artifact_plan.duplicate_assignment",
      diagnostics
    );
    for (const [assignmentIndex, assignment] of plan.assignments.entries()) {
      const assignmentPath = `${planPath}.assignments[${assignmentIndex}]`;
      if (!memberIds.has(assignment.characterId)) {
        diagnostics.push({
          severity: "error",
          code: "artifact_plan.non_member_assignment",
          path: `${assignmentPath}.characterId`,
          message: `Artifact assignment owner ${assignment.characterId} is not a member of this team.`,
        });
      }
      validateArtifactChoice(
        assignment.artifact,
        `${assignmentPath}.artifact`,
        catalogs,
        catalogSeverity,
        diagnostics
      );
    }
  }
}

function validateTeamTemplateSlots(
  slots: readonly TeamTemplateSlot[],
  slotsPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  checkDuplicateValues(
    slots.map(({ id }) => id),
    slotsPath,
    "team_template.duplicate_slot_id",
    diagnostics
  );

  for (const [slotIndex, slot] of slots.entries()) {
    const slotPath = `${slotsPath}[${slotIndex}]`;
    checkDuplicateValues(
      slot.options.map((option) => stableJson(option)),
      `${slotPath}.options`,
      "team_template.duplicate_selector",
      diagnostics
    );
    if (
      slot.options.length > 1 &&
      slot.options.some((option) => option.type === "any")
    ) {
      diagnostics.push({
        severity: "error",
        code: "team_template.redundant_any_selector",
        path: `${slotPath}.options`,
        message: "An any selector makes every other slot selector redundant.",
      });
    }

    validateTeamTemplateSelectors(
      slot.options,
      `${slotPath}.options`,
      catalogs,
      severity,
      diagnostics
    );

    if (slot.highlightedOptions) {
      checkDuplicateValues(
        slot.highlightedOptions.map((option) => stableJson(option)),
        `${slotPath}.highlightedOptions`,
        "team_template.duplicate_highlighted_selector",
        diagnostics
      );
      validateTeamTemplateSelectors(
        slot.highlightedOptions,
        `${slotPath}.highlightedOptions`,
        catalogs,
        severity,
        diagnostics
      );
    }
  }
}

function validateTeamTemplateSelectors(
  selectors: readonly TeamTemplateSelector[],
  selectorsPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  for (const [optionIndex, option] of selectors.entries()) {
    const optionPath = `${selectorsPath}[${optionIndex}]`;
    if (option.type === "characters") {
      checkDuplicateValues(
        option.characterIds,
        `${optionPath}.characterIds`,
        "team_template.duplicate_character_selector",
        diagnostics
      );
      for (const [characterIndex, characterId] of
        option.characterIds.entries()) {
        validateCharacterId(
          characterId,
          `${optionPath}.characterIds[${characterIndex}]`,
          catalogs,
          severity,
          diagnostics
        );
      }
    } else if (option.type === "elements") {
      checkDuplicateValues(
        option.elements,
        `${optionPath}.elements`,
        "team_template.duplicate_element_selector",
        diagnostics
      );
    } else if (option.type === "roles") {
      checkDuplicateValues(
        option.roleIds,
        `${optionPath}.roleIds`,
        "team_template.duplicate_role_selector",
        diagnostics
      );
    }
  }
}

function validateTeamMembers(
  members: ReadonlyArray<{
    characterId: string;
    selectedWeaponId?: string | null;
    selectedWeapon?: { weaponId: string } | null;
    selectedArtifact: ArtifactChoice | null;
  }>,
  teamPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  checkDuplicateValues(
    members.map(({ characterId }) => characterId),
    `${teamPath}.members`,
    "team.duplicate_character",
    diagnostics,
    "error"
  );

  for (const [memberIndex, member] of members.entries()) {
    const memberPath = `${teamPath}.members[${memberIndex}]`;
    validateCharacterId(
      member.characterId,
      `${memberPath}.characterId`,
      catalogs,
      severity,
      diagnostics
    );
    const weaponId = member.selectedWeapon?.weaponId ?? member.selectedWeaponId;
    if (weaponId) {
      validateWeaponId(
        weaponId,
        member.characterId,
        `${memberPath}.selectedWeapon`,
        catalogs,
        severity,
        diagnostics
      );
    }
    if (member.selectedArtifact) {
      validateArtifactChoice(
        member.selectedArtifact,
        `${memberPath}.selectedArtifact`,
        catalogs,
        severity,
        diagnostics
      );
    }
  }
}

function validateBuild(
  build: {
    artifact: ArtifactChoice;
    sands: Array<{ stat: string; weight: number }>;
    goblet: Array<{ stat: string; weight: number }>;
    circlet: Array<{ stat: string; weight: number }>;
    substats: Array<{ stat: string; weight: number }>;
  },
  buildPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  validateArtifactChoice(
    build.artifact,
    `${buildPath}.artifact`,
    catalogs,
    severity,
    diagnostics
  );
  validateWeightedStats(
    build.sands,
    catalogs.mainStatsBySlot.sands,
    `${buildPath}.sands`,
    severity,
    diagnostics
  );
  validateWeightedStats(
    build.goblet,
    catalogs.mainStatsBySlot.goblet,
    `${buildPath}.goblet`,
    severity,
    diagnostics
  );
  validateWeightedStats(
    build.circlet,
    catalogs.mainStatsBySlot.circlet,
    `${buildPath}.circlet`,
    severity,
    diagnostics
  );
  validateWeightedStats(
    build.substats,
    catalogs.substatIds,
    `${buildPath}.substats`,
    severity,
    diagnostics
  );
}

function validateWeightedStats(
  stats: ReadonlyArray<{ stat: string; weight: number }>,
  allowed: ReadonlySet<string>,
  statsPath: string,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  if (stats.length === 0) {
    diagnostics.push({
      severity,
      code: "ranking.empty",
      path: statsPath,
      message: "A recommendation list must not be empty.",
    });
  }
  checkDuplicateValues(
    stats.map(({ stat }) => stat),
    statsPath,
    "ranking.duplicate_choice",
    diagnostics,
    severity
  );
  for (const [index, entry] of stats.entries()) {
    if (!allowed.has(entry.stat)) {
      diagnostics.push({
        severity,
        code: "stat.invalid_for_slot",
        path: `${statsPath}[${index}].stat`,
        message: `Stat ${entry.stat} is not valid in this recommendation slot.`,
      });
    }
    if (index > 0 && entry.weight > stats[index - 1].weight) {
      diagnostics.push({
        severity: "warning",
        code: "ranking.non_descending_weight",
        path: `${statsPath}[${index}].weight`,
        message: "Weights are explicit, but the source order is not descending.",
      });
    }
  }
}

function validateWeaponOrder(
  weaponOrder: readonly string[] | undefined,
  characterId: string,
  orderPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  if (!weaponOrder) return;
  if (weaponOrder.length === 0) {
    diagnostics.push({
      severity,
      code: "ranking.empty",
      path: orderPath,
      message: "An explicitly supplied weapon order must not be empty.",
    });
  }
  checkDuplicateValues(
    weaponOrder,
    orderPath,
    "ranking.duplicate_choice",
    diagnostics,
    severity
  );
  for (const [index, weaponId] of weaponOrder.entries()) {
    validateWeaponId(
      weaponId,
      characterId,
      `${orderPath}[${index}]`,
      catalogs,
      severity,
      diagnostics
    );
  }
}

function validateCharacterId(
  characterId: string,
  characterPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  if (!catalogs.characterIds.has(characterId)) {
    diagnostics.push({
      severity,
      code: "catalog.unknown_character",
      path: characterPath,
      message: `Unknown character ID ${characterId}.`,
    });
  }
}

function validateWeaponId(
  weaponId: string,
  characterId: string,
  weaponPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  if (!catalogs.weaponIds.has(weaponId)) {
    diagnostics.push({
      severity,
      code: "catalog.unknown_weapon",
      path: weaponPath,
      message: `Unknown weapon ID ${weaponId}.`,
    });
    return;
  }

  const characterType = catalogs.characterWeaponTypes.get(characterId);
  const weaponType = catalogs.weaponTypes.get(weaponId);
  if (characterType && weaponType && characterType !== weaponType) {
    diagnostics.push({
      severity,
      code: "catalog.weapon_type_mismatch",
      path: weaponPath,
      message: `${characterId} uses ${characterType}, but ${weaponId} is ${weaponType}.`,
    });
  }
}

function validateArtifactChoice(
  artifact: ArtifactChoice,
  artifactPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  if (artifact.type === "4pc") {
    if (!catalogs.artifactSetIds.has(artifact.setId)) {
      diagnostics.push({
        severity,
        code: "catalog.unknown_artifact_set",
        path: `${artifactPath}.setId`,
        message: `Unknown 4-piece artifact set ID ${artifact.setId}.`,
      });
    }
    return;
  }

  for (const [index, halfSetId] of artifact.halfSetIds.entries()) {
    if (!catalogs.artifactHalfSetIds.has(halfSetId)) {
      diagnostics.push({
        severity,
        code: "catalog.unknown_artifact_half_set",
        path: `${artifactPath}.halfSetIds[${index}]`,
        message: `Unknown 2-piece effect ID ${halfSetId}.`,
      });
    }
  }
}

function validateReactionIds(
  reactionIds: readonly string[] | undefined,
  teamPath: string,
  catalogs: GameCatalogs,
  severity: ValidationSeverity,
  diagnostics: ValidationDiagnostic[]
): void {
  if (!reactionIds) return;
  checkDuplicateValues(
    reactionIds,
    `${teamPath}.reactions`,
    "team.duplicate_reaction",
    diagnostics,
    severity
  );
  for (const [index, reactionId] of reactionIds.entries()) {
    if (!catalogs.reactionIds.has(reactionId)) {
      diagnostics.push({
        severity,
        code: "catalog.unknown_reaction",
        path: `${teamPath}.reactions[${index}]`,
        message: `Unknown team reaction ID ${reactionId}.`,
      });
    }
  }
}

function validateLegacyArtifactChoice(
  artifact: LegacyArtifactChoice,
  artifactPath: string,
  catalogs: GameCatalogs,
  diagnostics: ValidationDiagnostic[]
): void {
  if (artifact.type === "4pc") {
    if (!catalogs.artifactSetIds.has(artifact.setId)) {
      diagnostics.push({
        severity: "warning",
        code: "catalog.unknown_artifact_set",
        path: `${artifactPath}.setId`,
        message: `Unknown 4-piece artifact set ID ${artifact.setId}.`,
      });
    }
    return;
  }

  const expected = artifact.sourceSetIds.map((setId, index) => {
    if (!catalogs.artifactSetIds.has(setId)) {
      diagnostics.push({
        severity: "warning",
        code: "catalog.unknown_artifact_set",
        path: `${artifactPath}.sourceSetIds[${index}]`,
        message: `Unknown source artifact set ID ${setId}.`,
      });
    }
    return catalogs.artifactSetToHalfSetId.get(setId);
  });
  const expectedResolved = expected[0] != null && expected[1] != null;
  const normalized = artifact.normalizedHalfSetIds;
  const normalizationMatches =
    expectedResolved &&
    normalized != null &&
    normalized[0] === expected[0] &&
    normalized[1] === expected[1];

  if (
    (expectedResolved && !normalizationMatches) ||
    (!expectedResolved && normalized != null)
  ) {
    diagnostics.push({
      severity: "error",
      code: "pipeline.invalid_half_set_normalization",
      path: `${artifactPath}.normalizedHalfSetIds`,
      message:
        "Normalized 2-piece effect IDs do not match the source artifact sets.",
    });
  }
}

function validateSourceReferences(
  record: KnowledgeRecord,
  recordPath: string,
  manifests: ReadonlyMap<string, SourceRegistry["sources"][number]>,
  generatedSourceIds: ReadonlySet<string>,
  sourceRecordCatalog: ReadonlyMap<string, readonly SourceLocator[]>,
  diagnostics: ValidationDiagnostic[]
): void {
  const seen = new Set<string>();
  for (const [referenceIndex, reference] of record.sourceRefs.entries()) {
    const referencePath = `${recordPath}.sourceRefs[${referenceIndex}]`;
    const referenceKey = `${reference.sourceId}:${reference.sourceRecordId}`;
    const exactKey = `${referenceKey}:${stableJson(reference.locator)}`;
    if (seen.has(exactKey)) {
      diagnostics.push({
        severity: "error",
        code: "provenance.duplicate_source_ref",
        path: referencePath,
        message: "This source reference is duplicated on the record.",
      });
    }
    seen.add(exactKey);

    const manifest = manifests.get(reference.sourceId);
    if (!manifest) {
      diagnostics.push({
        severity: "error",
        code: "provenance.unknown_source",
        path: `${referencePath}.sourceId`,
        message: `Unknown source registry ID ${reference.sourceId}.`,
      });
      continue;
    }
    if (!generatedSourceIds.has(reference.sourceId)) {
      diagnostics.push({
        severity: "error",
        code: "provenance.source_not_generated",
        path: `${referencePath}.sourceId`,
        message: `Source ${reference.sourceId} is absent from generatedFrom.`,
      });
    }
    if (
      manifest.status !== "active" ||
      manifest.permission === "permission-required" ||
      manifest.ingestionMode === "permission-blocked" ||
      manifest.ingestionMode === "reference-only" ||
      manifest.ingestionMode === "user-initiated-only"
    ) {
      diagnostics.push({
        severity: "error",
        code: "provenance.ingestion_not_permitted",
        path: `${referencePath}.sourceId`,
        message: `Registry status ${manifest.status}, permission ${manifest.permission}, and ingestion mode ${manifest.ingestionMode} do not permit repository records.`,
      });
    }

    const expectedLocators = sourceRecordCatalog.get(referenceKey);
    if (!expectedLocators) {
      diagnostics.push({
        severity: "error",
        code: "provenance.dangling_source_record",
        path: `${referencePath}.sourceRecordId`,
        message: `Source record ${referenceKey} does not exist in its snapshot.`,
      });
    } else if (
      !expectedLocators.some(
        (locator) => stableJson(locator) === stableJson(reference.locator)
      )
    ) {
      diagnostics.push({
        severity: "error",
        code: "provenance.locator_mismatch",
        path: `${referencePath}.locator`,
        message: `The locator does not match source record ${referenceKey}.`,
      });
    }
  }
}

function buildSourceRecordCatalog(
  context: KnowledgeValidationContext
): ReadonlyMap<string, readonly SourceLocator[]> {
  const catalog = new Map<string, SourceLocator[]>();
  if (context.genshinToolsSnapshot) {
    for (const record of [
      ...context.genshinToolsSnapshot.teams,
      ...context.genshinToolsSnapshot.characterGuides,
    ]) {
      catalog.set(`genshintools-presets:${record.sourceRecordId}`, [
        record.locator,
      ]);
    }
  }
  if (context.legacySnapshot) {
    for (const record of context.legacySnapshot.records) {
      catalog.set(`legacy-team-research:${record.sourceRecordId}`, [
        record.locator,
      ]);
    }
  }
  for (const snapshot of context.manualSnapshots ?? []) {
    for (const record of snapshot.records) {
      catalog.set(`${snapshot.sourceId}:${record.sourceRecordId}`, [
        record.locator,
        ...record.supportingLocators,
      ]);
    }
  }
  return catalog;
}

function catalogSeverityFor(record: KnowledgeRecord): ValidationSeverity {
  return record.status === "baseline" || record.status === "accepted"
    ? "error"
    : "warning";
}

function validateLocatorFile(
  locator: SourceLocator,
  revisionPaths: ReadonlySet<string>,
  locatorPath: string,
  diagnostics: ValidationDiagnostic[]
): void {
  if ("file" in locator && !revisionPaths.has(locator.file)) {
    diagnostics.push({
      severity: "error",
      code: "provenance.locator_file_not_revised",
      path: `${locatorPath}.locator.file`,
      message: `Locator file ${locator.file} is absent from sourceRevision.files.`,
    });
  }
}

function validateSourceRevision(
  files: ReadonlyArray<{ path: string; sha256: string }>,
  sourcePath: string,
  diagnostics: ValidationDiagnostic[]
): void {
  checkDuplicateValues(
    files.map(({ path: filePath }) => filePath),
    `${sourcePath}.sourceRevision.files`,
    "provenance.duplicate_file",
    diagnostics
  );
  for (const [fileIndex, file] of files.entries()) {
    validateRepositoryFileHash(
      file.path,
      file.sha256,
      `${sourcePath}.sourceRevision.files[${fileIndex}]`,
      diagnostics
    );
  }
}

function validateRepositoryFileHash(
  relativePath: string,
  expectedHash: string,
  diagnosticPath: string,
  diagnostics: ValidationDiagnostic[]
): void {
  const absolutePath = path.resolve(REPOSITORY_ROOT, relativePath);
  const relativeToRoot = path.relative(REPOSITORY_ROOT, absolutePath);
  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    absolutePath.startsWith(`${FACTORY_ROOT}${path.sep}cache${path.sep}`)
  ) {
    diagnostics.push({
      severity: "error",
      code: "provenance.unsafe_file_path",
      path: `${diagnosticPath}.path`,
      message: `Input path ${relativePath} is outside the repository or points at transient cache data.`,
    });
    return;
  }

  try {
    const actualHash = createHash("sha256")
      .update(readFileSync(absolutePath))
      .digest("hex");
    if (actualHash !== expectedHash) {
      diagnostics.push({
        severity: "error",
        code: "provenance.file_hash_mismatch",
        path: `${diagnosticPath}.sha256`,
        message: `Input hash does not match ${repositoryRelative(absolutePath)}.`,
      });
    }
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "provenance.file_unreadable",
      path: `${diagnosticPath}.path`,
      message:
        error instanceof Error
          ? error.message
          : `Could not read ${repositoryRelative(absolutePath)}.`,
    });
  }
}

function checkDuplicateValues(
  values: readonly string[],
  diagnosticPath: string,
  code: string,
  diagnostics: ValidationDiagnostic[],
  severity: ValidationSeverity = "error"
): void {
  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const value of values) {
    if (seen.has(value) && !reported.has(value)) {
      diagnostics.push({
        severity,
        code,
        path: diagnosticPath,
        message: `Duplicate value ${value}.`,
      });
      reported.add(value);
    }
    seen.add(value);
  }
}

function zodDiagnostics(
  basePath: string,
  error: ZodError
): ValidationDiagnostic[] {
  return error.issues.map((issue) => ({
    severity: "error",
    code: "schema.invalid",
    path: [basePath, ...issue.path.map(String)].join("."),
    message: issue.message,
  }));
}

async function listFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function repositoryRelative(filePath: string): string {
  return path.relative(REPOSITORY_ROOT, filePath).replaceAll("\\", "/");
}
