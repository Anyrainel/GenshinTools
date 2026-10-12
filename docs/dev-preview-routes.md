# Development previews

The report viewers formerly mounted at `/__lab`, `/__lab/guides`, and
`/__lab/sources` have been removed, along with their dev JSON endpoint and Vite
plugin. `/__lab/optimizer` and its historical TSV experiment data were removed
earlier. These URLs now reach the ordinary not-found page.

The intended guide feature is described in
[Calculated character guides](design/calculated-character-guides.md). It has
not been implemented. Its eventual preview should use an unlisted development
route and remain absent from the app bar until explicitly promoted.

## Existing feature inventory

| Existing work | Current entry point |
| --- | --- |
| Energy calculator and rotation workflow | Team Analysis → Energy, within `/team-comp/analysis` |
| Artifact and character optimization, weapon/set choice, investment comparison | Team Analysis modes, within `/team-comp/analysis` |
| AutoTune | `/artifact-filter/weights` |
| Achievement archive | `/archive/achievements` |
| Artifact tier list | `/tier-list/artifacts` |
| Feedback | `/account/feedback`, with `/feedback` alias |
| Cloud backup and support | `/account/cloud-backup` and `/account/support` |
| Scanner download | `/download-scanner` |
| Onboarding samples | Welcome guide on Home |
| Calculator QA, particle extraction, Excel comparison, implementation audits | CLI/data-maintenance tools |

No additional complete, unrouted product page was found in this inventory.
