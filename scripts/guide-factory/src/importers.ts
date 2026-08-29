import { createHash } from "node:crypto";
import { artifactHalfSets } from "@/data/resources";
import {
  BUILD_PRESET_PATH,
  LEGACY_RESEARCH_PATH,
  REPOSITORY_ROOT,
  TEAM_PRESET_PATH,
} from "./paths";
import {
  ArtifactChoiceSchema,
  GenshinToolsPresetSnapshotSchema,
  LegacyArtifactChoiceSchema,
  LegacyTeamSnapshotSchema,
  SourceRegistrySchema,
  type ArtifactChoice,
  type GenshinToolsPresetSnapshot,
  type LegacyArtifactChoice,
  type LegacyTeamSnapshot,
  type SourceRegistry,
} from "./schemas";
import { readJson, sha256File } from "./io";

type RawTeamPreset = {
  teams: Array<{
    id: string;
    name?: string;
    characters: Array<string | null>;
    weapons: Array<string | null>;
    artifacts: Array<
      | { setId: string }
      | { halfSetIds: [string, string] }
      | null
    >;
    reactions?: string[];
    minEr?: Record<string, number>;
  }>;
};

type RawBuild = {
  id: string;
  name?: string;
  visible: boolean;
  minCons?: number;
  composition: "4pc" | "2pc+2pc";
  artifactSet?: string;
  halfSet1?: string;
  halfSet2?: string;
  styles?: string[];
  roles?: string[];
  sandsWeights: Array<{ stat: string; weight: number }>;
  gobletWeights: Array<{ stat: string; weight: number }>;
  circletWeights: Array<{ stat: string; weight: number }>;
  substats: Array<{ stat: string; weight: number }>;
};

type RawBuildPreset = {
  builds: Record<string, RawBuild>;
  characterBuilds: Record<string, string[]>;
  characterWeapons: Record<string, string[]>;
};

type RawLegacyResearch = {
  meta?: {
    generated?: string;
    sources?: string[];
  };
  teams: Array<{
    name?: string;
    characters: string[];
    dpsIndex?: number;
    reaction?: string;
    builds: Array<{
      weapon?: string;
      artifacts?: string[];
    }>;
  }>;
};

const HALF_SET_ID_BY_ARTIFACT_SET_ID = new Map(
  artifactHalfSets.flatMap(({ id, setIds }) =>
    setIds.map((setId) => [setId, id] as const)
  )
);

export async function importGenshinToolsPresets(
  registryInput: unknown
): Promise<GenshinToolsPresetSnapshot> {
  const registry = SourceRegistrySchema.parse(registryInput);
  const capturedAt = getCheckedAt(registry, "genshintools-presets");
  const teamPreset = (await readJson(TEAM_PRESET_PATH)) as RawTeamPreset;
  const buildPreset = (await readJson(BUILD_PRESET_PATH)) as RawBuildPreset;

  const teams = teamPreset.teams.map((team) => ({
    kind: "team" as const,
    sourceRecordId: team.id,
    locator: {
      file: relativePath(TEAM_PRESET_PATH),
      recordId: team.id,
    },
    ...(team.name ? { name: team.name } : {}),
    members: team.characters.map((characterId, index) => ({
      characterId: characterId ?? "",
      selectedWeaponId: team.weapons[index] ?? null,
      selectedArtifact: toArtifactChoice(team.artifacts[index] ?? null),
      ...(characterId && team.minEr?.[characterId] != null
        ? { erFloorPercent: team.minEr[characterId] }
        : {}),
    })),
    ...(team.reactions?.length ? { reactions: team.reactions } : {}),
    unknowns: [
      "investment",
      "formula counts",
      "executable rotation",
      ...(team.minEr ? [] : ["ER floors"]),
      "whether selected equipment is optimal or representative",
    ],
  }));

  const characterGuides = Object.entries(buildPreset.characterBuilds).map(
    ([characterId, buildIds]) => ({
      kind: "character_guide" as const,
      sourceRecordId: characterId,
      locator: {
        file: relativePath(BUILD_PRESET_PATH),
        recordId: characterId,
      },
      characterId,
      ...(buildPreset.characterWeapons[characterId]?.length
        ? { weaponOrder: buildPreset.characterWeapons[characterId] }
        : {}),
      builds: buildIds.map((buildId) => {
        const build = buildPreset.builds[buildId];
        if (!build) throw new Error(`Missing build ${buildId}`);
        return {
          sourceRecordId: build.id,
          visible: build.visible,
          ...(build.name ? { name: build.name } : {}),
          ...(build.minCons != null
            ? { minConstellation: build.minCons }
            : {}),
          artifact: artifactFromBuild(build),
          ...(build.styles?.length ? { styles: build.styles } : {}),
          ...(build.roles?.length ? { roles: build.roles } : {}),
          sands: build.sandsWeights,
          goblet: build.gobletWeights,
          circlet: build.circletWeights,
          substats: build.substats,
        };
      }),
      unknowns: [
        "team applicability",
        "weapon refinement assumptions",
        "ER floors",
        "formula counts",
      ],
    })
  );

  return GenshinToolsPresetSnapshotSchema.parse({
    schemaVersion: 1,
    sourceId: "genshintools-presets",
    capturedAt,
    sourceRevision: {
      files: await Promise.all(
        [TEAM_PRESET_PATH, BUILD_PRESET_PATH].map(async (filePath) => ({
          path: relativePath(filePath),
          sha256: await sha256File(filePath),
        }))
      ),
    },
    teams,
    characterGuides,
  });
}

