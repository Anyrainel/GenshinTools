import type { KnowledgeRecord } from "./schemas";
import type { SourceScopedCharacterRoleRecord } from "./sourceScopedRoleSample";
import type {
  ReleasedCharacterCatalogEntry,
  TeamTemplateRecord,
} from "./teamRosterCandidateDomain";

type ExactTeamRecord = Extract<KnowledgeRecord, { kind: "team" }>;
type SourceReference = ExactTeamRecord["sourceRefs"][number];

export interface SourceScopedRolePairDescriptor {
  record: SourceScopedCharacterRoleRecord;
  expectedRecordId: string;
  expectedTemplateId: string;
  expectedSlotId: string;
  expectedRoleId: string;
}

export interface SourceScopedRolePairMemberBinding {
  roleRecordId: string;
  characterId: string;
}

export interface SourceScopedRolePairTargetInput {
  targetId: string;
  targetTeam: ExactTeamRecord;
  expectedTargetTeamId: string;
  expectedMemberCharacterIds: readonly [string, string, string, string];
  roleMemberBindings: readonly [
    SourceScopedRolePairMemberBinding,
    SourceScopedRolePairMemberBinding,
  ];
  sourceSlotBinding: Readonly<Record<string, string>>;
  sourceSlotBindingBasis: "same-page-inferred-fit";
  /**
   * Source condition text acknowledged by the caller, keyed by the exact
   * source-scoped role record ID. This is not evidence that the condition was
   * executed or verified in gameplay.
   */
  acknowledgedConditionsByRoleRecordId?: Readonly<
    Record<string, readonly string[]>
  >;
  expectedStructuralBindingMultiplicity: number;
}

export interface SourceScopedRolePairSampleInput {
  template: TeamTemplateRecord;
  expectedTemplateId: string;
  roles: readonly [
    SourceScopedRolePairDescriptor,
    SourceScopedRolePairDescriptor,
  ];
  targets: readonly SourceScopedRolePairTargetInput[];
  eligibleCharacters: readonly ReleasedCharacterCatalogEntry[];
}

export type SourceScopedRolePairIssueCode =
  | "configured-template-mismatch"
  | "configured-role-mismatch"
  | "configured-target-mismatch"
  | "template-record-state-mismatch"
  | "target-record-state-mismatch"
  | "role-record-state-mismatch"
  | "duplicate-role-record"
  | "duplicate-role-slot"
  | "missing-targets"
  | "duplicate-target-id"
  | "duplicate-target-team"
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
  | "role-binding-keys-mismatch"
  | "role-member-missing"
  | "role-member-not-in-target"
  | "role-constellation-unverified"
  | "role-constellation-out-of-range"
  | "role-condition-unverified"
  | "binding-basis-mismatch"
  | "binding-keys-mismatch"
  | "binding-values-mismatch"
  | "binding-role-member-mismatch"
  | "binding-not-structural"
  | "structural-multiplicity-mismatch";

export interface SourceScopedRolePairIssue {
  code: SourceScopedRolePairIssueCode;
  stage:
    | "configuration"
    | "lineage"
    | "eligibility"
    | "role-evidence"
    | "binding"
    | "multiplicity";
  message: string;
}

export interface SourceScopedRolePairEvidenceSummary {
  roleRecordId: string;
  templateId: string;
  slotId: string;
  roleId: string;
  sourceObservedMemberIds: string[];
  exercisedByConfiguredTargetMemberIds: string[];
  unexercisedByConfiguredTargetMemberIds: string[];
  exhaustiveness: "non-exhaustive" | "exhaustive" | "unspecified";
  rankingClaim: "none" | "ordered" | "unordered";
}

export interface SourceScopedRolePairReportedMemberBinding
  extends SourceScopedRolePairMemberBinding {
  slotId: string;
  roleId: string;
  requiredConditions: string[];
  acknowledgedConditions: string[];
  /** Exact text-set equality only; this is not gameplay verification. */
  conditionsMatch: boolean;
}

