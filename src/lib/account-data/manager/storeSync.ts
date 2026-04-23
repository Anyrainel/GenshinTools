import type { Slot } from "@/data/enums";
import type { AccountData, ArtifactData, CharacterData } from "@/data/types";
import {
  convertSingleArtifact,
  type IGOODArtifact,
} from "@/lib/account-data/import/goodConversion";
import type { MergeResult } from "@/lib/account-data/import/mergeAccountData";
import { goodKeyToCharId } from "./keys";
import type { EquipPayload, InstructionResult, ManagePayload } from "./types";

const SYNC_STATUSES = new Set(["success", "already_correct"]);

function makeStubCharacter(key: string): CharacterData {
  return {
    key,
    level: 90,
    constellation: 0,
    talent: { auto: 1, skill: 1, burst: 1 },
    artifacts: {},
  };
}

/**
 * Apply job results to account data, returning a new AccountData.
 * Only applies changes for results with success/already_correct status.
 * Maps positional result IDs (lock:0, unlock:1) back to internal artifact IDs.
 * Pure function — does not mutate inputs.
 */
export function applyJobResults(
  account: AccountData,
  payload: ManagePayload,
  results: InstructionResult[]
): AccountData {
  // Build map: internal artifact ID → desired lock state
  const changes = new Map<string, boolean>();
  for (const result of results) {
    if (!SYNC_STATUSES.has(result.status)) continue;
    const [list, indexStr] = result.id.split(":");
    const index = Number(indexStr);
    if (list === "lock" && index < payload.lockIds.length) {
      changes.set(payload.lockIds[index], true);
    } else if (list === "unlock" && index < payload.unlockIds.length) {
      changes.set(payload.unlockIds[index], false);
    }
  }

  if (changes.size === 0) return account;

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

  for (const [id, lock] of changes) {
    updateArtifact(id, (art) => ({ ...art, lock }));
  }

  return {
    ...account,
    characters: newCharacters,
    extraArtifacts: newExtra,
    extraWeapons: account.extraWeapons,
  };
}

/**
 * Replace all artifacts in account data from a full GOOD v3 snapshot.
 * Characters and weapons are preserved; only artifact slots and extraArtifacts
 * are rebuilt from the snapshot.
 *
 * Returns a MergeResult with the old→new artifact ID mapping so that
 * downstream stores (e.g. freeze store) can update their references.
 */
export function rebuildAccountFromSnapshot(
  account: AccountData,
  goodArtifacts: IGOODArtifact[]
): MergeResult {
  // Collect all existing artifact IDs before replacement
  const oldArtifactIds: string[] = [];
  for (const c of account.characters) {
    for (const art of Object.values(c.artifacts)) {
      if (art) oldArtifactIds.push(art.id);
    }
  }
  for (const art of account.extraArtifacts) {
    oldArtifactIds.push(art.id);
  }

  // Clear all artifact slots on characters, keeping everything else
  const characters = account.characters.map((c) => ({
    ...c,
    artifacts: {} as Partial<Record<Slot, ArtifactData>>,
  }));
  const charByKey = new Map(characters.map((c) => [c.key, c]));
  const extraArtifacts: ArtifactData[] = [];

  for (let i = 0; i < goodArtifacts.length; i++) {
    const art = convertSingleArtifact(goodArtifacts[i], `artifact-${i}`);
    if (!art) continue;

    const location = goodArtifacts[i].location;
    if (location) {
      const charId = goodKeyToCharId(location);
      if (charId) {
        let char = charByKey.get(charId);
        if (!char) {
          // Character not in account — create a stub so artifacts stay placed
          char = makeStubCharacter(charId);
          characters.push(char);
          charByKey.set(charId, char);
        }
        char.artifacts[art.slotKey] = art;
        continue;
      }
    }
    extraArtifacts.push(art);
  }

  // Full replacement creates entirely new IDs — all old IDs are orphaned.
  // We can't build a meaningful old→new map (artifacts may have changed),
  // so we signal "all old IDs are gone" by mapping every old ID to empty string.
  const artifactIdMap = new Map<string, string>();
  for (const oldId of oldArtifactIds) {
    artifactIdMap.set(oldId, "");
  }

  return {
    data: {
      ...account,
      characters,
      extraArtifacts,
    },
    artifactIdMap,
  };
}

/**
 * Apply equip job results to account data, returning a new AccountData.
 * Mimics the game's implicit swap behavior: when equipping artifact A onto
 * character X in a slot that already has artifact B, B goes wherever A came from.
 * Pure function — does not mutate inputs.
 */
