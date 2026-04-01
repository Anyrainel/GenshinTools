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

  it("no two keys should have identical zh and en labels (reuse the same key instead)", () => {
    const leafEntries: { key: string; en: string; zh: string }[] = [];

    function collectLeaves(obj: Record<string, unknown>, prefix = "") {
      for (const k in obj) {
        const value = obj[k];
        const newKey = prefix ? `${prefix}.${k}` : k;
        if (
          value &&
          typeof value === "object" &&
          "en" in value &&
          "zh" in value
        ) {
          leafEntries.push({
            key: newKey,
            en: (value as { en: string }).en,
            zh: (value as { zh: string }).zh,
          });
        } else if (value && typeof value === "object") {
          collectLeaves(value as Record<string, unknown>, newKey);
        }
      }
    }

    collectLeaves(i18nUiData as unknown as Record<string, unknown>);

    const seen = new Map<string, string>(); // "en||zh" -> first key
    const duplicates: string[] = [];

    for (const { key, en, zh } of leafEntries) {
      const signature = `${en}||${zh}`;
      const existing = seen.get(signature);
      if (existing) {
        duplicates.push(
          `"${key}" and "${existing}" both have en="${en}", zh="${zh}"`
        );
      } else {
        seen.set(signature, key);
      }
    }

    if (duplicates.length > 0) {
      console.error(
        "Duplicate i18n entries (reuse a single key instead):\n",
        duplicates.join("\n")
      );
    }
    expect(duplicates).toEqual([]);
  });

  it("all i18nUiData keys should be used in the codebase", () => {
    // Explicit exclusions for keys referenced dynamically (not caught by regex/string search)
    const allowedIgnoredKeys = new Set<string>([
      // Weapon choice keys — UI components added in upcoming tasks
      "teamComp.tabWeaponChoice",
      "teamComp.weaponChoiceDesc",
      "teamComp.weaponChoiceRun",
      "teamComp.weaponChoiceRunning",
      "teamComp.weaponChoiceRanking",
      "teamComp.weaponChoiceConfig",
      "teamComp.weaponChoiceBest",
      // Greeting keys — UI components added in upcoming tasks
      "greeting.welcomeTitle",
      "greeting.welcomeSubtitle",
      "greeting.getStarted",
      "greeting.importTitle",
      "greeting.importDesc",
      "greeting.importGoodLabel",
      "greeting.importUidLabel",
      "greeting.importLater",
      "greeting.openImport",
      "greeting.accountOverviewTitle",
      "greeting.accountOverviewDesc",
      "greeting.previewCharacters",
      "greeting.previewInventory",
      "greeting.previewRecommendations",
      "greeting.previewEvaluation",
      "greeting.previewTriage",
      "greeting.customizeTitle",
      "greeting.customizeDesc",
      "greeting.customizeBenefitScoring",
      "greeting.customizeBenefitRecommendations",
      "greeting.customizeBenefitLock",
      "greeting.teamsTitle",
      "greeting.teamsDesc",
      "greeting.teamsOverviewTitle",
      "greeting.teamsOverviewDesc",
      "greeting.previewDamage",
      "greeting.previewFrozen",
      "greeting.previewInvestment",
      "greeting.previewWeapon",
      "greeting.helpTitle",
      "greeting.helpDesc",
      "greeting.helpMenuHint",
      "greeting.letsGo",
      "greeting.newsTitle",
      "greeting.viewFullHistory",
    ]);

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
