import type { AccountData, ArtifactData, Slot } from "@/data/types";
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
