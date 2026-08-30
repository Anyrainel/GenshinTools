import {
  KnowledgeTeamSchema,
  type ArtifactChoice,
  type KnowledgeRecord,
  type KnowledgeRepository,
} from "./schemas";

type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;
type KnowledgeCharacterGuide = Extract<
  KnowledgeRecord,
  { kind: "character_guide" }
>;
type SourceReference = KnowledgeRecord["sourceRefs"][number];

export interface SourceBackedEquipmentSelection {
  characterId: string;
  characterGuideId: string;
  weaponId: string;
  buildSourceRecordId: string;
}

export interface SourceBackedEquipmentEvidence {
  characterId: string;
  characterGuideId: string;
  guideStatus: "baseline" | "accepted";
  guideSourceRefs: SourceReference[];
  weaponId: string;
  weaponOrderIndex: number;
  buildSourceRecordId: string;
  build: {
    visible: boolean;
    minConstellation?: number;
    artifact: ArtifactChoice;
  };
}

export interface SourceBackedEquipmentScenario {
  schemaVersion: 1;
  classification: "source-backed-equipment-fixture";
  supportsGuideClaims: false;
  sourceTeamRecordId: string;
  team: KnowledgeTeam;
  evidence: SourceBackedEquipmentEvidence[];
  cautions: string[];
}

const CAUTIONS = [
  "Each equipment choice is an explicit fixture selected from a source-backed character guide; it does not prove that the guide build applies to this team.",
  "The selected weapons and artifacts are not computed winners or a ranking produced by the guide factory.",
  "Weapon refinements are unspecified and are not inferred by this materializer.",
  "Build stat sheets, main-stat choices, and substat weights are not copied into the team fixture.",
  "Combining individually sourced choices does not establish team synergy or optimality.",
  "No ER floor, ER target, or energy feasibility claim is inferred or added.",
] as const;

/**
 * Populate an external exact-team observation with explicitly selected equipment
 * from baseline or accepted character guides.
 *
 * This is a provenance-preserving fixture builder, not an optimizer. It copies
 * only a weapon ID and artifact choice into each team member and leaves all
 * gameplay acceptance questions outside the result.
 */
export function materializeSourceBackedEquipmentScenario(
  repository: KnowledgeRepository,
  externalTeamRecordId: string,
  selections: readonly SourceBackedEquipmentSelection[],
): SourceBackedEquipmentScenario {
  requireNonEmpty("external team record ID", externalTeamRecordId);
  const teamRecord = requiredUniqueRecord(repository, externalTeamRecordId);
  if (teamRecord.kind !== "team") {
    throw new Error(
      `Equipment scenario ${externalTeamRecordId}: source record must be an exact team, found ${teamRecord.kind}.`,
    );
  }
  if (teamRecord.status === "baseline") {
    throw new Error(
      `Equipment scenario ${externalTeamRecordId}: source team must be external rather than baseline.`,
    );
  }
  if (teamRecord.status === "rejected") {
    throw new Error(
      `Equipment scenario ${externalTeamRecordId}: rejected source teams cannot be materialized.`,
    );
  }

  const team = KnowledgeTeamSchema.parse(teamRecord);
  for (const member of team.members) {
    const existingFields = [
      member.selectedWeapon == null ? null : "selectedWeapon",
      member.selectedArtifact == null ? null : "selectedArtifact",
    ].filter((field): field is string => field != null);
    if (existingFields.length > 0) {
      throw new Error(
        `Equipment scenario ${externalTeamRecordId}: source team member ${member.characterId} already has ${existingFields.join(" and ")}; refusing to overwrite source-backed equipment provenance.`,
      );
    }
  }
  const teamCharacterIds = team.members.map(({ characterId }) => characterId);
  if (new Set(teamCharacterIds).size !== teamCharacterIds.length) {
    throw new Error(
      `Equipment scenario ${externalTeamRecordId}: exact team characters must be unique.`,
    );
  }

  const selectionByCharacter = validateSelections(
    externalTeamRecordId,
    teamCharacterIds,
    selections,
  );
  const evidence: SourceBackedEquipmentEvidence[] = [];
  for (const member of team.members) {
    const selection = selectionByCharacter.get(member.characterId);
    if (!selection) {
      throw new Error(
        `Equipment scenario ${externalTeamRecordId}: missing selection for ${member.characterId}.`,
      );
    }
    const guide = requiredGuide(
      repository,
      externalTeamRecordId,
      member.characterId,
      selection.characterGuideId,
    );
    const weaponOrderIndex = requiredWeaponOrderIndex(
      externalTeamRecordId,
      guide,
      selection.weaponId,
    );
    const build = requiredUniqueBuild(
      externalTeamRecordId,
      guide,
      selection.buildSourceRecordId,
    );
    const artifact = cloneArtifact(build.artifact);
    evidence.push({
      characterId: member.characterId,
      characterGuideId: guide.id,
      guideStatus: guide.status,
      guideSourceRefs: guide.sourceRefs.map(cloneSourceReference),
      weaponId: selection.weaponId,
      weaponOrderIndex,
      buildSourceRecordId: build.sourceRecordId,
      build: {
        visible: build.visible,
        ...(build.minConstellation == null
          ? {}
          : { minConstellation: build.minConstellation }),
        artifact: cloneArtifact(artifact),
      },
    });
  }

  return materializeSourceBackedEquipmentScenarioFromSelectedEvidence(
    team,
    evidence,
  );
}

