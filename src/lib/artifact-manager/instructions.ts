import type { ArtifactData, Slot } from "@/data/types";
import type { TriageDecision } from "@/lib/account-data/triage";
import { artifactIdToGOODKey, charIdToGOODKey } from "./keys";
import type { Instruction, InstructionTarget } from "./types";

function buildTarget(art: ArtifactData): InstructionTarget {
  const setKey = artifactIdToGOODKey(art.setKey);
  if (!setKey) {
    throw new Error(`Unknown artifact set: ${art.setKey}`);
  }
  return {
    setKey,
    slotKey: art.slotKey,
    rarity: art.rarity,
    level: art.level,
    mainStatKey: art.mainStatKey,
    substats: Object.entries(art.substats).map(([key, value]) => ({
      key,
      value: Math.round(value * 10) / 10,
    })),
  };
}

export function buildTriageInstructions(
  decisions: TriageDecision[]
): Instruction[] {
  const instructions: Instruction[] = [];
  for (const d of decisions) {
    const wantLock = d.label === "lock";
    if (d.artifact.lock === wantLock) continue;
    instructions.push({
      id: d.artifact.id,
      target: buildTarget(d.artifact),
      changes: { lock: wantLock },
    });
  }
  return instructions;
}

export function buildEquipInstructions(
  artifactsByChar: Record<string, Partial<Record<Slot, ArtifactData | null>>>
): Instruction[] {
  const instructions: Instruction[] = [];
  for (const [charId, slots] of Object.entries(artifactsByChar)) {
    const charKey = charIdToGOODKey(charId);
    if (!charKey) continue;
    for (const art of Object.values(slots)) {
      if (!art) continue;
      instructions.push({
        id: art.id,
        target: buildTarget(art),
        changes: { location: charKey },
      });
    }
  }
  return instructions;
}
