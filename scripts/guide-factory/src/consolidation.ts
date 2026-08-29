import {
  GenshinToolsPresetSnapshotSchema,
  KnowledgeRepositorySchema,
  LegacyTeamSnapshotSchema,
  ManualObservationSnapshotSchema,
  SourceRegistrySchema,
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type LegacyArtifactChoice,
  type LegacyTeamSnapshot,
  type ManualObservationSnapshot,
} from "./schemas";
import { assertManualSnapshotSourcesRegistered } from "./manualSnapshots";

export interface KnowledgeConsolidationInput {
  sourceRegistry: unknown;
  sourceRegistrySha256: string;
  genshinTools: unknown;
  legacy: unknown;
  manualSnapshots: Array<{
    expectedSourceId: string;
    snapshot: unknown;
    snapshotFile: { path: string; sha256: string };
  }>;
}

/**
 * Convert source-shaped snapshots into the provisional knowledge repository.
 *
 * Consolidation deliberately does not join character-wide build advice onto
 * team members. It only normalizes the two source formats into separately
 * attributable records with an explicit review status.
 */
export function consolidateKnowledge(
  input: KnowledgeConsolidationInput
): KnowledgeRepository {
  const sourceRegistry = SourceRegistrySchema.parse(input.sourceRegistry);
  const genshinTools = GenshinToolsPresetSnapshotSchema.parse(
    input.genshinTools
  );
  const legacy = LegacyTeamSnapshotSchema.parse(input.legacy);
  const manualSnapshots = input.manualSnapshots.map(
    ({ expectedSourceId, snapshot: snapshotInput, snapshotFile }) => {
      const snapshot = ManualObservationSnapshotSchema.parse(snapshotInput);
      if (snapshot.sourceId !== expectedSourceId) {
        throw new Error(
          `Manual snapshot ${snapshotFile.path} declares ${snapshot.sourceId}, expected ${expectedSourceId}.`
        );
      }
      return { snapshot, snapshotFile };
    }
  );
  assertManualSnapshotSourcesRegistered(
    manualSnapshots.map(({ snapshot }) => snapshot.sourceId),
    sourceRegistry
  );
  assertUniqueManualSourceRecordIds(manualSnapshots);

  const records = [
    ...genshinTools.teams.map((team) => ({
      id: recordId(genshinTools.sourceId, "team", team.sourceRecordId),
      kind: "team" as const,
      status: "baseline" as const,
      ...(team.name ? { label: team.name } : {}),
      members: team.members.map((member) => ({
        characterId: member.characterId,
        investment: { status: "unspecified" as const },
        selectedWeapon: member.selectedWeaponId
          ? { weaponId: member.selectedWeaponId }
          : null,
        selectedArtifact: member.selectedArtifact,
        ...(member.erFloorPercent != null
          ? { erFloorPercent: member.erFloorPercent }
          : {}),
      })),
      ...(team.reactions?.length
        ? { reactions: [...team.reactions] }
        : {}),
      damagePlans: [],
      sourceRefs: [
        {
          sourceId: genshinTools.sourceId,
          sourceRecordId: team.sourceRecordId,
          locator: team.locator,
        },
      ],
      unknowns: [...team.unknowns],
    })),
    ...genshinTools.characterGuides.map((guide) => ({
      id: recordId(
        genshinTools.sourceId,
        "character-guide",
        guide.sourceRecordId
      ),
      kind: "character_guide" as const,
      status: "baseline" as const,
      characterId: guide.characterId,
      ...(guide.weaponOrder
        ? { weaponOrder: [...guide.weaponOrder] }
        : {}),
      builds: guide.builds.map((build) => ({
        ...build,
        ...(build.styles ? { styles: [...build.styles] } : {}),
        ...(build.roles ? { roles: [...build.roles] } : {}),
        sands: build.sands.map((stat) => ({ ...stat })),
        goblet: build.goblet.map((stat) => ({ ...stat })),
        circlet: build.circlet.map((stat) => ({ ...stat })),
        substats: build.substats.map((stat) => ({ ...stat })),
      })),
      sourceRefs: [
        {
          sourceId: genshinTools.sourceId,
          sourceRecordId: guide.sourceRecordId,
          locator: guide.locator,
        },
      ],
      unknowns: [...guide.unknowns],
    })),
    ...legacy.records.map((team) => ({
      id: recordId(legacy.sourceId, "team", team.sourceRecordId),
      kind: "team" as const,
      status: "candidate" as const,
      ...(team.name ? { label: team.name } : {}),
      members: team.members.map((member) => ({
        characterId: member.characterId,
        investment: { status: "unspecified" as const },
        selectedWeapon: member.selectedWeaponId
          ? { weaponId: member.selectedWeaponId }
          : null,
        selectedArtifact: normalizeLegacyArtifact(member.selectedArtifact),
      })),
      ...(team.reactionLabel != null && team.reactionLabel !== "none"
        ? { reactions: [normalizeLegacyReactionLabel(team.reactionLabel)] }
        : {}),
      damagePlans: [],
      sourceRefs: [
        {
          sourceId: legacy.sourceId,
          sourceRecordId: team.sourceRecordId,
          locator: team.locator,
        },
      ],
      unknowns: [...team.unknowns],
    })),
    ...manualSnapshots.flatMap(({ snapshot }) =>
      snapshot.records.map((record) =>
        consolidateManualRecord(snapshot, record)
      )
    ),
  ].sort(compareKnowledgeRecords);

  assertUniqueRecordIds(records);

  return KnowledgeRepositorySchema.parse({
    schemaVersion: 1,
    sourceRegistrySha256: input.sourceRegistrySha256,
    generatedFrom: mergeSourceRevisions([
      sourceRevision(genshinTools),
      sourceRevision(legacy),
      ...manualSnapshots.map(({ snapshot, snapshotFile }) => ({
        sourceId: snapshot.sourceId,
        files: [{ ...snapshotFile }],
      })),
    ]),
    records,
  });
}

