import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson } from "../src/io";
import { SOURCE_SNAPSHOT_ROOT } from "../src/paths";
import { ManualObservationSnapshotSchema } from "../src/schemas";

const SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-klee-manual.json",
);

describe("KQM Klee Luna IV manual snapshot", () => {
  it("keeps scoped equipment claims separate and omits ER recommendations", async () => {
    const snapshot = ManualObservationSnapshotSchema.parse(
      await readJson(SNAPSHOT_PATH),
    );

    expect(snapshot.page).toMatchObject({
      title: "Klee Quick Guide",
      url: "https://keqingmains.com/q/klee-quickguide/",
      sourceVersion: "Luna IV",
    });
    expect(snapshot.records).toHaveLength(7);
    expect(
      snapshot.records.every(
        ({ extraction }) => extraction.reviewStatus === "unreviewed",
      ),
    ).toBe(true);

    const guides = snapshot.records.filter(
      (record) => record.kind === "character_guide",
    );
    expect(guides).toHaveLength(5);
    expect(
      guides.flatMap(({ recommendation }) =>
        recommendation.substats?.flatMap(({ statIds }) => statIds) ?? [],
      ),
    ).not.toContain("er");

    const artifacts = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "klee-on-field-contextual-artifact-sets-luna-iv",
    );
    expect(artifacts?.recommendation).toMatchObject({
      artifactOrdering: "unranked",
      artifactRecommendations: [
        {
          artifacts: [
            { type: "4pc", setId: "a_day_carved_from_rising_winds" },
          ],
          classification: "default",
        },
        {
          artifacts: [
            { type: "4pc", setId: "crimson_witch_of_flames" },
          ],
          classification: "conditional",
        },
        {
          artifacts: [{ type: "4pc", setId: "marechaussee_hunter" }],
          classification: "conditional",
        },
        {
          artifacts: [
            { type: "4pc", setId: "night_of_the_skys_unveiling" },
          ],
          classification: "conditional",
        },
        {
          artifacts: [{ type: "4pc", setId: "unfinished_reverie" }],
          classification: "conditional",
        },
      ],
    });

    const fiveStar = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "klee-generalist-best-five-star-weapon-luna-iv",
    );
    const fourStar = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "klee-generalist-best-four-star-weapon-luna-iv",
    );
    expect(fiveStar?.recommendation.weaponRecommendations).toEqual([
      expect.objectContaining({ weaponIds: ["reliquary_of_truth"] }),
    ]);
    expect(fourStar?.recommendation.weaponRecommendations).toEqual([
      expect.objectContaining({ weaponIds: ["the_widsith"] }),
    ]);

    const support = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "klee-c2-off-field-support-equipment-luna-iv",
    );
    expect(support?.recommendation).toMatchObject({
      minConstellation: 2,
      roles: ["support"],
      weaponRecommendations: [
        {
          weaponIds: [
            "thrilling_tales_of_dragon_slayers",
            "wandering_evenstar",
          ],
          grouping: "alternatives",
        },
      ],
      artifactRecommendations: [
        {
          artifacts: [{ type: "4pc", setId: "instructor" }],
        },
      ],
    });
  });

  it("preserves exact teams while leaving Klee Combo unresolved", async () => {
    const snapshot = ManualObservationSnapshotSchema.parse(
      await readJson(SNAPSHOT_PATH),
    );
    const teams = snapshot.records.filter((record) => record.kind === "team");

    expect(teams).toHaveLength(2);
    expect(
      teams.map(({ members }) =>
        members.map(({ characterId }) => characterId),
      ),
    ).toEqual([
      ["klee", "chevreuse", "durin", "fischl"],
      ["klee", "furina", "albedo", "xilonen"],
    ]);
    for (const team of teams) {
      expect(team).toMatchObject({
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "unordered",
      });
      expect(team.rotations).toHaveLength(1);
      expect(team.rotations[0].unresolvedSegments).toContain("Klee Combo");
      expect(
        team.members.every(
          ({ weaponRecommendations, artifactRecommendations, erTargets }) =>
            weaponRecommendations.length === 0 &&
            artifactRecommendations.length === 0 &&
            erTargets.length === 0,
        ),
      ).toBe(true);
    }
  });
});
