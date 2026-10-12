import { TRIAGE_BACKUP_AMOUNT_PRESETS } from "./constants";
import type { TriageBackupAmountMode, TriageSettings } from "./types";

export function inferTriageBackupAmountMode(
  settings: Pick<TriageSettings, "qualityMargin" | "fillerKeep" | "setSlotKeep">
): TriageBackupAmountMode {
  for (const [mode, preset] of Object.entries(TRIAGE_BACKUP_AMOUNT_PRESETS)) {
    if (
      settings.qualityMargin === preset.qualityMargin &&
      settings.fillerKeep === preset.fillerKeep &&
      settings.setSlotKeep === preset.setSlotKeep
    ) {
      return mode as TriageBackupAmountMode;
    }
  }
  return "custom";
}
