import particlesData from "@/data/ercalc/particles.json";
import fontaineSE from "@/data/ercalc/selfEnergy-fontaine.json";
import inazumaSE from "@/data/ercalc/selfEnergy-inazuma.json";
import liyueSE from "@/data/ercalc/selfEnergy-liyue.json";
import mondstadtSE from "@/data/ercalc/selfEnergy-mondstadt.json";
import natlanSE from "@/data/ercalc/selfEnergy-natlan.json";
import nodKraiSE from "@/data/ercalc/selfEnergy-nod-krai.json";
import noneSE from "@/data/ercalc/selfEnergy-none.json";
import snezhnayaSE from "@/data/ercalc/selfEnergy-snezhnaya.json";
import sumeruSE from "@/data/ercalc/selfEnergy-sumeru.json";
import type { ActionType } from "./types";

// ─── JSON data ───

export interface SelfEnergyEntry {
  source: string;
  action: string;
  amount?: number;
  percentRefund?: number;
  target: string;
  minC: number;
  procs?: number;
  erScale?: { per100: number; max?: number };
  param?: { source: string; index: number; multiplier: number };
  [key: string]: unknown;
}

export type SelfEnergyMap = Record<string, SelfEnergyEntry[]>;

export const allSelfEnergy: SelfEnergyMap = {
  ...mondstadtSE,
  ...liyueSE,
  ...inazumaSE,
  ...sumeruSE,
  ...fontaineSE,
  ...natlanSE,
  ...snezhnayaSE,
  ...nodKraiSE,
  ...noneSE,
};

/** Particle data can be a fixed number or weighted array [[count, probability], ...]. */
type ParticleValue = number | [number, number][];

interface ParticleSkillEntry {
  particles: ParticleValue;
  notes?: string;
}

interface ParticlePeriodicEntry {
  procs: number;
  particles: ParticleValue;
  notes?: string;
}

export interface ParticleEntry {
  element: string;
  source?: string;
  spawnPoint?: string;
  E?: ParticleSkillEntry;
  holdE?: ParticleSkillEntry;
  periodic?: { E: ParticlePeriodicEntry };
}

/** Resolve a ParticleValue to its expected (average) number. */
export function resolveParticleAvg(v: ParticleValue | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  // weighted: sum(count * probability)
  return v.reduce((sum, [count, prob]) => sum + count * prob, 0);
}

export const particles = particlesData as unknown as Record<
  string,
  ParticleEntry
>;

// ─── Energy multipliers ───

export const SAME_ELEMENT_PARTICLE = 3.0;
export const DIFF_ELEMENT_PARTICLE = 1.0;
export const CLEAR_PARTICLE = 2.0;
export const ORB_MULTIPLIER = 3.0;

/**
 * Off-field characters receive reduced energy from particles.
 * Formula: 1.0 - 0.1 × partySize (matches gcsim pkg/core/player/character/energy.go)
 */
export const OFF_FIELD_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.7,
  4: 0.6,
};

export const FAVONIUS_PARTICLES = 3;

// ─── Action classification sets ───

/** Actions that produce particles (used by simulation engine). */
export const PARTICLE_ACTIONS = new Set<ActionType>([
  "E",
  "holdE",
  "periodicE",
]);

/** Actions that consume energy (burst). */
export const BURST_ACTIONS = new Set<ActionType>(["Q", "specialQ"]);

// ─── NA energy model ───

/**
 * NA energy generation model (based on gcsim pkg/core/energy.go).
 *
 * N (actions between procs) by weapon type, assuming ~3 hits per action:
 *   Sword    (10% base, +5%/miss, ~5.5 hits/proc) → every 2nd action
 *   Claymore (0% base, +10%/miss, ~4.5 hits/proc) → every 2nd action
 *   Polearm  (0% base, +4%/miss, ~7.1 hits/proc)  → every 3rd action
 *   Bow      (0% base, +5%/miss, ~6.3 hits/proc)  → every 2nd action
 *   Catalyst (0% base, +10%/miss, ~4.5 hits/proc) → every 2nd action
 */
export const NA_PROC_INTERVAL: Record<string, number> = {
  sword: 2,
  claymore: 2,
  polearm: 3,
  bow: 2,
  catalyst: 2,
};
export const NA_PROC_INTERVAL_DEFAULT = 2;
export const NA_FLAT_ENERGY_PER_PROC = 1.0;

// ─── Param defaults (talent level 10) ───

export const PARAM_DEFAULTS: Record<string, number> = {
  "raiden_shogun:Q:17": 2.5,
  "dori:Q:4": 1.5,
  "durin:E:5": 3.0,
};

// ─── Enemy particle presets ───

export const ENEMY_PRESETS: {
  value: number;
  labelEn: string;
  labelZh: string;
}[] = [
  { value: 0, labelEn: "None (Boss)", labelZh: "无 (Boss)" },
  { value: 6, labelEn: "Low (Elite)", labelZh: "少 (精英怪)" },
  { value: 12, labelEn: "Medium (Mixed)", labelZh: "中 (混合怪)" },
  { value: 24, labelEn: "High (AoE)", labelZh: "多 (群怪)" },
];

// ─── Action labels (i18n) ───

/** Full action label map (all action types including tick). */
export const ACTION_LABELS: Record<string, { en: string; zh: string }> = {
  E: { en: "E", zh: "E" },
  holdE: { en: "Hold E", zh: "长按E" },
  periodicE: { en: "Tick", zh: "持续E" },
  Q: { en: "Q", zh: "Q" },
  specialQ: { en: "Alt Q", zh: "特殊Q" },
  NA: { en: "NA", zh: "普攻" },
  CA: { en: "CA", zh: "重击" },
  PA: { en: "Plunge", zh: "下落" },
  wait: { en: "Wait", zh: "等待" },
};

export const TICK_LABEL = { en: "E Tick", zh: "E产球" };

// ─── UI constants ───

/** Standard chip height for timeline action/tick blocks. */
export const CHIP_H = "h-7";
