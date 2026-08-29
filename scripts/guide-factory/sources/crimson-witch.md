# Crimson Witch source profile

Registry ID: `crimson-witch`

Status: planned and permission-required. No active snapshot is permitted yet.

## Current source shape

The site was checked on 2026-08-29. Its public pages expose a large catalog of
character, weapon, and artifact routes through a JavaScript application. The
homepage response is a Next.js server payload rather than a documented public
recommendation API. This makes a deterministic adapter technically plausible,
but technical accessibility is not a reuse grant or a stable data contract.

The visible legal page contains the HoYoverse affiliation and ownership
disclaimer. It does not grant permission to reproduce or systematically derive
the site's authored build recommendations. The contact page provides the route
for requesting permission.

## Repository boundary

Until written permission or a documented reusable feed exists:

- do not add a Crimson Witch file to `manual-index.json`;
- do not reverse-engineer or retain its application payload as a guide corpus;
- do not treat route availability as evidence for a build recommendation;
- keep comparisons private and human-directed, or link users to the source;
- do not use its recommendations as uncredited optimizer targets.

## Adapter shape if permission is obtained

A future source-specific adapter should pin the source payload revision and
preserve one publisher-native build as one observation. It should retain:

- character, build label, role labels, and investment or constellation scope;
- artifact-set choices and main/substat recommendations;
- weapon alternatives and any actual ordering encoded by the source;
- team or teammate links only when the source record binds them to that build;
- exact source route, capture date, and any source-native record identifier;
- missing methodology, rotation, ER, and ranking assumptions as unknowns.

The adapter must first write and validate a source-shaped snapshot. It must not
write consolidated knowledge directly, and it must not turn route order or UI
layout into recommendation order.