export interface SourceScopedRolePairTargetReport {
  targetId: string;
  targetTeamId: string;
  comparisonStatus: "comparable" | "not-comparable";
  targetMemberCharacterIds: string[];
  roleMemberBindings: SourceScopedRolePairReportedMemberBinding[];
  sourceSlotBinding: Record<string, string>;
  sourceSlotBindingBasis: "same-page-inferred-fit";
  /** Counts only structural slot assignments; it does not apply investment or natural-language conditions. */
  structuralBindingMultiplicity: number | null;
  sourceLineage: { sourceId: string; pageUrl: string } | null;
  issues: SourceScopedRolePairIssue[];
}

export interface SourceScopedRolePairValidatedObservation {
  targetId: string;
  targetTeamId: string;
  roleMemberBindings: SourceScopedRolePairReportedMemberBinding[];
  sourceSlotBinding: Record<string, string>;
  structuralBindingMultiplicity: number;
  sourceLineage: { sourceId: string; pageUrl: string };
}

export interface SourceScopedRolePairSampleReport {
  schemaVersion: 1;
  reportType: "source-scoped-role-pair-sample";
  comparisonStatus: "comparable" | "not-comparable";
  completeRoleDomains: false;
  completePairDomain: false;
  pairCombinationPolicy: "configured-published-targets-only";
  unconfiguredRoleMemberPairsEvaluated: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsRankClaims: false;
  supportsGlobalRoleResolution: false;
  roleEvidence: SourceScopedRolePairEvidenceSummary[];
  targets: SourceScopedRolePairTargetReport[];
  validatedPairObservations:
    | SourceScopedRolePairValidatedObservation[]
    | null;
  issues: SourceScopedRolePairIssue[];
}

interface EligibleCharacter {
  characterId: string;
  elementId: string;
  playableIdentityId: string;
}

interface ScopedRole {
  descriptor: SourceScopedRolePairDescriptor;
  record: SourceScopedCharacterRoleRecord;
  key: string;
}

interface SourceLineage {
  sourceId: string;
  pageUrl: string;
}

/**
 * Validates exactly two source-scoped role records only against explicitly
 * configured published teams. It never expands their member lists into a
 * Cartesian pair domain.
 */
export function evaluateSourceScopedRolePairSample(
  input: SourceScopedRolePairSampleInput,
): SourceScopedRolePairSampleReport {
  const issues: SourceScopedRolePairIssue[] = [];
  const addIssue: AddIssue = (code, stage, message) => {
    issues.push({ code, stage, message });
  };
  const roles = canonicalRoles(input.roles);

  validateTemplateConfiguration(input, addIssue);
  validateRoleDescriptors(input, roles, addIssue);
  validateTargetInventory(input.targets, addIssue);
  const eligibleById = validateEligibleCatalog(
    input.eligibleCharacters,
    addIssue,
  );
  validateRoleEvidence(roles, eligibleById, addIssue);
  validateTemplateRoleCoverage(input.template, roles, addIssue);

  const targets = [...input.targets]
    .sort((left, right) => compareText(left.targetId, right.targetId))
    .map((target) =>
      evaluateTarget(input.template, roles, target, eligibleById),
    );
  const roleEvidence = buildRoleEvidenceSummaries(roles, input.targets);
  const allTargetsComparable =
    targets.length > 0 &&
    targets.every(({ comparisonStatus }) => comparisonStatus === "comparable");
  const comparisonStatus =
    issues.length === 0 && allTargetsComparable
      ? "comparable"
      : "not-comparable";
  const validatedPairObservations =
    comparisonStatus === "comparable"
      ? targets.map((target) => ({
          targetId: target.targetId,
          targetTeamId: target.targetTeamId,
          roleMemberBindings: target.roleMemberBindings.map((entry) => ({
            ...entry,
          })),
          sourceSlotBinding: canonicalStringRecord(target.sourceSlotBinding),
          structuralBindingMultiplicity:
            target.structuralBindingMultiplicity as number,
          sourceLineage: { ...(target.sourceLineage as SourceLineage) },
        }))
      : null;

  return {
    schemaVersion: 1,
    reportType: "source-scoped-role-pair-sample",
    comparisonStatus,
    completeRoleDomains: false,
    completePairDomain: false,
    pairCombinationPolicy: "configured-published-targets-only",
    unconfiguredRoleMemberPairsEvaluated: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsRankClaims: false,
    supportsGlobalRoleResolution: false,
    roleEvidence,
    targets,
    validatedPairObservations,
    issues,
  };
}

