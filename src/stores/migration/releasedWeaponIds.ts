import { resolveReleasedWeaponId } from "@/domain/build/weaponIds";
import type { BuffActivationMap } from "@/domain/combat/damage/types";
import type { AccountData, TierAssignment } from "@/domain/models";
import type { TeamCompDelta } from "@/domain/team/teamDeltas";
import type { TeamComp, TeamSetupConfig } from "@/domain/team/types";
import { migrateGenericTierStore } from "./tier";

// Before 7.1, these released four-star weapons used temporary beta IDs in
// weapon keys, team slots, combat-option keys, analyzer alternatives and tiers.
// Before 7.2, Starsealed Edict used weapon_catalyst in those same fields.

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
                  ([line, buffs]) => [line, migrateBetaBuffOverrides(buffs)]
                )
              ),
            },
          },
        }
      : {}),
    ...(Array.isArray(config.investment?.configs)
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

function migrateBetaBuffOverrides(buffs: BuffActivationMap): BuffActivationMap {
  const next = { ...buffs };
  for (const [key, value] of Object.entries(buffs)) {
    // The canonical buff key is provider + U+0003 + five U+0002-separated
    // identity fields; source fields are U+0000-separated. Never replace text
    // inside opaque unknown keys.
    const providerEnd = key.indexOf("\u0003");
    if (providerEnd < 0) continue;
    const identity = key.slice(providerEnd + 1).split("\u0002");
    const source = identity[0].split("\u0000");
    if (identity.length !== 5 || source.length !== 8) continue;
    // v25 Mitya C1/C2 values were beta estimates. Their corrected static
    // values change identity keys even though activation and recipients agree.
    if (
      source[0] === "character" &&
      source[1] === "mitya" &&
      key.slice(0, providerEnd) === "mitya" &&
      source.slice(3, 7).every((field) => field === "") &&
      source[7] === "E" &&
      identity[3] === "StatBuff" &&
      identity[4] === ""
    ) {
      const changes = [
        ["C1", ["teamOnField", "", "", "", "", "", ""], "cd:0.5", "cd:0.4"],
        [
          "C2",
          ["team", "", "", "", "", "Cryo,Electro", ""],
          "resReduction%:0.25",
          "resReduction%:0.2",
        ],
        ["C2", ["team", "", "", "", "", "", ""], "em:100", "em:123"],
        ["C2", ["teamOnField", "", "", "", "", "", ""], "em:200", "em:234"],
      ] as const;
      const change = changes.find(
        ([origin, target, before]) =>
          source[2] === origin &&
          identity[1] === target.join("\u0000") &&
          identity[2] === before
      );
      if (!change) continue;
      identity[2] = change[3];
      const currentKey =
        key.slice(0, providerEnd + 1) + identity.join("\u0002");
      if (!(currentKey in buffs)) next[currentKey] = value;
      delete next[key];
      continue;
    }
    // Before team v26/cloud v8, Glacier's unconditional reaction bonuses were
    // labeled on-reaction and its Burst bonus used burst rather than Q. These
    // labels are part of persisted authored buff activation identities.
    if (
      source[0] === "artifactSet" &&
      source[1] === "glacier_and_snowfield" &&
      source.slice(2, 7).every((field) => field === "") &&
      identity[3] === "StatBuff" &&
      identity[4] === ""
    ) {
      const target = identity[1].split("\u0000");
      if (
        target.length !== 7 ||
        target[0] !== "self" ||
        !target.slice(1, 6).every((field) => field === "")
      )
        continue;
      if (
        source[7] === "on-reaction" &&
        ((target[6] === "superconduct" && identity[2] === "reactionDmg%:1") ||
          (target[6] === "melt" && identity[2] === "reactionDmg%:0.15"))
      ) {
        source[7] = "";
      } else if (
        source[7] === "burst" &&
        target[6] === "" &&
        identity[2] === "cryo%:0.3"
      ) {
        source[7] = "Q";
      } else continue;
      identity[0] = source.join("\u0000");
      const currentKey =
        key.slice(0, providerEnd + 1) + identity.join("\u0002");
      if (!(currentKey in buffs)) next[currentKey] = value;
      delete next[key];
      continue;
    }
    if (source[0] !== "weapon") continue;
    const releasedId = resolveReleasedWeaponId(source[1]);
    const refinement = Number(source[2].replace(/^R/, ""));
    const oldStellarValue = [0.12, 0.15, 0.18, 0.21, 0.24][refinement - 1];
    const changesStellarTrigger =
      releasedId === "starsealed_edict" &&
      /^R[1-5]$/.test(source[2]) &&
      source.slice(3, 7).every((field) => field === "") &&
      source[7] === "E,stellarConduct" &&
      identity[1] ===
        ["self", "", "", "", "", "", "stellarConduct"].join("\u0000") &&
      identity[2] === `reactionCd:${3 * oldStellarValue}` &&
      identity[3] === "StatBuff" &&
      identity[4] === "";
    if (releasedId === source[1] && !changesStellarTrigger) continue;
    source[1] = releasedId;
    const existingReleasedKey =
      key.slice(0, providerEnd + 1) +
      [source.join("\u0000"), ...identity.slice(1)].join("\u0002");
    if (existingReleasedKey !== key && existingReleasedKey in buffs) {
      delete next[key];
      continue;
    }
    if (changesStellarTrigger) source[7] = "E,elemental-reaction";
    if (source[4] === "weapon-bow-stellar-dmg")
      source[4] = "breezeborne-refrain-stellar-dmg";
    identity[0] = source.join("\u0000");
    if (identity[3] === "WeaponSword") identity[3] = "NewBough";
    if (identity[3] === "WeaponBow") identity[3] = "BreezeborneRefrain";
    if (identity[3] === "WeaponCatalyst") identity[3] = "StarsealedEdict";
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
  if (version < 4) {
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
