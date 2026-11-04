import type { TeamSetupConfig } from "@/domain/team/types";

// Team v25/cloud v7 used four carried Beacons for every C0 steady-mode team.
// The old 120 EM identity remains valid on reaction-capable teams. Seed the new
// three-Beacon 90 EM identity once at the version boundary, retaining 120 EM.
// Never run this on current saves: doing so could restore an intentionally
// deleted 90 EM override from the still-valid 120 EM variant.
const SOURCE = ["character", "mitya", "P1", "", "", "", "", "E"].join("\u0000");
const TARGET = ["team", "", "", "", "", "", ""].join("\u0000");
const OLD_KEY = `mitya\u0003${[SOURCE, TARGET, "em:120", "StatBuff", ""].join("\u0002")}`;
const NEW_KEY = `mitya\u0003${[SOURCE, TARGET, "em:90", "StatBuff", ""].join("\u0002")}`;

export function migrateLegacyMityaBeaconConfigs(
  configs: Record<string, TeamSetupConfig>
): Record<string, TeamSetupConfig> {
  return Object.fromEntries(
    Object.entries(configs).map(([id, config]) => {
      const combo = config.damage?.combo;
      if (!combo?.buffOverrides) return [id, config];
      return [
        id,
        {
          ...config,
          damage: {
            ...config.damage,
            combo: {
              ...combo,
              buffOverrides: Object.fromEntries(
                Object.entries(combo.buffOverrides).map(([line, buffs]) => [
                  line,
                  Object.hasOwn(buffs, OLD_KEY) &&
                  !Object.hasOwn(buffs, NEW_KEY)
                    ? { ...buffs, [NEW_KEY]: buffs[OLD_KEY] }
                    : buffs,
                ])
              ),
            },
          },
        },
      ];
    })
  );
}
