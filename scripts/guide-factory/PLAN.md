# Living Plan

This plan records the direction, not a promise that the current formats or
algorithms will survive contact with real data.

## 1. Accumulate source knowledge

- Add one source manifest before adding observations from that source.
- Prefer deterministic adapters for internal or explicitly reusable structured
  data.
- Use manual or agent-assisted proposals for unstructured editorial sources.
- Preserve missing assumptions as `unknowns`.
- Keep source-native records separate; do not join team and character advice
  merely because their IDs happen to match.

Questions to learn from real data:

- Which sources express actual rankings, tied groups, or just examples?
- How often are recommendations conditional on a team, constellation, weapon,
  or ER assumption?
- Which source formats remain stable enough for deterministic adapters?
- Which sources need permission before systematic ingestion?

## 2. Consolidate without erasing disagreement

- Normalize names to repository IDs without fuzzy matching.
- Keep a source assertion distinct from our interpretation of it.
- Preserve separate records when applicability or assumptions differ.
- Record whether a candidate supports, broadens, narrows, conflicts with, or is
  uncovered by the current GenshinTools baseline.
- Require human review before a candidate becomes accepted knowledge.

Three KQM pages have been ingested but not human-reviewed. Together they forced
separate energy guidance, explicit unranked lists, alternatives versus tied
ranks, bounded constellation applicability, exact teams versus four-slot team
templates, example-team intent, and source-defined role constraints into the
schema. The Keqing Luna I slice is specifically a source-breadth test for
refreshing an old character when a new release changes available teams; it is
not evidence that the captured Lunar-Charged teams are optimal.

## 3. Build validation tooling

Start with facts that can be checked deterministically:

- schema versions and unknown fields;
- exactly four distinct team members;
- known character, weapon, and artifact IDs;
- weapon-type compatibility;
- legal artifact and main-stat shapes;
- nonempty and duplicate-free recommendation groups;
- explicit ER units and ranges when supplied;
- positive formula counts owned by a team member;
- valid source references and stable normalization.

Do not initially validate team quality, ranking truth, rotation feasibility,
buff uptime, ER adequacy, or source authority.

Current progress: a durable corpus inventory now exposes record kinds, statuses,
explicit evidence-field counts, source attribution, and explicit-only character
presence across all 351 records. It excludes ER details from evidence and
character-presence counts while keeping the historical energy record visible in
kind/status totals. These counts are descriptive coverage only.

## 4. Compose existing computation incrementally

Only begin after source and consolidated records are useful enough to provide
real comparison targets.

Candidate experiments, in increasing scope:

1. Reproduce one authored loadout without changing it.
2. Compare one weapon or artifact choice at a time.
3. Optimize one character's full loadout in a fixed team and formula-count
   plan.
4. Refine two characters together.
5. Refine all four characters together.
6. Test substitutions for an existing team.
7. Explore new team compositions.

Each experiment must emit intermediate results and discrepancies. Unexpected
results are review cases, not automatic preset changes.

Current progress: the offline bootstrap and direct-versus-compiled damage replay
remain structural-only. A team-template coverage pass now identifies present,
uncovered, and role-unresolved roster shapes without ranking them. Two exact
KQM Quickbloom examples now substantiate one uncovered template without being
promoted into presets. The Keqing Luna I slice adds another uncovered template
and two uncovered exact teams around the new Keqing–Ineffa core. Its
off-field-Hydro and resistance-shred slots remain role constraints so broad
element matches cannot create false coverage. One exact
Furina/Neuvillette/Kazuha/Xilonen roster is independently present in KQM and the
baseline. Its source sample rotation is now translated into action counts
and compared with the calculator's 12 positive and 6 zero-count defaults under
explicit level-90, C0, R1, 10/10/10 assumptions. The comparison finds five
token-supported count mismatches and retains six unresolved formula mappings.
Neither the mapping nor either count plan is accepted yet. The next computation
step is to review or correct this translation, then add an authored
artifact-stat sheet and reproduce the selected loadout.

ER work is deferred. The Diona probe remains an assumption-incomplete
historical fixture; unrelated repository growth no longer changes its input
revision.

## 5. Derive guides only after the factory is credible

Potential derived products include:

- best-known teams for a character and investment profile;
- ranked or conditional weapon and artifact choices;
- main-stat and substat recommendations;
- ideal roll allocations for a supplied formula-count plan;
- patch-to-patch changes affecting old characters.

No result moves into `src/presets` until the data model, computation, and review
process have been explicitly accepted.

## Ask the domain owner when

- a source and the current preset disagree under apparently identical scope;
- a formula-count plan or buff assumption cannot be inferred safely;
- high-constellation behavior changes a character's role or team structure;
- an optimizer result is counterintuitive but no implementation defect is
  evident;
- a proposed consolidation rule would discard meaningful alternatives;
- source licensing or permission is unclear before systematic extraction.

Current owner-review target:

- Does each action-to-formula mapping in
  `reports/furina-neuvillette-formula-plan-draft.json` correctly translate the
  named KQM sample rotation?
- Should Neuvillette use four Judgments and two Skill instances, and should
  Xilonen use two Skill/N2 instances plus one Burst formula?
- What duration or hit-count assumptions should resolve Neuvillette's
  Spiritbreath procs, Furina's 32-hit Salon aggregate, and Kazuha's absorption
  and Swirl formulas?
- Should the first artifact allocation fixture use C0/R1, or another investment
  level that is more representative for validating the pipeline?

Deferred ER questions remain recorded in `CHECKPOINT-2.md`; they are not on the
critical path for the current repository and damage-plan work.
