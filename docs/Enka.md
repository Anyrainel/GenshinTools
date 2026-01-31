# Enka API → GOOD Format Mapping

Field mappings from Enka Network API response to GOOD (Genshin Open Object Description) format.

## Root Response

| Enka Field | GOOD Field | Notes |
|------------|------------|-------|
| `playerInfo` | — | Player profile data, not imported |
| `avatarInfoList[]` | `characters[]`, `weapons[]`, `artifacts[]` | Each avatar contains character + equipped items |
| `ttl` | — | Cache TTL in seconds |
| `uid` | — | Player UID |

## playerInfo (Ignored)

Player profile metadata. Not part of GOOD spec.

| Enka Field | Notes |
|------------|-------|
| `nickname` | Player display name |
| `level` | Adventure Rank |
| `signature` | Profile signature |
| `worldLevel` | World Level (1-9) |
| `nameCardId` | Active namecard ID |
| `finishAchievementNum` | Achievement count |
| `towerFloorIndex` | Spiral Abyss floor |
| `towerLevelIndex` | Spiral Abyss chamber |
| `showAvatarInfoList[]` | Profile showcase avatars (summary only) |
| `showNameCardIdList[]` | Displayed namecards |
| `profilePicture` | Profile avatar icon |
| `theaterActIndex` | Imaginarium Theater act |
| `theaterModeIndex` | Imaginarium Theater mode |
| `theaterStarIndex` | Imaginarium Theater stars |
| `isShowAvatarTalent` | Whether talent levels are shown |
| `fetterCount` | Friendship count |
| `towerStarIndex` | Spiral Abyss total stars |
| `stygianIndex` | Event-specific data |
| `stygianSeconds` | Event-specific data |
| `stygianId` | Event-specific data |

## avatarInfoList[] → Character

| Enka Field | GOOD Field | Notes |
|------------|------------|-------|
| `avatarId` | `characters[].key` | Lookup via `characterIdMap` |
| `propMap["4001"].ival` | `characters[].level` | Missing = 1 |
| `propMap["1002"].ival` | `characters[].ascension` | Missing = 0 |
| `propMap["1001"].ival` | — | XP to next level (ignored) |
| `propMap["1003"].ival` | — | Unknown property |
| `propMap["1004"].ival` | — | Unknown property |
| `propMap["10010"].ival` | — | Satiation/stamina related |
| `propMap["10049"].ival` | — | Satiation/stamina related |
| `talentIdList[]` | `characters[].constellation` | Length of array; Missing = 0 |
| `skillDepotId` | — | Used to disambiguate Traveler elements |
| `skillLevelMap[skillId]` | `characters[].talent.auto/skill/burst` | Missing = 1; Order based on `skillOrder` array |
| `inherentProudSkillList[]` | — | Unlocked passive talents (ignored) |
| `proudSkillExtraLevelMap` | — | Constellation-granted bonus levels (ignored, not added to `skillLevelMap`) |
| `fightPropMap` | — | Computed final stats (ignored) |
| `fetterInfo.expLevel` | — | Friendship level (ignored) |
| `equipList[]` | See below | Contains weapons and artifacts |
| `costumeId` | — | Equipped costume ID (ignored) |

## equipList[] → Weapon (when itemType = "ITEM_WEAPON")

| Enka Field | GOOD Field | Notes |
|------------|------------|-------|
| `itemId` | `weapons[].key` | Lookup via `weaponIdMap` |
| `weapon.level` | `weapons[].level` | Missing = 1 |
| `weapon.promoteLevel` | `weapons[].ascension` | Missing = 0 |
| `weapon.affixMap[affixId]` | `weapons[].refinement` | Value + 1 (0-indexed → 1-indexed); Missing = 1 |
| Parent `avatarId` | `weapons[].location` | Character key who has it equipped |
| `flat.nameTextMapHash` | — | Weapon name hash (ignored) |
| `flat.rankLevel` | — | Rarity (ignored, derived from weapon data) |
| `flat.icon` | — | Icon asset name (ignored) |
| `flat.weaponStats[]` | — | Computed weapon stats (ignored) |

