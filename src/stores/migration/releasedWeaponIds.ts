import type { AccountData, TierAssignment } from "@/data/types";
import type { BuffActivationMap } from "@/lib/dmgcalc/types";
import type { TeamCompDelta } from "@/lib/team-comp/teamDeltas";
import type { TeamComp, TeamSetupConfig } from "@/lib/team-comp/types";
import { resolveReleasedWeaponId } from "@/lib/weaponIds";
import { migrateGenericTierStore } from "./tier";

// Before 7.1, these released four-star weapons used temporary beta IDs in
// weapon keys, team slots, combat-option keys, analyzer alternatives and tiers.
// weapon_catalyst is now a different future weapon; its identity is preserved.

export function migrateReleasedCharacterWeapons(
  weapons: Record<string, string[]>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(weapons).map(([charId, ids]) => [
      charId,
      [...new Set(ids.map(resolveReleasedWeaponId))],
    ])
  );
}

export function migrateReleasedWeaponRecord<T>(
  record: Record<string, T>
): Record<string, T> {
  const next = { ...record };
  for (const [id, value] of Object.entries(record)) {
    const released = resolveReleasedWeaponId(id);
    if (released === id) continue;
    // An explicitly authored released-ID value wins over the older beta value.
    if (!(released in record)) next[released] = value;
    delete next[id];
  }
  return next;
}

export function migrateReleasedWeaponComp(comp: TeamComp): TeamComp {
  return {
    ...comp,
    slots: comp.slots.map((slot) => ({
      ...slot,
      weaponId:
        slot.weaponId == null ? null : resolveReleasedWeaponId(slot.weaponId),
    })),
  };
}

export function migrateReleasedWeaponSetup(
  config: TeamSetupConfig
): TeamSetupConfig {
  return {
    ...config,
    combatOptions: migrateReleasedWeaponRecord(config.combatOptions ?? {}),
    ...(config.damage?.combo?.buffOverrides
      ? {
          damage: {
            ...config.damage,
            combo: {
              ...config.damage.combo,
              buffOverrides: Object.fromEntries(
                Object.entries(config.damage.combo.buffOverrides).map(
                  ([line, buffs]) => [
                    line,
                    migrateReleasedWeaponBuffOverrides(buffs),
                  ]
                )
              ),
            },
          },
        }
      : {}),
    ...(config.investment?.configs
      ? {
          investment: {
            ...config.investment,
            configs: config.investment.configs.map((entry) => ({
              ...entry,
              ...(entry.altWeapon
                ? {
                    altWeapon: {
                      ...entry.altWeapon,
                      id: resolveReleasedWeaponId(entry.altWeapon.id),
                    },
                  }
                : {}),
            })),
          },
        }
      : {}),
  };
}

function migrateReleasedWeaponBuffOverrides(
  buffs: BuffActivationMap
): BuffActivationMap {
  const next = { ...buffs };
  for (const [key, value] of Object.entries(buffs)) {
    // The canonical buff key is provider + U+0003 + five U+0002-separated
    // identity fields; source fields are U+0000-separated. Never replace text
    // inside opaque unknown keys or current weapon_catalyst identities.
    const providerEnd = key.indexOf("\u0003");
    if (providerEnd < 0) continue;
    const identity = key.slice(providerEnd + 1).split("\u0002");
    const source = identity[0].split("\u0000");
    if (source[0] !== "weapon" || identity.length !== 5 || source.length !== 8)
      continue;
    const releasedId = resolveReleasedWeaponId(source[1]);
    if (releasedId === source[1]) continue;
    source[1] = releasedId;
    if (source[4] === "weapon-bow-stellar-dmg")
      source[4] = "breezeborne-refrain-stellar-dmg";
    identity[0] = source.join("\u0000");
    if (identity[3] === "WeaponSword") identity[3] = "NewBough";
    if (identity[3] === "WeaponBow") identity[3] = "BreezeborneRefrain";
    const releasedKey = key.slice(0, providerEnd + 1) + identity.join("\u0002");
    if (!(releasedKey in buffs)) next[releasedKey] = value;
    delete next[key];
  }
  return next;
}

export function migrateReleasedTeamWeapons<
  T extends {
    compDeltas?: TeamCompDelta[];
    configsByTeamId?: Record<string, TeamSetupConfig>;
    teamComps?: TeamComp[];
  },
>(state: T): T {
  return {
    ...state,
    ...(state.compDeltas
      ? {
          compDeltas: state.compDeltas.map((delta) =>
            delta.kind === "custom"
              ? { ...delta, value: migrateReleasedWeaponComp(delta.value) }
              : delta
          ),
        }
      : {}),
    ...(state.teamComps
      ? { teamComps: state.teamComps.map(migrateReleasedWeaponComp) }
      : {}),
    ...(state.configsByTeamId
      ? {
          configsByTeamId: Object.fromEntries(
            Object.entries(state.configsByTeamId).map(([id, config]) => [
              id,
              migrateReleasedWeaponSetup(config),
            ])
          ),
        }
      : {}),
  };
}

export function migrateReleasedAccountWeapons(data: AccountData): AccountData {
  return {
    ...data,
    characters: (data.characters ?? []).map((character) => ({
      ...character,
      ...(character.weapon
        ? {
            weapon: {
              ...character.weapon,
              key: resolveReleasedWeaponId(character.weapon.key),
            },
          }
        : {}),
    })),
    extraWeapons: (data.extraWeapons ?? []).map((weapon) => ({
      ...weapon,
      key: resolveReleasedWeaponId(weapon.key),
    })),
  };
}

export function migrateWeaponTierStore(
  persistedState: unknown,
  version: number
): Record<string, unknown> {
  const state = migrateGenericTierStore(persistedState, version);
  if (version < 3) {
    const tierLists = state.tierLists as Record<
      number,
      { tierAssignments: TierAssignment }
    >;
    state.tierLists = Object.fromEntries(
      Object.entries(tierLists ?? {}).map(([id, list]) => [
        id,
        {
          ...list,
          tierAssignments: migrateReleasedWeaponRecord(list.tierAssignments),
        },
      ])
    );
  }
  return state;
}
