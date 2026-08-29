import { describe, expect, it } from "vitest";
import { replayTeamDamage } from "../src/computationReplay";
import { EULA_STRUCTURAL_SMOKE } from "../src/eulaStructuralSmoke";
import { readJson, stableJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";

describe("guide-factory computation replay", () => {
  it("replays the explicitly structural Eula fixture deterministically", async () => {
    const first = await replayTeamDamage(EULA_STRUCTURAL_SMOKE);
    const second = await replayTeamDamage(EULA_STRUCTURAL_SMOKE);

    expect(first.evidence).toMatchObject({
      classification: "structural_smoke",
      supportsGuideClaims: false,
    });
    expect(first.evidence.notes.join(" ")).toContain(
      "artifact sheets are intentionally empty"
    );
    expect(first.evidence.notes.join(" ")).toContain("not a rotation");
    expect(first.inputs.artifactSheets).toEqual({
      eula: [],
      furina: [],
      mika: [],
      raiden_shogun: [],
    });
    expect(first.inputs.combo.lines).toHaveLength(1);
    expect(first.inputs.formulaBuffOverrides).toBeNull();
    expect(first.validation.formulaCoverage).toEqual([
      {
        charId: "eula",
        formulaId: "eula-skill-tap",
        available: true,
      },
    ]);
    expect(first.validation.calculatorAgreement.passed).toBe(true);
    expect(first.validation.calculatorAgreement.absoluteDifference).toBeLessThanOrEqual(
      first.validation.calculatorAgreement.allowedDifference
    );
    expect(first.result.totalDamage).toBe(5221.96635101425);
    expect(stableJson(second)).toBe(stableJson(first));
  });

  it("keeps roster, weapons, and sets tied to the declared knowledge record", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH)
    );
    const record = repository.records.find(
      (candidate) =>
        candidate.id === "genshintools-presets:team:1ZC3ATIWeGrK1fWd0N"
    );
    expect(record?.kind).toBe("team");
    if (!record || record.kind !== "team") {
      throw new Error("Missing Eula structural-smoke knowledge record.");
    }

    expect(EULA_STRUCTURAL_SMOKE.evidence.sourceRefs).toContainEqual({
      kind: "knowledge_record",
      recordId: record.id,
      supports: ["roster", "selected_weapons", "selected_artifact_sets"],
    });
    expect(
      EULA_STRUCTURAL_SMOKE.teamConfigs.map((config) => ({
        characterId: config.charId,
        selectedWeapon: { weaponId: config.weaponId },
        selectedArtifact: config.artifactSet,
      }))
    ).toEqual(
      record.members.map((member) => ({
        characterId: member.characterId,
        selectedWeapon: member.selectedWeapon,
        selectedArtifact: member.selectedArtifact,
      }))
    );
  });

  it("rejects a formula that is unavailable for the configured team", async () => {
    const invalid = {
      ...EULA_STRUCTURAL_SMOKE,
      replayId: "missing-formula-smoke",
      combo: {
        ...EULA_STRUCTURAL_SMOKE.combo,
        lines: [
          {
            ...EULA_STRUCTURAL_SMOKE.combo.lines[0],
            formulaId: "not-a-real-formula",
          },
        ],
      },
    };

    await expect(replayTeamDamage(invalid)).rejects.toThrow(
      "formula eula.not-a-real-formula is unavailable"
    );
  });

  it("requires one explicit artifact sheet for every team member", async () => {
    const missingSheet = {
      ...EULA_STRUCTURAL_SMOKE,
      replayId: "missing-sheet-smoke",
      artifactSheets: {
        eula: EULA_STRUCTURAL_SMOKE.artifactSheets.eula,
        furina: EULA_STRUCTURAL_SMOKE.artifactSheets.furina,
        mika: EULA_STRUCTURAL_SMOKE.artifactSheets.mika,
      },
    };

    await expect(
      replayTeamDamage(missingSheet as typeof EULA_STRUCTURAL_SMOKE)
    ).rejects.toThrow("artifact sheets must exactly match team characters");
  });
});
