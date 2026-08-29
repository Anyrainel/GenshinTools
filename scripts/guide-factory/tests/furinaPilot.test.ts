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

describe("KQM Furina pilot", () => {
  it("captures conditional non-ER builds and archetypes without inventing ranks", async () => {
    const manualInputs = await loadManualSnapshotInputs(
      await readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      await readJson(SOURCE_REGISTRY_PATH),
    );
    const input = requiredManualSnapshotInputContaining(
      manualInputs,
      "kqm",
      "furina-contextual-weapons-luna-ii",
    );
    const snapshot = ManualObservationSnapshotSchema.parse(input.snapshot);

    expect(snapshot.page).toMatchObject({ sourceVersion: "Luna II" });
    expect(snapshot.records).toHaveLength(14);
    expect(
      snapshot.records.some(({ kind }) => kind === "energy_guidance"),
    ).toBe(false);

    const recommendations = snapshot.records.flatMap((record) =>
      record.kind === "character_guide" ? [record.recommendation] : [],
    );
    expect(
      recommendations.flatMap((recommendation) =>
        recommendation.erTargets ?? [],
      ),
    ).toEqual([]);
    expect(
      recommendations.find(({ id }) => id === "pre-c2-artifact-main-stats"),
    ).toMatchObject({ maxConstellation: 1 });
    expect(
      recommendations.find(
        ({ id }) => id === "c6-brief-on-field-artifact-set",
      ),
    ).toMatchObject({ minConstellation: 6 });
    const contextualWeapons = recommendations.find(
      ({ id }) => id === "contextual-weapons",
    );
    expect(contextualWeapons).toMatchObject({ weaponOrdering: "unranked" });
    expect(
      contextualWeapons?.weaponRecommendations?.flatMap(
        ({ weaponIds }) => weaponIds,
      ),
    ).toEqual(
      expect.arrayContaining(["favonius_sword", "serenitys_call"]),
    );

    const templates = snapshot.records.filter(
      (record) => record.kind === "team_template",
    );
    expect(templates).toHaveLength(5);
    expect(
      templates.every(
        ({ exhaustiveness, rankingClaim }) =>
          exhaustiveness === "non-exhaustive" && rankingClaim === "none",
      ),
    ).toBe(true);

    const healerRole = snapshot.records.find(
      (record) =>
        record.kind === "character_role" &&
        record.sourceRecordId === "furina-xilonen-healer-role-luna-ii",
    );
    if (!healerRole || healerRole.kind !== "character_role") {
      throw new Error("Missing Furina-scoped Xilonen healer observation.");
    }
    expect(healerRole).toMatchObject({
      roleId: "healer",
      appliesTo: {
        teamTemplateSourceRecordId: "furina-team-template-hypercarry-mono",
        slotId: "healer",
      },
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      members: [{ characterId: "xilonen", conditions: [] }],
    });
    expect(healerRole.members[0]).not.toHaveProperty("minConstellation");
    expect(healerRole.members[0]).not.toHaveProperty("maxConstellation");

    const exactTeam = snapshot.records.find(
      (record) =>
        record.kind === "team" &&
        record.sourceRecordId ===
          "furina-neuvillette-kazuha-xilonen-example",
    );
    expect(
      exactTeam?.kind === "team"
        ? exactTeam.members.map(({ characterId }) => characterId)
        : [],
    ).toEqual([
      "furina",
      "neuvillette",
      "kaedehara_kazuha",
      "xilonen",
    ]);
    expect(
      exactTeam?.kind === "team"
        ? exactTeam.rotations.map(({ id }) => id)
        : [],
    ).toEqual(["sample-rotation-xilonen"]);

    const quickbloomTeams = snapshot.records.flatMap((record) =>
      record.kind === "team" && record.reactions?.includes("hyperbloom")
        ? [record]
        : [],
    );
    expect(
      quickbloomTeams.map(({ sourceRecordId }) => sourceRecordId).sort(),
    ).toEqual([
        "furina-alhaitham-shinobu-nahida-quickbloom-example",
        "furina-nahida-cyno-baizhu-quickbloom-example",
    ]);
    expect(quickbloomTeams.every(({ rotations }) => rotations.length > 0)).toBe(
      true,
    );
    const cynoTeam = quickbloomTeams.find(({ members }) =>
      members.some(({ characterId }) => characterId === "cyno"),
    );
    const cyno = cynoTeam?.members.find(
      ({ characterId }) => characterId === "cyno",
    );
    expect(cyno?.artifactRecommendations).toEqual([
      expect.objectContaining({
        classification: "conditional",
        artifacts: [{ type: "4pc", setId: "thundering_fury" }],
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
