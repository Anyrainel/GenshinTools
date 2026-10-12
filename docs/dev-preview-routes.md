# Unlisted development previews

Run `npm run dev`, then open these URLs on the dev-server origin (normally
`http://127.0.0.1:5173`). They are absent from the app bar and enabled only when
`import.meta.env.DEV` is true. A production build serves its ordinary not-found
page for these paths.

| Route | What can be tested |
| --- | --- |
| `/__lab` | Index of available experiments and links to existing app features |
| `/__lab/guides` | Six saved Noelle draft packets, their team/equipment/stat observations, missing choices and publication blockers |
| `/__lab/sources` | Character-filtered source records, saved build observations, source links and unresolved assumptions |

The guide page is a view of the actual generated packets, currently limited to
Noelle. Other characters have source records but not portable completed guide
packets. The page preserves null selections, missing ER/rotation/damage values,
and withheld publication. Viewing a source option never assigns equipment or
promotes a recommendation. It does not run the guide pipeline or change stores.

Use `npm run guide:rebuild` to refresh offline reports, then **Reload snapshot**
on the page. The timestamp is the saved guide report's modification time.

The Vite dev-only plugin reads fixed local artifacts and exposes a read-only
JSON projection at `/__dev/lab-preview.json`. Browser code never imports
`scripts/guide-factory`, and the preview page, transport, and report payloads are
excluded from the production client bundle. Missing/invalid reports produce a
visible error with a rebuild hint, not invented defaults.

## Other feature inventory

| Existing work | Current entry point / assessment |
| --- | --- |
| Energy calculator and rotation workflow | Team DMG → Energy, within `/team-comp/analysis`; already integrated |
| Artifact and character optimization, weapon choice, investment comparison | Existing Team Analysis modes; already integrated |
| AutoTune | `/artifact-filter/weights`; already integrated |
| Achievement archive | `/archive/achievements`; already in archive navigation |
| Artifact tier list | `/tier-list/artifacts`; already in tier-list navigation |
| Feedback | `/account/feedback`, with `/feedback` alias; linked from the account menu |
| Cloud backup and support | `/account/cloud-backup` and `/account/support`; account-menu tools |
| Scanner download | `/download-scanner`; linked from scanner/onboarding flows |
| Onboarding sample previews | Existing welcome guide on Home; sample content, not standalone calculators |
| Calculator QA, particle extraction, Excel comparison, implementation audits | CLI/data-maintenance tools; no complete interactive feature to route. Keep execution in tooling. |

The source library is a safe read-only preview added here.
The inventory found no additional complete, unrouted product page requiring
promotion. Future experiments can follow the same dev-only route and artifact
boundary without adding a main navigation item.
