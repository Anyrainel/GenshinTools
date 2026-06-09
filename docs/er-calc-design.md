# ER Calculator — Design Document

> The definitive design reference for the Energy Recharge calculator under `src/lib/ercalc/` and `src/data/ercalc/`. Aimed at AI agents extending the system; describes what the system is supposed to be, not every detail of how it is currently implemented. When implementation disagrees with this document, the document wins unless the difference is explicitly called out below.

---

## 1. Purpose

The ER calculator answers one question per character in a team:

> **"What ER% does this character need to execute this rotation?"**

The user builds an explicit *event timeline* for a 4-character team. The calculator deterministically traces every point of energy — where it comes from, who absorbs it — and solves for the minimum ER% per character whose burst appears in the timeline.

The output is an ER% *requirement*, which is then compared against the character's real-time ER% stat elsewhere in the app (artifact builder, team optimizer). The calculator itself never reads the character's actual ER% stat; see §3.

---

## 2. Design Principles

### 2.1 Events, not time

gcsim simulates combat at frame granularity with an RNG seed. We do not. Our input is a **deterministic event timeline** — a list of discrete combat events a player understands (`E`, `Q`, `NA`, `wait`, …). Time is never modeled. Particle travel is approximated by the *next-action absorber* rule (§5.3). Periodic deployment duration is replaced by an editable proc count (§6.2).

This buys two things: every point of energy is traceable to a node on the timeline (visualizable), and identical inputs always produce identical outputs (comparable across runs).

### 2.2 Deterministic inputs, automated averaging of randomness

The timeline is deterministic, but the game contains real randomness: extra-particle probabilities, Favonius CRIT procs, ICD-gated infusion hits, weapon reaction triggers. We push that randomness into the *data layer* (as probability distributions) and **auto-compute a best-guess placement** onto the timeline at load time. The user may then override anything manually.

Concretely:
- Particle counts are stored as lists of independent rolls; `min` / `expected` / `max` are derived, not heuristically inferred (§8).
- Favonius procs are auto-placed onto the first *N* E/Q nodes of the wielder, where *N* is derived from refinement.
- Reaction-trigger weapon procs are surfaced on the wielder's E/Q nodes with a user-togglable "did it react here?" flag and clearly labeled with the required reaction + energy refund.
- Periodic generators (Oz, Guoba, Raiden Eye, Stele) auto-attach their default proc count to the first on-field action after their summon is placed; the user re-positions or re-counts.

Our automation is currently weak in places (e.g. Scholar 3s CD, NA infusion ICDs). Improving automation accuracy is the main direction of ongoing work; the design accommodates this without requiring users to eyeball every node.

### 2.3 User-togglable flags for conditional events

For events that *genuinely* depend on something outside the action space (player timing, enemy state, which reaction is active), the resolution is always:

1. Pick a sensible default at auto-placement.
2. Let the user override it per-node, with a clear label on the toggle.

Current flags on `TimelineAction`:

| Flag | Meaning | Default |
|---|---|---|
| `favoniusProc` | Did a Favonius CRIT proc fire at this node? | Auto-on for the first *N* eligible E/Q of a Favonius wielder |
| `reactionProc` | Did the wearer's E/Q trigger the weapon-required reaction? | Off; shown only when the wearer holds a reaction-trigger weapon |
| `energyGrants` | User-defined flat/scalable energy delivered at this node | None |

This pattern is the canonical answer for future conditional mechanics. Prefer a per-node flag over a global toggle or a hidden heuristic.

### 2.4 Compensation via `grantEnergy`

Any energy source we have not modeled — an unreleased weapon, an obscure passive, an enemy orb drop, a manual "assume this consumable" scenario — can be added as a `grantEnergy` node. This prevents the calculator from being blocked by missing data and gives users an escape hatch for edge cases.

---

## 3. Scope

### 3.1 Permanently out of scope

- **Time / frames.** No frame counts, no travel delay, no ICD timers expressed in seconds. ICDs are baked into data shapes (NA hit-pattern cycles, periodic proc counts).
- **ER% stat scaling.** We compute ER *requirement*. The character's current ER stat belongs to the damage calculator / team optimizer, which consume our output. Internally we work in "energy at 100% ER" + "flat energy" and solve symbolically.
- **Sub-event granularity.** The timeline is the user's mental model of combat. Never model events finer than what the user inputs — no internal "hit 3 of NA chain triggers ICD reset" logic exposed in the action space. Data layer may encode these as patterns; the action space stays at the user's level.
- **Damage.** Owned by `dmgcalc/`. The ER calculator does not read or derive damage numbers.

