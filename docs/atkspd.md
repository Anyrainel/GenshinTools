# Attack Speed (`atkSpd%`) Implementation Summary

This document summarizes the current implementation status of Attack Speed (`atkSpd%`) buffs across all character kits in the GenshinTools project. 

The `atkSpd%` stat is fully integrated into the `StatKey` union type (`types.ts`), and various characters provide this buff conditionally through talents, constellations, or active abilities. 

## 5-Star Characters

*   **Arataki Itto**
    *   **Source 1:** Passive Talent 1 (Arataki Kesagiri)
        *   **Buff:** +30% ATK SPD (implemented as a max assumed value).
        *   **Condition:** Applies to self, specific to Charged Attacks (`filter: { abilities: ["charge"] }`).
    *   **Source 2:** Elemental Burst (Raging Oni King State)
        *   **Buff:** +10% ATK SPD.
        *   **Condition:** Applies to self, specific to Normal Attacks (`filter: { abilities: ["normal"] }`).
*   **Cyno**
    *   **Source:** Elemental Burst (Pactsworn Pathclearer State)
        *   **Buff:** +20% ATK SPD.
        *   **Condition:** Applies to self, specific to Normal Attacks (`filter: { abilities: ["normal"] }`).
*   **Diluc**
    *   **Source 1:** Constellation 2
        *   **Buff:** +5% ATK SPD per stack (up to 3 stacks, max +15%).
        *   **Condition:** Applies to self upon taking DMG.
    *   **Source 2:** Constellation 6
        *   **Buff:** +30% ATK SPD.
        *   **Condition:** Applies to self for the next 2 Normal Attacks after casting Elemental Skill (`filter: { abilities: ["normal"] }`).
*   **Jean**
    *   **Source:** Constellation 2
        *   **Buff:** +15% ATK SPD.
        *   **Condition:** Applies to the entire team upon picking up an Elemental Orb/Particle (`receiver: "team"`).
*   **Kamisato Ayato**
    *   **Source:** Constellation 4
        *   **Buff:** +15% ATK SPD.
        *   **Condition:** Applies to nearby team members for 15s after casting Elemental Burst (`filter: { abilities: ["normal"] }`).
*   **Wanderer**
    *   **Source:** Constellation 1
        *   **Buff:** +10% ATK SPD.
        *   **Condition:** Applies to self for Normal and Charged Attacks during Elemental Skill (`filter: { abilities: ["normal", "charge"] }`).

## 4-Star Characters

*   **Beidou**
    *   **Source:** Passive Talent 2
        *   **Buff:** +15% ATK SPD.
        *   **Condition:** Applies to self for 10s after casting Elemental Skill with max damage/perfect counter (`filter: { abilities: ["normal", "charge"] }`).
*   **Chongyun**
    *   **Source:** Passive Talent 1
        *   **Buff:** +8% ATK SPD.
        *   **Condition:** Applies to active on-field characters within the Elemental Skill field, specific to Normal Attacks (`filter: { abilities: ["normal"] }`). *(Note: Weapon type filtering for Sword/Claymore/Polearm is stylized as general Normal Attacks)*
*   **Dahlia**
    *   **Source 1:** Elemental Burst (Radiant Psalter)
        *   **Buff:** +10% ATK SPD.
        *   **Condition:** Applies to the active on-field character.
    *   **Source 2:** Passive Talent 2
        *   **Buff:** Dynamic ATK SPD scaling with Max HP (up to +20%).
        *   **Condition:** Applies to the active on-field character while Elemental Burst is active.
*   **Kaveh**
    *   **Source:** Elemental Burst
        *   **Buff:** +15% ATK SPD.
        *   **Condition:** Applies to self, specific to Normal Attacks (`filter: { abilities: ["normal"] }`).
*   **Mika**
    *   **Source:** Elemental Skill (Soulwind State)
        *   **Buff:** +22% ATK SPD (Lv10) / +25% ATK SPD (Lv13 / C5+).
        *   **Condition:** Applies to the active on-field character.
*   **Razor**
    *   **Source:** Elemental Burst
        *   **Buff:** +40% ATK SPD (Lv10 / Lv13).
        *   **Condition:** Applies to self, specific to Normal Attacks (`filter: { abilities: ["normal"] }`).
*   **Rosaria**
    *   **Source:** Constellation 1
        *   **Buff:** +10% ATK SPD.
        *   **Condition:** Applies to self for 4s upon scoring a CRIT Hit, specific to Normal Attacks (`filter: { abilities: ["normal"] }`).
*   **Yun Jin**
    *   **Source:** Constellation 6
        *   **Buff:** +12% ATK SPD.
        *   **Condition:** Applies to the team within the Elemental Burst field, specific to Normal Attacks (`filter: { abilities: ["normal"] }`).

## Future Considerations and Blockers

*   **Motion Value / Hitlag:** Although the `atkSpd%` stat is correctly buffed and tracked internally via the modifier system, the actual translation of ATK SPD% into exact frame counts or increased DPS over time requires complex hitlag and animation state logic mapping.
*   **Weapon Filtering:** Some buffs (e.g. Chongyun's) only affect specific weapon types. Currently, they are implemented generally for `abilities: ["normal"]` as weapon type filtering is not explicitly supported in the `StatFilter` system yet.
