# ER Calculator — Particle Data Schema v2

## Motivation

The current particle data is spread across 4 independent surfaces that must stay in sync:

| Surface | What it stores | Problem |
|---|---|---|
| `particles.json` | Per-character `press`/`hold` avgParticles | Per-hit vs per-use ambiguity; no min/max |
| `particleConfig.ts:periodicGenerators` | Set of charIds whose E produces 0 | Must manually sync with particles.json |
| `particleConfig.ts:expectedPeriodicProcs` | Default tick count per deployment | Must manually sync with periodicGenerators |
| `particleConfig.ts:multiHitETotal` | Override totals for multi-hit chars | Patches over particles.json inconsistency |

Additionally, `periodicE` is currently an action type, but it is not a real action — it is a background particle event that happens *during* another character's action. The UI already separates ticks from actions via the `ERTimeline` model (`{ actions, ticks }`), but the engine requires flattening ticks back into fake `periodicE` actions. This is a leaky abstraction.

This design:
1. Unifies all four data surfaces into a single `particles.json` schema
2. Removes `periodicE` from the action space — ticks become a first-class engine concept
3. Extends the action space with `specialE` (enhanced/alternative skill) alongside existing `specialQ`

## Action Space (v2)

Actions represent things a character **does**. Background particle events (ticks) are not actions.

| Action | Description | Generates particles |
|---|---|---|
| `E` | Elemental skill (press) | Yes — from schema |
| `holdE` | Elemental skill (hold) | Yes — from schema |
| `specialE` | Enhanced/alternative skill | Yes — from schema |
| `Q` | Elemental burst | No (drains energy) |
| `specialQ` | Reduced-cost burst variant | No (drains energy, different cost) |
| `NA` | Normal attack | Yes — if char has infusion particle config |
| `CA` | Charged attack | Yes — if char has infusion particle config |
| `PA` | Plunge attack | Yes — if char has infusion particle config |
| `wait` | Stay on-field (catch particles) | No |

**Removed**: `periodicE` — replaced by tick model (see below).

### Ticks (background particle events)

Ticks represent off-field particle generation from summons, constructs, or coordinated attacks. They are **not actions** — they are particle events that occur *during* another character's on-field action.

The UI model (`ERTimeline`) already represents ticks separately:
```ts
interface ERTimeline {
  actions: TimelineAction[];  // real actions only
  ticks: TickAssignment[];    // background particle events attached to actions
}
```

The engine should consume `ERTimeline` directly instead of flattening to a legacy `Timeline` with fake `periodicE` entries. Each tick's `targetIndex` identifies which action is happening when those particles arrive — that action's character is on-field and absorbs the particles.

## Schema Definition

```jsonc
// particles.json — one entry per character
{
  "<charId>": {
    "element": "<Element>",       // particle element type

    // ── Direct particle generation ──
    // Present = this action produces elemental particles; absent = 0 particles.
    // Any action type the character can perform may have a particle config.
    "E"?:        ParticleCount,
    "holdE"?:    ParticleCount,   // falls back to "E" if absent
    "specialE"?: ParticleCount,   // enhanced/alternative skill variant
    "NA"?:       ParticleCount,   // self-infusion characters
    "CA"?:       ParticleCount,   // self-infusion characters
    "PA"?:       ParticleCount,   // self-infusion characters

    // ── Tick generation (background particles) ──
    // Present = this cast triggers background particle ticks; absent = no ticks.
    // The tick source is always the character who cast the trigger action.
    // Ticks are absorbed by whichever character is on-field at that point.
    "ticks"?: {
      "E"?: TickConfig,           // ticks triggered by E or holdE cast
      "Q"?: TickConfig            // ticks triggered by Q cast (rare)
    },

    "spawnPoint"?: "Character" | "Enemy" | "Construct"
  }
}
```

### ParticleCount

```jsonc
{
  "min": 2,           // particle count floor (for min mode)
  "max": 3,           // particle count ceiling (for max mode)
  "avg": 2.25,        // expected value (for expected mode)
  "notes"?: "string"  // human-readable condition/context (not consumed by engine)
}
```

