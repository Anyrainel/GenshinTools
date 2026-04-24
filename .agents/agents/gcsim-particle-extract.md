# gcsim-particle-extract — Particle Data Extraction Agent

Read gcsim character source files and emit v2-schema particle data as JSON. Each invocation processes a batch of characters and writes one output file.

## Field taxonomy

Fields you MAY emit:
- `element`, `source`, `spawnPoint` (optional)
- `E`, `holdE`, `specialE` — direct per-cast emissions from skill code paths
- `Q` / `specialQ` — particle fields on bursts (rare; only if gcsim genuinely calls `QueueParticle` inside burst code)
- `NA`, `CA`, `PA` — per-hit patterns for **infusion characters** where `particleCB` is registered on normal/charged/plunge attacks and gated by an ICD. See R11 for how to build the `pattern` array.
- `periodic.E`, `periodic.Q` — **deployable / summon / coordinated-attack** emissions only. Examples: Oz (Fischl), Guoba (Xiangling), Stele (Zhongli), Eye (Raiden), Tri-Karma (Nahida), Lumidouce Case (Emilie). NOT for infusion chars.
- `_unmodeled` — array of notes for review

Fields you MUST NOT emit:
- `_variants` — unreleased v1 field. Ignore.

**Classification rule of thumb**: if gcsim's `particleCB` is called from NA/CA/PA attack code paths gated by a buff status and a per-hit ICD, it's **infusion** → use `NA.pattern` / `CA.pattern` / `PA.pattern`. If it's called from a deployable's tick handler or a coordinated-attack subscription that fires on enemy damage regardless of active character, it's **periodic** → use `periodic.E` / `periodic.Q`.

## Arguments

- `Batch: <N>` — integer batch number; determines output filename.
- `Characters: <id1>, <id2>, ...` — **gcsim-side IDs** (not our DB IDs). E.g., `hutao`, `raiden`, `ayaka`.

## Output

Write a single JSON file at the path determined by your `Batch: <N>` argument:
```
scripts/out/particles.gcsim.batch_<N>.json
```

- The batch number MUST come from the `Batch: <N>` argument. Do NOT pick your own.
- If `scripts/out/` does not exist, create it.
- If the target file already exists, **overwrite it** (idempotent re-runs are expected).
- Do NOT write to any other path under `scripts/out/`, `src/data/ercalc/`, or elsewhere — you own exactly this one file.
- Do NOT modify `particles.json`, `particles.lunaris.json`, or `particles.gcsim.json` directly. The merge script handles combining batches.

Parallel-safety guarantee: each agent owns exactly its batch file. The dispatcher assigns disjoint character sets per batch, so no two agents ever write the same key.

Shape:
```jsonc
{
  "<our_char_id>": { ...v2 entry... },
  "<our_char_id>": { ...v2 entry... },
  ...
}
```

Use **our** character IDs as keys (see Rule R3), not gcsim's.

---

## Inputs you will read

1. **Schema reference**: `docs/er-calc-particle.md` — full v2 schema spec. Skim the "Schema Definition", "Particles", and "Character Patterns" sections.
2. **Location index**: `scripts/out/particle-locations.json` — per-character list of files, functions, and line ranges containing particle logic. Use this to read only the relevant functions, not full files.
3. **gcsim source**: `F:/Codes/genshin/gcsim/internal/characters/<gcsim_id>/`. Read the functions flagged in the index. If ambiguous, read the full file (`skill.go`, `burst.go`, `cons.go`, `asc.go`) — they're usually under 500 lines.

---

## Process per character

1. Look up `<gcsim_id>` in `particle-locations.json` → get list of files and functions.
2. Read each flagged function (use `Read` with `offset` and `limit` based on the `lines` range — add ±5 lines of padding for context).
3. Also read top-level `constants` from each file listed.
4. If the location index has no entry for this char (e.g., Barbara), emit an empty-particles entry: `{ "element": <known>, "source": "gcsim" }`.
5. Apply the rules below to build the v2 entry.
6. Add to the batch JSON.

After all assigned characters are processed, write the batch file.

---

## Rules

### Input & Output

**R1** — Source of truth is gcsim Go code at `F:/Codes/genshin/gcsim/internal/characters/<gcsim_id>/`. Do not consult `particles.json` or `particles.lunaris.json` — their biases are exactly what we're trying to transcend.

