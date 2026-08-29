# ArtifactRatingDB source profile

Proposed registry ID: `artifact-rating-db`

Status: planned. Permission posture: mixed. The pilot remains isolated from the
shared source registry and consolidation pipeline.

## Pinned pilot slice

The first slice preserves the Keqing entry from the public ArtifactRatingDB
repository at commit
`255c084b0c35c33519d554c2532054fec57119cf`:

- repository: <https://github.com/pizza-studio/ArtifactRatingDB>;
- source file: `Sources/ArtifactRatingDB/Resources/ARDB4GI.json`;
- source-file SHA-256:
  `af2f8f0bd3a33b4dc633b521c81ab89fb2e48dd307be26480c1868213835dada`;
- source-file byte length: `160813`;
- native avatar ID: `10000042`;
- normalized local character ID: `keqing`.

The canonical JSON digest of the extracted raw Keqing model is
`0dc083b90bb4e2c11b747270da6b66d2b8ae81a9fe3d300d241846fd281f618c`.

The upstream README credits the Keqing data model to Wu Xiaoyun, `(c) 2023
and onwards Alice Workshop`, under the MIT License. It also says that the
Genshin model method is the same as Mobyw's method. The repository README
applies AGPL-3.0-or-later to its Swift program files. The snapshot retains
these scopes separately instead of assuming that one license statement covers
every repository artifact. The pinned tree contains the repository's AGPL
license text but no separate full MIT notice for the Keqing model, so the
permission review must determine the required third-party notice or obtain
clarification before this pilot is broadened or redistributed as active data.

## Source-shaped format

`artifact-rating-model-v1` stores one source-native model entry. It retains the
raw `main`, `max`, and `weight` fields, including raw stat keys and numeric
coefficients. A parallel normalized view maps every raw stat key to the local
stat ID while retaining the coefficient exactly. The upstream field name
`weight` appears only inside the raw payload; locally these numbers are called
source-native heuristic coefficients.

The format explicitly records team, role variant, weapon, constellation, and
scenario as unknown. Object key order is not evidence. The model does not
establish marginal output sensitivity, ordinal priority, equipment advice,
team applicability, or joint optimization quality.

`SPRatioBase` is preserved and normalized to `er`, but its handling is
`ignored-deferred-energy`. Nothing in this pilot supplies a playable sequence
or an energy target.

## Validation boundary

The standalone validator requires:

- the exact repository commit, source path, URL, byte length, and file digest;
- the method, author, copyright, and license lineage;
- a one-to-one match between every raw key/coefficient and normalized entry;
- the reviewed native-avatar-to-local-character mapping;
- a local character that is present in the released catalog, not only beta;
- every `SPRatioBase` occurrence to remain present and ignored/deferred.

The snapshot is a validation-only pilot. It is not an input to the consolidated
knowledge repository or any published application bundle.

## Permission and integration gate

The narrow Keqing attribution is explicit, but corpus-wide reuse still needs a
review of the JSON aggregation and each credited model scope. Until that review
is complete, keep registry status `planned`, permission `mixed`, and
consolidation blocked. Shared registry, path, validation-runner, and format
documentation integration should happen only after that decision.
