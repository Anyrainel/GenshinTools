# ER Calculator — Path to GA

> Companion to `docs/er-calc-design.md` (which describes the intended system) and
> `docs/er-calc-review-zh.md` (the mechanism review). This document records the audit
> findings, the fixes already landed, and the phased plan to take the energy calculator
> to general availability.
>
> Audit date: 2026-08-13. Method: 7 parallel audit lenses (core engine, energy sources,
> the time-based model, game-mechanics ground truth, data layer, rotation tooling/UX,
> external community research), each adversarially verified against the source, then
> synthesized. 14 findings were refuted on verification and are listed in §6.

---

## 1. The model decision

**Keep the event-based engine (`erCalculator.ts`) as the single model. Retire the
time-based one. Add a minimal ordinal-time *feasibility* layer on top of the event axis.**

The event model's physics is already right and matches gcsim's `energy.go`, the canonical
Chinese community formula, and KQM's tables line for line: `SAME_ELEMENT_PARTICLE 3.0 /
DIFF 1.0 / CLEAR 2.0`, `ORB_MULTIPLIER 3`, `OFF_FIELD_MULTIPLIER = 1 - 0.1 × partySize`
([constants.ts:80](../src/lib/ercalc/constants.ts:80)), ER scaling particles and
explicitly-scaling sources only, a 100% floor, and per-Q windows that correctly model the
energy cap plus drain-to-zero ([erCalculator.ts:1178](../src/lib/ercalc/erCalculator.ts:1178)).
Every defect found is in the layers *around* that core, not in the model.

The time-based `redesignedCalculator.ts` is not a competing model, it is a worse one: it
folds the producer's field state into a per-producer scalar and reuses it for every
recipient, so **no character can ever be credited on-field absorption of another
character's particles** — precisely the cast-and-swap battery pattern the tool exists for.
Fixing that means rewriting it into the event model. See §5.

But the event engine has quietly grown a seconds clock anyway
([erCalculator.ts:1185](../src/lib/ercalc/erCalculator.ts:1185), duplicated at `:1131`
and [optimizer.ts:118](../src/lib/ercalc/optimizer.ts:118)) that gates weapon cooldowns
and Favonius procs, while design doc §3.1 declares time "permanently out of scope".
Denying time while depending on it is the worst of both worlds. **Declare the clock,
normalize it against an authored rotation duration, and use it only as a feasibility
constraint — never as a simulation clock.**

---

## 2. Fixes already applied

All verified against official game data (`impl_audit.py`, `weapon_en.json`) and covered by
new regression tests in `tests/lib/ercalc/energyDataIntegrity.test.ts`.

| # | Fix | File |
|---|---|---|
| F1 | **`erScale` paid nothing at 100% ER.** Formula used `(ER-100)/100`; kits worded "restore X Energy for every 100% Energy Recharge" pay the full X *at* 100%. Every Sara and Dori team overstated ER for the whole party. | [erCalculator.ts:318](../src/lib/ercalc/erCalculator.ts:318) |
| F2 | **Venti A4 encoded twice**, second entry `target: "party"` which includes Venti → 30 energy on a 60-cost burst, plus 15 spurious to each teammate. | [selfEnergy-mondstadt.json](../src/data/ercalc/selfEnergy-mondstadt.json) |
| F3 | **Angelos' Heptades registered as `seven_edicts_of_dust_and_light`**, an id that does not exist → 14–18 energy silently never fired. | [weaponEnergy.ts:269](../src/lib/ercalc/weaponEnergy.ts:269) |
| F4 | **Optimizer bailed out whenever any character was unsolvable** — exactly the zero-energy startup case where users need it. `scoreLess` already handles Infinity lexicographically. | [optimizer.ts:202](../src/lib/ercalc/optimizer.ts:202) |
| F5 | **`partyPlunge` weapon cooldown charged to the plunger, not the wearer** → alternating plungers bypassed the CD entirely, and the plunger's own weapon timestamp was clobbered. | [erCalculator.ts:823](../src/lib/ercalc/erCalculator.ts:823) |
| F6 | **Desert Sages / Rightful Reward refinement scaling wrong** — `[8,9,10,11,12]`, actual is `[8,10,12,14,16]`. | [weaponEnergy.ts:176](../src/lib/ercalc/weaponEnergy.ts:176) |
| F7 | **ER team picker offered 14 Manekin ids with no particle data**, silently defaulting to Anemo (a 3× element-multiplier error) and then getting filtered out, shrinking party size. | [TeamSetup.tsx:14](../src/components/team-comp/TeamSetup.tsx:14) |
| F9 | **Redesigned view recommended sub-100% ER** — the shipped default example recommends 85%, not a reachable stat. | [redesignedCalculator.ts:271](../src/lib/ercalc/redesignedCalculator.ts:271) |
| F10 | **Two element-less characters compared equal** (`"None" === "None"`) and batteried each other at the same-element rate → ~1.8× understatement. | [redesignedCalculator.ts:220](../src/lib/ercalc/redesignedCalculator.ts:220) |
| F11 | Easy Mode rendered raw `snake_case` ids instead of `t.character(...)` — unreadable in zh next to a localized timeline. | [ErCalcCard.tsx](../src/components/team-comp/ErCalcCard.tsx) |
| F12 | Dead `qWindowCount`/`firstQSeen` pre-pass, computed and never read. | [erCalculator.ts:894](../src/lib/ercalc/erCalculator.ts:894) |
| F13 | NA pity doc comment: polearm `~7.04` hits → `~6.95`. | [constants.ts:130](../src/lib/ercalc/constants.ts:130) |

**Not applied — F8** (Easy Mode wipes cast counts and driver on every timeline change,
including its own compile, because the effect is keyed on a `useMemo` array identity). Real
and confirmed, but the fix is a merge-instead-of-replace state reconciliation, not a local
edit. Folded into Phase 3.

### Product decisions taken (2026-08-13)

| Decision | Consequence |
|---|---|
| **Particle modes are `expected` + `max` only.** Expected = a smooth run; Max = willing to retry until the ideal roll. | `min` is deleted rather than fixed. **This cancels B19's percentile work** — that proposal existed only to replace a degenerate `min`. Persisted `min` migrates to `expected`. |
| **The calculator never reads a real ER stat.** ER-scaling passives assume the wearer is built for ER; evaluate at **250%**. | Keeps design doc §3.1 intact and avoids a fixed point (a character's requirement depending on its own solved requirement). Source-scaled terms resolve to a constant and file as *flat*. Named constant, easy to expose later. |
| **Enemy orb drops stay at zero + manual placement.** | Status quo. A KQMS-style default would silently lower every number. |

### Phase 0/1 work landed

- **Golden corpus** — `tests/lib/ercalc/erGoldens.test.ts`: 6 canonical teams × 3 scenarios × 2
  particle modes = 36 solved-ER snapshots, plus two invariants (never below the 100% floor;
  a repeating rotation is never *easier* than one pass). Timelines auto-place periodic procs
  via the same `autoPlacePeriodic` the UI calls, and preload character stats — without the
  preload `getTalentParam` throws, `resolveParamAmount` swallows it, and every talent-scaled
  source (Raiden's Musou restore, Dori A4, Durin) silently contributes zero.
- **B3 — burst refunds no longer fund their own burst.** The burst checkpoint now closes
  *before* `emitFlatEventsAt`. Particles still resolve first (catch, then burst); only
  post-cast flat refunds move to the next window. Goldens were unmoved, confirming the
  audit's prediction that this cancels in steady state and is only wrong in scenarios (1)
  and (2).
- **B1 — per-hit energy sources capped.** An `"A"`-anchored entry is now a per-hit effect
  whose `procs` is a *cap on triggering hits*, not a trigger that enqueues `procs-1` ticks.
  Previously it fired *and* enqueued at every attack node while the drain paid a tick out of
  every live queue entry, compounding as `amount × N(N+1)/2`. `E`/`Q`-anchored multi-proc
  entries keep the spread-over-following-attacks behaviour.

- **B4 — pseudo-nodes no longer capture particles.** `getAbsorber` scans past
  `enemyOrb`/`grantEnergy` (which put nobody on field, and whose `char` the UI pins to team
  slot 1) to the next real action, preserving the wrap and self-absorb fallbacks. The same
  skip now guards NA-pity swap detection.
- **B5 — `target: "active"` resolves at delivery.** A queued active-targeted tick pays
  whoever is on field when it *lands*, not the caster. This only moves *queued* procs, so it
  depended on the B2 data half below to actually bite.
- **250% battery assumption + B7 for free.** `erScale` terms now resolve to a constant at
  `ASSUMED_BATTERY_ER`, and capping at resolution makes the cap **per cast**, which is what
  the kits say — the old code summed every proc into one bucket and capped the rotation
  total. Note the assumption is *conservative* for characters whose requirement exceeds
  250%: the old recipient-ER scaling credited them more, so Sara/Dori numbers went up.
- **Raiden A4 modelled.** New `erMultiplier: { perPercentOver100 }` entry shape, distinct
  from `erScale` (a multiplier on an amount, not the amount itself). At 250% that is
  `1 + 0.006 × 150 = 1.9×`, taking Musou Isshin from 2.5 to 4.75 per proc. Raiden National
  moved Xiangling 333→278%, Raiden 400→341%, Bennett 197→150% — all toward community values.
  **Correction to the audit:** it claimed Raiden's entry should be `partyOthers`. Official
  text says "regenerate Energy for all nearby party members" with no exclusion, and the same
  kit writes "(excluding the Raiden Shogun herself)" elsewhere when it means to. `party` is
  correct and was left alone.

Each behavioural fix was verified by temporarily restoring the old code and confirming the
new tests fail — a guard that does not fail against the defect it describes is not a guard.

- **`min` particle mode removed.** Type, resolver, NA-pity branch, UI toggle and the
  `erCalc.minEst` string are gone. The repo's own i18n test caught the orphaned key.
- **B13 — NA on-hit pity is now a renewal process.** `advanceNAPity` tracks a distribution
  over the pity counter: mass that procs returns to index 0 and keeps earning. The old code
  tracked only the first proc's survival probability, i.e. P(at least one proc) rather than
  E[procs], saturating near 1 energy per cycle. A 20-hit sword chain went 1.10 → 4.1831,
  polearm → 2.5376 — matching an independent DP to 4 decimal places.
- **B17 — the second calculator is retired.** Deleted `RedesignedErView.tsx`,
  `redesignedParser.ts`, `redesignedCalculator.ts` and its test, the `Redesigned*` types, the
  nav entry, the route, and the `redesignedEr.*` / `tabRedesignedEr` i18n blocks. Deleted
  outright rather than kept for a release — CLAUDE.md forbids dead code paths and git history
  preserves it. The three ideas worth harvesting (τ = 1.24s, `N = floor(tProd/delta) + 1`, the
  per-weapon NA energy table) are recorded in §5. `npm run depcheck` clean afterwards.

- **B2 (engine half) — multi-proc totals are now rotation-shape invariant.** Any ticks still
  queued when a burst window closes are flushed into that window. Previously a multi-proc
  effect paid out only as many ticks as there happened to be attack nodes after its trigger
  (a swap-only support rotation delivered 2 of The Exile 4pc's 6 energy), and leftovers
  survived into the next loop iteration to double-deliver. Verified invariant across 0, 1, 5
  and 12 attack nodes. **Remaining half is data**: entries that describe repeating ticks but
  omit `procs` still fire once — Dori Q (~6 ticks), albedo C1 (~7), klee C6 (~8), ayato A4.

- **B9 — element-gated party grants filtered.** New `targetElement` on `SelfEnergyEntry`,
  honoured in `resolveRecipients`. Xilonen C2's 25 Energy now reaches only Electro members,
  not every teammate plus Geo Xilonen.
- **B10 — refinement wired.** `resolveCharCtx` now resolves refinement with the same
  authored-override → account-best → R1 precedence `TeamRosterCard` uses, converting the
  stored 1-5 to the 0-4 index the energy tables are keyed by. Every weapon energy value and
  Favonius proc count previously resolved at R1.
- **B11 — Shimenawa's Reminiscence 4pc, plus three missing weapons.** Shimenawa is the only
  set that *costs* energy (-15 per skill cast) and the only omission whose sign made the tool
  optimistic. Added Song of the Vigil, Whitelake Frostfeather and Frostbreath, all verified
  against official refinement tables. Frostbreath pays *teammates*, which required a `target`
  field on `flatEnergy` — and exposed that neither `recipientId` nor `sourceChar` reliably
  identifies the wearer for cooldown bookkeeping, so `FlatEventDescriptor` now carries an
  explicit `wearerId`. The CD gate also had to be taught that one trigger legitimately emits
  one event per recipient at the same instant.
- **B2 (data half) — 17 verified `procs` counts** across all nine region files, each citing
  the official clause and its duration/interval arithmetic. Notable: albedo C1, klee C6,
  barbara C1, qiqi C1, yaoyao C2 were all firing once per rotation. `albedo` was authored at
  10 and held down to 6 — blossoms require an opponent inside the field taking damage, and
  overcounting energy is the failure mode that makes the tool bless a build that does not work.
- **B22 — the rotation linter is wired.** `analyzeRotation` had 6 passing tests and zero
  callers; `TimelineStrip` now renders its hints under the rail, localized.

**Confirmed while doing B2:** `cooldown` on a `selfEnergy` entry is *documentation only* —
the engine reads `cooldown` for weapon events but never for self-energy. That is B12's
second half, still open, and it is why several sub-rotation-interval effects were firing once.

- **B8 — Electro Resonance is reachable.** New `resonanceProc` flag distinct from the
  weapon-only `reactionProc`, its own toggle rendered whenever the party is 4 members with
  2+ Electro (real Resonance requires a full party — `hasElectroResonance` now checks that),
  and the real 5s ICD enforced against the ordinal clock. Raiden/Fischl with no reaction
  weapon previously got *zero* resonance energy while a Lumidouce wielder got a free
  ICD-less particle per skill node.
- **B12 — selfEnergy `cooldown` is live.** Declared on the type (it previously survived only
  via the index signature) and gated per `(sourceChar, sourceLabel, recipient)`. The gate
  applies to the **trigger** — whether a new proc-train may start — not to each tick, so the
  `procs` counts authored above still pay their full total.
- **B21-lite — one `actionDuration` helper**, exported from `erCalculator.ts` and consumed by
  `optimizer.ts`. The 0.5/1.0/1.5 switch had three copies.
- **B14 — the optimizer no longer destroys user data.** `removeAction` remaps orphaned
  periodic procs onto a surviving neighbour instead of filtering them out; `moveAction`
  carries them to the insertion index. Favonius realignment is scoped to candidate scoring
  and the user's per-node flags are restored on the returned timeline.
- **B15 — identity-aware objective.** Lexicographic `[infeasible, overshoot past cap,
  priority char ER, worst other, sum of others]` via an optional `objective` param, with
  today's anonymous minimax preserved when none is supplied.
- **B16 — the synthesizer emits playable rotations.** `E → (funnel wait) → Q` per phase
  instead of Q-first (the pattern this repo's own linter flags), `burstCount` honoured
  instead of silently truncated to 1, periodic procs distributed forward without wrapping
  before their own deployment, driver NAs interleaved between phases, and a derived
  character ordering replacing the hardcoded ~14-name list.
- **F8 — Easy Mode state survives.** The init effect is keyed on a stable roster identity and
  merges instead of replacing, so compiling no longer wipes the form.
- **B18 — the scenario is persisted.** `TeamEnergyConfig` gained `mode` (the documented
  three-way `CalcMode`) and `particleMode`; the two independent booleans and the degenerate
  Full+RunOnce combination are gone. Team store bumped to **v19** with a v18 migration test.
- **B20 — the data layer is validated.** `tests/lib/ercalc/data.test.ts` enforces a strict
  zod schema over every selfEnergy entry, exactly-one-of amount/percentRefund/erScale/param,
  id existence for weapons and artifact sets, particle-element coverage, no duplicate charId
  across region files, and a `cooldown`-without-`procs` heuristic with an explicit allowlist
  so it fails on *new* offenders.

**Correction to an earlier note in this document:** `kazuha` was reported as missing particle
data. That was wrong — his id is `kaedehara_kazuha` and the entry has always existed. A sweep
found no genuinely missing pickable character.

**Newly found, not yet fixed:** `resolveParamAmount` swallows the `getTalentParam` throw and
falls through to an empty `PARAM_DEFAULTS`, so if character stats fail to load, three
characters' energy silently vanishes and the tool just reports a higher requirement. Not a
live bug (production loads via the resource hook) but the same silent-zero shape as F1/F3.
Should throw or warn.

---

## 3. Confirmed defects requiring design work

Ordered by numeric impact. `S/M/L` = effort.

### Energy-model correctness

- **B1 — `"A"`-wildcard procs compound quadratically (M).** An entry with `action: "A"`
  matches every NA/CA/PA node *and* re-enqueues `procs-1` at each one, so total energy grows
  as `amount × (N + N(N-1)/2)`. Hits `wanderer` P1 (`procs: 25`) and `ororon` P2 at **C0**:
  Wanderer with 10 NA nodes emits ~44 energy against a 40-cost burst, so the tool declares
  him self-sufficient at 100% ER. *This is the largest single numeric error in the tool.*
- **B2 — multi-proc effects stranded or double-delivered (L).** `pendingProcs` drain only on
  attack nodes, never expire, never flush at window close. A swap-only support rotation
  delivers 2 of 6 Exile 4pc energy; leftovers from loop copy 1 double-deliver into copy 2.
  Direction of error depends on how many NA chips the user happened to type.
- **B3 — burst refunds fund their own burst (M).** `emitFlatEventsAt` runs before the burst
  checkpoint, so Tartaglia Q 20, Jean A4, Venti A4, Amenoma, Prototype Amber et al. pay for
  the cast that produced them. Cancels in steady-state repeat, but is fabricated energy in
  **scenarios (1) and (2)** — Tartaglia zero-start understates by ~50%.
- **B4 — `enemyOrb`/`grantEnergy` pseudo-nodes hijack the previous action's particles (S).**
  Their `char` is only a positioning anchor (hardcoded to `team[0]` by the UI), but
  `getAbsorber` returns `actions[i+1].char` unconditionally.
- **B5 — `target: "active"` is a dead alias for `"self"` (M).** Six entries (dori Q,
  ororon P2, columbina C1, traveler_electro ×3) credit the battery instead of the carry.
- **B6 — source-ER-scaled grants solved against the recipient's ER (L).** Sara's gift is
  amplified by the carry's stat, not hers. Larger: **Raiden's A4 is not modelled at all** —
  a 250%-ER Raiden delivers ~23.75 per teammate where we model 12.5. Raiden is the most-used
  battery in the game. Requires moving design doc §3.1's boundary.
- **B7 — `erScale.max` caps the rotation instead of each cast (S).** Dori's cap is explicitly
  per skill use.
- **B8 — Electro Resonance unreachable (M).** Gated behind `reactionProc`, which the UI only
  renders for reaction-*weapon* holders. Raiden/Fischl with no such weapon gets zero
  resonance energy; a Lumidouce holder gets a free particle per skill node with no 5s ICD.
- **B13 — NA pity saturates at ~1 proc per cycle (M).** `advanceNAPity` tracks only the
  *first* proc's survival probability, computing P(at least one) rather than E[procs]. Exact
  DP: 20 sword NAs give 1.10 modelled vs 4.18 true.

### Data completeness and integrity

- **B9 — element/field-gated party grants pay everyone (S).** Xilonen C2 gives every
  non-Electro teammate *and* Geo Xilonen a free 25 energy.
- **B10 — `TeamSlot.refinement` is never populated (S).** All weapon energy and Favonius proc
  counts resolve at R1. R5 Amenoma contributes 18 instead of 36. Note the index base differs
  between store (1–5) and type (0–4), so this is not a blind one-liner.
- **B11 — missing sources (M).** Critically **Shimenawa's Reminiscence 4pc *drains* 15 energy
  per skill cast and is unmodelled** — the only omission whose sign makes the tool report a
  requirement that is too *low*. Plus `song_of_the_vigil`, `whitelake_frostfeather`,
  `exaiphanes_blade`, `frostbreath` (needs a target field), Scroll of the Hero of Cinder City
  2pc (needs the hook gate widened past `4pc`), and four selfEnergy entries.
- **B12 — `conditionEn` gates nothing; selfEnergy `cooldown` is never read (M).** 58 of 88
  entries carry a condition the engine ignores (crit-gated entries assume 100% crit); 36
  carry a `cooldown` that is never consulted and isn't even declared on the type. **All
  condition errors point optimistic** — the worst bias for a tool driving artifact investment.
- **B20 — no data validation (M).** `allSelfEnergy` is a bare spread with no zod parse; a
  typo'd `target` silently resolves to `[]` and the entry vanishes. Every existing assertion
  checks intermediate accumulators rather than solved ER — which is exactly why F1 survived.

### Product surface

- **B14 — the optimizer edits the wrong timeline, scores the wrong number, and destroys user
  data (L).** Four defects in one flow: it discards the startup result and re-runs with a
  hardcoded `calcMode`; it scores `calculateTeamER` while the panel displays
  `calculateTeamERSequence`; `removeAction` **filters out** periodic procs at the removed
  index rather than remapping them, permanently deleting user-placed procs into the persisted
  store with no undo; and `alignFavoniusCDsForTeam` overwrites manual `favoniusProc` flags.
- **B15 — objective is anonymous team minimax (L).** `scoreOf` sorts character identity away,
  so it will trade the carry 115%→155% to move the worst support 205%→200%. Periodic-proc
  retargeting — the highest-leverage edit the manual UI offers — is structurally unreachable.
- **B16 — the Easy Mode synthesizer cannot produce a playable rotation (M).** It emits Q
  before E for every character, the exact pattern the repo's own `analyzeRotation` flags;
  wraps late-deployed summon ticks to before deployment; silently truncates `burstCount` to 1
  while the UI advertises 2.
- **B18 — scenario config does not persist (M).** `startEmpty`/`repeatLast`/`particleMode` are
  component-local `useState`. Reload reverts every team to scenario (3); export transmits the
  timelines but not the mode that produced the number. Full + ×Once is a degenerate two-click
  state that returns 100% for everyone with no explanation.
- **B19 — statistics make us non-comparable with every community reference (L).** `min` mode
  returns 0 particles for Diona hold-E (a ~0.003% outcome, not a planning number), leaving
  `expected` as the only usable mode — but ER_req is convex in particle count, so ER at
  expected particles is neither the expected requirement nor a success threshold. Enemy drops
  default to zero while KQMS mandates 3 clear orbs per 90s.
- **B21 — no cooldown or duration model (L).** The synthetic clock under-counts (a 15-action
  rotation is ~13 pseudo-seconds against ~20 real), so 10–14s weapon CDs are falsely
  suppressed. Because `wait` advances it and the optimizer re-runs Favonius alignment per
  candidate, **padding waits can unlock a free Favonius proc with no in-game counterpart.**
- **B22 — the rotation linter is fully implemented and wired to nothing (S).**
  `analyzeRotation` has 6 passing tests and zero callers. 35 `_unmodeled` caveats never reach
  the UI, though `conditionEn` already renders per node.

---

## 4. Phased plan

> **Status as of 2026-08-14.** Phases 0–3 and most of 5 are landed. What remains before GA:
>
> - **Phase 4 (trustworthy numbers)** — B19's percentile work was *cancelled* by the
>   product decision to ship Expected + Max only. What survives is presentation: report a
>   band rather than a bare integer, round applied `minEr` up to 5%, and render an
>   assumptions block (particle mode, start energy, which Q binds) next to the number.
> - **Phase 5 remainder** — B21 in full. A single normalized `actionDuration` helper has
>   landed, but there is still no per-character `skillCd` / `burstCd` / `summonDuration`
>   data and therefore no rotation *feasibility* constraint. This is the one real blocker
>   for auto-generating an optimal rotation: without it a solver can propose a rotation
>   that recasts a skill inside its cooldown. The optimizer objective, seed generator and
>   data-loss fixes are all in place and waiting on it.
> - **Phase 6 (gcsim validation gate)** — not started. `docs/er-calc-gcsim-validation.md`
>   is still a setup document with no recorded runs. This is what turns "closer to
>   community values" into a measurable gate, and it should block the GA label.
>
> The goldens in `tests/lib/ercalc/erGoldens.test.ts` currently sit close to community
> figures for drivers and batteries and somewhat high for off-field generators. That gap
> is the honest remaining inaccuracy and is what Phase 6 would quantify.

### Phase 0 — Stop the bleeding
Apply all `fixNow` items *(done)*. Retire the redesigned view (§5). Land
`tests/lib/ercalc/data.test.ts` with id-existence, coverage and duplicate checks, plus the
first **solved-ER goldens**.
**Exit:** one ER surface in nav; goldens for 5 canonical teams; test/type-check/lint/depcheck green.

### Phase 1 — Energy-model correctness (2 sprints)
B1, B2, B3, B4, B5, B7, B8, B13. Reconcile the three in-repo descriptions of the model
(design doc §4.3, the engine, `ErResultsPanel.tsx`) and make the doc the executable spec.
**Exit:** goldens re-baselined with written justification per changed number; no test asserts
an accumulator where a solved ER is available.

### Phase 2 — Data completeness (1–2 sprints, parallel with Phase 1)
B9, B6, B10, B11 (Shimenawa first), B12, B20.
**Exit:** every selfEnergy entry zod-validates; no entry carries a field the engine ignores;
a `cooldown`-without-`procs` entry fails CI.

### Phase 3 — The three scenarios, made first-class (1–2 sprints)
B18 + F8. Replace the two booleans with the documented three-way `CalcMode`, route the
*results* path through it (today only the optimizer sees it), persist `mode` + `particleMode`
in `TeamEnergyConfig` with a store version bump and migration test.

**This is the differentiator.** Every competing tool answers only the steady-state question:
KQM's sheets compute "ER to loop every burst", gcsim amortizes startup away over a
KQMS-mandated 90s run. Nobody presents warmup-versus-loop. Our two-axis model already
computes both — collapsing them to `max` throws the feature away. Show
**"startup 210% / sustain 165%"** side by side, keyed off `simulateSequence`'s
`source.kind`.

**Exit:** all three scenarios selectable, persisted, exported, shared; reload reproduces the number.

### Phase 4 — Trustworthy numbers (1–2 sprints)
B19: percentile particle statistics via exact Poisson-binomial convolution over the stored
roll lists (no Monte Carlo needed); a **Safe** default at the 10th–25th percentile matching
KQMS; rename the degenerate `min` to "Worst case"; KQMS-compatible enemy-orb baseline; report
a *band*; render an assumptions block. B22: wire `analyzeRotation` into `TimelineStrip`.
**Exit:** our numbers reconcile against published KQM/gcsim figures for 5 teams under matched
assumptions; no result displayed without its assumption set.

### Phase 5 — Authoring and auto-generation (2–3 sprints)
B16 (synthesizer as seed generator), B21 (time/cooldown layer), B14 (optimizer correctness),
B15 + §7 below.
**Exit:** Easy Mode produces a rotation passing the validity checker for 10 canonical teams;
"Auto Optimize" never worsens the carry, never deletes user data, never produces an invalid
rotation, returns in <300ms with an explanation of what changed.

### Phase 6 — Validation gate (blocks GA)
`docs/er-calc-gcsim-validation.md` is currently a setup document with no recorded runs.
Commit a gcsim corpus for 8 canonical teams (National, Raiden National, Raiden Hyperbloom,
Sara hypercarry, Dori battery, Furina/Neuvillette, Freeze, a Natlan Nightsoul team) with
per-character energy-per-rotation, and a test flagging >15% drift.
**Exit:** every shipped ER number within 15% of gcsim, or the divergence is listed in design
doc §13 with a reason.

---

## 5. Retiring the time-based calculator (B17)

Delete `src/pages/team-comp/RedesignedErView.tsx`, `src/lib/ercalc/redesignedParser.ts`, the
`Redesigned*` types, the nav entry ([appNavigation.tsx:131](../src/components/layout/appNavigation.tsx:131))
and the route ([TeamComp.tsx:245](../src/pages/TeamComp.tsx:245)). Keep
`redesignedCalculator.ts` + its test for at most one release as an offline cross-check of the
NGA reference numbers, then delete.

Why, beyond the structural flaw in §1:
- Its shipped default output is wrong on its own terms — `computeTiming` spans each character
  from first action to last with no per-visit segments, producing 83.90% where the module's
  own reference table says 116.31%. The only behavioural test bypasses `computeTiming`
  entirely by injecting `customTiming`, so the suite is green while the page is off by 32 ER
  points on its first row.
- It cannot express the three target scenarios: no start energy, no burst-cast position,
  `axisLengths[1]` parsed and never read.
- It shares nothing with the app — no character DB, no `particles.json`, no team store, no
  i18n. Users must hand-author an undocumented Chinese NGA metadata blob.
- **Two live tabs giving different answers for the same team is a GA credibility problem**
  regardless of which is right.

**Harvest before deleting:** the particle flight delay `τ = 1.24s`, the periodic tick count
`N = floor(tProd/delta) + 1`, and the per-weapon expected NA energy table (which independently
corroborates the flat, non-ER-scaled NA model).

---

## 6. Claims checked and cleared

Recorded so they are not re-litigated:

- **NA energy is *not* a Clear particle.** gcsim's `SetupOnNormalHitEnergy` calls
  `AddEnergy("na-ca-on-hit", 1)` on the attacker only, flat and un-ER-scaled. The code is
  right; `docs/er-calc-gcsim-validation.md:49/60` is a stale planning note and is what needs
  fixing.
- **`erScale` does not have a flat base on top of the increment.** A proposed "fix" to make
  Sara give 2.4 at 100% ER was refuted against official text — `amount` in the data duplicates
  `per100` as documentation of the 100%-ER value, and `resolveEntryPerProcFlat` is right to
  drop it. F1 as applied is correct.
- **Qiqi genuinely generates no particles** — not a data gap. Her 80-cost burst is famously
  uncastable.
- **NA pity legitimately includes charged attacks** — gcsim subscribes for `AttackTagNormal`
  *and* `AttackTagExtra`. Only plunge is questionable (~0.2 energy/node).
- **The 15s periodic `procs` default is a declared UX default**, not a defect — the override
  machinery genuinely ships. Improve under B21.
- **`generateSuperTable` produces 4 rows on the shipped example**, not a combinatorial blowup;
  and the optimizer enumerates ~120 candidates per iteration, not n². The real optimizer
  issues are the missing periodic-proc edit and the synchronous click handler.

---

## 7. Computing an optimal rotation

Greenfield — no competitor does this. gcsim requires hand-written DSL configs and its
"optimizer" tunes substats; Genshin Optimizer optimizes artifacts against a *fixed* rotation;
the Chinese community publishes 轴 as prose. The transferable idea from gcsim is its **phase
structure**: solve energy feasibility first with damage ignored, then optimize.

**Position: the event model can support this, but only after Phase 1 + B21.** The blockers
are not search-related — search over a wrong model finds the model's bugs, not good rotations:
(a) B3 means a solver will over-value self-absorption; (b) B1/B2 mean proc totals depend on NA
chip count, so the search will exploit chip count as a free variable; (c) with no legality
notion, the optimum is a physically impossible rotation.

### Objective

Take a **priority character** `c*` (the on-field DPS, derivable from the team-comp role model
or the Easy Mode driver) and a per-character achievable cap `cap_i` (default: 100% + what an
ER sands plus realistic substat allocation buys for that build slot; user-overridable).
Compare candidates lexicographically:

```
score(T) = [
  n_inf = |{ i : ER_i(T) = Infinity }|,      // hard infeasibility
  viol  = Σ_i max(0, ER_i(T) - cap_i),       // overshoot past achievable
  ER_c*(T),                                  // the carry's requirement
  max_{i ≠ c*} ER_i(T),                      // worst support
  Σ_{i ≠ c*} ER_i(T),                        // total support cost
  canonicalHash(T)                           // deterministic tie-break
]
```

`n_inf`/`viol` first so the search can escape unsolvable states. Score with **one** function
shared with the results panel — pass `calculateTeamERSequence` in as a
`(timeline) => ERResult[]` callback. For scenario (1), score the max over startup and
steady-state but *report both*.

### Hard constraints (reject, don't penalize)

Implement by extending `analyzeRotation` so validator, linter and optimizer share one
definition: skill cooldown; burst cooldown and energy availability; on-field time budget;
**particle flight** (absorbed by the next *distinct* on-field character, or by the caster only
if a `wait` ≥ τ≈1.24s separates cast from their own Q — this is what makes prefunneling
expressible and stops the solver inventing self-absorption); ICDs (Favonius by refinement,
Electro resonance 5s, selfEnergy cooldowns); summon lifetime; structural (every character
bursts `burstCount` times, no proc before its deploying skill).

### Search

Deterministic, no randomness.
- **A — seeds.** Rewrite `compileHighLevelRotation` as a seed generator: per character emit
  `E → (funnel wait) → Q`, interleave driver NAs between phases, enumerate ≤24 character
  orderings pruned by a cheap heuristic (buffer before carry, battery before recipient).
  Repair each against the hard constraints; discard the unrepairable.
- **B — feasibility.** Steepest descent on `[n_inf, viol]` only.
- **C — optimization.** Steepest descent on the full vector, with the existing four edit
  families **plus periodic-proc retargeting and character-block swap**. Small tabu list (last
  8 edits), first-improvement, ~40 iteration cap.
- **D — report.** Return the edit list and before/after score vector so the UI can say
  *"moved Fischl's Oz ticks onto Raiden's Q: carry 168% → 141%, Xiangling 205% → 208%"*.

### Fast and deterministic

Incremental scoring (snapshot `CharSimState` at each Q checkpoint, re-simulate only from the
first changed index); memoize `alignFavoniusCDsForTeam` on the action signature and cap it at
`defaultProcsByRefinement` so the optimizer cannot manufacture procs; never mutate the user's
flags; never lose data (fix `removeAction` to remap procs rather than filter them); target
<300ms for a 4-character 20-action rotation, off the main thread; pin determinism with a
golden test.

---

## 8. Open questions for the product owner

1. **Default statistics posture** — Safe (KQMS-comparable, ~10–25th percentile) vs Expected as
   the shipped default. Safe makes us comparable to community references; Expected is a lower,
   friendlier number. This changes every number in the tool.
2. **Enemy-drop baseline** — adopt KQMS's 3 clear orbs / 90s as default, or keep zero and make
   it explicit? Zero is defensible and conservative but is *not* what other tools report.
3. **Does the ER stat boundary move?** B6 (Raiden A4, source-scaled grants) requires reading a
   battery's actual ER, which design doc §3.1 currently puts permanently out of scope. The
   alternative is a per-battery assumed-ER input on the card.
4. **Manekin entities** — exclude from the ER picker permanently (done in F7), or author
   particle data for them?
5. **Scope of the optimizer at GA** — ship "improve my rotation" (local search over an authored
   axis) only, or also "generate my rotation" (seed + search from scratch)? The latter needs
   Phase 5 complete.
