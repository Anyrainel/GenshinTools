# Genshin Tools

**English** | [简体中文](README.zh-CN.md)

<div align="center">

### Practical planning tools for Genshin Impact accounts, builds, teams, and game data.

[Launch Tool](https://ggartifact.com)

</div>

---

## What It Does

Genshin Tools helps you turn account data, build targets, and team plans into concrete decisions: what to build, what to lock, what to upgrade, and how a team changes under different optimization choices.

## Tools

### Account Data

Import account data and use it across the app.

- **Characters**: browse owned characters, equipped artifacts, artifact scores, and edit account records.
- **Inventory**: inspect weapons, artifacts, and characters; sync from game; review when account data was last updated.
- **Recommendations**: find artifact swaps and upgrades by character priority, then send eligible equip plans to the Artifact Manager flow.
- **Evaluation**: evaluate configured builds against your current artifacts and see build completion by set and character.
- **Resources**: plan Sanctifying Essence, Sanctifying Elixir, and Dust of Enlightenment spending.
- **Triage**: decide which artifacts to lock, unlock, or leave protected, with apply-to-game lock instructions.

Supported import sources include GOOD JSON exports, Enka UID imports, and HoYoLAB imports.

### Artifact Filter

Configure character build targets and turn them into filter outputs.

- **Configure**: define each character's artifact sets, stat weights, weapon assumptions, and build visibility.
- **Compute Filters**: merge configured builds into artifact set/slot filters for farming and filtering workflows.
- **AutoTune**: derive build weights from team damage context when you want an advanced starting point.

### Team Comp

Build, compare, and optimize teams.

- **Damage**: calculate team damage with buffs, reactions, resonance, enemy assumptions, and transparent formula details.
- **Frozen**: review frozen artifact/team results and export batch equip instructions.
- **Investment**: compare constellation, refinement, and other investment changes for a selected team.
- **Weapon Choice**: compare weapon options and artifact reassignment choices for a selected team.

### Tier List

Create and share personal ranking boards.

- **Characters**: maintain character priorities that also feed account recommendations.
- **Weapons**: make weapon tier lists for reference or sharing.
- **Artifacts**: make artifact set tier lists by category.
- **Export**: save/load JSON and export high-quality images.

### Archive

Look up bundled game data without leaving the app.

- **Characters**: kits, stats, passives, constellations, glossary, and embedded build/account context.
- **Weapons**: weapon stats, passives, rarity, type, and ownership context.
- **Artifacts**: artifact set effects, half-set filtering, and set details.
- **Bosses**: ley line boss data with schedule-aware selection and detail panels.

## Localization & Theming

- English and Simplified Chinese UI
- Multiple generated theme palettes with element-aware styling

## Development

```bash
npm install
npm run dev
npm run type-check
npm run lint
npm run test
npm run build
```

Useful variants:

- `npm run dev:wrangler` starts Vite behind Wrangler Pages dev.
- `npm run depcheck` checks dependency boundaries.
- `npm run regtest` runs artifact generator regression tests.

## Tech Stack

- React 19, TypeScript, Vite 7
- Tailwind CSS, shadcn/ui, Radix primitives, Vaul, Lucide icons
- Zustand with Immer and persist middleware
- Cloudflare Pages/Workers

## Contributing

Issues and pull requests are welcome. For larger changes, please keep behavior scoped to the relevant page family and include focused validation.

---

Fan-made tool. Not affiliated with HoYoverse.