function validateTemplateConfiguration(
  input: SourceScopedRolePairSampleInput,
  addIssue: AddIssue,
): void {
  if (input.template.id !== input.expectedTemplateId) {
    addIssue(
      "configured-template-mismatch",
      "configuration",
      `Template was ${input.template.id} instead of ${input.expectedTemplateId}.`,
    );
  }
  if (
    input.template.status !== "candidate" ||
    input.template.promotionEligible !== false
  ) {
    addIssue(
      "template-record-state-mismatch",
      "configuration",
      `Configured template ${input.template.id} must remain candidate and promotion-ineligible.`,
    );
  }
}

function validateRoleDescriptors(
  input: SourceScopedRolePairSampleInput,
  roles: readonly ScopedRole[],
  addIssue: AddIssue,
): void {
  if (input.roles.length !== 2) {
    addIssue(
      "configured-role-mismatch",
      "configuration",
      `The paired sample requires exactly two role descriptors; observed ${input.roles.length}.`,
    );
  }
  const recordIds = roles.map(({ record }) => record.id);
  if (new Set(recordIds).size !== recordIds.length) {
    addIssue(
      "duplicate-role-record",
      "configuration",
      "The paired sample contains the same role record more than once.",
    );
  }
  const slotIds = roles.map(({ record }) => record.appliesTo.slotId);
  if (new Set(slotIds).size !== slotIds.length) {
    addIssue(
      "duplicate-role-slot",
      "configuration",
      "The paired sample's two role records apply to the same template slot.",
    );
  }
  for (const { descriptor, record } of roles) {
    const mismatches = [
      ["record", record.id, descriptor.expectedRecordId],
      [
        "template",
        record.appliesTo.teamTemplateId,
        descriptor.expectedTemplateId,
      ],
      ["slot", record.appliesTo.slotId, descriptor.expectedSlotId],
      ["role", record.roleId, descriptor.expectedRoleId],
    ].filter(([, actual, expected]) => actual !== expected);
    if (
      descriptor.expectedTemplateId !== input.expectedTemplateId ||
      mismatches.length > 0
    ) {
      addIssue(
        "configured-role-mismatch",
        "configuration",
        `Role descriptor ${record.id} no longer matches its configured record, template, slot, or role.`,
      );
    }
    if (
      record.status !== "candidate" ||
      record.promotionEligible !== false
    ) {
      addIssue(
        "role-record-state-mismatch",
        "configuration",
        `Configured role record ${record.id} must remain candidate and promotion-ineligible.`,
      );
    }
    if (record.appliesTo.teamTemplateId !== input.template.id) {
      addIssue(
        "role-application-mismatch",
        "role-evidence",
        `Role record ${record.id} does not apply to template ${input.template.id}.`,
      );
    }
  }
}

function validateTargetInventory(
  targets: readonly SourceScopedRolePairTargetInput[],
  addIssue: AddIssue,
): void {
  if (targets.length === 0) {
    addIssue(
      "missing-targets",
      "configuration",
      "The paired sample requires at least one explicit published target.",
    );
    return;
  }
  const targetIds = targets.map(({ targetId }) => targetId);
  if (
    targetIds.some((targetId) => targetId.length === 0) ||
    new Set(targetIds).size !== targetIds.length
  ) {
    addIssue(
      "duplicate-target-id",
      "configuration",
      "Published target IDs must be non-empty and unique.",
    );
  }
  const teamIds = targets.map(({ targetTeam }) => targetTeam.id);
  if (new Set(teamIds).size !== teamIds.length) {
    addIssue(
      "duplicate-target-team",
      "configuration",
      "Each exact source team may appear only once in the paired sample.",
    );
  }
}

