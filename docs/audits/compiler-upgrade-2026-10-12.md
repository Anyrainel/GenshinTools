# Compiler and Worker upgrade validation — 2026-10-12

GenshinTools migrated to TypeScript 7.0.2, Vite 8.3.4, Vitest 5.0.3,
Wrangler 4.149.0, Cloudflare Vite plugin 1.63.1 and Workers Vitest plugin
1.4.0. Compiler-API consumers use Babel parser/types 8 instead of a retained
older TypeScript compiler. React plugin 6.1.2 and Vite's Oxc transform preserve
the existing class-registration decorators with `decorator.legacy: true` in
the app, app-test and standalone guide-factory configurations.

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

## Guide-factory compiler consumers

Ten tests no longer import the TypeScript compiler API. Shared Babel parsing
and traversal replace duplicated runtime-import extraction; first-party path
resolution and exact declared dependency-closure assertions remain in their
existing tests. Four new extraction regressions cover value/side-effect/type
imports, declaration-level export guards, literal versus computed dynamic
imports, and invalid syntax.

The Noelle investment test retains independent structural authentication of
the four-part normal entry, exact object keys and English label, four
`DirectFormula` constructors, exact `this.param("A", 1..4)` calls, and the
same class's default charge combo with count 3. The migrated assertion callback
and its helpers were extracted unchanged into an ignored, isolated test harness
to exercise this guard despite its suite's pre-existing authenticated-input
failure. All three validations passed:

1. The current implementation satisfies the structural assertions.
2. Changing the fourth normal parameter from 4 to 5 is rejected.
3. Changing the default charge combo count from 3 to 2 is rejected.

No authenticated reports, pinned hashes or game implementations were rewritten.

| Guide-factory suite | Passed tests | Failed tests | Skipped tests | Failed / passed files |
| --- | ---: | ---: | ---: | --- |
| Pre-upgrade baseline | 858 | 63 | 149 | 32 / 74 |
| After migration | 862 | 63 | 149 | 32 / 75 |

The four added tests account for the increased passing count. Existing failures
remain outside the required app/Worker checks. Baseline/current counts were
recorded; a failure-by-failure log comparison was unavailable after unrelated
Playwright runs cleared the default `test-results` directory. Playwright output
directories were subsequently separated by the owning agents.

## Existing broader script typing errors

The `tsconfig.scripts.json` check retains exactly seven baseline errors, with
no new guide-test errors:

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

## References

- [Cloudflare Workers Vitest migration](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-to-vitest-plugin/)
- [Cloudflare MSW integration](https://developers.cloudflare.com/workers/testing/vitest-integration/mock-outbound-requests/)
- [Vite 8 migration](https://vite.dev/guide/migration.html)
- [Oxc TypeScript and decorator transforms](https://oxc.rs/docs/guide/usage/transformer/typescript)
