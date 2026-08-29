import type { KnowledgeRecord } from "./schemas";
import type {
  ReleasedCharacterCatalogEntry,
  TeamTemplateRecord,
} from "./teamRosterCandidateDomain";

type ExactTeamRecord = Extract<KnowledgeRecord, { kind: "team" }>;
type SourceReference = ExactTeamRecord["sourceRefs"][number];

export type SourceScopedCharacterRoleRecord = Extract<
  KnowledgeRecord,
  { kind: "character_role" }
>;

export interface SourceScopedRoleSampleExpectation {
  roleRecordId: string;
  templateId: string;
  slotId: string;
  roleId: string;
  targetTeamId: string;
  /** The source team order is part of the configured validation target. */
  targetMemberCharacterIds: readonly [string, string, string, string];
  evidenceCharacterId: string;
  expectedStructuralBindingMultiplicity: number;
}

export interface SourceScopedRoleSampleInput {
  roleRecord: SourceScopedCharacterRoleRecord;
  template: TeamTemplateRecord;
  targetTeam: ExactTeamRecord;
  eligibleCharacters: readonly ReleasedCharacterCatalogEntry[];
  expectation: SourceScopedRoleSampleExpectation;
  /** One and only one character must be bound to every hard template slot. */
  sourceSlotBinding: Readonly<Record<string, string>>;
  sourceSlotBindingBasis: "same-page-inferred-fit";
  /** Natural-language role conditions must be explicitly acknowledged. */
  satisfiedConditions?: Readonly<Record<string, readonly string[]>>;
}

export type SourceScopedRoleSampleIssueCode =
  | "configured-record-mismatch"
  | "role-record-state-invalid"
  | "rejected-record"
  | "invalid-eligible-catalog"
  | "ineligible-target-member"
  | "duplicate-target-member"
  | "shared-target-playable-identity"
  | "target-roster-mismatch"
  | "source-lineage-mismatch"
  | "ambiguous-source-lineage"
  | "role-application-mismatch"
  | "template-slot-missing"
  | "role-option-missing"
  | "unresolved-additional-role-option"
  | "role-evidence-invalid"
  | "role-member-not-eligible"
  | "role-member-missing"
  | "role-constellation-unverified"
  | "role-constellation-out-of-range"
  | "role-condition-unverified"
  | "binding-basis-mismatch"
  | "binding-keys-mismatch"
  | "binding-values-mismatch"
  | "binding-role-member-mismatch"
  | "binding-not-structural"
  | "structural-multiplicity-mismatch";

export interface SourceScopedRoleSampleIssue {
  code: SourceScopedRoleSampleIssueCode;
  stage:
    | "configuration"
    | "lineage"
    | "eligibility"
    | "role-evidence"
    | "binding"
    | "multiplicity";
  message: string;
}

export interface SourceScopedRoleSampleSurvivor {
  targetTeamId: string;
  targetMemberCharacterIds: string[];
  templateId: string;
  slotId: string;
  roleId: string;
  characterId: string;
  sourceSlotBinding: Record<string, string>;
  sourceSlotBindingBasis: "same-page-inferred-fit";
  structuralBindingMultiplicity: number;
  sourceLineage: {
    sourceId: string;
    pageUrl: string;
  };
}

export interface SourceScopedRoleSampleReport {
  schemaVersion: 1;
  reportType: "source-scoped-role-sample";
  comparisonStatus: "comparable" | "not-comparable";
  reviewStatus: "unreviewed";
  completeDomain: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsRankClaims: false;
  bindingProvenance: "same-page-inferred-fit";
  evidencePoolCharacterIds: string[];
  structuralBindingMultiplicity: number | null;
  survivor: SourceScopedRoleSampleSurvivor | null;
  issues: SourceScopedRoleSampleIssue[];
}

interface EligibleCharacter {
  characterId: string;
  elementId: string;
  playableIdentityId: string;
}

interface SourceLineage {
  sourceId: string;
  pageUrl: string;
}

/**
 * Tests one named role member against one exact source team. This deliberately
 * does not turn the role evidence into a global selector catalog and does not
 * enumerate a complete team domain.
 */
