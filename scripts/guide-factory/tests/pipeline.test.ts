import { describe, expect, it } from "vitest";
import { consolidateKnowledge } from "../src/consolidation";
import {
  importGenshinToolsPresets,
  importLegacyTeamResearch,
} from "../src/importers";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  BUILD_PRESET_PATH,
  LEGACY_RESEARCH_PATH,
  SOURCE_REGISTRY_PATH,
  TEAM_PRESET_PATH,
} from "../src/paths";
import {
  SourceRegistrySchema,
  type LegacyArtifactChoice,
} from "../src/schemas";
import { runValidation } from "../src/validate";
import {
  formatDiagnostics,
  validateWorkspaceBoundary,
} from "../src/validation";

type RawArtifact =
  | { setId: string }
  | { halfSetIds: [string, string] }
  | null;

interface RawTeamPreset {
  teams: Array<{
    id: string;
    characters: Array<string | null>;
    weapons: Array<string | null>;
    artifacts: RawArtifact[];
    minEr?: Record<string, number>;
  }>;
}

interface RawBuildPreset {
  characterBuilds: Record<string, string[]>;
  characterWeapons: Record<string, string[]>;
}

interface RawLegacyResearch {
  teams: Array<{
    characters: string[];
  }>;
}

describe("guide-factory data pipeline", () => {
  it("registers every source under a unique stable ID", async () => {
    const registry = SourceRegistrySchema.parse(
      await readJson(SOURCE_REGISTRY_PATH)
    );
    const ids = registry.sources.map((source) => source.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(
      registry.sources
        .filter((source) => source.status === "active")
        .every(
          (source) =>
            source.recordFormat !== "none" &&
            source.ingestionMode !== "reference-only"
        )
    ).toBe(true);
  });

  it("imports every live GenshinTools preset record", async () => {
    const [registryInput, rawTeamInput, rawBuildInput] = await Promise.all([
      readJson(SOURCE_REGISTRY_PATH),
      readJson(TEAM_PRESET_PATH),
      readJson(BUILD_PRESET_PATH),
    ]);
    const registry = SourceRegistrySchema.parse(registryInput);
    const rawTeams = rawTeamInput as RawTeamPreset;
    const rawBuilds = rawBuildInput as RawBuildPreset;
    const imported = await importGenshinToolsPresets(registryInput);

    expect(imported.capturedAt).toBe(
      registry.sources.find((source) => source.id === imported.sourceId)
        ?.checkedAt
    );
    expect(imported.teams.map((team) => team.sourceRecordId)).toEqual(
      rawTeams.teams.map((team) => team.id)
    );
    expect(
      imported.characterGuides.map((guide) => guide.characterId)
    ).toEqual(Object.keys(rawBuilds.characterBuilds));
    expectUnique(imported.teams.map((team) => team.sourceRecordId));
    expectUnique(
      imported.characterGuides.map((guide) => guide.sourceRecordId)
    );

    for (const [index, team] of imported.teams.entries()) {
      const source = rawTeams.teams[index];
      expect(team.members.map((member) => member.characterId)).toEqual(
        source.characters
      );
      expect(team.members.map((member) => member.selectedWeaponId)).toEqual(
        source.weapons
      );
      expect(team.members.map((member) => member.selectedArtifact)).toEqual(
        source.artifacts.map(expectedArtifact)
      );
      expect(
        team.members.map((member) => member.erFloorPercent ?? null)
      ).toEqual(
        source.characters.map((characterId) =>
          characterId ? (source.minEr?.[characterId] ?? null) : null
        )
      );
      expect(team.unknowns).toContain("formula counts");
      expect(team.unknowns).toContain("executable rotation");
    }

    for (const guide of imported.characterGuides) {
      expect(guide.builds.map((build) => build.sourceRecordId)).toEqual(
        rawBuilds.characterBuilds[guide.characterId]
      );
      expect(guide.weaponOrder).toEqual(
        rawBuilds.characterWeapons[guide.characterId]
      );
      expect(guide.unknowns).toContain("team applicability");
      expect(guide.unknowns).toContain("formula counts");
    }

    await expectCurrentSourceRevisions(imported.sourceRevision.files, [
      TEAM_PRESET_PATH,
      BUILD_PRESET_PATH,
    ]);
  });

  it("imports legacy candidates with stable IDs and provenance gaps", async () => {
    const [registryInput, rawInput] = await Promise.all([
      readJson(SOURCE_REGISTRY_PATH),
      readJson(LEGACY_RESEARCH_PATH),
    ]);
    const raw = rawInput as RawLegacyResearch;
    const first = await importLegacyTeamResearch(registryInput);
    const second = await importLegacyTeamResearch(registryInput);

    expect(first.records).toHaveLength(raw.teams.length);
    expectUnique(first.records.map((record) => record.sourceRecordId));
    expect(stableJson(second)).toBe(stableJson(first));

    for (const [index, record] of first.records.entries()) {
      expect(record.locator).toMatchObject({ jsonPointer: `/teams/${index}` });
      expect(record.members.map((member) => member.characterId)).toEqual(
        raw.teams[index].characters
      );
      expect(record.unknowns).toContain(
        "originating page and per-row source"
      );
      expect(record.unknowns).toContain("game patch");
      expect(record.unknowns).toContain("formula counts");
    }

    const legacyTwoPieceChoices = first.records.flatMap((record) =>
      record.members.flatMap((member) =>
        member.selectedArtifact?.type === "2pc+2pc"
          ? [member.selectedArtifact]
          : []
      )
    );
    expect(legacyTwoPieceChoices).toHaveLength(3);
    expect(
      legacyTwoPieceChoices.every(
        (choice) =>
          choice.sourceSetIds[0] === "tenacity_of_the_millelith" &&
          choice.sourceSetIds[1] === "vourukashas_glow" &&
          choice.normalizedHalfSetIds?.[0] === "hp%-20" &&
          choice.normalizedHalfSetIds?.[1] === "hp%-20"
      )
    ).toBe(true);

    await expectCurrentSourceRevisions(first.sourceRevision.files, [
      LEGACY_RESEARCH_PATH,
    ]);
  });

  it("consolidates deterministically without erasing source unknowns", async () => {
    const registryInput = await readJson(SOURCE_REGISTRY_PATH);
    const [genshinTools, legacy, sourceRegistrySha256] = await Promise.all([
      importGenshinToolsPresets(registryInput),
      importLegacyTeamResearch(registryInput),
      sha256File(SOURCE_REGISTRY_PATH),
    ]);
    const input = { sourceRegistrySha256, genshinTools, legacy };
    const first = consolidateKnowledge(input);
    const second = consolidateKnowledge(input);

    expect(stableJson(second)).toBe(stableJson(first));
    expect(first.sourceRegistrySha256).toBe(sourceRegistrySha256);
    expect(first.records).toHaveLength(
      genshinTools.teams.length +
        genshinTools.characterGuides.length +
        legacy.records.length
    );
    expect(first.records.map((record) => record.id)).toEqual(
      first.records.map((record) => record.id).sort()
    );
    expectUnique(first.records.map((record) => record.id));

    for (const sourceTeam of genshinTools.teams) {
      const record = requiredTeam(
        first.records,
        `genshintools-presets:team:${sourceTeam.sourceRecordId}`
      );
      expect(record.status).toBe("baseline");
      expect(record.damagePlans).toEqual([]);
      expect(record.unknowns).toEqual(sourceTeam.unknowns);
      expect(record.sourceRefs).toEqual([
        {
          sourceId: genshinTools.sourceId,
          sourceRecordId: sourceTeam.sourceRecordId,
          locator: sourceTeam.locator,
        },
      ]);
      expect(record.members).toEqual(
        sourceTeam.members.map((member) => ({
          characterId: member.characterId,
          investment: { status: "unspecified" },
          selectedWeapon: member.selectedWeaponId
            ? { weaponId: member.selectedWeaponId }
            : null,
          selectedArtifact: member.selectedArtifact,
          ...(member.erFloorPercent != null
            ? { erFloorPercent: member.erFloorPercent }
            : {}),
        }))
      );
    }

    for (const sourceGuide of genshinTools.characterGuides) {
      const record = requiredCharacterGuide(
        first.records,
        `genshintools-presets:character-guide:${sourceGuide.sourceRecordId}`
      );
      expect(record.status).toBe("baseline");
      expect(record.characterId).toBe(sourceGuide.characterId);
      expect(record.weaponOrder).toEqual(sourceGuide.weaponOrder);
      expect(record.builds).toEqual(sourceGuide.builds);
      expect(record.unknowns).toEqual(sourceGuide.unknowns);
    }

    for (const sourceTeam of legacy.records) {
      const record = requiredTeam(
        first.records,
        `legacy-team-research:team:${sourceTeam.sourceRecordId}`
      );
      expect(record.status).toBe("candidate");
      expect(record.damagePlans).toEqual([]);
      expect(record.unknowns).toEqual(sourceTeam.unknowns);
      expect(record.members.map((member) => member.selectedArtifact)).toEqual(
        sourceTeam.members.map((member) =>
          expectedCanonicalLegacyArtifact(member.selectedArtifact)
        )
      );
      expect(record.reactions).toEqual(
        sourceTeam.reactionLabel && sourceTeam.reactionLabel !== "none"
          ? [expectedLegacyReaction(sourceTeam.reactionLabel)]
          : undefined
      );
      expect(
        record.members.every(
          (member) =>
            member.investment.status === "unspecified" &&
            (member.selectedWeapon == null ||
              member.selectedWeapon.refinement == null)
        )
      ).toBe(true);
    }
  });

  it("keeps live failures visible and known candidate warnings explicit", async () => {
    const result = await runValidation();
    const errors = result.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error"
    );
    const warnings = result.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning"
    );

    expect(errors, formatDiagnostics(errors)).toEqual([]);
    expect(warnings).toHaveLength(12);
    expect(new Set(warnings.map((warning) => warning.code))).toEqual(
      new Set(["catalog.weapon_type_mismatch"])
    );
    expect(countDiagnosticMessages(warnings)).toEqual({
      "escoffier uses Polearm, but silvershower_heartstrings is Bow.": 5,
      "flins uses Polearm, but cashflow_supervision is Catalyst.": 1,
      "iansan uses Polearm, but peak_patrol_song is Sword.": 1,
      "illuga uses Polearm, but redhorn_stonethresher is Claymore.": 1,
      "ineffa uses Polearm, but kaguras_verity is Catalyst.": 3,
      "zibai uses Sword, but redhorn_stonethresher is Claymore.": 1,
    });
  });

  it("keeps the offline factory out of every runtime source tree", async () => {
    const diagnostics = await validateWorkspaceBoundary();
    expect(diagnostics, formatDiagnostics(diagnostics)).toEqual([]);
  });
});

