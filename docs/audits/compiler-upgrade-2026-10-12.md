# Compiler and Worker upgrade validation — 2026-10-12

GenshinTools migrated to TypeScript 7.0.2, Vite 8.3.4, Vitest 5.0.3,
Wrangler 4.149.0, Cloudflare Vite plugin 1.63.1 and Workers Vitest plugin
1.4.0. Compiler-API consumers use Babel parser/types 8 instead of a retained
older TypeScript compiler. React plugin 6.1.2 and Vite's Oxc transform preserve
the existing class-registration decorators with `decorator.legacy: true` in
the app and app-test configurations.

## Worker validation

- All 50 Worker tests pass with the new Workers Vitest plugin and MSW 3.0.3 /
  `@msw/cloudflare` 0.2.0.
- Outbound Enka, HoYoLAB and Logto JWKS mocks use MSW. Successful proxy tests
  exercise `exports.default.fetch()`. Rejected requests retain assertions that
  no upstream request occurred. Auth/session, backup and migrated D1 tests
  retain their existing assertions and fixtures.
- Worker, Worker-test and Node configuration type checks pass with TypeScript 7.
- Wrangler-generated bindings/runtime declarations pass the existing drift
  check. The redundant generic Workers type dependency is removed.
- Worker configuration, production APIs, persisted data and authentication
  behavior were not changed by this migration scope.

## Existing broader script typing errors

The `tsconfig.scripts.json` check retains exactly seven baseline errors, with
no additional errors:

- `scripts/dev/check-artifact-set-roles.ts:17`: string argument does not match
  the artifact-set ID union (TS2345).
- `scripts/er_calc_cli.ts:47`: missing generated energy `presetRotations.js`
  module (TS2307).
- `scripts/er_calc_cli.ts:78`: string does not match `ParticleMode` (TS2322).
- `scripts/er_calc_cli.ts:79`: string does not match `CalcMode` (TS2322).
- `scripts/kSweepReal.ts:12`: unresolved duplicated `formats/formats`
  scanner-conversion path (TS2307).
- `scripts/kSweepReal.ts:89`: callback parameter `n` is implicitly `any`
  (TS7006).
- `scripts/kSweepReal.ts:89`: callback parameter `c` is implicitly `any`
  (TS7006).

## Script repair follow-up — 2026-10-12

The seven broader script typing errors were reproduced and repaired. Artifact
role coverage now compares string IDs without narrowing the coverage checker to
the generated catalog union; the K-sweep benchmark imports the current scanner
conversion owner, restoring inference for its character reduction.

The ER CLI's bundled preset module had been deleted in an earlier ER refactor.
Its preset/fuzz commands also assumed the retired array timeline format. The
CLI now supports explicit `run-json` input using the current `actions` and
`periodic` timeline, validates calculation/particle modes, and reports retired
commands clearly. An executable regression covers successful calculation and
invalid-mode rejection. `type-check:scripts` is now included in the ordinary
type-check gate, and the CLI regression runs with tooling tests.

## References

- [Cloudflare Workers Vitest migration](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-to-vitest-plugin/)
- [Cloudflare MSW integration](https://developers.cloudflare.com/workers/testing/vitest-integration/mock-outbound-requests/)
- [Vite 8 migration](https://vite.dev/guide/migration.html)
- [Oxc TypeScript and decorator transforms](https://oxc.rs/docs/guide/usage/transformer/typescript)
