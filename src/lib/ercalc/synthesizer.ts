import {
  PERIODIC_E_TRIGGERS,
  PERIODIC_Q_TRIGGERS,
  particles,
} from "./constants";
import type { ERTimeline, PeriodicProc, TimelineAction } from "./types";

export interface FunnelIntent {
  /** Character producing the particles (e.g., "bennett"). */
  sourceCharId: string;
  /** Character designated to absorb the particles on-field (e.g., "xiangling"). */
  targetCharId: string;
  /** Optional. If specified, applies only to the N-th skill cast (0-indexed). */
  castIndex?: number;
}

export interface HighLevelRotation {
  teamCharIds: string[];
  /** Total cast counts per rotation. */
  casts: Record<
    string,
    {
      skillCount: number; // maps to E / holdE
      burstCount: number; // maps to Q / specialQ
      normalAttackCount?: number; // approx NAs executed (for driver or battery)
    }
  >;
  /** Funneling rules. Unspecified E's default to self-absorption. */
  funnels: FunnelIntent[];
  /** The character who acts as the primary on-field driver (receives remaining time/NAs). */
  driverCharId?: string;
}

/**
 * Compiles a high-level rotation specification into a concrete ERTimeline
 * containing discrete actions and auto-placed periodic particle procs.
 */
export function compileHighLevelRotation(input: HighLevelRotation): ERTimeline {
  const { teamCharIds, casts, funnels, driverCharId } = input;
  const actions: TimelineAction[] = [];

  // Determine swap order. Zhongli / Shielders first, buffers middle, main DPS / drivers last.
  const swapOrder = [...teamCharIds].sort((a, b) => {
    const getPriority = (id: string) => {
      const lid = id.toLowerCase();
      if (
        lid.includes("zhongli") ||
        lid.includes("layla") ||
        lid.includes("diona") ||
        lid.includes("kirara")
      )
        return 1;
      if (
        lid.includes("kazuha") ||
        lid.includes("sucrose") ||
        lid.includes("venti") ||
        lid.includes("jean")
      )
        return 2;
      if (
        lid.includes("xingqiu") ||
        lid.includes("yelan") ||
        lid.includes("fischl") ||
        lid.includes("raiden")
      )
        return 3;
      if (
        lid.includes("bennett") ||
        lid.includes("sara") ||
        lid.includes("faruzan") ||
        lid.includes("gorou")
      )
        return 4;
      return 5; // default main DPS
    };
    return getPriority(a) - getPriority(b);
  });

  // Keep track of skill cast indices per character
  const currentSkillIdx: Record<string, number> = {};
  for (const cid of teamCharIds) {
    currentSkillIdx[cid] = 0;
  }

  // Map of funnel rules: "sourceCharId_castIndex" -> targetCharId
  const funnelMap = new Map<string, string>();
  for (const f of funnels) {
    const castIdx = f.castIndex ?? 0;
    funnelMap.set(`${f.sourceCharId}_${castIdx}`, f.targetCharId);
  }

  // Step 1: Place setup skills, bursts, and skills in phase order
  for (const charId of swapOrder) {
    const charCasts = casts[charId];
    if (!charCasts) continue;

    // Burst first in phase to catch buffs
    if (charCasts.burstCount > 0) {
      actions.push({ char: charId, action: "Q" });
    }

    // Place skill casts
    for (let k = 0; k < charCasts.skillCount; k++) {
      actions.push({ char: charId, action: "E" });
      const skillIdx = currentSkillIdx[charId]++;

      // Funneling check
      const targetChar = funnelMap.get(`${charId}_${skillIdx}`);
      if (targetChar && teamCharIds.includes(targetChar)) {
        // Swap to target to absorb particles on-field.
        // If target has a burst cast remaining and hasn't burst yet, let them burst next!
        const targetCasts = casts[targetChar];
        const alreadyBurst = actions.some(
          (a) => a.char === targetChar && a.action === "Q"
        );
        if (targetCasts && targetCasts.burstCount > 0 && !alreadyBurst) {
          actions.push({ char: targetChar, action: "Q" });
        } else {
          // Otherwise, insert a wait block for on-field absorption
          actions.push({ char: targetChar, action: "wait" });
        }
      } else {
        // Self-absorb: insert wait block for the caster
        actions.push({ char: charId, action: "wait" });
      }
    }
  }

  // Step 2: Ensure any character who bursts has their burst in the timeline
  for (const charId of teamCharIds) {
    const charCasts = casts[charId];
    if (charCasts && charCasts.burstCount > 0) {
      const alreadyBurst = actions.some(
        (a) => a.char === charId && a.action === "Q"
      );
      if (!alreadyBurst) {
        // Insert burst at the beginning of their active actions or at the end
        const firstActionIdx = actions.findIndex((a) => a.char === charId);
        if (firstActionIdx !== -1) {
          actions.splice(firstActionIdx, 0, { char: charId, action: "Q" });
        } else {
          actions.push({ char: charId, action: "Q" });
        }
      }
    }
  }

  // Step 3: Append driver normal attacks at the end of the rotation
  if (driverCharId && teamCharIds.includes(driverCharId)) {
    const driverCasts = casts[driverCharId];
    if (
      driverCasts &&
      driverCasts.normalAttackCount &&
      driverCasts.normalAttackCount > 0
    ) {
      for (let i = 0; i < driverCasts.normalAttackCount; i++) {
        actions.push({ char: driverCharId, action: "NA" });
      }
    }
  }

  // Step 4: Auto-attach periodic summons procs
  const periodic: PeriodicProc[] = [];
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    let periodicTrigger: "E" | "Q" | null = null;
    if (
      PERIODIC_E_TRIGGERS.has(act.action) &&
      particles[act.char]?.periodic?.E
    ) {
      periodicTrigger = "E";
    } else if (
      PERIODIC_Q_TRIGGERS.has(act.action) &&
      particles[act.char]?.periodic?.Q
    ) {
      periodicTrigger = "Q";
    }

    if (periodicTrigger) {
      const cfg = particles[act.char].periodic![periodicTrigger]!;
      const numProcs = cfg.procs;
      for (let k = 1; k <= numProcs; k++) {
        // Distribute procs on subsequent timeline action steps
        const targetIndex = (i + k) % actions.length;
        periodic.push({
          sourceChar: act.char,
          trigger: periodicTrigger,
          targetIndex,
        });
      }
    }
  }

  return { actions, periodic };
}
