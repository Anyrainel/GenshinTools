import { artifactIdToHalfSetId } from "@/data/constants";
import type { AccountData, ArtifactData } from "@/data/types";
import type { CharCompConfig } from "@/lib/team-comp/types";
import type { Team } from "@/stores/useTeamStore";

export interface TeamOptDetailProps {
  team: Team;
  onBack: () => void;
}

export interface DetectedSets {
  artifactSetId: string | null;
  artifactHalfSetIds: string[];
}

/** Detect what artifact set bonuses the equipped pieces actually form. */
export function detectEquippedSets(artifacts: ArtifactData[]): DetectedSets {
  const setCounts: Record<string, number> = {};
  for (const art of artifacts) {
    setCounts[art.setKey] = (setCounts[art.setKey] || 0) + 1;
  }

  // 4pc check
  for (const [setKey, count] of Object.entries(setCounts)) {
    if (count >= 4) {
      return { artifactSetId: setKey, artifactHalfSetIds: [] };
    }
  }

  // 2pc+2pc check
  const twoPcSets = Object.entries(setCounts)
    .filter(([, count]) => count >= 2)
    .map(([setKey]) => setKey);

  if (twoPcSets.length >= 2) {
    const halfSetIds = twoPcSets
      .slice(0, 2)
      .map((setKey) => {
        const hsId = artifactIdToHalfSetId[setKey];
        return hsId ?? "";
      })
      .filter(Boolean);
    return { artifactSetId: null, artifactHalfSetIds: halfSetIds };
  }

  // Single 2pc
  if (twoPcSets.length === 1) {
    const hsId = artifactIdToHalfSetId[twoPcSets[0]];
    return {
      artifactSetId: null,
      artifactHalfSetIds: hsId != null ? [hsId] : [],
    };
  }

  return { artifactSetId: null, artifactHalfSetIds: [] };
}

/** Check if equipped sets match the goal sets from team config. */
export function setsMatch(
  goal: Team["artifacts"][number],
  equipped: DetectedSets
): boolean {
  if (!goal) return true;
  if (goal.type === "4pc") {
    return equipped.artifactSetId === goal.setId;
  }
  if (goal.type === "2pc+2pc") {
    const goalIds = [String(goal.id1), String(goal.id2)].sort();
    const eqIds = [...equipped.artifactHalfSetIds].sort();
    return goalIds[0] === eqIds[0] && goalIds[1] === eqIds[1];
  }
  return true;
}

/**
 * Build TeamBuild configs using ACTUAL equipped artifact sets (for accurate
 * damage calc). Falls back to goal sets if no artifacts are equipped.
 */
export function buildTeamConfigs(
  team: Team,
  accountData: AccountData | null
): CharCompConfig[] {
  const configs: CharCompConfig[] = [];
  for (let i = 0; i < 4; i++) {
    const charId = team.characters[i];
    if (!charId) continue;

    const acctChar = accountData?.characters.find((c) => c.key === charId);
    const defaultLevel = acctChar ? (acctChar.level > 90 ? 100 : 90) : 90;
    const defaultConst = acctChar ? acctChar.constellation : 0;

    const charLevel =
      team.opts?.[`${charId}.overrideLevel`] !== undefined
        ? Number(team.opts[`${charId}.overrideLevel`])
        : defaultLevel;
    const constellation =
      team.opts?.[`${charId}.overrideConstellation`] !== undefined
        ? Number(team.opts[`${charId}.overrideConstellation`])
        : defaultConst;

    let defaultRefine = 1;
    const weaponId = team.weapons[i] || "dull_blade";
    if (weaponId && accountData) {
      const acctWeapons = accountData.extraWeapons.filter(
        (w) => w.key === weaponId
      );
      if (acctWeapons.length > 0) {
        defaultRefine = Math.max(...acctWeapons.map((w) => w.refinement));
      }
    }

    const refinement =
      team.opts?.[`${charId}.overrideRefinement`] !== undefined
        ? Number(team.opts[`${charId}.overrideRefinement`])
        : defaultRefine;

    // Detect equipped artifact sets for accurate damage calc
    let artifactSetId: string | null = null;
    let artifactHalfSetIds: string[] = [];

    if (accountData) {
      const acctChar = accountData.characters.find((c) => c.key === charId);
      if (acctChar) {
        const equipped = Object.values(acctChar.artifacts || {});
        if (equipped.length > 0) {
          const detected = detectEquippedSets(equipped);
          artifactSetId = detected.artifactSetId;
          artifactHalfSetIds = detected.artifactHalfSetIds;
        }
      }
    }

    // Fallback to goal sets if no equipped artifacts found
    if (!artifactSetId && artifactHalfSetIds.length === 0) {
      const artConfig = team.artifacts[i];
      if (artConfig) {
        if (artConfig.type === "4pc") {
          artifactSetId = artConfig.setId;
        } else if (artConfig.type === "2pc+2pc") {
          artifactHalfSetIds = [String(artConfig.id1), String(artConfig.id2)];
        }
      }
    }

    configs.push({
      charId,
      charLevel,
      constellation,
      weaponId,
      refinement,
      artifactSetId,
      artifactHalfSetIds,
    });
  }
  return configs;
}
