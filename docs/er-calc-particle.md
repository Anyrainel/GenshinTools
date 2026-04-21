# ER Calculator — Particle Data Schema v2

## Motivation

The v1 particle data is spread across 4 independent surfaces that must stay in sync:

| Surface | What it stores | Problem |
|---|---|---|
| `particles.json` | Per-character `press`/`hold` avgParticles | Per-hit vs per-use ambiguity; no min/max |
| `particleConfig.ts:periodicGenerators` | Set of charIds whose E produces 0 | Must manually sync with particles.json |
| `particleConfig.ts:expectedPeriodicProcs` | Default proc count per deployment | Must manually sync with periodicGenerators |
| `particleConfig.ts:multiHitETotal` | Override totals for multi-hit chars | Patches over particles.json inconsistency |

Additionally, `periodicE` is currently an action type, but it is not a real action — it is a background particle event that happens *during* another character's action. The UI already separates these from actions via `ERTimeline` (`{ actions, periodic }`), but the engine flattens them back into fake `periodicE` actions. This is a leaky abstraction.

This design:
1. Unifies all four data surfaces into a single `particles.json` schema.
2. Removes `periodicE` from the action space — periodic events become a first-class engine concept.
3. Extends the action space with `specialE` / `specialQ` for enhanced/alternative variants that the user interweaves at runtime (e.g. Cyno burst-mode E, Flins `specialQ`, Varesa `specialQ`).
4. Models particle generation as a **list of independent rolls** (gcsim-native), from which min/expected/max are derived at load time.

## Design Principles

- **Trust the user's combat sequence.** If the user places 10 consecutive infused NAs, that is what they claim to play. The schema describes *which NA hit in a chain produces particles*, not whether the user "should" have stopped earlier. Overcounting past ICD is the user's problem to avoid — we surface `notes` to guide them.
- **Event-based, no real time.** Actions are points on a timeline. Particle travel is approximated by the next-action-absorber rule. Periodic deployment duration is not modeled — periodic events are a count, editable in the UI.
- **Data shape should mirror the source.** Particle counts in game are a sum of independent probabilistic rolls (`rand.Float64() < p` in gcsim). Our schema stores those rolls directly; min/max/avg are derived.

## Action Space (v2)

Actions represent things a character **does**. Background particle events (periodic procs) are not actions.

| Action | Description | Direct particles |
|---|---|---|
| `E` | Elemental skill (press) | Yes — from schema |
| `holdE` | Elemental skill (hold) | Yes — from schema (falls back to `E`) |
| `specialE` | Enhanced/alternative skill variant | Yes — from schema |
| `Q` | Elemental burst | No (drains energy) |
| `specialQ` | Alternative burst variant | No (drains energy, different cost) |
| `NA` | Normal attack | Yes — if char has NA pattern config |
| `CA` | Charged attack | Yes — if char has CA pattern config |
| `PA` | Plunge attack | Yes — if char has PA pattern config |
| `wait` | Stay on-field (catch particles) | No |

**Removed**: `periodicE` — replaced by the periodic-event model (see below).

Both `specialE` and `specialQ` are first-class actions the user can place anywhere in a timeline. They are not "one-time mode switches" — characters like Flins and Varesa interweave `Q` and `specialQ` based on runtime stacks, and the user expresses that by placing the appropriate blocks.

### Periodic events (background particles)

Periodic events represent off-field particle generation from summons, constructs, or coordinated attacks triggered by another character's skill or burst. They are **not actions** — they are background particle events that occur *during* another character's on-field action.

```ts
interface ERTimeline {
  actions: TimelineAction[];    // real actions only
  periodic: PeriodicProc[];     // background particle events attached to actions
}
```

Each periodic proc's `targetIndex` identifies which action is happening when those particles arrive — that action's character is on-field and absorbs the particles. Proc count is auto-placed from schema defaults when the trigger action is added, and is editable by the user in the trigger node's popover menu.

## Schema Definition

