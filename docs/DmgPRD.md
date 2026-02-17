# Max Damage Calculator — Product Requirements Document

## 1. Problem Statement

Genshin Impact players who want to optimize their artifacts across a 4-member team currently have no integrated tool to answer the question: **"Given my team composition, which artifact distributions maximize the expected damage of my main DPS?"**

Existing solutions (spreadsheet-based calculators, gcsim) either require deep manual setup, are not extensible to new characters, or cannot integrate with a user's imported artifact inventory. This feature fills that gap by providing a **team-aware, artifact-optimizable damage calculator** built directly into GenshinTools.

## 2. Vision

Build a standalone, extensible damage calculation engine (`src/lib/damage/`) that can:

1. **Compute final stats** for any character given their base stats, weapon stats, artifact stats, and teammate buffs.
2. **Evaluate damage formulas** for any character's strongest skill hit, accounting for talent multipliers, elemental reactions, enemy defense, and resistance.
3. **Model team buffs** — both unconditional (e.g., artifact 4pc effects, passive talents) and conditional (e.g., "only when all party members are Hydro/Cryo", "buff scales with caster's ATK").
4. **Resolve buff dependencies** — a support's buff may scale off their own stats, which are in turn influenced by another support's buff. The engine must resolve this via multi-pass computation.
5. **Optimize artifact distribution** — given a pool of artifacts and a team comp, find the artifact assignment that maximizes the target damage formula (future phase).

## 3. Phased Approach

### Phase 1: Engine & Formula Research (Current)

- Research and codify all Genshin Impact damage formulas (direct, amplifying, transformative, additive, lunar).
- Design the core stat computation pipeline (base → weapon → artifact → buffs → final).
- Design the extensible damage formula system (base formulas that characters specialize).
- Design the buff/effect system (unconditional, conditional, team-comp-dependent, stat-scaling).
- **Deliverable**: This PRD + Design Doc (`DmgDesign.md`), then implementation of the core engine with unit tests.

### Phase 2: Character & Weapon Extensions

- Parse `character_*.json` skill descriptions and `i18n-game.ts` weapon/artifact effect texts to extract numeric values and buff semantics.
- Implement per-character damage formula overrides (e.g., Hu Tao's HP-scaling ATK conversion, Raiden's Burst bonus from ER).
- Implement per-weapon effect parsers (e.g., "ATK +20% for 12s after Elemental Skill").
- Implement per-artifact-set 4pc effect logic.
- **Deliverable**: Comprehensive character/weapon/artifact extension library with integration tests.

### Future: Artifact Optimizer UI

- UI page for team composition setup (character, weapon, artifact set selection).
- Damage formula target selector per character.
- Artifact optimizer that distributes artifacts across 4 characters to maximize target damage.
- Integration with the existing Account Data (imported artifacts from GOOD format).

## 4. Functional Requirements

### 4.1 Stat Computation

| ID | Requirement |
|----|-------------|
| SC-1 | Compute a character's final stat sheet from: base stats (Lv90 or Lv100), weapon stats (Lv90), artifact main stats, artifact sub stats, self-buffs, and teammate buffs. |
| SC-2 | Support flat stats (e.g., +311 ATK from flower) and percentage stats (e.g., ATK +46.6% from sands) with correct layering: `(base × (1 + sum_of_%_bonuses)) + sum_of_flat_bonuses`. |
| SC-3 | Character level determines which stat row to use: if level ≤ 90, use Lv90 stats; otherwise use Lv100 stats. Default to Lv100 if absent. |
| SC-4 | Weapon always uses Lv90 stats. Weapon base ATK adds to character base ATK. Weapon secondary stat adds to the corresponding stat pool. |
| SC-5 | Artifact stats are additive within their pool (all ATK% from artifacts sum, all flat ATK from artifacts sum). |

### 4.2 Buff System

#### Buff Targets

Buffs have four distinct target scopes. In our system, the "DPS character" is the character whose damage formula we are evaluating.

