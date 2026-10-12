# Repository architecture

This is the authoritative folder and dependency contract for both GGStarRail
and GenshinTools. It supersedes older general project-layout descriptions.
The repositories implement this contract independently: no cross-repository
runtime imports, data, assets, stores, migrations, engines, or credentials.
Game-mechanics design documents describe their subsystem internals; this
contract governs where those subsystems live and what they may depend on.

## Target layout

```text
src/
  main.tsx                 Browser bootstrap only
  index.css                Global theme/style entry
  vite-env.d.ts            Vite/browser environment declarations
  app/                     Routes, metadata, providers and feature composition
  config/                  Product constants, navigation, palettes, public settings
  domain/                  Canonical models, validation and pure game rules
    account/               Account records, identities, equipment and merges
    build/                 Build configuration, scoring and equipment selection
    team/                  User-authored team plans and canonical team models
    combat/                Game-specific simulation, optimization and kits
    resources/             Resource planning rules
    tier-list/             Priority/ranking models and transformations
  providers/               External schemas, transports and normalization
    reference/             Generated-catalog loaders and provider definitions
    scanner/               Scanner formats and conversion to canonical records
    scanner-manager/       Companion protocol schemas and transport
    auth/                  Authentication client transport
    community/             Feedback/comments transport
    <source>/              Game-specific sources (Enka, HoYoLAB, etc.)
  services/                Application workflows combining domain and providers
    catalog/               Loaded catalog views, display/picker models
    builds/                Build import/export and application presentation
    backup/                Validated persistence-envelope import/export
    combat/                Catalog/account resolution, jobs and browser worker
    auth/                  Browser sign-in navigation workflow
    scanner-manager/       Apply verified companion results to canonical records
    navigation/            Cross-feature links and URL construction
    content/               Load and parse maintained player-facing content
  lib/                     Reusable, framework-free/platform utilities
    assets/                Asset URLs, lookup injection and fallbacks
    game/                  Text/number/version/color formatting
    search/                Generic search and filter predicates
    security/              Credential rejection and diagnostic redaction
    theme/                 Theme contracts, palettes and DOM application
    utils.ts               Shared class-name composition for UI primitives
  stores/                  Zustand state, persistence envelopes and store actions
    migration/             Historical schemas and compatible hydration transforms
  contexts/                React providers for app state and browser integrations
  hooks/                   React adapters to state, services and browser facilities
  i18n/                    Typed UI catalogs, terms and localization context
  components/
    ui/                    Stock/base primitives; only ui siblings and lib/utils
    shared/                Reusable controls and presentation across features
    layout/                Page shells, navigation chrome and action slots
    account/               Import and account-access feature UI
    account-data/          Owned inventory and resource feature UI
    builds/                Build-configuration feature UI
    team-analysis/         Team simulation/comparison/optimization feature UI
    archive/               Reference browsing feature UI
    tier-list/             Ranking feature UI
    home/                  Home and onboarding feature UI
  pages/                   Route compositions, grouped by matching feature
  content/                 Maintained prose (e.g. bilingual update history)
  data/                    Generated/checked static game inputs only
  generated/               Generated reference inputs; never hand-edit
  presets/                 Bundled user configuration examples and defaults
worker/                    Independent server entry, handlers and platform helpers
tests/                     Tests grouped by source ownership; shared fixtures/helpers
scripts/                   Executable tooling; workflow-specific supporting modules
docs/                      Architecture, operational contracts and mechanic designs
```

Only create a folder when it owns real modules. Game concepts may differ
(Character/Weapon/Artifact versus Character/Light Cone/Relic), but their layer,
feature grouping and dependency direction must match. Existing URL paths do
not have to match folder names and must not change merely because code moves.
Genshin's Energy model can be a combat subsystem; HSR Energy and Skill Points
stay in its battle timeline. Server bindings and persistence namespaces remain
product-specific.

## Ownership and dependencies

- `app` and `pages` compose features. `app` owns route registration and global
  feature actions; a layout receives actions/dialog renderers as slots.
- `domain` owns current canonical meaning and pure game behavior. It may use
  leaf utilities, public constants and validation libraries, never providers,
  services, persisted state, browser/framework APIs, or UI.
