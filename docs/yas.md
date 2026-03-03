# yas (Yet Another Scanner)

**Repository:** https://github.com/1803233552/yas

yas is a high-performance artifact scanner for Genshin Impact (and Honkai: Star Rail) written in Rust. It uses SVTR (MobileNetV3_Small + Transformer) character recognition to read artifact data directly from the game window.

## Released Binary

The released binary is **`yas_artifact`** (defined in the `yas-application` crate). It supports four export formats via `--format` / `-f`:

| Format     | File name        | Default? |
| ---------- | ---------------- | -------- |
| Mona       | `mona.json`      | Yes      |
| MingyuLab  | `mingyulab.json` | No       |
| **GOOD**   | `good.json`      | No       |
| CSV        | `artifacts.csv`  | No       |

There is also an `All` option that writes every format at once.

> **Important:** The default format is **Mona**, not GOOD. Users must pass `-f good` (or `-f all`) to get `good.json`.

## GOOD vs Mona: Information Content

Both formats are serialized from the same internal `GenshinArtifact` struct, so they carry **equivalent information**. Neither format has data the other lacks in a meaningful way:

| Field              | GOOD            | Mona                | Notes |
| ------------------ | --------------- | ------------------- | ----- |
| Set name           | `setKey`        | `setName`           | Same data, different naming convention |
| Slot               | `slotKey`       | `position`          | Same data, slightly different slot names |
| Level              | `level`         | `level`             | Identical |
| Rarity             | `rarity`        | `star`              | Identical |
| Main stat name     | `mainStatKey`   | `mainTag.name`      | Same data, different stat name convention |
| Main stat **value**| **absent**      | `mainTag.value`     | Derivable from key + level + rarity |
| Substats           | `substats[]`    | `normalTags[]`      | Same data |
| Equipped character | `location`      | `equip`             | Same data |
| Lock status        | `lock`          | **absent**          | Only in GOOD |
| Omit flag          | **absent**      | `omit` (always `false`) | Useless |

GOOD actually preserves slightly *more* (lock status). Mona's only extra is the main stat value, which is fully deterministic from the stat key, level, and rarity.

## GOOD Export Details

When GOOD is selected, yas writes a file with this top-level shape:

```json
{
  "format": "GOOD",
  "version": 1,
  "source": "yas",
  "artifacts": [ ... ]
}
```

Each artifact entry:

```json
{
  "setKey": "GladiatorsFinale",
  "slotKey": "plume",
  "level": 20,
  "rarity": 5,
  "mainStatKey": "atk",
  "location": "Xiangling",
  "lock": true,
  "substats": [
    { "key": "critDMG_", "value": 19.4 },
    { "key": "atk_",     "value": 5.8  }
  ]
}
```

Key mapping details:

- **StatKey** values match GOOD spec exactly: `hp`, `hp_`, `atk`, `atk_`, `def`, `def_`, `eleMas`, `enerRech_`, `heal_`, `critRate_`, `critDMG_`, `physical_dmg_`, `anemo_dmg_`, etc.
- **SlotKey** values: `flower`, `plume`, `sands`, `goblet`, `circlet`.
- **SetKey** values: PascalCase, matching GOOD convention (e.g. `CrimsonWitchOfFlames`).
- **Flat stats** (ATK, HP, DEF, EM) are stored as-is. **Percentage stats** are stored multiplied by 100 (e.g. 19.4 for 19.4% crit damage). This matches the GOOD spec.
- **location** is the English PascalCase character name, or `""` if unequipped. yas translates from zh_CN internally.

### Differences from GOOD v3

yas outputs **GOOD version 1**. It is missing the v3 fields:

| GOOD v3 Field          | Present in yas? |
| ---------------------- | --------------- |
| `totalRolls`           | No              |
| `astralMark`           | No              |
| `elixirCrafted`        | No              |
| `unactivatedSubstats`  | No              |
| `initialValue` (substat) | No            |

It also only exports **artifacts** — there are no `characters` or `weapons` arrays.

## Mona Export Format (Default)

For reference, the default Mona format looks different:

```json
{
  "version": "1",
  "flower": [...],
  "feather": [...],
  "sand": [...],
  "cup": [...],
  "head": [...]
}
```

Each artifact:

```json
{
  "setName": "archaicPetra",
  "position": "flower",
  "mainTag": { "name": "lifeStatic", "value": 4780 },
  "normalTags": [
    { "name": "critical", "value": 0.062 },
    { "name": "attackPercentage", "value": 0.058 }
  ],
  "level": 20,
  "star": 5,
  "equip": "Zhongli",
  "omit": false
}
```

Notable differences from GOOD:
- Artifacts grouped by slot, not in a flat array.
- Set/stat names use different conventions (camelCase, descriptive names like `"critical"` instead of `"critRate_"`).
- Percentage values stored as decimals (0.062) rather than multiplied by 100 (6.2).
- No `format`/`source` envelope.

## Compatibility With This Project

**yas's GOOD output is directly compatible** with our GOOD importer (`goodConversion.ts`). No conversion is needed.

Our importer:
1. Does **not** validate the `version` field, so `version: 1` is accepted.
2. Only reads `artifacts`, `characters`, and `weapons` arrays — missing arrays are simply skipped.
3. All stat keys, slot keys, and set keys that yas emits match the mapping tables in `goodConversion.ts`.

### Option A: Use GOOD export directly

If users can re-run the scanner:

```
yas_artifact -f good
```

Import the resulting `good.json` directly — no transformation required.

### Option B: Convert existing Mona output

Since most users will already have `mona.json` (the default), a Mona-to-GOOD converter is the more practical path. The converter would need to:

1. Flatten the slot-grouped arrays (`flower`, `feather`, `sand`, `cup`, `head`) into a single `artifacts` array.
2. Map slot names: `feather` -> `plume`, `cup` -> `goblet`, `head` -> `circlet` (flower and sand stay the same but sand -> sands).
3. Map stat names from Mona convention to GOOD stat keys (e.g. `critical` -> `critRate_`, `attackPercentage` -> `atk_`).
4. Multiply percentage stat values by 100 (Mona stores 0.062, GOOD expects 6.2).
5. Map set names from camelCase to PascalCase.
6. Wrap in a GOOD envelope: `{ "format": "GOOD", "version": 1, "source": "yas-mona-converted", "artifacts": [...] }`.