- `min`/`max` feed directly into the min/expected/max particle mode toggle.
- `avg` is the primary computation value. For deterministic generators, `min == max == avg`.
- Fractional `avg` means "N guaranteed + X% chance of +1" (e.g., 2.25 = always 2, 25% chance of 3rd).

### TickConfig

```jsonc
{
  "procs": 7,                  // default tick count per trigger (rotation-length estimate)
  "perProc": ParticleCount,    // particles per tick
  "notes"?: "string"           // source description (e.g., "Oz ATK", "Stele resonance; 1.5s ICD")
}
```

- `procs` is the expected number of ticks during a typical rotation window (~15-20s). The UI uses this to auto-place ticks when the user adds the trigger action, but the user can freely add/remove/reposition ticks.
- `perProc` is the particle count for each individual tick event.

## Engine Mapping

### `getActionParticles(charId, action, mode)`

Resolves direct particles for a timeline action. Does not handle ticks (those are resolved separately).

```
action == "E":
  → data.E           (if present, select min/avg/max by mode)
  → 0                (if absent — periodic-only or no-particle char)

action == "holdE":
  → data.holdE       (if present)
  → data.E           (fallback to press)
  → 0

action == "specialE":
  → data.specialE    (if present)
  → 0

action == "NA":
  → data.NA          (if present — infusion chars)
  → 0                (universal NA clear energy handled separately)

action == "CA" / "PA":
  → data.CA / data.PA (if present)
  → 0

action == "Q" / "specialQ" / "wait":
  → 0                (always)
```

### `getTickParticles(charId, mode)`

Resolves particles for a single tick from this character. Called once per `TickAssignment`.

```
→ data.ticks.E.perProc  (select min/avg/max by mode)
  — or data.ticks.Q.perProc depending on which trigger spawned this tick
```

Note: The tick already knows its source character (from `TickAssignment.sourceChar`). The engine looks up that character's tick config to determine particle count and element.

### `hasTickGeneration(charId, trigger)`

Whether a character's action triggers background ticks. Used by UI for auto-placement.

```
trigger == "E" or "holdE" → data.ticks?.E != null
trigger == "Q"            → data.ticks?.Q != null
```

Replaces the current `periodicGenerators` Set.

### `getDefaultTickCount(charId, trigger)`

How many ticks to auto-place when the trigger action is added.

```
trigger == "E" or "holdE" → data.ticks?.E?.procs ?? 0
trigger == "Q"            → data.ticks?.Q?.procs ?? 0
```

Replaces the current `expectedPeriodicProcs` map.

### `rngSelect(particleCount, mode)`

```
mode == "min"      → particleCount.min
mode == "max"      → particleCount.max
mode == "expected" → particleCount.avg
```

Replaces the current `floor(avg)` / `ceil(avg)` heuristic with explicit values.

## Engine Changes: Native Tick Processing

Currently the engine flattens `ERTimeline` → `Timeline` by inserting fake `periodicE` actions, then processes a flat action sequence. With ticks as a first-class concept:

### Simulation loop (sketch)

```
for each action[i] in ert.actions:
  // 1. Process ticks attached to this action
  for each tick where tick.targetIndex == i:
    absorber = action[i].char  // on-field character
    particles = getTickParticles(tick.sourceChar, mode)
    element = data[tick.sourceChar].element
    distributeParticles(team, tick.sourceChar, particles, element, absorber)

  // 2. Process the action itself
  particles = getActionParticles(action[i].char, action[i].action, mode)
  if particles > 0:
    absorber = getAbsorber(ert.actions, i)  // next action's char
    element = data[action[i].char].element
    distributeParticles(team, action[i].char, particles, element, absorber)

  // 3. Handle burst energy drain
  if action[i].action in ["Q", "specialQ"]:
    drainEnergy(action[i].char)
```

Key difference: `getAbsorber` now only walks real actions (no `periodicE` to skip). Ticks are resolved against their `targetIndex` directly — the character performing that action is on-field and absorbs the tick particles.

### `specialQ` energy drain

`specialQ` drains a different (usually lower) amount of energy than `Q`. The character's `burstCost` in `TeamSlot` reflects the standard Q cost. For `specialQ`, the drain amount should come from character data (e.g., burst cost override or a percentage of full cost). This is orthogonal to the particle schema and handled by `selfEnergy` or a separate cost lookup.