```jsonc
// particles.json — one entry per character, nested by action.
{
  "<charId>": {
    "element": "<Element>",       // particle element type

    // ── Direct particle generation (instant on cast) ──
    "E"?:        ActionParticles,
    "holdE"?:    ActionParticles,   // falls back to "E" if absent
    "specialE"?: ActionParticles,

    // ── Self-infusion attacks (per-hit pattern) ──
    "NA"?:       HitPatternConfig,
    "CA"?:       HitPatternConfig,
    "PA"?:       HitPatternConfig,

    // ── Periodic generation (background particles) ──
    // Present = this cast triggers background particle procs; absent = none.
    "periodic"?: {
      "E"?: PeriodicConfig,         // procs triggered by E or holdE
      "Q"?: PeriodicConfig          // procs triggered by Q or specialQ (rare)
    },

    "spawnPoint"?: "Character" | "Enemy" | "Construct",  // optional, display-only
    "source"?: "fandom" | "gcsim" | "datamine" | "manual"
  }
}
```

### `Particles` — list of independent rolls

```ts
// A list of independent particle-generating events. Each entry is [count, chance].
// Integer shorthand: `3` means `[[3, 1.0]]`.
type Particles = number | Array<[count: number, chance: number]>;
```

Examples:

| Raw form | Meaning |
|---|---|
| `3` | Deterministic 3 particles |
| `[[2, 1.0], [1, 0.25]]` | Always 2, plus 25% chance of a 3rd |
| `[[1, 0.67]]` | 67% chance of 1 particle (Fischl Oz proc) |
| `[[1, 0.8], [1, 0.8], [1, 0.8], [1, 0.8], [1, 0.8]]` | 5 independent 80% rolls (Diona paws) |

Derived at load time:

```
min = Σ count where chance == 1.0
max = Σ count
avg = Σ count × chance
```

### `ActionParticles` — direct generation on cast

```jsonc
{
  "particles": Particles,
  "notes"?: "string"
}
```

`notes` is human-readable context (conditions, source), not consumed by the engine.

### `HitPatternConfig` — infusion NA/CA/PA

```jsonc
{
  "pattern": Particles[],          // cycles; pattern[i % len] applies to the i-th hit
  "notes"?: "string"               // typically documents the ICD assumption
}
```

Indexed by the character's consecutive NA/CA/PA hit count in the timeline (not the action index across all chars). Cycles after `pattern.length`.

Example — Hu Tao generates 1 particle on every 3rd NA during Blood Blossom:

```jsonc
"NA": { "pattern": [1, 0, 0], "notes": "Blood Blossom; 5s ICD ≈ every 3rd NA" }
```

Each pattern element is a `Particles` value, so probabilistic patterns are fine:

```jsonc
"NA": { "pattern": [[[1, 0.9]], 0, 0] }
```

We trust the user to stop placing NAs when infusion drops. The `notes` field documents the assumed infusion state so the user can plan around it.

### `PeriodicConfig` — periodic off-field generation

```jsonc
{
  "procs": 7,                     // default proc count auto-placed when trigger is added
  "particles": Particles,         // particle roll per individual proc
  "notes"?: "string"              // source description (e.g. "Oz ATK", "Stele resonance; 1.5s ICD")
}
```

- `procs` is a UX default, not engine-binding. When the user adds the trigger action, the UI auto-places that many procs; the user can add, remove, or reposition procs freely via the trigger node's popover menu. This lets the user adapt to short or long rotations without schema changes.
- `particles` is the roll for each individual proc event.

## Engine Mapping

### `getActionParticles(charId, action, mode) → number`

Resolves direct particles for a timeline action. Does not handle periodic procs.

```
data = particles[charId]
p = undefined

switch (action):
  case "E":         p = data.E
  case "holdE":     p = data.holdE ?? data.E
  case "specialE":  p = data.specialE
  case "NA" / "CA" / "PA":
    // Resolved separately — see getHitParticles below.
  case "Q" / "specialQ" / "wait":  return 0

if p == null: return 0
return resolveParticles(p.particles, mode)
```

### `getHitParticles(charId, action, hitIndex, mode) → number`

Resolves particles for the `hitIndex`-th NA/CA/PA from this character in the current timeline window. The caller tracks per-character hit counters while walking the timeline.

```
cfg = particles[charId][action]?.pattern
if cfg == null: return 0
return resolveParticles(cfg[hitIndex % cfg.length], mode)
```