### 3.2 In scope, currently incomplete

- NA/CA/PA per-hit particle patterns for infusion characters.
- Some newer weapons, artifact sets, and character passives.
- Automated placement quality for multi-proc periodic generators under short rotations.
- Reaction auto-detection from team composition (currently manual `reactionProc` toggle).

### 3.3 Abstraction ceiling

Someday we may add an "easy mode" that synthesizes a timeline from higher-level intent (e.g. "standard rotation"). Such a layer **must produce** a concrete user-level event timeline and feed the same engine — it does not bypass the event model.

---

## 4. Energy Model

### 4.1 Three energy categories

Everything that charges a burst falls into exactly one:

| Category | ER%-scaled | Example |
|---|---|---|
| **Particle energy** | Yes | Bennett E particles, Fischl Oz periodic |
| **Flat energy** | No | Venti A4 (15 on Q end), Bennett C1 (15 per resonance), Prototype Amber (per tick), artifact 4pc restores |
| **Scalable (percent) energy** | Yes, linearly | Sara C2 (2.1 energy per particle at 100% ER), orb drops |

Orbs = particles × 3. Modeled via `grantEnergy` nodes (§5.4), not as a first-class type.

### 4.2 Element match & field multipliers

Applied to particle energy only:

| Affinity | Particle → base energy |
|---|:---:|
| Same element as absorber | 3.0 |
| Different element | 1.0 |
| Clear (no element) | 2.0 |

| Party size | Off-field multiplier |
|:---:|:---:|
| 4 | 0.60 |
| 3 | 0.70 |
| 2 | 0.80 |
| 1 | 1.00 |

### 4.3 The core equation

For each character with a burst in the rotation's collection window:

```
Flat + Scalable × (ER / 100) + Particles_at_100ER × (ER / 100)  ≥  BurstCost
```

which gives

```
Required_ER%  =  max(100,  (BurstCost − Flat) / (Particles_at_100ER + Scalable)  × 100)
```

The 100% floor is the game's hard minimum. "Collection window" is mode-dependent (§7).

---

## 5. The Event Timeline

### 5.1 Structure

```ts
interface ERTimeline {
  actions: TimelineAction[];  // ordered main track — what the player does
  periodic: PeriodicProc[];   // background particle procs pinned to actions
}
```

The user can maintain up to **two** timelines per team:

- **Startup (启动轴)** — the first rotation from an initial energy state (usually 0).
- **Repeat (循环轴)** — the steady-state rotation cycling forever.

If only one is provided, it plays both roles (see §7).

### 5.2 Action space

| Action | Produces particles | Notes |
|---|:---:|---|
| `E` | ✓ | Skill press |
| `holdE` | ✓ | Falls back to `E` data if unspecified |
| `specialE` | ✓ | Enhanced/alternative variant (Cyno burst-mode, Freminet L4) — freely interwoven |
| `Q` | ✕ | Drains burst cost |
| `specialQ` | ✕ | Alternative burst variant with a different cost (Flins, Varesa) |
| `NA` / `CA` / `PA` | ✓ (only for infusion chars) | Resolves via per-hit pattern |
| `wait` | ✕ | Keeps current char on-field — controls who absorbs the previous particle event |
| `grantEnergy` | ✕ | User-defined energy delivery; see §5.4 |

Background particles from Oz, Guoba, Raiden Eye, Stele, etc. are **not actions**. They are `PeriodicProc` entries pinned to a main-track action index:

```ts
interface PeriodicProc {
  sourceChar: string;     // who generates the particles
  trigger: "E" | "Q";     // which of their casts spawned this proc
  targetIndex: number;    // which main-track action absorbs it
}
```

### 5.3 Particle absorption

Particles generated by an action are absorbed by whoever is on-field at the resolution point. On-field is derived from "who acted most recently":

```
[Bennett E] [Xiangling Q] [Xingqiu E]   →   on-field: Bennett, Xiangling, Xingqiu
```

Resolution rules:

- A **main-action** particle emission is absorbed by the character at the *next* action in the timeline.
- A **`wait`** node keeps the previous character on-field — the point of `wait` is to self-absorb your own particles.
- A **periodic proc** is absorbed by the character performing the action at `targetIndex`.
- At the end of the repeating timeline, particles wrap to the first action.
- All 4 team members receive the particles each event; absorber gets the on-field rate, others get the off-field multiplier.