## Character Patterns

### Pattern 1: Simple instant E

Most characters. Press E, get particles immediately.

```jsonc
"bennett": {
  "element": "Pyro",
  "E": { "min": 2, "max": 3, "avg": 2.25 },
  "holdE": { "min": 3, "max": 3, "avg": 3.0 },
  "spawnPoint": "Character"
}
```

### Pattern 2: Multi-hit instant (total stored, not per-hit)

Characters whose skill fires multiple hits simultaneously. Schema stores the **total** per use.

```jsonc
"diona": {
  "element": "Cryo",
  "E": { "min": 4, "max": 4, "avg": 4.0, "notes": "5 paws x 0.8" },
  "holdE": { "min": 4, "max": 5, "avg": 4.0, "notes": "5 paws x 0.8" },
  "spawnPoint": "Enemy"
}
```

Replaces `multiHitETotal` — per-use total baked into the schema directly.

### Pattern 3: Off-field ticks (summon)

E deploys a summon that attacks independently. E itself produces 0 direct particles; all particles come via ticks.

```jsonc
"fischl": {
  "element": "Electro",
  "ticks": {
    "E": {
      "procs": 7,
      "perProc": { "min": 0, "max": 1, "avg": 0.67 },
      "notes": "Oz ATK"
    }
  },
  "spawnPoint": "Character"
}

"xiangling": {
  "element": "Pyro",
  "ticks": {
    "E": {
      "procs": 4,
      "perProc": { "min": 1, "max": 1, "avg": 1.0 },
      "notes": "Guoba breath"
    }
  },
  "spawnPoint": "Enemy"
}
```

Engine: E → 0 direct particles (no `"E"` key). Auto-place 4-7 ticks. Each tick distributes particles to whoever is on-field at that point.

### Pattern 4: Off-field ticks (coordinated / construct)

Same as Pattern 3. Coordinated attacks and construct resonance are modeled identically — they produce background particles regardless of who is on-field.

```jsonc
"raiden_shogun": {
  "element": "Electro",
  "ticks": {
    "E": {
      "procs": 5,
      "perProc": { "min": 0, "max": 1, "avg": 0.5 },
      "notes": "Eye coordinated ATK; 0.8s ICD"
    }
  },
  "spawnPoint": "Enemy"
}

"zhongli": {
  "element": "Geo",
  "ticks": {
    "E": {
      "procs": 4,
      "perProc": { "min": 0, "max": 1, "avg": 0.5 },
      "notes": "Stele resonance; 1.5s ICD"
    }
  },
  "spawnPoint": "Construct"
}
```

### Pattern 5: Self-infusion (NA/CA/PA generate particles)

Character's E activates an infusion state. During that state, their attacks generate elemental particles. We model this as direct particles on the attack action type, assuming best-case infusion uptime.

The user places attack actions in the timeline; each generates particles. The `notes` field documents the ICD so the user knows how many attack actions are meaningful.

```jsonc
"yoimiya": {
  "element": "Pyro",
  "NA": { "min": 1, "max": 1, "avg": 1.0, "notes": "Niwabi Fire-Dance; 2s ICD" },
  "spawnPoint": "Enemy"
}

"hu_tao": {
  "element": "Pyro",
  "NA": { "min": 2, "max": 3, "avg": 2.5, "notes": "Paramita Papilio; 5s ICD" },
  "spawnPoint": "Enemy"
}

"tartaglia": {
  "element": "Hydro",
  "NA": { "min": 1, "max": 1, "avg": 1.0, "notes": "Riptide Slash/Flash; 3s ICD" },
  "spawnPoint": "Enemy"
}

"gaming": {
  "element": "Pyro",
  "PA": { "min": 2, "max": 2, "avg": 2.0, "notes": "Charmed Cloudstrider; 3s ICD" },
  "spawnPoint": "Character"
}
```

### Pattern 6: Direct E + infusion NA

Some characters produce particles both from the skill hit itself AND from subsequent infused attacks.

```jsonc
"alhaitham": {
  "element": "Dendro",
  "E": { "min": 1, "max": 1, "avg": 1.0 },
  "NA": { "min": 1, "max": 1, "avg": 1.0, "notes": "Projection Attack; 1.5s ICD" },
  "spawnPoint": "Enemy"
}
```

