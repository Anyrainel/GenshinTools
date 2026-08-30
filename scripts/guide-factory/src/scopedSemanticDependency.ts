import { sha256Text } from "./io";

const MANIFEST_DIGEST_DOMAIN =
  "guide-factory/scoped-semantic-dependency/manifest/v1";
const KEY_SET_DIGEST_DOMAIN =
  "guide-factory/scoped-semantic-dependency/key-set/v1";
const ENTRY_PAYLOAD_DIGEST_DOMAIN =
  "guide-factory/scoped-semantic-dependency/entry-payload/v1";
const SELECTED_PAYLOAD_DIGEST_DOMAIN =
  "guide-factory/scoped-semantic-dependency/selected-payload/v1";
const PARITY_VALUE_DIGEST_DOMAIN =
  "guide-factory/scoped-semantic-dependency/parity-value/v1";
const SCOPE_DIGEST_DOMAIN =
  "guide-factory/scoped-semantic-dependency/scope/v1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type ScopedSemanticJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ScopedSemanticJsonValue[]
  | { readonly [key: string]: ScopedSemanticJsonValue };

export type ScopedSemanticDependencyParticipant = {
  dependencyId: string;
  key: string;
};

export type ScopedSemanticDependencySelector = {
  dependencyId: string;
  containerPath: string;
  collectionPath: string;
  /** Caller-owned parsed collection/key schema identity. */
  keySchemaId: string;
  projectionAdapterId: string;
  requiredKeys: string[];
};

export type ScopedSemanticDependencyParitySelector = {
  parityId: string;
  parityAdapterId: string;
  left: ScopedSemanticDependencyParticipant;
  right: ScopedSemanticDependencyParticipant;
};

/** Data-only authority. Every array uses authenticated declared order. */
export type ScopedSemanticDependencyManifest = {
  schemaVersion: 1;
  scopeId: string;
  selectorMode: "exact-key-manifest";
  dependencyOrderPolicy: "declared";
  requiredKeyOrderPolicy: "declared";
  parityOrderPolicy: "declared";
  dependencies: ScopedSemanticDependencySelector[];
  parities: ScopedSemanticDependencyParitySelector[];
};

export type ScopedSemanticProjectionAdapter<TRecord> = {
  projectionAdapterId: string;
  keyOf: (record: TRecord) => string;
  project: (record: TRecord) => unknown;
};

export type ScopedSemanticDependencyInput<TRecord> = {
  dependencyId: string;
  containerPath: string;
  collectionPath: string;
  keySchemaId: string;
  records: readonly TRecord[];
  adapter: ScopedSemanticProjectionAdapter<TRecord>;
};

export type ScopedSemanticDependencyRuntimeInput = {
  dependencyId: string;
  containerPath: string;
  collectionPath: string;
  keySchemaId: string;
  projectionAdapterId: string;
  records: readonly unknown[];
  keyOf: (record: unknown) => unknown;
  project: (record: unknown) => unknown;
};

export type ScopedSemanticParityAdapterInput = {
  parityAdapterId: string;
  normalize: (input: {
    dependencyId: string;
    key: string;
    payload: ScopedSemanticJsonValue;
  }) => unknown;
};

export type ScopedSemanticDependencyDerivationInput = {
  manifest: ScopedSemanticDependencyManifest;
  dependencies: ScopedSemanticDependencyRuntimeInput[];
  parityAdapters: ScopedSemanticParityAdapterInput[];
};

export type ScopedSemanticDependencyExpectation = {
  scopeId: string;
  manifestSha256: string;
  scopeProjectionSha256: string;
};

export type ScopedSemanticDependencyAuthenticationInput =
  ScopedSemanticDependencyDerivationInput & {
    expectation: ScopedSemanticDependencyExpectation;
  };

export type ScopedSemanticDependencyIssue = {
  code: string;
  path: string;
  message: string;
};

export type ScopedSemanticDependencyEntryAudit = {
  key: string;
  occurrenceCount: 1;
  payloadSha256: string;
};

export type ScopedSemanticDependencyAuditEntry = {
  dependencyId: string;
  containerPath: string;
  collectionPath: string;
  keySchemaId: string;
  projectionAdapterId: string;
  requiredKeys: string[];
  selectedEntries: ScopedSemanticDependencyEntryAudit[];
  selectedKeySetSha256: string;
  selectedPayloadSha256: string;
};

export type ScopedSemanticDependencyParityAudit = {
  parityId: string;
  parityAdapterId: string;
  left: ScopedSemanticDependencyParticipant;
  right: ScopedSemanticDependencyParticipant;
  status: "exact";
  leftNormalizedSha256: string;
  rightNormalizedSha256: string;
};

export type ScopedSemanticDependencyCandidateAudit = {
  schemaVersion: 1;
  status: "candidate";
  trust: "untrusted";
  scopeId: string;
  selector: {
    mode: "exact-key-manifest";
    dependencyOrderPolicy: "declared";
    requiredKeyOrderPolicy: "declared";
    parityOrderPolicy: "declared";
    identityBinding:
      "dependency-container-collection-key-schema-projection-adapter";
    manifestSha256: string;
  };
  dependencies: ScopedSemanticDependencyAuditEntry[];
  parities: ScopedSemanticDependencyParityAudit[];
  scopeProjectionSha256: string;
};

export type ScopedSemanticDependencyAcceptedAudit = Omit<
  ScopedSemanticDependencyCandidateAudit,
  "status" | "trust"
> & {
  status: "accepted";
  trust: "authenticated-current-input-rebuild-and-pinned-expectation";
};

export type ScopedSemanticDependencySelection = {
  readonly dependencies: readonly {
    readonly dependencyId: string;
    readonly entries: readonly {
      readonly key: string;
      readonly payload: ScopedSemanticJsonValue;
    }[];
  }[];
};

export type ScopedSemanticDependencyCandidateResult = {
  status: "candidate";
  trust: "untrusted";
  audit: ScopedSemanticDependencyCandidateAudit;
};

export type ScopedSemanticDependencyAcceptedResult = {
  status: "accepted";
  trust: "authenticated-current-input-rebuild-and-pinned-expectation";
  audit: ScopedSemanticDependencyAcceptedAudit;
  selection: ScopedSemanticDependencySelection;
};

