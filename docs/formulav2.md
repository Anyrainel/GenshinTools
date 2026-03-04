# Formula v2 — Unified Reactions + Combo Formulas

> **Status**: Proposal
> **Motivation**: (1) Eliminate redundant formula entries that differ only by reaction type; (2) Let users model rotations by combining formulas into weighted combos

---

## Problem 1: Formula Duplication

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

## Problem 2: No Rotation Modeling

Users can only view and optimize damage for **one formula at a time**. There is
no way to express a rotation like:

```
9× Hu Tao E CA (vape) + 4× Blood Blossom + 1× Q (vape)
+ 1× Xingqiu Q Rain Swords
```

…as a combined damage number, or optimize artifacts to maximize it.

---

# Part A: Unified Reaction Selection

## Design: Factory Methods Instead of a New Class

Rather than replacing DirectFormula/AmplifyFormula/CatalyzeFormula with a single
`DynamicFormula` class, we keep the existing class hierarchy and add **factory
methods** that create reaction variants on demand:

```typescript
// Base class gains factory methods
abstract class DamageFormula {
  // ... existing ...

  /** Create an amplified variant (vaporize/melt) with the same params */
  createAmplified(reaction: "vaporize" | "melt"): DamageFormula {
    return new AmplifyFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.scalingKey,
      this.extraTerm
    );
  }

  /** Create a catalyzed variant (spread/aggravate) with the same params */
  createCatalyzed(reaction: "spread" | "aggravate"): DamageFormula {
    return new CatalyzeFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.scalingKey,
      this.extraTerm
    );
  }
}
```

**Why factory methods**: Custom formula subclasses (e.g., `ArlecchinoNormalFormula`
which overrides `getBaseDmg()`) can override the factory to return their paired
variant. The pairing pattern already exists in the codebase — the factory just
formalizes it:

```typescript
class ArlecchinoNormalFormula extends DirectFormula {
  // Already exists — custom base damage with Bond of Life scaling
  override getBaseDmg(stats) { ... }

  // NEW: factory returns the existing paired class
  override createAmplified(reaction) {
    return new ArlecchinoNormalAmplifyFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.hitIndex, this.initialBol, this.masqueScale
    );
  }
}
```

At evaluation time, a utility dispatches to the correct variant:

```typescript
function evaluateWithReaction(
  formula: DamageFormula,
  targetReaction: ReactionType,
  stats: StatSheet,
  charLevel: number,
  ctx: CalcContext
): number {
  if (targetReaction === formula.tag.reaction)
    return formula.calc(stats, charLevel, ctx);
  if (isAmplifying(targetReaction))
    return formula.createAmplified(targetReaction).calc(stats, charLevel, ctx);
  if (isCatalyze(targetReaction))
    return formula.createCatalyzed(targetReaction).calc(stats, charLevel, ctx);
  return formula.calc(stats, charLevel, ctx);
}
```

### Eligible reactions derived from element

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

### Per-part reaction eligibility

A formula entry's `parts` array can contain multiple hits. In multi-hit
combos, only specific hits realistically trigger reactions (due to ICD or
elemental gauge). A new optional `eligibleReactions` field declares what each
part supports:

```typescript
type FormulaPart = {
  formula: DamageFormula;
  hits?: number;
  // NEW — which reactions this part can use
  // undefined → legacy behavior (formula's baked-in reaction only)
  // ["none"] → ICD-locked, always direct
  // ["none", "vaporize", "melt"] → user can choose
  eligibleReactions?: ReactionType[];
};
```

**Example — Arlecchino (N1/N4 vaporize, rest ICD-locked):**

```typescript
"arlecchino-normal": {
  label: { zh: "普攻连招", en: "NA Combo" },
  parts: [
    { formula: new ArlecchinoNormalFormula(n1, tag, 0, ...), eligibleReactions: ["none", "vaporize", "melt"] },
    { formula: new ArlecchinoNormalFormula(n2, tag, 1, ...), eligibleReactions: ["none"] },  // ICD
    { formula: new ArlecchinoNormalFormula(n3, tag, 2, ...), eligibleReactions: ["none"] },  // ICD
    { formula: new ArlecchinoNormalFormula(n4, tag, 3, ...), eligibleReactions: ["none", "vaporize", "melt"] },
    { formula: new ArlecchinoNormalFormula(n5, tag, 4, ...), eligibleReactions: ["none"] },  // ICD
  ],
}
```

One entry replaces three (raw / melt / vape).

