import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const implDir = resolve(__dirname, "../../../src/lib/team-comp/impl");
const implFiles = readdirSync(implDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({
    name: f,
    content: readFileSync(resolve(implDir, f), "utf-8"),
  }));

describe("trigger naming validation", () => {
  it('should use "elemental-dmg" instead of "elemental-damage"', () => {
    const violations: string[] = [];
    for (const file of implFiles) {
      // Match trigger arrays containing "elemental-damage"
      const regex = /triggers:\s*\[([^\]]*"elemental-damage"[^\]]*)\]/g;
      for (
        let match = regex.exec(file.content);
        match !== null;
        match = regex.exec(file.content)
      ) {
        const line = file.content.slice(0, match.index).split("\n").length;
        violations.push(`${file.name}:${line}`);
      }
    }
    expect(
      violations,
      `Found "elemental-damage" trigger (use "elemental-dmg" instead):\n  ${violations.join("\n  ")}`
    ).toHaveLength(0);
  });

  it('should use "lunar-reaction" umbrella instead of listing all 3 lunar reactions individually', () => {
    const lunarReactions = ["lunarCharged", "lunarBloom", "lunarCrystallize"];
    const violations: string[] = [];
    for (const file of implFiles) {
      // Match trigger arrays (in cbs/wbs calls and inline triggers: [...])
      const regex =
        /(?:triggers:\s*|[cw]bs\(this,\s*(?:"[^"]*",\s*)?)(\[[^\]]*\])/g;
      for (
        let match = regex.exec(file.content);
        match !== null;
        match = regex.exec(file.content)
      ) {
        const bracket = match[1]!;
        const items = [...bracket.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
        // Only flag when all 3 lunar reactions appear and there are no other
        // non-lunar reactions — if mixed with other reactions, the individual
        // names are intentional provenance.
        if (!lunarReactions.every((lr) => items.includes(lr))) continue;
        const nonLunar = items.filter((i) => !lunarReactions.includes(i));
        if (nonLunar.length > 0) continue;
        const line = file.content.slice(0, match.index).split("\n").length;
        violations.push(`${file.name}:${line}`);
      }
    }
    expect(
      violations,
      `Found all 3 lunar reactions listed individually in triggers (use "lunar-reaction" instead):\n  ${violations.join("\n  ")}`
    ).toHaveLength(0);
  });
});
