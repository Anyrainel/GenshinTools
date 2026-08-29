# gcsimactions source profile

Registry ID: `gcsimactions`

Status: permission-blocked. No active snapshot is permitted.

## Why it is interesting

The archived repository describes itself as a collection of community-
contributed gcsim action lists. Its TOML files bind four-character rosters to
weapons, artifact sets, stats, assumptions, and executable-looking action
lists. That makes the repository a potentially useful future parser fixture or
coverage canary: it can reveal team and equipment combinations that the active
knowledge repository does not yet contain.

Those configurations are not current guide truth. They were authored under an
old simulator and action-list language, and their assumptions belong to the
individual contributed configuration rather than to gcsim generally.

## Current blockers

The repository was audited on 2026-08-29 at commit
`8473e2e39acd1ff2705198feca5bbbe94320ac0d`.

- GitHub marks it archived and read-only.
- No repository license file or contributor-data reuse grant was found.
- The current gcsim migration guide says APL mode was removed and that there is
  no clean automatic APL migration. A migrated configuration would need new
  control flow and renewed gameplay validation.
- The archive's files are contributor-authored observations. The gcsim engine's
  license does not automatically establish permission for this separate
  configuration corpus.

## Repository boundary

Until both permission and migration provenance are resolved:

- do not add a gcsimactions file to `manual-index.json`;
- do not vendor its TOML files or derived team/build records;
- do not execute old configurations and treat the result as current evidence;
- do not silently translate APL conditions into a modern rotation;
- do not use the archive as a ranking, damage, ER, or optimality target.

If permission is established, the first implementation should be a pinned,
source-specific parser fixture. It should preserve the contributor, original
path and commit, original config text hash, legacy language mode, character and
equipment assumptions, and migration diagnostics. Migrated simulations must be
stored separately from the source snapshot and cannot become accepted gameplay
evidence until independently revalidated.