function consolidateManualRecord(
  snapshot: ManualObservationSnapshot,
  record: ManualObservationSnapshot["records"][number]
): KnowledgeRecord {
  const sourceRefs = [record.locator, ...record.supportingLocators].map(
    (locator) => ({
      sourceId: snapshot.sourceId,
      sourceRecordId: record.sourceRecordId,
      locator,
    })
  );
  const unknowns = [
    ...record.unknowns,
    ...(record.extraction.reviewStatus === "unreviewed"
      ? ["agent-assisted extraction has not been human-reviewed"]
      : []),
  ];

  if (record.kind === "character_guide") {
    return {
      id: recordId(
        snapshot.sourceId,
        "character-guide",
        record.sourceRecordId
      ),
      kind: "character_guide",
      status: "candidate",
      promotionEligible: false,
      characterId: record.characterId,
      builds: [],
      recommendations: [record.recommendation],
      sourceRefs,
      unknowns,
    };
  }

  if (record.kind === "energy_guidance") {
    return {
      id: recordId(
        snapshot.sourceId,
        "energy-guidance",
        record.sourceRecordId
      ),
      kind: "energy_guidance",
      status: "candidate",
      promotionEligible: false,
      characterId: record.characterId,
      ...(record.constellation != null
        ? { constellation: record.constellation }
        : {}),
      teamContext: record.teamContext,
      targets: record.targets,
      ...(record.rotation ? { rotation: record.rotation } : {}),
      sourceRefs,
      unknowns,
    };
  }

  if (record.kind === "team_template") {
    return {
      id: recordId(
        snapshot.sourceId,
        "team-template",
        record.sourceRecordId
      ),
      kind: "team_template",
      status: "candidate",
      promotionEligible: false,
      ...(record.label ? { label: record.label } : {}),
      intent: record.intent,
      exhaustiveness: record.exhaustiveness,
      rankingClaim: record.rankingClaim,
      slots: record.slots.map((slot) => ({
        id: slot.id,
        options: slot.options.map(cloneTeamTemplateSelector),
        ...(slot.highlightedOptions
          ? {
              highlightedOptions: slot.highlightedOptions.map(
                cloneTeamTemplateSelector
              ),
            }
          : {}),
      })),
      ...(record.reactions?.length
        ? { reactions: [...record.reactions] }
        : {}),
      sourceRefs,
      unknowns,
    };
  }

  return {
    id: recordId(snapshot.sourceId, "team", record.sourceRecordId),
    kind: "team",
    status: "candidate",
    promotionEligible: false,
    ...(record.label ? { label: record.label } : {}),
    intent: record.intent,
    exhaustiveness: record.exhaustiveness,
    rankingClaim: record.rankingClaim,
    members: record.members.map((member) => ({
      characterId: member.characterId,
      investment:
        member.constellation != null
          ? {
              status: "partial" as const,
              constellation: member.constellation,
            }
          : { status: "unspecified" as const },
      selectedWeapon: null,
      selectedArtifact: null,
      ...(member.weaponOrdering
        ? { weaponOrdering: member.weaponOrdering }
        : {}),
      ...(member.weaponRecommendations.length
        ? { weaponRecommendations: member.weaponRecommendations }
        : {}),
      ...(member.artifactOrdering
        ? { artifactOrdering: member.artifactOrdering }
        : {}),
      ...(member.artifactRecommendations.length
        ? { artifactRecommendations: member.artifactRecommendations }
        : {}),
      ...(member.mainStats ? { mainStats: member.mainStats } : {}),
      ...(member.substats ? { substats: member.substats } : {}),
      ...(member.erTargets.length ? { erTargets: member.erTargets } : {}),
    })),
    ...(record.reactions?.length ? { reactions: record.reactions } : {}),
    damagePlans: [],
    rotations: record.rotations,
    sourceRefs,
    unknowns,
  };
}

