import { allSlots } from "@/data/enums";
import { charactersById, weaponsById } from "@/data/gameResources";
import {
  type CharacterStatsMap,
  getCharacterLevelTier,
  type WeaponStatsMap,
} from "@/data/gameStatsLoader";
import type { CharacterData, WeaponData } from "@/data/types";
import { DEFAULT_CALC_CONTEXT } from "@/lib/dmgcalc/constants";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import { runTeamOptimization } from "./optimizer/teamOptimization";
import { detectEquippedSets } from "./teamConfigUtils";
import type {
  TeammateSearchMessage,
  TeammateSearchRequest,
  TeammateSearchResult,
  TeammateSearchSettings,
} from "./teammateSearchTypes";

/** Group overrides are hypothetical investment levels; null uses the imported account. */
export function resolveSearchInvestment(
  char: CharacterData,
  weapon: WeaponData,
  settings: TeammateSearchSettings
) {
  return {
    constellation:
      (charactersById[char.key]?.rarity === 5
        ? settings.constellation5
        : settings.constellation4) ?? char.constellation,
    refinement:
      (weaponsById[weapon.key]?.rarity === 5
        ? settings.refinement5
        : settings.refinement34) ?? weapon.refinement,
  };
}

/** Include equipped and unequipped copies, preserving physical instance identity. */
export function collectSearchWeapons(
  request: TeammateSearchRequest
): WeaponData[] {
  const byId = new Map<string, WeaponData>();
  for (const char of request.account.characters)
    if (char.weapon) byId.set(char.weapon.id, char.weapon);
  for (const weapon of request.account.extraWeapons)
    if (!byId.has(weapon.id)) byId.set(weapon.id, weapon);
  return [...byId.values()];
}

function anchorCombo(team: TeamBuild, charId: string): ComboFormula {
  return {
    id: "teammate-search",
    label: { en: "Anchor combo", zh: "核心角色连招" },
    lines: Object.entries(team.catalog.getCombo(charId))
      .filter(([id, count]) => count > 0 && team.catalog.formulaIndex.has(id))
      .map(([formulaId, count]) => ({ charId, formulaId, count })),
  };
}

const context: CalcContext = { ...DEFAULT_CALC_CONTEXT };