### Pattern 7: Direct E + ticks

Skill hit generates instant particles AND deploys a periodic generator.

```jsonc
"nahida": {
  "element": "Dendro",
  "E": { "min": 3, "max": 3, "avg": 3.0, "notes": "On initial Karma link" },
  "ticks": {
    "E": {
      "procs": 1,
      "perProc": { "min": 3, "max": 3, "avg": 3.0 },
      "notes": "Tri-Karma Purification; 7s ICD"
    }
  },
  "spawnPoint": "Enemy"
}
```

Engine: E → 3.0 direct particles AND auto-place 1 tick.

### Pattern 8: No particles

Shield/heal skills that generate zero particles.

```jsonc
"noelle": {
  "element": "Geo"
}
```

No action keys, no ticks → engine returns 0 for all actions.

### Pattern 9: Simplified variable (counter/stacks)

Characters with state-dependent counts. Simplified to averaged values. Inaccuracy is acceptable.

```jsonc
"beidou": {
  "element": "Electro",
  "E": { "min": 2, "max": 4, "avg": 3.0, "notes": "Avg across counter levels" },
  "spawnPoint": "Enemy"
}
```

### Pattern 10: specialE (enhanced skill variant)

Characters with a distinct enhanced skill that produces different particles.

```jsonc
"cyno": {
  "element": "Electro",
  "E": { "min": 3, "max": 3, "avg": 3.0, "notes": "Normal" },
  "specialE": { "min": 1, "max": 2, "avg": 1.33, "notes": "During Pactsworn Pathclearer (burst)" },
  "spawnPoint": "Character"
}

"freminet": {
  "element": "Cryo",
  "E": { "min": 2, "max": 2, "avg": 2.0, "notes": "Upward Thrust" },
  "specialE": { "min": 1, "max": 1, "avg": 1.0, "notes": "Lv.4 Shattering Pressure" },
  "spawnPoint": "Character"
}
```

### Pattern 11: Ticks from Q

If a character's burst triggers periodic particle generation (not flat energy):

```jsonc
"example_char": {
  "element": "Electro",
  "ticks": {
    "Q": {
      "procs": 3,
      "perProc": { "min": 1, "max": 1, "avg": 1.0 },
      "notes": "Burst coordinated ATK"
    }
  }
}
```

Note: Most burst-related energy comes through flat restoration (modeled in `selfEnergy`), not particles. This pattern exists for completeness but may have no current instances.

## Migration from v1

### Data migration

1. **Periodic chars** (in `periodicGenerators`):
   - If infusion char (hu_tao, yoimiya, etc.): move to `NA`/`CA`/`PA` direct config
   - If off-field generator (fischl, xiangling, etc.): move to `ticks.E`
   - `press.avgParticles` → `perProc.avg` or direct action `avg`
   - `expectedPeriodicProcs[charId]` → `ticks.E.procs`
   - Derive `min`/`max`: `min = floor(avg)`, `max = ceil(avg)` (refine with gcsim data later)

2. **Multi-hit chars** (in `multiHitETotal`):
   - `multiHitETotal[charId]` → `E.avg` (total per use, not per hit)

3. **Simple chars**:
   - `press.avgParticles` → `E.avg`
   - `hold.avgParticles` → `holdE.avg` (if present and different from press)

4. **All chars**: Preserve `element` and `spawnPoint`. Move `notes` into relevant `ParticleCount.notes`.

### Action space migration

- Remove `periodicE` from `ActionType` union
- Add `specialE` to `ActionType` union
- Remove `periodicE` from `PARTICLE_ACTIONS` set
- Update `ACTION_LABELS` (remove `periodicE`, add `specialE`)
- Remove `flattenERTimeline` / `legacyToERTimeline` conversion functions

### Engine migration

- `getActionParticles`: remove `periodicE` branch, add `specialE`/`NA`/`CA`/`PA` branches
- `getAbsorber`: remove `periodicE` skip logic (all actions are real now)
- Simulation loop: process `ert.ticks` directly instead of flattened `periodicE` actions
- `autoPlaceTicks`: read from `particles[charId].ticks.E.procs` instead of `expectedPeriodicProcs`

### Files affected

