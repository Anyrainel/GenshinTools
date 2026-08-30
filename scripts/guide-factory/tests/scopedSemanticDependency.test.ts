import { describe, expect, it, vi } from "vitest";
import {
  authenticateScopedSemanticDependencies,
  defineScopedSemanticDependencyInput,
  deriveScopedSemanticDependencyCandidate,
  requireAuthenticatedScopedSemanticDependencyAudit,
  requireAuthenticatedScopedSemanticDependencyProjection,
  type ScopedSemanticDependencyAcceptedResult,
  type ScopedSemanticDependencyAuthenticationInput,
  type ScopedSemanticDependencyCandidateResult,
  type ScopedSemanticDependencyDerivationInput,
  type ScopedSemanticDependencyExpectation,
  type ScopedSemanticDependencyManifest,
  type ScopedSemanticDependencyRuntimeInput,
  type ScopedSemanticJsonValue,
  type ScopedSemanticParityAdapterInput,
} from "../src/scopedSemanticDependency";

type RawGuideRecord = {
  sourceId: string;
  score: number;
  unicode: Record<string, string>;
  ignored: string;
};

type RepositoryGuideRecord = {
  id: string;
  guide: {
    score: number;
    unicode: Record<string, string>;
  };
  provenance: string;
};

const EXPECTED_MANIFEST_SHA256 =
  "9543d203794295e6be7a0ac296ac8b698046c4ea6bff1b9d3c41bf7ddef96fb7";
const EXPECTED_SCOPE_PROJECTION_SHA256 =
  "f1a2de6434ec5e5d4c48ab3b60f807de0cc906d1739eba667c107fd2cfc22c6c";
const EXPECTED_RAW_KEY_SET_SHA256 =
  "6c22c51f3dca1aaebd511efce705359f95f512134da3ff50ac9c0f50837f3afe";
const EXPECTED_RAW_SELECTED_PAYLOAD_SHA256 =
  "4d6f106a669719e0479c6d785440eb6102160617922bda50d2c6eba7c57bac83";
const EXPECTED_REPOSITORY_KEY_SET_SHA256 =
  "2c9fef6f1315e7c757dc2025b678261320720172469b585e7df4dd921572c3e3";
const EXPECTED_REPOSITORY_SELECTED_PAYLOAD_SHA256 =
  "c2ef34f549f0e3742f0275c528459b42c8eadfbfaa9d672fe74d92016a7cfdef";
const EXPECTED_ALPHA_PARITY_SHA256 =
  "b6019921dce3f13abb3c1974e8295c4a192fc75e0fa6624f7e0beda8c8aa3ff8";

const RAW_RECORDS: RawGuideRecord[] = [
  {
    sourceId: "unrelated-xiao",
    score: 99,
    unicode: { 中: "ignored", a: "ignored" },
    ignored: "unrelated raw content",
  },
  {
    sourceId: "beta",
    score: 20,
    unicode: { é: "4", 中: "3", a: "1", ß: "2" },
    ignored: "not projected",
  },
  {
    sourceId: "alpha",
    score: 10,
    unicode: { 中: "3", é: "4", ß: "2", a: "1" },
    ignored: "not projected",
  },
];

const REPOSITORY_RECORDS: RepositoryGuideRecord[] = [
  {
    id: "alpha",
    guide: {
      score: 10,
      unicode: { a: "1", ß: "2", é: "4", 中: "3" },
    },
    provenance: "selected consolidated record",
  },
  {
    id: "unrelated-xiao",
    guide: { score: 99, unicode: { a: "ignored", 中: "ignored" } },
    provenance: "unrelated consolidated record",
  },
  {
    id: "beta",
    guide: {
      score: 20,
      unicode: { ß: "2", a: "1", 中: "3", é: "4" },
    },
    provenance: "selected consolidated record",
  },
];

