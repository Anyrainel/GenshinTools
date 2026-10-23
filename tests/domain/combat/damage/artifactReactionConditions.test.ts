import "@/providers/reference/statLoaders";
import "@/domain/combat/damage/index";
import { beforeAll, describe, expect, it } from "vitest";
import { getArchaicPetraElements } from "@/domain/combat/damage/artifactConditions";
import {
  createArtifactSet,
  getOptionDef,
  isChoiceEnabled,
} from "@/domain/combat/damage/core/registry";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import type { TeamSlotConfig } from "@/domain/combat/damage/types";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";

beforeAll(() =>
  Promise.all([characterStatsResource.preload(), weaponStatsResource.preload()])
);

describe("Archaic Petra activation", () => {
  it("does not grant the screenshot's Electro carry a bonus without Geo", () => {
    const configs: TeamSlotConfig[] = [
      ["varesa", "skyward_atlas"],
      ["nicole", "skyward_atlas"],
      ["durin", "favonius_sword"],
      ["chevreuse", "favonius_lance"],
    ].map(([charId, weaponId]) => ({
      charId,
      weaponId,
      charLevel: 90,
      constellation: 0,
      refinement: 1,
      artifactSet: null,
    }));
    const baseline = new TeamBuild(configs);
    const equipped = new TeamBuild(
      configs.map((config) =>
        config.charId === "durin"
          ? { ...config, artifactSet: { type: "4pc", setId: "archaic_petra" } }
          : config
      )
    );
    const ctx = {
      enemyLevel: 110,
      enemyRes: 10,
      rollMultiplier: 0.85,
      substatBudget: "8_6" as const,
    };
    const tag = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    expect(
      equipped.getTeamStats({}, "varesa", ctx).varesa.get("dmg%", tag)
    ).toBe(baseline.getTeamStats({}, "varesa", ctx).varesa.get("dmg%", tag));
    const def = getOptionDef("archaic_petra")!;
    expect(
      def.choices
        .filter((choice) => isChoiceEnabled(choice, equipped.teamMeta))
        .map((choice) => choice.value)
    ).toEqual(["none"]);
  });

  it("allows a non-Geo wearer to collect a teammate's shard and selects one element", () => {
    const team = new TeamMeta(["zhongli", "bennett", "fischl"]);
    expect(getArchaicPetraElements(team, "bennett")).toEqual([
      "Pyro",
      "Electro",
    ]);
    const petra = createArtifactSet("archaic_petra", "bennett", team, {
      archaic_petra: "Electro",
    });
    expect(petra.buffs).toHaveLength(1);
    expect(petra.buffs[0].target.filter?.elements).toEqual(["Electro"]);
    expect(petra.buffs[0].staticBuffs).toEqual([{ key: "dmg%", value: 0.35 }]);
    expect(
      createArtifactSet("archaic_petra", "bennett", team, {
        archaic_petra: "none",
      }).buffs
    ).toEqual([]);
  });

  it("requires a shard aura and honors a persistent external aura", () => {
    expect(getArchaicPetraElements(new TeamMeta(["zhongli"]))).toEqual([]);
    const external = new TeamMeta(["zhongli", "bennett"], {}, {}, "Cryo");
    expect(getArchaicPetraElements(external, "bennett")).toEqual(["Cryo"]);
    const petra = createArtifactSet("archaic_petra", "bennett", external, {
      archaic_petra: "Pyro",
    });
    expect(petra.buffs[0].target.filter?.elements).toEqual(["Cryo"]);
    expect(
      getArchaicPetraElements(new TeamMeta(["bennett"], {}, {}, "Geo"))
    ).toEqual([]);
    expect(
      createArtifactSet(
        "archaic_petra",
        "bennett",
        new TeamMeta(["bennett"], {}, {}, "Hydro")
      ).buffs
    ).toEqual([]);
  });

  it("requires the wearer to trigger Lunar-Crystallize instead of collecting a nonexistent Hydro shard", () => {
    const team = new TeamMeta(["zhongli", "columbina", "bennett"]);
    expect(team.hasReaction("lunarCrystallize")).toBe(true);
    expect(getArchaicPetraElements(team, "zhongli")).toEqual(["Pyro", "Hydro"]);
    expect(getArchaicPetraElements(team, "bennett")).toEqual(["Pyro"]);
    expect(
      createArtifactSet("archaic_petra", "bennett", team, {
        archaic_petra: "Hydro",
      }).buffs
    ).toEqual([]);
    const petra = createArtifactSet("archaic_petra", "zhongli", team, {
      archaic_petra: "Hydro",
    });
    expect(petra.buffs[0].source.triggers).toEqual(["lunarCrystallize"]);
    expect(petra.buffs[0].target.filter?.elements).toEqual(["Hydro"]);
    const onlyLunar = new TeamMeta(["zhongli", "columbina", "nahida"]);
    expect(
      createArtifactSet("archaic_petra", "nahida", onlyLunar).buffs
    ).toEqual([]);
  });
});