export function evaluateSourceScopedRoleSample(
  input: SourceScopedRoleSampleInput,
): SourceScopedRoleSampleReport {
  const issues: SourceScopedRoleSampleIssue[] = [];
  const addIssue = (
    code: SourceScopedRoleSampleIssueCode,
    stage: SourceScopedRoleSampleIssue["stage"],
    message: string,
  ): void => {
    issues.push({ code, stage, message });
  };

  validateConfiguredRecords(input, addIssue);
  const eligibleById = validateEligibleCatalog(input, addIssue);
  const targetMemberIds = input.targetTeam.members.map(
    ({ characterId }) => characterId,
  );
  validateTargetRoster(input, targetMemberIds, eligibleById, addIssue);

  const sourceLineage = findCommonSourceLineage(
    input.roleRecord.sourceRefs,
    input.template.sourceRefs,
    input.targetTeam.sourceRefs,
    addIssue,
  );
  const roleSlot = validateRoleApplication(input, addIssue);
  const evidencePoolCharacterIds = validateRoleEvidence(
    input,
    eligibleById,
    addIssue,
  );
  const evidenceMember = input.roleRecord.members.find(
    ({ characterId }) =>
      characterId === input.expectation.evidenceCharacterId,
  );
  validateEvidenceMemberConstraints(input, evidenceMember, addIssue);
  validateExplicitBinding(input, targetMemberIds, roleSlot, addIssue);

  let structuralBindingMultiplicity: number | null = null;
  if (
    roleSlot &&
    targetMemberIds.length === 4 &&
    new Set(targetMemberIds).size === 4 &&
    targetMemberIds.every((characterId) => eligibleById.has(characterId))
  ) {
    structuralBindingMultiplicity = countExactTargetStructuralBindings(
      input.template,
      targetMemberIds as [string, string, string, string],
      eligibleById,
      input.roleRecord,
      addIssue,
    );
    if (
      structuralBindingMultiplicity !==
      input.expectation.expectedStructuralBindingMultiplicity
    ) {
      addIssue(
        "structural-multiplicity-mismatch",
        "multiplicity",
        `Expected ${input.expectation.expectedStructuralBindingMultiplicity} structural bindings but observed ${structuralBindingMultiplicity}.`,
      );
    }
  }

  if (issues.length === 0) {
    const binding = { ...input.sourceSlotBinding };
    if (!assignmentMatchesTemplate(input.template, binding, eligibleById, input.roleRecord)) {
      addIssue(
        "binding-not-structural",
        "binding",
        "The explicit source binding does not satisfy the template hard-slot options.",
      );
    }
  }

  const survivor =
    issues.length === 0 && sourceLineage && structuralBindingMultiplicity !== null
      ? {
          targetTeamId: input.targetTeam.id,
          targetMemberCharacterIds: [...targetMemberIds],
          templateId: input.template.id,
          slotId: input.roleRecord.appliesTo.slotId,
          roleId: input.roleRecord.roleId,
          characterId: input.expectation.evidenceCharacterId,
          sourceSlotBinding: { ...input.sourceSlotBinding },
          sourceSlotBindingBasis: input.sourceSlotBindingBasis,
          structuralBindingMultiplicity,
          sourceLineage,
        }
      : null;

  return {
    schemaVersion: 1,
    reportType: "source-scoped-role-sample",
    comparisonStatus: survivor ? "comparable" : "not-comparable",
    reviewStatus: "unreviewed",
    completeDomain: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsRankClaims: false,
    bindingProvenance: "same-page-inferred-fit",
    evidencePoolCharacterIds,
    structuralBindingMultiplicity,
    survivor,
    issues,
  };
}

function validateConfiguredRecords(
  input: SourceScopedRoleSampleInput,
  addIssue: AddIssue,
): void {
  const { expectation, roleRecord, template, targetTeam } = input;
  const mismatches = [
    ["role record", roleRecord.id, expectation.roleRecordId],
    ["template", template.id, expectation.templateId],
    ["target team", targetTeam.id, expectation.targetTeamId],
    ["role", roleRecord.roleId, expectation.roleId],
    ["role slot", roleRecord.appliesTo.slotId, expectation.slotId],
  ].filter(([, actual, expected]) => actual !== expected);
  if (mismatches.length > 0) {
    addIssue(
      "configured-record-mismatch",
      "configuration",
      mismatches
        .map(
          ([label, actual, expected]) =>
            `${label} was ${String(actual)} instead of ${String(expected)}`,
        )
        .join("; "),
    );
  }
  if (
    roleRecord.status !== "candidate" ||
    roleRecord.promotionEligible !== false
  ) {
    addIssue(
      "role-record-state-invalid",
      "configuration",
      "The source-scoped role record must remain candidate evidence and explicitly promotion-ineligible.",
    );
  }
  for (const [label, record] of [
    ["role", roleRecord],
    ["template", template],
    ["target team", targetTeam],
  ] as const) {
    if (record.status === "rejected") {
      addIssue(
        "rejected-record",
        "configuration",
        `The configured ${label} record ${record.id} is rejected.`,
      );
    }
  }
  if (
    !Number.isInteger(expectation.expectedStructuralBindingMultiplicity) ||
    expectation.expectedStructuralBindingMultiplicity < 1
  ) {
    addIssue(
      "configured-record-mismatch",
      "configuration",
      "The expected structural binding multiplicity must be a positive integer.",
    );
  }
}