function validateEligibleCatalog(
  entries: readonly ReleasedCharacterCatalogEntry[],
  addIssue: AddIssue,
): Map<string, EligibleCharacter> {
  const eligibleById = new Map<string, EligibleCharacter>();
  for (const entry of entries) {
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
        `The eligibility catalog has an invalid or duplicate entry for ${entry.characterId || "<empty>"}.`,
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

function validateRoleEvidence(
  roles: readonly ScopedRole[],
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
  addIssue: AddIssue,
): void {
  for (const { record } of roles) {
    const memberIds = record.members.map(({ characterId }) => characterId);
    if (
      (record.exhaustiveness !== "non-exhaustive" &&
        record.exhaustiveness !== "unspecified") ||
      record.rankingClaim !== "none" ||
      memberIds.length === 0 ||
      new Set(memberIds).size !== memberIds.length
    ) {
      addIssue(
        "role-evidence-invalid",
        "role-evidence",
        `Role record ${record.id} must contain unique, source-scoped, unranked positive member evidence without claiming an exhaustive domain.`,
      );
    }
    for (const member of record.members) {
      if (!eligibleById.has(member.characterId)) {
        addIssue(
          "role-member-not-eligible",
          "eligibility",
          `Role evidence member ${member.characterId} from ${record.id} is not eligible.`,
        );
      }
      if (!validMemberEvidence(member)) {
        addIssue(
          "role-evidence-invalid",
          "role-evidence",
          `Role evidence for ${member.characterId} in ${record.id} has invalid bounds or conditions.`,
        );
      }
    }
  }
}

function validateTemplateRoleCoverage(
  template: TeamTemplateRecord,
  roles: readonly ScopedRole[],
  addIssue: AddIssue,
): void {
  const scopedByKey = new Map(roles.map((role) => [role.key, role]));
  for (const { record } of roles) {
    const slot = template.slots.find(
      ({ id }) => id === record.appliesTo.slotId,
    );
    if (!slot) {
      addIssue(
        "template-slot-missing",
        "role-evidence",
        `Template ${template.id} has no slot ${record.appliesTo.slotId}.`,
      );
      continue;
    }
    if (
      !slot.options.some(
        (option) =>
          option.type === "roles" &&
          option.roleIds.length === 1 &&
          option.roleIds[0] === record.roleId,
      )
    ) {
      addIssue(
        "role-option-missing",
        "role-evidence",
        `Template slot ${slot.id} lacks exact role option ${record.roleId}.`,
      );
    }
  }
  for (const slot of template.slots) {
    for (const option of slot.options) {
      if (option.type !== "roles") continue;
      const roleId = option.roleIds.length === 1 ? option.roleIds[0] : null;
      if (!roleId || !scopedByKey.has(roleKey(slot.id, roleId))) {
        addIssue(
          "unresolved-additional-role-option",
          "role-evidence",
          `Template slot ${slot.id} contains a role option outside the exact configured pair.`,
        );
      }
    }
  }
}

function evaluateTarget(
  template: TeamTemplateRecord,
  roles: readonly ScopedRole[],
  target: SourceScopedRolePairTargetInput,
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
): SourceScopedRolePairTargetReport {
  const issues: SourceScopedRolePairIssue[] = [];
  const addIssue: AddIssue = (code, stage, message) => {
    issues.push({ code, stage, message });
  };
  const targetMemberCharacterIds = target.targetTeam.members.map(
    ({ characterId }) => characterId,
  );
  if (target.targetTeam.id !== target.expectedTargetTeamId) {
    addIssue(
      "configured-target-mismatch",
      "configuration",
      `Target ${target.targetId} uses ${target.targetTeam.id} instead of ${target.expectedTargetTeamId}.`,
    );
  }
  if (
    target.targetTeam.status !== "candidate" ||
    target.targetTeam.promotionEligible !== false
  ) {
    addIssue(
      "target-record-state-mismatch",
      "configuration",
      `Target team ${target.targetTeam.id} must remain candidate and promotion-ineligible.`,
    );
  }
  if (
    !arraysEqual(
      targetMemberCharacterIds,
      target.expectedMemberCharacterIds,
    )
  ) {
    addIssue(
      "target-roster-mismatch",
      "configuration",
      `Target ${target.targetId} member order drifted from its configured exact roster.`,
    );
  }
  validateTargetRoster(targetMemberCharacterIds, eligibleById, addIssue);

  const sourceLineage = findCommonSourceLineage(
    [
      ...roles.map(({ record }) => record.sourceRefs),
      template.sourceRefs,
      target.targetTeam.sourceRefs,
    ],
    addIssue,
  );
  const canonicalBindings = validateRoleMemberBindings(
    target,
    roles,
    targetMemberCharacterIds,
    addIssue,
  );
  validateExplicitSlotBinding(
    template,
    roles,
    target,
    targetMemberCharacterIds,
    canonicalBindings,
    addIssue,
  );

  let structuralBindingMultiplicity: number | null = null;
  if (
    targetMemberCharacterIds.length === 4 &&
    new Set(targetMemberCharacterIds).size === 4 &&
    targetMemberCharacterIds.every((characterId) =>
      eligibleById.has(characterId),
    )
  ) {
    structuralBindingMultiplicity = countStructuralBindings(
      template,
      targetMemberCharacterIds as [string, string, string, string],
      eligibleById,
      roles,
      addIssue,
    );
    if (
      !Number.isInteger(target.expectedStructuralBindingMultiplicity) ||
      target.expectedStructuralBindingMultiplicity < 1 ||
      structuralBindingMultiplicity !==
        target.expectedStructuralBindingMultiplicity
    ) {
      addIssue(
        "structural-multiplicity-mismatch",
        "multiplicity",
        `Target ${target.targetId} expected ${target.expectedStructuralBindingMultiplicity} structural bindings but observed ${structuralBindingMultiplicity}.`,
      );
    }
  }
  if (
    issues.length === 0 &&
    assignmentMatchesTemplate(
      template,
      target.sourceSlotBinding,
      eligibleById,
      roles,
    ) !== true
  ) {
    addIssue(
      "binding-not-structural",
      "binding",
      `Target ${target.targetId}'s explicit source binding does not satisfy the scoped template.`,
    );
  }

  return {
    targetId: target.targetId,
    targetTeamId: target.targetTeam.id,
    comparisonStatus: issues.length === 0 ? "comparable" : "not-comparable",
    targetMemberCharacterIds: [...targetMemberCharacterIds],
    roleMemberBindings: canonicalBindings,
    sourceSlotBinding: canonicalStringRecord(target.sourceSlotBinding),
    sourceSlotBindingBasis: target.sourceSlotBindingBasis,
    structuralBindingMultiplicity,
    sourceLineage,
    issues,
  };
}

function validateTargetRoster(
  targetMemberIds: readonly string[],
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
  addIssue: AddIssue,
): void {
  if (new Set(targetMemberIds).size !== targetMemberIds.length) {
    addIssue(
      "duplicate-target-member",
      "eligibility",
      "An exact target roster contains a duplicate character ID.",
    );
  }
  const identities = targetMemberIds.flatMap((characterId) => {
    const entry = eligibleById.get(characterId);
    if (!entry) {
      addIssue(
        "ineligible-target-member",
        "eligibility",
        `Target member ${characterId} is not in the eligibility catalog.`,
      );
      return [];
    }
    return [entry.playableIdentityId];
  });
  if (new Set(identities).size !== identities.length) {
    addIssue(
      "shared-target-playable-identity",
      "eligibility",
      "An exact target contains mutually exclusive forms of one playable identity.",
    );
  }
}

function validateRoleMemberBindings(
  target: SourceScopedRolePairTargetInput,
  roles: readonly ScopedRole[],
  targetMemberIds: readonly string[],
  addIssue: AddIssue,
): SourceScopedRolePairTargetReport["roleMemberBindings"] {
  const descriptorsById = new Map(
    roles.map((role) => [role.record.id, role]),
  );
  const bindings = [...target.roleMemberBindings].sort((left, right) =>
    compareText(left.roleRecordId, right.roleRecordId),
  );
  const bindingIds = bindings.map(({ roleRecordId }) => roleRecordId);
  const expectedIds = roles.map(({ record }) => record.id).sort(compareText);
  if (
    bindings.length !== 2 ||
    new Set(bindingIds).size !== bindingIds.length ||
    !arraysEqual(bindingIds, expectedIds)
  ) {
    addIssue(
      "role-binding-keys-mismatch",
      "binding",
      `Target ${target.targetId} must bind each exact role record once.`,
    );
  }
  return bindings.flatMap((binding) => {
    const role = descriptorsById.get(binding.roleRecordId);
    if (!role) return [];
    const member = role.record.members.find(
      ({ characterId }) => characterId === binding.characterId,
    );
    if (!member) {
      addIssue(
        "role-member-missing",
        "role-evidence",
        `${binding.characterId} is not positive member evidence in ${binding.roleRecordId}.`,
      );
    }
    if (!targetMemberIds.includes(binding.characterId)) {
      addIssue(
        "role-member-not-in-target",
        "binding",
        `${binding.characterId} is not in target team ${target.targetTeam.id}.`,
      );
    }
    const conditionAcknowledgement = member
      ? validateMemberConstraints(target, role.record, member, addIssue)
      : missingMemberConditionAcknowledgement(target, role.record.id);
    return [
      {
        ...binding,
        slotId: role.record.appliesTo.slotId,
        roleId: role.record.roleId,
        ...conditionAcknowledgement,
      },
    ];
  });
}

interface ConditionAcknowledgement {
  requiredConditions: string[];
  acknowledgedConditions: string[];
  conditionsMatch: boolean;
}

function validateMemberConstraints(
  target: SourceScopedRolePairTargetInput,
  roleRecord: SourceScopedCharacterRoleRecord,
  member: SourceScopedCharacterRoleRecord["members"][number],
  addIssue: AddIssue,
): ConditionAcknowledgement {
  const targetMember = target.targetTeam.members.find(
    ({ characterId }) => characterId === member.characterId,
  );
  if (
    targetMember &&
    (member.minConstellation !== undefined ||
      member.maxConstellation !== undefined)
  ) {
    const constellation =
      targetMember.investment.status === "specified" ||
      targetMember.investment.status === "partial"
        ? targetMember.investment.constellation
        : undefined;
    if (constellation === undefined) {
      addIssue(
        "role-constellation-unverified",
        "role-evidence",
        `${member.characterId} has a bound in ${roleRecord.id}, but the target investment does not specify an exact constellation.`,
      );
    } else if (
      (member.minConstellation !== undefined &&
        constellation < member.minConstellation) ||
      (member.maxConstellation !== undefined &&
        constellation > member.maxConstellation)
    ) {
      addIssue(
        "role-constellation-out-of-range",
        "role-evidence",
        `${member.characterId} at C${constellation} does not satisfy ${roleRecord.id}.`,
      );
    }
  }
  const requiredConditions = canonicalTextSet(member.conditions);
  const acknowledgedConditions = canonicalTextSet(
    target.acknowledgedConditionsByRoleRecordId?.[roleRecord.id] ?? [],
  );
  const conditionsMatch = arraysEqual(
    requiredConditions,
    acknowledgedConditions,
  );
  if (!conditionsMatch) {
    addIssue(
      "role-condition-unverified",
      "role-evidence",
      `${member.characterId}'s acknowledged condition text does not exactly match ${roleRecord.id}; this comparison does not verify gameplay execution.`,
    );
  }
  return {
    requiredConditions,
    acknowledgedConditions,
    conditionsMatch,
  };
}

function missingMemberConditionAcknowledgement(
  target: SourceScopedRolePairTargetInput,
  roleRecordId: string,
): ConditionAcknowledgement {
  return {
    requiredConditions: [],
    acknowledgedConditions: canonicalTextSet(
      target.acknowledgedConditionsByRoleRecordId?.[roleRecordId] ?? [],
    ),
    conditionsMatch: false,
  };
}

function validateExplicitSlotBinding(
  template: TeamTemplateRecord,
  roles: readonly ScopedRole[],
  target: SourceScopedRolePairTargetInput,
  targetMemberIds: readonly string[],
  roleBindings: SourceScopedRolePairTargetReport["roleMemberBindings"],
  addIssue: AddIssue,
): void {
  if (target.sourceSlotBindingBasis !== "same-page-inferred-fit") {
    addIssue(
      "binding-basis-mismatch",
      "binding",
      "The paired sample requires same-page-inferred-fit binding provenance.",
    );
  }
  const expectedKeys = template.slots.map(({ id }) => id).sort(compareText);
  const observedKeys = Object.keys(target.sourceSlotBinding).sort(compareText);
  if (!arraysEqual(expectedKeys, observedKeys)) {
    addIssue(
      "binding-keys-mismatch",
      "binding",
      `Target ${target.targetId}'s binding must cover every template slot exactly once.`,
    );
  }
  const bindingValues = Object.values(target.sourceSlotBinding).sort(compareText);
  const rosterValues = [...targetMemberIds].sort(compareText);
  if (
    !arraysEqual(bindingValues, rosterValues) ||
    new Set(bindingValues).size !== bindingValues.length
  ) {
    addIssue(
      "binding-values-mismatch",
      "binding",
      `Target ${target.targetId}'s binding must equal its exact roster without duplicates.`,
    );
  }
  const bindingsByRoleId = new Map(
    roleBindings.map((binding) => [binding.roleRecordId, binding]),
  );
  for (const { record } of roles) {
    const member = bindingsByRoleId.get(record.id);
    if (
      member &&
      target.sourceSlotBinding[record.appliesTo.slotId] !== member.characterId
    ) {
      addIssue(
        "binding-role-member-mismatch",
        "binding",
        `Target ${target.targetId}'s ${record.appliesTo.slotId} slot is not bound to ${member.characterId}.`,
      );
    }
  }
}

function countStructuralBindings(
  template: TeamTemplateRecord,
  memberIds: [string, string, string, string],
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
  roles: readonly ScopedRole[],
  addIssue: AddIssue,
): number {
  let count = 0;
  for (const assignment of permutations(memberIds)) {
    const binding = Object.fromEntries(
      template.slots.map((slot, index) => [slot.id, assignment[index] as string]),
    );
    const matches = assignmentMatchesTemplate(
      template,
      binding,
      eligibleById,
      roles,
    );
    if (matches === null) {
      addIssue(
        "unresolved-additional-role-option",
        "role-evidence",
        "Structural multiplicity encountered a role option outside the exact configured pair.",
      );
      return 0;
    }
    if (matches) count += 1;
  }
  return count;
}

function assignmentMatchesTemplate(
  template: TeamTemplateRecord,
  binding: Readonly<Record<string, string>>,
  eligibleById: ReadonlyMap<string, EligibleCharacter>,
  roles: readonly ScopedRole[],
): boolean | null {
  const scopedByKey = new Map(roles.map((role) => [role.key, role]));
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
      } else {
        const roleId = option.roleIds.length === 1 ? option.roleIds[0] : null;
        const role = roleId
          ? scopedByKey.get(roleKey(slot.id, roleId))
          : undefined;
        if (!role) return null;
        slotMatches ||= role.record.members.some(
          (member) => member.characterId === characterId,
        );
      }
    }
    if (!slotMatches) return false;
  }
  return true;
}

