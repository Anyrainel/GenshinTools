# Buff Override Testing Guide

Two features to test on the `/team-comp` page:

1. **Display fix**: Left-side formula stats now exclude buffs with 0 activation
2. **BuffLedger dialog**: New settings icon on buff cards opens a per-buff override dialog

## Setup

Run dev server: `npm run dev`, navigate to `/team-comp`.

Load a preset team from the "Flagship Teams" dropdown, or manually build a team. After loading, you must **select a formula** (e.g., Burst, Charged Attack) from the formula selector for the DPS character.

## Good Test Teams

These teams have stack-limited buffs that trigger partial activation:

| Team | Key Buff | maxStacks | Notes |
|------|----------|-----------|-------|
| Skirk + Escoffier + Furina + Shenhe | Shenhe E (Icy Quill) | 5 or 7 | Flat baseDmg from ATK, applied to Cryo hits |
| Varesa + Iansan + Xianyun + Furina | Xianyun Q (Starwicker) | 8 | Plunge baseDmg from ATK |
| Gaming + Xianyun + Furina + Bennett | Xianyun Q (Starwicker) | 8 | Plunge baseDmg, simpler formula parts |
| Mavuika + Citlali + Xilonen + Bennett | Xilonen C4 | 6 | Normal/Charged/Plunge baseDmg from DEF (need C4) |
| Yun Jin + any Normal Attacker | Yun Jin Q | 30 | Normal Attack baseDmg from DEF |

If you don't want to set constellations, **Shenhe** is the simplest choice — her Icy Quill stacks work at C0.

## Test 1: Left-Side Formula Display Fix

**Goal**: When a buff has 0 activation on a part, the formula breakdown (left side) should show stats WITHOUT that buff, not with it.

### Steps

1. Pick a team with a stack-limited buff (e.g., Skirk + Shenhe team)
2. Select a formula with multiple parts (e.g., Skirk's Burst which has multiple damage parts)
3. Expand the formula breakdown (click the damage number to toggle)
4. Look at the formula math — find a part where the stack-limited buff contributes to `baseDmg`
5. Open the per-part buff dialog (small gear icon next to each part's damage number)
6. Set the stack-limited buff's slider to **0** for a specific part
7. Close the dialog

**Verify**:
- The left-side formula for that part should now show **lower baseDmg** (the buff's flat damage is gone)
- The displayed damage number should reflect the average (no buff applied)
- Other parts where the buff IS active should still show the higher baseDmg in their formula

**Compare**: If you set the slider back to full, the left-side formula should return to showing the buffed baseDmg values.

### Edge case: Combo mode

1. Set up a combo rotation (add lines in the combo editor)
2. Have a formula repeated multiple times (count > 1)
3. The greedy allocator distributes stacks across all hits
4. Click into the formula drill-down to see the breakdown
5. If any part gets 0 stacks, its formula should exclude the buff from stats

## Test 2: BuffLedger Override Dialog

**Goal**: Each active buff card in the Buff Ledger now has a settings (gear) icon. Clicking it opens a dialog showing all formulas/parts where that buff applies, with toggle/slider controls.

### Steps

1. With a team and formula selected, scroll down to the **Buff Ledger** section
2. Expand it (click the header)
3. Find a buff card — look at the **bottom-right corner** of the last stat entry row
4. You should see:
   - For stack-limited buffs: the teal "N stacks" badge, then a gear icon to its right
   - For non-stack-limited buffs: just a gear icon at the bottom right
   - For inactive buffs (grayed out): NO gear icon
   - For bespoke (per-part) buffs (violet label): NO gear icon

5. Click the gear icon on a **stack-limited buff** (e.g., Shenhe's Icy Quill)

**Verify the dialog**:
- Title: "Buff Activation — [buff name]"
- Description text below the title
- One section per applicable formula, with:
  - Character icon + character name + formula name as section header
  - In combo mode: a "xN" badge showing combo count
  - One row per applicable part showing:
    - Part name (e.g., "1. Cryo Direct Damage")
    - Slider (if multi-hit) with current/max ratio, OR toggle (if single-hit)
    - "Reset" link when value differs from default

### Cross-dialog sync test

1. Open the BuffLedger dialog for a buff (e.g., Shenhe E)
2. Change a slider value (e.g., set part 0 to 3 out of 5)
3. Close the dialog
4. Now open the **per-part dialog** (gear icon next to the formula part's damage number in the formula breakdown)
5. Navigate to the same part tab

**Verify**: The value you set in the BuffLedger dialog should appear here too — they share the same store.

6. Change the value in the per-part dialog
7. Close it, reopen the BuffLedger dialog

**Verify**: The new value appears in the BuffLedger dialog as well.

### Combo mode test

1. Set up a combo with at least 2 different formulas from different characters
2. Open the BuffLedger dialog for a team-wide buff (e.g., a weapon or resonance buff)
3. The dialog should show **multiple formula sections** — one per formula in the combo
4. Each section should have its own slider ranges adjusted for the combo count
5. Slider max = `part.hits * comboCount` for combo formulas (capped by maxStacks)

### Non-stack-limited buff test

1. Find a buff without maxStacks (e.g., Bennett's Q ATK buff, artifact set bonuses)
2. It should still have a gear icon
3. Opening it shows toggle (on/off) per part, since `effectiveMax = hits` (usually 1 for non-multi-hit)
4. Toggling a buff off for a part should remove that buff's contribution from that part's damage

## What NOT to Test

- The blended damage number itself hasn't changed — the math is identical
- The optimizer hot path is unaffected — these changes only touch the display path
- Reaction overrides (vaporize/melt split) interaction with partial buffs is a pre-existing edge case

## Quick Smoke Test Checklist

- [ ] Load Flagship preset with Shenhe team
- [ ] Select Skirk Burst formula
- [ ] Expand formula breakdown, confirm it renders
- [ ] Open per-part dialog, adjust Shenhe stacks to 0 on one part
- [ ] Confirm left-side formula shows lower baseDmg for that part
- [ ] Open BuffLedger, find Shenhe E buff card
- [ ] Confirm gear icon appears bottom-right of the card
- [ ] Click gear icon, confirm dialog opens with formula sections
- [ ] Adjust slider in BuffLedger dialog
- [ ] Reopen per-part dialog, confirm value synced
- [ ] Switch to combo mode, repeat BuffLedger dialog check with multiple formulas
