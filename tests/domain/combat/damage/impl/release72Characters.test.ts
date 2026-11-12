import "@/providers/reference/statLoaders";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betaEnabled } from "@/config/beta";
import { createCharacter } from "@/domain/combat/damage/core/registry";
import { ScalingBuff } from "@/domain/combat/damage/core/statBuff";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import { characterStatsResource } from "@/domain/reference/stats";
import "@/domain/combat/damage/index";

beforeAll(async () => {
  vi.stubEnv("__BETA_ENABLED_OVERRIDE__", "false");
  expect(betaEnabled()).toBe(false);
  await characterStatsResource.preload();
});

afterAll(() => vi.unstubAllEnvs());

describe("official 7.2 talent parameters", () => {
  it.each([
    [0, 2.80568, 3.024, 4.032],
    [5, 3.399824, 3.57, 4.76],
  ])(
    "keeps Mitya's high plunge and both detonation hits distinct at C%i",
    (constellation, plunge, initial, beacon) => {
      const character = createCharacter(
        "mitya",
        90,
        constellation,
        new TeamMeta(["mitya"]),
        { mitya: "collapse" }
      );
      const high =
        character.getFormulaEntry("mitya-plunge-high")!.parts[0].formula;
      const first = character.getFormulaEntry("mitya-prism-detonation")!
        .parts[0].formula;
      const consumed = character.getFormulaEntry("mitya-prism-consume")!
        .parts[0].formula;
      expect(high.talentMultiplier).toBe(plunge);
      expect(high.tag.ability).toBe("plunge");
      expect(first.talentMultiplier).toBe(initial);
      expect(first.scalingKey).toBe("atk");
      expect(consumed.talentMultiplier).toBe(beacon);
      expect(consumed.scalingKey).toBe("em");
      expect(consumed.tag.reaction).toBe("stellarConduct");
    }
  );

  it.each([
    [0, 0.43776, 1.31328],
    [3, 0.5168, 1.5504],
    [4, 0.5168, 1.5504],
  ])(
    "scales Valeriy's Directive from its official damage row at C%i",
    (constellation, ordinary, stellar) => {
      const providerStats = new StatSheet([{ key: "baseAtk", value: 1000 }]);
      for (const [mode, talent, perPoint] of [
        ["normal", ordinary, 0.003],
        ["stellar", stellar, 0.009],
      ] as const) {
        for (const charge of [40, 100, 130]) {
          const character = createCharacter(
            "valeriy",
            90,
            constellation,
            new TeamMeta(
              mode === "stellar" ? ["valeriy", "mitya"] : ["valeriy"]
            ),
            { valeriy: String(charge) }
          );
          const directive = character.buffs.find(
            (buff) => buff.source.origin === "A/P2"
          );
          expect(directive).toBeInstanceOf(ScalingBuff);
          const consumed = Math.min(charge, constellation >= 4 ? 130 : 100);
          expect(
            directive!.dynamicBuffs(providerStats, [providerStats])[0]
          ).toEqual({
            key: "baseDmg",
            value: 1000 * (talent + consumed * perPoint),
          });
          expect(directive!.source.maxStacks).toBe(15);
          expect(directive!.target.filter?.reactions).toEqual(
            mode === "stellar" ? ["stellarConduct"] : undefined
          );
        }
      }
    }
  );

  it.each([
    [0, 3.15639],
    [3, 3.824802],
  ])(
    "reads high plunge instead of Directive duration at Valeriy C%i",
    (constellation, multiplier) => {
      const character = createCharacter(
        "valeriy",
        90,
        constellation,
        new TeamMeta(["valeriy"])
      );
      const formula = character.getFormulaEntry("valeriy-plunge-high")!.parts[0]
        .formula;
      expect(formula.talentMultiplier).toBe(multiplier);
      expect(formula.tag).toEqual({
        element: "Physical",
        ability: "plunge",
        reaction: "none",
      });
    }
  );
});
