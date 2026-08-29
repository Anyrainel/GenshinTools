import { describe, expect, it } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import { readJson } from "../src/io";
import {
  loadManualSnapshotInputs,
  requiredManualSnapshotInputContaining,
} from "../src/manualSnapshots";
import {
  MANUAL_SNAPSHOT_INDEX_PATH,
  SOURCE_REGISTRY_PATH,
} from "../src/paths";
import { ManualObservationSnapshotSchema } from "../src/schemas";
import { validateManualObservationSnapshot } from "../src/validation";

describe("KQM Kokomi pilot", () => {
  it("captures one conditional artifact delegation without inventing ER, ranks, or combo details", async () => {
    const manualInputs = await loadManualSnapshotInputs(
      await readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      await readJson(SOURCE_REGISTRY_PATH),
    );
    const input = requiredManualSnapshotInputContaining(
      manualInputs,
      "kqm",
      "kokomi-on-field-nod-krai-artifact-delegation-luna-v",
    );
    const snapshot = ManualObservationSnapshotSchema.parse(input.snapshot);

    expect(snapshot.page).toMatchObject({
      title: "Kokomi Quick Guide",
      sourceVersion: "Luna V",
    });
    expect(snapshot.records).toHaveLength(2);
    expect(
      snapshot.records.some(({ kind }) => kind === "energy_guidance"),
    ).toBe(false);

    const guide = snapshot.records.find(
      (record) =>
        record.kind === "character_guide" &&
        record.sourceRecordId ===
          "kokomi-on-field-nod-krai-artifact-delegation-luna-v",
    );
    expect(guide).toMatchObject({
      kind: "character_guide",
      characterId: "sangonomiya_kokomi",
      recommendation: {
        id: "on-field-nod-krai-artifact-delegation",
        scope: "artifact-sets",
        artifactOrdering: "unranked",
        artifactRecommendations: [
          {
            artifacts: [
              { type: "4pc", setId: "silken_moons_serenade" },
            ],
            grouping: "single",
            classification: "conditional",
            conditions: expect.arrayContaining([
              expect.stringContaining("on-field"),
              expect.stringContaining("well-invested"),
              expect.stringContaining("Aubade"),
            ]),
          },
        ],
      },
    });

    const team = snapshot.records.find(
      (record) =>
        record.kind === "team" &&
        record.sourceRecordId ===
          "kokomi-ineffa-columbina-sucrose-lunar-charged-example",
    );
    expect(team).toMatchObject({
      kind: "team",
      intent: "example",
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      reactions: ["lunarCharged"],
    });
    if (!team || team.kind !== "team") {
      throw new Error("Missing Kokomi Lunar-Charged example team.");
    }

    expect(team.members.map(({ characterId }) => characterId)).toEqual([
      "sangonomiya_kokomi",
      "ineffa",
      "columbina",
      "sucrose",
    ]);
    expect(
      team.members.flatMap(({ erTargets }) => erTargets),
    ).toEqual([]);

    const kokomi = team.members[0];
    expect(kokomi.artifactOrdering).toBe("unranked");
    expect(kokomi.artifactRecommendations).toEqual([
      expect.objectContaining({
        artifacts: [{ type: "4pc", setId: "oceanhued_clam" }],
        classification: "recommended",
      }),
      expect.objectContaining({
        artifacts: [{ type: "4pc", setId: "silken_moons_serenade" }],
        classification: "conditional",
        conditions: [expect.stringContaining("well-invested")],
      }),
    ]);

    const columbina = team.members[2];
    expect(columbina.artifactOrdering).toBe("unranked");
    expect(columbina.artifactRecommendations).toEqual([
      expect.objectContaining({
        artifacts: [
          {
            type: "4pc",
            setId: "aubade_of_morningstar_and_moon",
          },
        ],
        classification: "conditional",
        conditions: [expect.stringContaining("well-invested")],
      }),
    ]);

    expect(team.artifactPlans).toEqual([
      {
        id: "well-invested-columbina-artifact-delegation",
        label: "Kokomi SMS with Columbina Aubade",
        classification: "conditional",
        conditions: ["Columbina is well-invested."],
        assignments: [
          {
            characterId: "sangonomiya_kokomi",
            artifact: {
              type: "4pc",
              setId: "silken_moons_serenade",
            },
          },
          {
            characterId: "columbina",
            artifact: {
              type: "4pc",
              setId: "aubade_of_morningstar_and_moon",
            },
          },
        ],
      },
    ]);

    expect(team.rotations).toEqual([
      expect.objectContaining({
        id: "sample-rotation",
        notation:
          "Kokomi E > Columbina EQ > Ineffa E (Q) > Sucrose ED (Q) N1 > Kokomi Q combo > Sucrose N3",
        unresolvedSegments: [
          "Ineffa E (Q)",
          "Sucrose ED (Q)",
          "Kokomi Q combo",
        ],
        assumptions: expect.arrayContaining([
          expect.stringContaining("only if they are available"),
          expect.stringContaining("rather than specifying the exact attack sequence"),
        ]),
      }),
    ]);
    expect(team.unknowns).toEqual(
      expect.arrayContaining([
        expect.stringContaining("exact Kokomi Burst attack combo"),
        expect.stringContaining("well-invested Columbina"),
        expect.stringContaining("default artifact set"),
        expect.stringContaining("weapons and refinements"),
        expect.stringContaining("rotation duration"),
        expect.stringContaining("formula mappings"),
        expect.stringContaining("enemy scenario"),
      ]),
    );

    expect(
      validateManualObservationSnapshot(
        snapshot,
        await loadGameCatalogs(),
        "kqm",
      ),
    ).toEqual([]);
  });
});