/** Bounded beam search. Screens with equipped artifacts, refines three finalists with inventory allocation. */
export async function searchTeammates(
  request: TeammateSearchRequest,
  chars: CharacterStatsMap,
  weapons: WeaponStatsMap,
  report: (message: TeammateSearchMessage) => void
): Promise<void> {
  if (
    request.fixedIds.length < 1 ||
    request.fixedIds.length > 3 ||
    new Set(request.fixedIds).size !== request.fixedIds.length
  )
    throw new Error("Choose 1–3 different fixed characters.");
  for (const value of [
    request.settings.constellation4,
    request.settings.constellation5,
  ])
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 6))
      throw new Error("Invalid constellation override.");
  for (const value of [
    request.settings.refinement34,
    request.settings.refinement5,
  ])
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 5))
      throw new Error("Invalid refinement override.");
  const accountChars = new Map(
    request.account.characters.map((char) => [char.key, char])
  );
  const copies = collectSearchWeapons(request);
  const excluded = new Set(request.excludedArtifactIds ?? []);
  const screeningIds = new Set<string>();
  const screenedArtifacts = Object.fromEntries(
    request.account.characters.map((char) => [
      char.key,
      Object.values(char.artifacts).filter((artifact) => {
        if (excluded.has(artifact.id) || screeningIds.has(artifact.id))
          return false;
        screeningIds.add(artifact.id);
        return true;
      }),
    ])
  );
  const sheets: Record<string, StatSheet> = Object.fromEntries(
    request.account.characters.map((char) => [
      char.key,
      StatSheet.fromArtifacts(screenedArtifacts[char.key]),
    ])
  );
  const makeConfig = (
    char: CharacterData,
    weapon: WeaponData
  ): TeamSlotConfig => ({
    charId: char.key,
    charLevel: Number(getCharacterLevelTier(char.level)),
    weaponId: weapon.key,
    artifactSet: detectEquippedSets(screenedArtifacts[char.key]),
    talentLevels: char.talent,
    ...resolveSearchInvestment(char, weapon, request.settings),
  });
  const fixedConfigs: TeamSlotConfig[] = [];
  const fixedCopies: string[] = [];
  for (const id of request.fixedIds) {
    const char = accountChars.get(id);
    if (!char?.weapon)
      throw new Error(
        "Each fixed character needs an equipped weapon in Account Data."
      );
    if (fixedCopies.includes(char.weapon.id))
      throw new Error("Fixed characters cannot share a weapon copy.");
    fixedConfigs.push(makeConfig(char, char.weapon));
    fixedCopies.push(char.weapon.id);
  }
  const anchor = request.fixedIds[0];
  const initialTeam = new TeamBuild(fixedConfigs);
  if (!anchorCombo(initialTeam, anchor).lines.length)
    throw new Error(
      "The anchor has no supported default damage combo. Choose another anchor."
    );
  let evaluated = 0;
  let skipped = 0;
  let truncated = false;
  type State = { configs: TeamSlotConfig[]; copyIds: string[]; damage: number };
  let beam: State[] = [
    { configs: fixedConfigs, copyIds: fixedCopies, damage: 0 },
  ];
  const variants: { config: TeamSlotConfig; copyId: string }[] = [];
  for (const char of request.account.characters) {
    if (request.fixedIds.includes(char.key) || !chars[char.key]) continue;
    for (const weapon of copies) {
      if (
        !weapons[weapon.key] ||
        weapons[weapon.key].type !== chars[char.key].weaponType
      )
        continue;
      variants.push({ config: makeConfig(char, weapon), copyId: weapon.id });
    }
  }
  // Consider every candidate on the initial layer; later layers retain only the best six prefixes.
  for (let depth = fixedConfigs.length; depth < 4; depth++) {
    const next: State[] = [];
    const seen = new Set<string>();
    const deadline = performance.now() + 12000;
    let layerEvaluated = 0;
    outer: for (const variant of variants)
      for (const state of beam) {
        if (
          state.copyIds.includes(variant.copyId) ||
          state.configs.some(
            (config) => config.charId === variant.config.charId
          )
        )
          continue;
        if (layerEvaluated >= 3000 || performance.now() > deadline) {
          truncated = true;
          break outer;
        }
        const configs = [...state.configs, variant.config];
        const copyIds = [...state.copyIds, variant.copyId];
        const key = configs
          .map((config, i) => `${config.charId}:${copyIds[i]}`)
          .sort()
          .join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        evaluated++;
        layerEvaluated++;
        try {
          const team = new TeamBuild(configs);
          const damage = team.getComboDamageResult(
            anchorCombo(team, anchor),
            sheets,
            context
          ).totalDamage;
          if (!Number.isFinite(damage)) throw new Error("Non-finite damage.");
          next.push({ configs, copyIds, damage });
        } catch {
          skipped++;
        }
        if (layerEvaluated % 20 === 0)
          report({
            type: "progress",
            phase: "screen",
            evaluated,
            step: depth - fixedConfigs.length + 1,
            total: 4 - fixedConfigs.length,
          });
      }
    next.sort((a, b) => b.damage - a.damage);
    beam = next.slice(0, 6);
    if (!beam.length) break;
  }
  const inventory = [
    ...new Map(
      [
        ...request.account.characters.flatMap((char) =>
          Object.values(char.artifacts)
        ),
        ...request.account.extraArtifacts,
      ]
        .filter((artifact) => !excluded.has(artifact.id))
        .map((artifact) => [artifact.id, artifact])
    ).values(),
  ];
  const results: TeammateSearchResult[] = [];
  // Avoid publishing incomplete teams or sets unsupported by the actual assigned artifacts.
  for (const state of beam
    .filter((state) => state.configs.length === 4)
    .slice(0, 3)) {
    report({
      type: "progress",
      phase: "artifacts",
      evaluated,
      step: results.length + 1,
      total: Math.min(3, beam.length),
    });
    let finished = false;
    try {
      const team = new TeamBuild(
        state.configs.map((config) => ({ ...config, artifactSet: null }))
      );
      for await (const update of runTeamOptimization({
        teamBuild: team,
        carryCharId: anchor,
        combo: anchorCombo(team, anchor),
        inventory,
        calcContext: context,
        baseSheets: sheets,
        perChar: Object.fromEntries(
          state.configs.map((config) => [
            config.charId,
            { minEr: 0, minCr: 0, artifactSet: null },
          ])
        ),
        perCharDeadlineMs: 350,
        teamDeadlineMs: 2500,
        maxArtsPerSlot: 12,
      })) {
        if (!update.done) continue;
        const artifactsByChar = update.bestArtifactsByChar;
        if (
          state.configs.some((config) =>
            allSlots.some((slot) => !artifactsByChar[config.charId]?.[slot])
          )
        )
          break;
        const configs = state.configs.map((config) => ({
          ...config,
          artifactSet: detectEquippedSets(
            Object.values(artifactsByChar[config.charId])
          ),
        }));
        const finalTeam = new TeamBuild(configs);
        const finalSheets = Object.fromEntries(
          configs.map((config) => [
            config.charId,
            StatSheet.fromArtifacts(
              Object.values(artifactsByChar[config.charId]).filter(
                (artifact) => artifact !== null
              )
            ),
          ])
        );
        const damage = finalTeam.getComboDamageResult(
          anchorCombo(finalTeam, anchor),
          finalSheets,
          context
        ).totalDamage;
        if (Number.isFinite(damage)) {
          results.push({
            configs,
            weaponInstanceIds: state.copyIds,
            artifactsByChar,
            damage,
            combo: anchorCombo(finalTeam, anchor),
            calcContext: context,
          });
          finished = true;
        }
      }
    } catch {
      /* A failed finalist must not discard successful candidates. */
    }
    if (!finished) skipped++;
  }
  results.sort((a, b) => b.damage - a.damage);
  report({ type: "result", results, evaluated, skipped, truncated });
}