function cloneTeamTemplateSelector<
  T extends
    | { type: "characters"; characterIds: string[] }
    | { type: "elements"; elements: string[] }
    | { type: "roles"; roleIds: string[] }
    | { type: "any" },
>(option: T): T {
  if (option.type === "characters") {
    return { ...option, characterIds: [...option.characterIds] };
  }
  if (option.type === "elements") {
    return { ...option, elements: [...option.elements] };
  }
  if (option.type === "roles") {
    return { ...option, roleIds: [...option.roleIds] };
  }
  return { ...option };
}

function sourceRevision(
  snapshot: GenshinToolsPresetSnapshot | LegacyTeamSnapshot
) {
  return {
    sourceId: snapshot.sourceId,
    files: snapshot.sourceRevision.files
      .map((file) => ({ ...file }))
      .sort((left, right) => compareText(left.path, right.path)),
  };
}

function mergeSourceRevisions(
  revisions: Array<{
    sourceId: string;
    files: Array<{ path: string; sha256: string }>;
  }>
): Array<{
  sourceId: string;
  files: Array<{ path: string; sha256: string }>;
}> {
  const bySource = new Map<
    string,
    Map<string, { path: string; sha256: string }>
  >();
  for (const revision of revisions) {
    const files = bySource.get(revision.sourceId) ?? new Map();
    bySource.set(revision.sourceId, files);
    for (const file of revision.files) {
      const previous = files.get(file.path);
      if (previous && previous.sha256 !== file.sha256) {
        throw new Error(
          `Conflicting hashes for ${revision.sourceId} source file ${file.path}.`
        );
      }
      files.set(file.path, { ...file });
    }
  }
  return [...bySource.entries()]
    .map(([sourceId, files]) => ({
      sourceId,
      files: [...files.values()].sort((left, right) =>
        compareText(left.path, right.path)
      ),
    }))
    .sort((left, right) => compareText(left.sourceId, right.sourceId));
}

function recordId(
  sourceId: string,
  kind:
    | "team"
    | "team-template"
    | "character-guide"
    | "energy-guidance",
  sourceRecordId: string
): string {
  return `${sourceId}:${kind}:${sourceRecordId}`;
}

function normalizeLegacyReactionLabel(
  reactionLabel: string
): string {
  if (reactionLabel === "freeze") return "frozen";
  if (reactionLabel === "overload") return "overloaded";
  return reactionLabel;
}

function normalizeLegacyArtifact(
  artifact: LegacyArtifactChoice | null
) {
  if (!artifact || artifact.type === "4pc") return artifact;
  if (!artifact.normalizedHalfSetIds) return null;
  return {
    type: "2pc+2pc" as const,
    halfSetIds: artifact.normalizedHalfSetIds,
  };
}

function compareKnowledgeRecords(
  left: KnowledgeRecord,
  right: KnowledgeRecord
): number {
  return compareText(left.id, right.id);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertUniqueRecordIds(records: KnowledgeRecord[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) {
      throw new Error(`Duplicate consolidated record ID: ${record.id}`);
    }
    seen.add(record.id);
  }
}

function assertUniqueManualSourceRecordIds(
  snapshots: Array<{
    snapshot: ManualObservationSnapshot;
    snapshotFile: { path: string; sha256: string };
  }>
): void {
  const seen = new Map<string, string>();
  for (const { snapshot, snapshotFile } of snapshots) {
    for (const record of snapshot.records) {
      const key = `${snapshot.sourceId}:${record.sourceRecordId}`;
      const previousPath = seen.get(key);
      if (previousPath) {
        throw new Error(
          `Duplicate manual source record ID ${key} in ${previousPath} and ${snapshotFile.path}.`
        );
      }
      seen.set(key, snapshotFile.path);
    }
  }
}