function validateEligibleCatalog(
  input: SourceScopedRoleSampleInput,
  addIssue: AddIssue,
): Map<string, EligibleCharacter> {
  const eligibleById = new Map<string, EligibleCharacter>();
  for (const entry of input.eligibleCharacters) {
    const playableIdentityId = normalizedPlayableIdentity(entry);
    if (
      entry.characterId.length === 0 ||
      entry.elementId.length === 0 ||
      playableIdentityId.length === 0 ||
      eligibleById.has(entry.characterId)
    ) {
      addIssue(
        "invalid-eligible-catalog",
        "eligibility",
        `The guide-domain eligibility catalog has an invalid or duplicate entry for ${entry.characterId || "<empty>"}.`,
      );
      continue;
    }
    eligibleById.set(entry.characterId, {
      characterId: entry.characterId,
      elementId: entry.elementId,
      playableIdentityId,
    });
  }
  return eligibleById;
}

function validateTargetRoster(
  input: SourceScopedRoleSampleInput,
  targetMemberIds: string[],
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
  addIssue: AddIssue,
): void {
  if (!arraysEqual(targetMemberIds, input.expectation.targetMemberCharacterIds)) {
    addIssue(
      "target-roster-mismatch",
      "configuration",
      "The configured target roster no longer exactly matches the source team member order.",
    );
  }
  if (new Set(targetMemberIds).size !== targetMemberIds.length) {
    addIssue(
      "duplicate-target-member",
      "eligibility",
      "The exact target roster contains a duplicate character ID.",
    );
  }
  const identities = targetMemberIds.flatMap((characterId) => {
    const entry = eligibleById.get(characterId);
    if (!entry) {
      addIssue(
        "ineligible-target-member",
        "eligibility",
        `Target member ${characterId} is not in the guide-domain eligibility catalog.`,
      );
      return [];
    }
    return [entry.playableIdentityId];
  });
  if (new Set(identities).size !== identities.length) {
    addIssue(
      "shared-target-playable-identity",
      "eligibility",
      "The exact target roster contains mutually exclusive forms of one playable identity.",
    );
  }
}

function findCommonSourceLineage(
  roleRefs: readonly SourceReference[],
  templateRefs: readonly SourceReference[],
  teamRefs: readonly SourceReference[],
  addIssue: AddIssue,
): SourceLineage | null {
  const role = sourceLineages(roleRefs);
  const template = new Set(
    sourceLineages(templateRefs).map(sourceLineageKey),
  );
  const team = new Set(sourceLineages(teamRefs).map(sourceLineageKey));
  const common = role.filter((lineage) => {
    const key = sourceLineageKey(lineage);
    return template.has(key) && team.has(key);
  });
  const unique = [...new Map(common.map((entry) => [sourceLineageKey(entry), entry])).values()];
  if (unique.length === 0) {
    addIssue(
      "source-lineage-mismatch",
      "lineage",
      "Role, template, and target team do not share an exact source ID and page URL.",
    );
    return null;
  }
  if (unique.length > 1) {
    addIssue(
      "ambiguous-source-lineage",
      "lineage",
      "Role, template, and target team share more than one source/page lineage.",
    );
    return null;
  }
  return unique[0] ?? null;
}