export type ScopedSemanticDependencyRejectedResult = {
  status: "rejected";
  trust: "none";
  scopeId: string | null;
  observed: {
    manifestSha256: string | null;
    scopeProjectionSha256: string | null;
  };
  issues: readonly ScopedSemanticDependencyIssue[];
};

export type ScopedSemanticDependencyCandidateDerivationResult =
  | ScopedSemanticDependencyCandidateResult
  | ScopedSemanticDependencyRejectedResult;

export type ScopedSemanticDependencyAuthenticationResult =
  | ScopedSemanticDependencyAcceptedResult
  | ScopedSemanticDependencyRejectedResult;

export function defineScopedSemanticDependencyInput<TRecord>(
  input: ScopedSemanticDependencyInput<TRecord>,
): ScopedSemanticDependencyRuntimeInput {
  return {
    dependencyId: input.dependencyId,
    containerPath: input.containerPath,
    collectionPath: input.collectionPath,
    keySchemaId: input.keySchemaId,
    projectionAdapterId: input.adapter.projectionAdapterId,
    records: input.records,
    keyOf: (record) => input.adapter.keyOf(record as TRecord),
    project: (record) => input.adapter.project(record as TRecord),
  };
}

/**
 * Derives reviewable hashes only. A candidate is explicitly untrusted and never
 * exposes selected values for downstream consumption.
 */
export function deriveScopedSemanticDependencyCandidate(
  input: ScopedSemanticDependencyDerivationInput,
): ScopedSemanticDependencyCandidateDerivationResult {
  try {
    const derived = deriveInternal(input, null);
    if (!derived.ok) return freezeJson(derived.rejection);
    return freezeJson({
      status: "candidate",
      trust: "untrusted",
      audit: derived.audit,
    });
  } catch (error) {
    return freezeJson(unexpectedRejection(error));
  }
}

/**
 * Rebuilds from current inputs and exposes a deeply frozen selection only when
 * both independently pinned manifest and scope expectations match.
 */
export function authenticateScopedSemanticDependencies(
  input: ScopedSemanticDependencyAuthenticationInput,
): ScopedSemanticDependencyAuthenticationResult {
  try {
    const top = inspectOwnDataRecord(
      input,
      ["manifest", "dependencies", "parityAdapters", "expectation"],
      "input",
    );
    if (!top.accepted) {
      return freezeJson(
        rejection(null, null, null, [
          inspectionIssue("input.invalid_shape", top),
        ]),
      );
    }
    const expectationIssues: ScopedSemanticDependencyIssue[] = [];
    const expectation = validateExpectation(
      top.value.expectation,
      expectationIssues,
    );
    if (!expectation) {
      return freezeJson(rejection(null, null, null, expectationIssues));
    }
    const derived = deriveInternal(
      {
        manifest: top.value.manifest as ScopedSemanticDependencyManifest,
        dependencies:
          top.value.dependencies as ScopedSemanticDependencyRuntimeInput[],
        parityAdapters:
          top.value.parityAdapters as ScopedSemanticParityAdapterInput[],
      },
      expectation,
    );
    if (!derived.ok) return freezeJson(derived.rejection);
    if (derived.audit.scopeProjectionSha256 !== expectation.scopeProjectionSha256) {
      return freezeJson(
        rejection(
          derived.audit.scopeId,
          derived.audit.selector.manifestSha256,
          derived.audit.scopeProjectionSha256,
          [
            {
              code: "authentication.scope_projection_mismatch",
              path: "expectation.scopeProjectionSha256",
              message:
                "The current selected payload/parity scope does not match the independently pinned scope digest.",
            },
          ],
        ),
      );
    }
    const acceptedAudit: ScopedSemanticDependencyAcceptedAudit = {
      ...derived.audit,
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
    };
    return freezeJson({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      audit: acceptedAudit,
      selection: derived.selection,
    });
  } catch (error) {
    return freezeJson(unexpectedRejection(error));
  }
}

/**
 * Guards serialized/transferred output by rebuilding from the current inputs,
 * authenticating the pins, and comparing the complete strict JSON projection.
 */
export function requireAuthenticatedScopedSemanticDependencyProjection(
  value: unknown,
  currentInput: ScopedSemanticDependencyAuthenticationInput,
): ScopedSemanticDependencyAcceptedResult {
  try {
    const rebuilt = authenticateScopedSemanticDependencies(currentInput);
    if (rebuilt.status !== "accepted") {
      throw new Error(
        `current inputs are not authenticated (${rebuilt.issues
          .map(({ code }) => code)
          .join(", ")})`,
      );
    }
    const observed = normalizeJsonValue(value, "projection");
    if (!observed.accepted) throw new Error(observed.message);
    const canonical = normalizeJsonValue(rebuilt, "rebuiltProjection");
    if (!canonical.accepted) throw new Error(canonical.message);
    if (canonicalJson(observed.value) !== canonicalJson(canonical.value)) {
      throw new Error(
        "serialized projection differs from the canonical current-input rebuild",
      );
    }
    return rebuilt;
  } catch (error) {
    throw new Error(
      `Scoped semantic dependency projection authentication failed: ${safeThrownSummary(error)}`,
    );
  }
}

/** Rebuilds and returns the canonical compact accepted audit for durable reports. */
export function requireAuthenticatedScopedSemanticDependencyAudit(
  value: unknown,
  currentInput: ScopedSemanticDependencyAuthenticationInput,
): ScopedSemanticDependencyAcceptedAudit {
  try {
    const rebuilt = authenticateScopedSemanticDependencies(currentInput);
    if (rebuilt.status !== "accepted") {
      throw new Error(
        `current inputs are not authenticated (${rebuilt.issues
          .map(({ code }) => code)
          .join(", ")})`,
      );
    }
    const observed = normalizeJsonValue(value, "audit");
    if (!observed.accepted) throw new Error(observed.message);
    const canonical = normalizeJsonValue(rebuilt.audit, "rebuiltAudit");
    if (!canonical.accepted) throw new Error(canonical.message);
    if (canonicalJson(observed.value) !== canonicalJson(canonical.value)) {
      throw new Error(
        "serialized audit differs from the canonical current-input rebuild",
      );
    }
    return rebuilt.audit;
  } catch (error) {
    throw new Error(
      `Scoped semantic dependency audit authentication failed: ${safeThrownSummary(error)}`,
    );
  }
}