describe("scoped semantic dependency", () => {
  it("derives a deterministic, untrusted, compact candidate with pinned ordinal digests", () => {
    const input = derivationInput();
    const rawBefore = structuredClone(input.dependencies[0].records);
    const repositoryBefore = structuredClone(input.dependencies[1].records);

    const first = candidate(deriveScopedSemanticDependencyCandidate(input));
    const repeated = candidate(
      deriveScopedSemanticDependencyCandidate(derivationInput()),
    );

    expect(repeated).toEqual(first);
    expect(input.dependencies[0].records).toEqual(rawBefore);
    expect(input.dependencies[1].records).toEqual(repositoryBefore);
    expect(first).toMatchObject({ status: "candidate", trust: "untrusted" });
    expect("selection" in first).toBe(false);
    expect(first.audit.selector.manifestSha256).toBe(
      EXPECTED_MANIFEST_SHA256,
    );
    expect(first.audit.dependencies[0]).toMatchObject({
      dependencyId: "raw-guides",
      containerPath:
        "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
      collectionPath: "/records",
      keySchemaId: "kqm-source-record-id-v1",
      projectionAdapterId: "raw-guide-projection-v1",
      selectedKeySetSha256: EXPECTED_RAW_KEY_SET_SHA256,
      selectedPayloadSha256: EXPECTED_RAW_SELECTED_PAYLOAD_SHA256,
    });
    expect(first.audit.dependencies[1]).toMatchObject({
      dependencyId: "repository-guides",
      containerPath: "scripts/guide-factory/data/knowledge/repository.json",
      collectionPath: "/records",
      keySchemaId: "knowledge-record-id-v1",
      projectionAdapterId: "repository-guide-projection-v1",
      selectedKeySetSha256: EXPECTED_REPOSITORY_KEY_SET_SHA256,
      selectedPayloadSha256: EXPECTED_REPOSITORY_SELECTED_PAYLOAD_SHA256,
    });
    expect(first.audit.parities).toHaveLength(2);
    expect(first.audit.parities[0]).toMatchObject({
      parityId: "raw-repository-alpha",
      status: "exact",
      leftNormalizedSha256: EXPECTED_ALPHA_PARITY_SHA256,
      rightNormalizedSha256: EXPECTED_ALPHA_PARITY_SHA256,
    });
    expect(first.audit.scopeProjectionSha256).toBe(
      EXPECTED_SCOPE_PROJECTION_SHA256,
    );
    expect(JSON.stringify(first.audit)).not.toContain("unrelated-xiao");
    expect(JSON.stringify(first.audit)).not.toContain("containerSha256");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.audit.dependencies)).toBe(true);
  });

  it("exposes a deeply frozen selection only after current-input rebuild and pinned expectations", () => {
    const input = authenticationInput();
    const result = accepted(authenticateScopedSemanticDependencies(input));

    expect(result).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      audit: {
        status: "accepted",
        trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      },
    });
    const alpha = selectedPayload(result, "raw-guides", "alpha") as {
      score: number;
      unicode: Record<string, string>;
    };
    expect(Object.keys(alpha.unicode)).toEqual(["a", "ß", "é", "中"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.selection)).toBe(true);
    expect(Object.isFrozen(alpha)).toBe(true);
    expect(Object.isFrozen(alpha.unicode)).toBe(true);
    expect(() => {
      alpha.score = 999;
    }).toThrow(TypeError);
    const trusted = requireAuthenticatedScopedSemanticDependencyProjection(
      structuredClone(result),
      input,
    );
    expect(Object.isFrozen(trusted)).toBe(true);
    expect(Object.isFrozen(trusted.selection.dependencies[0])).toBe(true);

    const mutableSerialized = structuredClone(result);
    const rebuilt = requireAuthenticatedScopedSemanticDependencyProjection(
      mutableSerialized,
      input,
    );
    const mutablePayload = selectedPayload(
      mutableSerialized,
      "raw-guides",
      "alpha",
    ) as { score: number };
    mutablePayload.score = 777;
    expect(
      (
        selectedPayload(rebuilt, "raw-guides", "alpha") as {
          score: number;
        }
      ).score,
    ).toBe(10);
  });

  it("is stable under unrelated additions, container/runtime reorder, and Unicode insertion order", () => {
    const baseline = accepted(
      authenticateScopedSemanticDependencies(authenticationInput()),
    );
    const raw = [
      {
        sourceId: "more-unrelated-data",
        score: -1,
        unicode: { é: "ignored", a: "ignored" },
        ignored: "ignored",
      },
      {
        sourceId: "alpha",
        score: 10,
        unicode: { a: "1", 中: "3", ß: "2", é: "4" },
        ignored: "changed unprojected bytes",
      },
      structuredClone(RAW_RECORDS[0]),
      structuredClone(RAW_RECORDS[1]),
    ];
    const repository = [
      structuredClone(REPOSITORY_RECORDS[2]),
      structuredClone(REPOSITORY_RECORDS[1]),
      {
        id: "alpha",
        guide: {
          score: 10,
          unicode: { 中: "3", é: "4", a: "1", ß: "2" },
        },
        provenance: "changed unprojected bytes",
      },
    ];
    const reordered = authenticationInput(raw, repository);
    reordered.dependencies.reverse();
    const observed = accepted(authenticateScopedSemanticDependencies(reordered));

    expect(observed).toEqual(baseline);
  });

  it("rejects coherent selected-input drift and a stale receipt against current inputs", () => {
    const baselineInput = authenticationInput();
    const baseline = accepted(
      authenticateScopedSemanticDependencies(baselineInput),
    );
    const raw = structuredClone(RAW_RECORDS);
    const repository = structuredClone(REPOSITORY_RECORDS);
    raw.find(({ sourceId }) => sourceId === "alpha")!.score += 1;
    repository.find(({ id }) => id === "alpha")!.guide.score += 1;
    const driftedInput = authenticationInput(raw, repository);
    const candidateDrift = candidate(
      deriveScopedSemanticDependencyCandidate(
        derivationInput(raw, repository),
      ),
    );
    const rejected = authenticateScopedSemanticDependencies(driftedInput);

    expect(candidateDrift.audit.selector.manifestSha256).toBe(
      baseline.audit.selector.manifestSha256,
    );
    expect(candidateDrift.audit.scopeProjectionSha256).not.toBe(
      baseline.audit.scopeProjectionSha256,
    );
    expect(rejected.status).toBe("rejected");
    if (rejected.status !== "rejected") throw new Error("expected rejection");
    expect(rejected.issues.map(({ code }) => code)).toContain(
      "authentication.scope_projection_mismatch",
    );
    expect("selection" in rejected).toBe(false);
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyProjection(
        baseline,
        driftedInput,
      ),
    ).toThrow(/authentication failed/);
  });

  it("rejects a selected raw/repository parity mismatch before authentication", () => {
    const raw = structuredClone(RAW_RECORDS);
    raw.find(({ sourceId }) => sourceId === "alpha")!.score += 1;
    const result = deriveScopedSemanticDependencyCandidate(
      derivationInput(raw, structuredClone(REPOSITORY_RECORDS)),
    );

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejection");
    expect(result.issues.map(({ code }) => code)).toContain(
      "parity.normalized_payload_mismatch",
    );
    expect("selection" in result).toBe(false);
  });

  it.each([
    {
      label: "missing",
      raw: RAW_RECORDS.filter(({ sourceId }) => sourceId !== "alpha"),
      issue: "selection.required_key_missing",
    },
    {
      label: "duplicated",
      raw: [
        ...RAW_RECORDS,
        structuredClone(RAW_RECORDS.find(({ sourceId }) => sourceId === "alpha")!),
      ],
      issue: "selection.required_key_duplicated",
    },
  ])("rejects a $label exact key with no consumable selection", ({ raw, issue }) => {
    const result = deriveScopedSemanticDependencyCandidate(
      derivationInput(raw, structuredClone(REPOSITORY_RECORDS)),
    );
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejection");
    expect(result.issues.map(({ code }) => code)).toContain(issue);
    expect("selection" in result).toBe(false);
  });

  it("binds selector add/remove/reorder policy and rejects manifest drift before adapter calls", () => {
    const baseline = candidate(
      deriveScopedSemanticDependencyCandidate(derivationInput()),
    );
    const variants: Array<{
      manifest: ScopedSemanticDependencyManifest;
      raw: RawGuideRecord[];
      repository: RepositoryGuideRecord[];
    }> = [];

    const added = manifest();
    added.dependencies[0].requiredKeys.push("gamma");
    added.dependencies[1].requiredKeys.push("gamma");
    variants.push({
      manifest: added,
      raw: [
        ...structuredClone(RAW_RECORDS),
        {
          sourceId: "gamma",
          score: 30,
          unicode: { a: "1" },
          ignored: "ignored",
        },
      ],
      repository: [
        ...structuredClone(REPOSITORY_RECORDS),
        {
          id: "gamma",
          guide: { score: 30, unicode: { a: "1" } },
          provenance: "ignored",
        },
      ],
    });
    const removed = manifest();
    removed.dependencies[0].requiredKeys = ["alpha"];
    removed.dependencies[1].requiredKeys = ["alpha"];
    removed.parities = [removed.parities[0]];
    variants.push({
      manifest: removed,
      raw: structuredClone(RAW_RECORDS),
      repository: structuredClone(REPOSITORY_RECORDS),
    });
    const reordered = manifest();
    reordered.dependencies[0].requiredKeys.reverse();
    reordered.dependencies[1].requiredKeys.reverse();
    reordered.parities.reverse();
    variants.push({
      manifest: reordered,
      raw: structuredClone(RAW_RECORDS),
      repository: structuredClone(REPOSITORY_RECORDS),
    });

    for (const variant of variants) {
      const observed = candidate(
        deriveScopedSemanticDependencyCandidate(
          derivationInput(variant.raw, variant.repository, variant.manifest),
        ),
      );
      expect(observed.audit.selector.manifestSha256).not.toBe(
        baseline.audit.selector.manifestSha256,
      );
      expect(observed.audit.scopeProjectionSha256).not.toBe(
        baseline.audit.scopeProjectionSha256,
      );
    }

    const keyOf = vi.fn(() => "alpha");
    const project = vi.fn(() => ({ score: 10 }));
    const changedInput = authenticationInput();
    changedInput.manifest = variants[0].manifest;
    changedInput.dependencies[0] = {
      ...changedInput.dependencies[0],
      keyOf,
      project,
    };
    const rejected = authenticateScopedSemanticDependencies(changedInput);
    expect(rejected.status).toBe("rejected");
    expect(keyOf).not.toHaveBeenCalled();
    expect(project).not.toHaveBeenCalled();
  });

  it.each([
    ["containerPath", "other/source.json", "runtime.containerPath_mismatch"],
    ["collectionPath", "/otherRecords", "runtime.collectionPath_mismatch"],
    ["keySchemaId", "other-key-schema-v1", "runtime.keySchemaId_mismatch"],
    [
      "projectionAdapterId",
      "other-projection-v1",
      "runtime.projectionAdapterId_mismatch",
    ],
  ] as const)("rejects runtime %s identity drift", (field, value, issueCode) => {
    const input = derivationInput();
    input.dependencies[0] = { ...input.dependencies[0], [field]: value };
    const result = deriveScopedSemanticDependencyCandidate(input);
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejection");
    expect(result.issues.map(({ code }) => code)).toContain(issueCode);
  });

  it("domain-separates coherent adapter, scope, dependency, path, and schema identities", () => {
    const baseline = candidate(
      deriveScopedSemanticDependencyCandidate(derivationInput()),
    );
    const other = manifest();
    other.scopeId = "test:other-scope";
    other.dependencies[0].dependencyId = "other-raw-guides";
    other.dependencies[0].containerPath = "other/raw-guides.json";
    other.dependencies[0].keySchemaId = "other-raw-key-v1";
    other.dependencies[0].projectionAdapterId = "other-raw-projection-v1";
    for (const parity of other.parities) {
      parity.left.dependencyId = "other-raw-guides";
    }
    const runtime = runtimeInputs();
    runtime[0] = {
      ...runtime[0],
      dependencyId: "other-raw-guides",
      containerPath: "other/raw-guides.json",
      keySchemaId: "other-raw-key-v1",
      projectionAdapterId: "other-raw-projection-v1",
    };
    const observed = candidate(
      deriveScopedSemanticDependencyCandidate({
        manifest: other,
        dependencies: runtime,
        parityAdapters: parityAdapters(),
      }),
    );

    expect(observed.audit.selector.manifestSha256).not.toBe(
      baseline.audit.selector.manifestSha256,
    );
    expect(observed.audit.dependencies[0].selectedKeySetSha256).not.toBe(
      baseline.audit.dependencies[0].selectedKeySetSha256,
    );
    expect(observed.audit.dependencies[0].selectedEntries[0].payloadSha256).not.toBe(
      baseline.audit.dependencies[0].selectedEntries[0].payloadSha256,
    );
    expect(observed.audit.dependencies[0].selectedPayloadSha256).not.toBe(
      baseline.audit.dependencies[0].selectedPayloadSha256,
    );
    expect(observed.audit.parities[0].leftNormalizedSha256).not.toBe(
      baseline.audit.parities[0].leftNormalizedSha256,
    );
    expect(observed.audit.scopeProjectionSha256).not.toBe(
      baseline.audit.scopeProjectionSha256,
    );
  });

  it("domain-separates a coherent projection-adapter revision and rejects old pins", () => {
    const baseline = candidate(
      deriveScopedSemanticDependencyCandidate(derivationInput()),
    );
    const revisedManifest = manifest();
    revisedManifest.dependencies[0].projectionAdapterId =
      "raw-guide-projection-v2";
    const revisedRuntime = runtimeInputs();
    revisedRuntime[0] = {
      ...revisedRuntime[0],
      projectionAdapterId: "raw-guide-projection-v2",
    };
    const revisedInput: ScopedSemanticDependencyDerivationInput = {
      manifest: revisedManifest,
      dependencies: revisedRuntime,
      parityAdapters: parityAdapters(),
    };
    const revised = candidate(
      deriveScopedSemanticDependencyCandidate(revisedInput),
    );
    expect(revised.audit.selector.manifestSha256).not.toBe(
      baseline.audit.selector.manifestSha256,
    );
    expect(revised.audit.dependencies[0].selectedEntries[0].payloadSha256).not.toBe(
      baseline.audit.dependencies[0].selectedEntries[0].payloadSha256,
    );
    expect(revised.audit.scopeProjectionSha256).not.toBe(
      baseline.audit.scopeProjectionSha256,
    );
    const authenticated = authenticateScopedSemanticDependencies({
      ...revisedInput,
      expectation: expectation(),
    });
    expect(authenticated.status).toBe("rejected");
    if (authenticated.status !== "rejected") {
      throw new Error("expected rejection");
    }
    expect(authenticated.issues.map(({ code }) => code)).toContain(
      "authentication.manifest_mismatch",
    );
  });

  it.each([
    ["absolute container", "containerPath", "/absolute/source.json"],
    ["backslash container", "containerPath", "sources\\raw.json"],
    ["traversing container", "containerPath", "sources/../raw.json"],
    ["relative collection", "collectionPath", "records"],
    ["traversing collection", "collectionPath", "/records/../other"],
    ["blank schema", "keySchemaId", ""],
  ] as const)("rejects a noncanonical %s identity", (_label, field, value) => {
    const selectedManifest = manifest();
    selectedManifest.dependencies[0][field] = value;
    const result = deriveScopedSemanticDependencyCandidate(
      derivationInput(
        structuredClone(RAW_RECORDS),
        structuredClone(REPOSITORY_RECORDS),
        selectedManifest,
      ),
    );
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejection");
    expect(result.issues.some(({ code }) => code.startsWith("manifest."))).toBe(
      true,
    );
  });

  it("rejects missing parity participants and adapters", () => {
    const missingPair = manifest();
    missingPair.parities[0].left.key = "not-selected";
    const pairResult = deriveScopedSemanticDependencyCandidate(
      derivationInput(
        structuredClone(RAW_RECORDS),
        structuredClone(REPOSITORY_RECORDS),
        missingPair,
      ),
    );
    expect(pairResult.status).toBe("rejected");
    if (pairResult.status !== "rejected") throw new Error("expected rejection");
    expect(pairResult.issues.map(({ code }) => code)).toContain(
      "manifest.parity_participant_not_selected",
    );

    const missingAdapter = derivationInput();
    missingAdapter.parityAdapters = [];
    const adapterResult = deriveScopedSemanticDependencyCandidate(missingAdapter);
    expect(adapterResult.status).toBe("rejected");
    if (adapterResult.status !== "rejected") throw new Error("expected rejection");
    expect(adapterResult.issues.map(({ code }) => code)).toContain(
      "runtime.missing_parity_adapter",
    );
  });

  it.each([
    ["undefined", () => undefined],
    ["NaN", () => Number.NaN],
    ["infinity", () => Number.POSITIVE_INFINITY],
    ["bigint", () => 1n],
    ["Date", () => new Date("2026-08-30T00:00:00.000Z")],
    ["Map", () => new Map([["value", 1]])],
    [
      "cycle",
      () => {
        const cyclic: { self?: unknown } = {};
        cyclic.self = cyclic;
        return cyclic;
      },
    ],
    ["sparse array", () => new Array(1)],
    [
      "custom array prototype",
      () => {
        const value = [1];
        Object.setPrototypeOf(value, { inherited: true });
        return value;
      },
    ],
    [
      "hostile proxy",
      () =>
        new Proxy(
          {},
          {
            ownKeys: () => {
              throw new Error("proxy ownKeys boom");
            },
          },
        ),
    ],
  ])("rejects a non-JSON or hostile $s projection", (_label, makeValue) => {
    const input = derivationInput();
    input.dependencies[0] = {
      ...input.dependencies[0],
      project: () => makeValue(),
    };
    const result = deriveScopedSemanticDependencyCandidate(input);
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejection");
    expect(result.issues.map(({ code }) => code)).toContain(
      "projection.invalid_json_value",
    );
  });

  it("safely summarizes hostile thrown values from key, projection, and parity adapters", () => {
    const hostile = hostileThrownValue();
    for (const failure of ["key", "projection", "parity"] as const) {
      const input = derivationInput();
      if (failure === "key") {
        input.dependencies[0] = {
          ...input.dependencies[0],
          keyOf: () => {
            throw hostile;
          },
        };
      } else if (failure === "projection") {
        input.dependencies[0] = {
          ...input.dependencies[0],
          project: () => {
            throw hostile;
          },
        };
      } else {
        input.parityAdapters[0] = {
          ...input.parityAdapters[0],
          normalize: () => {
            throw hostile;
          },
        };
      }
      expect(() => deriveScopedSemanticDependencyCandidate(input)).not.toThrow();
      const result = deriveScopedSemanticDependencyCandidate(input);
      expect(result.status).toBe("rejected");
      if (result.status !== "rejected") throw new Error("expected rejection");
      expect(result.issues[0].message).toContain("uninspectable thrown value");
    }
  });

  it.each([
    [
      "inherited manifest",
      () => Object.create(manifest()) as ScopedSemanticDependencyManifest,
    ],
    [
      "accessor manifest field",
      () => {
        const value = manifest();
        Object.defineProperty(value, "scopeId", {
          enumerable: true,
          get: () => {
            throw new Error("scope getter must not run");
          },
        });
        return value;
      },
    ],
    [
      "hidden manifest field",
      () => {
        const value = manifest();
        Object.defineProperty(value, "hidden", { value: true });
        return value;
      },
    ],
    [
      "symbol manifest field",
      () => {
        const value = manifest() as ScopedSemanticDependencyManifest & {
          [key: symbol]: unknown;
        };
        value[Symbol("hidden")] = true;
        return value;
      },
    ],
    [
      "hostile manifest proxy",
      () =>
        new Proxy(manifest(), {
          ownKeys: () => {
            throw new Error("manifest ownKeys boom");
          },
        }),
    ],
  ])("sanitizes a $s without leaking an exception", (_label, makeManifest) => {
    const input = derivationInput();
    input.manifest = makeManifest();
    expect(() => deriveScopedSemanticDependencyCandidate(input)).not.toThrow();
    const result = deriveScopedSemanticDependencyCandidate(input);
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejection");
    expect(result.issues.map(({ code }) => code)).toContain(
      "manifest.invalid_shape",
    );
  });

  it("rejects an executable predicate field and a hostile top-level input proxy", () => {
    const predicateManifest = manifest() as unknown as {
      dependencies: Array<Record<string, unknown>>;
    };
    predicateManifest.dependencies[0].predicate = "character == keqing";
    const predicateInput = derivationInput();
    predicateInput.manifest =
      predicateManifest as unknown as ScopedSemanticDependencyManifest;
    const predicateResult = deriveScopedSemanticDependencyCandidate(
      predicateInput,
    );
    expect(predicateResult.status).toBe("rejected");
    if (predicateResult.status !== "rejected") {
      throw new Error("expected rejection");
    }
    expect(predicateResult.issues.map(({ code }) => code)).toContain(
      "manifest.invalid_dependency",
    );

    const proxy = new Proxy(derivationInput(), {
      ownKeys: () => {
        throw new Error("top-level ownKeys boom");
      },
    });
    expect(() =>
      deriveScopedSemanticDependencyCandidate(proxy),
    ).not.toThrow();
    const proxyResult = deriveScopedSemanticDependencyCandidate(proxy);
    expect(proxyResult.status).toBe("rejected");
    if (proxyResult.status !== "rejected") throw new Error("expected rejection");
    expect(proxyResult.issues.map(({ code }) => code)).toContain(
      "input.invalid_shape",
    );
  });

  it("strictly rejects accessor and proxy runtime bindings", () => {
    const accessorInput = derivationInput();
    const accessorRuntime = { ...accessorInput.dependencies[0] };
    Object.defineProperty(accessorRuntime, "containerPath", {
      enumerable: true,
      get: () => {
        throw new Error("runtime getter must not run");
      },
    });
    accessorInput.dependencies[0] = accessorRuntime;
    const accessorResult = deriveScopedSemanticDependencyCandidate(accessorInput);
    expect(accessorResult.status).toBe("rejected");

    const proxyInput = derivationInput();
    proxyInput.dependencies[0] = new Proxy(proxyInput.dependencies[0], {
      ownKeys: () => {
        throw new Error("runtime ownKeys boom");
      },
    });
    expect(() => deriveScopedSemanticDependencyCandidate(proxyInput)).not.toThrow();
    expect(deriveScopedSemanticDependencyCandidate(proxyInput).status).toBe(
      "rejected",
    );
  });

  it("clones only selected records and rejects transient selected accessors before projection", () => {
    const raw = structuredClone(RAW_RECORDS);
    const alphaIndex = raw.findIndex(({ sourceId }) => sourceId === "alpha");
    if (alphaIndex < 0) throw new Error("fixture is missing alpha");
    const transient = { ...raw[alphaIndex] };
    let keyReads = 0;
    Object.defineProperty(transient, "sourceId", {
      enumerable: true,
      get: () => {
        keyReads += 1;
        return keyReads === 1 ? "alpha" : "beta";
      },
    });
    raw[alphaIndex] = transient;
    const input = derivationInput(raw, structuredClone(REPOSITORY_RECORDS));
    const project = vi.fn(input.dependencies[0].project);
    input.dependencies[0] = { ...input.dependencies[0], project };

    const result = deriveScopedSemanticDependencyCandidate(input);
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejection");
    expect(result.issues.map(({ code }) => code)).toContain(
      "selection.invalid_selected_record",
    );
    expect(project).not.toHaveBeenCalled();
    expect(keyReads).toBe(1);
  });

  it("captures array length from its own descriptor and never trusts a changing proxy getter", () => {
    const input = derivationInput();
    let lengthGetterCalls = 0;
    const records = new Proxy(structuredClone(RAW_RECORDS), {
      get: (target, property, receiver) => {
        if (property === "length") {
          lengthGetterCalls += 1;
          return lengthGetterCalls % 2 === 0 ? 0 : target.length;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    input.dependencies[0] = { ...input.dependencies[0], records };

    const result = candidate(deriveScopedSemanticDependencyCandidate(input));
    expect(result.audit.scopeProjectionSha256).toBe(
      EXPECTED_SCOPE_PROJECTION_SHA256,
    );
    expect(lengthGetterCalls).toBe(0);
  });

  it("freezes projected payloads before parity adapters can mutate them", () => {
    const input = derivationInput();
    input.parityAdapters[0] = {
      ...input.parityAdapters[0],
      normalize: ({ payload }) => {
        (payload as { score: number }).score = 999;
        return payload;
      },
    };
    const result = deriveScopedSemanticDependencyCandidate(input);

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejection");
    expect(result.issues.map(({ code }) => code)).toContain(
      "parity.adapter_failed",
    );
    const baseline = candidate(
      deriveScopedSemanticDependencyCandidate(derivationInput()),
    );
    expect(baseline.audit.scopeProjectionSha256).toBe(
      EXPECTED_SCOPE_PROJECTION_SHA256,
    );
  });

  it("canonicalizes negative zero to positive zero before hashing and consumption", () => {
    const negativeRaw = structuredClone(RAW_RECORDS);
    const negativeRepository = structuredClone(REPOSITORY_RECORDS);
    negativeRaw.find(({ sourceId }) => sourceId === "alpha")!.score = -0;
    negativeRepository.find(({ id }) => id === "alpha")!.guide.score = -0;
    const positiveRaw = structuredClone(negativeRaw);
    const positiveRepository = structuredClone(negativeRepository);
    positiveRaw.find(({ sourceId }) => sourceId === "alpha")!.score = 0;
    positiveRepository.find(({ id }) => id === "alpha")!.guide.score = 0;

    const negativeInput = derivationInput(
      negativeRaw,
      negativeRepository,
    );
    const negativeCandidate = candidate(
      deriveScopedSemanticDependencyCandidate(negativeInput),
    );
    const positiveCandidate = candidate(
      deriveScopedSemanticDependencyCandidate(
        derivationInput(positiveRaw, positiveRepository),
      ),
    );
    expect(negativeCandidate.audit).toEqual(positiveCandidate.audit);

    const authenticated = accepted(
      authenticateScopedSemanticDependencies({
        ...negativeInput,
        expectation: {
          scopeId: positiveCandidate.audit.scopeId,
          manifestSha256: positiveCandidate.audit.selector.manifestSha256,
          scopeProjectionSha256:
            positiveCandidate.audit.scopeProjectionSha256,
        },
      }),
    );
    const score = (
      selectedPayload(authenticated, "raw-guides", "alpha") as {
        score: number;
      }
    ).score;
    expect(score).toBe(0);
    expect(Object.is(score, -0)).toBe(false);
    expect(Object.is(score, 0)).toBe(true);
  });

  it("rebuild guard rejects parity/audit/selection tampering and inherited audit fields", () => {
    const input = authenticationInput();
    const canonical = accepted(authenticateScopedSemanticDependencies(input));

    const parityTamper = structuredClone(canonical);
    (
      parityTamper.audit.parities[0] as unknown as { status: string }
    ).status = "unchecked";
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyProjection(parityTamper, input),
    ).toThrow(/authentication failed/);
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyAudit(
        parityTamper.audit,
        input,
      ),
    ).toThrow(/authentication failed/);

    const canonicalAudit = requireAuthenticatedScopedSemanticDependencyAudit(
      structuredClone(canonical.audit),
      input,
    );
    expect(canonicalAudit).toEqual(canonical.audit);
    expect(Object.isFrozen(canonicalAudit)).toBe(true);

    const selectionTamper = structuredClone(canonical);
    const payload = selectedPayload(
      selectionTamper,
      "raw-guides",
      "alpha",
    ) as { score: number };
    payload.score += 100;
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyProjection(
        selectionTamper,
        input,
      ),
    ).toThrow(/authentication failed/);

    const inheritedAudit = structuredClone(canonical);
    Object.setPrototypeOf(inheritedAudit.audit, { forged: true });
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyProjection(
        inheritedAudit,
        input,
      ),
    ).toThrow(/authentication failed/);
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyAudit(
        inheritedAudit.audit,
        input,
      ),
    ).toThrow(/authentication failed/);

    const accessorAudit = structuredClone(canonical.audit);
    Object.defineProperty(accessorAudit, "scopeId", {
      enumerable: true,
      get: () => {
        throw new Error("audit scope getter must not run");
      },
    });
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyAudit(accessorAudit, input),
    ).toThrow(/authentication failed/);

    const symbolAudit = structuredClone(canonical.audit) as typeof canonical.audit & {
      [key: symbol]: unknown;
    };
    symbolAudit[Symbol("forged")] = true;
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyAudit(symbolAudit, input),
    ).toThrow(/authentication failed/);
  });

  it("keeps candidate output unusable as authenticated consumption", () => {
    const input = authenticationInput();
    const untrusted = candidate(
      deriveScopedSemanticDependencyCandidate(derivationInput()),
    );
    expect("selection" in untrusted).toBe(false);
    expect(() =>
      requireAuthenticatedScopedSemanticDependencyProjection(untrusted, input),
    ).toThrow(/authentication failed/);

    const wrongPins = authenticationInput();
    wrongPins.expectation.scopeProjectionSha256 = "0".repeat(64);
    const rejected = authenticateScopedSemanticDependencies(wrongPins);
    expect(rejected.status).toBe("rejected");
    expect("selection" in rejected).toBe(false);
  });
});

