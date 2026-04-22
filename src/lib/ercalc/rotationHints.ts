import { BURST_ACTIONS, DIRECT_PARTICLE_ACTIONS, particles } from "./constants";
import { hasPeriodicGeneration } from "./erCalculator";
import type { ERTimeline, RotationHint } from "./types";

export type { RotationHint } from "./types";

/**
 * Analyze an ERTimeline and return hints for common issues.
 * These are suggestions, not errors — the user's rotation might be intentional.
 */
export function analyzeRotation(
  timeline: ERTimeline,
  teamCharIds: string[]
): RotationHint[] {
  const hints: RotationHint[] = [];
  const actions = timeline.actions;
  if (actions.length === 0) return hints;

  const teamSet = new Set(teamCharIds);

  // Track which characters have E before their first Q
  const hasEBeforeQ = new Map<string, boolean>();
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    if (!teamSet.has(act.char)) continue;
    if (DIRECT_PARTICLE_ACTIONS.has(act.action)) {
      hasEBeforeQ.set(act.char, true);
    }
    if (BURST_ACTIONS.has(act.action) && !hasEBeforeQ.has(act.char)) {
      hints.push({
        type: "info",
        charId: act.char,
        messageEn:
          "{char} bursts before using skill — no self-generated particles before Q.",
        messageZh: "{char} 在释放E之前释放了Q — Q之前没有自己产生的粒子。",
        actionIndex: i,
      });
      hasEBeforeQ.set(act.char, true);
    }
  }

  // Check for too few periodic procs vs expected default
  for (const charId of teamCharIds) {
    const cfg = particles[charId]?.periodic?.E;
    if (!cfg) continue;
    const expected = cfg.procs;
    const actual = timeline.periodic.filter(
      (p) => p.sourceChar === charId && p.trigger === "E"
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

  // Periodic procs present but no triggering skill in timeline
  for (const charId of teamCharIds) {
    if (!hasPeriodicGeneration(charId, "E")) continue;
    const hasE = actions.some(
      (a) =>
        a.char === charId &&
        (a.action === "E" || a.action === "holdE" || a.action === "specialE")
    );
    const hasPeriodic = timeline.periodic.some(
      (p) => p.sourceChar === charId && p.trigger === "E"
    );
    if (hasPeriodic && !hasE) {
      hints.push({
        type: "warning",
        charId,
        messageEn:
          "{char} has periodic procs but no E deployment — add E first.",
        messageZh: "{char} 有持续E但没有E部署 — 先添加E来部署。",
      });
    }
  }

  // 3+ consecutive bursts with no skill between
  let consecutiveBursts = 0;
  for (const act of actions) {
    if (BURST_ACTIONS.has(act.action)) {
      consecutiveBursts++;
      if (consecutiveBursts >= 3) {
        hints.push({
          type: "info",
          messageEn:
            "3+ bursts in a row with no skills between them — consider adding E casts to generate particles.",
          messageZh: "连续3个以上爆发没有E技能 — 考虑在中间添加E产球。",
        });
        break;
      }
    } else if (DIRECT_PARTICLE_ACTIONS.has(act.action)) {
      consecutiveBursts = 0;
    }
  }

  // Periodic procs grouped at the end vs interleaved (soft hint)
  if (actions.length > 5 && timeline.periodic.length >= 3) {
    const boundary = Math.ceil(actions.length * 0.6);
    const lateProcs = timeline.periodic.filter(
      (p) => p.targetIndex >= boundary
    ).length;
    if (lateProcs === timeline.periodic.length) {
      hints.push({
        type: "info",
        messageEn:
          "All periodic procs are at the end — consider interleaving them with on-field actions for more accurate absorption.",
        messageZh:
          "所有持续产球都在末尾 — 建议穿插在场上角色动作之间以提高吸收精确度。",
      });
    }
  }

  // Chars in team but not in timeline
  for (const charId of teamCharIds) {
    const inTimeline = actions.some((a) => a.char === charId);
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
