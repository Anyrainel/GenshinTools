import { buildSheetFromMainAndSubs } from "@/domain/build/artifact/scoring/sheetBuilder";
import { getRollValues } from "@/domain/build/artifact/scoring/utils";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type {
  ComboFormula,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import {
  allSlots,
  type MainStat,
  type Slot,
  type SubStat,
} from "@/domain/enums";
import type {
  ArtifactData,
  ArtifactSetConfig,
  WeaponData,
} from "@/domain/models";
import { artifactsById } from "@/domain/reference/catalog";
import {
  type CharacterStatsMap,
  getCharacterLevelTier,
  type WeaponStatsMap,
} from "@/domain/reference/stats";
import { buildArtifactSetChoiceCandidates } from "../../domain/combat/analyzer/weaponChoice";
import { runGenerator } from "../../domain/combat/generator/generator";
import { rollsPerSlotForPreset } from "../../domain/combat/generator/substatBudget";
import { computeTeamInventory } from "../../domain/team/artifactInventory";
import type {
  CharacterReplacementMessage,
  CharacterReplacementRequest,
  CharacterReplacementResult,
} from "../../domain/team/characterReplacementTypes";
import {
  buildTeamSlotConfigs,
  deriveSetKeysFromConfigs,
  detectEquippedSets,
} from "../../domain/team/teamConfigUtils";
import {
  collectOwnedWeaponCopies,
  resolveRosterWeaponCopies,
} from "../../domain/team/weaponCopies";
import { runTeamOptimization } from "./optimizer/teamOptimization";

/** Keep authored unchanged lines verbatim; replacement formulas come from their supported defaults. */
export function buildReplacementCombo(
  request: CharacterReplacementRequest,
  team: TeamBuild,
  slotIndexes: number[] = team.configs.map((_, index) => index)
): ComboFormula {
  if ((request.setupConfig.damage?.formulaMode ?? "single") === "single")
    return request.objective;
  const removed = new Set(
    request.settings.replaceSlots.map(
      (index) => request.teamComp.slots[index].charId
    )
  );
  const lines = request.objective.lines.filter(
    (line) =>
      !removed.has(line.charId) && team.catalog.formulaIndex.has(line.formulaId)
  );
  const retainedIndexes = request.objective.lines.flatMap((line, index) =>
    !removed.has(line.charId) && team.catalog.formulaIndex.has(line.formulaId)
      ? [index]
      : []
  );
  const buffOverrides = Object.fromEntries(
    retainedIndexes.flatMap((oldIndex, newIndex) =>
      request.objective.buffOverrides?.[oldIndex]
        ? [[newIndex, request.objective.buffOverrides[oldIndex]]]
        : []
    )
  );
  const unchanged = new Set(
    request.teamComp.slots.flatMap((slot, index) =>
      !request.settings.replaceSlots.includes(index) && slot.charId
        ? [slot.charId]
        : []
    )
  );
  const ignored = replacementIgnoredCharacters(
    request,
    team.configs,
    slotIndexes
  );
  for (const config of team.configs) {
    if (unchanged.has(config.charId)) continue;
    if (ignored.includes(config.charId)) continue;
    for (const [formulaId, count] of Object.entries(
      team.catalog.getCombo(config.charId)
    )) {
      if (count <= 0 || !team.catalog.formulaIndex.has(formulaId)) continue;
      const sharedReaction = request.objective.lines.find(
        (line) => removed.has(line.charId) && line.reaction?.reaction
      )?.reaction?.reaction;
      const reaction =
        sharedReaction &&
        team.teamMeta.hasReaction(sharedReaction, config.charId)
          ? { reaction: sharedReaction }
          : undefined;
      lines.push({ charId: config.charId, formulaId, count, reaction });
    }
  }
  return { ...request.objective, lines, buffOverrides };
}

export function replacementIgnoredCharacters(
  request: CharacterReplacementRequest,
  configs: TeamSlotConfig[],
  slotIndexes: number[]
): string[] {
  const original = new Set(request.ignoredCharIds ?? []);
  return configs.flatMap((config, index) =>
    original.has(request.teamComp.slots[slotIndexes[index]]?.charId ?? "")
      ? [config.charId]
      : []
  );
}

function generatedScreenSheet(
  charId: string,
  request: CharacterReplacementRequest,
  chars: CharacterStatsMap
): StatSheet {
  const element = chars[charId]?.element.toLowerCase();
  const mains: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: `${element}%` as MainStat,
    circlet: "cr",
  };
  const stats: SubStat[] = ["cr", "cd", "atk%", "hp%", "def%", "em", "er"];
  const budget = rollsPerSlotForPreset(request.calcContext.substatBudget, 5);
  const subrolls = Object.fromEntries(
    allSlots.map((slot) => {
      const eligible = stats.filter((stat) => stat !== mains[slot]);
      const rolls: Partial<Record<SubStat, number>> = {};
      for (let i = 0; i < budget; i++) {
        const stat = eligible[i % eligible.length];
        rolls[stat] = (rolls[stat] ?? 0) + 1;
      }
      return [slot, rolls];
    })
  ) as Record<Slot, Partial<Record<SubStat, number>>>;
  return buildSheetFromMainAndSubs(
    mains,
    subrolls,
    getRollValues(request.calcContext.rollMultiplier, 5)
  );
}

