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

The consolidated schema is expected to change after the first external source
is ingested and reviewed.

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

Current progress: the offline bootstrap, formula-coverage gate, buff-override
construction, and direct-versus-compiled replay have been exercised with a
structural-only fixture. The next step is still experiment 1 with a
human-reviewed combo and artifact stat sheets; the structural fixture is not an
authored loadout target.

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
