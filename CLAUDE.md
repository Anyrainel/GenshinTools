Read AGENTS.md for project context if needed.

# UI Color Rules
- NEVER use opacity modifiers on `text-muted-foreground` (e.g. `text-muted-foreground/50`, `/30`, `/70`). The token is already a muted color — adding opacity makes text unreadable.
- Use `text-muted-foreground` only if the text is not important and you want most users to skip reading them.
- Same applies to `border-muted-foreground/` — use `border-border` or `border-muted-foreground` without opacity.

# Store refactor rules
Whenever a new feature requires incompatible changes to a store's data structure, always document the changes in the code, and also immediately add proper migration logic, and add migration test to ensure old format can migrate to new data format.
It would be a good habit to version the store data so there is an easier way to check for migration logic.
When it is not possible to implement a smooth auto migration, discuss different options with user.

# Commit rules
When creating a commit from a subset of pending changes, do not use git commands that would override remaining file content (stash, reset, restore, etc). Always assume there are other agents working on them, and must not be disrupted.
When blocked by type errors or trivial test errors, even if unrelated to the immediate commit, fix the errors so the commit can succeed. In case of complex problems, pause and ask for user preference.