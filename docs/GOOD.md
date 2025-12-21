# Genshin Open Object Description (GOOD)

**Version 3**

**GOOD** is a data format description to map Genshin Data into a parsable JSON. This is intended to be a standardized format to allow Genshin developers/programmers to transfer data without needing manual conversion.

## Structure

```typescript
interface IGOOD {
  format: "GOOD"; // A way for people to recognize this format.
  version: number; // GOOD API version.
  source: string; // The app that generates this data.
  characters?: ICharacter[];
  artifacts?: IArtifact[];
  weapons?: IWeapon[];
  materials?: {
    // Added in version 2
    [key: MaterialKey]: number;
  };
}
```

## Artifact Data Representation

```typescript
interface IArtifact {
  setKey: SetKey; //e.g. "GladiatorsFinale"
  slotKey: SlotKey; //e.g. "plume"
  level: number; //0-20 inclusive
  rarity: number; //1-5 inclusive
  mainStatKey: StatKey;
  location: CharacterKey | ""; //where "" means not equipped.
  lock: boolean; //Whether the artifact is locked in game.
  substats: ISubstat[];

  // Below are new to GOOD 3
  totalRolls?: number; // 3-9 for valid 5* artifacts; includes starting rolls
  astralMark?: boolean; // Favorite star in-game
  elixirCrafted?: boolean; // Flag for if the artifact was created using Sanctifying Elixir. This guarantees the main stat + 2 additional rolls on the first 2 substats
  unactivatedSubstats?: ISubstat[]; // Unactivated substat(s). Once a substat is activated, it should be moved to `substats` instead
}

interface ISubstat {
  key: StatKey; //e.g. "critDMG_"
  value: number; //e.g. 19.4

  // Below is new to GOOD 3
  initialValue?: number; // Initial roll of the artifact, if it is known. This includes the first roll of this stat, even if it was not revealed initially e.g. from `unactivatedSubstats`
}

type SlotKey = "flower" | "plume" | "sands" | "goblet" | "circlet";
```

## Weapon Data Representation

```typescript
interface IWeapon {
  key: WeaponKey; //"CrescentPike"
  level: number; //1-90 inclusive
  ascension: number; //0-6 inclusive. need to disambiguate 80/90 or 80/80
  refinement: number; //1-5 inclusive
  location: CharacterKey | ""; //where "" means not equipped.
  lock: boolean; //Whether the weapon is locked in game.
}
```

## Character Data Representation

```typescript
interface ICharacter {
  key: CharacterKey; //e.g. "Rosaria"
  level: number; //1-100 inclusive
  constellation: number; //0-6 inclusive
  ascension: number; //0-6 inclusive. need to disambiguate 80/90 or 80/80
  talent: {
    //does not include boost from constellations. 1-15 inclusive
    auto: number;
    skill: number;
    burst: number;
  };
}
```

## Key Naming Convention

The keys in the GOOD format, like Artifact sets, weapon keys, and character keys, are all in **PascalCase**. This makes the name easy to derive from the in-game text, assuming no renames occur. If a rename is needed, then the standard will have to increment versions.

To derive the PascalKey from a specific name, remove all symbols from the name, and Capitalize each word:

- `Gladiator's Finale` $\rightarrow$ `GladiatorsFinale`
- `Spirit Locket of Boreas` $\rightarrow$ `SpiritLocketOfBoreas`
- `"The Catch"` $\rightarrow$ `TheCatch`

### StatKey

The explicitly defined statistics keys are:

```typescript
type StatKey =
  | "hp"
  | "hp_"
  | "atk"
  | "atk_"
  | "def"
  | "def_"
  | "eleMas"
  | "enerRech_"
  | "heal_"
  | "critRate_"
  | "critDMG_"
  | "physical_dmg_"
  | "anemo_dmg_"
  | "geo_dmg_"
  | "electro_dmg_"
  | "hydro_dmg_"
  | "pyro_dmg_"
  | "cryo_dmg_"
  | "dendro_dmg_";
```

### Other Keys

- **ArtifactSetKey**: PascalCase of the English set name.
- **CharacterKey**: PascalCase of the English character name.
- **WeaponKey**: PascalCase of the English weapon name.
- **MaterialKey**: PascalCase of the English material item name.

## Version History

### Version 1

Created general `IGOOD` format with character, weapon, artifact fields.

### Version 2

Adds `materials` field to `IGOOD`. All other fields remain the same. V2 is backwards compatible with V1.

### Version 3

Adds new fields to `IArtifact` to represent new in-game properties, store initial rolls for reroll information, and help differentiate between 3 and 4-line starts for 5\* artifacts. All other fields remain the same. V3 is backwards compatible with V2.

New fields for `IArtifact`:

- `totalRolls`
- `astralMark`
- `elixirCrafted`
- `unactivatedSubstats`

New field for `ISubstat`:

- `initialValue`

```

```
