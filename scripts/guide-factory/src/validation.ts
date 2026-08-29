import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ZodError } from "zod";
import type { GameCatalogs } from "./catalogs";
import { stableJson } from "./io";
import {
  FACTORY_ROOT,
  REPOSITORY_ROOT,
} from "./paths";
import {
  GenshinToolsPresetSnapshotSchema,
  KnowledgeRepositorySchema,
  LegacyTeamSnapshotSchema,
  SourceRegistrySchema,
  type ArtifactChoice,
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type LegacyArtifactChoice,
  type LegacyTeamSnapshot,
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
}

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
    return;
  }

  validateCharacterId(
    record.characterId,
    `${recordPath}.characterId`,
    catalogs,
    catalogSeverity,
    diagnostics
  );
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
  sourceRecordCatalog: ReadonlyMap<string, SourceLocator>,
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
      manifest.ingestionMode === "permission-blocked" ||
      manifest.ingestionMode === "reference-only" ||
      manifest.ingestionMode === "user-initiated-only"
    ) {
      diagnostics.push({
        severity: "error",
        code: "provenance.ingestion_not_permitted",
        path: `${referencePath}.sourceId`,
        message: `Registry ingestion mode ${manifest.ingestionMode} does not permit repository records.`,
      });
    }

    const expectedLocator = sourceRecordCatalog.get(referenceKey);
    if (
      (manifest.recordFormat === "genshintools-presets-v1" ||
        manifest.recordFormat === "legacy-team-research-v1") &&
      !expectedLocator
    ) {
      diagnostics.push({
        severity: "error",
        code: "provenance.dangling_source_record",
        path: `${referencePath}.sourceRecordId`,
        message: `Source record ${referenceKey} does not exist in its snapshot.`,
      });
    } else if (
      expectedLocator &&
      stableJson(expectedLocator) !== stableJson(reference.locator)
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
): ReadonlyMap<string, SourceLocator> {
  const catalog = new Map<string, SourceLocator>();
  if (context.genshinToolsSnapshot) {
    for (const record of [
      ...context.genshinToolsSnapshot.teams,
      ...context.genshinToolsSnapshot.characterGuides,
    ]) {
      catalog.set(
        `genshintools-presets:${record.sourceRecordId}`,
        record.locator
      );
    }
  }
  if (context.legacySnapshot) {
    for (const record of context.legacySnapshot.records) {
      catalog.set(
        `legacy-team-research:${record.sourceRecordId}`,
        record.locator
      );
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
