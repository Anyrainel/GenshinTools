import { artifacts, characters } from "../../data/resources";
import type {
  Build,
  BuildGroup,
  BuildPayloadV5,
  ComputeOptions,
} from "../../data/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BUILD_DATA_VERSION = 5;

// ---------------------------------------------------------------------------
// Export Payload Generation (V5)
// ---------------------------------------------------------------------------

// Base64 conversion for BigInt (URL-safe alphabet)
const BASE64_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const toBase64 = (num: bigint): string => {
  if (num === 0n) return "0";
  let result = "";
  let n = num;
  while (n > 0n) {
    result = BASE64_CHARS[Number(n % 64n)] + result;
    n /= 64n;
  }
  return result;
};

const getStylesMask = (styles: string[] | undefined): number => {
  if (!styles) return 0;
  let mask = 0;
  if (styles.includes("on-field")) mask += 1;
  if (styles.includes("off-field")) mask += 2;
  return mask;
};

const getRolesMask = (roles: string[] | undefined): number => {
  if (!roles) return 0;
  let mask = 0;
  if (roles.includes("dps")) mask += 1;
  if (roles.includes("support")) mask += 2;
  if (roles.includes("sustain")) mask += 4;
  return mask;
};

const getCharacterIndex = (charId: string): number => {
  const index = characters.findIndex((c) => c.id === charId);
  if (index === -1) return 999;
  return characters.length - index;
};

const getArtifactCode = (build: Build): number => {
  if (build.composition === "4pc") {
    const setId = build.artifactSet;
    const index = artifacts.findIndex((a) => a.id === setId);
    const revIndex = index === -1 ? 0 : artifacts.length - index;
    // 4 + padded 4 digits
    return 40000 + revIndex;
  }

  if (build.composition === "2pc+2pc") {
    const h1 = build.halfSet1 ?? 0;
    const h2 = build.halfSet2 ?? 0;
    const sorted = [h1, h2].sort((a, b) => a - b);
    // 2 + 2 digits + 2 digits (assumes halfSetId <= 99)
    return 20000 + (sorted[0] % 100) * 100 + (sorted[1] % 100);
  }

  return 0; // Fallback
};

const getMetadataCode = (build: Build): number => {
  const styles = getStylesMask(build.styles); // 0-3
  const roles = getRolesMask(build.roles); // 0-7
  const cons = build.minCons ?? 0; // 0-6

  // Styles (1 digit) + Roles (1 digit) + Cons (1 digit)
  return styles * 100 + roles * 10 + cons;
};

export const createBuildExportPayloadV5 = (
  groups: BuildGroup[],
  computeOptions: ComputeOptions,
  author: string,
  description: string
): BuildPayloadV5 => {
  const payload: BuildPayloadV5 = {
    version: 5,
    id: `export-${Date.now()}`,
    author,
    description,
    builds: {},
    characterBuilds: {},
    characterWeapons: {},
    computeOptions,
  };

  // Collect all builds first to handle naming collisions
  type BuildInfo = {
    originalBuild: Build;
    prefix: bigint; // Steps 1-3
    name: string;
    groupId: string; // Character ID for reconstruction
  };

  const allBuilds: BuildInfo[] = [];

  for (const group of groups) {
    if (group.builds.length > 0) {
      for (const build of group.builds) {
        // Step 1: Char Code
        const charCode = BigInt(getCharacterIndex(build.characterId));

        // Step 2: Artifact Code
        const artCode = BigInt(getArtifactCode(build));

        // Step 3: Metadata Code
        const metaCode = BigInt(getMetadataCode(build));

        // Construct Prefix: CCC AAAAA MMM (Total 11 digits approx)
        // 3 digits + 5 digits + 3 digits
        // charCode * 10^8 + artCode * 10^3 + metaCode
        const prefix = charCode * 100000000n + artCode * 1000n + metaCode;

        allBuilds.push({
          originalBuild: build,
          prefix,
          name: build.name.trim(),
          groupId: group.characterId,
        });
      }
    }

    // Weapon export remains same
    if (group.weapons && group.weapons.length > 0) {
      payload.characterWeapons[group.characterId] = group.weapons;
    }
  }

  // Handle collision and assign Index (Step 4)
  // Group by Prefix
  const prefixGroups = new Map<bigint, BuildInfo[]>();
  for (const info of allBuilds) {
    const list = prefixGroups.get(info.prefix) ?? [];
    list.push(info);
    prefixGroups.set(info.prefix, list);
  }

  // Process groups
  const oldIdToNewId = new Map<string, string>();

  for (const [prefix, list] of prefixGroups.entries()) {
    // Sort by name for deterministic ID assignment + collision detection
    list.sort((a, b) => a.name.localeCompare(b.name));

    // Check duplicates
    for (let i = 0; i < list.length - 1; i++) {
      if (list[i].name === list[i + 1].name) {
        const buildName = list[i].name ? `"${list[i].name}"` : "(unnamed)";
        throw new Error(
          `Export failed: Duplicate build definition detected. Build ${buildName} for character "${list[i].groupId}" conflicts with another build with identical settings. Please rename one of them to distinguish.`
        );
      }
    }

    // Assign index and generate ID
    list.forEach((info, index) => {
      // Step 4: Index 2 digits
      const fullNum = prefix * 100n + BigInt(index);
      const newId = toBase64(fullNum);

      const newBuild: Build = {
        ...info.originalBuild,
        id: newId,
        // Ensure key order
        characterId: info.originalBuild.characterId,
        visible: info.originalBuild.visible,
        styles: info.originalBuild.styles,
        roles: info.originalBuild.roles,
        minCons: info.originalBuild.minCons,
        name: info.originalBuild.name,
        composition: info.originalBuild.composition,
        artifactSet: info.originalBuild.artifactSet,
        halfSet1: info.originalBuild.halfSet1,
        halfSet2: info.originalBuild.halfSet2,
        sands: info.originalBuild.sands,
        goblet: info.originalBuild.goblet,
        circlet: info.originalBuild.circlet,
        substats: info.originalBuild.substats,
      };

      payload.builds[newId] = newBuild;
      oldIdToNewId.set(info.originalBuild.id, newId);
    });
  }

  // Populate characterBuilds preserving original group ordering
  for (const group of groups) {
    const newIds = group.builds
      .map((b) => oldIdToNewId.get(b.id))
      .filter((id): id is string => id !== undefined);
    if (newIds.length > 0) {
      payload.characterBuilds[group.characterId] = newIds;
    }
  }

  return payload;
};

export const serializeBuildExportPayload = (
  groups: BuildGroup[],
  computeOptions: ComputeOptions,
  author: string,
  description: string
): string => {
  return JSON.stringify(
    createBuildExportPayloadV5(groups, computeOptions, author, description),
    null,
    2
  );
};
