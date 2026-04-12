Read AGENTS.md for project context if needed.

# Commands
- `npm run dev` — Vite + Wrangler dev server (Cloudflare Functions proxy)
- `npm run dev:vite` — Vite only (no Cloudflare Functions)
- `npm run build` — Production build
- `npm run lint` / `lint:fix` — Biome check / auto-fix
- `npm run type-check` — TypeScript check (src + tests tsconfigs)
- `npm run test` / `test:watch` — Vitest unit tests

### Safe Variants (use these instead of piping)
- `npm run type-check:head` / `lint:head` / `test:head` — First 20 lines. Pass `-- N` to change.
- `npm run type-check:tail` / `lint:tail` / `test:tail` — Last 20 lines.
- `npm run type-check:headtail` / `lint:headtail` / `test:headtail` — First 15 + last 15.
- `npm run type-check:filter -- "Error"` / `lint:filter` / `test:filter` — Grep output.

# UI Color Rules
- NEVER use opacity modifiers on `text-muted-foreground` (e.g. `text-muted-foreground/50`, `/30`, `/70`). The token is already a muted color — adding opacity makes text unreadable.
- Use `text-muted-foreground` only if the text is not important and you want most users to skip reading them.
- Same applies to `border-muted-foreground/` — use `border-border` or `border-muted-foreground` without opacity.

# i18n setup context
This project uses custom i18n setup for zh and en 2 languages, with a mixture of strategies:
1. `src/data/i18n-game.ts` contains auto generated translations for in-game entities. i18n-beta.ts is the add-on file for in-game entities that are in the beta (unreleased) data.
2. `src/data/game/*_zh.ts` and `src/data/game/*_en.ts` contains auto generated json files for long text for in-game data.
3. `src/data/i18n-ui.ts` contains UI string translations as `{ en: "...", zh: "..." }` objects, organized by feature section.

# i18n writing rules
- **Write for real players, not developers.** Every string must read naturally to a Genshin player. If you wouldn't say it in conversation, don't put it in the UI.
- **Chinese must be real Chinese, not abbreviated code-speak.** "等待" not "等", "长按E" not "长E", "持续产球" not "周E". Abbreviations are fine only when they're actual player community shorthand (e.g. 普攻, 重击, 下落).
- **English must be real words.** "Hold E" not "hE", "Wait" not "W", "Plunge" not "PA". Use Genshin's official English terminology when it exists (Normal Attack, Charged Attack, Elemental Skill, Elemental Burst).
- **Space-constrained labels** (e.g. timeline action blocks) can use shorter forms but must still be recognizable: "Hold E", "Tick E", "NA", "CA" are acceptable. Single-letter gibberish is not.
- **Inline i18n** (`language === "zh" ? "中文" : "English"`) is acceptable for small isolated features, but prefer adding entries to `i18n-ui.ts` for strings that appear in multiple places or are part of a larger feature.

# Data mutation map
Read `docs/data-mutation-map.md` before modifying any store, data import path, or artifact operation. It maps entities to their mutation surfaces, cross-store invariants, and enforcement mechanisms.

# Error handling conventions
Library code (`src/lib/`) follows these patterns by domain:
- **Unrecoverable / data structure invalid** → `throw new Error("descriptive message")`. Caught at UI boundary with `toast.error()`.
- **Entity not found / infeasible** → `return null`. Caller checks before use. Used in solvers, constraint checkers, optional lookups.
- **Partial success (import/conversion)** → Return `{ data, warnings: ConversionWarning[] }`. Caller shows warning count toast, continues with partial data.
- **Stateful errors with context** → Discriminated union (e.g. `{ solved: T } | { error: string }`). Caller pattern-matches on discriminant.

Do NOT introduce a generic `Result<T>` type. The above patterns are sufficient for each domain.

# Store refactor rules
Whenever a new feature requires incompatible changes to a store's data structure, always document the changes in the code during implementation. Always remember to add proper migration logic with respect to the current origin version (treat pending changes and local only commits as the same version), and add migration test to ensure old format can migrate to new data format.
It would be a good habit to version the store data so there is an easier way to check for migration logic.
When it is not possible to implement a smooth auto migration, discuss different options with user.

# Multi-agent environment
Multiple agents may be working on this repo concurrently, sharing the same working tree and terminal. Assume at all times that another agent could be reading, editing, staging, or committing files. Key implications:
- Files you didn't touch may appear staged or modified between your commands — that's another agent working, not a bug.
- Never use destructive git commands (stash, reset --hard, restore, checkout --) that would wipe uncommitted work. If an operation (e.g. rebase) absolutely requires stashing, pause and confirm with the user first.
- Race conditions on commits are acceptable — if extra files get pulled into your commit, that's fine as long as the commit message is accurate and no work is lost. Losing pending work is never acceptable.
- Don't use partial staging to isolate your files — pre-commit checks don't work with stash, and other agents may stage files between your commands.

# Commit rules
When blocked by type errors or trivial test errors, even if unrelated to the immediate commit, fix the errors so the commit can succeed. In case of complex problems, pause and ask for user preference.
All work should go to master branch unless specified. beta branch is meant for local testing of unreleased character and weapons, not for application features.

# Testing rules
When running tests (npm run test, vitest or benchmark.ts), do not repeated run expensive full suite with grep. Instead, when you must run full suite, direct output to a file under test-results/ and check the file content. Clean up files after you finished with it.