Read AGENTS.md for project context if needed.

# UI Color Rules
- NEVER use opacity modifiers on `text-muted-foreground` (e.g. `text-muted-foreground/50`, `/30`, `/70`). The token is already a muted color — adding opacity makes text unreadable.
- Use `text-muted-foreground` only if the text is not important and you want most users to skip reading them.
- Same applies to `border-muted-foreground/` — use `border-border` or `border-muted-foreground` without opacity.