## equipList[] → Artifact (when itemType = "ITEM_RELIQUARY")

| Enka Field | GOOD Field | Notes |
|------------|------------|-------|
| `itemId` | — | Internal item ID (ignored) |
| `reliquary.level` | `artifacts[].level` | Value - 1 (1-indexed → 0-indexed); Missing = 0 |
| `reliquary.mainPropId` | `artifacts[].mainStatKey` | Numeric ID, lookup via `statIdMap` |
| `reliquary.appendPropIdList[]` | `artifacts[].totalRolls` | Length of array = total substat rolls |
| Parent `avatarId` | `artifacts[].location` | Character key who has it equipped |
| `flat.icon` | `artifacts[].setKey` | Extract set ID via regex `/RelicIcon_(\d+)_/`, lookup via `artifactIdMap` |
| `flat.setId` | — | Set ID (alternative to icon parsing, currently unused) |
| `flat.equipType` | `artifacts[].slotKey` | Lookup via `SLOT_MAP` |
| `flat.rankLevel` | `artifacts[].rarity` | Missing = 5 |
| `flat.nameTextMapHash` | — | Piece name hash (ignored) |
| `flat.setNameTextMapHash` | — | Set name hash (ignored) |
| `flat.reliquaryMainstat` | — | Main stat (string format, redundant with `mainPropId`) |
| `flat.reliquarySubstats[]` | `artifacts[].substats[]` | See below |
| `flat.setAndKindIcon` | — | Alternative icon path (fallback for set ID extraction) |

### Substat Mapping

| Enka Field | GOOD Field | Notes |
|------------|------------|-------|
| `flat.reliquarySubstats[].appendPropId` | `artifacts[].substats[].key` | String key (e.g., `FIGHT_PROP_CRITICAL`), lookup via `statIdMap` |
| `flat.reliquarySubstats[].statValue` | `artifacts[].substats[].value` | |

## Stat ID Mapping

Both numeric IDs (from `mainPropId`, `appendPropIdList`) and string keys (from `flat.reliquarySubstats`) map to GOOD stat keys:

| Enka Key | GOOD Key |
|----------|----------|
| `FIGHT_PROP_HP` | `hp` |
| `FIGHT_PROP_HP_PERCENT` | `hp_` |
| `FIGHT_PROP_ATTACK` | `atk` |
| `FIGHT_PROP_ATTACK_PERCENT` | `atk_` |
| `FIGHT_PROP_DEFENSE` | `def` |
| `FIGHT_PROP_DEFENSE_PERCENT` | `def_` |
| `FIGHT_PROP_CRITICAL` | `critRate_` |
| `FIGHT_PROP_CRITICAL_HURT` | `critDMG_` |
| `FIGHT_PROP_CHARGE_EFFICIENCY` | `enerRech_` |
| `FIGHT_PROP_HEAL_ADD` | `heal_` |
| `FIGHT_PROP_ELEMENT_MASTERY` | `eleMas` |
| `FIGHT_PROP_PHYSICAL_ADD_HURT` | `physical_dmg_` |
| `FIGHT_PROP_FIRE_ADD_HURT` | `pyro_dmg_` |
| `FIGHT_PROP_ELEC_ADD_HURT` | `electro_dmg_` |
| `FIGHT_PROP_WATER_ADD_HURT` | `hydro_dmg_` |
| `FIGHT_PROP_WIND_ADD_HURT` | `anemo_dmg_` |
| `FIGHT_PROP_ICE_ADD_HURT` | `cryo_dmg_` |
| `FIGHT_PROP_ROCK_ADD_HURT` | `geo_dmg_` |
| `FIGHT_PROP_GRASS_ADD_HURT` | `dendro_dmg_` |

## Slot Type Mapping

| Enka `equipType` | GOOD `slotKey` |
|------------------|----------------|
| `EQUIP_BRACER` | `flower` |
| `EQUIP_NECKLACE` | `plume` |
| `EQUIP_SHOES` | `sands` |
| `EQUIP_RING` | `goblet` |
| `EQUIP_DRESS` | `circlet` |