export async function importLegacyTeamResearch(
  registryInput: unknown
): Promise<LegacyTeamSnapshot> {
  const registry = SourceRegistrySchema.parse(registryInput);
  const capturedAt = getCheckedAt(registry, "legacy-team-research");
  const source = (await readJson(LEGACY_RESEARCH_PATH)) as RawLegacyResearch;

  const records = source.teams.map((team, index) => {
    const sourceRecordId = `team-${createHash("sha256")
      .update(JSON.stringify(team))
      .digest("hex")
      .slice(0, 12)}`;
    const members = team.characters.map((characterId, memberIndex) => {
      const build = team.builds[memberIndex];
      return {
        characterId,
        selectedWeaponId: build?.weapon ?? null,
        selectedArtifact: artifactFromLegacy(build?.artifacts),
      };
    });
    const hasUnresolvedHalfSet = members.some(
      ({ selectedArtifact }) =>
        selectedArtifact?.type === "2pc+2pc" &&
        selectedArtifact.normalizedHalfSetIds == null
    );
    return {
      kind: "team" as const,
      sourceRecordId,
      locator: {
        file: relativePath(LEGACY_RESEARCH_PATH),
        jsonPointer: `/teams/${index}`,
      },
      ...(team.name ? { name: team.name } : {}),
      ...(team.reaction ? { reactionLabel: team.reaction } : {}),
      ...(team.dpsIndex != null ? { sourceDpsIndex: team.dpsIndex } : {}),
      members,
      unknowns: [
        "originating page and per-row source",
        "game patch",
        "investment",
        "weapon refinements",
        "main stats",
        "substat priorities",
        "ER floors",
        "formula counts",
        "whether selected equipment is optimal or representative",
        ...(hasUnresolvedHalfSet
          ? ["unresolved legacy 2-piece set normalization"]
          : []),
      ],
    };
  });

  return LegacyTeamSnapshotSchema.parse({
    schemaVersion: 1,
    sourceId: "legacy-team-research",
    capturedAt,
    ...(source.meta?.generated
      ? { sourceGeneratedAt: source.meta.generated }
      : {}),
    sourceRevision: {
      files: [
        {
          path: relativePath(LEGACY_RESEARCH_PATH),
          sha256: await sha256File(LEGACY_RESEARCH_PATH),
        },
      ],
    },
    upstreamDomains: source.meta?.sources ?? [],
    records,
  });
}

function getCheckedAt(registry: SourceRegistry, sourceId: string): string {
  const source = registry.sources.find((entry) => entry.id === sourceId);
  if (!source) throw new Error(`Missing source registry entry ${sourceId}`);
  return source.checkedAt;
}

function relativePath(filePath: string): string {
  return filePath
    .slice(REPOSITORY_ROOT.length + 1)
    .replaceAll("\\", "/");
}

function toArtifactChoice(
  artifact:
    | { setId: string }
    | { halfSetIds: [string, string] }
    | null
): ArtifactChoice | null {
  if (!artifact) return null;
  if ("setId" in artifact) {
    return ArtifactChoiceSchema.parse({ type: "4pc", setId: artifact.setId });
  }
  return ArtifactChoiceSchema.parse({
    type: "2pc+2pc",
    halfSetIds: artifact.halfSetIds,
  });
}

function artifactFromBuild(build: RawBuild): ArtifactChoice {
  if (build.composition === "4pc" && build.artifactSet) {
    return ArtifactChoiceSchema.parse({
      type: "4pc",
      setId: build.artifactSet,
    });
  }
  if (
    build.composition === "2pc+2pc" &&
    build.halfSet1 &&
    build.halfSet2
  ) {
    return ArtifactChoiceSchema.parse({
      type: "2pc+2pc",
      halfSetIds: [build.halfSet1, build.halfSet2],
    });
  }
  throw new Error(`Build ${build.id} has an invalid artifact configuration`);
}

function artifactFromLegacy(
  artifactIds: string[] | undefined
): LegacyArtifactChoice | null {
  if (!artifactIds?.length) return null;
  if (artifactIds.length === 1) {
    return LegacyArtifactChoiceSchema.parse({
      type: "4pc",
      setId: artifactIds[0],
    });
  }
  if (artifactIds.length === 2) {
    const normalizedHalfSetIds = artifactIds.map((setId) =>
      HALF_SET_ID_BY_ARTIFACT_SET_ID.get(setId)
    );
    return LegacyArtifactChoiceSchema.parse({
      type: "2pc+2pc",
      sourceSetIds: [artifactIds[0], artifactIds[1]],
      normalizedHalfSetIds:
        normalizedHalfSetIds[0] && normalizedHalfSetIds[1]
          ? [normalizedHalfSetIds[0], normalizedHalfSetIds[1]]
          : null,
    });
  }
  throw new Error(`Unsupported legacy artifact list: ${artifactIds.join(", ")}`);
}
