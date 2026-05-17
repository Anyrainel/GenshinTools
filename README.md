# GGArtifact

**English** | [简体中文](README.zh-CN.md)

<div align="center">

### Manage artifacts, optimize team damage, and track build progress from your Genshin Impact account data.

[Open GGArtifact](https://ggartifact.com)

</div>

---

## What You Can Do

- **Manage artifacts**: auto lock, unlock, keep, upgrade, and craft candidates from your inventory and build targets.
- **Optimize team damage**: give a team the full inventory and find stronger artifact assignments for its damage target.
- **Assess build progress**: score current builds, compare gaps, and see which characters still need better pieces.
- **Compute in-game filters**: convert character build goals into artifact set and slot filter rules.
- **Theorycraft choices**: compare weapons, artifact assignments, constellations, and refinements with visible assumptions.
- **Make shareable boards**: build character, weapon, and artifact tier lists, then export images or JSON.
- **Look up game data fast**: browse bundled characters, weapons, artifact sets, and ley line bosses without leaving the app.

## Start Here

- **Import account data** with GOOD JSON, GOODScanner / GOODCapture, Enka UID, or HoYoLAB / Miyoushe.
- **Set character priorities** in Tier List so account recommendations know which builds matter most.
- **Review character builds** in Account Data when you want scores, build gaps, and upgrade suggestions.
- **Optimize a team** in Team DMG when you want the best artifact assignment from your inventory.

## Tools

### Account Data

Use imported account data to manage artifacts and decide which character builds are worth improving next.

- Import GOOD JSON, Enka UID data, or HoYoLAB / Miyoushe character data.
- Browse owned characters, equipped artifacts, weapons, inventory records, and artifact scores.
- Edit imported character, weapon, and artifact records when source data needs correction.
- Allocate artifacts across character priorities and estimate score-up, upgrade, or craft value.
- Evaluate configured artifact builds against your current account data.
- Plan Sanctifying Essence, Sanctifying Elixir, and Dust of Enlightenment spending.
- Generate artifact lock, unlock, and keep guidance for triage workflows.

### Builds

Define artifact build targets and turn them into practical farming or filtering rules.

- Configure artifact sets, main stats, substat weights, weapon assumptions, and build visibility.
- Import curated build presets or export your own build configuration as JSON.
- Compute artifact set and slot filters from configured builds.
- Use AutoTune to derive starting weights from team damage context.

### Team DMG

Model teams, then optimize their damage against your available inventory.

- Import team presets or maintain your own team list.
- Calculate team damage with buffs, reactions, resonance, enemy assumptions, and formula detail.
- Search for stronger artifact assignments from your account inventory.
- Save and review frozen optimization results.
- Compare constellation, refinement, and other investment changes.
- Compare weapon and artifact reassignment options for a selected team.

### Tier List

Maintain personal ranking boards for planning and sharing.

- Build character, weapon, and artifact tier lists.
- Import presets, edit entries, filter the board, and export JSON.
- Export tier-list images for sharing.
- Use character priorities as one input for account-data recommendations.

### Archive

Browse bundled game data without opening another reference site.

- Character kits, stats, passives, constellations, and glossary notes.
- Weapon stats, passives, rarity, and type filters.
- Artifact set effects and half-set filtering.
- Ley line boss data with schedule-aware selection.

## Import And Data Notes

- Full inventory workflows depend on GOOD-format exports or companion tools such as GOODScanner / GOODCapture.
- Enka UID import is limited to public showcase characters and their equipment.
- HoYoLAB / Miyoushe import requires a user-provided cookie.
- App data is primarily stored in the browser. Optional account sign-in enables Cloud Backup for supported saved app data.

## Local Development

```bash
npm install
npm run dev
npm run type-check
npm run lint
npm run test
npm run build
```

Useful variants:

- `npm run dev:worker` starts the local Worker dev server.
- `npm run depcheck` checks dependency boundaries.
- `npm run regtest` runs artifact generator regression tests.
- `npm run check:worker` runs Worker config, build, test, and dry-run checks.

## Built With

- React 19, TypeScript, Vite 7
- Tailwind CSS, shadcn/ui, Radix primitives, Vaul, Lucide icons
- Zustand with Immer and persist middleware
- Cloudflare Workers

---

Fan-made tool. Not affiliated with HoYoverse.
