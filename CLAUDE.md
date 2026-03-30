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