function validateRoleApplication(
  input: SourceScopedRoleSampleInput,
  addIssue: AddIssue,
): TeamTemplateRecord["slots"][number] | null {
  if (input.roleRecord.appliesTo.teamTemplateId !== input.template.id) {
    addIssue(
      "role-application-mismatch",
      "role-evidence",
      "The role record does not apply to the configured template.",
    );
  }
  const slot = input.template.slots.find(
    ({ id }) => id === input.roleRecord.appliesTo.slotId,
  );
  if (!slot) {
    addIssue(
      "template-slot-missing",
      "role-evidence",
      `Template ${input.template.id} has no hard slot ${input.roleRecord.appliesTo.slotId}.`,
    );
    return null;
  }
  const hasExactHardOption = slot.options.some(
    (option) =>
      option.type === "roles" &&
      option.roleIds.length === 1 &&
      option.roleIds[0] === input.roleRecord.roleId,
  );
  if (!hasExactHardOption) {
    addIssue(
      "role-option-missing",
      "role-evidence",
      `Hard slot ${slot.id} does not contain the exact role option ${input.roleRecord.roleId}.`,
    );
  }
  for (const templateSlot of input.template.slots) {
    for (const option of templateSlot.options) {
      if (
        option.type === "roles" &&
        !(
          templateSlot.id === slot.id &&
          option.roleIds.length === 1 &&
          option.roleIds[0] === input.roleRecord.roleId
        )
      ) {
        addIssue(
          "unresolved-additional-role-option",
          "role-evidence",
          `Template hard slot ${templateSlot.id} contains a role option outside the one configured source-scoped role record.`,
        );
      }
    }
  }
  return slot;
}

function validateRoleEvidence(
  input: SourceScopedRoleSampleInput,
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
  addIssue: AddIssue,
): string[] {
  const evidencePool = input.roleRecord.members
    .map(({ characterId }) => characterId)
    .sort(compareText);
  if (
    input.roleRecord.exhaustiveness !== "non-exhaustive" ||
    input.roleRecord.rankingClaim !== "none" ||
    evidencePool.length !== 1 ||
    new Set(evidencePool).size !== evidencePool.length
  ) {
    addIssue(
      "role-evidence-invalid",
      "role-evidence",
      "The named-role sample requires exactly one non-exhaustive, unranked member observation.",
    );
  }
  for (const member of input.roleRecord.members) {
    if (!eligibleById.has(member.characterId)) {
      addIssue(
        "role-member-not-eligible",
        "eligibility",
        `Role evidence member ${member.characterId} is not in the guide-domain eligibility catalog.`,
      );
    }
    if (
      (member.minConstellation !== undefined &&
        (!Number.isInteger(member.minConstellation) ||
          member.minConstellation < 0 ||
          member.minConstellation > 6)) ||
      (member.maxConstellation !== undefined &&
        (!Number.isInteger(member.maxConstellation) ||
          member.maxConstellation < 0 ||
          member.maxConstellation > 6)) ||
      (member.minConstellation !== undefined &&
        member.maxConstellation !== undefined &&
        member.minConstellation > member.maxConstellation) ||
      !Array.isArray(member.conditions) ||
      member.conditions.some((condition) => condition.length === 0)
    ) {
      addIssue(
        "role-evidence-invalid",
        "role-evidence",
        `Role evidence for ${member.characterId} has invalid bounds or conditions.`,
      );
    }
  }
  if (!evidencePool.includes(input.expectation.evidenceCharacterId)) {
    addIssue(
      "role-member-missing",
      "role-evidence",
      `Configured evidence character ${input.expectation.evidenceCharacterId} is absent from the role record.`,
    );
  }
  return evidencePool;
}

function validateEvidenceMemberConstraints(
  input: SourceScopedRoleSampleInput,
  evidenceMember: SourceScopedCharacterRoleRecord["members"][number] | undefined,
  addIssue: AddIssue,
): void {
  if (!evidenceMember) return;
  const targetMember = input.targetTeam.members.find(
    ({ characterId }) => characterId === evidenceMember.characterId,
  );
  if (!targetMember) return;
  const min = evidenceMember.minConstellation;
  const max = evidenceMember.maxConstellation;
  if (min !== undefined || max !== undefined) {
    const constellation =
      targetMember.investment.status === "specified" ||
      targetMember.investment.status === "partial"
        ? targetMember.investment.constellation
        : undefined;
    if (constellation === undefined) {
      addIssue(
        "role-constellation-unverified",
        "role-evidence",
        "The role evidence has a constellation bound, but the target investment does not specify a constellation.",
      );
    } else if ((min !== undefined && constellation < min) || (max !== undefined && constellation > max)) {
      addIssue(
        "role-constellation-out-of-range",
        "role-evidence",
        `Target constellation ${constellation} does not satisfy the role evidence bounds.`,
      );
    }
  }
  const satisfied = new Set(
    input.satisfiedConditions?.[evidenceMember.characterId] ?? [],
  );
  const missingConditions = evidenceMember.conditions.filter(
    (condition) => !satisfied.has(condition),
  );
  if (missingConditions.length > 0) {
    addIssue(
      "role-condition-unverified",
      "role-evidence",
      `Target evidence has unverified role conditions: ${missingConditions.join("; ")}.`,
    );
  }
}

