import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson } from "../src/io";
import { SOURCE_SNAPSHOT_ROOT } from "../src/paths";
import { ManualObservationSnapshotSchema } from "../src/schemas";

const SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-noelle-manual.json",
);

describe("KQM Noelle Luna VIII manual snapshot", () => {
  it("keeps general build claims separate from the exact Hexerei team", async () => {
    const snapshot = ManualObservationSnapshotSchema.parse(
      await readJson(SNAPSHOT_PATH),
    );

    expect(snapshot.page).toMatchObject({
      title: "Noelle Quick Guide",
      url: "https://keqingmains.com/q/noelle-quickguide/",
      sourceVersion: "Luna VIII",
    });
    expect(snapshot.records).toHaveLength(5);
    expect(
      snapshot.records.every(
        ({ extraction }) => extraction.reviewStatus === "unreviewed",
      ),
    ).toBe(true);

    const team = snapshot.records.find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "noelle-durin-nicole-xilonen-hexerei-example-luna-viii",
    );
    if (!team || team.kind !== "team") {
      throw new Error("Missing Noelle Hexerei exact-team observation.");
    }
    expect(team).toMatchObject({
      intent: "example",
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      members: [
        { characterId: "noelle" },
        { characterId: "durin" },
        { characterId: "nicole" },
        { characterId: "xilonen" },
      ],
      rotations: [
        {
          id: "sample-rotation-xilonen",
          notation:
            "Nicole (Q)¹E > Durin EEQ > Xilonen EN2 > Noelle EQ 2[N3D] N2 > Xilonen EN2 > Noelle N3D N2",
          unresolvedSegments: [],
          assumptions: [
            "Use Nicole's parenthesized Burst only when it is available.",
          ],
        },
      ],
    });
    expect(
      team.members.every(
        ({ weaponRecommendations, artifactRecommendations, erTargets }) =>
          weaponRecommendations.length === 0 &&
          artifactRecommendations.length === 0 &&
          erTargets.length === 0,
      ),
    ).toBe(true);
  });

  it("preserves the two offensive stat branches without adding ER data", async () => {
    const snapshot = ManualObservationSnapshotSchema.parse(
      await readJson(SNAPSHOT_PATH),
    );
    const guides = snapshot.records.filter(
      (record) => record.kind === "character_guide",
    );
    expect(guides).toHaveLength(4);

    const gest = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "noelle-hexerei-gest-luna-viii",
    );
    expect(gest?.recommendation).toMatchObject({
      weaponOrdering: "unranked",
      weaponRecommendations: [
        {
          weaponIds: ["gest_of_the_mighty_wolf"],
          classification: "conditional",
          conditions: ["Noelle is played in a Hexerei team."],
        },
      ],
    });

    const husk = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId === "noelle-general-husk-luna-viii",
    );
    expect(husk?.recommendation).toMatchObject({
      artifactOrdering: "unranked",
      artifactRecommendations: [
        {
          artifacts: [
            { type: "4pc", setId: "husk_of_opulent_dreams" },
          ],
          classification: "default",
        },
      ],
    });

    const early = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "noelle-c0-c5-talent-9-artifact-stats-luna-viii",
    );
    const late = guides.find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "noelle-c6-or-talent-10-artifact-stats-luna-viii",
    );
    expect(early?.recommendation).toMatchObject({
      mainStats: {
        sands: [{ statIds: ["atk%"] }],
        goblet: [{ statIds: ["geo%"] }],
        circlet: [{ statIds: ["cr", "cd"] }],
      },
      substats: [
        { statIds: ["cr", "cd"], priority: 1 },
        { statIds: ["atk%"], priority: 2 },
        { statIds: ["def%"], priority: 3 },
      ],
    });
    expect(late?.recommendation).toMatchObject({
      mainStats: {
        sands: [{ statIds: ["def%"] }],
        goblet: [{ statIds: ["geo%"] }, { statIds: ["def%"] }],
        circlet: [
          { statIds: ["cr", "cd"] },
          { statIds: ["def%"] },
        ],
      },
      substats: [
        { statIds: ["cr", "cd"], priority: 1 },
        { statIds: ["def%"], priority: 2 },
        { statIds: ["atk%"], priority: 3 },
      ],
    });
    expect(
      guides.flatMap(({ recommendation }) =>
        recommendation?.substats?.flatMap(({ statIds }) => statIds) ?? [],
      ),
    ).not.toContain("er");
  });
});