**R2** — Every entry has `"source": "gcsim"`. Every entry has `"element"` (pull from the `attributes.<Element>` argument to `QueueParticle`; capitalize to match our types, e.g. `Pyro`, `Cryo`, `Hydro`, `Electro`, `Anemo`, `Geo`, `Dendro`).

**R3** — ID mapping (gcsim → our DB key):
- `hutao` → `hu_tao`
- `ayaka` → `kamisato_ayaka`
- `ayato` → `kamisato_ayato`
- `heizou` → `shikanoin_heizou`
- `itto` → `arataki_itto`
- `kazuha` → `kaedehara_kazuha`
- `kokomi` → `sangonomiya_kokomi`
- `kuki` → `kuki_shinobu`
- `lanyan` → `lan_yan`
- `mizuki` → `yumemizuki_mizuki`
- `raiden` → `raiden_shogun`
- `sara` → `kujou_sara`
- `yaemiko` → `yae_miko`
- `yunjin` → `yun_jin`
- `traveler` → **skip** (base file, travelers are handled manually)
- Everything else → same as gcsim name (e.g., `bennett` → `bennett`).

### Recognizing particle logic

**R4** — The emission site is `c.Core.QueueParticle(<key>, <count>, attributes.<Element>, <delay>)`. Extract the count argument and the element.

**R5** — The `count` argument may be:
- A literal integer or float: `QueueParticle(..., 3, ...)` → `Particles = 3`
- A local variable: trace back to its assignment in the same function.
- A named constant: look it up in the file's top-level `const (...)` block (e.g., `skillPressParticleCount = 3`).

**R6** — Probability gates are `if c.Core.Rand.Float64() < P { ... }`. Two shapes:
- **Outcome-modifying**: `count := 2.0; if Rand < 0.25 { count = 3 }; QueueParticle(..., count, ...)` → `[[2, 1.0], [1, 0.25]]` (the bonus particle with prob 0.25).
- **Emission-gating**: `if Rand < 0.8 { QueueParticle(..., 1, ...) }` → `[[1, 0.8]]`.
- Compose: multiple independent rolls in the same function → concatenate as additive independent events.

**R7** — Single-fire gating via closure flag:
```go
func (c *char) makeParticleCB() info.AttackCBFunc {
    done := false
    return func(a info.AttackCB) {
        if done { return }
        done = true
        c.Core.QueueParticle(..., N, ...)
    }
}
```
`done` is scoped to **one closure instance**. To determine per-cast behavior, grep for call sites of `makeParticleCB(` or the method's name in the same file:
- **One call site, closure passed to N attacks** (Klee: `particleCB := c.makeParticleCB(); for i := range bounceAttacks { QueueAttack(..., particleCB) }`) → closure fires exactly once → per-cast emission = N.
- **Inside a loop, called each iteration** (Diona hold: `for i := 0; i < 5; i++ { ... QueueAttack(..., c.makeParticleCB()) }`) → N independent closures → N independent firings → model as N additive rolls (e.g. `[[1,0.8],[1,0.8],[1,0.8],[1,0.8],[1,0.8]]` for Diona).
- **Plain `particleCB` method** (not a factory, no closure state): each call site is an independent firing. Count call sites to determine per-cast count. Example: Ganyu's `particleCB` is called by 2 separate `QueueAttack` calls (initial + explosion) → per-cast = 2 firings of its count each.
- **Status-ICD gated plain CB** (Bennett pressParticleCB uses `StatusIsActive(icdKey)` instead of `done` flag): the ICD typically expires between cast instances, so treat as one firing per cast.

**R8** — ICD gating (particle-specific, distinct from attack ICDs):
```go
if c.StatusIsActive(particleICDKey) { return }
c.AddStatus(particleICDKey, 0.3*60, true)
```
This enforces a minimum time between particle emissions. For **per-cast** logic it's usually a no-op (one cast = one emission anyway). For **periodic** logic it determines the minimum tick cadence → informs default `procs`.

### Classifying as E / holdE / specialE / periodic / NA