function manifest(): ScopedSemanticDependencyManifest {
  return {
    schemaVersion: 1,
    scopeId: "test:keqing-guide-scope",
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies: [
      {
        dependencyId: "raw-guides",
        containerPath:
          "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
        collectionPath: "/records",
        keySchemaId: "kqm-source-record-id-v1",
        projectionAdapterId: "raw-guide-projection-v1",
        requiredKeys: ["alpha", "beta"],
      },
      {
        dependencyId: "repository-guides",
        containerPath: "scripts/guide-factory/data/knowledge/repository.json",
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "repository-guide-projection-v1",
        requiredKeys: ["alpha", "beta"],
      },
    ],
    parities: [
      {
        parityId: "raw-repository-alpha",
        parityAdapterId: "identity-selected-guide-v1",
        left: { dependencyId: "raw-guides", key: "alpha" },
        right: { dependencyId: "repository-guides", key: "alpha" },
      },
      {
        parityId: "raw-repository-beta",
        parityAdapterId: "identity-selected-guide-v1",
        left: { dependencyId: "raw-guides", key: "beta" },
        right: { dependencyId: "repository-guides", key: "beta" },
      },
    ],
  };
}

function runtimeInputs(
  raw = structuredClone(RAW_RECORDS),
  repository = structuredClone(REPOSITORY_RECORDS),
): ScopedSemanticDependencyRuntimeInput[] {
  return [
    defineScopedSemanticDependencyInput<RawGuideRecord>({
      dependencyId: "raw-guides",
      containerPath:
        "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
      collectionPath: "/records",
      keySchemaId: "kqm-source-record-id-v1",
      records: raw,
      adapter: {
        projectionAdapterId: "raw-guide-projection-v1",
        keyOf: ({ sourceId }) => sourceId,
        project: ({ score, unicode }) => ({ score, unicode }),
      },
    }),
    defineScopedSemanticDependencyInput<RepositoryGuideRecord>({
      dependencyId: "repository-guides",
      containerPath: "scripts/guide-factory/data/knowledge/repository.json",
      collectionPath: "/records",
      keySchemaId: "knowledge-record-id-v1",
      records: repository,
      adapter: {
        projectionAdapterId: "repository-guide-projection-v1",
        keyOf: ({ id }) => id,
        project: ({ guide }) => ({
          score: guide.score,
          unicode: guide.unicode,
        }),
      },
    }),
  ];
}

