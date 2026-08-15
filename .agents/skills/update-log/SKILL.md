---
name: update-log
description: >
  Draft and publish player-facing "What's New" / update log entries for GenshinTools.
  TRIGGER when the user asks to write, update, draft, or publish the update log / changelog /
  "what's new" / 更新日志. Gathers commits since the last published entry, summarizes only
  user-facing changes (no infra/refactors, no engineering tone), proposes bilingual zh+en
  entries for approval, then writes them to src/presets/updatelog/{en,zh}.md under the current date.
  Do NOT auto-run on commit or on a schedule — this is an on-demand, approval-gated flow.
---

# Update Log

Drafts and publishes the in-app "What's New" entries. Output is two lockstep files,
rendered by `src/components/shared/WhatsNew.tsx`:

- `src/presets/updatelog/en.md` — English
- `src/presets/updatelog/zh.md` — 简体中文

The flow is **always approval-gated**: gather → summarize → propose for review → only write after the user approves. Never write the files before approval.

## File format (must match exactly)

```
## roadmap
- <forward-looking item>

## YYYY-MM-DD

### features
- <player-facing addition or improvement>

### fixes
- <player-facing fix>
```

Rules the parser and existing entries rely on:
- `## roadmap` stays at the very top; leave it untouched unless the user asks to change it.
- Newest dated entry comes **first**, immediately under roadmap (descending by date).
- Each entry uses `### features` then `### fixes` (in that order). Omit a section that has no items; keep `### features` even when small.
- Bullets are `- ` lines. One change per bullet. No nested bullets, no bold/markdown decoration inside bullets — plain sentences, matching the surrounding entries.
- `en.md` and `zh.md` must stay structurally identical: same date, same sections, same number of bullets in the same order. They are two views of one entry, not independent files.

## Step 1 — Gather commits since the last published entry

**Fetch first.** Commits can land on the remote from another device or agent that aren't in your local `HEAD` yet — if you scan only local history you'll silently miss them. Update remote-tracking refs before gathering, and scan up to whichever tip is ahead:

```bash
git fetch origin
```

The boundary is the commit that last touched the update log files, not a date guess:

```bash
# boundary commit (last time the log was published)
git log -1 --format='%H %ci %s' -- src/presets/updatelog/en.md src/presets/updatelog/zh.md

# everything since, newest first. Use origin/master (not HEAD) as the tip if local is behind the remote.
BASE=$(git log -1 --format=%H -- src/presets/updatelog/en.md src/presets/updatelog/zh.md)
git log --format='%h %ci %s' "$BASE"..origin/master   # or "$BASE"..HEAD if local is ahead
```

**The boundary is the last update-log edit, NOT the last push.** The log is published far less often than commits are pushed, so by the time you run this, essentially everything since `BASE` is already released and **belongs in the entry by default — include it.** Do not reflexively trim, flag, or second-guess the most recent commits; recency does not imply unreleased, and asking the user to "confirm the last few are released" every run is wrong.

**Commit buffer (rare exception only).** The buffer is for the unusual case where a specific committed change is genuinely not yet live — e.g. gated behind a feature flag, or merged but not deployed. Only hold a commit back if you have a concrete reason (or the user names one); then it gets picked up next run automatically, since the boundary only advances when the log files are written. Absent such a reason, propose every commit since `BASE`.

When a commit subject is vague about user impact (e.g. `Update 6.6 data`, `chore: ...`), inspect it before deciding:

```bash
git show --stat <hash>      # what files/areas changed
git show <hash> -- <path>   # read the diff when needed to judge player impact
```

## Step 2 — Summarize from the player's perspective

Write for a Genshin player using the app, not for an engineer reading git history.

**Include** (these are what players notice):
- New characters / weapons / artifact sets supported
- New tools, pages, tabs, or calculators
- New options, toggles, or workflow improvements they can use
- Meaningful fixes to wrong results, broken pages, or confusing behavior
- Game-version data updates that unlock new content for them

**Exclude** (skip silently — see also `feedback_updatelog_style` memory):
- Refactors, internal renames, code moves, type changes
- Test changes, golden/regression refreshes, benchmarks
- Build/CI/deploy/worker config, dependency bumps, tooling
- Performance work with no user-visible effect, and pure internal cleanup
- Anything a player could never observe in the app
- Technically-visible but inconsequential corrections most players won't notice or feel — e.g. a single character's region/metadata tag fix, a tooltip wording tweak, a one-off label typo. The bar is "would a player actually feel this?", not "is it visible somewhere?". When unsure, leave it out.
- Beta → official promotion as a mechanism. Never say an entity "moved from beta to official" or "left beta" — that's an internal data-pipeline detail. If a character/weapon/artifact set is genuinely new to official (its damage formulas, roster entry, etc. didn't exist in official before), describe it as newly added, full stop. If it already had official support and this batch only fixed bugs or corrected metadata, that belongs under fixes (or is excluded per the rule above) — don't credit it as a new addition just because it also happens to be present in official now. Verify what actually changed in official (`resources.ts`, `i18n-game.ts`, the relevant `dmgcalc/impl/*.ts`) before claiming something is new — a character can have long had official formulas that were simply misfiled or buggy.

**Tone:**
- Plain, friendly, product copy — not engineering notes. No "refactored", "migrated", "implemented", "param", commit hashes, file names, or internal class names.
- Lead with the player benefit. Describe what they can now do or what now works, not how it was built.
- For internal/technical changes (cookie & credential handling, data-fetching, sync, storage), describe the **outcome**, not the mechanism — e.g. "updated the HoYoLAB / 米游社 import logic so it keeps fetching your data reliably", not "now uses separate cookie fields". Don't enumerate implementation specifics players can't act on (which fields changed, which API version). Staying high-level also keeps you accurate: don't assert mechanism details inferred from a diff, since you may misread what actually changed (e.g. claiming a field structure is "new" when it merely changed).
- **Merge related commits** into one bullet (e.g. several Nicole commits → one "Added support for Nicole"). A bullet maps to a player-facing change, not to a commit.
- **Keep fix bullets short: 1–2 sentences each, and hide implementation details** (internal formula names, mechanic jargon, "root cause" explanations). State the symptom the player saw and that it's fixed, not how the bug worked. If a commit fixed several distinct things, split into separate short bullets rather than cramming them into one dense sentence with semicolons.
- Match the density and phrasing of existing entries in the files — read the latest few before drafting.
- Sort each section by importance: biggest/most exciting changes first.

## Step 3 — Propose bilingually, get approval, then write

1. **Propose for review.** Present the draft in chat as a side-by-side zh/en table (or paired blocks) so the user can compare line for line. Show the proposed date header and the section/bullet structure exactly as it will be written. Note any commits you held back as the buffer.

2. **Chinese wording** must follow the repo i18n rules (see CLAUDE.md ➜ i18n): natural community/官方 wording and in-game names, never a literal translation from the English. Match the voice of the existing `zh.md` entries. The `genshin-knowledge` skill's `translator-rules.md` covers game-term naming if a term is uncertain.

3. **Iterate** on the user's edits until they approve. Only then write.

4. **Write** the approved entry:
   - Use the **actual current date** as `YYYY-MM-DD` (check the environment's current date / a fresh `git log` timestamp — do not hardcode).
   - Insert the new entry directly under `## roadmap`, above the previous newest entry, in both files.
   - If an entry for today's date already exists, merge new bullets into it instead of adding a duplicate header.
   - Keep `en.md` and `zh.md` structurally identical.

5. Do **not** commit or push unless the user asks. Leave the files as pending changes for them to review.