### `getPeriodicParticles(charId, trigger, mode) → number`

```
cfg = particles[charId].periodic?[trigger]
if cfg == null: return 0
return resolveParticles(cfg.particles, mode)
```

### `hasPeriodicGeneration(charId, trigger) → boolean`

Whether a character's action triggers background procs. Used by UI for auto-placement.

```
trigger == "E" or "holdE" → data.periodic?.E != null
trigger == "Q" or "specialQ" → data.periodic?.Q != null
```

Replaces the v1 `periodicGenerators` Set.

### `getDefaultProcCount(charId, trigger) → number`

How many procs to auto-place when the trigger action is added.

```
trigger == "E" or "holdE" → data.periodic?.E?.procs ?? 0
trigger == "Q" or "specialQ" → data.periodic?.Q?.procs ?? 0
```

Replaces the v1 `expectedPeriodicProcs` map.

### `resolveParticles(p: Particles, mode) → number`

```
if typeof p == "number": return p
switch (mode):
  case "min":      return Σ p[i].count where p[i].chance == 1.0
  case "max":      return Σ p[i].count
  case "expected": return Σ p[i].count × p[i].chance
```

Replaces the v1 `floor(avg)` / `ceil(avg)` heuristic — min and max come from the distribution directly.

## Engine Changes: Native Periodic Processing

### Simulation loop (sketch)

```
hitCounters = {}  // per-char per-action hit index

for each action[i] in ert.actions:
  // 1. Periodic procs attached to this action
  for each proc where proc.targetIndex == i:
    absorber = action[i].char  // on-field character
    n = getPeriodicParticles(proc.sourceChar, proc.trigger, mode)
    element = data[proc.sourceChar].element
    distributeParticles(team, proc.sourceChar, n, element, absorber)

  // 2. The action itself
  a = action[i]
  if a.action in ["NA", "CA", "PA"]:
    idx = hitCounters[a.char]?[a.action] ?? 0
    n = getHitParticles(a.char, a.action, idx, mode)
    hitCounters[a.char][a.action] = idx + 1
  else:
    n = getActionParticles(a.char, a.action, mode)

  if n > 0:
    absorber = getAbsorber(ert.actions, i)
    element = data[a.char].element
    distributeParticles(team, a.char, n, element, absorber)

  // 3. Burst energy drain
  if a.action == "Q":         drainEnergy(a.char, team[a.char].burstCost)
  if a.action == "specialQ":  drainEnergy(a.char, specialBurstCost(a.char))
```

Key differences from v1:
- `getAbsorber` only walks real actions (no `periodicE` to skip).
- Periodic procs resolved against `targetIndex` directly.
- NA/CA/PA use per-character hit counters so the `pattern` cycles correctly.

### `specialQ` energy drain

`specialQ` drains a different amount of energy than `Q`. The standard `burstCost` lives on `TeamSlot`. For `specialQ`, we look up a per-character override in character data (field TBD — see Open Questions).

## Character Patterns

### Pattern 1: Simple instant E

```jsonc
"bennett": {
  "element": "Pyro",
  "E":     { "particles": [[2, 1.0], [1, 0.25]] },
  "holdE": { "particles": 3 },
  "spawnPoint": "Character"
}
```

### Pattern 2: Multi-hit instant (total per cast)

```jsonc
"diona": {
  "element": "Cryo",
  "E":     { "particles": [[1, 0.8], [1, 0.8], [1, 0.8], [1, 0.8], [1, 0.8]], "notes": "5 paws × 0.8" },
  "holdE": { "particles": [[1, 0.8], [1, 0.8], [1, 0.8], [1, 0.8], [1, 0.8]] },
  "spawnPoint": "Enemy"
}
```

### Pattern 3: Off-field periodic (summon)

```jsonc
"fischl": {
  "element": "Electro",
  "periodic": {
    "E": {
      "procs": 7,
      "particles": [[1, 0.67]],
      "notes": "Oz ATK"
    }
  },
  "spawnPoint": "Character"
}

"xiangling": {
  "element": "Pyro",
  "periodic": {
    "E": {
      "procs": 4,
      "particles": 1,
      "notes": "Guoba breath"
    }
  },
  "spawnPoint": "Enemy"
}
```