**R9** — **Direct per-cast (`E`, `holdE`, `specialE`)**:
- `QueueParticle` reached via a callback registered inside `skillPress()` / `skillHold()` / enhanced-skill branches, called once per skill cast, with no time-delayed re-firing.
- Distinguish **press vs hold** by which branch of `Skill(p)` registers the callback: `if p["hold"] == 0 { skillPress() } else { skillHold() }`. Press CB → `E`. Hold CB → `holdE`. If the two branches produce identical particles, emit only `E` (the engine falls back to E for holdE).
- **`specialE`** = a distinct enhanced variant the user can *choose to cast* at runtime. Detect by: gcsim exposes a separate top-level skill method or a distinct branch in `Skill(p)` keyed by a param like `p["enhanced"]`, *and* the variant has different particle behavior. Examples:
  - **Cyno**: burst-mode E is a separate code path firing while `StatModIsActive(pactswornBuff)`. If the particles differ from base E, emit `specialE`.
  - **Freminet L4 Shattering Pressure**: gcsim routes via `p["pressure_level"]` with Lv4 producing different particles — emit `specialE`.
  - **Ayato Shunsuiken**: stance-based variant — emit `specialE` if particles differ.
- **Not** `specialE`: a *buff modifier* on the same skill code path (e.g., a passive that adds +1 particle while X buff is up). That goes in `_unmodeled`.
- **Direct E AND periodic.E can coexist** (Pattern 7): Nahida emits 3 particles on initial Karma link (direct `E`) AND periodically on Tri-Karma (`periodic.E`). Both fields on one entry is valid and expected.

**R10** — **Periodic (`periodic.E` or `periodic.Q`)**:

Periodic emissions are particles that arrive *without* a direct per-hit user input. Three sub-patterns:

- **Deployables with timed ticks** (Oz, Guoba, Lumidouce Case, Tri-Karma): `QueueEnemyTask(tickFunc, interval)` schedules recurring fires.
- **Coordinated attacks** (Raiden Eye, Zhongli Stele resonance): a CB subscribed to enemy-damage events (often via `OnEnemyDamage` or a `skillHit` handler) that fires when the active character hits enemies, gated by a particle ICD. Model as `periodic.E` — procs bounded by hits-per-rotation.
- **Off-field periodic from a buff/status** (Kuki ring, Yae Sakura): persistent status that ticks on a timer.

All three classify as `periodic.E` (or `periodic.Q` if Q-triggered).

**Trigger action**: where the deployable/buff is spawned (typically `E` or `holdE` → `periodic.E`; rare `Q`/`specialQ` → `periodic.Q`).

**Rotation window assumption**: 15 seconds. Use for any `procs` default when lifetime exceeds it.

**`procs` formula**:
1. Explicit lifetime + tick-interval constants (e.g. `ozDuration = 10*60`, `ozTickInterval = 60`): `procs = min(floor(lifetime / interval), floor(15 / interval))`.
2. Fixed tick count hard-coded (e.g. "Guoba breathes 4 times"): use the literal.
3. Coordinated attacks with ICD only (no lifetime): `procs = floor(15 / icd_seconds)`, capped by any status duration.
4. Neither apparent: pick 3-7 based on gcsim source comments or analogous chars. Reason in `notes`.

**Multi-deployable aggregation**: if a char can have multiple copies of the same deployable active (Yae Miko up to 3 Sakura, Chiori Tamoto + Rock doll) AND they share a single particle ICD, `procs` reflects the total emissions across all copies — NOT per-deployable. The shared ICD caps the rate regardless of deployable count. Record the "up to N copies share ICD" observation in `notes`.

**`particles`**: the per-tick emission shape — NOT summed across procs.

Examples:
- Fischl: Oz 10s × 1s ICD → `procs: min(10, 15) = 10`, but typical rotation caps absorption → use `7`. `particles: [[1, 0.67]]`.
- Nahida: Tri-Karma 7s particle ICD, triggers once per cycle → `procs: 1`, `particles: 3` (within a 15s rotation; if ICD < rotation window, bump procs accordingly).
- Raiden Eye: coordinated attack, 0.9s ICD, 25s Eye duration → `procs = min(floor(25/0.9), floor(15/0.9)) = 16`, but bounded by Eye deployment span and absorber availability → use `5-7` based on gcsim sample configs.
- Yae Miko: 3 Sakura × ~2.93s tick interval, single 2.5s particle ICD → `procs = floor(15/2.5) = 6` (across all sakura combined).

**R11** — **Infusion attacks** (Hu Tao blood blossom, Yoimiya Niwabi NA, Tartaglia riptide, Alhaitham projection waves, Wanderer hover NA, Wriothesley icefang, Clorinde swift hunt, Kamisato Ayato shunsuiken, Gaming cloudstrider, Flins, Skirk, Mualani):

