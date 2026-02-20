# Genshin Damage Calculator — Client API Guide

This document explains how to use the `team-comp` module to calculate character damage. It is oriented toward clients integrating the library, focusing on the public API: configuring a team, handling user choices, processing artifacts, and calculating damage results.

## 1. High-Level Concepts

While the module handles complex stat-routing and math internally, clients only need to work with a few core concepts:

- **`TeamBuild`**: The primary orchestrator. It represents a fully initialized team composition (4 characters, their weapons, constellations, and equipped artifact sets).
- **`StatSheet`**: An immutable container for stats. It handles the math of merging baseline stats, percentage modifiers (`atk%`), flat modifiers, and tracking conditional buffs.
- **`CombatOpts`**: User-selected combat options (e.g., toggling a character's stance or selecting a random weapon buff).
- **`StatBuff`, `BuffSource`, and `BuffTarget`**: Objects representing individual game effects. The `BuffSource` is designed for UI display, indicating provenance (where the buff came from, like a weapon passive or constellation), while `BuffTarget` determines who in the party receives it. *(TODO: The API does not yet possess a convenient method to extract the specific list of "currently active" buffs evaluated during damage calculation for UI display.)*
- **`DamageResult`**: The final calculated damage numbers for a specific ability, separated by formula components and hit counts.

## 2. API Workflow

### Step 1: Define the Team (`CharCompConfig`)

To begin, define the configuration for each of the 4 characters in the party using `CharCompConfig`. This structural definition requires character IDs, level, constellation, weapon, and artifact sets.

```typescript
import type { CharCompConfig } from "@/lib/team-comp/types";

const huTaoConfig: CharCompConfig = {
  charId: "hu_tao",
  charLevel: 90,
  constellation: 1,
  weaponId: "staff_of_homa",
  refinement: 1,
  artifactSetId: "crimson_witch_of_flames", // Use null if using a 2+2 build
  artifactHalfSetIds: ["1"], // 4-piece sets usually require 1 half-set ID for their 2-piece base
};

const teamConfigs = [huTaoConfig, xingqiuConfig, yelanConfig, zhongliConfig];
```

### Step 2: User Options (`CombatOpts`)

Some characters and weapons have multiple modes (e.g., the Widsith's random buff, Durin's DPS vs. Support role). Clients can query what options an entity supports to generate UI controls, and then provide the user's choice:

```typescript
import { getEntityOption } from "@/lib/team-comp/damageModels";
import type { CombatOpts } from "@/lib/team-comp/types";

// 1. Query schema for UI rendering
const widsithSchema = getEntityOption("the_widsith"); 
// Returns Object: { label: { en: "Theme" }, choices: [...], default: "em" }

// 2. Provide the user's selected options map
const userOpts: CombatOpts = {
  "the_widsith": "em",
  "durin": "support",
};
```

### Step 3: Instantiate `TeamBuild`

Once you have the structural configurations and the user's selected options, construct the `TeamBuild`. This object evaluates team synergies (like Elemental Resonance) and prepares all static buffs. 

You only need to instantiate this when the structural configurations (teams, weapons, constellations) or `CombatOpts` change. It is intentionally decoupled from artifact sub-stats to ensure the optimization loop remains highly performant!

```typescript
import { TeamBuild } from "@/lib/team-comp/damageCalc";

const teamBuild = new TeamBuild(teamConfigs, userOpts);
```

### Step 4: Convert Artifact Data

During highly repetitive calculation loops (like artifact optimization) or when displaying an exact build, you need to provide the raw stats granted by the respective equipped artifacts.

If you have a collection of GOOD format `ArtifactData` objects, you can convert them into robust `StatSheet` instances using `StatSheet.fromArtifacts()`:

```typescript
import { StatSheet } from "@/lib/team-comp/damageModels";
import type { ArtifactData } from "@/data/types";

// Example artifact data from a character's equipped artifacts
const huTaoArtifacts: ArtifactData[] = Object.values(accountData.characters.find(c => c.key === "hu_tao")?.artifacts ?? {});
const xingqiuArtifacts: ArtifactData[] = Object.values(accountData.characters.find(c => c.key === "xingqiu")?.artifacts ?? {});

const artifactSheets = {
  "hu_tao": StatSheet.fromArtifacts(huTaoArtifacts),
  "xingqiu": StatSheet.fromArtifacts(xingqiuArtifacts),
  // yelan...
  // zhongli...
};
```

*(Note: If you are synthesizing stats manually rather than from specific artifacts, you can still use `StatSheet.fromRaw({ "hp%": 0.466, "cr": 0.311 })`)*

### Step 5: Query Formulas & UI Selection

Before calculating damage, you must know what ability to evaluate. `TeamBuild` provides a method to query the complete list of available formulas across all team members. This is designed so you can populate your UI and let the user select an ability.

```typescript
// Query available formulas dynamically to populate the UI
// Returns: Record<charId, Record<formulaId, I18nLabel>>
const availableFormulas = teamBuild.getFormulaIds(); 
// e.g., { "hu_tao": { "charged-atk-vaporize": { zh: "重击（蒸发）", en: "Charged ATK (Vaporize)" }, ... } }
```

### Step 6: Resolve Team Stats

Once the user selects a formula (e.g., Hu Tao's Vaporize Charged Attack), you can identify the primary character and designate them as the `calcTargetId`. This represents the character who is currently considered "on-field" for damage calculation. 

Run `getTeamStats` to finalize the stat calculations. This step evaluates dynamic buffs and properly routes `onField` buffs (like Bennett's Burst) to the designated active character.

```typescript
// Resolve the final stat sheets for all 4 characters, assuming Hu Tao is on-field
const postStats = teamBuild.getTeamStats(artifactSheets, "hu_tao");
```

### Step 7: Calculate Damage Result

Finally, define the scenario context (`CalcContext`) and ask the `TeamBuild` to execute the calculation for the user's selected ability.

```typescript
import type { CalcContext } from "@/lib/team-comp/types";

// Setup scenario
const ctx: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.10,
  assumeCrit: true, // 'true' shows peak Crit DMG ceilings; 'false' factors in Crit Rate averages
};

// Calculate final damage for the chosen formula!
const dmgResult = teamBuild.getDamageResult("hu_tao", "charged-atk-vaporize", postStats, ctx);
```

## 3. Internal Concepts Primer

If you're curious about *how* the engine maintains calculation purity beneath the public API, here are the foundational internal mechanisms:

- **`DamageTag`** & **`DamageTagFilter`**: Abilities are deeply categorized (e.g., `Element: Pyro`, `Ability: Burst`, `Reaction: Vaporize`). Buffs hold equivalent conceptual filters (e.g., "Only applies to Burst DMG"). When formulas read stats from the `StatSheet`, they automatically supply their tags to inherit exactly the right dynamically-scoped modifiers.
- **Buff Receivers**: Buffs within the kit definitions explicitly state their target logic. A buff might target `selfOnField` (Hu Tao's +33% Pyro DMG), `team` (Noblesse Oblige's +20% ATK), or `onField` (Bennett's flat ATK scaling transfer). `getTeamStats(artifactSheets, calcTargetId)` leverages these instructions to perfectly mimic off-field vs. on-field stat transferability.
- **`TeamMeta`**: Built automatically during `TeamBuild` construction. This reads the roster configurations to rapidly answer queries like "Does this team have a shielder?" or "Can this team trigger Vaporize computation?". Conditionals dynamically activate depending on the answers `TeamMeta` provides.