type InternalDerived =
  | {
      ok: true;
      audit: ScopedSemanticDependencyCandidateAudit;
      selection: ScopedSemanticDependencySelection;
    }
  | { ok: false; rejection: ScopedSemanticDependencyRejectedResult };

function deriveInternal(
  input: ScopedSemanticDependencyDerivationInput,
  expectation: ScopedSemanticDependencyExpectation | null,
): InternalDerived {
  const issues: ScopedSemanticDependencyIssue[] = [];
  const top = inspectOwnDataRecord(
    input,
    ["manifest", "dependencies", "parityAdapters"],
    "input",
  );
  if (!top.accepted) {
    return failed(null, null, null, [inspectionIssue("input.invalid_shape", top)]);
  }
  const manifest = validateManifest(top.value.manifest, issues);
  if (!manifest) return failed(null, null, null, issues);
  const manifestSha256 = digest(MANIFEST_DIGEST_DOMAIN, manifest);
  if (expectation) {
    if (expectation.scopeId !== manifest.scopeId) {
      return failed(manifest.scopeId, manifestSha256, null, [
        {
          code: "authentication.scope_id_mismatch",
          path: "expectation.scopeId",
          message: "The manifest scopeId does not match the pinned expectation.",
        },
      ]);
    }
    if (expectation.manifestSha256 !== manifestSha256) {
      return failed(manifest.scopeId, manifestSha256, null, [
        {
          code: "authentication.manifest_mismatch",
          path: "expectation.manifestSha256",
          message:
            "The current selector, identity, order, or parity manifest does not match the independently pinned manifest digest.",
        },
      ]);
    }
  }

  const runtimeArray = inspectOwnDataArray(top.value.dependencies, "input.dependencies");
  if (!runtimeArray.accepted) {
    return failed(
      manifest.scopeId,
      manifestSha256,
      null,
      [inspectionIssue("runtime.invalid_dependencies", runtimeArray)],
    );
  }
  const runtimeById = validateRuntimeDependencies(
    manifest,
    runtimeArray.value,
    issues,
  );
  const parityAdapterArray = inspectOwnDataArray(
    top.value.parityAdapters,
    "input.parityAdapters",
  );
  if (!parityAdapterArray.accepted) {
    addIssue(
      issues,
      "runtime.invalid_parity_adapters",
      parityAdapterArray.path,
      parityAdapterArray.message,
    );
  }
  const parityAdapterById = parityAdapterArray.accepted
    ? validateParityAdapters(manifest, parityAdapterArray.value, issues)
    : null;
  if (!runtimeById || !parityAdapterById || issues.length > 0) {
    return failed(manifest.scopeId, manifestSha256, null, issues);
  }

  const selectedRecords: unknown[][][] = manifest.dependencies.map((selector) =>
    selector.requiredKeys.map(() => [] as unknown[]),
  );
  for (const [dependencyIndex, selector] of manifest.dependencies.entries()) {
    const runtime = runtimeById.get(selector.dependencyId);
    if (!runtime) continue;
    const keyIndex = new Map(
      selector.requiredKeys.map((key, index) => [key, index]),
    );
    for (const [recordIndex, record] of runtime.records.entries()) {
      let key: unknown;
      try {
        key = runtime.keyOf(record);
      } catch (error) {
        addIssue(
          issues,
          "runtime.key_extraction_failed",
          `dependencies[${dependencyIndex}].records[${recordIndex}]`,
          `The key adapter threw (${safeThrownSummary(error)}).`,
        );
        continue;
      }
      if (typeof key !== "string" || key.length === 0) {
        addIssue(
          issues,
          "runtime.invalid_record_key",
          `dependencies[${dependencyIndex}].records[${recordIndex}]`,
          "The key adapter must return a non-empty exact string.",
        );
        continue;
      }
      const requiredIndex = keyIndex.get(key);
      if (requiredIndex !== undefined) {
        const selectedPath =
          `dependencies[${dependencyIndex}].records[${recordIndex}]`;
        const normalizedRecord = normalizeJsonValue(
          record,
          `${selectedPath}.selectedRecord`,
        );
        if (!normalizedRecord.accepted) {
          addIssue(
            issues,
            "selection.invalid_selected_record",
            normalizedRecord.path,
            normalizedRecord.message,
          );
          continue;
        }
        const stableRecord = freezeJson(normalizedRecord.value);
        let stableKey: unknown;
        try {
          stableKey = runtime.keyOf(stableRecord);
        } catch (error) {
          addIssue(
            issues,
            "selection.selected_key_recheck_failed",
            selectedPath,
            `The key adapter rejected the normalized selected record (${safeThrownSummary(error)}).`,
          );
          continue;
        }
        if (stableKey !== key) {
          addIssue(
            issues,
            "selection.selected_key_changed",
            selectedPath,
            "The normalized selected record did not reproduce its initially observed exact key.",
          );
          continue;
        }
        selectedRecords[dependencyIndex][requiredIndex].push(stableRecord);
      }
    }
    for (const [requiredIndex, key] of selector.requiredKeys.entries()) {
      const count = selectedRecords[dependencyIndex][requiredIndex].length;
      if (count !== 1) {
        addIssue(
          issues,
          count === 0
            ? "selection.required_key_missing"
            : "selection.required_key_duplicated",
          `manifest.dependencies[${dependencyIndex}].requiredKeys[${requiredIndex}]`,
          `Required key ${quote(key)} occurred ${count} times; exactly one occurrence is required.`,
        );
      }
    }
  }
  if (issues.length > 0) {
    return failed(manifest.scopeId, manifestSha256, null, issues);
  }

  const auditDependencies: ScopedSemanticDependencyAuditEntry[] = [];
  const selectedDependencies: Array<{
    dependencyId: string;
    entries: Array<{ key: string; payload: ScopedSemanticJsonValue }>;
  }> = [];
  const selectedPayloads = new Map<
    string,
    Map<string, ScopedSemanticJsonValue>
  >();
  for (const [dependencyIndex, selector] of manifest.dependencies.entries()) {
    const runtime = runtimeById.get(selector.dependencyId);
    if (!runtime) continue;
    const entries: Array<{ key: string; payload: ScopedSemanticJsonValue }> = [];
    for (const [requiredIndex, key] of selector.requiredKeys.entries()) {
      let rawProjection: unknown;
      try {
        rawProjection = runtime.project(
          selectedRecords[dependencyIndex][requiredIndex][0],
        );
      } catch (error) {
        addIssue(
          issues,
          "projection.adapter_failed",
          `dependencies[${dependencyIndex}].selected[${requiredIndex}]`,
          `The projection adapter threw (${safeThrownSummary(error)}).`,
        );
        continue;
      }
      const normalized = normalizeJsonValue(
        rawProjection,
        `dependencies[${dependencyIndex}].selected[${requiredIndex}].payload`,
      );
      if (!normalized.accepted) {
        addIssue(
          issues,
          "projection.invalid_json_value",
          normalized.path,
          normalized.message,
        );
        continue;
      }
      entries.push({ key, payload: freezeJson(normalized.value) });
    }
    if (entries.length !== selector.requiredKeys.length) continue;
    const selectedEntries = entries.map(({ key, payload }) => ({
      key,
      occurrenceCount: 1 as const,
      payloadSha256: digest(ENTRY_PAYLOAD_DIGEST_DOMAIN, {
        schemaVersion: 1,
        scopeId: manifest.scopeId,
        manifestSha256,
        selector: selectorIdentity(selector),
        key,
        payload,
      }),
    }));
    const selectedKeySetSha256 = digest(KEY_SET_DIGEST_DOMAIN, {
      schemaVersion: 1,
      scopeId: manifest.scopeId,
      selector: selectorIdentity(selector),
      requiredKeyOrderPolicy: manifest.requiredKeyOrderPolicy,
      requiredKeys: selector.requiredKeys,
    });
    const selectedPayloadSha256 = digest(SELECTED_PAYLOAD_DIGEST_DOMAIN, {
      schemaVersion: 1,
      scopeId: manifest.scopeId,
      manifestSha256,
      selector: selectorIdentity(selector),
      selectedEntries,
    });
    auditDependencies.push({
      ...selectorIdentity(selector),
      requiredKeys: [...selector.requiredKeys],
      selectedEntries,
      selectedKeySetSha256,
      selectedPayloadSha256,
    });
    selectedDependencies.push({ dependencyId: selector.dependencyId, entries });
    selectedPayloads.set(
      selector.dependencyId,
      new Map(entries.map(({ key, payload }) => [key, payload])),
    );
  }
  if (issues.length > 0) {
    return failed(manifest.scopeId, manifestSha256, null, issues);
  }

  const parityAudits: ScopedSemanticDependencyParityAudit[] = [];
  for (const [parityIndex, parity] of manifest.parities.entries()) {
    const adapter = parityAdapterById.get(parity.parityAdapterId);
    const leftPayload = selectedPayloads
      .get(parity.left.dependencyId)
      ?.get(parity.left.key);
    const rightPayload = selectedPayloads
      .get(parity.right.dependencyId)
      ?.get(parity.right.key);
    if (!adapter || leftPayload === undefined || rightPayload === undefined) {
      addIssue(
        issues,
        "parity.participant_unavailable",
        `manifest.parities[${parityIndex}]`,
        "A declared parity adapter or selected participant is unavailable.",
      );
      continue;
    }
    const normalizedSides: ScopedSemanticJsonValue[] = [];
    for (const [side, participant, payload] of [
      ["left", parity.left, leftPayload],
      ["right", parity.right, rightPayload],
    ] as const) {
      let rawNormalized: unknown;
      try {
        rawNormalized = adapter.normalize({ ...participant, payload });
      } catch (error) {
        addIssue(
          issues,
          "parity.adapter_failed",
          `manifest.parities[${parityIndex}].${side}`,
          `The parity adapter threw (${safeThrownSummary(error)}).`,
        );
        continue;
      }
      const normalized = normalizeJsonValue(
        rawNormalized,
        `manifest.parities[${parityIndex}].${side}.normalizedPayload`,
      );
      if (!normalized.accepted) {
        addIssue(
          issues,
          "parity.invalid_json_value",
          normalized.path,
          normalized.message,
        );
        continue;
      }
      normalizedSides.push(normalized.value);
    }
    if (normalizedSides.length !== 2) continue;
    if (canonicalJson(normalizedSides[0]) !== canonicalJson(normalizedSides[1])) {
      addIssue(
        issues,
        "parity.normalized_payload_mismatch",
        `manifest.parities[${parityIndex}]`,
        "The exact selected parity participants do not normalize to the same payload.",
      );
      continue;
    }
    const leftNormalizedSha256 = digest(PARITY_VALUE_DIGEST_DOMAIN, {
      schemaVersion: 1,
      scopeId: manifest.scopeId,
      parityId: parity.parityId,
      parityAdapterId: parity.parityAdapterId,
      payload: normalizedSides[0],
    });
    const rightNormalizedSha256 = digest(PARITY_VALUE_DIGEST_DOMAIN, {
      schemaVersion: 1,
      scopeId: manifest.scopeId,
      parityId: parity.parityId,
      parityAdapterId: parity.parityAdapterId,
      payload: normalizedSides[1],
    });
    parityAudits.push({
      parityId: parity.parityId,
      parityAdapterId: parity.parityAdapterId,
      left: { ...parity.left },
      right: { ...parity.right },
      status: "exact",
      leftNormalizedSha256,
      rightNormalizedSha256,
    });
  }
  if (issues.length > 0 || parityAudits.length !== manifest.parities.length) {
    return failed(manifest.scopeId, manifestSha256, null, issues);
  }

  const scopeProjectionSha256 = digest(SCOPE_DIGEST_DOMAIN, {
    schemaVersion: 1,
    scopeId: manifest.scopeId,
    manifestSha256,
    dependencies: auditDependencies.map(
      ({
        dependencyId,
        containerPath,
        collectionPath,
        keySchemaId,
        projectionAdapterId,
        selectedKeySetSha256,
        selectedPayloadSha256,
      }) => ({
        dependencyId,
        containerPath,
        collectionPath,
        keySchemaId,
        projectionAdapterId,
        selectedKeySetSha256,
        selectedPayloadSha256,
      }),
    ),
    parities: parityAudits,
  });
  return {
    ok: true,
    audit: {
      schemaVersion: 1,
      status: "candidate",
      trust: "untrusted",
      scopeId: manifest.scopeId,
      selector: {
        mode: manifest.selectorMode,
        dependencyOrderPolicy: manifest.dependencyOrderPolicy,
        requiredKeyOrderPolicy: manifest.requiredKeyOrderPolicy,
        parityOrderPolicy: manifest.parityOrderPolicy,
        identityBinding:
          "dependency-container-collection-key-schema-projection-adapter",
        manifestSha256,
      },
      dependencies: auditDependencies,
      parities: parityAudits,
      scopeProjectionSha256,
    },
    selection: { dependencies: selectedDependencies },
  };
}

