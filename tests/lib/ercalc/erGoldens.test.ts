import { beforeAll, describe, expect, it } from "vitest";

import { charInfo } from "@/data/charInfo";
import { characterStatsResource } from "@/data/gameStatsLoader";
import { particles } from "@/lib/ercalc/constants";
import {
  autoPlacePeriodic,
  calculateTeamERSequence,
  hasPeriodicGeneration,
  toTeamMember,
} from "@/lib/ercalc/erCalculator";
import type {
  ActionType,
  ERCalculationSegment,
  ERTimeline,
  ParticleMode,
  PeriodicProc,
  TeamSlot,
  TimelineAction,
} from "@/lib/ercalc/types";

/**
 * Solved-ER goldens for canonical teams.
 *
 * Every other assertion in this suite checks intermediate accumulators
 * (`flatEnergy`, `scalableEnergy`, `particleEnergy`). That is how a wrong
 * `erScale` formula shipped while `scalableEnergy` stayed correct — the
 * accumulator was right and the answer was wrong. These goldens pin the number
 * the user actually reads, across all three scenarios and both particle modes,
 * so any energy-model change produces a reviewable diff.
 *
 * WHEN A NUMBER CHANGES: do not re-baseline silently. Record which defect fix
 * moved it and why the new value is correct, in docs/er-calc-ga-plan.md.
 *
 * THE BASELINE IS NOT GROUND TRUTH. Drivers and batteries already land close
 * to community figures (Raiden National: Bennett ~197%, Xingqiu ~190%), but
 * off-field generators still read high — Xiangling ~333% against a community
 * figure near 200-230%, Raiden ~400% against ~200-250%. That gap is expected:
 * it is the predicted symptom of the proc distribution and absorber defects
 * (B1-B4 in the GA plan). Phase 1 fixes should move these numbers DOWN toward
 * community values, and Phase 6 adds the gcsim corpus that turns "closer to
 * community" into a measurable gate.
 */

function slot(charId: string): TeamSlot {
  const info = charInfo[charId];
  const element = particles[charId]?.element;
  if (!info) throw new Error(`charInfo missing for ${charId}`);
  if (!element) throw new Error(`particles missing for ${charId}`);
  return {
    charId,
    element: element as TeamSlot["element"],
    burstCost: info.energy,
    constellation: 0,
    talentLevels: [10, 10, 10],
    healAction: info.healAction,
  };
}

/**
 * Compact timeline authoring: "bennett:E" | "xiangling:Q" | "fischl:wait".
 *
 * Periodic procs (Guoba, Oz, Raiden's Eye, …) are auto-placed with the same
 * `autoPlacePeriodic` the UI calls when a trigger action is added, so a golden
 * reflects what a user actually gets rather than a timeline with every
 * off-field generator silently contributing zero.
 */
function tl(...spec: string[]): ERTimeline {
  const actions: TimelineAction[] = spec.map((s) => {
    const [char, action] = s.split(":");
    return { char, action: action as ActionType };
  });

  const periodic: PeriodicProc[] = [];
  actions.forEach((act, i) => {
    const trigger: "E" | "Q" | null =
      act.action === "E" || act.action === "holdE" || act.action === "specialE"
        ? "E"
        : act.action === "Q" || act.action === "specialQ"
          ? "Q"
          : null;
    if (!trigger || !hasPeriodicGeneration(act.char, trigger)) return;
    periodic.push(...autoPlacePeriodic(actions, i, act.char, trigger));
  });

  return { actions, periodic };
}

interface Scenario {
  name: string;
  startFull: boolean;
  isRepeating: boolean;
}

/** The three scenarios the feature exists to answer. */
const SCENARIOS: Scenario[] = [
  // (2) zero start, fixed sequence, no repeat
  { name: "zero-start-once", startFull: false, isRepeating: false },
  // (1) zero start, rotation repeats — warmup then steady state
  { name: "zero-start-repeat", startFull: false, isRepeating: true },
  // (3) full start, sustain the rotation forever
  { name: "full-start-repeat", startFull: true, isRepeating: true },
];

const MODES: ParticleMode[] = ["expected", "max"];

interface GoldenTeam {
  name: string;
  chars: string[];
  loop: ERTimeline;
}

/** Repeat one action spec n times — driver NA chains dominate real rotations. */
function rep(spec: string, n: number): string[] {
  return Array.from({ length: n }, () => spec);
}

