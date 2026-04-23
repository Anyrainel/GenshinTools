/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── Baseline hygiene ────────────────────────────────────────────────
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular dependencies between modules are forbidden, except for " +
        "cycles entirely within src/lib/dmgcalc/ (allowed during the " +
        "ongoing domain internal refactor). Cycles that cross the dmgcalc " +
        "boundary are still flagged on their outbound edge.",
      from: {},
      to: { circular: true, pathNot: "^src/lib/dmgcalc/" },
    },
    {
      name: "no-orphans",
      severity: "error",
      comment:
        "Files that nothing imports. Entry points, configs, tests, and ETL " +
        "scripts are exempt via pathNot below.",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$", // dotfiles
          "(^|/)(vite|vitest|playwright|tailwind|postcss|biome)\\.config\\.(js|ts|mjs|cjs)$",
          "(^|/)src/main\\.tsx$",
          "(^|/)src/vite-env\\.d\\.ts$",
          "(^|/)src/App\\.tsx$",
          "(^|/)tests/setup\\.ts$",
          "(^|/)tests/.*\\.test\\.(ts|tsx)$",
          "(^|/)tests/regression/.*\\.ts$",
          "(^|/)tests/benchmark/.*\\.ts$",
          "(^|/)tests/fixtures/",
          "(^|/)functions/",
          "(^|/)scripts/",
        ],
      },
      to: {},
    },

    // ── src must not leak into test-only deps ───────────────────────────
    {
      name: "src-no-test-deps",
      severity: "error",
      comment:
        "src/ must not import vitest, @testing-library, or any test-only package. " +
        "Those belong to tests/ only.",
      from: { path: "^src/" },
      to: {
        path: [
          "^vitest(/|$)",
          "^@vitest/",
          "^@testing-library/",
          "^@playwright/",
          "^node:test(/|$)",
        ],
      },
    },
    {
      name: "src-no-tests-dir",
      severity: "error",
      comment:
        "src/ must not import from tests/ — production code is tests-agnostic.",
      from: { path: "^src/" },
      to: { path: "^tests/" },
    },

    // ── Layering within src/ ────────────────────────────────────────────
    // Layer order (low → high):
    //   data / presets  <  lib  <  stores / contexts  <  hooks  <  components  <  pages
    //
    // A lower layer must never import from a higher layer. Lateral imports
    // inside the same layer are allowed.
    {
      name: "data-is-foundation",
      severity: "error",
      comment:
        "src/data/ is the foundation layer — types, constants, static JSON. " +
        "It must not depend on any other src/ layer.",
      from: { path: "^src/data/" },
      to: {
        path: [
          "^src/lib/",
          "^src/stores/",
          "^src/contexts/",
          "^src/hooks/",
          "^src/components/",
          "^src/pages/",
          "^src/presets/",
          "^src/config/",
        ],
      },
    },
    {
      name: "presets-is-foundation",
      severity: "error",
      comment:
        "src/presets/ are bundled JSONs / tables — no UI, lib, stores, or hooks.",
      from: { path: "^src/presets/" },
      to: {
        path: [
          "^src/lib/",
          "^src/stores/",
          "^src/contexts/",
          "^src/hooks/",
          "^src/components/",
          "^src/pages/",
          "^src/config/",
        ],
      },
    },
    {
      name: "lib-is-pure",
      severity: "error",
      comment:
        "src/lib/ is pure logic — no React UI, no Zustand stores, no hooks, no contexts.",
      from: { path: "^src/lib/" },
      to: {
        path: [
          "^src/components/",
          "^src/pages/",
          "^src/stores/",
          "^src/hooks/",
          "^src/contexts/",
        ],
      },
    },
    {
      name: "lib-shared-no-domain",
      severity: "error",
      comment:
        "Shared lib/ (core algorithms, generic utilities) must not depend on " +
        "domain-specific lib/ folders. Domain folders are: account-data/, " +
        "artifact-builds/, team-comp/. Logic flows domain → shared, never " +
        "the reverse.",
      from: {
        path: "^src/lib/",
        pathNot: "^src/lib/(account-data|artifact-builds|team-comp)/",
      },
      to: { path: "^src/lib/(account-data|artifact-builds|team-comp)/" },
    },
    {
      name: "stores-no-ui",
      severity: "error",
      comment:
        "src/stores/ are Zustand state only — they must not import UI " +
        "(components, pages) nor hooks (which depend on stores).",
      from: { path: "^src/stores/" },
      to: {
        path: ["^src/components/", "^src/pages/", "^src/hooks/"],
      },
    },
    {
      name: "contexts-no-pages",
      severity: "error",
      comment: "src/contexts/ provide state — they must not import pages.",
      from: { path: "^src/contexts/" },
      to: { path: "^src/pages/" },
    },
    {
      name: "hooks-no-pages",
      severity: "error",
      comment: "src/hooks/ must not import pages.",
      from: { path: "^src/hooks/" },
      to: { path: "^src/pages/" },
    },
    {
      name: "components-no-pages",
      severity: "error",
      comment: "Pages compose components — not the other way around.",
      from: { path: "^src/components/" },
      to: { path: "^src/pages/" },
    },

    // ── Layering inside src/components/ ─────────────────────────────────
    // Order (low → high):
    //   ui/ (shadcn primitives)  <  shared/  <  layout/  <  {domain}/
    //
    // Domains are isolated from each other — cross-domain sharing goes
    // through shared/.
    {
      name: "ui-is-shadcn-primitive",
      severity: "error",
      comment:
        "src/components/ui/ are primitive components (shadcn and small " +
        "extensions). They must be self-contained: no other components, no " +
        "stores, no contexts, no domain logic. Allowed src/ imports: the cn() " +
        "helper from src/lib/utils, and the useMediaQuery hook (needed by " +
        "responsive-dialog to pick Dialog vs Drawer).",
      from: { path: "^src/components/ui/" },
      to: {
        path: "^src/",
        pathNot: [
          "^src/components/ui/",
          "^src/lib/utils\\.(ts|tsx)$",
          "^src/hooks/useMediaQuery\\.(ts|tsx)$",
        ],
      },
    },
    {
      name: "shared-no-domain-no-layout",
      severity: "error",
      comment:
        "src/components/shared/ are cross-domain building blocks. They may use " +
        "ui/ primitives, but must not depend on layout/ (which composes shared) " +
        "or on any domain-specific component.",
      from: { path: "^src/components/shared/" },
      to: {
        path: "^src/components/",
        pathNot: ["^src/components/ui/", "^src/components/shared/"],
      },
    },
    {
      name: "layout-no-domain",
      severity: "error",
      comment:
        "src/components/layout/ (AppBar, PageLayout, SidebarLayout, …) are " +
        "app-shell scaffolding. They may use ui/ and shared/, but must never " +
        "import domain-specific components.",
      from: { path: "^src/components/layout/" },
      to: {
        path: "^src/components/",
        pathNot: [
          "^src/components/ui/",
          "^src/components/shared/",
          "^src/components/layout/",
        ],
      },
    },
    {
      name: "components-no-cross-domain",
      severity: "error",
      comment:
        "Domain component folders (account-data, team-comp, tier-list, " +
        "archive, artifact-builds, artifact-manager, greeting, …) must be " +
        "isolated from each other. Cross-domain sharing goes through shared/. " +
        "Exceptions: (1) src/components/greeting/previews/* compose snapshots " +
        "of other domains — that's the feature, so they're exempt from the " +
        "`from` side. (2) account-data/CharacterCard.tsx and " +
        "account-data/BuildCard.tsx may be imported by other domains (archive " +
        "borrows them); they're conceptually shared but kept in account-data/ " +
        "for now.",
      from: {
        path: "^src/components/([^/]+)/",
        pathNot: [
          "^src/components/(ui|shared|layout)/",
          "^src/components/greeting/previews/",
        ],
      },
      to: {
        path: "^src/components/([^/]+)/",
        pathNot: [
          "^src/components/$1/",
          "^src/components/(ui|shared|layout)/",
          "^src/components/account-data/(CharacterCard|BuildCard)\\.tsx$",
        ],
      },
    },

    // ── Platform isolation ─────────────────────────────────────────────
    {
      name: "functions-standalone",
      severity: "error",
      comment:
        "Cloudflare Pages Functions (functions/api/*) run on Workers — " +
        "they must not import from src/, tests/, or scripts/.",
      from: { path: "^functions/" },
      to: { path: ["^src/", "^tests/", "^scripts/"] },
    },
    {
      name: "src-no-node-builtins",
      severity: "error",
      comment:
        "src/ runs in the browser — no Node built-ins (node:fs, node:path, etc.). " +
        "Move such code to scripts/ or functions/.",
      from: { path: "^src/" },
      to: {
        path: [
          "^(fs|path|os|child_process|crypto|http|https|stream|util|zlib|url)$",
          "^node:",
        ],
      },
    },
  ],

  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.app.json",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main", "types", "typings"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
      archi: {
        collapsePattern:
          "^(src/(data|presets|lib|stores|contexts|hooks|components|pages|config)/[^/]+|functions|tests|scripts)",
      },
    },
    exclude: {
      path: [
        "node_modules",
        "dist",
        "build",
        "coverage",
        "\\.d\\.ts$",
        "src-tauri",
        "e2e",
      ],
    },
  },
};