function validateManifest(
  value: unknown,
  issues: ScopedSemanticDependencyIssue[],
): ScopedSemanticDependencyManifest | null {
  const inspected = inspectOwnDataRecord(
    value,
    [
      "schemaVersion",
      "scopeId",
      "selectorMode",
      "dependencyOrderPolicy",
      "requiredKeyOrderPolicy",
      "parityOrderPolicy",
      "dependencies",
      "parities",
    ],
    "manifest",
  );
  if (!inspected.accepted) {
    issues.push(inspectionIssue("manifest.invalid_shape", inspected));
    return null;
  }
  const raw = inspected.value;
  validateLiteral(raw.schemaVersion, 1, "manifest.schemaVersion", issues);
  validateLiteral(
    raw.selectorMode,
    "exact-key-manifest",
    "manifest.selectorMode",
    issues,
  );
  validateLiteral(
    raw.dependencyOrderPolicy,
    "declared",
    "manifest.dependencyOrderPolicy",
    issues,
  );
  validateLiteral(
    raw.requiredKeyOrderPolicy,
    "declared",
    "manifest.requiredKeyOrderPolicy",
    issues,
  );
  validateLiteral(
    raw.parityOrderPolicy,
    "declared",
    "manifest.parityOrderPolicy",
    issues,
  );
  if (!isIdentifier(raw.scopeId)) {
    addIssue(
      issues,
      "manifest.invalid_scope_id",
      "manifest.scopeId",
      "scopeId must be a non-empty string without surrounding whitespace.",
    );
  }
  const dependencyArray = inspectOwnDataArray(
    raw.dependencies,
    "manifest.dependencies",
  );
  if (!dependencyArray.accepted || dependencyArray.value.length === 0) {
    if (!dependencyArray.accepted) {
      issues.push(inspectionIssue("manifest.invalid_dependencies", dependencyArray));
    } else {
      addIssue(
        issues,
        "manifest.empty_dependencies",
        "manifest.dependencies",
        "At least one exact-key dependency is required.",
      );
    }
    return null;
  }

  const dependencies: ScopedSemanticDependencySelector[] = [];
  const dependencyIds = new Set<string>();
  for (const [index, value] of dependencyArray.value.entries()) {
    const path = `manifest.dependencies[${index}]`;
    const selector = inspectOwnDataRecord(
      value,
      [
        "dependencyId",
        "containerPath",
        "collectionPath",
        "keySchemaId",
        "projectionAdapterId",
        "requiredKeys",
      ],
      path,
    );
    if (!selector.accepted) {
      issues.push(inspectionIssue("manifest.invalid_dependency", selector));
      continue;
    }
    const fields = selector.value;
    const validIdentity =
      validateIdentifierField(fields.dependencyId, `${path}.dependencyId`, issues) &&
      validateContainerPath(fields.containerPath, `${path}.containerPath`, issues) &&
      validateCollectionPath(
        fields.collectionPath,
        `${path}.collectionPath`,
        issues,
      ) &&
      validateIdentifierField(fields.keySchemaId, `${path}.keySchemaId`, issues) &&
      validateIdentifierField(
        fields.projectionAdapterId,
        `${path}.projectionAdapterId`,
        issues,
      );
    if (
      typeof fields.dependencyId === "string" &&
      dependencyIds.has(fields.dependencyId)
    ) {
      addIssue(
        issues,
        "manifest.duplicate_dependency_id",
        `${path}.dependencyId`,
        `Dependency ${quote(fields.dependencyId)} is declared more than once.`,
      );
    } else if (typeof fields.dependencyId === "string") {
      dependencyIds.add(fields.dependencyId);
    }
    const keyArray = inspectOwnDataArray(
      fields.requiredKeys,
      `${path}.requiredKeys`,
    );
    const requiredKeys: string[] = [];
    if (!keyArray.accepted || keyArray.value.length === 0) {
      if (!keyArray.accepted) {
        issues.push(inspectionIssue("manifest.invalid_required_keys", keyArray));
      } else {
        addIssue(
          issues,
          "manifest.empty_required_keys",
          `${path}.requiredKeys`,
          "At least one exact required key is required.",
        );
      }
    } else {
      const seen = new Set<string>();
      for (const [keyIndex, key] of keyArray.value.entries()) {
        if (typeof key !== "string" || key.length === 0) {
          addIssue(
            issues,
            "manifest.invalid_required_key",
            `${path}.requiredKeys[${keyIndex}]`,
            "Each required key must be a non-empty exact string.",
          );
        } else if (seen.has(key)) {
          addIssue(
            issues,
            "manifest.duplicate_required_key",
            `${path}.requiredKeys[${keyIndex}]`,
            `Required key ${quote(key)} is declared more than once.`,
          );
        } else {
          seen.add(key);
          requiredKeys.push(key);
        }
      }
    }
    if (validIdentity && keyArray.accepted && requiredKeys.length === keyArray.value.length) {
      dependencies.push({
        dependencyId: fields.dependencyId as string,
        containerPath: fields.containerPath as string,
        collectionPath: fields.collectionPath as string,
        keySchemaId: fields.keySchemaId as string,
        projectionAdapterId: fields.projectionAdapterId as string,
        requiredKeys,
      });
    }
  }

  const parityArray = inspectOwnDataArray(raw.parities, "manifest.parities");
  if (!parityArray.accepted) {
    issues.push(inspectionIssue("manifest.invalid_parities", parityArray));
    return null;
  }
  const parities: ScopedSemanticDependencyParitySelector[] = [];
  const parityIds = new Set<string>();
  for (const [index, value] of parityArray.value.entries()) {
    const path = `manifest.parities[${index}]`;
    const parity = inspectOwnDataRecord(
      value,
      ["parityId", "parityAdapterId", "left", "right"],
      path,
    );
    if (!parity.accepted) {
      issues.push(inspectionIssue("manifest.invalid_parity", parity));
      continue;
    }
    const fields = parity.value;
    const validIds =
      validateIdentifierField(fields.parityId, `${path}.parityId`, issues) &&
      validateIdentifierField(
        fields.parityAdapterId,
        `${path}.parityAdapterId`,
        issues,
      );
    if (typeof fields.parityId === "string" && parityIds.has(fields.parityId)) {
      addIssue(
        issues,
        "manifest.duplicate_parity_id",
        `${path}.parityId`,
        `Parity ${quote(fields.parityId)} is declared more than once.`,
      );
    } else if (typeof fields.parityId === "string") {
      parityIds.add(fields.parityId);
    }
    const left = validateParticipant(fields.left, `${path}.left`, issues);
    const right = validateParticipant(fields.right, `${path}.right`, issues);
    if (left && !participantExists(dependencies, left)) {
      addIssue(
        issues,
        "manifest.parity_participant_not_selected",
        `${path}.left`,
        "The left parity participant is not an exact required key.",
      );
    }
    if (right && !participantExists(dependencies, right)) {
      addIssue(
        issues,
        "manifest.parity_participant_not_selected",
        `${path}.right`,
        "The right parity participant is not an exact required key.",
      );
    }
    if (
      left &&
      right &&
      left.dependencyId === right.dependencyId &&
      left.key === right.key
    ) {
      addIssue(
        issues,
        "manifest.parity_participants_identical",
        path,
        "A parity declaration must pair two distinct selected participants.",
      );
    }
    if (validIds && left && right) {
      parities.push({
        parityId: fields.parityId as string,
        parityAdapterId: fields.parityAdapterId as string,
        left,
        right,
      });
    }
  }
  if (
    issues.length > 0 ||
    dependencies.length !== dependencyArray.value.length ||
    parities.length !== parityArray.value.length
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    scopeId: raw.scopeId as string,
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies,
    parities,
  };
}

