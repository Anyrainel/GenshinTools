import type { AccountData, ArtifactData, Slot } from "@/data/types";
import {
  type IGOODArtifact,
  convertSingleArtifact,
} from "@/lib/account-data/goodConversion";
import { goodKeyToCharId } from "./keys";
import type { InstructionResult, ManagePayload } from "./types";

const SYNC_STATUSES = new Set(["success", "already_correct"]);

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
    const art = convertSingleArtifact(goodArtifacts[i], `artifact-${i}`);
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