describe("reaction-dependent artifact activation audit", () => {
  it.each(["instructor", "gilded_dreams"])(
    "requires %s wearer participation",
    (setId) => {
      expect(
        createArtifactSet(
          setId,
          "bennett",
          new TeamMeta(["bennett", "xiangling"])
        ).buffs
      ).toEqual([]);
      expect(
        createArtifactSet(setId, "nahida", new TeamMeta(["nahida", "kaeya"]))
          .buffs
      ).toEqual([]);
      // Applying Pyro cannot trigger Crystallize or Swirl on Geo/Anemo.
      expect(
        createArtifactSet(
          setId,
          "bennett",
          new TeamMeta(["bennett", "zhongli", "sucrose"])
        ).buffs
      ).toEqual([]);
      expect(
        createArtifactSet(setId, "bennett", new TeamMeta(["bennett", "fischl"]))
          .buffs.length
      ).toBeGreaterThan(0);
      expect(
        createArtifactSet(
          setId,
          "bennett",
          new TeamMeta(["bennett", "xiangling"], {}, {}, "Hydro")
        ).buffs.length
      ).toBeGreaterThan(0);
      expect(
        createArtifactSet(
          setId,
          "columbina",
          new TeamMeta(["columbina", "fischl"])
        ).buffs.length
      ).toBeGreaterThan(0);
    }
  );

  it("lets VV shred a persistent enemy aura without inventing other swirled elements", () => {
    const team = new TeamMeta(["sucrose", "bennett"], {}, {}, "Hydro");
    const vv = createArtifactSet("viridescent_venerer", "sucrose", team);
    const shred = vv.buffs.find((buff) =>
      buff.staticBuffs.some((entry) => entry.key === "resReduction%")
    );
    expect(shred?.target.filter?.elements).toEqual(["Hydro"]);
    const wrongWearer = createArtifactSet(
      "viridescent_venerer",
      "bennett",
      team
    );
    expect(
      wrongWearer.buffs.some((buff) =>
        buff.staticBuffs.some((entry) => entry.key === "resReduction%")
      )
    ).toBe(false);
  });

  it("does not grant Scroll bonuses for Dendro + Cryo, and still supports real reactions", () => {
    const setId = "scroll_of_the_hero_of_cinder_city";
    expect(
      createArtifactSet(setId, "nahida", new TeamMeta(["nahida", "kaeya"]))
        .buffs
    ).toEqual([]);
    expect(
      createArtifactSet(
        setId,
        "nahida",
        new TeamMeta(["nahida", "kaeya"], {}, {}, "Cryo")
      ).buffs
    ).toEqual([]);
    const scroll = createArtifactSet(
      setId,
      "nahida",
      new TeamMeta(["nahida", "fischl"])
    );
    expect(scroll.buffs[0].target.filter?.elements).toEqual([
      "Dendro",
      "Electro",
    ]);
  });

  it("requires an available Lunar reaction before Night grants CR", () => {
    const setId = "night_of_the_skys_unveiling";
    const cr = (team: TeamMeta) =>
      createArtifactSet(setId, "columbina", team)
        .buffs.flatMap((buff) => buff.staticBuffs)
        .find((entry) => entry.key === "cr")?.value ?? 0;
    expect(cr(new TeamMeta(["columbina", "aino"]))).toBe(0);
    expect(cr(new TeamMeta(["columbina", "fischl"]))).toBe(0.15);
    expect(cr(new TeamMeta(["columbina", "aino", "fischl"]))).toBe(0.3);
  });
});
