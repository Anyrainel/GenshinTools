# Checkpoint 42: authenticated Xiao applicability and formula-count witnesses

This checkpoint leaves the cached Keqing experiment and exercises a second
character/team slice from the expanded repository. It authenticates three
source-local Xiao condition bindings against the exact
Xiao/Xianyun/Furina/Faruzan team and separately compares the source-authored
`EEQ12HP` action counts with the calculator's current default Xiao formula
counts.

This is still not a working guide factory. It does not assemble a Xiao build,
select an artifact or weapon, rank a team, evaluate damage, optimize a
rotation, compute ideal rolls, or calculate Energy Recharge.

## Source-local condition slice

The guide-selected Xiao snapshot contains 21 schema-defined condition arrays:
17 nonempty and 4 empty. The slice selects exactly three nonempty occurrences:

- the Marechaussee Hunter branch conditioned on Xianyun being in the team;
- the Anemo DMG Bonus Goblet branch conditioned on Xianyun being in the team;
  and
- the separate Anemo DMG Bonus Goblet branch conditioned on Xiao being C6.

The exact FFXX roster satisfies the two Xianyun predicates directly. The
source team leaves Xiao's investment unspecified, so the C6 predicate is
resolved only under an explicit, wrapper-authored Xiao-C6 request context. The
wrapper does not attribute that constellation fact to the source team.

Fourteen nonempty occurrences remain holdouts and all four empty arrays remain
unconsumed. The source team's rotation entries and the separate rotation
fixture are outside this condition slice. No holdout inherits a binding from
shared text, a shared hash, or nearby source metadata.

The durable report is `xiao-source-local-condition-slice.json`. It is 68,775
bytes with SHA-256
`2de90b57e0611156294aa8a60095fd4829a0c8ab3f6523b61ed82959d15d8353`.

## Formula-count witness

The standalone Xiao rotation fixture preserves source tokens `E = 2` and
`HP = 12`. A separate Guide Factory-authored, unreviewed alias table maps them
to the calculator formula identifiers `xiao-skill` and `xiao-plunge-high`.
Those aliases are not attributed to KQM.

Using the exact current GenshinTools FFXX baseline only to make the calculator
runnable, under explicit local C0/R1/level-90/10-10-10 assumptions, the
calculator's default draft contains:

- `xiao-skill = 2`, matching the translated source count; and
- `xiao-plunge-high = 11`, one below the translated source count of 12.

The 12-versus-11 result is a validation target, not a correctness verdict and
not permission to change either side. The witness evaluates no damage formula
and makes no claim about action feasibility, timing, buff coverage, damage per
rotation, DPS, or an optimal rotation.

The witness authenticates the fixture's exact source-document metadata and
the hashes of its declared generated-from files. It deliberately does not
claim a complete transitive hash closure over the calculator runtime. Whole
containers are schema-validated, so invalid unrelated records can reject the
witness even though schema-valid unrelated records do not enter its scoped
semantic projection.

The durable report is `xiao-formula-count-parity.json`. It is 24,912 bytes with
SHA-256
`eaf5c72b1861fc107b32d99af8d3485a5ff3d584bec31acd733c85e9a419ce6c`.

## Global validation effects

Only the three authenticated Xiao occurrences enter the current condition
catalog. Their evidence preserves the two source-matched cells and the one
source-unresolved cell that becomes matched only under the exact FFXX/Xiao-C6
request fact. The catalog grows from 63 to 66 entries:

- 63 typed bindings; and
- 3 exact-text acknowledgements.

The manual corpus remains 163 condition arrays. Its 140 non-structural rows
are now 63 typed, 3 acknowledged, and 74 unbound. The independent display
partition remains 15 ER-deferred rows; this checkpoint does not interpret or
compute them. Manual coverage now authenticates 20 source files and 81
generated-from paths. The regenerated Klee witness retains exactly its four
Klee claims while authenticating 6 source files, 85 generated-from paths, and
the expanded 66-entry upstream catalog.

The derived formula-fixture coverage now contains three fixtures and twelve
calculator-team member observations across nine characters. It records 33
positive and 18 zero-default formula rows. The Xiao fixture contributes four
calculator-team-only observations and two count-parity comparisons: one match
and the one 12-versus-11 mismatch. It still has zero guide-ready and zero
source-validated observations, and performs no damage or ER computation.

## Verification and next boundary

The checkpoint is integrated into the offline validator. Validation with
`--defer-er` rebuilds the new witnesses, the expanded formula coverage, the
66-entry condition catalog, manual coverage, and the downstream Klee witness.
The existing twelve weapon-type warnings remain descriptive corpus findings;
there are no validation errors.

Human review of the three Xiao condition mappings, the two token aliases, and
the 12-versus-11 mismatch remains required before any guide or computation can
consume them as accepted domain knowledge. The next non-ER step should test a
bounded composition or candidate-enumeration seam using these authenticated
inputs while preserving the mismatch and every unresolved source branch.