- `providers` own external DTOs, network/protocol calls and normalization into
  canonical models. They depend on domain, leaf utilities and public constants,
  never UI, hooks, contexts, services or live Zustand stores.
- `services` combine domain and providers and own application-facing view/job
  models. They never import components, hooks, contexts, pages or live stores.
  A workflow receives user state as input and returns data/results to its caller.
- `lib` contains reusable utilities, not application workflows or transports.
  It may consume canonical type contracts, config and localization types;
  domain runtime behavior belongs to domain/services rather than lib. It must
  not depend on providers, services, stores, React UI or feature modules.
- `stores` own persistence envelopes and actions, not canonical game models.
  Store logic uses domain/library functions, not services, providers or UI.
  `contexts` and `hooks` connect state and services to React; neither imports pages.
- UI dependency direction is `ui -> shared -> layout/feature -> pages/app` when
  describing which layers build on the previous layer. Imports flow backward:
  primitives use leaf utilities, shared uses primitives, and features use shared.
  Shared never imports layout/feature components; layout never imports features;
  feature components never import another feature's components or route pages.
  Move genuinely reusable controls into shared; inject feature actions into layouts.
- `config`, `data`, `generated` and `presets` are foundations. Config may refer
  to typed localization keys and canonical type contracts; generated inputs and
  presets do not import executable app layers. Localization owns its React
  context but does not depend on feature UI or routes.
- Browser code never imports Node built-ins, Worker code or tooling. `worker`
  never imports browser code, tests or scripts. Background browser workers belong
  beside the service that owns their job protocol, not in the server directory.

## Persistence compatibility boundary

Pure persistence schemas and historical decoders remain in `stores` and
`stores/migration`. Backup services may use those schemas/decoders, never live
store hooks. GGStarRail's native scanner format also carries historical account
snapshots: its provider may use the pure `stores/migration/account` decoder.
This is a specific format-compatibility boundary, not permission to depend on
store state. The decoder must stay independent of runtime store actions and UI.
Canonical team models live in `domain/team`; the team persistence envelope stays
in `stores`. Moving a module does not change a schema version, storage key,
saved default, unit, ID or import/export contract.

## Source-of-truth rules

Import each implementation directly from its owner. Do not leave re-export
shims at old paths. Shared data types belong to their consuming model layer,
not a UI module or an unrelated persisted envelope. Types follow the same
ownership rules as runtime imports; type-only dependencies are not a loophole
for UI/service/store coupling. `lib` may reference domain contracts as types,
but may not invoke domain runtime behavior.

Keep current state schemas separate from historical migration schemas. Preserve
all supported old hydration/import formats and partial-import semantics. Keep
credential material request-local and out of persistence, URLs, logs and errors.
Generated files remain owned by their producing scripts; moving consuming code
does not authorize editing generated data or packaging a new data release.

## Enforcement and validation

Dependency-cruiser gates all browser, test and Worker modules. Common rules
cover cycles, unresolved imports, test dependencies, layer direction, UI feature
isolation, browser/server separation and Node built-ins. Imported package nodes
must remain visible while their internals are not traversed. Negative fixtures
must prove that each architectural boundary rejects a forbidden import.
Do not expand an architectural exception or UI debt baseline to pass a refactor.

Commits gate types, lint, dependency boundaries, relevant tests and conventions.
Pushes gate the full validated, clean and unchanged commit. CI and cloud builds
repeat the validation independently. A structural migration is complete only
when all callers use their new owners, the dependency graph passes, old paths
are removed, persistence/import regressions pass and affected routes work at
desktop and narrow widths. Validate with each repository's own scripts and do
not deploy or push without authorization.

## Migration status

This is the approved target. GenshinTools code migration is deferred until the
user gives the go-ahead after Star Rail validation. Existing source paths in
mechanic documents remain implementation references during that transition.
In particular, dmgcalc/ercalc move to domain/combat; import/client adapters move
to providers; orchestration/cloud workflows move to services; UI/app/game
localization splits into i18n and generated reference inputs. Do not start this
migration while the current feature work is in progress.