| File | Change |
|---|---|
| `src/data/ercalc/particles.json` | Rewrite to v2 schema |
| `src/lib/ercalc/types.ts` | Remove `periodicE` from ActionType, add `specialE` |
| `src/lib/ercalc/particleConfig.ts` | Delete entirely |
| `src/lib/ercalc/constants.ts` | Update `ParticleEntry` type, action sets, action labels |
| `src/lib/ercalc/erCalculator.ts` | Rewrite particle resolution + simulation loop |
| `src/lib/ercalc/rotationHints.ts` | Update hint logic (no more `periodicE` references) |
| `src/lib/ercalc/optimizer.ts` | Update action set references |
| `src/components/ercalc/TimelineStrip.tsx` | Remove `periodicE` rendering, update particle detection |
| `src/components/ercalc/ERCalcCard.tsx` | Update auto-tick logic |
| `src/components/ercalc/ERCalcView.tsx` | Update default timeline (no `periodicE` actions) |
| `scripts/scrape_particles.py` | Update output format |

## Infusion Character Classification

Characters whose NA/CA/PA generate elemental particles during a skill-activated state. Modeled as direct particle config on the attack action, assuming best-case infusion uptime.

| Character | Action | Avg | ICD | Notes |
|---|---|---|---|---|
| hu_tao | NA | 2.5 | 5s | Blood Blossom during Paramita Papilio |
| yoimiya | NA | 1.0 | 2s | Converted NA during Niwabi Fire-Dance |
| tartaglia | NA | 1.0 | 3s | Riptide procs during melee stance |
| kamisato_ayato | NA | 1.5 | 2.5s | Converted NA during Takimeguri Kanka |
| wanderer | NA | 1.0 | 2s | NA during Windfavored hover |
| wriothesley | NA | 1.0 | 2s | NA during Icefang Rush |
| clorinde | NA | 1.0 | 2s | Swift Hunt / Impale the Night |
| alhaitham | NA | 1.0 | 1.5s | Projection Attack waves |
| gaming | PA | 2.0 | 3s | Charmed Cloudstrider plunge |

## Data Sources and Confidence

### Primary: gcsim (Go source → LLM extraction)

- **Authoritative** for: `min`/`max` particle counts, ICD values, periodic vs instant classification
- **Method**: Feed `internal/characters/<name>/skill.go` to LLM with target schema
- **Coverage**: All released characters implemented in gcsim
- **Limitation**: Go source patterns vary per character; extraction may need manual review

### Secondary: Fandom Wiki (existing scraper)

- **Good for**: `avg` values, `spawnPoint`, human-readable `notes`
- **Method**: Existing `scrape_particles.py` parses Energy/Data wiki table
- **Coverage**: All released characters, but lags behind new releases
- **Limitation**: No min/max split, no ICD data, no periodic/instant classification

### Fallback: character_stats.json (datamine)

- **Use only for**: Unreleased characters with no wiki or gcsim data
- **Limitation**: Integer-only particle counts, no fractional data, no conditions
- **Marked in output** with `"notes": "from character_stats.json (integer)"`

### Validation strategy

Cross-reference gcsim and Fandom values. If `|gcsim.avg - fandom.avg| > 0.1`, flag for manual review. Fandom `avg` should equal `(gcsim.min + gcsim.max) / 2` for binary probability characters, or match gcsim's weighted average for multi-outcome characters.

## Open Questions

1. **holdE ticks**: Should `ticks.E` be triggered by both E and holdE? Currently assumed yes (same deployment). If a character has different tick behavior for press vs hold, we'd need `ticks.holdE`.

2. **specialE ticks**: Can `specialE` trigger ticks? If Cyno's burst-state E also produces periodic effects, we'd need `ticks.specialE`. Probably not needed — his burst-state E is instant.

3. **NA particle cap**: Should the schema include a `maxProcs` on NA/CA/PA to engine-enforce ICD? Current design leaves this to the user (aided by `notes`). Adding `maxProcs` would prevent overestimation but adds complexity.

4. **specialQ cost**: How to model the reduced energy cost of `specialQ`? Currently `TeamSlot.burstCost` is a single number. Options: add `specialBurstCost` to the slot, or model the cost difference in `selfEnergy` as a flat refund.