function validateRuntimeDependencies(
  manifest: ScopedSemanticDependencyManifest,
  values: unknown[],
  issues: ScopedSemanticDependencyIssue[],
): Map<string, ScopedSemanticDependencyRuntimeInput> | null {
  const expected = new Map(
    manifest.dependencies.map((selector) => [selector.dependencyId, selector]),
  );
  const runtime = new Map<string, ScopedSemanticDependencyRuntimeInput>();
  for (const [index, value] of values.entries()) {
    const path = `input.dependencies[${index}]`;
    const inspected = inspectOwnDataRecord(
      value,
      [
        "dependencyId",
        "containerPath",
        "collectionPath",
        "keySchemaId",
        "projectionAdapterId",
        "records",
        "keyOf",
        "project",
      ],
      path,
    );
    if (!inspected.accepted) {
      issues.push(inspectionIssue("runtime.invalid_dependency", inspected));
      continue;
    }
    const fields = inspected.value;
    if (!isIdentifier(fields.dependencyId)) {
      addIssue(
        issues,
        "runtime.invalid_dependency_id",
        `${path}.dependencyId`,
        "Runtime dependencyId is invalid.",
      );
      continue;
    }
    const selector = expected.get(fields.dependencyId);
    if (!selector) {
      addIssue(
        issues,
        "runtime.unexpected_dependency",
        `${path}.dependencyId`,
        `Dependency ${quote(fields.dependencyId)} is not declared by the manifest.`,
      );
      continue;
    }
    if (runtime.has(fields.dependencyId)) {
      addIssue(
        issues,
        "runtime.duplicate_dependency_id",
        `${path}.dependencyId`,
        `Dependency ${quote(fields.dependencyId)} is supplied more than once.`,
      );
      continue;
    }
    for (const field of [
      "containerPath",
      "collectionPath",
      "keySchemaId",
      "projectionAdapterId",
    ] as const) {
      if (fields[field] !== selector[field]) {
        addIssue(
          issues,
          `runtime.${field}_mismatch`,
          `${path}.${field}`,
          `Runtime ${field} does not match the authenticated selector identity.`,
        );
      }
    }
    const records = inspectOwnDataArray(fields.records, `${path}.records`);
    if (!records.accepted) {
      issues.push(inspectionIssue("runtime.invalid_records", records));
      continue;
    }
    if (typeof fields.keyOf !== "function" || typeof fields.project !== "function") {
      addIssue(
        issues,
        "runtime.invalid_adapter",
        path,
        "Runtime keyOf and project must be own data functions.",
      );
      continue;
    }
    runtime.set(fields.dependencyId, {
      dependencyId: fields.dependencyId,
      containerPath: fields.containerPath as string,
      collectionPath: fields.collectionPath as string,
      keySchemaId: fields.keySchemaId as string,
      projectionAdapterId: fields.projectionAdapterId as string,
      records: records.value,
      keyOf: fields.keyOf as (record: unknown) => unknown,
      project: fields.project as (record: unknown) => unknown,
    });
  }
  for (const [index, selector] of manifest.dependencies.entries()) {
    if (!runtime.has(selector.dependencyId)) {
      addIssue(
        issues,
        "runtime.missing_dependency",
        `manifest.dependencies[${index}].dependencyId`,
        `Dependency ${quote(selector.dependencyId)} is missing from runtime input.`,
      );
    }
  }
  return issues.length === 0 ? runtime : null;
}

