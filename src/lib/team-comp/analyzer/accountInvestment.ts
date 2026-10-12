import { charactersById, weaponsById } from "@/data/gameResources";
import { getCharacterLevelTier } from "@/data/gameStatsLoader";
import type { AccountData } from "@/data/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import { detectEquippedSets } from "../teamConfigUtils";
import { deriveComboForAllocation } from "./analyzer";
import type {
  AnalyzerCharConfig,
  AnalyzerOptions,
  TeamInvestment,
} from "./types";

export type AccountInvestmentCandidate = {
  charId: string;
  kind: "constellation" | "refinement" | "weapon";
  from: number;
  to: number;
  weaponId?: string;
  configs: TeamSlotConfig[];
};

export type AccountInvestmentResult = {
  baselineDamage: number;
  recommendations: (AccountInvestmentCandidate & {
    damage: number;
    gain: number;
    gainPct: number;
  })[];
};

/** Hypothetical full-path starts never override this equipped account baseline. */
export function buildAccountInvestmentBaseline(
  charIds: string[],
  account: AccountData
): TeamSlotConfig[] | null {
  const configs: TeamSlotConfig[] = [];
  for (const charId of charIds) {
    const char = account.characters.find((c) => c.key === charId);
    if (!char?.weapon) return null;
    configs.push({
      charId,
      charLevel: Number(getCharacterLevelTier(char.level)),
      constellation: char.constellation,
      weaponId: char.weapon.key,
      refinement: char.weapon.refinement,
      talentLevels: char.talent,
      artifactSet: detectEquippedSets(Object.values(char.artifacts)),
    });
  }
  return configs.length ? configs : null;
}

/** Each alternative costs one copy and changes only one member from the same baseline. */
export function buildAccountInvestmentCandidates(
  baseline: TeamSlotConfig[],
  selected: AnalyzerCharConfig[],
  account: AccountData
): AccountInvestmentCandidate[] {
  const candidates: AccountInvestmentCandidate[] = [];
  const ownedWeapons = new Set([
    ...account.extraWeapons.map((w) => w.key),
    ...account.characters.flatMap((c) => (c.weapon ? [c.weapon.key] : [])),
  ]);
  for (const base of baseline) {
    const chosen = selected.find((c) => c.charId === base.charId);
    const add = (
      change: Omit<AccountInvestmentCandidate, "configs" | "charId">,
      patch: Partial<TeamSlotConfig>
    ) => {
      candidates.push({
        ...change,
        charId: base.charId,
        configs: baseline.map((c) =>
          c.charId === base.charId ? { ...c, ...patch } : c
        ),
      });
    };
    if (charactersById[base.charId]?.rarity === 5 && base.constellation < 6) {
      add(
        {
          kind: "constellation",
          from: base.constellation,
          to: base.constellation + 1,
        },
        { constellation: base.constellation + 1 }
      );
    }
    if (weaponsById[base.weaponId]?.rarity === 5 && base.refinement < 5) {
      add(
        {
          kind: "refinement",
          from: base.refinement,
          to: base.refinement + 1,
          weaponId: base.weaponId,
        },
        { refinement: base.refinement + 1 }
      );
    }
    const target = chosen?.weapon5Star?.id;
    // An owned alternative is a free equipment swap, not an R1 purchase.
    if (
      target &&
      weaponsById[target]?.rarity === 5 &&
      !ownedWeapons.has(target)
    ) {
      add(
        { kind: "weapon", from: 0, to: 1, weaponId: target },
        { weaponId: target, refinement: 1 }
      );
    }
  }
  return candidates;
}

export function rankAccountInvestments(
  baseline: TeamSlotConfig[],
  candidates: AccountInvestmentCandidate[],
  evaluate: (configs: TeamSlotConfig[]) => number
): AccountInvestmentResult {
  const baselineDamage = evaluate(baseline);
  if (!Number.isFinite(baselineDamage))
    throw new Error("Non-finite account damage");
  const recommendations = candidates.map((candidate) => {
    const damage = evaluate(candidate.configs);
    if (!Number.isFinite(damage))
      throw new Error("Non-finite investment damage");
    const gain = damage - baselineDamage;
    return {
      ...candidate,
      damage,
      gain,
      gainPct: baselineDamage > 0 ? (gain / baselineDamage) * 100 : 0,
    };
  });
  recommendations.sort((a, b) => b.damage - a.damage);
  return { baselineDamage, recommendations: recommendations.slice(0, 3) };
}

export function computeAccountInvestments(
  account: AccountData,
  baseline: TeamSlotConfig[],
  selected: AnalyzerCharConfig[],
  options: Pick<
    AnalyzerOptions,
    | "teamBuild"
    | "templateCombo"
    | "comboOverrides"
    | "calcContext"
    | "futureCountChanges"
    | "singleObjective"
    | "ignoredContributorIds"
  >
): AccountInvestmentResult {
  const sheets = Object.fromEntries(
    baseline.map((config) => {
      const char = account.characters.find((c) => c.key === config.charId)!;
      return [
        config.charId,
        StatSheet.fromArtifacts(Object.values(char.artifacts)),
      ];
    })
  );
  const evaluate = (configs: TeamSlotConfig[]) => {
    const team = new TeamBuild(
      configs,
      options.teamBuild.combatOpts,
      options.teamBuild.enemyAura,
      options.teamBuild.extraBuffs,
      undefined,
      options.calcContext
    );
    const allocation: TeamInvestment = Object.fromEntries(
      configs.map((c) => [
        c.charId,
        {
          constellation: c.constellation,
          weaponId: c.weaponId,
          refinement: c.refinement,
          is5StarWeapon: weaponsById[c.weaponId]?.rarity === 5,
        },
      ])
    );
    const combo = deriveComboForAllocation(
      allocation,
      options.templateCombo,
      team,
      options.comboOverrides,
      {
        baselineConstellations: Object.fromEntries(
          baseline.map((c) => [c.charId, c.constellation])
        ),
        futureCountChanges: options.futureCountChanges,
        singleObjective: options.singleObjective,
        ignoredContributorIds: options.ignoredContributorIds,
      }
    );
    return team.getComboDamageResult(combo, sheets, options.calcContext)
      .totalDamage;
  };
  return rankAccountInvestments(
    baseline,
    buildAccountInvestmentCandidates(baseline, selected, account),
    evaluate
  );
}
