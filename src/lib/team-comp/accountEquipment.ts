import { allSlots } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import type {
  AccountEquipmentOptions,
  AccountEquipmentResult,
  AccountEquipmentYield,
} from "./accountEquipmentTypes";
import { runTeamOptimization } from "./optimizer/teamOptimization";
import { detectEquippedSets } from "./teamConfigUtils";
import { collectOwnedWeaponCopies } from "./weaponCopies";

/** Bounded joint weapon search, followed by real-inventory team allocation. */
export async function* runAccountEquipmentSearch(
  options: AccountEquipmentOptions
): AsyncGenerator<AccountEquipmentYield, void> {
  const copies = collectOwnedWeaponCopies(options.accountData);
  const makeTeam = (configs: TeamSlotConfig[]) =>
    new TeamBuild(
      configs,
      options.setupConfig.combatOptions,
      options.setupConfig.damage?.enemyAura,
      options.setupConfig.damage?.extraBuffs,
      undefined,
      options.calcContext
    );
  const evaluate = (configs: TeamSlotConfig[]) =>
    makeTeam(configs).getComboDamageResult(
      options.combo,
      options.baseSheets,
      options.calcContext
    ).totalDamage;
  if (
    !options.configs.length ||
    !options.combo.lines.some((line) => line.count > 0)
  ) {
    yield { kind: "result", result: null };
    return;
  }
  const baselineDamage = evaluate(options.configs);
  type Assignment = {
    configs: TeamSlotConfig[];
    copyIds: string[];
    damage: number;
  };
  let beam: Assignment[] = [
    { configs: options.configs, copyIds: [], damage: baselineDamage },
  ];
  let evaluated = 0;
  for (let slot = 0; slot < options.configs.length; slot++) {
    const current = options.configs[slot];
    const weaponType = options.weaponStats[current.weaponId]?.type;
    const compatible = copies.filter(
      (copy) =>
        options.weaponStats[copy.key]?.type === weaponType &&
        weaponType !== undefined
    );
    if (!compatible.length) {
      yield { kind: "result", result: null };
      return;
    }
    const next: Assignment[] = [];
    for (const assignment of beam) {
      for (const copy of compatible) {
        if (assignment.copyIds.includes(copy.id)) continue;
        const configs = assignment.configs.map((config, index) =>
          index === slot
            ? { ...config, weaponId: copy.key, refinement: copy.refinement }
            : config
        );
        const damage = evaluate(configs);
        if (Number.isFinite(damage))
          next.push({
            configs,
            copyIds: [...assignment.copyIds, copy.id],
            damage,
          });
        evaluated++;
        if (evaluated % 16 === 0) {
          yield { kind: "progress", phase: "screen", evaluated };
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
    }
    // Keep several complete physical assignments, including alternative copies
    // of the same weapon. A high-rank copy cannot be borrowed by two members.
    next.sort(
      (a, b) =>
        b.damage - a.damage ||
        a.copyIds.join("|").localeCompare(b.copyIds.join("|"))
    );
    beam = next.slice(0, 16);
    if (!beam.length) {
      yield { kind: "result", result: null };
      return;
    }
  }
  let best: AccountEquipmentResult | null = null;
  const fixedArtifacts = options.forceReuseChars ?? {};
  const fixedIds = new Set(
    Object.values(fixedArtifacts).flatMap((pieces) =>
      Object.values(pieces)
        .filter((piece): piece is ArtifactData => piece !== null)
        .map((piece) => piece.id)
    )
  );
  const baseSheets = {
    ...options.baseSheets,
    ...Object.fromEntries(
      Object.entries(fixedArtifacts).map(([charId, pieces]) => [
        charId,
        StatSheet.fromArtifacts(
          Object.values(pieces).filter((piece) => piece !== null)
        ),
      ])
    ),
  };
  for (const assignment of beam.slice(0, 4)) {
    yield { kind: "progress", phase: "artifacts", evaluated };
    const team = makeTeam(assignment.configs);
    for await (const update of runTeamOptimization({
      teamBuild: team,
      carryCharId:
        options.combo.lines.find((line) => line.count > 0)?.charId ??
        assignment.configs[0].charId,
      combo: options.combo,
      inventory: options.inventory.filter(
        (artifact) => !fixedIds.has(artifact.id)
      ),
      baseSheets,
      calcContext: options.calcContext,
      perChar: Object.fromEntries(
        assignment.configs
          .filter((config) => !(config.charId in fixedArtifacts))
          .map((config) => {
            const settings = options.setupConfig.charConfigs?.[config.charId];
            return [
              config.charId,
              {
                minEr: settings?.minEr ?? 1,
                minCr:
                  settings?.crMode === "target" ? 0 : (settings?.minCr ?? 0),
                artifactSet: config.artifactSet,
              },
            ];
          })
      ),
      ignoreArtifactSets: Object.fromEntries(
        assignment.configs.map((config) => [
          config.charId,
          options.setupConfig.charConfigs?.[config.charId]?.fullSetOptional ??
            false,
        ])
      ),
      perCharExtraArtifacts: Object.fromEntries(
        Object.entries(options.perCharExtraArtifacts).map(
          ([charId, pieces]) => [
            charId,
            pieces.filter((piece) => !fixedIds.has(piece.id)),
          ]
        )
      ),
      perCharDeadlineMs: 1500,
      teamDeadlineMs: performance.now() + 6000,
      maxArtsPerSlot: 20,
    })) {
      if (!update.done) continue;
      const allocation = { ...update.bestArtifactsByChar, ...fixedArtifacts };
      const assigned = assignment.configs.flatMap((config) =>
        allSlots.map((slot) => allocation[config.charId]?.[slot])
      );
      if (
        assignment.configs.some((config) => {
          const allowed = new Set(
            [
              ...options.inventory,
              ...(options.perCharExtraArtifacts[config.charId] ?? []),
            ].map((artifact) => artifact.id)
          );
          return allSlots.some((slot) => {
            const artifact = allocation[config.charId]?.[slot];
            return !artifact || !allowed.has(artifact.id);
          });
        })
      )
        continue;
      const ids = assigned.map((artifact) => artifact!.id);
      if (new Set(ids).size !== ids.length) continue;
      const configs = assignment.configs.map((config) => ({
        ...config,
        artifactSet: detectEquippedSets(
          Object.values(allocation[config.charId])
        ),
      }));
      const sheets = Object.fromEntries(
        configs.map((config) => [
          config.charId,
          StatSheet.fromArtifacts(
            Object.values(allocation[config.charId]).filter(
              (artifact) => artifact !== null
            )
          ),
        ])
      );
      const damage = makeTeam(configs).getComboDamageResult(
        options.combo,
        sheets,
        options.calcContext
      ).totalDamage;
      if (!Number.isFinite(damage)) continue;
      if (!best || damage > best.damage)
        best = {
          configs,
          weaponCopyIds: assignment.copyIds,
          artifactsByChar: allocation,
          damage,
          baselineDamage,
          evaluated,
          approximate: true,
        };
    }
  }
  yield { kind: "result", result: best };
}