### 5.4 `grantEnergy` — the compensation event

A user-placed node that delivers energy not otherwise modeled. Three grant types coexist on one node:

| Grant type | ER%-scaled | Use |
|---|:---:|---|
| Flat | No | Unmodeled weapon/passive effects; "assume this food buff" |
| Percent | Yes | "Full refund" mechanics |
| Orb | Yes | Enemy orb drops (same math as particles × 3) |

This is the primary extension point for users — anything the engine doesn't automate yet can be expressed here without code changes.

---

## 6. Energy Sources

### 6.1 Character particles

Per-character data in `src/data/ercalc/particles.json` (v2 schema, §8). Covers direct emission (E/holdE/specialE), infusion hit patterns (NA/CA/PA), and periodic generation (summons, constructs, coordinated attacks).

### 6.2 Character flat & scalable energy

Per-character data in `src/data/ercalc/selfEnergy-<region>.json`, extracted from kit descriptions (kit text is authoritative; we use LLM agents to extract structured entries, then hand-verify).

Shapes currently supported:

- Flat amount, per-action, with optional `minC` constellation gate.
- Percent refund of burst cost.
- ER-scaling bonus (`per100` energy per 100% ER, optional max).
- Per-proc parameterized by talent level.

Target scope includes Raiden P2 party energy, Venti A4, Bennett C1, Sara P2 / C2, Dori P2, Fischl C1, etc.

### 6.3 Weapon energy

Code-defined in `src/lib/ercalc/weaponEnergy.ts`. Small, growing list. Each entry is one of:

- **Particle**: on-CRIT clear-particle generation (the 5 Favonius weapons). Auto-placed on E/Q with refinement-scaled default proc count.
- **Flat energy** with a trigger: `burst` | `skill` | `heal` | `reaction` | `partyPlunge`. Fires at the relevant action node of the wearer (`heal` fires at the wearer's `healAction`, which is `E` or `Q` per `charInfo.healAction`; `reaction` requires the user's `reactionProc` flag).

Weapons with pure stat buffs (ATK%, ER%, DMG%) are *not* in scope here — those belong to the damage calculator.

### 6.4 Artifact set energy

Per-set code in `src/lib/ercalc/artifactEnergy.ts`, one implementation per set. Each set exposes a narrow hook interface:

```ts
interface ArtifactEnergyImpl {
  setId: string;
  onAction?(ctx): ArtifactFlatEvent[];          // fires at a wearer action
  onParticleGain?(ctx): ArtifactFlatEvent[];    // fires when the wearer gains a particle
}
```

Each hook can emit flat-energy events to self / partyOthers / whole party. Per-wearer bookkeeping (e.g. CD approximation) lives in a scratch map handed to every hook call. Current sets modeled: **The Exile 4pc**, **Scholar 4pc**. Adding a set = one new impl file entry.

The per-set pattern exists because every artifact set's mechanic is unique; a shared config schema would add friction without reducing code volume.

### 6.5 Enemy drops

Currently expressed by the user as `grantEnergy` orb events. There is no global "enemy particle preset" dropdown; that pattern proved less useful than letting users place specific events on the timeline.

---

## 7. Calculation Modes

Given the timeline(s), each character gets a **collection window** — the slice of the rotation whose energy charges their binding burst. Three modes answer three player questions:

| Mode | Starting energy | Question | Collection window |
|---|:---:|---|---|
| `zero-energy-start` | 0 | Can I get the first burst off? | All events before each char's first Q across startup + repeat |
| `full-energy-repeat` | Full | Can I sustain bursting forever? | Events between consecutive Q casts in the repeat timeline, wrapping |
| `zero-energy-repeat` | 0 | Can I get going *and* sustain? | `max(start, repeat)` per character |

Single-timeline case: the one timeline plays both roles. Characters with no Q in the window have no ER requirement (result is marked `hasQ: false`).

The Q that determines a character's ER is the **binding Q**. The UI highlights it with a yellow ring. Per-event breakdowns are returned relative to the binding Q's window.

---

## 8. Particle RNG

### 8.1 Why lists of rolls

Genshin's particle generation is a sum of independent probabilistic rolls (`rand.Float64() < p` in gcsim). Storing the raw rolls lets min/expected/max fall out of the data without inference:

```ts
type Particles = number | Array<[count: number, chance: number]>;
// min      = Σ count where chance == 1.0
// expected = Σ count × chance
// max      = Σ count
```

Examples:

| Raw | Meaning |
|---|---|
| `3` | Deterministic 3 particles |
| `[[2, 1.0], [1, 0.25]]` | Always 2, plus 25% of a 3rd (Bennett E) |
| `[[1, 0.67]]` | 67% of 1 particle per tick (Fischl Oz) |
| `[[1, 0.8], [1, 0.8], [1, 0.8], [1, 0.8], [1, 0.8]]` | 5 independent 80% rolls (Diona) |

### 8.2 User-selectable mode

The UI exposes `min` / `expected` / `max`. The engine computes all three; the selected mode is just the value displayed and used for the ER solve. Min is "never fail", expected is "typical", max is "best luck".

---

## 9. Data Layer

The ercalc system pulls from four kinds of source:

| Concern | Location | Shape | Why |
|---|---|---|---|
| Character particles | `src/data/ercalc/particles.json` (+ `particles.fandom.json`, `particles.gcsim.json`, `particles.lunaris.json` as cross-references) | JSON, v2 schema (§8) | Particle logic only exists in engine code / community data; must be learned from gcsim or Fandom |
| Character flat/scalable energy | `src/data/ercalc/selfEnergy-<region>.json` | JSON per entry (§6.2) | Described in kit text; extractable by LLM agents |
| Character metadata (burst cost, `healAction`, etc.) | `src/data/charInfo.ts` | TS, auto-generated by `scripts/gen_char_info.py` | Shared with rest of app |
| Weapon / artifact energy | `src/lib/ercalc/weaponEnergy.ts`, `artifactEnergy.ts` | TS code | Few instances, each unique; code is more flexible than config |

Character data is the surface where drift matters most — it covers ~130 characters. Weapons and artifacts are fewer and bespoke; code suits them. Over time a weapon/artifact entry *may* move to config, but the decision is driven by friction, not principle.

### 9.1 `particles.json` schema (v2)

```jsonc
"<charId>": {
  "element": "<Element>",
  "spawnPoint"?: "Character" | "Enemy" | "Construct",
  "source"?: "fandom" | "gcsim" | "lunaris" | "manual",

  // Direct emission on cast
  "E"?:        { "particles": Particles, "notes"?: "..." },
  "holdE"?:    { "particles": Particles, "notes"?: "..." },
  "specialE"?: { "particles": Particles, "notes"?: "..." },

  // Infusion hit patterns (cyclic, indexed by the char's i-th hit of this type)
  "NA"?: { "pattern": Particles[], "notes"?: "..." },
  "CA"?: { "pattern": Particles[], "notes"?: "..." },
  "PA"?: { "pattern": Particles[], "notes"?: "..." },

  // Off-field generators
  "periodic"?: {
    "E"?: { "procs": number, "particles": Particles, "notes"?: "..." },
    "Q"?: { "procs": number, "particles": Particles, "notes"?: "..." }
  },
}
```

`procs` is a UX default: when the trigger action is added to the timeline, the UI auto-places that many periodic procs pinned to the most plausible absorbing actions. The user is expected to reposition or re-count as the rotation demands.

### 9.2 `selfEnergy-*.json` entry shape

```ts
interface SelfEnergyEntry {
  source: string;        // human-readable source (e.g. "Venti A4")
  action: string;        // anchor action (Q, E, periodic, etc.)
  amount?: number;       // flat energy
  percentRefund?: number; // % of burst cost
  erScale?: { per100: number; max?: number };
  target: "self" | "party" | "partyOthers";
  minC: number;          // constellation gate
  procs?: number;        // how many procs per anchor fire
  param?: { source: "talent"; index: number; multiplier: number };  // talent-scaled
}
```

### 9.3 Data provenance for particles

We maintain three datasets:
- `particles.fandom.json` — scraped from Fandom wiki averages; broad coverage, approximate.
- `particles.lunaris.json` — pulled from Lunaris datamine; full per-event probability distributions.
- `particles.gcsim.json` — extracted from gcsim's Go source; authoritative where available.

`particles.json` is the live file consumed by the engine, assembled from the three with manual review. Disagreements are resolved in favor of gcsim > lunaris > fandom, with spot-checks against observed game behavior. The engine never reads multiple sources at runtime.

---

## 10. Engine Architecture

High-level pipeline (all synchronous, deterministic):