| Target | Meaning | Examples |
|--------|---------|----------|
| `self` | Always applies to the buff provider, regardless of who the DPS is. | Hu Tao A4: +33% Pyro DMG (always on Hu Tao's own stat sheet). |
| `selfOnField` | Applies to the provider **only when they are the DPS** (the on-field character being calculated for). If the provider is a support, this buff is inactive. | Yoimiya E: Normal ATK DMG% buff applies to **her own** normals only when she is the DPS. Some artifact 4pc effects that say "while on the field". |
| `onField` | Applies to whoever is the DPS character (the on-field character being calculated for). If the provider is a support, the buff transfers to the DPS. | Kazuha A4: Elemental DMG% bonus applies to the on-field character. |
| `party` | Applies to all 4 party members unconditionally. | Bennett Q: ATK buff applies to all party members in the field. |

> **Off-field convention**: If a buff text states it only applies while the character is off-field, treat the buff as always active (assume the character is indeed off-field at the right time).

> **Text parsing convention (Phase 2)**: Genshin's in-game text uses specific phrasing to indicate buff scope. When parsing character kit descriptions, weapon effects, and artifact set effects, pay attention to phrasings like: "increases **the character's** ..." (self), "increases **the on-field character's** ..." / "the active character" (onField), "increases **all party members'** ..." (party). The exact conventions vary between EN and ZH texts and must be handled during Phase 2 parsing.

#### Buff Rules

| ID | Requirement |
|----|-------------|
| BF-1 | **Unconditional buffs**: Always active. E.g., Viridescent Venerer 2pc: "Anemo DMG +15%". |
| BF-2 | **Conditional buffs (self)**: Active based on the character's own state. E.g., Marechaussee Hunter 4pc: "+12% CR per stack, max 3". For damage calc, assume max stacks. |
| BF-3 | **Conditional buffs (teammate/on-field)**: Active for the on-field character or all party members. E.g., Bennett Q: "ATK buff = base ATK × talent%". The buff value depends on Bennett's own resolved stats. |
| BF-4 | **Team-comp-dependent buffs**: Active only when a specific team composition condition is met. E.g., Nilou passive: only when team has exclusively Hydro and Dendro. E.g., Gilded Dreams 4pc: buff depends on count of same/different element teammates. |
| BF-5 | **Time-conditional buffs**: Assume the buff is active (ignore duration/cooldown). The user's intent is "what if everything is set up perfectly". Off-field-only buffs are also assumed active. |
| BF-6 | **Stat-scaling buffs**: Buff value is a function of the provider's stats. E.g., Shenhe E: flat Cryo DMG bonus = ATK × talent%. Must be resolved after the provider's own stats are finalized. |
| BF-7 | **Constellation-dependent buffs**: Constellations can introduce entirely new buffs, alter existing buff values, or change buff targets. E.g., Bennett C6 adds Pyro infusion + 15% Pyro DMG to his Q (a new buff that doesn't exist at C0-C5). The buff system must support a `minConstellation` gate per buff definition. |
| BF-8 | **Weapon refinement**: Weapon passive buffs have the same types/targets at all refinement levels — only the numeric values change (e.g., Staff of Homa R1: HP+20%, R5: HP+40%). The buff definition should accept refinement as a parameter to compute the correct value. |

### 4.3 Buff Resolution

| ID | Requirement |
|----|-------------|
| BR-1 | **Two-pass resolution**: First pass resolves each character's stat sheet with only self-buffs and unconditional buffs. Second pass applies teammate buffs (which may reference first-pass stats) and recomputes final stats. |
| BR-2 | Handle circular dependencies gracefully. If character A buffs character B's ATK, and character B buffs character A's ATK, each only sees the other's first-pass stats. No iteration needed. |
| BR-3 | The system must be deterministic — same inputs always produce same outputs. |

### 4.4 Damage Formulas

| ID | Requirement |
|----|-------------|
| DF-1 | Implement the **generic direct damage formula**: `BaseDmg × (1 + DmgBonus) × DEFMult × RESMult × CritMult`. |
| DF-2 | Implement **amplifying reactions** (Melt, Vaporize) as a multiplicative modifier on direct damage. |
| DF-3 | Implement **transformative reactions** (Overload, Electro-Charged, Swirl, Superconduct, Bloom, Hyperbloom, Burgeon, Burning, Shatter) as standalone damage instances based on level and EM. |
| DF-4 | Implement **additive reactions** (Spread, Aggravate) as flat damage added to base damage before other multipliers. |
| DF-5 | Implement **lunar reactions** (Lunar Bloom, Lunar Electro-Charged, Lunar Crystallize) with their unique damage calculation rules (can crit, ignores DEF for some, unique EM formulas). |
| DF-6 | Each character can define one or more **named damage formulas** (e.g., "Burst (Melt)", "Charged Attack (Vaporize)") that compose the generic formula with character-specific multipliers and reaction types. |
| DF-7 | Support **expected damage** calculation: `Dmg = nonCritDmg × (1 - CR) + critDmg × CR`, unless "assume crit" is enabled, in which case always use `critDmg`. |

### 4.5 Calculation Parameters

| ID | Requirement |
|----|-------------|
| CP-1 | Monster level: default 110, configurable. |
| CP-2 | Monster resistance: default 10%, configurable per element. |
| CP-3 | Assume crit: default false, configurable. When true, damage = always-crit value. |
| CP-4 | Character level: if ≤ 90, use Lv90 stats; otherwise Lv100. Default 100. |
| CP-5 | Weapon level: always 90. |
| CP-6 | Skill level: Lv10 or Lv13 based on constellation (C3/C5 add +3 to specific talent). Default to C6 → Lv13 when absent. |
| CP-7 | Constellation: default C6, configurable (C0-C6). Affects which buffs are active, which damage formulas are available, and which talent multiplier level to use. Constellations can: (a) introduce entirely new buffs or damage profiles, (b) alter existing buff values or formula behavior, (c) unlock Lv13 talents via C3/C5 +3 bonus. |
| CP-8 | Weapon refinement: default R1, configurable (R1-R5). Refinement only affects the numeric values of weapon passive buffs — it does not change the buff types or targets. |

### 4.6 Data Integration

| ID | Requirement |
|----|-------------|
| DI-1 | Read character base stats from `charStats.ts` (Lv90/Lv100 breakpoints). |
| DI-2 | Read weapon base ATK and secondary stat from `resources.ts` (`Weapon` type). |
| DI-3 | Read artifact set effects from `i18n-game.ts` (`artifacts` section: effect text per set, indexed [0] for 2pc and [1] for 4pc). |
| DI-4 | Read weapon passive effects from `i18n-game.ts` (`weapons` section: effect text per weapon, with refinement-specific values). |
| DI-5 | Read character skill multipliers from `character_*.json` (details array with label, lv6, lv10, lv13). |
| DI-6 | Read character kit descriptions (passives, constellations) from `character_*.json` for **both** purposes: (a) extracting buffs the character provides (to self, on-field character, or party), and (b) extracting damage formulas (new damage profiles from passives/constellations that upgrade or replace existing formulas, e.g., a support character gaining a DPS formula at C6). |
| DI-7 | The damage module MUST NOT modify any existing data types or APIs. It only reads from them. |

## 5. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NF-1 | **Standalone module**: All code lives in `src/lib/damage/`. No edits to existing `src/data/`, `src/components/`, or `src/stores/`. |
| NF-2 | **Zero `any`**: All types must be explicit. No implicit any. |
| NF-3 | **Testable**: Every formula and stat computation must be unit-testable with known inputs and expected outputs. |
| NF-4 | **Extensible**: Adding a new character's damage formula should not require modifying the core engine — only adding a new extension file. |
| NF-5 | **Deterministic**: Same inputs → same outputs. No randomness. |
| NF-6 | **No UI dependency**: The engine is pure TypeScript with no React, DOM, or browser dependencies. |
| NF-7 | **UI-displayable outputs**: The engine must return structured data sufficient for UI display: (a) final stat sheets for all 4 characters, (b) a per-character list of active buffs with source attribution (who provides what), and (c) a damage formula breakdown showing the value of each multiplicative component. This enables the UI to render validation views so users can verify the calculation is correct. |

## 6. Out of Scope (for Phase 1)

- UI components for the damage calculator page (but the engine output must be structured enough for future UI consumption — see NF-7).
- Artifact optimizer algorithm.
- Real-time DPS rotation simulation (we calculate single-hit max damage, not DPS over time).
- Enemy-specific resistance tables (use configurable defaults).
- Rich formula rendering (rendering the damage as an interactive arithmetic expression showing each component value — nice-to-have, not required for Phase 1).

## 7. Success Criteria

### Phase 1
- Core engine can compute the expected damage of Hu Tao's Charged Attack (Vaporize) in a team with Xingqiu, Zhongli, and Kazuha, matching known theorycraft results within 5% margin.
- All generic damage formulas (direct, amplifying, transformative, additive) produce correct results against known test vectors.
- The buff resolution system correctly handles stat-scaling buffs (e.g., Bennett's ATK buff).

### Phase 2
- At least 20 popular characters have implemented damage formulas.
- Weapon effects for at least the top 5 weapons per type are parsed and functional.
- Artifact 4pc effects for all commonly used sets are implemented.
