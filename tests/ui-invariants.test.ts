import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import baseline from "./fixtures/ui-invariants-baseline.json";
import { collectUiViolations, findUiViolations } from "./helpers/uiInvariants";

describe("shared UI invariants", () => {
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