```
 (team, startup?, repeat?, options)
        │
        ▼
 assemble collection window per calc mode  ──────────────────┐
        │                                                     │
        ▼                                                     │
 simulate(window) :                                           │
   for each action[i]:                                        │
     1. fire periodic procs whose targetIndex == i            │
     2. resolve direct particles (E/holdE/specialE/NA/…)      │
     3. distribute particles via next-action absorber rule    │
     4. collect flat-energy events at this node:              │
          - self-energy (charInfo + selfEnergy-*.json)        │
          - weapon flat triggers (weaponEnergy.ts)            │
          - artifact 4pc onAction hooks (artifactEnergy.ts)   │
          - user grantEnergy                                  │
     5. if action is Q / specialQ: close current window       │
        │                                                     │
        ▼                                                     │
 per-character totals: flat, scalable, particles@100ER  ──────┘
        │
        ▼
 solve ER requirement + record bindingQIndex + bindingEvents
```

Everything else (rotation hints, wait-block optimizer) is a consumer of this pipeline, not part of it.

---

## 11. UI Responsibilities

The UI is not part of this design doc's authoritative scope, but these behaviors *are* load-bearing on the design:

- Must render the timeline as discrete, user-mutable event nodes. One row per team member is the current presentation; a single scrolling track is acceptable.
- Must surface per-node energy contributions on hover/tap (the `bindingEvents` breakdown).
- Must visualize the absorber relationship (arrow from emitter to absorber) for particle events.
- Must expose per-node toggles for `favoniusProc` and `reactionProc` only when the wielder's weapon makes them relevant, with labels showing *what would happen* if toggled on (reaction name, energy refund amount at the current refinement).
- Must allow adding `grantEnergy` nodes with flat / percent / orb grant types.
- Calculation mode, particle RNG mode, and the two-timeline toggle are global per-team controls.

---

## 12. Extending the System

### 12.1 Adding a new character
1. Add a `particles.json` entry with sourced rolls.
2. Add a `selfEnergy-<region>.json` entry if the kit grants flat/scalable energy.
3. Regenerate `charInfo.ts` (sets `energy`, `healAction`, healer/shielder flags). Add to `HEAL_ACTION` in `gen_char_info.py` if E-anchored healing.

### 12.2 Adding a new weapon
Add an entry to `weaponEnergy.ts`. Pick `effect: "particles"` (on-crit) or `effect: "flatEnergy"` with a trigger. For `reaction` trigger, supply `reactionCondition: { en, zh }` — the UI uses it to label the toggle.

### 12.3 Adding a new artifact 4pc
Add an `ArtifactEnergyImpl` to `artifactEnergy.ts` with `onAction` and/or `onParticleGain` hooks. Use the scratch map for any per-wearer state (CD counters, stack counts).

### 12.4 Adding a new conditional mechanic
If the mechanic depends on in-combat state the timeline can't know, add a `TimelineAction` flag (like `favoniusProc` / `reactionProc`) and surface it in the node popover with a clear description of what the toggle does and how much energy it's worth.

---

## 13. Relation to gcsim

We are **deliberately** less precise than gcsim in exchange for interpretability, determinism, and speed:

| | gcsim | this calculator |
|---|---|---|
| Time model | Frame-precise | None — event-based |
| RNG | Monte Carlo | Deterministic (min/expected/max as distribution aggregates) |
| Particle travel | 100-frame delay | Absorber rule |
| Output | Damage + energy profile | ER% requirement per character |
| Input | Config script | Visual timeline |

Expected agreement: within a few percent on well-structured rotations, larger on rotations with many short-CD ICD-gated effects. Closing that gap is a function of automation quality (§2.2), not of adding more runtime simulation.

---

## 14. Open Design Questions

1. **Reaction auto-detection.** `reactionProc` is a manual toggle today. A team-composition-aware heuristic (e.g. "Raiden holds Lumidouce + team has Dendro + Pyro → auto-enable on Raiden E") could auto-set the default without removing the override.
2. **Scalable energy ceiling.** Sara/Dori `erScale.max` caps the energy at a given ER%. How do we solve when the cap binds? Currently we compute both unconstrained and constrained roots and take the valid one; an explicit solver would be cleaner.
3. **Periodic proc re-distribution under timeline edits.** When the user deletes or reorders actions, periodic procs pinned to `targetIndex` may point to a now-implausible absorber. We currently leave the user to fix this; automated re-placement on edit is an open question.
4. **Artifact 4pc CD modeling.** Per-set hooks have a scratch map for CD state, but there is no shared time model, so CDs are approximated by "fires at most once per *N* action indices". Acceptable for Scholar; some future set may demand better.