## Reaction Selection Model: Gate + Author Defaults + User Override

The reaction selector uses a **three-tier resolution** system:

### Tier 1: Gate (formula-level)

The user picks a reaction for the entire formula (e.g., "Vaporize"). This is the
**gate** — it enables reaction mode. When the gate is "None", all parts compute
as direct damage regardless of their eligibility.

### Tier 2: Author defaults (auto-fill)

When the gate is set to a reaction (e.g., "Vaporize"), each part auto-fills
based on its `eligibleReactions`:
- Part has "vaporize" in eligibleReactions → **Vaporize**
- Part has eligibleReactions = ["none"] (ICD-locked) → **None**

The per-hit controls become visible, pre-filled with these defaults.

### Tier 3: User override (per-part)

The user can adjust individual parts after the gate fills defaults. For example,
changing N4 from "Vaporize" to "Melt" while keeping N1 as "Vaporize".

### Data model

```typescript
type ReactionOverride = {
  reaction?: ReactionType;                      // Tier 1: gate
  partReactions?: Record<number, ReactionType>;  // Tier 3: per-part overrides
};

// Stored per formula in team state:
// Key format: "{charId}.{formulaId}"
reactionOverrides: Record<string, ReactionOverride>;
```

### Resolution logic

```typescript
function resolvePartReaction(
  override: ReactionOverride | undefined,
  partIndex: number,
  eligibleReactions: ReactionType[] | undefined
): ReactionType {
  // No override → use formula's baked-in reaction
  if (!override?.reaction) return "none";

  // Per-part override takes priority
  if (override.partReactions?.[partIndex] != null)
    return override.partReactions[partIndex];

  // Gate: apply if the part supports it
  if (eligibleReactions?.includes(override.reaction))
    return override.reaction;

  // Part can't use the gate reaction (ICD-locked)
  return "none";
}
```

### Formulas that use Transform / Lunar models

`TransformFormula`, `LunarFormula`, and `LunarDirectFormula` are fundamentally
different damage models (no talent multiplier, different scaling). They are
**not** part of this unification and remain as separate classes. The reaction
selector is hidden for these formula types.

---

## UI: Reaction Selector

### Placement

Between the FormulaTabBar and DamageCardBody. Only visible when the selected
formula has reaction-eligible parts (i.e., not for Anemo/Geo/Physical elements,
and not for Transform/Lunar formulas).

```
┌─ FormulaTabBar ──────────────────────────────────┐
│  [E CA]  [Q]  [Blood Blossom]                    │
├──────────────────────────────────────────────────┤
│  Reaction:  ( None )  ( Vaporize )  ( Melt 2x ) │  ← segmented pills (gate)
│                                                   │
│  Per-Hit:                                         │  ← appears when gate ≠ None
│  N1 [Vape ▾]  N2 [None]  N3 [None]              │    for multi-part formulas
│  N4 [Vape ▾]  N5 [None]                          │    pre-filled with defaults
├──────────────────────────────────────────────────┤
│  [DamageCardBody: total damage + breakdown]       │
└──────────────────────────────────────────────────┘
```

### UX details

- **Segmented pills** for the gate: one-click reaction selection. Show multiplier
  direction: "Melt (2x)" for Cryo, "Melt (1.5x)" for Pyro.
- **Per-hit controls**: auto-appear when gate ≠ None for multi-part formulas.
  ICD-locked parts shown as disabled/greyed. Only needed for formulas with mixed
  eligibility (e.g., Arlecchino). Hidden for single-part formulas.
- **Team validation**: reactions the team can't support (no Hydro partner for
  Pyro vape) are greyed out with a tooltip explaining why.
- **Persistence**: reaction overrides stored in team state per-formula, surviving
  page navigation.

### Optimizer interaction

The reaction selection is a **fixed input** to the optimizer. Users decide their
reaction intent; the optimizer finds the best artifacts for it. The
`ReactionOverride` is passed through to `evaluateBuild()` → `getDamageResult()`.

---

## Migration

1. **Add factory methods** (`createAmplified`, `createCatalyzed`) to
   `DamageFormula` base class. Override in custom subclasses.
2. **Add `eligibleReactions`** to `FormulaPart` type (optional, backward-compat).
3. **Add `reactionOverrides`** to team store.
4. **Add reaction selector UI** between FormulaTabBar and DamageCardBody.
5. **Thread `ReactionOverride`** through the evaluation pipeline:
   `TeamBuild.getDamageResult()` → `CharBuild` → `CharacterBase`.