function validateParityAdapters(
  manifest: ScopedSemanticDependencyManifest,
  values: unknown[],
  issues: ScopedSemanticDependencyIssue[],
): Map<string, ScopedSemanticParityAdapterInput> | null {
  const expectedIds = new Set(
    manifest.parities.map(({ parityAdapterId }) => parityAdapterId),
  );
  const adapters = new Map<string, ScopedSemanticParityAdapterInput>();
  for (const [index, value] of values.entries()) {
    const path = `input.parityAdapters[${index}]`;
    const inspected = inspectOwnDataRecord(
      value,
      ["parityAdapterId", "normalize"],
      path,
    );
    if (!inspected.accepted) {
      issues.push(inspectionIssue("runtime.invalid_parity_adapter", inspected));
      continue;
    }
    const { parityAdapterId, normalize } = inspected.value;
    if (!isIdentifier(parityAdapterId) || typeof normalize !== "function") {
      addIssue(
        issues,
        "runtime.invalid_parity_adapter",
        path,
        "Parity adapter ID and normalize function are invalid.",
      );
      continue;
    }
    if (!expectedIds.has(parityAdapterId)) {
      addIssue(
        issues,
        "runtime.unexpected_parity_adapter",
        `${path}.parityAdapterId`,
        `Parity adapter ${quote(parityAdapterId)} is not declared.`,
      );
      continue;
    }
    if (adapters.has(parityAdapterId)) {
      addIssue(
        issues,
        "runtime.duplicate_parity_adapter",
        `${path}.parityAdapterId`,
        `Parity adapter ${quote(parityAdapterId)} is supplied more than once.`,
      );
      continue;
    }
    adapters.set(parityAdapterId, {
      parityAdapterId,
      normalize: normalize as ScopedSemanticParityAdapterInput["normalize"],
    });
  }
  for (const parityAdapterId of expectedIds) {
    if (!adapters.has(parityAdapterId)) {
      addIssue(
        issues,
        "runtime.missing_parity_adapter",
        "input.parityAdapters",
        `Parity adapter ${quote(parityAdapterId)} is missing.`,
      );
    }
  }
  return issues.length === 0 ? adapters : null;
}

