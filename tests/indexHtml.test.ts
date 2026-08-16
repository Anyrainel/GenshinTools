import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("application root translation policy", () => {
  it("prevents browser translators from rewriting React-owned DOM", () => {
    const html = fs.readFileSync(path.resolve("index.html"), "utf8");

    expect(html).toMatch(
      /<div id="root" class="notranslate" translate="no"><\/div>/
    );
  });
});
