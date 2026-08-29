import { describe, expect, it } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import { readJson, sha256Text, stableJson } from "../src/io";
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

const KEQING_GUIDE_PAGE_URL =
  "https://keqingmains.com/q/keqing-quickguide/";

const EXPECTED_EQUIPMENT_GUIDES = [
  {
    sourceRecordId:
      "keqing-lunar-charged-default-artifact-stats-luna-i",
    heading: "Lunar-Charged > Artifact Stats",
    sha256: "f3e479a9fcc59d1d0bc09f03fd5cb9cd7894be2a259bb3edb331fe8555a5399b",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-high-buff-goblet-stats-luna-i",
    heading: "Lunar-Charged > Artifact Stats > ATK% Goblet note",
    sha256: "81577f19b22ddda89c3e7e3dd24832de142abc5ba0a9a2709a3cfa81c8613953",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-furina-marechaussee-hunter-luna-i",
    heading: "Lunar-Charged > Artifact Sets > 4pc Marechaussee Hunter",
    sha256: "fb11da8d6d3bee734557617f858dd74d7e6b9aefddd2996f1f83fdae1824a3fa",
  },
  {
    sourceRecordId: "keqing-lunar-charged-notsu-contexts-luna-i",
    heading:
      "Lunar-Charged > Artifact Sets > 4pc Night of the Sky's Unveiling",
    sha256: "2aa82ef0559c614491a5099da0b8a72b1da1b895df2099800e1bcb6fcd22cdab",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-traditional-artifact-options-luna-i",
    heading: "Lunar-Charged > Artifact Sets > 4pc Thundersoother",
    sha256: "84194569fb93daaf51d57ebb6d9f9d7673c90d42f00e72eba0c9397a56d12c30",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-top-contributor-artifact-options-luna-i",
    heading:
      "Lunar-Charged > Artifact Sets > 4pc Thundering Fury / 4pc Gilded Dreams",
    sha256: "866f18494a4b7069e245fd4c7d6d2c8d01c9ec36923f73840f81b96b1c1fc245",
  },
  {
    sourceRecordId: "keqing-lunar-charged-general-mistsplitter-luna-i",
    heading: "Lunar-Charged > Weapons > 5★ Mistsplitter Reforged",
    sha256: "83fb88fd9ac8ec251c691928cabfe30f558149fb1645fc33f755b3ccf974b82a",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-traditional-jade-cutter-ranking-luna-i",
    heading: "Lunar-Charged > Weapons > 5★ Primordial Jade Cutter",
    sha256: "b77363ebe5cab22f6adbc9a573c7e3f2940da4d7078acee79e24e1208ba7e60c",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-exceptional-em-foliar-tie-luna-i",
    heading: "Lunar-Charged > Weapons > 5★ Light of Foliar Incision",
    sha256: "f64aca16887a3aae79be8fc4464b3d8a2a5c9005ffd1a55f87891ea447d63f11",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-shielded-summit-shaper-luna-i",
    heading: "Lunar-Charged > Weapons > 5★ Summit Shaper",
    sha256: "e9f8ee2f817fb8807b63d61f7e387b5703433592f710d7f175d7bc3a0b06a3bd",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-other-five-star-crit-options-luna-i",
    heading: "Lunar-Charged > Weapons > Other 5★ CRIT Stat Sticks",
    sha256: "247d6221ada35981e48e075db269753de4337c73228908c324de8c50feb2e4c8",
  },
  {
    sourceRecordId: "keqing-lunar-charged-r5-finale-healer-luna-i",
    heading: "Lunar-Charged > Weapons > 4★ Finale of the Deep",
    sha256: "8d2c6a68a27c10859ecdd2759716d3c58ecccf29bb8cbb8b82be1d1b87d382e1",
  },
  {
    sourceRecordId: "keqing-lunar-charged-freedom-sworn-luna-i",
    heading: "Lunar-Charged > Weapons > 5★ Freedom-Sworn",
    sha256: "0d794971d5a7b09427bb235dbd6faffbdd98e7a88e342e6c5f0f29a09f04406d",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i",
    heading: "Lunar-Charged > Weapons > 4★ The Black Sword, Wolf-Fang",
    sha256: "ad12fb26aa2b5ed09c104817b11209edde258bc390a6e335bb9dabd5137cd349",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-full-shield-eshu-lions-roar-tie-luna-i",
    heading: "Lunar-Charged > Weapons > 4★ Calamity of Eshu",
    sha256: "dba3e50ddeaf34e14461dc0c278c95130c1c279fd76506bb6f5e2833c4f6a0a8",
  },
  {
    sourceRecordId:
      "keqing-lunar-charged-harbinger-of-dawn-availability-luna-i",
    heading: "Lunar-Charged > Weapons > 3★ Harbinger of Dawn",
    sha256: "854e0a6f73f39cbd66cdde9b9d9c57625d4010c15181e3d67efedd9839706644",
  },
  {
    sourceRecordId: "keqing-lunar-charged-low-rarity-fallbacks-luna-i",
    heading:
      "Lunar-Charged > Weapons > 4★ Moonweaver's Dawn, Kagotsurube Isshin",
    sha256: "0194f1108e1c5c7cd5f45164d005a2c39b781455fe75eb7c9a5ad25d00f878bf",
  },
] as const;

