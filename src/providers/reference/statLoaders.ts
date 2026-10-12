import { betaEnabled } from "@/config/beta";
import {
  type CharacterStatsMap,
  configureStatsLoaders,
  type WeaponStatsMap,
} from "@/domain/reference/stats";
import { withBetaOverlay } from "@/lib/resources/cache";
import { fetchGzipJson } from "@/providers/reference/fetchGzipJson";

configureStatsLoaders(
  withBetaOverlay<CharacterStatsMap>(
    () =>
      import("@/generated/catalog/character_stats.json").then(
        (m) => m.default as CharacterStatsMap
      ),
    () =>
      import("@/generated/catalog/character_beta_stats.json.gz?url").then((m) =>
        fetchGzipJson<CharacterStatsMap>(m.default)
      ),
    betaEnabled
  ),
  withBetaOverlay<WeaponStatsMap>(
    () =>
      import("@/generated/catalog/weapon_stats.json").then(
        (m) => m.default as WeaponStatsMap
      ),
    () =>
      import("@/generated/catalog/weapon_beta_stats.json.gz?url").then((m) =>
        fetchGzipJson<WeaponStatsMap>(m.default)
      ),
    betaEnabled
  )
);