6. **Migrate characters** one at a time: remove duplicate entries, add
   `eligibleReactions`, override factories in custom subclasses.
   - Backward-compatible: `eligibleReactions: undefined` preserves legacy behavior.
   - Regression: migrated characters must produce identical damage when reaction
     override matches the old baked-in reaction.

---

# Part B: Combo Formulas (Rotation Modeling)

## Design

A **combo** is a named list of formula lines, each with a character, formula ID,
hit count, and optional reaction override. It represents a rotation's total
damage as a weighted sum.

### Scope: Multi-character

Combo lines can reference formulas from **any team member**. Each line specifies
which character is on-field, and buff routing adjusts per-line via the
`calcTargetId` parameter that already exists in `TeamBuild.getTeamStats()`.

This enables full rotation modeling:

```
9× Hu Tao E CA (Vape)       → Hu Tao on-field
4× Hu Tao Blood Blossom     → Hu Tao on-field
1× Hu Tao Q (Vape)          → Hu Tao on-field
1× Xingqiu Q Rain Swords    → Xingqiu on-field
```

### Data model

```typescript
type ComboLine = {
  charId: string;              // whose formula (also the on-field character)
  formulaId: string;           // which formula from that character
  count: number;               // repetitions (e.g., 9)
  reaction?: ReactionOverride; // per-line reaction override (reuses Part A type)
};

type ComboFormula = {
  id: string;                  // unique ID
  label: I18nLabel;            // user-given name (e.g., "Hu Tao Rotation")
  lines: ComboLine[];
};
```

**Same formula, different reactions**: A combo CAN include the same formulaId
multiple times with different reactions. This models partial-vaporize rotations:

```
3× Hu Tao E CA (None)       → non-vape CAs (hydro not applied yet)
6× Hu Tao E CA (Vaporize)   → vape CAs
```

### Storage

Combos are stored **per-team** in team state:

```typescript
interface Team {
  // ... existing ...
  combos: ComboFormula[];
  selectedCombo: string | null;  // active combo ID, null = single formula mode
}
```

Per-team storage makes sense because combos depend on the team context (which
reactions are available, which buffs are active).

### Evaluation: Per-line buff routing

The key insight: `TeamBuild.getTeamStats(artifactStats, calcTargetId)` already
handles on-field buff routing via `calcTargetId`. For multi-character combos:

1. **Group lines by on-field character** (= `line.charId`)
2. **Compute stats once per unique on-field character** — cache and reuse
3. **Evaluate each line's formula** using the stat set for its on-field character

```typescript
function evaluateCombo(
  teamBuild: TeamBuild,
  combo: ComboFormula,
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext
): ComboResult {
  // Cache stat resolution per unique on-field character
  const statsCache = new Map<string, Record<string, StatSheet>>();
  const getStats = (onFieldCharId: string) => {
    if (!statsCache.has(onFieldCharId)) {
      statsCache.set(
        onFieldCharId,
        teamBuild.getTeamStats(artifactStats, onFieldCharId)
      );
    }
    return statsCache.get(onFieldCharId)!;
  };

  const lineDamages = combo.lines.map(line => {
    const teamStats = getStats(line.charId);
    const result = teamBuild.getDamageResult(
      line.charId, line.formulaId, teamStats, ctx, line.reaction
    );
    return {
      perHit: result.totalDamage,
      total: result.totalDamage * line.count
    };
  });

  return {
    lineDamages,
    totalDamage: lineDamages.reduce((sum, l) => sum + l.total, 0),
  };
}
```

Typically 1-2 unique on-field characters in a combo (carry-dominant), so the
caching keeps this efficient.

### Optimizer integration

The combo's `totalDamage` replaces the single formula's damage as the
optimization objective:

```typescript
// In evaluateBuild():
const damage = activeCombo
  ? evaluateCombo(teamBuild, activeCombo, artifactStats, ctx).totalDamage
  : teamBuild.getDamageResult(charId, formulaId, teamStats, ctx).totalDamage;
```

- Multi-pass structure unchanged (carry-1 → supports → carry-2)
- Marginal gain computation iterates over all combo lines instead of one formula
- Performance: combo eval is ~2-5x a single formula (proportional to line count).
  Acceptable for the optimizer hot path.

---

## UI: Mode Toggle + Combo Builder

A **Single Formula / Combo** mode toggle switches the formula area between the
two modes.