/**
 * Materialize an exact source team from an already selected, attributable
 * equipment-evidence DTO. This is the narrow handoff used after a caller has
 * independently authenticated its source projection; it never requires a
 * fabricated repository or placeholder records.
 */
export function materializeSourceBackedEquipmentScenarioFromSelectedEvidence(
  sourceTeam: KnowledgeTeam,
  selectedEvidence: readonly SourceBackedEquipmentEvidence[],
): SourceBackedEquipmentScenario {
  const team = KnowledgeTeamSchema.parse(sourceTeam);
  if (team.status === "baseline") {
    throw new Error(
      `Equipment scenario ${team.id}: source team must be external rather than baseline.`,
    );
  }
  if (team.status === "rejected") {
    throw new Error(
      `Equipment scenario ${team.id}: rejected source teams cannot be materialized.`,
    );
  }
  const teamCharacterIds = team.members.map(({ characterId }) => characterId);
  if (new Set(teamCharacterIds).size !== teamCharacterIds.length) {
    throw new Error(
      `Equipment scenario ${team.id}: exact team characters must be unique.`,
    );
  }
  for (const member of team.members) {
    const existingFields = [
      member.selectedWeapon == null ? null : "selectedWeapon",
      member.selectedArtifact == null ? null : "selectedArtifact",
    ].filter((field): field is string => field != null);
    if (existingFields.length > 0) {
      throw new Error(
        `Equipment scenario ${team.id}: source team member ${member.characterId} already has ${existingFields.join(" and ")}; refusing to overwrite source-backed equipment provenance.`,
      );
    }
  }

  const evidenceByCharacter = new Map<string, SourceBackedEquipmentEvidence>();
  for (const row of selectedEvidence) {
    requireNonEmpty("equipment evidence character ID", row.characterId);
    requireNonEmpty(
      "equipment evidence character guide ID",
      row.characterGuideId,
    );
    requireNonEmpty("equipment evidence weapon ID", row.weaponId);
    requireNonEmpty(
      "equipment evidence build source record ID",
      row.buildSourceRecordId,
    );
    if (evidenceByCharacter.has(row.characterId)) {
      throw new Error(
        `Equipment scenario ${team.id}: duplicate selected evidence for ${row.characterId}.`,
      );
    }
    evidenceByCharacter.set(row.characterId, row);
  }
  const teamCharacters = new Set(teamCharacterIds);
  const extra = [...evidenceByCharacter.keys()]
    .filter((characterId) => !teamCharacters.has(characterId))
    .sort(compareText);
  const missing = teamCharacterIds
    .filter((characterId) => !evidenceByCharacter.has(characterId))
    .sort(compareText);
  if (extra.length > 0 || missing.length > 0) {
    throw new Error(
      `Equipment scenario ${team.id}: selected evidence must match the exact team (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}).`,
    );
  }

  const evidence = teamCharacterIds.map((characterId) => {
    const row = evidenceByCharacter.get(characterId);
    if (!row) {
      throw new Error(
        `Equipment scenario ${team.id}: missing selected evidence for ${characterId}.`,
      );
    }
    return cloneSourceBackedEquipmentEvidence(row);
  });
  const materializedTeam = KnowledgeTeamSchema.parse({
    ...team,
    members: team.members.map((member) => {
      const row = evidenceByCharacter.get(member.characterId);
      if (!row) {
        throw new Error(
          `Equipment scenario ${team.id}: missing selected evidence for ${member.characterId}.`,
        );
      }
      return {
        ...member,
        selectedWeapon: { weaponId: row.weaponId },
        selectedArtifact: cloneArtifact(row.build.artifact),
      };
    }),
  });

  return {
    schemaVersion: 1,
    classification: "source-backed-equipment-fixture",
    supportsGuideClaims: false,
    sourceTeamRecordId: team.id,
    team: materializedTeam,
    evidence,
    cautions: [...CAUTIONS],
  };
}