In gcsim, these chars have `particleCB` registered on NA/CA/PA attack code paths, gated by `StatModIsActive(<buffKey>)` + `StatusIsActive(<icdKey>)` + `AddStatus(<icdKey>, X*60, ...)`. Emit them as **`NA.pattern`** (or `CA.pattern` / `PA.pattern` — whichever attack type the callback is attached to).

### Determining the hit type
- If `particleCB` is registered in `attack.go` on normal-attack code → `NA.pattern`.
- If in `charge.go` → `CA.pattern`.
- If in `plunge.go` → `PA.pattern` (Gaming).
- If registered on multiple hit types sharing one ICD (common — Hu Tao, Ayato): emit under the **primary** one (usually `NA`), and put the shared-ICD note in `_unmodeled`.

### Building the `pattern` array
`pattern[i]` is the particle count for the char's i-th hit (in that attack type). Cycles.

Formula: **cycle length ≈ ICD ÷ typical hit cadence** (NA cadence ~0.5s unless the char's frames file says otherwise; CA cadence ~1s; PA cadence 1 per cast).

- Position 0 gets the emission, later positions are 0. The first hit after ICD expiry fires.
- `pattern_length = max(1, round(icd_seconds / hit_interval_seconds))`.

Examples:
- Hu Tao: 5s ICD, NA cadence ~1.5s → length 3 → `NA.pattern = [[[2, 1.0], [1, 0.5]], 0, 0]`.
- Yoimiya: 2s ICD, NA cadence ~0.5s → length 4 → `NA.pattern = [1, 0, 0, 0]`.
- Tartaglia melee: 3s ICD, NA cadence ~0.5s → length 6 → `NA.pattern = [1, 0, 0, 0, 0, 0]`.
- Gaming: per-plunge direct (no meaningful ICD chain) → `PA.pattern = [2]` (every plunge emits 2).

### Notes and _unmodeled
- In `notes`: record the buff duration, particle ICD, and the pattern length derivation.
- In `_unmodeled`: record any shared-ICD across hit types (e.g., "CA shares particle ICD with NA — proc count is across NA+CA combined"), buff duration bounds that cap the effective pattern cycles, or HP/state conditions.

### Do NOT use `periodic.E` for infusion
`periodic.E` is reserved for deployables (Oz, Guoba, Stele, Eye, Lumidouce Case, Tri-Karma, etc.) — where the emission happens independent of the player's current attacks. Infusion emissions are player-driven per-hit and belong in `NA` / `CA` / `PA`.

### Edge case: ICD ≥ rotation window → treat as direct E
If the particle ICD is so long it caps at 1 emission per skill cast (Mualani: `particleICD = 9999 * 60` frames, reset on each E press), model it as **direct `E`** (or `holdE` / `specialE`) with the per-cast particles, NOT as `NA.pattern`. The pattern cycle would be meaninglessly long. Note the reset-on-cast mechanic in `notes`.

**R12** — **Variants (`specialQ` / multiple casts)**:
- Flins/Varesa have a `specialQ` (reduced-cost burst variant). Particles are usually not relevant for Q actions (bursts drain, don't generate), so `specialQ` typically has no particle entry.
- Only emit a `Q` or `specialQ` particle field if gcsim actually calls `QueueParticle` from burst code.

### Simplifications (apply silently — do NOT record in `_unmodeled`)

**S1** — Frame timing and hitmarks (`skillFrames`, `skillPressHitmark`, `QueueAction(fn, frameDelay)`). Our model is event-based without real time.

**S2** — The `c.ParticleDelay` parameter passed to `QueueParticle`. This is particle-travel delay; our model handles absorption via the next-action rule.

**S3** — Attack-level ICDs (`ICDTag`, `ICDGroup`, `ICDTagElementalArt`, etc.). These gate elemental reactions, not particles.

**S4** — Target-type guards (`if a.Target.Type() != info.TargettableEnemy { return }`). Assume an enemy is present.

**S5** — Element-match multipliers and ER% scaling. Handled at the calc-engine layer, not the source data.

**S6** — Damage multipliers, `Durability`, `PoiseDMG`, `StrikeType`, `Mult`, etc. Not particle-related.

**S7** — Visual/animation fields (`Abil`, `ActorIndex`, `IsDeployable`).

### Must record in `_unmodeled`

**U1** — **Constellation-gated particle effects**. If `cons.go` contains `QueueParticle` or code that modifies particle count, note it:
```
"_unmodeled": ["C2: adds +1 particle proc on skill hit (cons.go:45)"]
```

**U2** — **Ascension passive effects on particles**. If `asc.go` (A1/A4) modifies particle counts, note it similarly. (Flat-energy passives do NOT go here — they belong in `selfEnergy` data, not particle data.)

**U3** — **Stack/state-gated emissions** that can't be expressed in per-cast form. Examples: "Only emits if character has 3 Night Stars", "Modified by talent-level mechanics". Describe the rule.

**U4** — **Schema gaps**. Anything you can't faithfully express in the v2 schema. Include enough context that a reviewer can decide whether to extend the schema or curate manually. Example: "Deployable ticks alternate between 1 and 2 particles based on enemy count — simplified to flat per-proc average".

**U5** — **Probabilistic mechanics that don't fit the independent-rolls model**. Example: "Mutually exclusive outcomes: 60% chance of 2-particle variant, 40% chance of 3-particle variant. Modeled as [[2, 1.0], [1, 0.4]] which is an approximation, not truth."

**R13** — **Chars with no `QueueParticle` calls anywhere** (Barbara shield/heal, Noelle shield, Qiqi heal, etc.): emit `{ "element": <Element>, "source": "gcsim" }` with no other fields. No `_unmodeled` needed — the absence of particles is the full truth.

**R14** — **Traveler**: skip entirely (base `traveler` dir has no particle code; element variants are separate characters). A later pass handles `traveler_anemo`, `traveler_geo`, etc. manually.

**R15** — **Conditional follow-up emissions** (particles that fire only after a specific action sequence):
- **Kujou Sara**: E grants Crowfeather Cover (buff); CA consumes the buff and the CA hit fires `particleCB`. The user-facing action that produces particles is the CA → classify as **`specialE`** (a variant of the skill that requires a specific follow-up to realize particles). The E alone produces nothing. Record the "E must be followed by CA" requirement in `notes`.
- **Faruzan**: E places Vortex; CA with Hurricane Arrow triggers Pressurized Collapse → particles. Same pattern: classify under the action the user initiates to realize particles.
- General rule: when particles require a user-initiated follow-up action after the skill cast, classify under the action-type the follow-up belongs to (E/holdE/specialE for skill-like releases, NA/CA/PA for hit-triggered infusions).

**R16** — **Burst-state particle modifiers** (particles behave differently while a burst buff is active):
- **Razor**: both press and hold E suppress particles during Lightning Fang (burst buff) — particleCB isn't assigned.
- **Freminet**: during burst state, particleCBThrust and particleCBLv4 halve emission from 2 → 1.
- **Lyney**: burst-mode `explosiveFirework` skill does not call particleCB.
- **Handling**: model the **non-burst baseline** in the main fields (`E`, `holdE`, `specialE`). Put the burst-state behavior in `_unmodeled` with specific numbers so a reviewer knows the exact modification.

**R17** — **HP / state-conditional emissions**:
- **Wriothesley**: particleCB only fires when `skillBuffActive()` (skill + HP > 50%).
- **Handling**: model the condition-satisfied case in the main fields. Put the condition in `_unmodeled` (e.g., "Only emits when HP > 50% — rotations that drop below lose procs").

---

## Output format (v2 schema recap)

These examples follow the notes discipline: no prose restating what the values already say.

```jsonc
{
  "bennett": {
    "element": "Pyro",
    "source": "gcsim",
    "E":     { "particles": [[2, 1.0], [1, 0.25]] },
    "holdE": { "particles": 3 }
  },
  "fischl": {
    "element": "Electro",
    "source": "gcsim",
    "periodic": {
      "E": { "procs": 7, "particles": [[1, 0.67]],
             "notes": "procs=7 assumes typical 15s rotation; Oz 10s lifetime caps at 10 ticks at full uptime" }
    }
  },
  "hu_tao": {
    "element": "Pyro",
    "source": "gcsim",
    "NA": {
      "pattern": [[[2, 1.0], [1, 0.5]], 0, 0],
      "notes": "Cycle length 3 assumes NA cadence ~1.5s against 5s particle ICD; only emits while Paramita buff active (~9s)"
    },
    "_unmodeled": [
      "CA shares the same 5s particle ICD — CA-heavy rotations consume the ICD window without adding procs"
    ]
  },
  "klee": {
    "element": "Pyro",
    "source": "gcsim",
    "E": { "particles": 4 }
  },
  "cyno": {
    "element": "Electro",
    "source": "gcsim",
    "E":        { "particles": 3 },
    "specialE": { "particles": [[1, 1.0], [1, 0.33]],
                  "notes": "Only usable during Pactsworn burst state" }
  },
  "nahida": {
    "element": "Dendro",
    "source": "gcsim",
    "E": { "particles": 3 },
    "periodic": {
      "E": { "procs": 1, "particles": 3,
             "notes": "Tri-Karma fires on Karma'd enemy; 7s particle ICD caps at 1 proc per 15s rotation" }
    }
  },
  "gaming": {
    "element": "Pyro",
    "source": "gcsim",
    "PA": { "pattern": [2],
            "notes": "Per-plunge during Wushou Stance; no ICD chain" }
  },
  "noelle": {
    "element": "Geo",
    "source": "gcsim"
  }
}
```

### Particles value shorthand

- Integer `N` = deterministic N particles (shorthand for `[[N, 1.0]]`).
- `[[count, chance], ...]` = list of independent rolls.
- `min` = sum where chance == 1.0; `max` = sum of all counts; `expected` = sum of count×chance.

Prefer the integer shorthand when the distribution is deterministic.

---

## Style

### `notes` is for caveats, NOT for explaining the data

The `notes` field exists to surface assumptions, caveats, and corner cases a reviewer needs to know. It is NOT a prose restatement of what the JSON values already say.

**Bad notes** (delete these — the data already says everything):
- `"pressParticleCB: 2 guaranteed + 25% chance of 1 more (skill.go:130-134)"` — the `[[2,1.0],[1,0.25]]` value already expresses this.
- `"deterministic 3 (skill.go:242)"` — the value `3` says it.
- `"Obsidian Tzitzimitl initial hit fires particleCB once"` — a correctly-modeled E emission doesn't need narration.
- `"makeParticleCB() closure with done-flag shared across all bounce attacks; fires exactly once per cast"` — `E: 4` with no notes is enough.

**Good notes** (keep these — they add information not in the data):
- `"Only during Paramita buff (9s); bounded by NA cadence"` — a constraint on when the data applies.
- `"procs=7 assumes typical 15s rotation; Oz extends to 12s at C6"` — the reasoning behind a choice the reviewer might second-guess.
- `"Wielder must be on-field during Nightsoul state"` — a gameplay prerequisite not captured in the per-cast data.
- `"pattern cycle assumes NA cadence ~0.5s; CA-heavy rotations fire less often"` — an assumption driving the pattern length.

**Rule**: if the `notes` string is paraphrasing the `particles` / `pattern` / `procs` values, delete it. If it's telling the reviewer something the JSON values don't already convey, keep it.

### `_unmodeled` is for things the schema cannot express

- Constellation-gated particle effects (C2/C6 adjustments).
- Ascension passive particle effects (rare).
- State-dependent counts that can't be captured in a single `particles` shape (Beidou counter, Heizou stacks).
- Shared ICDs across multiple emission sites (Hu Tao NA+CA shared 5s ICD).
- Schema gaps noted explicitly for future review.

Simplifications per S1-S7 should NOT appear in `_unmodeled`.

### Classification tiebreakers

- If unsure between direct (`E`/`holdE`) vs `periodic.E`: pick the one that matches user experience. Does casting E emit particles once (direct) or trickle them in (periodic)?
- If unsure between `NA.pattern` vs `periodic.E` for infusion chars: use `NA.pattern` (per R11). `periodic.E` is for deployables only.
- When Fandom/Lunaris diverge from gcsim, trust gcsim's Go code.

### Escape hatch

If after reading the code you genuinely cannot classify a mechanic with confidence:
1. Pick the closest category from the allowed fields.
2. Emit with a `notes` entry that explicitly says "Best-effort classification; see _unmodeled".
3. Add a detailed `_unmodeled` entry describing the mechanic, why it's unclear, and what a reviewer should check.

Never emit silently-wrong data to avoid flagging ambiguity — we prefer explicit uncertainty over false confidence.

## Done

After processing all assigned characters, write:
```
scripts/out/particles.gcsim.batch_<N>.json
```

Then report in a single short message:
- Count of characters processed
- Count of entries with `_unmodeled` notes
- Any characters that were ambiguous or required assumptions (with brief explanation)
