# Checkpoint 1: Pipeline Contact With Real Data

Date: 2026-08-28

This checkpoint establishes an offline data path. It does not establish a
guide-generation algorithm or a final schema.

## Materialized inputs

- 71 current GenshinTools team presets, all with unique compositions;
- 120 current character-guide records containing 188 builds, 180 of which are
  visible;
- 139 legacy candidate teams, all with unique compositions.

Consolidation produces 330 separately attributable records:

- 191 `baseline` records from current GenshinTools presets;
- 139 `candidate` records from the legacy research file;
- 210 team records and 120 character-guide records in total.

The team and character-guide records remain separate. The source files do not
say which character-wide build belongs on a member of a particular team, so a
join would invent knowledge.

The legacy `sourceDpsIndex` remains in its source snapshot but is not yet
promoted to a canonical role field. Its exact intended semantics have not been
confirmed, and naming it "main DPS" in the consolidated schema would make that
interpretation look stronger than the source provenance supports.

## Changes forced by the data

The first import invalidated three assumptions in the initial format:

1. A 2-piece choice is not a pair of artifact-set IDs. The presets use
   effect-group IDs such as `atk%-18` and `hp%-20`. The consolidated field is
   therefore `halfSetIds`, and it is validated against the application's
   half-set catalog.
2. The legacy source uses `freeze` and `overload`, while application records use
   `frozen` and `overloaded`. The raw snapshot preserves the source terms and
   consolidation applies only those two explicit mappings.
3. Three legacy 2-piece-plus-2-piece rows name concrete sets rather than
   effect groups. Their source snapshots retain those set IDs and separately
   record the derived `hp%-20` effect groups; canonical records contain only
   the latter.

These are small corrections, but they demonstrate why source-shaped snapshots
must remain separate from the consolidated representation.

## Objective validation result

The live pipeline currently reports 0 errors and 12 warnings. All warnings are
weapon-type mismatches retained in the legacy candidate source:

- Escoffier with `silvershower_heartstrings`: 5 records;
- Ineffa with `kaguras_verity`: 3 records;
- Iansan with `peak_patrol_song`: 1 record;
- Zibai with `redhorn_stonethresher`: 1 record;
- Illuga with `redhorn_stonethresher`: 1 record;
- Flins with `cashflow_supervision`: 1 record.

The same defect would be an error on a `baseline` or `accepted` record. On a
candidate it remains a warning and a promotion blocker, allowing imperfect
source evidence to stay inspectable without making it accepted knowledge.

Validation currently checks schemas, IDs, weapon compatibility, artifact and
stat legality, duplicate choices, provenance hashes and locators, formula-line
ownership, deterministic output, and the offline/runtime dependency boundary.
It does not judge team quality, ranking truth, ER adequacy, rotations, buff
coverage, or damage realism.

## Coverage observations, not conclusions

- 28 legacy team compositions also occur in the current baseline.
- 111 legacy compositions are absent from the current baseline.
- Current team presets contain no ER floors.
- Neither active source contains formula-count plans.
- The current character guides contain 127 weapon entries across 109
  characters, with at most 3 entries for one character.

The 111 additional compositions are leads for review, not proof of useful
coverage. The legacy rows have no per-row external locator, patch, investment,
rotation, or refinement assumptions.

## Next empirical checkpoint

1. Add a small, reviewable sample from one external source with exact page or
   video-section locators.
2. See which conditional assumptions cannot be represented without stretching
   the schema.
3. Compare only like-scoped observations with the current baseline and retain
   disagreements.
4. Use one accepted team plus an explicitly supplied formula-count plan to
   replay an authored loadout through existing calculation code.
5. Record intermediate calculator inputs and discrepancies before attempting
   any equipment or team search.

Planned sources in the registry are not yet ingested knowledge. Their format
labels and permission states are routing decisions for future experiments, not
claims that an adapter already exists.

## Structural computation seam

After the data and validation loop passed, one deliberately non-authoritative
fixture exercised the existing calculator offline. It cites the current Eula
team only for roster, selected weapons, and selected artifact sets; C0/R1,
level 90, 10/10/10 talents, empty artifact sheets, enemy context, and one Eula
Skill tap are explicit test assumptions.

The direct and compiled calculator paths produced normalized totals of
`5221.96635101425`, differing by about `9.09e-13`. Missing formulas are rejected
before evaluation, and the fixture fails if its cited loadout drifts from the
consolidated record. This proves the offline integration seam, not the damage
model or a guide recommendation.

The computation inventory also found assumptions that must be resolved before
reusing higher-level tools. In particular, AutoTune's fixed context currently
uses `enemyRes: 10` while normal calculator/analyzer defaults use `0.1`; omitted
AutoTune formulas become one count of every available formula, and teammate
sheets are simplified. No production code was changed in this checkpoint.
