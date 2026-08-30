# Checkpoint 41: authenticated cached-policy robustness census

This checkpoint replaces checkpoint 40's single-start impression with an
exhaustive census inside the same authenticated 36-node cached technical table.
It evaluates one-shot and best-improvement policies from all 36 starts, then
declared first improvement for all 864 structurally effective orders from every
start. It generates and evaluates no new equipment.

The objective is still unreviewed and source-not-ready. These results describe
deterministic behavior inside one finite cached table; they are not equipment
advice, gameplay validation, damage or DPS claims, global optimality, scalar
weights, or a character guide.

## Authentication boundary

The source-specific wrapper authenticates exactly three selected non-self
inputs before running the census:

- checkpoint 40's cached-policy audit;
- `scripts/guide-factory/src/boundedLatticePolicy.ts`; and
- `scripts/guide-factory/src/boundedLatticePolicyCensus.ts`.

Checkpoint 40 passes its full report guard before its 36-node table is
projected. Review diagnostics and occurrence rows are authenticated provenance
but are excluded from the census input, objective, and policy filters. The
input projection SHA-256 is
`86fb2b9c41881840b348adc66dffa5d4f4a198a67ec6609363095af22793d294`;
the census payload SHA-256 is
`a98fd6d0c708be4f7b6974df0c2ae0021f693faa7577b9ee9ee517dccda5e986`.

## All-start policy behavior

Across the 36 one-shot starts, 34 traces move once and two are unchanged.
Twelve results are local terminals; 24 stop outside the local-terminal set
because the policy deliberately performs only one pass.

Best improvement reaches the checkpoint-40 reference terminal from 24 starts
and the other local terminal from 12 starts. Its traces require zero to three
moves: two starts are already terminal, 10 take one move, 16 take two, and
eight take three.

The declared-order family contains 3,456 syntactic orders but only 864
structurally effective orders after dimensions with a single alternative at a
given coordinate are normalized. Across all starts this is 31,104 traces:

- 18,576 terminate at the cached-table reference;
- 12,528 terminate at the other local terminal;
- the start partitions collapse to 13 distinct families;
- complete paths collapse to 96 distinct all-start path families; and
- the longest trace makes seven moves.

The order-family, trace-signature, and all-start path-family SHA-256 values are:

- `1aa53446b8ea6217a0e146fcd56cd873c4a251ed15292a28e85cd387b25d09bc`;
- `45a21703b88d5c2b71f314c01f5754a87e4b3dbde8e7b44ba7e7a9bc88875418`;
  and
- `83a1a9267c7adb0b2a9c2f98293a857179784a55c11b930d30dda0b9a780c1c7`.

The census therefore confirms both start sensitivity and declared-order
sensitivity inside this bounded case. It does not convert either observation
into a ranking or recommendation.

## Execution and ER boundary

The default census reports 31,177 cached policy calls: 36 one-shot traces, 36
best-improvement traces, 31,104 declared-order traces, and one reference
selection. It attests zero generator, evaluator, damage-replay, downstream
optimizer, recommendation, rank, and ER calls in that environment. Injected
builders do not claim those side-effect attestations.

Checkpoint-40 ER-deferral provenance is read only as part of upstream
authentication. No ER value enters the census input or affects a policy, and no
ER calculation is performed.

## Durable evidence and next boundary

The checked-in report is
`keqing-ineffa-furina-xilonen-cached-policy-robustness-census.json`. Its byte
SHA-256 is
`c446dec2027cc2b77d20d46ea8d521d3ae4f43f798f34715a4c4ddb771ac2b73`
and its size is 71,373 bytes. It is durable report 38 overall and globally
integrated report 37.

Every guide, recommendation, rank, scalar-weight, damage, gameplay,
optimality, promotion, and ER capability remains false. The next non-ER step
should leave this cached Keqing case and use the expanded source repository to
test a second character/team slice, rather than tuning a policy around one
technical objective.