export async function runCharacterReplacement(
  request: CharacterReplacementRequest,
  chars: CharacterStatsMap,
  weapons: WeaponStatsMap,
  report: (message: CharacterReplacementMessage) => void
): Promise<void> {
  const fail = (
    reason: Extract<CharacterReplacementMessage, { type: "error" }>["reason"],
    details?: string
  ) => report({ type: "error", reason, details });
  const replace = [...new Set(request.settings.replaceSlots)].sort(
    (a, b) => a - b
  );
  if (
    !replace.length ||
    replace.some(
      (index) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= request.teamComp.slots.length
    )
  )
    return fail("invalid-slots");
  if (
    [request.settings.constellation4, request.settings.constellation5].some(
      (value) => !Number.isInteger(value) || value < 0 || value > 6
    ) ||
    [request.settings.refinement34, request.settings.refinement5].some(
      (value) => !Number.isInteger(value) || value < 1 || value > 5
    )
  )
    return fail("calculator-error", "Invalid hypothetical ranks.");
  if (!request.objective.lines.some((line) => line.count > 0))
    return fail("no-objective");
  const removed = new Set(
    replace.map((index) => request.teamComp.slots[index].charId)
  );
  if (
    (request.setupConfig.damage?.formulaMode ?? "single") === "single" &&
    request.objective.lines.some((line) => removed.has(line.charId))
  )
    return fail("single-source");
  if (
    (request.settings.pool !== "all-any" ||
      request.settings.artifactBasis === "account") &&
    !request.accountData
  )
    return fail("no-account");
  const originalConfigs = buildTeamSlotConfigs(
    request.teamComp,
    request.setupConfig,
    request.accountData
  );
  const configById = new Map(
    originalConfigs.map((config) => [config.charId, config])
  );
  const assignments = resolveRosterWeaponCopies(
    request.teamComp,
    request.setupConfig,
    request.accountData
  );
  const fixedSlots = request.teamComp.slots.flatMap((slot, index) =>
    !replace.includes(index) && slot.charId ? [index] : []
  );
  if (
    fixedSlots.some(
      (index) => !configById.has(request.teamComp.slots[index].charId!)
    )
  )
    return fail(
      "fixed-copy-shortage",
      "Choose a weapon for every member kept in the team."
    );
  if (
    request.settings.pool === "owned-owned" &&
    fixedSlots.some((index) => !assignments[index].copy)
  )
    return fail("fixed-copy-shortage");
  const ownedChars = new Map(
    request.accountData?.characters.map((char) => [char.key, char]) ?? []
  );
  const copies = collectOwnedWeaponCopies(request.accountData);
  const candidateIds = Object.keys(chars).filter(
    (id) =>
      !fixedSlots.some(
        (index) => request.teamComp.slots[index].charId === id
      ) &&
      (request.settings.pool === "all-any" || ownedChars.has(id))
  );
  if (candidateIds.length < replace.length)
    return fail("not-enough-characters");
  const inventory = [
    ...new Map(
      [
        ...(request.accountData?.characters.flatMap((char) =>
          Object.values(char.artifacts)
        ) ?? []),
        ...(request.accountData?.extraArtifacts ?? []),
      ].map((artifact) => [artifact.id, artifact])
    ).values(),
  ];
  const candidateInventory = (configs: TeamSlotConfig[]) =>
    computeTeamInventory({
      allArtifacts: inventory,
      frozenTeams: request.inventoryReservations?.teams ?? {},
      reuseMode: request.inventoryReservations?.reuseMode ?? "none",
      standaloneFrozenIds:
        request.inventoryReservations?.standaloneIds ??
        request.excludedArtifactIds,
      teamId: request.teamComp.id,
      teamCharacters: configs.map((config) => config.charId),
      teamArtifacts: configs.map((config) => config.artifactSet),
    });
  const screenInventory = candidateInventory(
    Object.keys(chars).map((charId) => ({
      charId,
      charLevel: 90,
      constellation: 0,
      weaponId: "",
      refinement: 1,
      artifactSet: detectEquippedSets(
        Object.values(ownedChars.get(charId)?.artifacts ?? {})
      ),
    }))
  );
  const screenAvailableIds = new Set(
    screenInventory.availableArtifacts.map((artifact) => artifact.id)
  );
  const screenSheets: Record<string, StatSheet> = {};
  const usedScreenIds = new Set<string>();
  for (const charId of Object.keys(chars)) {
    if (request.settings.artifactBasis === "generated")
      screenSheets[charId] = generatedScreenSheet(charId, request, chars);
    else {
      const available = new Set([
        ...screenAvailableIds,
        ...(screenInventory.perCharExtraArtifacts[charId] ?? []).map(
          (artifact) => artifact.id
        ),
      ]);
      const pieces = screenInventory.forceReuseChars[charId]
        ? Object.values(screenInventory.forceReuseChars[charId]).filter(
            (artifact) => artifact !== null
          )
        : Object.values(ownedChars.get(charId)?.artifacts ?? {});
      screenSheets[charId] = StatSheet.fromArtifacts(
        pieces.filter((artifact) => {
          if (!available.has(artifact.id) || usedScreenIds.has(artifact.id))
            return false;
          usedScreenIds.add(artifact.id);
          return true;
        })
      );
    }
  }
  type State = {
    slots: Map<number, TeamSlotConfig>;
    copyIds: Map<number, string | null>;
    damage: number;
  };
  const fixed: State = {
    slots: new Map(
      fixedSlots.map((index) => [
        index,
        configById.get(request.teamComp.slots[index].charId!)!,
      ])
    ),
    copyIds: new Map(
      fixedSlots.map((index) => [index, assignments[index].copy?.id ?? null])
    ),
    damage: 0,
  };
  const orderedConfigs = (state: State) =>
    [...state.slots].sort(([a], [b]) => a - b).map(([, config]) => config);
  const makeTeam = (configs: TeamSlotConfig[]) =>
    new TeamBuild(
      configs,
      request.setupConfig.combatOptions,
      request.setupConfig.damage?.enemyAura,
      request.setupConfig.damage?.extraBuffs,
      undefined,
      request.calcContext
    );
  const evaluate = (
    configs: TeamSlotConfig[],
    sheets = screenSheets,
    slotIndexes: number[] = configs.map((_, index) => index)
  ) => {
    const team = makeTeam(configs);
    const combo = buildReplacementCombo(request, team, slotIndexes);
    if (!combo.lines.length)
      throw new Error("No supported replacement counts.");
    return team.getComboDamageResult(combo, sheets, request.calcContext)
      .totalDamage;
  };
  let baselineDamage: number | null = null;
  try {
    const team = makeTeam(originalConfigs);
    baselineDamage = team.getComboDamageResult(
      request.objective,
      screenSheets,
      request.calcContext
    ).totalDamage;
  } catch {
    /* An incomplete original team can still be repaired. */
  }
  let beam = [fixed];
  let evaluated = 0;
  let skipped = 0;
  let partial = false;
  for (const [step, slotIndex] of replace.entries()) {
    const next: State[] = [];
    const seen = new Set<string>();
    const deadline = performance.now() + 12000;
    let layerEvaluated = 0;
    outer: for (const charId of candidateIds) {
      if (request.teamComp.slots[slotIndex].charId === charId) continue;
      const owned = ownedChars.get(charId);
      const assumedConstellation =
        chars[charId].rarity === 5
          ? request.settings.constellation5
          : request.settings.constellation4;
      const ownedVariants = copies.filter(
        (copy) => weapons[copy.key]?.type === chars[charId].weaponType
      );
      const catalogVariants: WeaponData[] =
        request.settings.pool === "owned-owned"
          ? []
          : Object.entries(weapons)
              .filter(
                ([, stats]) =>
                  stats.type === chars[charId].weaponType && stats.rarity >= 3
              )
              .map(([key, stats]) => ({
                id: `hypothetical:${slotIndex}:${key}`,
                key,
                level: 90,
                refinement:
                  stats.rarity === 5
                    ? request.settings.refinement5
                    : request.settings.refinement34,
                lock: false,
              }));
      // Owned copies keep imported ranks; catalog variants are explicitly hypothetical.
      const variants = [...ownedVariants, ...catalogVariants];
      for (const weapon of variants)
        for (const state of beam) {
          if (
            [...state.slots.values()].some(
              (config) => config.charId === charId
            ) ||
            [...state.copyIds.values()].includes(weapon.id)
          )
            continue;
          if (layerEvaluated >= 2400 || performance.now() > deadline) {
            partial = true;
            break outer;
          }
          const hypothetical = weapon.id.startsWith("hypothetical:");
          const config: TeamSlotConfig = {
            charId,
            charLevel: owned ? Number(getCharacterLevelTier(owned.level)) : 90,
            constellation: owned?.constellation ?? assumedConstellation,
            talentLevels: owned?.talent ?? { auto: 10, skill: 10, burst: 10 },
            weaponId: weapon.key,
            refinement: weapon.refinement,
            artifactSet: detectEquippedSets(
              Object.values(owned?.artifacts ?? {})
            ),
          };
          const slots = new Map(state.slots).set(slotIndex, config);
          const copyIds = new Map(state.copyIds).set(
            slotIndex,
            hypothetical ? null : weapon.id
          );
          const candidate: State = { slots, copyIds, damage: 0 };
          const key =
            orderedConfigs(candidate)
              .map(
                (member) =>
                  `${member.charId}:${member.weaponId}:${member.refinement}`
              )
              .join("|") + [...copyIds.values()].join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          evaluated++;
          layerEvaluated++;
          try {
            candidate.damage = evaluate(
              orderedConfigs(candidate),
              screenSheets,
              [...candidate.slots.keys()].sort((a, b) => a - b)
            );
            if (Number.isFinite(candidate.damage)) next.push(candidate);
            else skipped++;
          } catch {
            skipped++;
          }
          if (layerEvaluated % 20 === 0)
            report({
              type: "progress",
              phase: "screen",
              evaluated,
              step: step + 1,
              total: replace.length,
            });
        }
    }
    next.sort((a, b) => b.damage - a.damage);
    const diversity = new Map<string, number>();
    beam = next
      .filter((state) => {
        const key = orderedConfigs(state)
          .map((config) => config.charId)
          .join("|");
        const count = diversity.get(key) ?? 0;
        diversity.set(key, count + 1);
        return count < 2;
      })
      .slice(0, 8);
    if (!beam.length) break;
  }
  const finalists: State[] = [];
  const finalistKeys = new Set<string>();
  for (const state of beam) {
    const key = orderedConfigs(state)
      .map((config) => config.charId)
      .join("|");
    if (!finalistKeys.has(key)) {
      finalists.push(state);
      finalistKeys.add(key);
    }
    if (finalists.length === 3) break;
  }
  const results: CharacterReplacementResult[] = [];
  for (const [step, state] of finalists.entries()) {
    if (state.slots.size !== fixedSlots.length + replace.length) continue;
    report({
      type: "progress",
      phase: "refine",
      evaluated,
      step: step + 1,
      total: finalists.length,
    });
    let configs = orderedConfigs(state);
    const slotIndexes = [...state.slots.keys()].sort((a, b) => a - b);
    try {
      let artifactsByChar: Record<
        string,
        Record<Slot, ArtifactData | null>
      > | null = null;
      if (request.settings.artifactBasis === "generated") {
        // One coordinate pass over all supported five-star four-piece seeds for replacement members.
        for (const index of replace) {
          const charId = state.slots.get(index)!.charId;
          let best = evaluate(configs, screenSheets, slotIndexes);
          let bestSet: ArtifactSetConfig | null =
            configs.find((config) => config.charId === charId)?.artifactSet ??
            null;
          for (const candidate of buildArtifactSetChoiceCandidates()) {
            if (
              !artifactsById[
                candidate.artifactSet.type === "4pc"
                  ? candidate.artifactSet.setId
                  : ""
              ]
            )
              continue;
            const variant = configs.map((config) =>
              config.charId === charId
                ? { ...config, artifactSet: candidate.artifactSet }
                : config
            );
            try {
              const damage = evaluate(variant, screenSheets, slotIndexes);
              if (damage > best) {
                best = damage;
                bestSet = candidate.artifactSet;
              }
            } catch {
              skipped++;
            }
          }
          configs = configs.map((config) =>
            config.charId === charId
              ? { ...config, artifactSet: bestSet }
              : config
          );
        }
        const team = makeTeam(configs);
        const combo = buildReplacementCombo(request, team, slotIndexes);
        for await (const update of runGenerator({
          teamBuild: team,
          carryCharId: combo.lines[0].charId,
          combo,
          calcContext: request.calcContext,
          setKeysByChar: deriveSetKeysFromConfigs(configs),
          perChar: Object.fromEntries(
            configs.map((config) => [
              config.charId,
              {
                minEr:
                  request.setupConfig.charConfigs?.[config.charId]?.minEr ?? 0,
                minCr:
                  request.setupConfig.charConfigs?.[config.charId]?.minCr ?? 0,
              },
            ])
          ),
        }))
          if (update.done) artifactsByChar = update.artifactsByChar;
      } else {
        const pool = candidateInventory(configs);
        const forced = pool.forceReuseChars;
        const forcedIds = new Set(
          Object.values(forced).flatMap((slots) =>
            Object.values(slots).flatMap((artifact) =>
              artifact ? [artifact.id] : []
            )
          )
        );
        const baseSheets = { ...screenSheets };
        for (const [charId, slots] of Object.entries(forced))
          baseSheets[charId] = StatSheet.fromArtifacts(
            Object.values(slots).filter((artifact) => artifact !== null)
          );
        const team = makeTeam(
          configs.map((config) => ({
            ...config,
            artifactSet: forced[config.charId] ? config.artifactSet : null,
          }))
        );
        const combo = buildReplacementCombo(request, team, slotIndexes);
        for await (const update of runTeamOptimization({
          teamBuild: team,
          carryCharId: combo.lines[0].charId,
          combo,
          inventory: pool.availableArtifacts.filter(
            (artifact) => !forcedIds.has(artifact.id)
          ),
          calcContext: request.calcContext,
          baseSheets,
          perChar: Object.fromEntries(
            configs
              .filter((config) => !forced[config.charId])
              .map((config) => [
                config.charId,
                {
                  minEr:
                    request.setupConfig.charConfigs?.[config.charId]?.minEr ??
                    0,
                  minCr:
                    request.setupConfig.charConfigs?.[config.charId]?.minCr ??
                    0,
                  artifactSet: fixedSlots.some(
                    (index) => state.slots.get(index)?.charId === config.charId
                  )
                    ? config.artifactSet
                    : null,
                },
              ])
          ),
          perCharDeadlineMs: 400,
          teamDeadlineMs: performance.now() + 3000,
          maxArtsPerSlot: 15,
          perCharExtraArtifacts: Object.fromEntries(
            Object.entries(pool.perCharExtraArtifacts).map(
              ([charId, artifacts]) => [
                charId,
                forced[charId]
                  ? []
                  : artifacts.filter((artifact) => !forcedIds.has(artifact.id)),
              ]
            )
          ),
        }))
          if (update.done)
            artifactsByChar = { ...update.bestArtifactsByChar, ...forced };
      }
      if (
        !artifactsByChar ||
        configs.some((config) =>
          allSlots.some((slot) => !artifactsByChar?.[config.charId]?.[slot])
        )
      ) {
        skipped++;
        continue;
      }
      const completeArtifacts = artifactsByChar;
      const assignedIds = configs.flatMap((config) =>
        Object.values(completeArtifacts[config.charId]).flatMap((artifact) =>
          artifact ? [artifact.id] : []
        )
      );
      if (new Set(assignedIds).size !== configs.length * 5) {
        skipped++;
        continue;
      }
      configs = configs.map((config) => ({
        ...config,
        artifactSet: detectEquippedSets(
          Object.values(completeArtifacts[config.charId]).filter(
            (artifact) => artifact !== null && artifactsById[artifact.setKey]
          )
        ),
      }));
      const team = makeTeam(configs);
      const combo = buildReplacementCombo(request, team, slotIndexes);
      const sheets = Object.fromEntries(
        configs.map((config) => [
          config.charId,
          StatSheet.fromArtifacts(
            Object.values(completeArtifacts[config.charId]).filter(
              (artifact) => artifact !== null
            )
          ),
        ])
      );
      const damage = team.getComboDamageResult(
        combo,
        sheets,
        request.calcContext
      ).totalDamage;
      const unmet = configs.some((config) => {
        const requirements = request.setupConfig.charConfigs?.[config.charId];
        if (!requirements?.minEr && !requirements?.minCr) return false;
        const stats = team.getTeamStats(
          sheets,
          config.charId,
          request.calcContext
        )[config.charId];
        return (
          (stats?.get("er", null) ?? 0) + 1e-6 < (requirements.minEr ?? 0) ||
          (stats?.get("cr", null) ?? 0) + 1e-6 < (requirements.minCr ?? 0)
        );
      });
      if (unmet) {
        skipped++;
        continue;
      }
      if (!Number.isFinite(damage)) {
        skipped++;
        continue;
      }
      results.push({
        configs,
        slotIndexes: [...state.slots.keys()].sort((a, b) => a - b),
        weaponInstanceIds: [...state.copyIds]
          .sort(([a], [b]) => a - b)
          .map(([, id]) => id),
        combo,
        damage,
        artifactsByChar: completeArtifacts,
        artifactBasis: request.settings.artifactBasis,
        ignoredCharIds: replacementIgnoredCharacters(
          request,
          configs,
          slotIndexes
        ),
      });
    } catch {
      skipped++;
    }
  }
  results.sort((a, b) => b.damage - a.damage);
  if (!results.length)
    return fail("no-results", `Evaluated ${evaluated}; skipped ${skipped}.`);
  report({
    type: "result",
    results,
    baselineDamage,
    evaluated,
    skipped,
    partial,
  });
}