Engine: E → 0 direct particles. Auto-place N procs at trigger time. Each proc distributes to whoever is on-field at that point.

### Pattern 4: Off-field periodic (coordinated / construct)

```jsonc
"raiden_shogun": {
  "element": "Electro",
  "periodic": {
    "E": {
      "procs": 5,
      "particles": [[1, 0.5]],
      "notes": "Eye coordinated ATK; 0.9s ICD"
    }
  },
  "spawnPoint": "Enemy"
}

"zhongli": {
  "element": "Geo",
  "periodic": {
    "E": {
      "procs": 4,
      "particles": [[1, 0.5]],
      "notes": "Stele resonance; 1.5s ICD"
    }
  },
  "spawnPoint": "Construct"
}
```

### Pattern 5: Self-infusion (NA/CA/PA pattern)

Infusion skills activate a state where N-th hits generate elemental particles. Schema stores the per-hit pattern derived from gcsim's ICD. User-placed NA count determines procs; we trust their sequence.

```jsonc
"yoimiya": {
  "element": "Pyro",
  "NA": { "pattern": [1, 0, 0, 0], "notes": "Niwabi; 2s ICD ≈ every 4th NA" },
  "spawnPoint": "Enemy"
}

"hu_tao": {
  "element": "Pyro",
  "NA": { "pattern": [1, 0, 0], "notes": "Blood Blossom; 5s ICD ≈ every 3rd NA" },
  "spawnPoint": "Enemy"
}

"tartaglia": {
  "element": "Hydro",
  "NA": { "pattern": [1, 0, 0], "notes": "Riptide Slash; 3s ICD in melee stance" },
  "spawnPoint": "Enemy"
}

"gaming": {
  "element": "Pyro",
  "PA": { "pattern": [2], "notes": "Charmed Cloudstrider plunge" },
  "spawnPoint": "Character"
}
```

### Pattern 6: Direct E + infusion NA

```jsonc
"alhaitham": {
  "element": "Dendro",
  "E":  { "particles": 1 },
  "NA": { "pattern": [0, 1, 0], "notes": "Projection wave; 1.5s ICD ≈ on 2nd NA" },
  "spawnPoint": "Enemy"
}
```

### Pattern 7: Direct E + periodic

```jsonc
"nahida": {
  "element": "Dendro",
  "E": { "particles": 3, "notes": "On initial Karma link" },
  "periodic": {
    "E": {
      "procs": 1,
      "particles": 3,
      "notes": "Tri-Karma Purification; 7s ICD"
    }
  },
  "spawnPoint": "Enemy"
}
```

### Pattern 8: No particles

```jsonc
"noelle": {
  "element": "Geo"
}
```

No action keys, no periodic → engine returns 0 for all actions.

### Pattern 9: Simplified variable (counter/stacks)

```jsonc
"beidou": {
  "element": "Electro",
  "E": { "particles": [[2, 1.0], [1, 0.5], [1, 0.5]], "notes": "Avg across counter levels" },
  "spawnPoint": "Enemy"
}
```

### Pattern 10: specialE (enhanced skill variant)

```jsonc
"cyno": {
  "element": "Electro",
  "E":        { "particles": 3, "notes": "Normal stance" },
  "specialE": { "particles": [[1, 1.0], [1, 0.33]], "notes": "During Pactsworn Pathclearer" },
  "spawnPoint": "Character"
}

"freminet": {
  "element": "Cryo",
  "E":        { "particles": 2, "notes": "Upward Thrust" },
  "specialE": { "particles": 1, "notes": "Lv.4 Shattering Pressure" },
  "spawnPoint": "Character"
}
```

### Pattern 11: specialQ (alternative burst variant)

```jsonc
"varesa": {
  "element": "Electro",
  "E": { "particles": 2 }
  // specialQ is a Q variant at reduced cost — no particles, but different drain.
}
```

`specialQ` typically drains a different energy amount than `Q`. The character entry does not carry particle data for it; energy drain override lives in character-stats data (see Open Questions).

