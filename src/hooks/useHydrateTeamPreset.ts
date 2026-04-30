import { useEffect } from "react";
import {
  getCachedTeamPreset,
  loadTeamPreset,
} from "@/lib/team-comp/teamPresetRegistry";
import { useTeamStore } from "@/stores/useTeamStore";

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
    loadTeamPreset(activePresetId)
      .then((data) => hydratePreset(activePresetId, data))
      .catch((error) => {
        console.error("Failed to hydrate team preset", error);
      });
  }, [activePresetId, hydratePreset]);
}
