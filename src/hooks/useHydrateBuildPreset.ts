import { useEffect } from "react";
import {
  getCachedBuildPreset,
  loadBuildPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import { useBuildsStore } from "@/stores/useBuildsStore";

export function useHydrateBuildPreset(): void {
  const activePresetId = useBuildsStore((state) => state.activePresetId);
  const hydratePreset = useBuildsStore((state) => state.hydratePreset);

  useEffect(() => {
    if (!activePresetId) return;
    const cached = getCachedBuildPreset(activePresetId);
    if (cached) {
      hydratePreset(activePresetId, cached);
      return;
    }
    loadBuildPreset(activePresetId)
      .then((payload) => hydratePreset(activePresetId, payload))
      .catch((error) => {
        console.error("Failed to hydrate build preset", error);
      });
  }, [activePresetId, hydratePreset]);
}