const EXPECTED_ROLE_RECORD_IDS = [
  "keqing-lunar-charged-off-field-hydro-appliers",
  "keqing-lunar-charged-resistance-shred-options",
] as const;

const EXPECTED_TEAM_RECORD_IDS = [
  "keqing-ineffa-furina-jean-lunar-charged-example",
  "keqing-ineffa-furina-xilonen-lunar-charged-example",
  "keqing-ineffa-aino-sucrose-lunar-charged-example",
  "keqing-ineffa-yelan-kazuha-lunar-charged-example",
] as const;

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

    expect(snapshot.page).toMatchObject({
      url: KEQING_GUIDE_PAGE_URL,
      sourceVersion: "Luna I",
    });
    expect(
      snapshot.records.some(({ kind }) => kind === "energy_guidance"),
    ).toBe(false);

    const template = snapshot.records.find(
      (record) =>
        record.kind === "team_template" &&
        record.sourceRecordId === "keqing-team-template-lunar-charged",
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

    const expectedRoleRecordIds = new Set<string>(EXPECTED_ROLE_RECORD_IDS);
    const roles = snapshot.records.flatMap((record) =>
      record.kind === "character_role" &&
      expectedRoleRecordIds.has(record.sourceRecordId)
        ? [record]
        : [],
    );
    expect(roles).toHaveLength(2);
    expect(roles.map(({ sourceRecordId }) => sourceRecordId)).toEqual(
      EXPECTED_ROLE_RECORD_IDS,
    );
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

    const expectedTeamRecordIds = new Set<string>(EXPECTED_TEAM_RECORD_IDS);
    const exactTeams = snapshot.records.flatMap((record) =>
      record.kind === "team" && expectedTeamRecordIds.has(record.sourceRecordId)
        ? [record]
        : [],
    );
    expect(exactTeams).toHaveLength(4);
    expect(exactTeams.map(({ sourceRecordId }) => sourceRecordId)).toEqual(
      EXPECTED_TEAM_RECORD_IDS,
    );
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

  it("pins the 17 source-scoped equipment and stat payloads without treating unrelated future records as participants", async () => {
    const manualInputs = await loadManualSnapshotInputs(
      await readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      await readJson(SOURCE_REGISTRY_PATH),
    );
    const input = requiredManualSnapshotInputContaining(
      manualInputs,
      "kqm",
      "keqing-lunar-charged-default-artifact-stats-luna-i",
    );
    const snapshot = ManualObservationSnapshotSchema.parse(input.snapshot);
    const expectedGuideIds = new Set<string>(
      EXPECTED_EQUIPMENT_GUIDES.map(({ sourceRecordId }) => sourceRecordId),
    );
    const guides = snapshot.records.flatMap((record) =>
      record.kind === "character_guide" &&
      expectedGuideIds.has(record.sourceRecordId)
        ? [record]
        : [],
    );

    expect(guides).toHaveLength(EXPECTED_EQUIPMENT_GUIDES.length);
    expect(
      guides.map((guide) => ({
        sourceRecordId: guide.sourceRecordId,
        heading:
          "url" in guide.locator ? guide.locator.heading : undefined,
        sha256: sha256Text(stableJson(guide)),
      })),
    ).toEqual(EXPECTED_EQUIPMENT_GUIDES);
    expect(
      guides.every(
        ({ characterId, extraction, locator, supportingLocators, unknowns }) =>
          characterId === "keqing" &&
          extraction.method === "agent-assisted" &&
          extraction.reviewStatus === "unreviewed" &&
          "url" in locator &&
          locator.url === KEQING_GUIDE_PAGE_URL &&
          supportingLocators.every(
            (supportingLocator) =>
              "url" in supportingLocator &&
              supportingLocator.url === KEQING_GUIDE_PAGE_URL,
          ) &&
          unknowns.length > 0,
      ),
    ).toBe(true);

    const requiredGuide = (sourceRecordId: string) => {
      const matches = guides.filter(
        (guide) => guide.sourceRecordId === sourceRecordId,
      );
      expect(matches).toHaveLength(1);
      return matches[0];
    };

    const defaultStats = requiredGuide(
      "keqing-lunar-charged-default-artifact-stats-luna-i",
    );
    expect(defaultStats.recommendation).toMatchObject({
      scope: "artifact-stats",
      mainStats: {
        sands: [{ statIds: ["atk%"] }],
        goblet: [
          { statIds: ["electro%"], priority: 1 },
          { statIds: ["atk%"], priority: 2 },
        ],
        circlet: [
          {
            statIds: ["cd"],
            conditions: [
              "Keqing is used in a Lunar-Charged team.",
            ],
          },
          {
            statIds: ["cr"],
            conditions: [
              "Keqing is used in a Lunar-Charged team.",
              "Keqing does not overcap CRIT Rate after A4 and artifact-set bonuses.",
            ],
          },
        ],
      },
      substats: [
        { statIds: ["cr", "cd"], priority: 1 },
        { statIds: ["atk%"], priority: 2 },
        { statIds: ["em"], priority: 3 },
      ],
    });

    const highBuffStats = requiredGuide(
      "keqing-lunar-charged-high-buff-goblet-stats-luna-i",
    );
    expect(highBuffStats.recommendation.mainStats?.goblet).toEqual([
      {
        statIds: ["electro%", "atk%"],
        conditions: [
          "Keqing is used in a Lunar-Charged team.",
          "Keqing has both a high-Base-ATK weapon and large amounts of DMG Bonus.",
        ],
      },
    ]);

    const traditionalArtifacts = requiredGuide(
      "keqing-lunar-charged-traditional-artifact-options-luna-i",
    );
    expect(traditionalArtifacts.recommendation).toMatchObject({
      artifactOrdering: "unranked",
      artifactRecommendations: [
        {
          artifacts: [{ type: "4pc", setId: "thundersoother" }],
          grouping: "single",
          classification: "default",
        },
        {
          artifacts: [
            {
              type: "2pc+2pc",
              halfSetIds: ["electro%-15", "atk%-18"],
            },
            {
              type: "2pc+2pc",
              halfSetIds: ["electro%-15", "na-ca-dmg%-15"],
            },
            {
              type: "2pc+2pc",
              halfSetIds: ["atk%-18", "na-ca-dmg%-15"],
            },
          ],
          grouping: "alternatives",
          classification: "alternative",
        },
      ],
    });
    expect(traditionalArtifacts.unknowns).toContain(
      "the source identifies mixed combinations using the 2pc Marechaussee Hunter effect as weakest, but V1 cannot encode that partial order without over-ranking the other mixed alternatives",
    );

    const jadeCutter = requiredGuide(
      "keqing-lunar-charged-traditional-jade-cutter-ranking-luna-i",
    );
    expect(jadeCutter.recommendation).toMatchObject({
      weaponOrdering: "ranked-groups",
      weaponRecommendations: [
        {
          weaponIds: ["primordial_jade_cutter"],
          grouping: "single",
          classification: "recommended",
        },
        {
          weaponIds: ["mistsplitter_reforged"],
          grouping: "single",
          classification: "alternative",
        },
      ],
    });

    const otherFiveStarCritOptions = requiredGuide(
      "keqing-lunar-charged-other-five-star-crit-options-luna-i",
    );
    expect(otherFiveStarCritOptions.recommendation).toMatchObject({
      weaponOrdering: "unranked",
      weaponRecommendations: [
        {
          grouping: "alternatives",
          classification: "alternative",
        },
      ],
    });
    expect(otherFiveStarCritOptions.unknowns).toContain(
      "the source's never-competitive-with-Mistsplitter cross-record ordering is not represented by the V1 recommendation schema",
    );
    expect(otherFiveStarCritOptions.unknowns).toContain(
      "the source explicitly identifies Splendor of Tranquil Waters as the weakest option in this group, but V1 cannot encode that partial order without over-ranking the other four alternatives",
    );

    const eshu = requiredGuide(
      "keqing-lunar-charged-full-shield-eshu-lions-roar-tie-luna-i",
    );
    expect(eshu.recommendation.weaponRecommendations).toEqual([
      {
        weaponIds: ["calamity_of_eshu", "lions_roar"],
        grouping: "tied",
        classification: "recommended",
        conditions: [
          "Keqing is used in a Lunar-Charged team.",
          "Calamity of Eshu is compared against R5 Lion's Roar, and its shield-dependent passive has full uptime.",
        ],
      },
    ]);

    expect(
      guides.some(({ recommendation }) => recommendation.erTargets != null),
    ).toBe(false);
    expect(
      guides.flatMap(({ recommendation }) =>
        recommendation.substats?.flatMap(({ statIds }) => statIds) ?? [],
      ),
    ).not.toContain("er");
    expect(
      guides.some(({ recommendation }) =>
        (recommendation.artifactRecommendations ?? []).some(({ artifacts }) =>
          artifacts.some(
            (artifact) =>
              artifact.type === "4pc" &&
              artifact.setId === "fragment_of_harmonic_whimsy",
          ),
        ),
      ),
    ).toBe(false);
    expect(
      guides.some(
        ({ recommendation }) =>
          recommendation.scope === "combined" &&
          (recommendation.weaponRecommendations ?? []).some(({ weaponIds }) =>
            weaponIds.includes("finale_of_the_deep"),
          ),
      ),
    ).toBe(false);
  });
});
