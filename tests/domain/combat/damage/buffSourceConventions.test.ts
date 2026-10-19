import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateOrigin } from "@/domain/combat/damage/core/statBuff";
import type { BuffSource } from "@/domain/combat/damage/types";
import { parseSourceAst, visitSourceAst } from "../../../helpers/sourceAst";

describe("buff source and activation vocabulary", () => {
  it.each(["passive", "A1", "A2", "A4", "A9"])(
    "rejects legacy provenance %s in origin and triggers",
    (legacy) => {
      expect(() =>
        validateOrigin({ type: "character", id: "test", origin: legacy })
      ).toThrow("legacy provenance");
      expect(() =>
        validateOrigin({
          type: "character",
          id: "test",
          origin: "P2",
          triggers: [legacy],
        })
      ).toThrow("not an activation condition");
    }
  );

  it.each(["P1", "P2", "C2", "R1", "P1/C2"])(
    "rejects provenance %s in activation labels",
    (provenance) => {
      expect(() =>
        validateOrigin({
          type: "character",
          id: "test",
          origin: "P2",
          triggers: ["Q", provenance],
        })
      ).toThrow("not an activation condition");
    }
  );

  it.each<BuffSource>([
    { type: "character", id: "test", origin: "P1", triggers: [] },
    { type: "character", id: "test", origin: "P2/C2", triggers: ["Q"] },
    { type: "character", id: "test", origin: "C2", triggers: ["E", "normal"] },
    { type: "character", id: "test", origin: "P4", triggers: ["Nightsoul"] },
    { type: "weapon", id: "test", origin: "R1", triggers: ["on-hit"] },
  ])("accepts distinct provenance and activation: $origin", (source) => {
    expect(() => validateOrigin(source)).not.toThrow();
  });

  it("contains no legacy provenance literals in any live implementation branch", () => {
    const implRoot = resolve(
      __dirname,
      "../../../../src/domain/combat/damage/impl"
    );
    const violations: string[] = [];
    // Scan the AST rather than comments, and include bespoke buffs / inactive
    // option branches that an instantiation sweep may never execute.
    for (const filename of readdirSync(implRoot).filter((name) =>
      name.endsWith(".ts")
    )) {
      const ast = parseSourceAst(
        readFileSync(resolve(implRoot, filename), "utf8"),
        filename
      );
      visitSourceAst(ast, (node) => {
        if (
          node.type === "StringLiteral" &&
          node.value.split("/").some((part) => /^(?:passive|A\d+)$/i.test(part))
        ) {
          violations.push(`${filename}:${node.loc?.start.line}: ${node.value}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
