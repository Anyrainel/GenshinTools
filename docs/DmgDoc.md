# Genshin Damage Calculator — Client API Guide

This document explains how to use the `team-comp` module to calculate character damage. It is oriented toward clients integrating the library, focusing on the public API: configuring a team, handling user choices, processing artifacts, and calculating damage results.

## 1. High-Level Concepts

While the module handles complex stat-routing and math internally, clients only need to work with a few core concepts:

- **`TeamBuild`**: The primary orchestrator. It represents a fully initialized team composition (4 characters, their weapons, constellations, and equipped artifact sets).
- **`StatSheet`**: An immutable container for stats. It handles the math of merging baseline stats, percentage modifiers (`atk%`), flat modifiers, and tracking conditional buffs.
- **`CombatOpts`**: User-selected combat options (e.g., toggling a character's stance or selecting a random weapon buff).
- **`StatBuff`, `BuffSource`, and `BuffTarget`**: Objects representing individual game effects. The `BuffSource` is designed for UI display, indicating provenance (where the buff came from, like a weapon passive or constellation), while `BuffTarget` determines who in the party receives it. Use `getDisplayResult().buffs` to extract the resolved buff ledger (see Step 7b).
- **`DamageResult`**: The final calculated damage numbers for a specific ability, with per-formula hit-weighted damage.
- **`DisplayResult`**: A richer alternative to `DamageResult` for UI display. Includes formula breakdown, resolved buffs, full team idle/combat stats, and marginal gain analysis per stat.

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

### Step 7a: Calculate Damage Result (Hot Path)

For performance-critical loops like artifact optimization, use `getDamageResult()`. This is the **hot path** — returns only the damage numbers with no display overhead.

```typescript
import type { CalcContext } from "@/lib/team-comp/types";

const ctx: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.10,
  assumeCrit: true,
};

const dmgResult = teamBuild.getDamageResult("hu_tao", "charged-atk-vaporize", postStats, ctx);
// dmgResult.totalDamage: number
// dmgResult.parts: { damage: number, hits: number }[]
```

### Step 7b: Get Display Result (Cold Path)

For UI display (detail panels, stat breakdowns, build analysis), use `getDisplayResult()`. This is the **cold path** — same stat resolution as Step 6+7a but captures rich intermediate data for rendering.

> **Key difference:** `getDisplayResult()` takes `artifactStats` (not pre-resolved `postStats`) because it runs the full resolution pipeline internally to capture intermediate phases.

```typescript
import type { DisplayResult } from "@/lib/team-comp/types";

const display: DisplayResult = teamBuild.getDisplayResult(
  "hu_tao",                   // calc target (on-field character)
  "charged-atk-vaporize",     // selected formula
  artifactSheets,             // raw artifact stat sheets (NOT postStats)
  ctx                         // same CalcContext as hot path
);
```

The `DisplayResult` contains five sections:

#### Formula Breakdown (`parts` / `totalDamage`)

```typescript
display.totalDamage;  // Final damage number (identical to getDamageResult().totalDamage)

for (const part of display.parts) {
  part.template;      // "direct" | "amplify" | "catalyze" | "transform" | "lunar" | "lunarDirect"
  part.scalingKeys;   // e.g., ["atk"] — which stats the formula scales off
  part.scalingMulti;  // e.g., [2.426] — 1:1 with scalingKeys, the talent multipliers
  part.statValues;    // e.g., { atk: 1500, cr: 0.65, cd: 1.70, "pyro%": 0.466, ... }
  part.params;        // Template-specific coefficients: { baseDmg, dmgBonusMult, defMult, resMult, critMult }
  part.damage;        // This part's damage contribution
}
```

- **`template`**: Determines which UI renderer to use (each template has different formula zones).
- **`statValues`**: Every stat the formula reads, mapped key → value. These are the **cross-highlight targets** — hovering a stat in the sheet highlights where it appears in the formula, and vice versa.
- **`scalingKeys` / `scalingMulti`**: Separate from `statValues` for direct access to talent multipliers. Array index correspondence: `scalingMulti[i]` is the multiplier for `scalingKeys[i]`.
- **`params`**: Named numeric coefficients specific to the template (e.g., `reactionCoeff` for amplify, `levelCoeff` for transform). Well-known per template — the UI formatter reads these by key.

#### Resolved Buffs (`buffs`)

```typescript
for (const buff of display.buffs) {
  buff.source;         // { type: "character"|"weapon"|..., id: "hu_tao" }
  buff.target;         // { receiver: "self"|"team"|"onField"|... }
  buff.active;         // Whether this buff actually contributed to the calc target's stats
  buff.staticEntries;  // StatEntry[] — flat contributions (always present)
  buff.dynamicEntries; // ResolvedStatEntry[] — scaling contributions with optional per-entry cap
  // e.g., dynamicEntries: [{ key: "pyro%", value: 0.20, cap: 0.40 }]
}
```

Use `isTrivialBuff(buff)` from `inspection.ts` to filter out insignificant entries (near-zero contributions) for cleaner UI:

```typescript
import { isTrivialBuff } from "@/lib/team-comp/inspection";

const meaningfulBuffs = display.buffs.filter(b => b.active && !isTrivialBuff(b));
```

#### Team Stats (`idleStats` / `combatStats`)

Both are `Record<charId, Partial<Record<StatKey, number>>>` covering the full team.

```typescript
// Comparable to the in-game character screen (base + static buffs + artifacts, BEFORE dynamic buffs)
display.idleStats["hu_tao"].atk;   // e.g., 2800
display.idleStats["hu_tao"].cr;    // e.g., 0.65

// The actual values consumed by formulas (after ALL buffs including dynamic scaling)
display.combatStats["hu_tao"].atk; // e.g., 4200 (after Hu Tao E's HP→ATK conversion)
```

The distinction exists because players need to verify their in-game stats (idle) while also seeing the effective combat numbers used in the damage formula.

#### Marginal Gains (`marginalGains`)

```typescript
// Fractional damage gain for +1 avg 5★ substat roll, keyed by charId then StatKey
display.marginalGains["hu_tao"];  
// e.g., { cr: 0.034, cd: 0.028, "hp%": 0.018, em: 0.012, ... }
// Interpretation: +1 CR roll → +3.4% total damage

// Teammates show gains only for stats that feed into scaling buffs affecting the calc target
display.marginalGains["yelan"];
// e.g., { "hp%": 0.005 }  — Yelan's HP feeds her party DMG% buff
```

This helps answer "which stat should I prioritize on who?" — sort by gain value to rank stat investments.

## 3. StatSheet Inspection Methods

Two methods on `StatSheet` support display and analysis:

```typescript
// Get all non-zero computed stats as a flat record
// Scaled stats (ATK/HP/DEF) are returned as computed totals; intermediate % keys excluded
const all: Partial<Record<StatKey, number>> = statSheet.getAll();

// Create an immutable copy with one stat bumped (for marginal-gain analysis)
const bumped: StatSheet = statSheet.withDelta("cr", 0.033);
// Original is unchanged; bumped has CR increased by 0.033
```

## 4. Inspection Utilities (`inspection.ts`)

Standalone utility functions for stat analysis:

```typescript
import { AVG_SUBSTAT_ROLL, computeRollEquivalents, isTrivialBuff } from "@/lib/team-comp/inspection";

// Average 5★ substat roll values (mean across all tiers)
AVG_SUBSTAT_ROLL.cr;   // 0.0331
AVG_SUBSTAT_ROLL.cd;   // 0.0662
AVG_SUBSTAT_ROLL["atk%"]; // 0.0496

// How many average rolls each stat in a sheet represents
const rolls = computeRollEquivalents(display.combatStats["hu_tao"]);
rolls.cr;  // e.g., 18.5 (= current CR value / 0.0331)

// Filter out insignificant buffs for cleaner display
isTrivialBuff(buff);            // true if all entries < 0.001
isTrivialBuff(buff, 0.01);     // custom threshold
```

## 5. Internal Concepts Primer

If you're curious about *how* the engine maintains calculation purity beneath the public API, here are the foundational internal mechanisms:

- **`DamageTag`** & **`DamageTagFilter`**: Abilities are deeply categorized (e.g., `Element: Pyro`, `Ability: Burst`, `Reaction: Vaporize`). Buffs hold equivalent conceptual filters (e.g., "Only applies to Burst DMG"). When formulas read stats from the `StatSheet`, they automatically supply their tags to inherit exactly the right dynamically-scoped modifiers.
- **Buff Receivers**: Buffs within the kit definitions explicitly state their target logic. A buff might target `selfOnField` (Hu Tao's +33% Pyro DMG), `team` (Noblesse Oblige's +20% ATK), or `onField` (Bennett's flat ATK scaling transfer). `getTeamStats(artifactSheets, calcTargetId)` leverages these instructions to perfectly mimic off-field vs. on-field stat transferability.
- **`TeamMeta`**: Built automatically during `TeamBuild` construction. This reads the roster configurations to rapidly answer queries like "Does this team have a shielder?" or "Can this team trigger Vaporize computation?". Conditionals dynamically activate depending on the answers `TeamMeta` provides.
- **Hot vs. Cold Path**: `calc()` returns a raw `number` (the final damage) and `getTeamStats()` resolves the stat sheets — together these form the optimizer hot path with minimal allocations and no display overhead. `display()` and `getDisplayResult()` are the cold path — same math but capturing structured intermediate data (`DisplayPart` with `statValues`, `params`, `scalingKeys`) for UI rendering. The two paths share identical formula logic but never couple display concerns to the optimizer.