function validateExpectation(
  value: unknown,
  issues: ScopedSemanticDependencyIssue[],
): ScopedSemanticDependencyExpectation | null {
  const inspected = inspectOwnDataRecord(
    value,
    ["scopeId", "manifestSha256", "scopeProjectionSha256"],
    "expectation",
  );
  if (!inspected.accepted) {
    issues.push(inspectionIssue("expectation.invalid_shape", inspected));
    return null;
  }
  const fields = inspected.value;
  if (!isIdentifier(fields.scopeId)) {
    addIssue(
      issues,
      "expectation.invalid_scope_id",
      "expectation.scopeId",
      "Expected scopeId is invalid.",
    );
  }
  for (const field of ["manifestSha256", "scopeProjectionSha256"] as const) {
    if (!isSha256(fields[field])) {
      addIssue(
        issues,
        "expectation.invalid_sha256",
        `expectation.${field}`,
        `${field} must be a lowercase 64-character SHA-256 digest.`,
      );
    }
  }
  return issues.length === 0
    ? {
        scopeId: fields.scopeId as string,
        manifestSha256: fields.manifestSha256 as string,
        scopeProjectionSha256: fields.scopeProjectionSha256 as string,
      }
    : null;
}

function validateParticipant(
  value: unknown,
  path: string,
  issues: ScopedSemanticDependencyIssue[],
): ScopedSemanticDependencyParticipant | null {
  const inspected = inspectOwnDataRecord(
    value,
    ["dependencyId", "key"],
    path,
  );
  if (!inspected.accepted) {
    issues.push(inspectionIssue("manifest.invalid_parity_participant", inspected));
    return null;
  }
  const { dependencyId, key } = inspected.value;
  if (!isIdentifier(dependencyId) || typeof key !== "string" || key.length === 0) {
    addIssue(
      issues,
      "manifest.invalid_parity_participant",
      path,
      "A parity participant requires an exact dependencyId and non-empty key.",
    );
    return null;
  }
  return { dependencyId, key };
}

function participantExists(
  dependencies: ScopedSemanticDependencySelector[],
  participant: ScopedSemanticDependencyParticipant,
): boolean {
  return dependencies.some(
    ({ dependencyId, requiredKeys }) =>
      dependencyId === participant.dependencyId &&
      requiredKeys.includes(participant.key),
  );
}

function selectorIdentity(selector: ScopedSemanticDependencySelector) {
  return {
    dependencyId: selector.dependencyId,
    containerPath: selector.containerPath,
    collectionPath: selector.collectionPath,
    keySchemaId: selector.keySchemaId,
    projectionAdapterId: selector.projectionAdapterId,
  };
}

type Inspection<T> =
  | { accepted: true; value: T }
  | { accepted: false; path: string; message: string };

function inspectOwnDataRecord(
  value: unknown,
  expectedKeys: readonly string[] | null,
  path: string,
): Inspection<Record<string, unknown>> {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return inspectionFailure(path, "Expected a plain object.");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return inspectionFailure(
        path,
        "Objects with inherited or custom prototypes are not accepted.",
      );
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
      return inspectionFailure(path, "Symbol-bearing objects are not accepted.");
    }
    const observedKeys = (ownKeys as string[]).sort(compareOrdinal);
    const canonicalExpected = expectedKeys
      ? [...expectedKeys].sort(compareOrdinal)
      : null;
    if (
      canonicalExpected &&
      canonicalJson(observedKeys) !== canonicalJson(canonicalExpected)
    ) {
      return inspectionFailure(
        path,
        "Own fields do not match the exact authenticated schema.",
      );
    }
    const result: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of observedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        return inspectionFailure(
          `${path}.${key}`,
          "Fields must be enumerable own data properties; accessors and hidden fields are rejected.",
        );
      }
      result[key] = descriptor.value;
    }
    return { accepted: true, value: result };
  } catch (error) {
    return inspectionFailure(
      path,
      `Object inspection failed (${safeThrownSummary(error)}).`,
    );
  }
}

function inspectOwnDataArray(
  value: unknown,
  path: string,
): Inspection<unknown[]> {
  try {
    if (!Array.isArray(value)) return inspectionFailure(path, "Expected an array.");
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return inspectionFailure(
        path,
        "Arrays with inherited or custom prototypes are not accepted.",
      );
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !lengthDescriptor ||
      !("value" in lengthDescriptor) ||
      lengthDescriptor.enumerable ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > 4_294_967_295
    ) {
      return inspectionFailure(path, "Array length must be one captured own data value.");
    }
    const length = lengthDescriptor.value as number;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== length + 1 ||
      ownKeys.some((key) => !isArrayOwnKey(key, length))
    ) {
      return inspectionFailure(
        path,
        "Arrays must contain only dense indexed own data entries.",
      );
    }
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        return inspectionFailure(
          `${path}[${index}]`,
          "Array entries must be enumerable own data properties.",
        );
      }
      result.push(descriptor.value);
    }
    return { accepted: true, value: result };
  } catch (error) {
    return inspectionFailure(
      path,
      `Array inspection failed (${safeThrownSummary(error)}).`,
    );
  }
}

function inspectionFailure(
  path: string,
  message: string,
): Inspection<never> {
  return { accepted: false, path, message };
}

function inspectionIssue(
  code: string,
  inspection: { accepted: false; path: string; message: string },
): ScopedSemanticDependencyIssue {
  return { code, path: inspection.path, message: inspection.message };
}

type JsonNormalization = Inspection<ScopedSemanticJsonValue>;

