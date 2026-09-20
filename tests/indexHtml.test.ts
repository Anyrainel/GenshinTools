import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("application root translation policy", () => {
  it("allows browser translation of the application", () => {
    const html = fs.readFileSync(path.resolve("index.html"), "utf8");

    expect(html).toMatch(/<div id="root"><\/div>/);
    expect(html).not.toMatch(/\btranslate=["']no["']/);
    expect(html).not.toContain("notranslate");
  });
});