function buildRoleEvidenceSummaries(
  roles: readonly ScopedRole[],
  targets: readonly SourceScopedRolePairTargetInput[],
): SourceScopedRolePairEvidenceSummary[] {
  return roles.map(({ record }) => {
    const sourceObservedMemberIds = record.members
      .map(({ characterId }) => characterId)
      .sort(compareText);
    const sourceSet = new Set(sourceObservedMemberIds);
    const exercisedByConfiguredTargetMemberIds = sortedUnique(
      targets.flatMap(({ roleMemberBindings }) =>
        roleMemberBindings.flatMap((binding) =>
          binding.roleRecordId === record.id &&
          sourceSet.has(binding.characterId)
            ? [binding.characterId]
            : [],
        ),
      ),
    );
    const exercisedSet = new Set(exercisedByConfiguredTargetMemberIds);
    return {
      roleRecordId: record.id,
      templateId: record.appliesTo.teamTemplateId,
      slotId: record.appliesTo.slotId,
      roleId: record.roleId,
      sourceObservedMemberIds,
      exercisedByConfiguredTargetMemberIds,
      unexercisedByConfiguredTargetMemberIds: sourceObservedMemberIds.filter(
        (characterId) => !exercisedSet.has(characterId),
      ),
      exhaustiveness: record.exhaustiveness,
      rankingClaim: record.rankingClaim,
    };
  });
}

