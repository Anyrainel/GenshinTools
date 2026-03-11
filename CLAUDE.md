Read AGENTS.md for project context if needed.

# UI Color Rules
- NEVER use opacity modifiers on `text-muted-foreground` (e.g. `text-muted-foreground/50`, `/30`, `/70`). The token is already a muted color — adding opacity makes text unreadable.
- Use `text-muted-foreground` as-is for muted text. If you need even less emphasis, consider hiding the element or using a different approach, not opacity.
- Same applies to `border-muted-foreground/` — use `border-border` or `border-muted-foreground` without opacity.