export function applyEquipResults(
  account: AccountData,
  payload: EquipPayload,
  results: InstructionResult[]
): AccountData {
  // Collect successful equip operations
  const ops: {
    artifactId: string;
    fromChar: string | null;
    toChar: string;
  }[] = [];
  for (const result of results) {
    if (result.status !== "success") continue;
    const [prefix, indexStr] = result.id.split(":");
    if (prefix !== "equip") continue;
    const index = Number(indexStr);
    if (index >= payload.artifactIds.length) continue;
    const artId = payload.artifactIds[index];
    const swap = payload.swapMap.get(artId);
    if (!swap) continue;
    ops.push({
      artifactId: artId,
      fromChar: swap.fromChar,
      toChar: swap.toChar,
    });
  }

  if (ops.length === 0) return account;

  // Deep clone characters and extraArtifacts
  const newCharacters = account.characters.map((c) => ({
    ...c,
    artifacts: { ...c.artifacts } as Partial<Record<Slot, ArtifactData>>,
  }));
  const newExtra = [...account.extraArtifacts];
  const charByKey = new Map(newCharacters.map((c) => [c.key, c]));

  for (const op of ops) {
    const toChar = charByKey.get(op.toChar);
    if (!toChar) continue;

    // Find the artifact being equipped
    let artifact: ArtifactData | undefined;

    // Check if it's on a character
    if (op.fromChar) {
      const fromChar = charByKey.get(op.fromChar);
      if (fromChar) {
        for (const [slot, art] of Object.entries(fromChar.artifacts)) {
          if (art && art.id === op.artifactId) {
            artifact = art;
            delete fromChar.artifacts[slot as Slot];
            break;
          }
        }
      }
    }

    // Check extraArtifacts if not found on a character
    if (!artifact) {
      const idx = newExtra.findIndex((a) => a.id === op.artifactId);
      if (idx !== -1) {
        artifact = newExtra[idx];
        newExtra.splice(idx, 1);
      }
    }

    if (!artifact) continue;

    const targetSlot = artifact.slotKey as Slot;

    // Handle displacement: what's currently in the target slot?
    const displaced = toChar.artifacts[targetSlot];
    if (displaced) {
      if (op.fromChar) {
        const fromChar = charByKey.get(op.fromChar);
        if (fromChar) {
          fromChar.artifacts[targetSlot] = displaced;
        } else {
          newExtra.push(displaced);
        }
      } else {
        newExtra.push(displaced);
      }
    }

    // Place the artifact on the target character
    toChar.artifacts[targetSlot] = artifact;
  }

  return {
    ...account,
    characters: newCharacters,
    extraArtifacts: newExtra,
    extraWeapons: account.extraWeapons,
  };
}

// Snapshot diff — count-based summary for user confirmation

export interface SnapshotDiff {
  localCount: number;
  snapshotCount: number;
  localLocked: number;
  snapshotLocked: number;
}

export function computeSnapshotDiff(
  account: AccountData,
  snapshot: IGOODArtifact[]
): SnapshotDiff {
  let localCount = 0;
  let localLocked = 0;
  for (const c of account.characters) {
    for (const art of Object.values(c.artifacts)) {
      if (art) {
        localCount++;
        if (art.lock) localLocked++;
      }
    }
  }
  for (const art of account.extraArtifacts) {
    localCount++;
    if (art.lock) localLocked++;
  }

  const snapshotCount = snapshot.length;
  const snapshotLocked = snapshot.filter((a) => a.lock).length;

  return { localCount, snapshotCount, localLocked, snapshotLocked };
}

// Job result analysis — groups results by status for UI display

export interface JobAnalysis {
  successCount: number;
  alreadyCorrectCount: number;
  notFoundCount: number;
  errorCount: number;
  hasDiscrepancies: boolean;
}

export function analyzeManageResults(
  payload: ManagePayload,
  results: InstructionResult[]
): JobAnalysis {
  let successCount = 0;
  let alreadyCorrectCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const r of results) {
    const [list, indexStr] = r.id.split(":");
    const index = Number(indexStr);
    // Validate this result maps to a real instruction
    if (list === "lock" && index >= payload.lockIds.length) continue;
    if (list === "unlock" && index >= payload.unlockIds.length) continue;
    if (list !== "lock" && list !== "unlock") continue;

    switch (r.status) {
      case "success":
        successCount++;
        break;
      case "already_correct":
        alreadyCorrectCount++;
        break;
      case "not_found":
        notFoundCount++;
        break;
      default:
        errorCount++;
        break;
    }
  }

  return {
    successCount,
    alreadyCorrectCount,
    notFoundCount,
    errorCount,
    hasDiscrepancies:
      notFoundCount > 0 || alreadyCorrectCount > 0 || errorCount > 0,
  };
}
