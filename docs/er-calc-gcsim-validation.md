# ER Calculator — gcsim Validation Plan

## Purpose
Use gcsim's Monte Carlo simulation as a secondary validation system for our deterministic ER calculator. gcsim is the most accurate Genshin combat simulator available.

## Setup
1. Download gcsim CLI from https://github.com/genshinsim/gcsim/releases
2. Write gcsim config files for our preset team rotations
3. Run simulations and extract ER data from logs
4. Compare against our calculator's output

## gcsim Config Format
```
# National team example
bennett char lvl=90/90 cons=0 talent=9,9,9;
bennett add weapon="favoniussword" refine=1 lvl=90/90;
xiangling char lvl=90/90 cons=0 talent=9,9,9;
xingqiu char lvl=90/90 cons=0 talent=9,9,9;
sucrose char lvl=90/90 cons=0 talent=9,9,9;

# Action list
active bennett;
bennett attack, skill;
xiangling burst, skill;
# ... etc

options iteration=1000;
```

## Metrics to Compare
- ER% needed per character to burst every rotation
- Total particle energy per character per rotation
- Flat energy contributions
- Which Q is the binding constraint

## gcsim Architecture (from source code analysis)

Key files:
- `pkg/core/player/character/energy.go` — `ReceiveParticle()` with element matching and off-field penalty
- `pkg/optimization/optstats/energy_stats.go` — ER calculation with `IgnoreBurstEnergy` flag
- Character skill files (e.g., `internal/characters/xiangling/guoba.go`) — particle generation with callbacks

### How gcsim handles energy:
1. **Particle distribution**: All team members receive particles simultaneously via `DistributeParticle()`
2. **Element matching**: Same=3, Clear=2, Different=1 (identical to our model)
3. **Off-field penalty**: `1 - 0.1 × partyCount` = 0.6× for 4-man (identical)
4. **Particle travel time**: ~100 frames (1.67s) from generation to absorption
5. **Energy drain delay**: Character-specific (e.g., 24 frames for Xiangling) — NOT instant
6. **NA energy**: ~1 Clear orb per 10 normal attacks (weapon-class-dependent, 12-frame ICD)
7. **ER formula**: `erNeeded = (burstCost - flatEnergy) / rawParticles` (identical to ours)

### Periodic generators in gcsim:
- Guoba: fires breath at frames 103, 203, 303, 403 after spawn, on-hit callback
- Oz: ticks every 59 frames, 67% proc chance per tick, on-hit callback
- Both use on-hit callbacks = particles generated when damage hits enemy, not on spawn

## Expected Differences
- gcsim uses Monte Carlo (probabilistic); we use deterministic expected values
- gcsim has frame-precise particle timing; we use absorber rules
- gcsim models NA energy; we don't (minor: <5% of total energy typically)
- gcsim handles energy drain delay; we assume instant drain
- Expected deviation: 5-15% for well-structured rotations
- Systematic >20% deviation indicates a calculation bug in our model

## When to Run
- After significant engine changes
- When adding new team presets
- Before major releases
