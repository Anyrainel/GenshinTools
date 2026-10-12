import type {
  ComboCountOverrides,
  MinErOverrides,
} from "@/domain/combat/analyzer/types";
import type { ExtraBuff, ReactionOverride } from "@/domain/combat/damage/types";
import type { Element } from "@/domain/enums";
import type { TeamSetupConfig } from "@/domain/team/types";

/** v22 shape: investment owned independent aura/buffs/reactions and exact
 * per-constellation counts; each config also stored a hypothetical C/R start.
 * v23: damage remains canonical shared input (deterministic precedence), while
 * divergent investment inputs/starts remain inspectable and explicitly adoptable.
 * Exact maps retain their exact old meaning; sparse future deltas are new data. */
export type LegacyAnalyzerConfig = {
  configs?: {
    charId: string;
    altWeapon?: { id: string; refinement?: number };
    startConstellation: number;
    startRefinement: number;
    maxConstellation: number;
    maxRefinement: number;
  }[];
  comboOverrides?: ComboCountOverrides;
  minErOverrides?: MinErOverrides;
  reactionOverrides?: Record<string, ReactionOverride>;
  enemyAura?: Element;
  extraBuffs?: ExtraBuff[];
};

export function migrateTeamAnalysisConfigs(
  configs: Record<string, TeamSetupConfig>
): Record<string, TeamSetupConfig> {
  return Object.fromEntries(
    Object.entries(configs).map(([id, config]) => {
      if (!config || typeof config !== "object")
        return [id, { combatOptions: {} }];
      const old = config.investment as
        | (LegacyAnalyzerConfig & NonNullable<TeamSetupConfig["investment"]>)
        | undefined;
      if (!old) return [id, config];
      if (typeof old !== "object" || Array.isArray(old))
        return [id, { ...config, investment: undefined }];
      const {
        comboOverrides,
        reactionOverrides,
        enemyAura,
        extraBuffs,
        configs: rawConfigs,
        ...rest
      } = old;
      const oldConfigs = Array.isArray(rawConfigs)
        ? rawConfigs.filter(
            (c) => c && typeof c === "object" && typeof c.charId === "string"
          )
        : undefined;
      const startingValues = Object.fromEntries(
        (oldConfigs ?? [])
          .filter(
            (c) =>
              typeof c.startConstellation === "number" ||
              typeof c.startRefinement === "number"
          )
          .map((c) => [
            c.charId,
            {
              constellation: c.startConstellation ?? 0,
              refinement: c.startRefinement ?? 0,
            },
          ])
      );
      const legacyInputs = {
        ...(rest.legacyInputs ?? {}),
        ...(reactionOverrides !== undefined ? { reactionOverrides } : {}),
        ...(enemyAura !== undefined ? { enemyAura } : {}),
        ...(extraBuffs !== undefined ? { extraBuffs } : {}),
        ...(Object.keys(startingValues).length ? { startingValues } : {}),
      };
      return [
        id,
        {
          ...config,
          investment: {
            ...rest,
            ...(oldConfigs
              ? {
                  configs: oldConfigs.map(
                    ({ startConstellation: _c, startRefinement: _r, ...c }) => c
                  ),
                }
              : {}),
            ...(comboOverrides
              ? {
                  legacyCountOverrides: {
                    ...comboOverrides,
                    ...(rest.legacyCountOverrides ?? {}),
                  },
                }
              : {}),
            ...(Object.keys(legacyInputs).length ? { legacyInputs } : {}),
          },
        },
      ];
    })
  );
}
