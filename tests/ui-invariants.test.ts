import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import baseline from "./fixtures/ui-invariants-baseline.json";
import { collectUiViolations, findUiViolations } from "./helpers/uiInvariants";

describe("shared UI invariants", () => {
  it("rejects stock source drift rather than adding visual debt allowances", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shadcn-drift-"));
    try {
      fs.mkdirSync(path.join(root, "docs/audits"), { recursive: true });
      fs.mkdirSync(path.join(root, "src/components/ui"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "docs/audits/shadcn-stock.json"),
        JSON.stringify({
          components: [
            { path: "src/components/ui/button.tsx", sha256: "wrong" },
          ],
        })
      );
      fs.writeFileSync(
        path.join(root, "src/components/ui/button.tsx"),
        "changed"
      );
      expect(() => collectUiViolations(root)).toThrow(
        "Stock shadcn source drift: src/components/ui/button.tsx"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects new violations without changing existing visual debt", () => {
    const root = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      ".."
    );
    const allowed: Record<string, number> = baseline;
    const violations = Object.entries(collectUiViolations(root)).filter(
      ([key, count]) => count > (allowed[key] ?? 0)
    );
    expect(
      violations,
      "Use palette tokens / complete class mappings. Do not expand the legacy baseline."
    ).toEqual([]);
  });

  it("detects forbidden styles in literals, template fragments and adjacent CSS", () => {
    const source =
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source fixture for the AST guard
      'const a = "text-muted-foreground/50 bg-[#ff0000]"; const b = `bg-tier-${tier}/70 border-border/40`;';
    expect(findUiViolations(source, "Example.tsx")).toEqual([
      "muted-opacity text-muted-foreground/50",
      "literal-color #ff0000",
      "muted-opacity border-border/40",
      "interpolated-utility bg-tier-",
    ]);
    expect(
      findUiViolations(
        ".panel { color: rgb(12 34 56); } /* #fff */",
        "Example.css"
      )
    ).toEqual(["literal-color rgb(12 34 56)"]);
    expect(
      findUiViolations('const a = "text-element-" + element;', "Example.ts")
    ).toContain("interpolated-utility text-element-");
  });

  it("accepts semantic tokens, static mappings and CSS variables", () => {
    expect(
      findUiViolations(
        'const map = { S: "bg-tier-s/70", A: "bg-tier-a/70" }; const a = "bg-primary/20 text-foreground border-border"; const b = "rgb(var(--chart-color))";',
        "Example.ts"
      )
    ).toEqual([]);
  });
});

import fs from "node:fs";
import os from "node:os";