function findCommonSourceLineage(
  refGroups: readonly (readonly SourceReference[])[],
  addIssue: AddIssue,
): SourceLineage | null {
  const groupMaps = refGroups.map(
    (refs) =>
      new Map(
        sourceLineages(refs).map((lineage) => [
          sourceLineageKey(lineage),
          lineage,
        ]),
      ),
  );
  const first = groupMaps[0] ?? new Map<string, SourceLineage>();
  const common = [...first.entries()].flatMap(([key, lineage]) =>
    groupMaps.every((group) => group.has(key)) ? [lineage] : [],
  );
  if (common.length === 0) {
    addIssue(
      "source-lineage-mismatch",
      "lineage",
      "Both roles, the template, and the target team do not share one exact source/page lineage.",
    );
    return null;
  }
  if (common.length > 1) {
    addIssue(
      "ambiguous-source-lineage",
      "lineage",
      "Both roles, the template, and the target team share more than one source/page lineage.",
    );
    return null;
  }
  return common[0] ?? null;
}

function canonicalRoles(
  roles: readonly SourceScopedRolePairDescriptor[],
): ScopedRole[] {
  return roles
    .map((descriptor) => ({
      descriptor,
      record: descriptor.record,
      key: roleKey(
        descriptor.record.appliesTo.slotId,
        descriptor.record.roleId,
      ),
    }))
    .sort((left, right) => compareText(left.record.id, right.record.id));
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

function roleKey(slotId: string, roleId: string): string {
  return `${slotId}\u0000${roleId}`;
}

function normalizedPlayableIdentity(
  entry: ReleasedCharacterCatalogEntry,
): string {
  return (
    entry.playableIdentityId ??
    (entry.characterId.startsWith("traveler_") ? "traveler" : entry.characterId)
  );
}

function validMemberEvidence(
  member: SourceScopedCharacterRoleRecord["members"][number],
): boolean {
  return (
    (member.minConstellation === undefined ||
      (Number.isInteger(member.minConstellation) &&
        member.minConstellation >= 0 &&
        member.minConstellation <= 6)) &&
    (member.maxConstellation === undefined ||
      (Number.isInteger(member.maxConstellation) &&
        member.maxConstellation >= 0 &&
        member.maxConstellation <= 6)) &&
    (member.minConstellation === undefined ||
      member.maxConstellation === undefined ||
      member.minConstellation <= member.maxConstellation) &&
    Array.isArray(member.conditions) &&
    member.conditions.every((condition) => condition.length > 0)
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

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function canonicalTextSet(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function canonicalStringRecord(
  record: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareText(left, right)),
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

type AddIssue = (
  code: SourceScopedRolePairIssueCode,
  stage: SourceScopedRolePairIssue["stage"],
  message: string,
) => void;
