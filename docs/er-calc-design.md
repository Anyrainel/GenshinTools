# Energy Recharge Requirements Calculator — Design Document

> System design for calculating ER requirements given a team and its rotation.

## Table of Contents

1. [Overview](#1-overview)
2. [Energy System Fundamentals](#2-energy-system-fundamentals)
3. [Energy Sources Taxonomy](#3-energy-sources-taxonomy)
4. [Core Formula](#4-core-formula)
5. [Timeline & Rotation Model](#5-timeline--rotation-model)
6. [Action Keys & Particle Linkage](#6-action-keys--particle-linkage)
7. [Three Calculation Modes](#7-three-calculation-modes)
8. [Particle RNG Modes](#8-particle-rng-modes)
9. [Weapon & Artifact Energy Sources](#9-weapon--artifact-energy-sources)
10. [Enemy Energy Drops](#10-enemy-energy-drops)
11. [Data Pipeline](#11-data-pipeline)
12. [Timeline UI Design](#12-timeline-ui-design)
13. [Inputs & Outputs](#13-inputs--outputs)
14. [Reference Constants](#14-reference-constants)
15. [Algorithm](#15-algorithm)

---

## 1. Overview

An ER calculator answers: **"How much Energy Recharge does each character need to execute this rotation?"**

The user builds a visual timeline of actions for their 4-character team. The calculator determines who generates energy, who absorbs it, and solves for the minimum ER% on each character.

Three calculation modes address different player questions:
- Can I burst on the first rotation starting from 0 energy?
- Can I sustain this rotation forever starting from full energy?
- Can I sustain this rotation forever starting from 0 energy?

---

## 2. Energy System Fundamentals

### 2.1 Particle vs Flat Energy

| Mechanism | Affected by ER% | Affected by Element Match | Affected by On/Off-Field |
|-----------|:---:|:---:|:---:|
| Elemental Particle | Yes | Yes | Yes |
| Elemental Orb | Yes | Yes | Yes |
| Flat Energy | **No** | No | Sometimes |

Orbs = 3× particles in all cases. This document normalizes to particles.

### 2.2 Element Matching

| Affinity | Energy per particle |
|----------|:------------------:|
| Same element | 3.0 |
| Different element | 1.0 |
| Clear / Neutral | 2.0 |

### 2.3 On-Field vs Off-Field

| Party Size | Off-Field Multiplier |
|:----------:|:-------------------:|
| 4 | 0.60 |
| 3 | 0.70 |
| 2 | 0.80 |
| 1 | 1.00 |

### 2.4 ER% Scaling

```
energy_from_particle = base_energy × (ER% / 100)
```

Linear, no soft cap. Does **not** affect flat energy.

---

## 3. Energy Sources Taxonomy

### 3.1 Skill Particles (Primary)

Each character's Elemental Skill generates elemental particles. Key properties:
- **Particle count** — often fractional, representing RNG (2.67 = 2 guaranteed + 67% chance of 3rd)
- **Press vs Hold** — different counts per mode
- **Periodic generation** — some skills generate particles over time (Oz, Guoba, Raiden E)
- **Element** — matches the character's vision

### 3.2 Self-Energy Effects

Some characters have skills/passives/bursts that directly grant flat energy:
- **Burst refund**: Venti A4 (15 flat energy on burst end)
- **Party energy restore**: Raiden burst (flat energy to party per hit)
- **Skill self-energy**: some skills grant energy directly to the caster

These are **flat energy** — not affected by ER%.

### 3.3 Weapon & Artifact Energy

See [Section 9](#9-weapon--artifact-energy-sources).

### 3.4 Enemy HP Drops

See [Section 10](#10-enemy-energy-drops).

---

## 4. Core Formula

For each character with a BURST action in the sequence:

```
Flat_Energy + (Particle_Energy_at_100ER × ER%) ≥ Burst_Cost
```

Solving:

```
Required_ER% = max(100%, (Burst_Cost - Flat_Energy) / Particle_Energy_at_100ER × 100%)
```

Where:
- `Particle_Energy_at_100ER` = sum of all particle energy in the collection window at base 100% ER
- `Flat_Energy` = sum of all flat energy sources (unaffected by ER%)
- The "collection window" depends on the calculation mode (see Section 7)

---

## 5. Timeline & Rotation Model

### 5.1 Dual-Timeline System

The user can create **up to 2 timelines** (rows):

```
Timeline 1 (initial):    [Bennett E] [Bennett Q] [Xiangling Q] [Xingqiu E] [Xingqiu E] [Xingqiu Q] ...
Timeline 2 (repeating):  [Bennett E] [Bennett Q] [Xiangling Q] [Xingqiu E] [Xingqiu Q] [Sucrose E] [Sucrose Q]
```

**Rules:**
- **1 timeline only** → that timeline is used as the repeating rotation
- **2 timelines** → Timeline 1 is the initial (one-time) sequence, Timeline 2 is the repeating rotation
- Users can **clone Timeline 1 to create Timeline 2**, then edit the repeating rotation separately

This naturally represents real gameplay: the first rotation often differs from subsequent ones (e.g., pre-funneling, different burst order to build energy).

### 5.2 On-Field Derivation

The currently on-field character is determined by who performed the most recent action. Whenever a different character acts, an implicit swap occurs.

```
Actions: [Bennett E] [Bennett Q] [Xiangling Q] [Xingqiu E] ...
On-field:  Bennett     Bennett     Xiangling     Xingqiu
```

### 5.3 Particle Absorption Rule

Each particle-producing action generates particles that are absorbed by the character performing the **next action** in the timeline. This is the "next-action absorber" rule.

```
[Bennett E] → particles → [Xiangling Q]  ← Xiangling absorbs Bennett's particles on-field
```

The `wait` action block allows the user to keep the current character on-field to absorb their own particles:

```
[Bennett E] [wait] → Bennett stays on-field, absorbs own particles
[Xiangling Q] ...
```

---

## 6. Action Keys & Particle Linkage

### 6.1 Action Keys

Each character has a set of available action blocks. Not all characters have all actions.

| Key | Name | Produces Particles | Notes |
|-----|------|:------------------:|-------|
| `NA` | Normal Attack | No | Fills field time; negligible energy |
| `CA` | Charged Attack | No | |
| `PA` | Plunge Attack | No | |
| `E` | Elemental Skill (Press) | **Yes** | Primary particle source |
| `holdE` | Elemental Skill (Hold) | **Yes** | Different particle count than press |
| `periodicE` | Periodic Skill Particles | **Yes** | One "proc" of a periodic generator (Oz tick, Guoba breath, Raiden E coordinated attack) |
| `Q` | Elemental Burst | No | Consumes energy; drains pool to 0 |
| `specialQ` | Special Burst | No | For non-standard burst mechanics |
| `wait` | Wait | No | Current character stays on-field; delays absorption to control who catches particles |

**Availability per character:**
- Every character: `NA`, `CA`, `E`, `Q`, `wait`
- Characters with hold skill: additionally `holdE`
- Characters with periodic generators: additionally `periodicE`
- Characters with plunge mechanics: additionally `PA`
- Characters with special burst: additionally `specialQ` (e.g., Linnea's continuous tap E → modeled as `holdE`)

The available actions per character are derived from the particle data file — if Fandom/gcsim data lists a hold variant, `holdE` is available; if it lists periodic generation, `periodicE` is available.

### 6.2 Particle Linkage Visualization

The timeline UI draws **arrows** from each particle-producing node to the absorbing node (the next action's character). This makes funneling visible:

```
Timeline:
  Bennett:    [E]───────────┐
                             ↓
  Xiangling:          [absorb] [Q]
                                ↑ needs 80 energy
  Xingqiu:                        [E]──┐ [E]──┐ [Q]
                                        ↓      ↓
  Sucrose:                        [absorb] [absorb] [E] [Q]
```

Each arrow shows the particle info based on the selected RNG mode:
- Expected mode: "2.25 Pyro particles"
- Min mode: "2 Pyro particles"
- Max mode: "3 Pyro particles"

The energy received is calculated considering element match and on/off-field status:
- Arrow label: "2.25 × 3.0 (same elem) × 1.0 (on-field) = 6.75 base energy"

### 6.3 Self-Energy Annotations

Actions that produce self-energy (flat) show a tag on the block:
- Venti's Q block: `[Q +15 flat]`
- Raiden's Q block: `[Q +12.5 flat (party)]`
- Prototype Amber wielder's Q: `[Q +12 flat (weapon)]`

### 6.4 Energy Balance Display

Below the timeline, show a per-character energy balance bar:
```
Bennett:    ████████████░░░░░░ 42.3 / 60  (need 142% ER)
Xiangling:  ███████░░░░░░░░░░ 28.1 / 80  (need 285% ER)
Xingqiu:    ██████████████░░░ 58.2 / 80  (need 137% ER)
Sucrose:    █████████████████ 80.0 / 80  (need 100% ER) ✓
```

---

## 7. Three Calculation Modes

### 7.1 Mode Definitions

Given the timeline(s), define each character's **collection window** — the set of actions whose particles count toward charging their burst.

| Mode | Starting Energy | Question | Collection Window |
|------|:-:|---|---|
| **Zero-Energy Start** | 0 | Can I burst in this sequence? | All actions before each character's first Q in the combined sequence (Timeline 1 + Timeline 2 if present) |
| **Full-Energy Repeat** | Full | Can I sustain bursting forever? | All actions between consecutive Q casts within the repeating timeline (Timeline 2, or Timeline 1 if only one) |
| **Zero-Energy Repeat** | 0 | Can I get going and keep going? | Must satisfy BOTH: zero-energy start for Timeline 1 AND full-energy repeat for Timeline 2 |

### 7.2 Collection Window Examples

**Setup:** Bennett bursts at positions 2 and 8 in a 10-action repeating timeline.

**Full-Energy Repeat:** Particles between burst at position 8 (previous cycle) → burst at position 2 (next cycle), wrapping around:
- Actions [9, 10, 1] contribute (positions after previous Q, before next Q)

**Zero-Energy Start (single timeline):** Particles from actions [1] before the first Q at position 2.

### 7.3 How Timelines Map to Modes

| Configuration | Zero-Energy Start | Full-Energy Repeat | Zero-Energy Repeat |
|---|---|---|---|
| 1 timeline | Sequence before first Q | Between consecutive Q's, wrapping | Both checks on same timeline |
| 2 timelines | T1 + T2 before first Q | Between consecutive Q's in T2 only, wrapping | T1+T2 for first burst; T2 for sustain |

### 7.4 Characters Without Q in the Sequence

If a character has no Q action in the relevant timeline, their ER requirement is N/A — they don't need energy.

---

## 8. Particle RNG Modes

### 8.1 The Problem

Many particle sources are probabilistic. Fandom wiki data represents this as fractional averages (2.67 = floor 2 guaranteed + 67% chance of +1).

### 8.2 Three Display Modes

| Mode | Particle Count Used | Philosophy |
|------|:---:|---|
| **Expected** | Fractional average (2.67) | Typical rotation |
| **Min** | floor(2.67) = 2 | Never fail to burst |
| **Max** | ceil(2.67) = 3 | Best possible luck |

For integer values (4.0), all three modes give the same result.

### 8.3 Preprocessing from Source Data

The scraped data stores the raw fractional average. Min/max are inferred at load time:

```
inferRange(2.67) → { min: 2, expected: 2.67, max: 3 }
inferRange(4.0)  → { min: 4, expected: 4.0,  max: 4 }
inferRange(0.5)  → { min: 0, expected: 0.5,  max: 1 }
```

### 8.4 Display

Show the selected mode's value prominently on each particle arrow, with all three visible as context in the results panel.

---

## 9. Weapon & Artifact Energy Sources

### 9.1 Weapon Energy Effects (Hand-Maintained)

Small surface area — only weapons with meaningful energy mechanics:

| Weapon | Type | Amount | Target | Notes |
|--------|------|--------|--------|-------|
| Favonius (all 5) | Particle (Clear) | 3 per proc | Party | CRIT trigger, 1 proc/rotation assumed |
| Prototype Amber | Flat | 12 (R1) – 18 (R5) | Self | On burst use |
| Amenoma Kageuchi | Flat | 6–12 per seed (R1–R5), max 3 seeds | Self | On burst use |
| Kitain Cross Spear | Flat | +6 net (R1) – +12 net (R5) | Self | On skill hit |
| Katsuragikiri Nagamasa | Flat | +6 net (R1) | Self | On skill hit |

### 9.2 Artifact Set Energy Effects (Hand-Maintained)

| Set | Effect | Type | Target |
|-----|--------|------|--------|
| The Exile 4pc | 6 flat energy on burst | Flat | Party (others) |
| Scholar 4pc | 3 flat energy on particle gain (3s CD) | Flat | Bow/Catalyst party members |
| Emblem of Severed Fate 2pc | +20% ER | Stat buff | Self |

---

## 10. Enemy Energy Drops

Modeled as clear particles per rotation via presets:

| Scenario | Clear Particles | Use Case |
|----------|:-:|---|
| None (Boss) | 0 | Single-target boss |
| Low | 6 | Elite enemies |
| Medium | 12 | Mixed encounters |
| High | 24 | AoE mob clearing |

Distributed to party based on field time proportion.

---

## 11. Data Pipeline

### 11.1 Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Fandom Wiki API    │     │  gen_char_info.py     │     │  energy-effects.ts  │
│  (scraped)          │     │  (auto-generated)     │     │  (hand-maintained)  │
└────────┬────────────┘     └──────────┬───────────┘     └──────────┬──────────┘
         │                             │                            │
         ▼                             ▼                            │
  particles.json              charInfo.ts                           │
  (faithful repr:             (burst cost via                       │
   avgParticles,               energy field,                        │
   pressNotes,                 specialEnergy?                       │
   holdValue, etc.)            for overrides)                       │
         │                             │                            │
         └──────────┬──────────────────┘────────────────────────────┘
                    ▼
             ercalc library
             (preprocessing: infer min/expected/max from raw avgParticles)
             (isolated from damageCalc — no shared imports)
```

### 11.2 particles.json — Scraped, Faithful Representation

Scraped from Fandom Wiki's `Energy/Data` page via MediaWiki API. Each character entry preserves the source data exactly:

```json
{
  "bennett": {
    "element": "Pyro",
    "press": { "avgParticles": 2.25, "notes": null },
    "hold": { "avgParticles": 3, "notes": null },
    "periodic": null,
    "spawnPoint": "Character"
  },
  "fischl": {
    "element": "Electro",
    "press": null,
    "hold": null,
    "periodic": { "avgParticles": 0.67, "notes": "On Oz ATK" },
    "spawnPoint": "Enemy"
  },
  "raiden_shogun": {
    "element": "Electro",
    "press": null,
    "hold": null,
    "periodic": { "avgParticles": 0.5, "notes": "On Coordinated Attack, 0.9s CD" },
    "spawnPoint": "Enemy"
  },
  "ganyu": {
    "element": "Cryo",
    "press": { "avgParticles": 4, "notes": "2x2 (initial + explosion)" },
    "hold": null,
    "periodic": null,
    "spawnPoint": "Construct"
  },
  "barbara": {
    "element": "Hydro",
    "press": { "avgParticles": 0, "notes": null },
    "hold": null,
    "periodic": null,
    "spawnPoint": null
  }
}
```

**Key design rule:** No inference in this file. Fractional values like `2.25` are stored as-is. The ercalc library computes min/max at load time.

### 11.3 charInfo.ts — Burst Cost

Auto-generated by `gen_char_info.py`. The `energy` field stores the **actual burst cost** as an integer (e.g., Bennett=60, Raiden=90, Xiangling=80).

The script resolves burst cost by extracting the param index from `{paramN:I}` template strings in the game's skill detail data, then looking up `talent.Q[level][N-1]` in `character_stats.json`. An assertion verifies the burst cost is consistent across all talent levels.

Characters with `energy=0` (Mavuika, Skirk) don't use normal energy mechanics.

### 11.4 energy-effects.ts — Hand-Maintained

Covers three categories with small surface area:
1. **Self-energy effects** — character passives/constellations that grant flat energy
2. **Weapon energy effects** — Favonius, Prototype Amber, etc.
3. **Artifact set energy effects** — Exile, Scholar

### 11.5 Determining Available Actions per Character

The particle data file determines which action keys are available:
- `press` exists and > 0 → `E` available
- `hold` exists → `holdE` available
- `periodic` exists → `periodicE` available
- Every character gets `NA`, `CA`, `Q`, `wait`
- Characters with known plunge mechanics → `PA`

---

## 12. Timeline UI Design

### 12.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ER Calculator                                                    [×]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Mode: [Zero-Energy Start ▾]   Particles: [Expected ▾]   Enemy: [None ▾]│
│                                                                         │
│ ┌─ Timeline 1 (Initial) ──────────────────────────── [Clone to T2] ──┐ │
│ │                          ← scroll →                                 │ │
│ │ Bennett:    [E]──────┐  [Q]                                        │ │
│ │                       ↓                                             │ │
│ │ Xiangling:      [absorb] [Q]                                       │ │
│ │                                                                     │ │
│ │ Xingqiu:              [E]──┐  [E]──┐  [Q]                         │ │
│ │                             ↓       ↓                               │ │
│ │ Sucrose:              [abs] [abs]  [E]  [Q]                        │ │
│ │                                                                     │ │
│ │         [+ Add Action]  (mobile: tap to select)                    │ │
│ │                         (desktop: drag from palette)                │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Timeline 2 (Repeating) ─────────────────────────── [Delete T2] ──┐ │
│ │ (empty — click "Clone to T2" above or build from scratch)          │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Results ──────────────────────────────────────────────────────────┐ │
│ │ Bennett     ████████████░░░░  42/60   ER: 142%  (min:167 avg:142  │ │
│ │ Xiangling   ████░░░░░░░░░░░  28/80   ER: 285%   max:118)         │ │
│ │ Xingqiu     ████████████░░░  58/80   ER: 137%                    │ │
│ │ Sucrose     ████████████████  80/80   ER: 100% ✓                  │ │
│ │                                                                    │ │
│ │                              [Apply to Min ER]                     │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Horizontal Scroll

Each timeline row scrolls horizontally. Action blocks are fixed-width, laid out left-to-right in sequence order. Long rotations overflow with scroll.

### 12.3 Action Block Rendering

Each block shows:
- Character icon (small, color-coded by element)
- Action key label (E, holdE, periodicE, Q, NA, CA, PA, wait)
- For particle producers: outgoing arrow to next block
- For Q blocks: energy drain indicator
- For blocks with self-energy: "+X flat" tag

### 12.4 Building the Sequence

**Mobile:** Tap [+ Add Action] button at the end of the timeline. A bottom sheet appears with:
1. Select character (4 icons)
2. Select action (only available actions shown — e.g., if no hold variant, no holdE button)
3. Action appends to timeline

**Desktop:** Drag from a palette sidebar. Palette shows character rows with their available action blocks. Drag a block onto the timeline to insert at position.

**Both:** Click an existing block to delete or reorder (drag to rearrange).

### 12.5 Clone Timeline

"Clone to T2" button copies Timeline 1 into Timeline 2. Users can then edit T2 independently. This is the common workflow — first rotation differs slightly from the repeat rotation.

---

## 13. Inputs & Outputs

### 13.1 Inputs

**From team (auto-populated):**
- 4 characters (element, burst cost from charInfo)
- Weapons (for Favonius/Prototype Amber detection)
- Artifact sets (for Exile/Scholar detection)

**User-configured:**
- Timeline 1 (required) — action sequence
- Timeline 2 (optional) — repeating rotation
- Calculation mode: Zero-Energy Start / Full-Energy Repeat / Zero-Energy Repeat
- Particle RNG mode: Min / Expected / Max
- Enemy particle preset: None / Low / Medium / High

### 13.2 Outputs

**Per character:**
- Required ER% (for selected mode, all three RNG variants shown)
- Energy balance bar (visual)
- Breakdown: which sources contribute how much energy

**Apply button:** Writes the calculated ER% (for selected RNG mode) into each character's minEr in the team store.

---

## 14. Reference Constants

```
SAME_ELEMENT_PARTICLE  = 3.0
DIFF_ELEMENT_PARTICLE  = 1.0
CLEAR_PARTICLE         = 2.0
ORB_MULTIPLIER         = 3.0

OFF_FIELD_MULT = { 4: 0.60, 3: 0.70, 2: 0.80, 1: 1.00 }

ENEMY_PRESETS = { none: 0, low: 6, medium: 12, high: 24 }

FAVONIUS_PARTICLES = 3 (clear)
```

---

## 15. Algorithm

### 15.1 Pseudocode

```
function calculateER(team, timeline1, timeline2, mode, enemyPreset):

  // Determine which timeline(s) to use per mode
  if mode == "zero-energy-start":
    sequence = concat(timeline1, timeline2 ?? [])
    // Collection window: everything before each char's first Q
    for each character:
      window = actions before first Q in sequence

  elif mode == "full-energy-repeat":
    repeating = timeline2 ?? timeline1
    // Collection window: between consecutive Q's, wrapping
    for each character:
      window = actions between last Q and next Q in repeating (circular)

  elif mode == "zero-energy-repeat":
    // Must satisfy BOTH:
    // 1) zero-energy-start across concat(T1, T2)
    // 2) full-energy-repeat within (T2 ?? T1)
    // Output = max(ER from check 1, ER from check 2) per character

  // For each character, compute energy in their window
  for each character:
    flatEnergy = 0
    particleEnergy = { min: 0, expected: 0, max: 0 }

    for each action in window:
      if action produces particles:
        absorber = next_action_character(action)
        fieldMult = (absorber == character) ? 1.0 : OFF_FIELD_MULT[partySize]
        elemMult = elementMatch(character.element, action.particleElement)
        for mode in [min, expected, max]:
          particleEnergy[mode] += particles[mode] * elemMult * fieldMult

    // Add self-energy, weapon, artifact, enemy effects
    flatEnergy += selfEnergy + weaponFlat + artifactFlat
    particleEnergy += weaponParticles + enemyParticles

    // Solve
    requiredER[mode] = max(100, (burstCost - flatEnergy) / particleEnergy[mode] * 100)
```

### 15.2 Particle Linkage Resolution

For each particle-producing action at index `i`:
1. The **absorber** is the character performing the action at index `i+1`
2. If `i` is the last action in the timeline, the absorber depends on mode:
   - In repeating timelines: wraps to the first action
   - In one-shot timelines: the acting character stays on-field (self-absorb)
3. If the next action is `wait` by the same character: self-absorb (the point of wait)
4. All 4 characters receive the particles — absorber gets on-field rate, others get off-field rate

### 15.3 Self-Energy Association

Self-energy effects are associated with action keys:
- `Q` → burst refund (Venti +15), weapon flat energy (Prototype Amber +12)
- `E` → skill self-energy (if any)
- `periodicE` → per-proc flat energy (if any)

The energy-effects.ts data maps `(charId, actionKey) → flatEnergy`.
