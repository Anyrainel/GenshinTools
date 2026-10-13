import { particles } from "@/domain/combat/energy/constants";
import type { TeamSlot } from "@/domain/combat/energy/types";
import type { Element } from "@/domain/enums";
import type { AccountData } from "@/domain/models";
import { defaultCharacterConstellation } from "@/domain/reference/characterDefaults";
import type { CharacterStatsMap } from "@/domain/reference/stats";
import { charInfo } from "@/generated/catalog/characterInfo";
import { teamCompToArrays } from "./teamDeltas";
import type { TeamComp, TeamSetupConfig } from "./types";
import { resolveRosterWeaponCopies } from "./weaponCopies";

export function resolveEnergyCharacterContext(
  charId: string,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null,
  refine1to5: number
): {
  constellation: number;
  talentLevels: [number, number, number];
  /** 0-4 for R1-R5, matching TeamSlot.refinement. Store and account data both
   *  use 1-5, so this is offset by one. */
  refinement: number;
} {
  const acctChar = accountData?.characters.find((c) => c.key === charId);
  const defaultConst = defaultCharacterConstellation(
    charId,
    acctChar?.constellation
  );
  const constellation =
    setupConfig.charConfigs?.[charId]?.constellation ??
    (setupConfig.combatOptions?.[`${charId}.overrideConstellation`] !==
    undefined
      ? Number(setupConfig.combatOptions[`${charId}.overrideConstellation`])
      : defaultConst);
  const acct = acctChar?.talent ?? { auto: 10, skill: 10, burst: 10 };
  const authoredTalent = setupConfig.charConfigs?.[charId]?.talentLevels;
  const overrideAuto =
    setupConfig.combatOptions?.[`${charId}.overrideTalentAuto`];
  const overrideSkill =
    setupConfig.combatOptions?.[`${charId}.overrideTalentSkill`];
  const overrideBurst =
    setupConfig.combatOptions?.[`${charId}.overrideTalentBurst`];
  const base: [number, number, number] = [
    authoredTalent?.auto !== undefined
      ? authoredTalent.auto
      : overrideAuto !== undefined && overrideAuto !== ""
        ? Number(overrideAuto)
        : acct.auto,
    authoredTalent?.skill !== undefined
      ? authoredTalent.skill
      : overrideSkill !== undefined && overrideSkill !== ""
        ? Number(overrideSkill)
        : acct.skill,
    authoredTalent?.burst !== undefined
      ? authoredTalent.burst
      : overrideBurst !== undefined && overrideBurst !== ""
        ? Number(overrideBurst)
        : acct.burst,
  ];

  // Apply constellation +3 talent bonuses (C3 / C5) — matches CharacterBase
  // effective-level calc in dmgcalc, so ercalc stays aligned with what the UI
  // displays in the talent dropdowns.
  const info = charInfo[charId];
  const c3Bonus = constellation >= 3 && info ? 3 : 0;
  const c5Bonus = constellation >= 5 && info ? 3 : 0;
  const bonusFor = (slot: "A" | "E" | "Q") =>
    (info?.c3Talent === slot ? c3Bonus : 0) +
    (info?.c5Talent === slot ? c5Bonus : 0);
  const talentLevels: [number, number, number] = [
    base[0] + bonusFor("A"),
    base[1] + bonusFor("E"),
    base[2] + bonusFor("Q"),
  ];
  // Convert the shared slot-aware 1–5 refinement to the energy table's 0–4 index.
  const refinement = Math.min(4, Math.max(0, refine1to5 - 1));

  return { constellation, talentLevels, refinement };
}

export function buildEnergyTeamSlots(
  comp: TeamComp,
  setupConfig: TeamSetupConfig,
  accountData: AccountData | null,
  characterStats: CharacterStatsMap | null
): TeamSlot[] {
  const { characters, weapons, artifacts } = teamCompToArrays(comp);
  const weaponCopies = resolveRosterWeaponCopies(
    comp,
    setupConfig,
    accountData
  );

  return characters
    .map<TeamSlot | null>((charId, i) => {
      if (!charId) return null;
      const info = charInfo[charId];
      const pData = particles[charId];
      const element = (pData?.element ?? "Anemo") as Element;
      const burstCost = info?.energy ?? 60;
      const specialBurstCost = info?.specialBurstCost;
      const weaponId = weapons[i] ?? undefined;
      const { constellation, talentLevels, refinement } =
        resolveEnergyCharacterContext(
          charId,
          setupConfig,
          accountData,
          weaponCopies[i].refinement
        );
      // healAction: only set if this character actually heals at the current
      // constellation. Default action is Q when data hasn't specified one.
      const isHealer =
        info?.healerC !== undefined && constellation >= info.healerC;
      const healAction: "E" | "Q" | undefined = isHealer
        ? (info?.healAction ?? "Q")
        : undefined;
      return {
        charId,
        element,
        burstCost,
        specialBurstCost,
        constellation,
        weaponId,
        refinement,
        artifactSet:
          artifacts[i]?.type === "4pc" && artifacts[i]?.setId === "scholar"
            ? null
            : artifacts[i],
        weaponType: characterStats?.[charId]?.weaponType,
        talentLevels,
        healAction,
      };
    })
    .filter((s): s is TeamSlot => s !== null && !!particles[s.charId]);
}