### Single Formula mode (default)

Existing behavior plus the reaction selector from Part A:

```
┌─ Mode ───────────────────────────────────────────┐
│  ( ● Single Formula )  ( ○ Combo )               │
├──────────────────────────────────────────────────┤
│  FormulaTabBar: [E CA] [Q] [Blood Blossom]       │
│  Reaction:  ( None )  ( Vaporize )  ( Melt 2x ) │
│  Per-Hit: N1 [Vape ▾]  N2 [None]  ...           │
├──────────────────────────────────────────────────┤
│  DamageCardBody                                   │
└──────────────────────────────────────────────────┘
```

### Combo mode

The FormulaTabBar is replaced by the combo builder:

```
┌─ Mode ───────────────────────────────────────────┐
│  ( ○ Single Formula )  ( ● Combo )               │
├──────────────────────────────────────────────────┤
│  Combo: [ Hu Tao Rotation ▾ ]  [+ New]  [🗑]     │
├──────────────────────────────────────────────────┤
│                                                   │
│  🔥 Hu Tao                                        │
│  ┌─────────────────────────────────────────────┐ │
│  │ ×9   E CA           ( Vaporize ▾ )  525,690 │ │
│  │ ×4   Blood Blossom  ( None ▾ )       42,300 │ │
│  │ ×1   Q              ( Vaporize ▾ )  145,800 │ │
│  └─────────────────────────────────────────────┘ │
│  💧 Xingqiu                                       │
│  ┌─────────────────────────────────────────────┐ │
│  │ ×1   Q Rain Swords  ( None ▾ )       89,200 │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [+ Add Line]                                     │
│  ─────────────────────────────────────────────── │
│  TOTAL ROTATION DAMAGE:  802,990                  │
├──────────────────────────────────────────────────┤
│  Collapsible: formula breakdown per line          │
│  Buff Ledger                                      │
└──────────────────────────────────────────────────┘
```

### Per-line controls

Each line has:
- **Count**: compact stepper `[-] 9 [+]`
- **Formula**: dropdown of the line's character's available formulas
- **Reaction**: inline pill selector (compact, same as Part A's gate control)
- **Delete**: trash icon per line
- **Subtotal**: `count × formulaDamage` shown inline

### Line management

- **Add Line**: opens a picker — first pick character (from team), then pick
  formula from that character's formulaMap. Added with count=1, reaction=none.
- **Grouping**: lines grouped by character for visual clarity
- **Create combo**: "New" creates empty combo. Alternatively, "Create from
  current formula" pre-populates with the current single-formula selection ×1.

### Combo display

When a combo is active:
- **Total damage**: rotation total (sum of all line subtotals)
- **Formula breakdown**: each line is a collapsible section showing the equation
- **Buff ledger**: shows buffs for the primary on-field character (most damage
  share), with a note about per-line buff context
- **Stat sheet**: unchanged (shows all characters' stats)
- **Optimizer**: "Optimize" button uses the combo total as the objective

---

# Feature Interaction

The two features compose naturally:

- Each `ComboLine.reaction` is a `ReactionOverride` — the same type from Part A
- The combo builder's per-line reaction control reuses the `ReactionSelector`
  component (in compact/inline form)
- In single-formula mode, `ReactionSelector` appears below the tab bar
- In combo mode, each line has an inline reaction control
- Optimizer seamlessly handles both modes via the same objective function

---

# Edge Cases

1. **Team change invalidates reactions**: removing the Hydro character makes
   vaporize unavailable. Grey out affected buttons; fall back to "none" during
   evaluation (no crash).
2. **Team change invalidates combo lines**: removing a character orphans their
   combo lines. Show warning; skip orphaned lines during evaluation.
3. **Custom formula subclasses**: factory method overrides
   (`createAmplified`/`createCatalyzed`) ensure custom `getBaseDmg()` logic is
   preserved when switching reactions.
4. **Performance**: combo evaluation calls `getTeamStats()` once per unique
   on-field character (typically 1-2) plus `getDamageResult()` per line (3-5).
   ~2-5x overhead, acceptable for optimizer hot path.
5. **FormulaBreakdown template switching**: when reaction override changes a
   Direct formula to Amplify, the factory-created variant's `display()` method
   produces `template: "amplify"`, selecting the correct equation renderer.
6. **Mobile**: mode toggle as segmented control. Combo builder lines stack
   vertically. "Add Line" opens bottom sheet picker (Vaul Drawer).
