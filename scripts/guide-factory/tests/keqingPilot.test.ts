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
  it("captures source-scoped Lunar-Charged roles and every named example without adding ER targets", async () => {
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
    expect(snapshot.records).toHaveLength(7);
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

    const roles = snapshot.records.flatMap((record) =>
      record.kind === "character_role" ? [record] : [],
    );
    expect(roles).toHaveLength(2);
    expect(roles.map(({ sourceRecordId }) => sourceRecordId)).toEqual([
      "keqing-lunar-charged-off-field-hydro-appliers",
      "keqing-lunar-charged-resistance-shred-options",
    ]);
    expect(
      roles.every(
        ({ exhaustiveness, rankingClaim }) =>
          exhaustiveness === "unspecified" && rankingClaim === "none",
      ),
    ).toBe(true);
    expect(
      roles.flatMap(({ members }) =>
        members.filter(
          (member) =>
            "minConstellation" in member || "maxConstellation" in member,
        ),
      ),
    ).toEqual([]);

    const hydroRole = roles.find(
      ({ roleId }) => roleId === "off-field-hydro-applier",
    );
    expect(hydroRole).toMatchObject({
      appliesTo: {
        teamTemplateSourceRecordId: "keqing-team-template-lunar-charged",
        slotId: "off-field-hydro",
      },
      members: [
        { characterId: "furina", conditions: [] },
        { characterId: "aino", conditions: [] },
        { characterId: "yelan", conditions: [] },
        { characterId: "xingqiu", conditions: [] },
      ],
      unknowns: expect.arrayContaining([
        expect.stringContaining("star beside Furina"),
        expect.stringContaining("cross-product"),
      ]),
    });

    const shredRole = roles.find(
      ({ roleId }) => roleId === "resistance-shred",
    );
    expect(shredRole).toMatchObject({
      appliesTo: {
        teamTemplateSourceRecordId: "keqing-team-template-lunar-charged",
        slotId: "resistance-shred",
      },
      members: [
        {
          characterId: "kaedehara_kazuha",
          conditions: [expect.stringContaining("Viridescent Venerer")],
        },
        {
          characterId: "sucrose",
          conditions: [expect.stringContaining("Viridescent Venerer")],
        },
        {
          characterId: "jean",
          conditions: [expect.stringContaining("Viridescent Venerer")],
        },
        {
          characterId: "xianyun",
          conditions: [expect.stringContaining("Viridescent Venerer")],
        },
        {
          characterId: "sayu",
          conditions: [expect.stringContaining("Viridescent Venerer")],
        },
        { characterId: "xilonen", conditions: [] },
      ],
      unknowns: expect.arrayContaining([
        expect.stringContaining("exact aura and action sequence"),
        expect.stringContaining("cross-product"),
      ]),
    });

    const exactTeams = snapshot.records.flatMap((record) =>
      record.kind === "team" ? [record] : [],
    );
    expect(exactTeams).toHaveLength(4);
    expect(exactTeams.map(({ sourceRecordId }) => sourceRecordId)).toEqual([
      "keqing-ineffa-furina-jean-lunar-charged-example",
      "keqing-ineffa-furina-xilonen-lunar-charged-example",
      "keqing-ineffa-aino-sucrose-lunar-charged-example",
      "keqing-ineffa-yelan-kazuha-lunar-charged-example",
    ]);
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

    const furinaJeanTeam = exactTeams.find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-ineffa-furina-jean-lunar-charged-example",
    );
    expect(furinaJeanTeam?.members.map(({ characterId }) => characterId)).toEqual([
      "keqing",
      "ineffa",
      "furina",
      "jean",
    ]);
    expect(furinaJeanTeam?.rotations).toEqual([
      expect.objectContaining({
        id: "sample-longer-rotation-low-er-requirements",
        notation:
          "Ineffa E > Furina ED Q > Jean EQ > Keqing EQE 5[N1C] > Ineffa Q > Jean tE > Keqing EQE 5[N1C] > Jean tE",
        assumptions: [expect.stringContaining("shortened")],
      }),
      expect.objectContaining({
        id: "sample-shorter-rotation-max-fanfare-uptime",
        notation:
          "Ineffa EQ > Furina ED Q > Jean EQ > Keqing EQE 5[N1C] > Jean tE > Keqing EE 5[N1C]",
        assumptions: expect.arrayContaining([
          expect.stringContaining("shortened"),
          expect.stringContaining("close to 20 seconds"),
        ]),
      }),
    ]);

    const furinaXilonenTeam = exactTeams.find(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-ineffa-furina-xilonen-lunar-charged-example",
    );
    expect(
      furinaXilonenTeam?.members.map(({ characterId }) => characterId),
    ).toEqual([
      "keqing",
      "ineffa",
      "furina",
      "xilonen",
    ]);
    expect(furinaXilonenTeam).toMatchObject({
      reactions: ["lunarCharged"],
    });
    expect(furinaXilonenTeam?.rotations).toEqual([
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

    const yelanTeam = exactTeams.find(({ members }) =>
      members.some(({ characterId }) => characterId === "yelan"),
    );
    expect(yelanTeam?.members.map(({ characterId }) => characterId)).toEqual([
      "keqing",
      "ineffa",
      "yelan",
      "kaedehara_kazuha",
    ]);
    expect(yelanTeam?.rotations).toEqual([
      expect.objectContaining({
        id: "sample-rotation",
        notation:
          "Ineffa E Q > Yelan Q N1 E N1 > Kazuha tEP N1 > Keqing E N1 Q E 5[N1C] > Yelan E N3 > Kazuha tEPQ",
        assumptions: [expect.stringContaining("two Yelan Skill casts")],
      }),
      expect.objectContaining({
        id: "sample-rotation-yelan-c1-plus",
        notation:
          "Ineffa E Q > Yelan E Q N1 E N3 > Kazuha tEPQ N1 > Keqing E N1 Q E 5[N1C] > Kazuha tEP",
        assumptions: [expect.stringContaining("Yelan C1 or higher")],
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
