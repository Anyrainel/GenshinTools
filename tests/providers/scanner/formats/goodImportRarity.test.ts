import { describe, expect, it } from "vitest";
import {
  convertGOODToAccountData,
  type GOODData,
  type IGOODArtifact,
} from "@/providers/scanner/formats/goodConversion";

const piece = (
  setKey: string,
  rarity: number,
  location = ""
): IGOODArtifact => ({
  setKey,
  rarity,
  location,
  slotKey: "flower",
  level: 0,
  mainStatKey: "hp",
  lock: false,
  substats: [],
});
const file = (artifacts: IGOODArtifact[]): GOODData => ({
  format: "GOOD",
  version: 3,
  source: "GGScanner",
  artifacts,
});

describe("GOOD import rarity selection", () => {
  it("ignores both equipped and unequipped four-star copies by default", () => {
    const result = convertGOODToAccountData(
      file([
        piece("GladiatorsFinale", 4),
        piece("GladiatorsFinale", 4, "Amber"),
        piece("GladiatorsFinale", 5),
        piece("Instructor", 4),
      ])
    );
    expect(result.data.extraArtifacts.map((a) => [a.setKey, a.rarity])).toEqual(
      [
        ["gladiators_finale", 5],
        ["instructor", 4],
      ]
    );
    expect(result.data.characters).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("retains four-star copies and their equipment locations when enabled", () => {
    const result = convertGOODToAccountData(
      file([
        piece("GladiatorsFinale", 4),
        piece("GladiatorsFinale", 4, "Amber"),
        piece("Instructor", 4),
      ]),
      undefined,
      { keepFourStarOfFiveStarSets: true }
    );
    expect(result.data.extraArtifacts.map((a) => a.rarity)).toEqual([4, 4]);
    expect(
      result.data.characters.find((c) => c.key === "amber")?.artifacts.flower
        ?.rarity
    ).toBe(4);
  });
});
