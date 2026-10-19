import type { BuffActivationMap } from "@/domain/combat/damage/types";
import type { TeamSetupConfig } from "@/domain/team/types";

// Before team v25 / cloud v7, these activation labels were missing or used
// passive provenance as an activation condition. Labels participate in the
// persisted buff identity, so keep authored zero/partial activation overrides.
// The optional ability filter distinguishes Varka's mode bonus from his
// unconditional conversion; Klee's static key distinguishes ATK from proc math.
const CHANGES: readonly (readonly [
  character: string,
  origin: string,
  before: string,
  after: string,
  abilities?: string,
  staticKey?: string,
  receiver?: string,
])[] = [
  ["furina", "C2", "", "Q"],
  ["razor", "C1", "", "orb"],
  ["rosaria", "C1", "", "crit-hit"],
  ["kaeya", "C1", "", "enemy-cryo"],
  ["diluc", "C2", "", "take-dmg"],
  ["klee", "C1", "", "normal,charge,plunge,E,Q", "", "atk%:0.6"],
  ["keqing", "C6", "", "normal,charge,E,Q"],
  ["varka", "P1", "", "E", "normal,charge,skill"],
  ["arataki_itto", "P1", "", "charge"],
  ["xingqiu", "P2", "passive", ""],
  ["mona", "P2", "passive", ""],
  ["yelan", "P1", "A1", ""],
  ["zibai", "P2", "A4", ""],
  ["sethos", "C2", "", "charge,E,Q"],
  [
    "neuvillette",
    "C2",
    "",
    "vaporize,frozen,electroCharged,lunarCharged,bloom,lunarBloom,swirl,crystallize,lunarCrystallize",
  ],
  ["lyney", "P2", "", "pyro-affected"],
  ["nilou", "P2", "", "E"],
  ["flins", "P2", "passive", ""],
  ["linnea", "P2", "passive", ""],
  ["sandrone", "P2", "passive", ""],
  ["arlecchino", "P3", "", "in-combat"],
  ["odette", "P1", "", "E,Q"],
  ["odette", "C2", "", "E,Q"],
  ["odette", "C6", "", "E,Q", undefined, undefined, "team"],
  ["vesna", "P2", "passive", "stellarSwirl"],
  ["vesna", "P2/C4", "passive", "stellarSwirl"],
  ["traveler_anemo", "C2", "passive", ""],
  ["traveler_anemo", "P3", "passive", ""],
  ["traveler_geo", "P3", "passive", ""],
  ["traveler_electro", "P3", "passive", ""],
  ["traveler_dendro", "P3", "passive", ""],
  ["traveler_hydro", "P3", "passive", ""],
  ["traveler_pyro", "P3", "passive", ""],
  ["traveler_cryo", "P4", "passive", ""],
  ["traveler_cryo", "P2", "passive", ""],
  ["yanfei", "P1", "A1", "charge"],
  ["yun_jin", "P2", "A4,Q", "Q"],
  ["kirara", "P2", "A4", ""],
  ["zibai", "P3", "passive", ""],
  ["yelan", "P2", "A4,Q", "Q"],
  ["qiqi", "C2", "passive", "polestar-field,stellarSwirl"],
  ["yumemizuki_mizuki", "P2", "A4,E", "E,teammate-elemental-hit"],
  ["yumemizuki_mizuki", "C1", "passive", "E"],
  ["yoimiya", "P1", "A1", "E,normal"],
  ["yoimiya", "P2", "A4,Q", "Q"],
  ["yae_miko", "P2", "A4", ""],
  ["wriothesley", "P4", "passive", "polestar-field"],
  ["wriothesley", "C4", "passive", "polestar-field"],
  ["xilonen", "P1", "A1", "Nightsoul"],
  ["nefer", "P3", "passive", ""],
  ["flins", "P3", "passive", ""],
  ["flins", "P1", "passive", ""],
  ["lauma", "P3", "passive", ""],
  ["lauma", "P2", "passive", ""],
  ["ineffa", "P3", "passive", ""],
  ["linnea", "P3", "passive", ""],
  ["sandrone", "P3", "passive", ""],
  ["vesna", "P3", "passive", ""],
  ["traveler_cryo", "P3", "passive", ""],
  ["traveler_dendro", "P2", "A4", ""],
  ["kachina", "P2", "A2", ""],
];

export function migrateCharacterBuffActivationMap(
  buffs: BuffActivationMap
): BuffActivationMap {
  const next = { ...buffs };
  for (const [key, value] of Object.entries(buffs)) {
    const providerEnd = key.indexOf("\u0003");
    if (providerEnd < 0) continue;
    const identity = key.slice(providerEnd + 1).split("\u0002");
    if (identity.length !== 5) continue;
    const source = identity[0].split("\u0000");
    const target = identity[1].split("\u0000");
    if (
      source.length !== 8 ||
      target.length !== 7 ||
      source[0] !== "character" ||
      key.slice(0, providerEnd) !== source[1]
    )
      continue;
    const change = CHANGES.find(
      ([character, origin, before, , abilities, staticKey, receiver]) =>
        source[1] === character &&
        source[2] === origin &&
        source[7] === before &&
        (abilities === undefined || target[4] === abilities) &&
        (staticKey === undefined || identity[2] === staticKey) &&
        (receiver === undefined || target[0] === receiver)
    );
    if (!change) continue;
    source[7] = change[3];
    identity[0] = source.join("\u0000");
    const migratedKey = key.slice(0, providerEnd + 1) + identity.join("\u0002");
    // An explicitly authored current identity wins on collisions.
    if (!(migratedKey in buffs)) next[migratedKey] = value;
    delete next[key];
  }
  return next;
}

export function migrateCharacterBuffTriggerConfigs(
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
                  migrateCharacterBuffActivationMap(buffs),
                ])
              ),
            },
          },
        },
      ];
    })
  );
}
