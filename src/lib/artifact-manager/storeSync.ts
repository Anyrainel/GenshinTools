import type {
  AccountData,
  ArtifactData,
  MainStat,
  Slot,
  SubStat,
} from "@/data/types";
import { solveArtifact } from "@/lib/account-data/artifactSolver";
import type { IGOODArtifact } from "@/lib/account-data/goodConversion";
import { goodKeyToArtifactSetId, goodKeyToCharId } from "./keys";
import type { Instruction, InstructionResult } from "./types";

const SYNC_STATUSES = new Set(["success", "already_correct"]);

/**
 * Apply job results to account data, returning a new AccountData.
 * Only applies changes for instructions with success/already_correct status.
 * Pure function — does not mutate inputs.
 */
export function applyJobResults(
  account: AccountData,
  instructions: Instruction[],
  results: InstructionResult[]
): AccountData {
  // Build lookup: instruction id → instruction for successful results
  const lookup = new Map<string, Instruction>();
  for (const inst of instructions) {
    const res = results.find((r) => r.id === inst.id);
    if (res && SYNC_STATUSES.has(res.status)) {
      lookup.set(inst.id, inst);
    }
  }

  if (lookup.size === 0) return account;

  // Deep clone the parts we need to mutate
  const newCharacters = account.characters.map((c) => ({
    ...c,
    artifacts: { ...c.artifacts } as Partial<Record<Slot, ArtifactData>>,
  }));
  const newExtra = [...account.extraArtifacts];

  // Helper: find and update an artifact by ID across all locations
  function updateArtifact(
    id: string,
    updater: (art: ArtifactData) => ArtifactData
  ): void {
    for (const char of newCharacters) {
      for (const [slot, art] of Object.entries(char.artifacts)) {
        if (art && art.id === id) {
          char.artifacts[slot as Slot] = updater({ ...art });
          return;
        }
      }
    }
    const idx = newExtra.findIndex((a) => a.id === id);
    if (idx !== -1) {
      newExtra[idx] = updater({ ...newExtra[idx] });
    }
  }

  for (const [id, instruction] of lookup) {
    if (instruction.changes.lock != null) {
      updateArtifact(id, (art) => ({
        ...art,
        lock: instruction.changes.lock!,
      }));
    }
  }

  return {
    ...account,
    characters: newCharacters,
    extraArtifacts: newExtra,
    extraWeapons: account.extraWeapons,
  };
}

// GOOD stat key → internal key
const statKeyMap: Record<string, string> = {
  hp: "hp",
  hp_: "hp%",
  atk: "atk",
  atk_: "atk%",
  def: "def",
  def_: "def%",
  eleMas: "em",
  enerRech_: "er",
  heal_: "heal%",
  critRate_: "cr",
  critDMG_: "cd",
  physical_dmg_: "phys%",
  anemo_dmg_: "anemo%",
  geo_dmg_: "geo%",
  electro_dmg_: "electro%",
  hydro_dmg_: "hydro%",
  pyro_dmg_: "pyro%",
  cryo_dmg_: "cryo%",
  dendro_dmg_: "dendro%",
};

const slotKeyMap: Record<string, Slot> = {
  flower: "flower",
  plume: "plume",
  sands: "sands",
  goblet: "goblet",
  circlet: "circlet",
};

function convertGOODArtifact(
  art: IGOODArtifact,
  index: number
): ArtifactData | null {
  const setKey = goodKeyToArtifactSetId(art.setKey);
  const mainStatKey = statKeyMap[art.mainStatKey] as MainStat | undefined;
  const slotKey = slotKeyMap[art.slotKey];
  if (!setKey || !mainStatKey || !slotKey) return null;

  const substats: Partial<Record<SubStat, number>> = {};
  for (const sub of art.substats) {
    const key = statKeyMap[sub.key] as SubStat;
    if (key) substats[key] = sub.value;
  }

  // Solve for precise substat values
  const solved = solveArtifact({
    rarity: art.rarity as 4 | 5,
    level: art.level,
    substats,
    totalRolls: art.totalRolls,
  });
  if (solved) {
    for (const [k, v] of Object.entries(solved)) {
      if (v !== undefined) substats[k as SubStat] = v;
    }
  }

  return {
    id: `artifact-${index}`,
    setKey,
    slotKey,
    level: art.level,
    rarity: art.rarity as 4 | 5,
    mainStatKey,
    lock: art.lock,
    substats,
    ...(art.astralMark !== undefined && { astralMark: art.astralMark }),
    ...(art.elixirCrafted !== undefined && {
      elixirCrafted: art.elixirCrafted,
    }),
  };
}

/**
 * Replace all artifacts in account data from a full GOOD v3 snapshot.
 * Characters and weapons are preserved; only artifact slots and extraArtifacts
 * are rebuilt from the snapshot.
 */
export function replaceArtifactsFromSnapshot(
  account: AccountData,
  goodArtifacts: IGOODArtifact[]
): AccountData {
  // Clear all artifact slots on characters, keeping everything else
  const characters = account.characters.map((c) => ({
    ...c,
    artifacts: {} as Partial<Record<Slot, ArtifactData>>,
  }));
  const charByKey = new Map(characters.map((c) => [c.key, c]));
  const extraArtifacts: ArtifactData[] = [];

  for (let i = 0; i < goodArtifacts.length; i++) {
    const art = convertGOODArtifact(goodArtifacts[i], i);
    if (!art) continue;

    const location = goodArtifacts[i].location;
    if (location) {
      const charId = goodKeyToCharId(location);
      const char = charId ? charByKey.get(charId) : undefined;
      if (char) {
        char.artifacts[art.slotKey] = art;
        continue;
      }
    }
    extraArtifacts.push(art);
  }

  return {
    ...account,
    characters,
    extraArtifacts,
  };
}
