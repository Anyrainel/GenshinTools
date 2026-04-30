import { useEffect } from "react";
import { loadPresetPayload } from "@/lib/presetLoader";
import { getCachedTeamPreset } from "@/lib/team-comp/teamPresetRegistry";
import type { TeamCompData } from "@/lib/team-comp/types";
import { useTeamStore } from "@/stores/useTeamStore";

const teamPresetModules = import.meta.glob<{ default: TeamCompData }>(
  "@/presets/team-comp/*.json",
  { eager: false }
);

export function useHydrateTeamPreset(): void {
  const activePresetId = useTeamStore((state) => state.activePresetId);
  const hydratePreset = useTeamStore((state) => state.hydratePreset);

  useEffect(() => {
    if (!activePresetId) return;
    const cached = getCachedTeamPreset(activePresetId);
    if (cached) {
      hydratePreset(activePresetId, cached);
      return;
    }
    loadPresetPayload(teamPresetModules, activePresetId)
      .then((data) => hydratePreset(activePresetId, data))
      .catch((error) => {
        console.error("Failed to hydrate team preset", error);
      });
  }, [activePresetId, hydratePreset]);
}
