import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readJson } from "../src/io";
import { SOURCE_SNAPSHOT_ROOT } from "../src/paths";
import {
  ManualObservationSnapshotSchema,
  type ManualObservationSnapshot,
} from "../src/schemas";

const SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-itto-manual.json",
);

let snapshot: ManualObservationSnapshot;

beforeAll(async () => {
  snapshot = ManualObservationSnapshotSchema.parse(
    await readJson(SNAPSHOT_PATH),
  );
});

describe("KQM Itto Version 5.6 manual snapshot", () => {
  it("keeps seven narrow observations unreviewed and source-attributed", () => {
    expect(snapshot.page).toMatchObject({
      title: "Itto Quick Guide",
      url: "https://keqingmains.com/q/itto-quickguide/",
      publisher: "KeqingMains",
      sourceVersion: "Version 5.6",
    });
    expect(snapshot.capturedAt).toBe("2026-08-29");
    expect(snapshot.records).toHaveLength(7);
    expect(new Set(snapshot.records.map(({ sourceRecordId }) => sourceRecordId)))
      .toHaveProperty("size", 7);
    expect(
      snapshot.records.every(
        ({ extraction }) =>
          extraction.method === "agent-assisted" &&
          extraction.reviewStatus === "unreviewed",
      ),
    ).toBe(true);
  });

  it("captures only the offensive artifact-stat tail after the omitted ER need", () => {
    const record = snapshot.records.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "itto-on-field-artifact-stats-version-5-6",
    );
    if (!record || record.kind !== "character_guide") {
      throw new Error("Missing Itto artifact-stat observation.");
    }

    expect(record.characterId).toBe("arataki_itto");
    expect(record.recommendation).toMatchObject({
      scope: "artifact-stats",
      mainStats: {
        sands: [{ statIds: ["def%"] }],
        goblet: [
          { statIds: ["geo%"] },
          {
            statIds: ["def%"],
            conditions: [
              "Itto is used as an on-field DPS.",
              expect.stringContaining("Xilonen Double Geo team with Furina"),
            ],
          },
        ],
        circlet: [{ statIds: ["cr", "cd"] }],
      },
      substats: [
        { statIds: ["cr", "cd"], priority: 1 },
        { statIds: ["def%"], priority: 2 },
        { statIds: ["atk%"], priority: 3 },
      ],
    });
    expect(
      record.recommendation.substats?.every(({ conditions }) =>
        conditions.some((condition) => condition.includes("omitted")),
      ),
    ).toBe(true);
    expect(
      record.recommendation.mainStats?.goblet.every(
        ({ priority }) => priority == null,
      ),
    ).toBe(true);

    const statIds = [
      ...Object.values(record.recommendation.mainStats ?? {}).flatMap(
        (recommendations) =>
          recommendations.flatMap(({ statIds: ids }) => ids),
      ),
      ...(record.recommendation.substats?.flatMap(({ statIds: ids }) => ids) ??
        []),
    ];
    expect(statIds).not.toContain("er");
    expect(record.recommendation.erTargets).toBeUndefined();
    expect(
      snapshot.records.some(({ kind }) => kind === "energy_guidance"),
    ).toBe(false);
  });

  it("preserves contextual set and weapon conditions without inventing ranks", () => {
    const guides = snapshot.records.filter(
      (record) => record.kind === "character_guide",
    );
    expect(guides).toHaveLength(3);

    const sets = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "itto-contextual-artifact-sets-version-5-6",
    );
    expect(sets?.recommendation).toMatchObject({
      artifactOrdering: "unranked",
      artifactRecommendations: [
        {
          artifacts: [{ type: "4pc", setId: "husk_of_opulent_dreams" }],
          classification: "default",
        },
        {
          artifacts: [{ type: "4pc", setId: "marechaussee_hunter" }],
          classification: "conditional",
          conditions: ["Itto is played in a team with Furina."],
        },
        {
          artifacts: [{ type: "4pc", setId: "retracing_bolide" }],
          classification: "available-only",
          conditions: ["A good Retracing Bolide set is already owned."],
        },
        {
          artifacts: [{ type: "4pc", setId: "long_nights_oath" }],
          classification: "conditional",
          conditions: ["Itto is played in a Plunge composition with Xianyun."],
        },
      ],
    });

    const weapons = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "itto-contextual-weapons-version-5-6",
    );
    expect(weapons?.recommendation.weaponOrdering).toBe("unranked");
    expect(
      weapons?.recommendation.weaponRecommendations?.map(
        ({ weaponIds }) => weaponIds,
      ),
    ).toEqual([
      ["redhorn_stonethresher"],
      ["serpent_spine"],
      ["whiteblind"],
      ["fruitful_hook"],
    ]);
    expect(
      weapons?.recommendation.weaponRecommendations?.at(-1),
    ).toMatchObject({
      classification: "conditional",
      conditions: [
        "Itto is played in a Plunge composition with Xianyun and Furina.",
      ],
    });
  });

  it("separates the PHEC template and exact examples with only Xilonen C2 bounded", () => {
    const template = snapshot.records.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "itto-xilonen-double-geo-template-version-5-6",
    );
    if (!template || template.kind !== "team_template") {
      throw new Error("Missing Itto Xilonen Double Geo template.");
    }
    expect(template).toMatchObject({
      label: "Itto — Xilonen — PHEC — PHEC",
      intent: "prescriptive",
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      slots: [
        {
          id: "itto",
          options: [
            { type: "characters", characterIds: ["arataki_itto"] },
          ],
        },
        {
          id: "xilonen",
          options: [{ type: "characters", characterIds: ["xilonen"] }],
        },
        {
          id: "phec-1",
          options: [
            {
              type: "elements",
              elements: ["pyro", "hydro", "electro", "cryo"],
            },
          ],
        },
        {
          id: "phec-2",
          options: [
            {
              type: "elements",
              elements: ["pyro", "hydro", "electro", "cryo"],
            },
          ],
        },
      ],
      reactions: ["crystallize"],
    });

    const teams = snapshot.records.filter((record) => record.kind === "team");
    expect(teams).toHaveLength(3);
    expect(
      teams
        .slice(0, 2)
        .map(({ locator }) => ("heading" in locator ? locator.heading : null)),
    ).toEqual([
      "Teams > Xilonen Double Geo > Example Teams > Itto — Xilonen — Furina — Yelan / Xingqiu",
      "Teams > Xilonen Double Geo > Example Teams > Itto — Xilonen — Furina — Yelan / Xingqiu",
    ]);
    expect(
      teams.map(({ members }) =>
        members.map(({ characterId }) => characterId),
      ),
    ).toEqual([
      ["arataki_itto", "xilonen", "furina", "yelan"],
      ["arataki_itto", "xilonen", "furina", "xingqiu"],
      ["arataki_itto", "xilonen", "gorou", "furina"],
    ]);

    for (const team of teams) {
      expect(team).toMatchObject({
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "none",
        rotations: [],
      });
      expect(
        team.members.every(
          ({ weaponRecommendations, artifactRecommendations, erTargets }) =>
            weaponRecommendations.length === 0 &&
            artifactRecommendations.length === 0 &&
            erTargets.length === 0,
        ),
      ).toBe(true);
    }

    const c2Team = teams.find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "itto-c2-xilonen-gorou-furina-example-version-5-6",
    );
    const xilonen = c2Team?.members.find(
      ({ characterId }) => characterId === "xilonen",
    );
    expect(xilonen).toMatchObject({
      characterId: "xilonen",
      minConstellation: 2,
    });
    expect(xilonen).not.toHaveProperty("constellation");
    expect(xilonen).not.toHaveProperty("maxConstellation");
    expect(
      teams
        .flatMap(({ members }) => members)
        .filter((member) => member !== xilonen)
        .every(
          (member) =>
            member.constellation == null &&
            member.minConstellation == null &&
            member.maxConstellation == null,
        ),
    ).toBe(true);
  });
});