function parityAdapters(): ScopedSemanticParityAdapterInput[] {
  return [
    {
      parityAdapterId: "identity-selected-guide-v1",
      normalize: ({ payload }) => payload,
    },
  ];
}

function derivationInput(
  raw = structuredClone(RAW_RECORDS),
  repository = structuredClone(REPOSITORY_RECORDS),
  selectedManifest = manifest(),
): ScopedSemanticDependencyDerivationInput {
  return {
    manifest: selectedManifest,
    dependencies: runtimeInputs(raw, repository),
    parityAdapters: parityAdapters(),
  };
}

function expectation(): ScopedSemanticDependencyExpectation {
  return {
    scopeId: "test:keqing-guide-scope",
    manifestSha256: EXPECTED_MANIFEST_SHA256,
    scopeProjectionSha256: EXPECTED_SCOPE_PROJECTION_SHA256,
  };
}

function authenticationInput(
  raw = structuredClone(RAW_RECORDS),
  repository = structuredClone(REPOSITORY_RECORDS),
): ScopedSemanticDependencyAuthenticationInput {
  return {
    ...derivationInput(raw, repository),
    expectation: expectation(),
  };
}

function candidate(
  result: ReturnType<typeof deriveScopedSemanticDependencyCandidate>,
): ScopedSemanticDependencyCandidateResult {
  if (result.status !== "candidate") {
    throw new Error(
      `Expected candidate; received ${result.issues.map(({ code }) => code).join(", ")}`,
    );
  }
  return result;
}

function accepted(
  result: ReturnType<typeof authenticateScopedSemanticDependencies>,
): ScopedSemanticDependencyAcceptedResult {
  if (result.status !== "accepted") {
    throw new Error(
      `Expected acceptance; received ${result.issues.map(({ code }) => code).join(", ")}`,
    );
  }
  return result;
}

function selectedPayload(
  result: ScopedSemanticDependencyAcceptedResult,
  dependencyId: string,
  key: string,
): ScopedSemanticJsonValue {
  const payload = result.selection.dependencies
    .find((dependency) => dependency.dependencyId === dependencyId)
    ?.entries.find((entry) => entry.key === key)?.payload;
  if (payload === undefined) throw new Error("Selected payload is missing.");
  return payload;
}

function hostileThrownValue(): object {
  const hostile = Object.create(null) as object;
  Object.defineProperty(hostile, "message", {
    get: () => {
      throw new Error("message getter boom");
    },
  });
  Object.defineProperty(hostile, Symbol.toPrimitive, {
    value: () => {
      throw new Error("string conversion boom");
    },
  });
  return hostile;
}
