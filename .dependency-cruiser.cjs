/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "scanner-formats-do-not-depend-on-companion",
      severity: "error",
      from: { path: "^src/providers/scanner/formats/" },
      to: { path: "^src/providers/scanner/companion/" },
    },
    {
      name: "generated-outputs-have-no-runtime-source-dependencies",
      severity: "error",
      from: { path: "^src/generated/" },
      to: {
        path: "^src/",
        pathNot: "^src/generated/",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "leaf-code-is-framework-free",
      severity: "error",
      from: { path: "^src/(lib|providers)/" },
      to: {
        path: "(^|node_modules/)(react|react-dom|react-router-dom|zustand)(/|$)",
      },
    },
    {
      name: "composition-is-at-the-top",
      severity: "error",
      from: { path: "^src/", pathNot: "^src/(app/|pages/|main\\.tsx$)" },
      to: { path: "^src/(app|pages)/" },
    },
    {
      name: "shared-ui-has-no-feature-or-layout-dependencies",
      severity: "error",
      from: { path: "^src/components/shared/" },
      to: { path: "^src/components/", pathNot: "^src/components/(shared|ui)/" },
    },
    {
      name: "layouts-have-no-feature-dependencies",
      severity: "error",
      from: { path: "^src/components/layout/" },
      to: {
        path: "^src/components/",
        pathNot: "^src/components/(shared|ui|layout)/",
      },
    },
    {
      name: "feature-components-are-isolated",
      severity: "error",
      from: {
        path: "^src/components/([^/]+)/",
        pathNot: "^src/components/(shared|ui|layout)/",
      },
      to: {
        path: "^src/components/([^/]+)/",
        pathNot: ["^src/components/$1/", "^src/components/(shared|ui|layout)/"],
      },
    },
    {
      name: "libraries-are-leaf-utilities",
      severity: "error",
      from: { path: "^src/lib/" },
      to: {
        path: "^src/(app|pages|components|hooks|contexts|providers|services|stores)/",
      },
    },
    {
      name: "libraries-use-domain-contracts-only",
      severity: "error",
      from: { path: "^src/lib/" },
      to: { path: "^src/domain/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "services-do-not-own-react-or-live-state",
      severity: "error",
      from: { path: "^src/services/" },
      to: {
        path: [
          "^src/(app|pages|components|hooks|contexts)/",
          "^src/stores/",
          "(^|node_modules/)(react|react-dom|react-router-dom|zustand)(/|$)",
        ],
        pathNot:
          "^src/stores/(schemas\\.ts|teamSchemas\\.ts|resourceSettingsSchemas\\.ts|migration/)",
      },
    },
    {
      name: "foundations-do-not-import-application-layers",
      severity: "error",
      from: { path: "^src/(config|generated|i18n)/" },
      to: {
        path: "^src/(app|pages|components|hooks|contexts|providers|services|stores)/",
      },
    },
    {
      name: "ui-primitives-are-independent",
      severity: "error",
      from: { path: "^src/components/ui/" },
      to: {
        path: "^src/",
        pathNot: ["^src/components/ui/", "^src/lib/utils\\.ts$"],
      },
    },
    {
      name: "stores-do-not-own-ui",
      severity: "error",
      from: { path: "^src/stores/" },
      to: {
        path: "^src/(components|pages|hooks|contexts|services|providers|app)/",
      },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: {
        circular: true,
        dependencyTypesNot: ["type-only"],
        viaOnly: { dependencyTypesNot: ["type-only"] },
      },
    },
    {
      name: "production-has-no-test-dependencies",
      severity: "error",
      from: { path: "^(src|worker)/" },
      to: {
        path: [
          "^tests/",
          "(^|node_modules/)(vitest|@vitest|@testing-library|@playwright)(/|$)",
          "^node:test$",
          "^cloudflare:test$",
        ],
      },
    },
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: {},
      to: { couldNotResolve: true, pathNot: "^cloudflare:test$" },
    },
    {
      name: "domain-is-framework-free",
      severity: "error",
      from: { path: "^src/domain/" },
      to: {
        path: [
          "^src/(components|contexts|hooks|pages|providers|stores|services|app)/",
          "(^|node_modules/)(react|react-dom|react-router-dom|zustand)(/|$)",
        ],
      },
    },
    {
      name: "providers-do-not-own-ui-or-state",
      severity: "error",
      from: { path: "^src/providers/" },
      // A pure format migration is shared by persistence and account import.
      to: {
        path: "^src/(components|contexts|hooks|pages|stores|services|app)/",
      },
    },
    {
      name: "persisted-state-cannot-see-hoyolab-auth",
      severity: "error",
      from: { path: "^src/(stores/|services/backup/)" },
      to: { path: "^src/providers/hoyolab/" },
    },
    {
      name: "browser-has-no-node-builtins",
      severity: "error",
      from: { path: "^src/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "worker-is-standalone",
      severity: "error",
      from: { path: "^worker/" },
      to: { path: ["^src/", "^tests/", "^scripts/"] },
    },
    {
      name: "browser-cannot-import-worker-or-tooling",
      severity: "error",
      from: { path: "^src/" },
      to: { path: ["^worker/", "^scripts/"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.app.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main", "types", "typings"],
    },
    // Keep imported package nodes visible to framework/test-dependency rules.
    // doNotFollow stops traversal into their internals.
    exclude: { path: ["^dist(/|$)", "^coverage(/|$)", "\\.d\\.ts$"] },
  },
};
