import {
  expectedPeriodicProcs,
  periodicGenerators,
} from "@/data/ercalc/particleConfig";
import type { ActionType, Timeline } from "./erCalculator";

export interface RotationHint {
  type: "warning" | "info";
  messageEn: string;
  messageZh: string;
  /** Character ID referenced in the hint (for UI to translate). */
  charId?: string;
  /** Index of the action that triggered this hint. */
  actionIndex?: number;
}

const BURST_ACTIONS = new Set<ActionType>(["Q", "specialQ"]);

/**
 * Analyze a rotation timeline and return hints for common issues.
 * These are suggestions, not errors — the user's rotation might be intentional.
 */
export function analyzeRotation(
  timeline: Timeline,
  teamCharIds: string[]
): RotationHint[] {
  const hints: RotationHint[] = [];
  if (timeline.length === 0) return hints;

  const teamSet = new Set(teamCharIds);

  // Track which characters have E before their first Q
  const hasEBeforeQ = new Map<string, boolean>();
  for (const act of timeline) {
    if (!teamSet.has(act.char)) continue;
    if (
      act.action === "E" ||
      act.action === "holdE" ||
      act.action === "periodicE"
    ) {
      hasEBeforeQ.set(act.char, true);
    }
    if (BURST_ACTIONS.has(act.action) && !hasEBeforeQ.has(act.char)) {
      // Q before any E — character bursts without generating particles first
      hints.push({
        type: "info",
        charId: act.char,
        messageEn:
          "{char} bursts before using skill — no self-generated particles before Q.",
        messageZh: "{char} 在释放E之前释放了Q — Q之前没有自己产生的粒子。",
        actionIndex: timeline.indexOf(act),
      });
      hasEBeforeQ.set(act.char, true); // Don't warn again
    }
  }

  // Check for too few periodicE procs vs expected
  for (const charId of teamCharIds) {
    const expected = expectedPeriodicProcs[charId];
    if (!expected) continue;
    const actual = timeline.filter(
      (a) => a.char === charId && a.action === "periodicE"
    ).length;
    if (actual > 0 && actual < expected - 1) {
      hints.push({
        type: "info",
        charId,
        messageEn: `{char} has ${actual} periodic procs but typically generates ~${expected}. Consider adding more.`,
        messageZh: `{char} 有 ${actual} 个持续产球但通常有 ~${expected} 个。可以考虑添加更多。`,
      });
    }
  }

  // Check for periodic deployers missing their E deployment
  for (const charId of teamCharIds) {
    if (!periodicGenerators.has(charId)) continue;
    const hasE = timeline.some(
      (a) => a.char === charId && (a.action === "E" || a.action === "holdE")
    );
    const hasPeriodicE = timeline.some(
      (a) => a.char === charId && a.action === "periodicE"
    );
    if (hasPeriodicE && !hasE) {
      hints.push({
        type: "warning",
        charId,
        messageEn:
          "{char} has periodic procs but no E deployment — add E first.",
        messageZh: "{char} 有持续E但没有E部署 — 先添加E来部署。",
      });
    }
  }

  // Check for consecutive bursts with no particle generation between them
  let consecutiveBursts = 0;
  for (const act of timeline) {
    if (BURST_ACTIONS.has(act.action)) {
      consecutiveBursts++;
      if (consecutiveBursts >= 3) {
        hints.push({
          type: "info",
          messageEn:
            "3+ bursts in a row with no skills between them — consider adding E casts to generate particles.",
          messageZh: "连续3个以上爆发没有E技能 — 考虑在中间添加E产球。",
        });
        break; // Only warn once
      }
    } else if (
      act.action === "E" ||
      act.action === "holdE" ||
      act.action === "periodicE"
    ) {
      consecutiveBursts = 0;
    }
  }

  // Check for periodicE procs grouped at the end (instead of interleaved)
  // This matters because backward absorption assigns all grouped procs to the same absorber
  if (timeline.length > 5) {
    const lastActions = timeline.slice(-Math.ceil(timeline.length * 0.4));
    const periodicCount = lastActions.filter(
      (a) => a.action === "periodicE"
    ).length;
    const totalPeriodic = timeline.filter(
      (a) => a.action === "periodicE"
    ).length;
    if (totalPeriodic >= 3 && periodicCount === totalPeriodic) {
      hints.push({
        type: "info",
        messageEn:
          "All periodic procs are at the end — consider interleaving them with on-field actions for more accurate absorption.",
        messageZh:
          "所有持续产球都在末尾 — 建议穿插在场上角色动作之间以提高吸收精确度。",
      });
    }
  }

  // Check for characters in team but not in timeline
  for (const charId of teamCharIds) {
    const inTimeline = timeline.some((a) => a.char === charId);
    if (!inTimeline) {
      hints.push({
        type: "info",
        charId,
        messageEn: "{char} is in the team but has no actions.",
        messageZh: "{char} 在队伍中但没有动作。",
      });
    }
  }

  return hints;
}