function normalizeJsonValue(value: unknown, path: string): JsonNormalization {
  try {
    return normalizeJsonValueRecursive(value, path, new WeakSet<object>());
  } catch (error) {
    return inspectionFailure(
      path,
      `JSON inspection failed (${safeThrownSummary(error)}).`,
    );
  }
}

function normalizeJsonValueRecursive(
  value: unknown,
  path: string,
  active: WeakSet<object>,
): JsonNormalization {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return { accepted: true, value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { accepted: true, value: value === 0 ? 0 : value }
      : inspectionFailure(path, "Projected JSON numbers must be finite.");
  }
  if (typeof value !== "object") {
    return inspectionFailure(
      path,
      `Projected values cannot contain ${typeof value}.`,
    );
  }
  if (active.has(value)) {
    return inspectionFailure(path, "Projected JSON values cannot contain cycles.");
  }
  active.add(value);
  try {
    if (Array.isArray(value)) {
      const inspected = inspectOwnDataArray(value, path);
      if (!inspected.accepted) return inspected;
      const result: ScopedSemanticJsonValue[] = [];
      for (const [index, nestedValue] of inspected.value.entries()) {
        const nested = normalizeJsonValueRecursive(
          nestedValue,
          `${path}[${index}]`,
          active,
        );
        if (!nested.accepted) return nested;
        result.push(nested.value);
      }
      return { accepted: true, value: result };
    }
    const inspected = inspectOwnDataRecord(value, null, path);
    if (!inspected.accepted) return inspected;
    const result: { [key: string]: ScopedSemanticJsonValue } = Object.create(
      null,
    ) as { [key: string]: ScopedSemanticJsonValue };
    for (const key of Object.keys(inspected.value).sort(compareOrdinal)) {
      const nested = normalizeJsonValueRecursive(
        inspected.value[key],
        `${path}.${key}`,
        active,
      );
      if (!nested.accepted) return nested;
      result[key] = nested.value;
    }
    return { accepted: true, value: result };
  } finally {
    active.delete(value);
  }
}

function canonicalJson(value: ScopedSemanticJsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON requires finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const objectValue = value as {
    readonly [key: string]: ScopedSemanticJsonValue;
  };
  return `{${Object.keys(objectValue)
    .sort(compareOrdinal)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
    .join(",")}}`;
}

function digest(domain: string, payload: ScopedSemanticJsonValue): string {
  return sha256Text(canonicalJson({ domain, payload }));
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateLiteral(
  value: unknown,
  expected: string | number,
  path: string,
  issues: ScopedSemanticDependencyIssue[],
): void {
  if (value !== expected) {
    addIssue(
      issues,
      "manifest.invalid_literal",
      path,
      `Expected the exact literal ${quote(String(expected))}.`,
    );
  }
}

function validateIdentifierField(
  value: unknown,
  path: string,
  issues: ScopedSemanticDependencyIssue[],
): value is string {
  if (isIdentifier(value)) return true;
  addIssue(
    issues,
    "manifest.invalid_identifier",
    path,
    "Expected a non-empty string without surrounding whitespace.",
  );
  return false;
}

function validateContainerPath(
  value: unknown,
  path: string,
  issues: ScopedSemanticDependencyIssue[],
): value is string {
  if (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !/^[A-Za-z]:/.test(value) &&
    !value.includes("\\") &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  ) {
    return true;
  }
  addIssue(
    issues,
    "manifest.invalid_container_path",
    path,
    "containerPath must be a normalized repository-relative POSIX path.",
  );
  return false;
}

function validateCollectionPath(
  value: unknown,
  path: string,
  issues: ScopedSemanticDependencyIssue[],
): value is string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.includes("\\") &&
    (value === "/" ||
      (!value.endsWith("/") &&
        value
          .slice(1)
          .split("/")
          .every((part) => part !== "" && part !== "." && part !== "..")))
  ) {
    return true;
  }
  addIssue(
    issues,
    "manifest.invalid_collection_path",
    path,
    "collectionPath must be a normalized absolute collection locator.",
  );
  return false;
}

function validateIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function isIdentifier(value: unknown): value is string {
  return validateIdentifier(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isArrayOwnKey(key: string | symbol, length: number): boolean {
  if (key === "length") return true;
  if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

function addIssue(
  issues: ScopedSemanticDependencyIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function failed(
  scopeId: string | null,
  manifestSha256: string | null,
  scopeProjectionSha256: string | null,
  issues: ScopedSemanticDependencyIssue[],
): InternalDerived {
  return {
    ok: false,
    rejection: rejection(
      scopeId,
      manifestSha256,
      scopeProjectionSha256,
      issues,
    ),
  };
}

function rejection(
  scopeId: string | null,
  manifestSha256: string | null,
  scopeProjectionSha256: string | null,
  issues: ScopedSemanticDependencyIssue[],
): ScopedSemanticDependencyRejectedResult {
  return {
    status: "rejected",
    trust: "none",
    scopeId,
    observed: { manifestSha256, scopeProjectionSha256 },
    issues: [...issues].sort((left, right) =>
      compareOrdinal(
        `${left.path}\u0000${left.code}\u0000${left.message}`,
        `${right.path}\u0000${right.code}\u0000${right.message}`,
      ),
    ),
  };
}

function unexpectedRejection(
  error: unknown,
): ScopedSemanticDependencyRejectedResult {
  return rejection(null, null, null, [
    {
      code: "projector.unexpected_input_fault",
      path: "input",
      message: `The projector safely rejected an unexpected input fault (${safeThrownSummary(error)}).`,
    },
  ]);
}

function safeThrownSummary(error: unknown): string {
  try {
    if (typeof error === "string") return error || "empty thrown string";
    if (error !== null && typeof error === "object") {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(error, "message");
        if (
          descriptor &&
          "value" in descriptor &&
          typeof descriptor.value === "string" &&
          descriptor.value.length > 0
        ) {
          return descriptor.value;
        }
      } catch {
        // Continue to the guarded string conversion.
      }
    }
    try {
      const rendered = String(error);
      return rendered.length > 0 ? rendered : "empty thrown value";
    } catch {
      return "uninspectable thrown value";
    }
  } catch {
    return "uninspectable thrown value";
  }
}

function quote(value: string): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "<string>";
  }
}

function freezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) freezeJson(descriptor.value);
  }
  return Object.freeze(value);
}