// Rotations approximate real ~20s community rotations: support skills and
// bursts up front, then the on-field driver's normal-attack chain. The NA chain
// matters twice over — it carries NA on-hit energy, and it supplies the action
// slots that off-field summon ticks land on.
const TEAMS: GoldenTeam[] = [
  {
    name: "national",
    chars: ["xiangling", "xingqiu", "bennett", "chongyun"],
    loop: tl(
      "xingqiu:E",
      "xingqiu:E",
      "xingqiu:Q",
      "xiangling:E",
      "xiangling:Q",
      "bennett:E",
      "bennett:Q",
      "chongyun:E",
      "chongyun:Q",
      ...rep("chongyun:NA", 10)
    ),
  },
  {
    name: "raiden-national",
    chars: ["raiden_shogun", "xiangling", "xingqiu", "bennett"],
    loop: tl(
      "xingqiu:E",
      "xingqiu:E",
      "xingqiu:Q",
      "xiangling:E",
      "xiangling:Q",
      "bennett:E",
      "bennett:Q",
      "raiden_shogun:E",
      "raiden_shogun:Q",
      ...rep("raiden_shogun:NA", 10)
    ),
  },
  {
    name: "sara-raiden",
    chars: ["raiden_shogun", "kujou_sara", "xiangling", "bennett"],
    loop: tl(
      "bennett:E",
      "bennett:Q",
      "xiangling:E",
      "xiangling:Q",
      "kujou_sara:specialE",
      "kujou_sara:Q",
      "raiden_shogun:E",
      "raiden_shogun:Q",
      ...rep("raiden_shogun:NA", 10)
    ),
  },
  {
    name: "dori-battery",
    chars: ["dori", "fischl", "xiangling", "bennett"],
    loop: tl(
      "fischl:E",
      "dori:E",
      "dori:Q",
      "xiangling:E",
      "xiangling:Q",
      "bennett:E",
      "bennett:Q",
      ...rep("bennett:NA", 10)
    ),
  },
  {
    name: "furina-neuvillette",
    chars: ["furina", "neuvillette", "xingqiu", "bennett"],
    loop: tl(
      "xingqiu:E",
      "xingqiu:E",
      "xingqiu:Q",
      "furina:E",
      "furina:Q",
      "bennett:E",
      "bennett:Q",
      "neuvillette:E",
      "neuvillette:Q",
      ...rep("neuvillette:CA", 6)
    ),
  },
  {
    name: "freeze-mona-ganyu",
    chars: ["ganyu", "mona", "diona", "kaeya"],
    loop: tl(
      "diona:E",
      "kaeya:E",
      "mona:E",
      "mona:Q",
      "diona:Q",
      "kaeya:Q",
      "ganyu:E",
      "ganyu:Q",
      ...rep("ganyu:CA", 6)
    ),
  },
];

function solve(team: GoldenTeam, sc: Scenario, mode: ParticleMode) {
  const members = team.chars.map((c) => toTeamMember(slot(c)));
  const segments: ERCalculationSegment[] = [
    { timeline: team.loop, source: { kind: "loop", iteration: "first" } },
  ];
  if (sc.isRepeating) {
    segments.push({
      timeline: team.loop,
      source: { kind: "loop", iteration: "subsequent" },
    });
  }
  const results = calculateTeamERSequence(members, segments, {
    particleMode: mode,
    startFull: sc.startFull,
    isRepeating: sc.isRepeating,
  });
  return Object.fromEntries(
    results.map((r) => [
      r.characterId,
      r.erNeeded === Number.POSITIVE_INFINITY
        ? "IMPOSSIBLE"
        : Math.round(r.erNeeded * 10) / 10,
    ])
  );
}

describe("ER goldens — solved requirements for canonical teams", () => {
  // `getTalentParam` throws unless character stats are loaded, and
  // `resolveParamAmount` swallows that throw and drops the entry. Without this
  // preload the goldens would silently omit every talent-scaled energy source
  // (Raiden's Musou Isshin restore, Dori A4, Durin) and overstate those teams.
  beforeAll(async () => {
    await characterStatsResource.preload();
  });

  for (const team of TEAMS) {
    for (const sc of SCENARIOS) {
      for (const mode of MODES) {
        it(`${team.name} / ${sc.name} / ${mode}`, () => {
          expect(solve(team, sc, mode)).toMatchSnapshot();
        });
      }
    }
  }

  it("never reports a requirement below the 100% ER floor", () => {
    const offenders: string[] = [];
    for (const team of TEAMS) {
      for (const sc of SCENARIOS) {
        for (const mode of MODES) {
          for (const [id, er] of Object.entries(solve(team, sc, mode))) {
            if (typeof er === "number" && er < 100) {
              offenders.push(`${team.name}/${sc.name}/${mode}/${id} = ${er}`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never reports a lower requirement for a repeating rotation than for one pass", () => {
    // Sustaining a loop forever cannot be strictly easier than clearing it once
    // from the same starting energy — if it is, a window is being mis-sliced.
    const offenders: string[] = [];
    for (const team of TEAMS) {
      for (const mode of MODES) {
        const once = solve(team, SCENARIOS[0], mode);
        const repeat = solve(team, SCENARIOS[1], mode);
        for (const id of Object.keys(once)) {
          const a = once[id];
          const b = repeat[id];
          if (typeof a === "number" && typeof b === "number" && b < a - 0.05) {
            offenders.push(`${team.name}/${mode}/${id}: once=${a} repeat=${b}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