function expectedLegacyReaction(reactionLabel: string): string {
  if (reactionLabel === "freeze") return "frozen";
  if (reactionLabel === "overload") return "overloaded";
  return reactionLabel;
}

function expectedCanonicalLegacyArtifact(
  artifact: LegacyArtifactChoice | null
) {
  if (!artifact || artifact.type === "4pc") return artifact;
  return artifact.normalizedHalfSetIds
    ? { type: "2pc+2pc", halfSetIds: artifact.normalizedHalfSetIds }
    : null;
}

function expectedArtifact(artifact: RawArtifact) {
  if (!artifact) return null;
  if ("setId" in artifact) return { type: "4pc", setId: artifact.setId };
  return { type: "2pc+2pc", halfSetIds: artifact.halfSetIds };
}

function expectUnique(values: string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

function countDiagnosticMessages(
  diagnostics: Array<{ message: string }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const diagnostic of diagnostics) {
    counts[diagnostic.message] = (counts[diagnostic.message] ?? 0) + 1;
  }
  return counts;
}

async function expectCurrentSourceRevisions(
  revisions: Array<{ path: string; sha256: string }>,
  absolutePaths: string[]
): Promise<void> {
  expect(revisions.map((revision) => revision.sha256)).toEqual(
    await Promise.all(absolutePaths.map(sha256File))
  );
}

function requiredTeam(
  records: ReturnType<typeof consolidateKnowledge>["records"],
  id: string
) {
  const record = records.find((candidate) => candidate.id === id);
  expect(record, `Missing consolidated record ${id}`).toBeDefined();
  expect(record?.kind).toBe("team");
  if (!record || record.kind !== "team") {
    throw new Error(`Expected consolidated team ${id}`);
  }
  return record;
}

function requiredCharacterGuide(
  records: ReturnType<typeof consolidateKnowledge>["records"],
  id: string
) {
  const record = records.find((candidate) => candidate.id === id);
  expect(record, `Missing consolidated record ${id}`).toBeDefined();
  expect(record?.kind).toBe("character_guide");
  if (!record || record.kind !== "character_guide") {
    throw new Error(`Expected consolidated character guide ${id}`);
  }
  return record;
}