function validateExplicitBinding(
  input: SourceScopedRoleSampleInput,
  targetMemberIds: string[],
  roleSlot: TeamTemplateRecord["slots"][number] | null,
  addIssue: AddIssue,
): void {
  if (input.sourceSlotBindingBasis !== "same-page-inferred-fit") {
    addIssue(
      "binding-basis-mismatch",
      "binding",
      "The named-role sample requires same-page-inferred-fit binding provenance.",
    );
  }
  const expectedKeys = input.template.slots.map(({ id }) => id).sort(compareText);
  const observedKeys = Object.keys(input.sourceSlotBinding).sort(compareText);
  if (!arraysEqual(expectedKeys, observedKeys)) {
    addIssue(
      "binding-keys-mismatch",
      "binding",
      "The explicit source binding must cover every hard template slot exactly once.",
    );
  }
  const bindingValues = Object.values(input.sourceSlotBinding).sort(compareText);
  const rosterValues = [...targetMemberIds].sort(compareText);
  if (
    !arraysEqual(bindingValues, rosterValues) ||
    new Set(bindingValues).size !== bindingValues.length
  ) {
    addIssue(
      "binding-values-mismatch",
      "binding",
      "The explicit source binding values must equal the exact target roster with no duplicates.",
    );
  }
  if (
    roleSlot &&
    input.sourceSlotBinding[roleSlot.id] !==
      input.expectation.evidenceCharacterId
  ) {
    addIssue(
      "binding-role-member-mismatch",
      "binding",
      `The explicit role slot ${roleSlot.id} is not bound to ${input.expectation.evidenceCharacterId}.`,
    );
  }
}

function countExactTargetStructuralBindings(
  template: TeamTemplateRecord,
  memberIds: [string, string, string, string],
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
  roleRecord: SourceScopedCharacterRoleRecord,
  addIssue: AddIssue,
): number {
  let count = 0;
  for (const assignment of permutations(memberIds)) {
    const binding = Object.fromEntries(
      template.slots.map((slot, index) => [slot.id, assignment[index] as string]),
    );
    const match = assignmentMatchesTemplate(
      template,
      binding,
      eligibleById,
      roleRecord,
    );
    if (match === null) {
      addIssue(
        "unresolved-additional-role-option",
        "role-evidence",
        "Structural multiplicity encountered a role option outside the configured source-scoped role record.",
      );
      return 0;
    }
    if (match) count += 1;
  }
  return count;
}

function assignmentMatchesTemplate(
  template: TeamTemplateRecord,
  binding: Readonly<Record<string, string>>,
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
  roleRecord: SourceScopedCharacterRoleRecord,
): boolean | null {
  for (const slot of template.slots) {
    const characterId = binding[slot.id];
    const catalogEntry = characterId
      ? eligibleById.get(characterId)
      : undefined;
    if (!characterId || !catalogEntry) return false;
    let slotMatches = false;
    for (const option of slot.options) {
      if (option.type === "any") {
        slotMatches = true;
      } else if (option.type === "characters") {
        slotMatches ||= option.characterIds.includes(characterId);
      } else if (option.type === "elements") {
        slotMatches ||= option.elements.includes(
          catalogEntry.elementId as (typeof option.elements)[number],
        );
      } else if (
        slot.id === roleRecord.appliesTo.slotId &&
        option.roleIds.length === 1 &&
        option.roleIds[0] === roleRecord.roleId
      ) {
        slotMatches ||= roleRecord.members.some(
          (member) => member.characterId === characterId,
        );
      } else {
        return null;
      }
    }
    if (!slotMatches) return false;
  }
  return true;
}

function sourceLineages(refs: readonly SourceReference[]): SourceLineage[] {
  return refs.flatMap((ref) =>
    "url" in ref.locator
      ? [{ sourceId: ref.sourceId, pageUrl: ref.locator.url }]
      : [],
  );
}

function sourceLineageKey(lineage: SourceLineage): string {
  return `${lineage.sourceId}\u0000${lineage.pageUrl}`;
}

function normalizedPlayableIdentity(
  entry: ReleasedCharacterCatalogEntry,
): string {
  return (
    entry.playableIdentityId ??
    (entry.characterId.startsWith("traveler_") ? "traveler" : entry.characterId)
  );
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map(
      (tail) => [value, ...tail],
    ),
  );
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

type AddIssue = (
  code: SourceScopedRoleSampleIssueCode,
  stage: SourceScopedRoleSampleIssue["stage"],
  message: string,
) => void;