### Pattern 12: Periodic from Q (rare)

```jsonc
"raiden_shogun_burst": {
  "element": "Electro",
  "periodic": {
    "Q": {
      "procs": 3,
      "particles": [[1, 1.0]],
      "notes": "Musou Isshin coordinated ATK during burst"
    }
  }
}
```

Most burst-related energy comes through flat restoration (modeled in `selfEnergy`), not particles. This pattern exists for completeness.

## Data Sources

### Phase 1 — Fandom (production) + Lunaris (side-by-side reference)

**Fandom Wiki** (`scripts/scrape_particles.py`)
- Provides: `element`, `avg` particles (press/hold), `spawnPoint`, human-readable notes
- Covers: all released characters (≈112 from wiki + a handful of unreleased back-filled from datamine)
- Writes to: `src/data/ercalc/particles.json` (production)
- Extrapolation rule: an `avg` of `N.f` becomes `[[floor(avg), 1.0], [1, f]]` — i.e., guaranteed `floor` particles plus `f` chance of one more. Integer `avg` → shorthand `avg`. Preserves min/max derivation without inventing variance.
- Classification (periodic vs multi-hit vs simple E) is hardcoded in the scraper, mirroring v1's `src/lib/ercalc/particleConfig.ts` until v1 is removed.

**Lunaris API** (`scripts/scrape_particles_lunaris.py`)
- Provides: **full probabilistic per-event particle distribution** — every `source`, integer `particles`, `chance` (0-1), and `cd` — exactly what gcsim encodes.
- Covers: ≈121 characters (released + unreleased). Some legacy chars (Aloy, Sigewinne) have empty energy arrays in Lunaris — Fandom covers those.
- Writes to: `src/data/ercalc/particles.lunaris.json` (side-by-side reference, **not consumed in production**)
- Output form is raw: `{ events: [{source, particles, chance, cd}, ...] }`. Events sharing `source`+`cd` are *sometimes* independent rolls on one cast (Bennett Ball1 = 2@100% + 1@25%) and *sometimes* mutually-exclusive variants (Cyno's 3 entries cover normal + burst-state E). Interpretation is left to manual review — grouping heuristics don't disambiguate reliably.
- Used for: drift detection vs Fandom, sourcing unreleased characters, and as a faster alternative to gcsim extraction if the raw data is rich enough.

### Phase 2 — gcsim extraction (if Lunaris is insufficient)

Given Lunaris already supplies the probabilistic distribution, Phase 2 may collapse to a narrower effort: reviewing Lunaris events for infusion chars (hu_tao, yoimiya, etc.) to assign `NA.pattern`, and resolving Cyno-style variants into `E`/`specialE` splits. Full gcsim Go-source extraction becomes a last-resort fallback for any gap Lunaris leaves.

### Always present

- `source` field tagged on every production entry: `"fandom" | "lunaris" | "gcsim" | "manual"` so the UI can surface confidence and tooling can filter for re-scrapes.

## Migration from v1

### Data migration (one-shot script)

1. **Periodic chars** (in v1 `periodicGenerators`):
   - Off-field generator (Fischl, Xiangling, etc.): `press.avgParticles` → `periodic.E.particles`; `expectedPeriodicProcs[charId]` → `periodic.E.procs`.
   - Infusion char (Hu Tao, Yoimiya, etc.): move to `NA`/`CA`/`PA` with a hand-written `pattern`. v1 data has no pattern, so emit a placeholder `[avg, 0, 0]` cycle and flag for Phase 2 gcsim review.
2. **Multi-hit chars** (in v1 `multiHitETotal`):
   - `multiHitETotal[charId]` → `E.particles` as shorthand integer.
3. **Simple chars**:
   - `press.avgParticles = N.f` → `E.particles = [[N, 1.0], [1, f]]` (or integer shorthand for whole values).
   - `hold.avgParticles` → `holdE.particles` (omit if identical to press — engine falls back).
4. **All chars**: preserve `element`, `spawnPoint` (optional now). Move v1 notes into the appropriate `notes` field. Tag `source: "fandom"`.

### Action space migration

- Remove `periodicE` from `ActionType`, `PARTICLE_ACTIONS`, `ACTION_LABELS`.
- Add `specialE`, `specialQ` to `ActionType` and `ACTION_LABELS`.
- Delete `flattenERTimeline` / `legacyToERTimeline` bridge functions.

### Engine migration

- `getActionParticles`: remove `periodicE`, add `specialE` branch; delegate NA/CA/PA to `getHitParticles`.
- Add `getHitParticles(charId, action, hitIndex, mode)` with per-character hit counters in the simulation loop.
- `getAbsorber`: remove `periodicE` skip logic.
- Simulation loop consumes `ert.periodic` directly against `targetIndex`.
- `autoPlacePeriodic` reads from `particles[charId].periodic.*.procs`.

### Files affected

| File | Change |
|---|---|
| `src/data/ercalc/particles.json` | Rewrite to v2 schema |
| `src/data/ercalc/particles.lunaris.json` | New — Phase 1 side-by-side datamine source |
| `src/lib/ercalc/types.ts` | Remove `periodicE` from ActionType, add `specialE`/`specialQ` |
| `src/lib/ercalc/particleConfig.ts` | Delete entirely |
| `src/lib/ercalc/constants.ts` | Update `ParticleEntry` type, action sets, action labels |
| `src/lib/ercalc/erCalculator.ts` | Rewrite particle resolution + simulation loop; add hit counters |
| `src/lib/ercalc/rotationHints.ts` | Remove `periodicE` references |
| `src/lib/ercalc/optimizer.ts` | Update action set references |
| `src/components/ercalc/TimelineStrip.tsx` | Remove `periodicE` rendering; add periodic sub-track, popover proc editor |
| `src/components/ercalc/ERCalcCard.tsx` | Update auto-proc logic |
| `src/components/ercalc/ERCalcView.tsx` | Update default timeline |
| `scripts/scrape_particles.py` | Emit v2 schema |
| `scripts/scrape_particles_lunaris.py` | New — scrape datamine source |

### Rollout

1. Land v2 types + `src/data/ercalc/particles.json` rewrite via migration script; keep v1 engine running behind a feature flag.
2. Implement native periodic engine + hit counters; parity tests against current 52-test suite.
3. Port UI to `ERTimeline`-native (no flattening); add periodic sub-track + popover proc editor.
4. Flip feature flag; remove v1 code and dead types.

## Infusion Character Reference (Phase 2 target)

Starting table for gcsim-sourced NA patterns. ICDs are from Fandom; actual pattern cycle requires gcsim audit.

| Character | Action | ICD | Likely pattern (pre-audit) |
|---|---|---|---|
| hu_tao | NA | 5s | `[1, 0, 0]` |
| yoimiya | NA | 2s | `[1, 0, 0, 0]` |
| tartaglia | NA | 3s | `[1, 0, 0]` |
| kamisato_ayato | NA | 2.5s | `[1, 0, 0]` |
| wanderer | NA | 2s | `[1, 0, 0, 0]` |
| wriothesley | NA | 2s | `[1, 0, 0, 0]` |
| clorinde | NA | 2s | `[1, 0, 0, 0]` |
| alhaitham | NA | 1.5s | `[0, 1, 0]` |
| gaming | PA | 3s | `[2]` |

## Open Questions

1. **`specialQ` cost model.** `TeamSlot.burstCost` is a single number. Options: add `specialBurstCost` to the slot, or store per-char in character data keyed by `specialQ`. Either way it's orthogonal to this schema. Recommended: add `specialBurstCost?: number` to character data and look up in the engine's drain step.

2. **`holdE` periodic.** `periodic.E` fires for both `E` and `holdE` (same deployment). If any character has different periodic behavior for press vs hold, we'd add `periodic.holdE` — unlikely at this point.

3. **`specialE` periodic.** Can `specialE` trigger periodic procs distinct from base `E`? If Cyno's burst-state E needed different procs we'd add `periodic.specialE`. Deferred — no known instance.

4. **Lunaris integration depth.** Phase 1 keeps Lunaris as a reference file only. Future: an automated discrepancy reporter that posts drift between Fandom `avg` and Lunaris integers. Out of scope for this doc.
