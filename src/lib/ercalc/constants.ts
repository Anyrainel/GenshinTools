import { z } from "zod";
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
import type {
  ActionType,
  ParticleEntry,
  Particles,
  SelfEnergyMap,
} from "./types";

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

// ─── Particle data schema validation ───

const ParticlesSchema: z.ZodType<Particles> = z.union([
  z.number(),
  z.array(z.tuple([z.number(), z.number()])),
]);

const ActionParticleSchema = z.object({
  particles: ParticlesSchema,
  notes: z.string().optional(),
});

const HitPatternSchema = z.object({
  pattern: z.array(ParticlesSchema),
  notes: z.string().optional(),
});

const PeriodicConfigSchema = z.object({
  procs: z.number(),
  particles: ParticlesSchema,
  notes: z.string().optional(),
});

const ParticleEntrySchema = z.object({
  element: z.string(),
  source: z.enum(["fandom", "gcsim", "lunaris", "manual"]).optional(),
  spawnPoint: z.enum(["Character", "Enemy", "Construct"]).optional(),
  E: ActionParticleSchema.optional(),
  holdE: ActionParticleSchema.optional(),
  specialE: ActionParticleSchema.optional(),
  NA: HitPatternSchema.optional(),
  CA: HitPatternSchema.optional(),
  PA: HitPatternSchema.optional(),
  periodic: z
    .object({
      E: PeriodicConfigSchema.optional(),
      Q: PeriodicConfigSchema.optional(),
    })
    .optional(),
  _unmodeled: z.array(z.string()).optional(),
});

export const particles: Record<string, ParticleEntry> = z
  .record(z.string(), ParticleEntrySchema)
  .parse(particlesData) as Record<string, ParticleEntry>;

// ─── Energy multipliers ───

export const SAME_ELEMENT_PARTICLE = 3.0;
export const DIFF_ELEMENT_PARTICLE = 1.0;
export const CLEAR_PARTICLE = 2.0;
export const ORB_MULTIPLIER = 3.0;

/**
 * Off-field characters receive reduced energy from particles.
 * Formula: 1.0 - 0.1 × partySize (matches gcsim pkg/core/player/character/energy.go).
 */
export const OFF_FIELD_MULTIPLIER: Record<number, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.7,
  4: 0.6,
};

// ─── Action classification sets ───

/** Direct per-cast particle-producing actions. */
export const DIRECT_PARTICLE_ACTIONS = new Set<ActionType>([
  "E",
  "holdE",
  "specialE",
]);

/** Per-hit pattern actions (infusion chars). */
export const PATTERN_ACTIONS = new Set<ActionType>(["NA", "CA", "PA"]);

/** Actions that consume energy (burst). */
export const BURST_ACTIONS = new Set<ActionType>(["Q", "specialQ"]);

/** Actions that trigger periodic deployments (E/holdE → periodic.E, Q/specialQ → periodic.Q). */
export const PERIODIC_E_TRIGGERS = new Set<ActionType>([
  "E",
  "holdE",
  "specialE",
]);
export const PERIODIC_Q_TRIGGERS = new Set<ActionType>(["Q", "specialQ"]);

// ─── NA energy model ───

/**
 * NA energy generation model (based on gcsim pkg/core/energy.go).
 * Approximates "pity" procs: every N-th NA/CA/PA action by a character drops 1 flat energy.
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

/** Full action label map (includes event-source labels for results display). */
export const ACTION_LABELS: Record<string, { en: string; zh: string }> = {
  E: { en: "E", zh: "E" },
  holdE: { en: "Hold E", zh: "长按E" },
  specialE: { en: "Alt E", zh: "特殊E" },
  Q: { en: "Q", zh: "Q" },
  specialQ: { en: "Alt Q", zh: "特殊Q" },
  NA: { en: "NA", zh: "普攻" },
  CA: { en: "CA", zh: "重击" },
  PA: { en: "Plunge", zh: "下落" },
  wait: { en: "Wait", zh: "等待" },
  periodic: { en: "Periodic", zh: "持续产球" },
  favonius: { en: "Favonius", zh: "西风" },
};

export const PERIODIC_LABEL = { en: "Periodic", zh: "持续产球" };
export const FAVONIUS_LABEL = { en: "Favonius", zh: "西风" };

// ─── UI constants ───

/** Standard chip height for timeline action blocks. */
export const CHIP_H = "h-7";
