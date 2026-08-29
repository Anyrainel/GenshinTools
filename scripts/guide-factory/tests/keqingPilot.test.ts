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

describe("KQM Keqing pilot", () => {
  it("captures an old-character team refresh without widening strict roles or adding ER targets", async () => {
    const manualInputs = await loadManualSnapshotInputs(
      await readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      await readJson(SOURCE_REGISTRY_PATH),
    );
    const input = requiredManualSnapshotInputContaining(
      manualInputs,
      "kqm",
      "keqing-team-template-lunar-charged",
    );
    const snapshot = ManualObservationSnapshotSchema.parse(input.snapshot);

    expect(snapshot.page).toMatchObject({ sourceVersion: "Luna I" });
    expect(snapshot.records).toHaveLength(3);
    expect(
      snapshot.records.some(({ kind }) => kind === "energy_guidance"),
    ).toBe(false);

    const template = snapshot.records.find(
      (record) => record.kind === "team_template",
    );
    expect(template?.kind === "team_template" ? template.slots : []).toEqual([
      expect.objectContaining({
        options: [{ type: "characters", characterIds: ["keqing"] }],
      }),
      expect.objectContaining({
        options: [{ type: "characters", characterIds: ["ineffa"] }],
      }),
      expect.objectContaining({
        options: [
          { type: "roles", roleIds: ["off-field-hydro-applier"] },
        ],
        highlightedOptions: [{ type: "elements", elements: ["hydro"] }],
      }),
      expect.objectContaining({
        options: [{ type: "roles", roleIds: ["resistance-shred"] }],
        highlightedOptions: [
          { type: "elements", elements: ["anemo"] },
          { type: "characters", characterIds: ["xilonen"] },
        ],
      }),
    ]);
    expect(template).toMatchObject({
      exhaustiveness: "unspecified",
      rankingClaim: "none",
      reactions: ["lunarCharged"],
    });

    const exactTeams = snapshot.records.flatMap((record) =>
      record.kind === "team" ? [record] : [],
    );
    expect(exactTeams).toHaveLength(2);
    expect(
      exactTeams.flatMap(({ members }) =>
        members.flatMap(({ erTargets }) => erTargets),
      ),
    ).toEqual([]);
    expect(
      exactTeams.every(
        ({ exhaustiveness, rankingClaim }) =>
          exhaustiveness === "unspecified" && rankingClaim === "none",
      ),
    ).toBe(true);
    expect(
      exactTeams.every(({ members }) =>
        members.every(
          ({ weaponRecommendations, artifactRecommendations }) =>
            weaponRecommendations.length === 0 &&
            artifactRecommendations.length === 0,
        ),
      ),
    ).toBe(true);

    const furinaTeam = exactTeams.find(({ members }) =>
      members.some(({ characterId }) => characterId === "furina"),
    );
    expect(furinaTeam?.members.map(({ characterId }) => characterId)).toEqual([
      "keqing",
      "ineffa",
      "furina",
      "xilonen",
    ]);
    expect(furinaTeam).toMatchObject({
      reactions: ["lunarCharged"],
    });
    expect(furinaTeam?.rotations).toEqual([
      expect.objectContaining({
        id: "sample-rotation",
        notation:
          "(Furina ED) > Ineffa E > Xilonen EQ N2 > Furina Q > Keqing EQE 5[N1C] > Xilonen E N2 > Ineffa Q > Keqing EE 3[N1C]",
        assumptions: [
          expect.stringContaining("subsequent rotations"),
        ],
      }),
      expect.objectContaining({
        id: "sample-rotation-max-shield-uptime",
        notation:
          "Ineffa (Q) E > Furina ED Q > Xilonen EQ N2 > Keqing EQE 5[N1C] > Xilonen E N2",
        assumptions: [expect.stringContaining("whenever it is available")],
      }),
    ]);

    const ainoTeam = exactTeams.find(({ members }) =>
      members.some(({ characterId }) => characterId === "aino"),
    );
    expect(ainoTeam?.members.map(({ characterId }) => characterId)).toEqual([
      "keqing",
      "ineffa",
      "aino",
      "sucrose",
    ]);
    expect(ainoTeam?.rotations).toEqual([
      expect.objectContaining({
        notation:
          "Ineffa E (Q) > Aino EQ > Sucrose ED (Q) > Keqing EQE 5[N1C] > Sucrose N2",
        assumptions: expect.arrayContaining([
          expect.stringContaining("every other rotation"),
        ]),
      }),
    ]);

    expect(
      validateManualObservationSnapshot(
        snapshot,
        await loadGameCatalogs(),
        "kqm",
      ),
    ).toEqual([]);
  });
});