function validateSelections(
  teamId: string,
  teamCharacterIds: readonly string[],
  selections: readonly SourceBackedEquipmentSelection[],
): Map<string, SourceBackedEquipmentSelection> {
  const byCharacter = new Map<string, SourceBackedEquipmentSelection>();
  for (const selection of selections) {
    requireNonEmpty("selection character ID", selection.characterId);
    requireNonEmpty("character guide ID", selection.characterGuideId);
    requireNonEmpty("weapon ID", selection.weaponId);
    requireNonEmpty("build source record ID", selection.buildSourceRecordId);
    if (byCharacter.has(selection.characterId)) {
      throw new Error(
        `Equipment scenario ${teamId}: duplicate selection for ${selection.characterId}.`,
      );
    }
    byCharacter.set(selection.characterId, selection);
  }

  const teamCharacters = new Set(teamCharacterIds);
  const extra = [...byCharacter.keys()]
    .filter((characterId) => !teamCharacters.has(characterId))
    .sort(compareText);
  if (extra.length > 0) {
    throw new Error(
      `Equipment scenario ${teamId}: selections contain characters outside the team (${extra.join(", ")}).`,
    );
  }
  const missing = teamCharacterIds
    .filter((characterId) => !byCharacter.has(characterId))
    .sort(compareText);
  if (missing.length > 0) {
    throw new Error(
      `Equipment scenario ${teamId}: selections are missing team characters (${missing.join(", ")}).`,
    );
  }
  return byCharacter;
}

function requiredGuide(
  repository: KnowledgeRepository,
  teamId: string,
  characterId: string,
  guideId: string,
): KnowledgeCharacterGuide & { status: "baseline" | "accepted" } {
  const record = requiredUniqueRecord(repository, guideId);
  if (record.kind !== "character_guide") {
    throw new Error(
      `Equipment scenario ${teamId}: ${guideId} must be a character guide, found ${record.kind}.`,
    );
  }
  if (record.characterId !== characterId) {
    throw new Error(
      `Equipment scenario ${teamId}: guide ${guideId} belongs to ${record.characterId}, not ${characterId}.`,
    );
  }
  if (record.status !== "baseline" && record.status !== "accepted") {
    throw new Error(
      `Equipment scenario ${teamId}: guide ${guideId} must have baseline or accepted status, found ${record.status}.`,
    );
  }
  return { ...record, status: record.status };
}

function requiredWeaponOrderIndex(
  teamId: string,
  guide: KnowledgeCharacterGuide,
  weaponId: string,
): number {
  const indices = (guide.weaponOrder ?? []).flatMap((candidate, index) =>
    candidate === weaponId ? [index] : [],
  );
  if (indices.length === 0) {
    throw new Error(
      `Equipment scenario ${teamId}: weapon ${weaponId} is not explicitly present in ${guide.id}.weaponOrder.`,
    );
  }
  if (indices.length > 1) {
    throw new Error(
      `Equipment scenario ${teamId}: weapon ${weaponId} appears more than once in ${guide.id}.weaponOrder.`,
    );
  }
  return indices[0];
}

function requiredUniqueBuild(
  teamId: string,
  guide: KnowledgeCharacterGuide,
  buildSourceRecordId: string,
): KnowledgeCharacterGuide["builds"][number] {
  const matches = guide.builds.filter(
    ({ sourceRecordId }) => sourceRecordId === buildSourceRecordId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Equipment scenario ${teamId}: expected exactly one build ${buildSourceRecordId} in ${guide.id}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function requiredUniqueRecord(
  repository: KnowledgeRepository,
  recordId: string,
): KnowledgeRecord {
  const matches = repository.records.filter(({ id }) => id === recordId);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one knowledge record ${recordId}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function cloneArtifact(artifact: ArtifactChoice): ArtifactChoice {
  if (artifact.type === "4pc") {
    return { type: "4pc", setId: artifact.setId };
  }
  return {
    type: "2pc+2pc",
    halfSetIds: [artifact.halfSetIds[0], artifact.halfSetIds[1]],
  };
}

function cloneSourceReference(reference: SourceReference): SourceReference {
  return {
    sourceId: reference.sourceId,
    sourceRecordId: reference.sourceRecordId,
    locator: { ...reference.locator },
  };
}

function cloneSourceBackedEquipmentEvidence(
  evidence: SourceBackedEquipmentEvidence,
): SourceBackedEquipmentEvidence {
  return {
    characterId: evidence.characterId,
    characterGuideId: evidence.characterGuideId,
    guideStatus: evidence.guideStatus,
    guideSourceRefs: evidence.guideSourceRefs.map(cloneSourceReference),
    weaponId: evidence.weaponId,
    weaponOrderIndex: evidence.weaponOrderIndex,
    buildSourceRecordId: evidence.buildSourceRecordId,
    build: {
      visible: evidence.build.visible,
      ...(evidence.build.minConstellation == null
        ? {}
        : { minConstellation: evidence.build.minConstellation }),
      artifact: cloneArtifact(evidence.build.artifact),
    },
  };
}

function requireNonEmpty(label: string, value: string): void {
  if (!value.trim()) throw new Error(`${label} must not be empty.`);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
