import { describe, expect, it } from "vitest";
import { runtimeModuleSpecifiers } from "./runtimeImports";

describe("guide source runtime dependency extraction", () => {
  it("keeps value and side-effect imports while excluding erased imports", () => {
    expect(
      runtimeModuleSpecifiers(
        `
      import "./side-effect";
      import {} from "./empty-runtime";
      import Value from "./default";
      import * as Namespace from "./namespace";
      import { type Erased, Value as Named } from "./mixed";
      import type DefaultType from "./type-default";
      import type * as TypeNamespace from "./type-namespace";
      import { type ErasedOnly } from "./inline-type-only";
    `,
        "fixture.ts",
      ),
    ).toEqual([
      "./side-effect",
      "./empty-runtime",
      "./default",
      "./namespace",
      "./mixed",
    ]);
  });

  it("preserves declaration-level source export guards", () => {
    expect(
      runtimeModuleSpecifiers(
        `
      export * from "./star";
      export { Value } from "./named";
      export { type Erased } from "./inline-export-source";
      export type * from "./type-star";
      export type { Type } from "./type-named";
    `,
        "fixture.ts",
      ),
    ).toEqual(["./star", "./named", "./inline-export-source"]);
  });

  it("finds literal dynamic imports in nested code and rejects computed paths", () => {
    expect(
      runtimeModuleSpecifiers(
        `
      async function load(name: string) {
        await import("./literal");
        await import(\`./template\`);
        await import(name);
        await import(\`./dynamic-\${name}\`);
        await import("./with-options", { with: { type: "json" } });
      }
    `,
        "fixture.ts",
      ),
    ).toEqual(["./literal", "./template"]);
  });

  it("fails loudly for source that cannot be parsed", () => {
    expect(() => runtimeModuleSpecifiers("import {", "broken.ts")).toThrow();
  });
});
