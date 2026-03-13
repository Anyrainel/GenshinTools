import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { i18nUiData } from "../src/data/i18n-ui";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Flatten expected keys from i18nUiData
function getFlattenedKeys(
  obj: Record<string, unknown>,
  prefix = ""
): Set<string> {
  const keys = new Set<string>();
  for (const k in obj) {
    const value = obj[k];
    const newKey = prefix ? `${prefix}.${k}` : k;

    // Heuristic: if it has 'en' and 'zh' keys, it's a leaf node (translation entry)
    if (value && typeof value === "object" && "en" in value && "zh" in value) {
      keys.add(newKey);
    }
    // Otherwise recurse if it's an object
    else if (value && typeof value === "object") {
      const subKeys = getFlattenedKeys(
        value as Record<string, unknown>,
        newKey
      );
      subKeys.forEach((sk) => keys.add(sk));
    }
  }
  return keys;
}

const validUiKeys = getFlattenedKeys(
  i18nUiData as unknown as Record<string, unknown>
);

// 2. Scan codebase for usages
function scanCodebase(dir: string): {
  staticUsages: Set<string>;
  allFileContents: string;
} {
  const staticUsages = new Set<string>();
  let allFileContents = "";

  const files = fs.readdirSync(dir, { recursive: true }) as string[];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (!fs.statSync(fullPath).isFile()) continue;
    if (!/\.(tsx|ts)$/.test(file)) continue;
    // Skip the definition file itself to avoid self-match false positives
    if (fullPath.includes("i18n-app.ts") || fullPath.includes("i18n-ui.ts"))
      continue;

    const content = fs.readFileSync(fullPath, "utf-8");
    allFileContents = `${allFileContents}${content}\n`;

    // Regex for t.ui("literal") and t.format("literal")
    const regex = /t\.(?:ui|format)\(\s*(["'])([^"']+)\1/g;

    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex loop pattern
    while ((match = regex.exec(content)) !== null) {
      staticUsages.add(match[2]);
    }
  }

  return { staticUsages, allFileContents };
}

describe("i18n App Data Integrity", () => {
  const { staticUsages, allFileContents } = scanCodebase(
    path.resolve(__dirname, "../src")
  );

  it("all static t.ui() and t.format() calls should refer to existing keys", () => {
    const missingKeys: string[] = [];
    staticUsages.forEach((key) => {
      if (!validUiKeys.has(key)) {
        missingKeys.push(key);
      }
    });

    if (missingKeys.length > 0) {
      console.error("Found invalid i18n keys used in code:", missingKeys);
    }
    expect(missingKeys).toEqual([]);
  });

  it("no t.ui() or t.format() calls should use dynamic keys", () => {
    // Match t.ui(`...`) or t.format(`...`) — backtick means template literal
    const dynamicKeyRegex = /t\.(?:ui|format)\(\s*`/g;
    const violations: string[] = [];

    const files = fs.readdirSync(path.resolve(__dirname, "../src"), {
      recursive: true,
    }) as string[];

    for (const file of files) {
      const fullPath = path.join(path.resolve(__dirname, "../src"), file);
      if (!fs.statSync(fullPath).isFile()) continue;
      if (!/\.(tsx|ts)$/.test(file)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (dynamicKeyRegex.test(lines[i])) {
          violations.push(`${file}:${i + 1}: ${lines[i].trim()}`);
        }
        dynamicKeyRegex.lastIndex = 0;
      }
    }

    if (violations.length > 0) {
      console.error(
        "Dynamic i18n keys found (use static string literals instead):\n",
        violations.join("\n")
      );
    }
    expect(violations).toEqual([]);
  });

  it("all i18nUiData keys should be used in the codebase", () => {
    // Explicit exclusions for keys referenced dynamically (not caught by regex/string search)
    const allowedIgnoredKeys = new Set<string>();

    const unusedKeys: string[] = [];
    validUiKeys.forEach((key) => {
      if (allowedIgnoredKeys.has(key)) return;

      // Loose check: is the key string present anywhere in src/?
      if (!allFileContents.includes(key)) {
        unusedKeys.push(key);
      }
    });

    if (unusedKeys.length > 0) {
      console.error("Unused i18n keys:\n", JSON.stringify(unusedKeys, null, 2));
    }
    expect(unusedKeys).toEqual([]);
  });
});
