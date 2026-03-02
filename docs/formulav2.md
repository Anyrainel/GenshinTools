# Formula v2 — Unified Damage Formula with Reaction Selection

> **Status**: Proposal
> **Motivation**: Eliminate redundant formula entries that differ only by reaction type

---

## Problem

Every character that uses amplifying or catalyze reactions currently needs
separate formula entries for raw and reaction variants:

```
hutao-charged        → DirectFormula(2.426, {Pyro, charge, none})
hutao-charged-vape   → AmplifyFormula(2.426, {Pyro, charge, vaporize})
```

The inputs are **identical** — same multiplier, scaling key, and extra terms.
Only the reaction type and formula class differ. This pattern doubles (or
triples) the formula count for every reaction-eligible character:

| Character  | Current entries | Without duplicates |
|------------|----------------:|-------------------:|
| Hu Tao     |               6 |                  3 |
| Ganyu      |               4 |                  2 |
| Yae Miko   |               4 |                  2 |
| Arlecchino |               6 |                  2 |
| Cyno       |               4 |                  2 |
| Clorinde   |               4 |                  2 |
| Nahida     |               2 |                  1 |
| Keqing     |               2 |                  1 |
| Tighnari   |               2 |                  1 |
| Sethos     |               2 |                  1 |
| Kinich     |               2 |                  1 |

Audit confirmed that `CatalyzeFormula` follows the exact same pattern as
`AmplifyFormula` — all three classes share the same constructor signature and
every Direct ↔ Catalyze pair in the codebase uses identical inputs.

---

## Design

### Unified formula class

Replace `DirectFormula`, `AmplifyFormula`, and `CatalyzeFormula` with a single
class. The reaction type is **no longer baked into the formula definition** —
it is supplied at evaluation time by the UI.

```typescript
// Before (v1)
new DirectFormula(mult, tag)          // reaction: "none"
new AmplifyFormula(mult, tag)         // reaction: "vaporize" | "melt"
new CatalyzeFormula(mult, tag)        // reaction: "spread" | "aggravate"

// After (v2)
new DamageFormula(mult, tag)          // tag.reaction removed or defaults to "none"
// reaction selected at compute time via CalcContext or UI state
```

The `compute()` method branches internally on the selected reaction, using the
same logic that currently lives in the three separate classes.

### Eligible reactions derived from element

The set of reactions a formula can use is determined by its element:

| Element  | Eligible reactions              |
|----------|---------------------------------|
| Pyro     | none, vaporize, melt            |
| Hydro    | none, vaporize                  |
| Cryo     | none, melt                      |
| Electro  | none, aggravate                 |
| Dendro   | none, spread                    |
| Anemo    | none                            |
| Geo      | none                            |
| Physical | none                            |

No need to declare eligible reactions per formula — element is sufficient.

### Per-part reaction eligibility

A formula entry's `parts` array can contain multiple hits. In some multi-hit
combos, only specific hits realistically trigger reactions (due to ICD or
elemental gauge).

Add an optional `reactionEligible` flag to `FormulaPart`:

```typescript
type FormulaPart = {
  formula: DamageFormula;
  hits?: number;
  reactionEligible?: boolean; // default: true
};
```

When the user selects a reaction from the UI, only parts where
`reactionEligible !== false` use the selected reaction. The rest compute as
direct damage.

**Example — Arlecchino (N1/N4 vaporize, rest raw):**

```typescript
"arlecchino-combo": {
  label: { zh: "普攻连招", en: "NA Combo" },
  parts: [
    { formula: new DamageFormula(n1, pyroNormalTag) },                          // N1 ✓
    { formula: new DamageFormula(n2, pyroNormalTag), reactionEligible: false },  // N2 ✗
    { formula: new DamageFormula(n3, pyroNormalTag), reactionEligible: false },  // N3 ✗
    { formula: new DamageFormula(n4, pyroNormalTag) },                          // N4 ✓
    { formula: new DamageFormula(n5, pyroNormalTag), reactionEligible: false },  // N5 ✗
  ],
}
```

One entry replaces three (raw / melt / vape).

---

## UI Changes

### Reaction picker per formula row

Each formula row in the damage results table gets a small reaction selector
(dropdown or inline toggle) showing the eligible reactions for that formula's
element. The selected reaction is stored per-formula in component state (not in
the character definition).

```
┌──────────────────────────────────────────────────────┐
│ Formula          │ Reaction          │ Damage         │
├──────────────────┼───────────────────┼────────────────┤
│ CA               │ [None ▾]          │   32,450       │
│ CA               │ [Vaporize ▾]      │   58,410       │  ← user switches
│ Q                │ [Vaporize ▾]      │  145,800       │
│ NA Combo         │ [Melt ▾]          │  210,300       │  ← partial: only eligible parts react
└──────────────────────────────────────────────────────┘
```

Default selection: **None**. This preserves current behavior for users who
don't interact with the picker.

### No changes to buff display or team composition UI

Buffs and character options remain unchanged. The reaction picker is purely a
formula-evaluation concern.

---

## Migration

1. **Merge the three formula classes** into a single `DamageFormula` class.
   Keep the existing `compute()` logic from each class, branching on reaction
   type internally.
2. **Remove `reaction` from `DamageTag`** (or keep it only as a default /
   display hint). The reaction is now a runtime selection.
3. **Collapse duplicate formula entries** in each character's `formulaMap`.
   For multi-hit combos with partial reactions, add `reactionEligible: false`
   to the appropriate parts.
4. **Add reaction picker to the UI** with eligible reactions derived from the
   formula's element.
5. **Update the optimizer** if it currently evaluates specific formula IDs that
   included reaction variants (e.g. `hutao-charged-vape`). It should now
   evaluate a single formula ID with a reaction parameter.

### Formulas that use Transform / Lunar models

`TransformFormula` and `LunarFormula` are fundamentally different damage models
(no talent multiplier, different scaling). They are **not** part of this
unification and remain as separate classes.
