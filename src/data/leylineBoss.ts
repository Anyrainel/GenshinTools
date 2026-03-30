import bossEnData from "./game/leyline_boss_en.json";
import bossInfoData from "./game/leyline_boss_info.json";
import bossZhData from "./game/leyline_boss_zh.json";
import { i18nGameData } from "./i18n-game";
import type { Language } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ElementKey =
  | "physical"
  | "pyro"
  | "hydro"
  | "electro"
  | "dendro"
  | "anemo"
  | "geo"
  | "cryo";

export const ELEMENT_KEYS: ElementKey[] = [
  "physical",
  "pyro",
  "hydro",
  "electro",
  "dendro",
  "anemo",
  "geo",
  "cryo",
];

export interface BossTierStats {
  id: number;
  level: number;
  hp?: number;
  atk?: number;
  def?: number;
}

export interface BossState {
  state: string;
  ability: string;
  res_delta?: Partial<Record<ElementKey, number>>;
  value_delta?: { atk_ratio: number };
}

export interface BossInfo {
  id: number;
  tiers: Record<string, BossTierStats>;
  monster_id?: number;
  describe_id?: number;
  res?: Record<ElementKey, number>;
  states?: BossState[];
  params?: Record<string, Record<string, number>>;
}

export interface BossVariant {
  tiers: number[];
  id: number;
  name: string;
}

export interface BossBullet {
  tiers: number[];
  title?: string;
  short?: string;
  detail?: string;
}

export interface BossDescribeName {
  id: number;
  name: string;
}

export interface BossDescription {
  id: number;
  variants: BossVariant[];
  advantage?: { tiers: number[]; text: string }[];
  disadvantage?: { tiers: number[]; text: string }[];
  bullets: BossBullet[];
  describe_names?: BossDescribeName[];
}

interface ScheduleName {
  id: number;
  name: string;
}

export interface BossSchedule {
  id: number;
  open: string;
  close: string;
  boss_ids: number[];
}

// ─── Data Access ─────────────────────────────────────────────────────────────

const bossInfoMap = new Map<number, BossInfo>();
for (const boss of bossInfoData.bosses as BossInfo[]) {
  bossInfoMap.set(boss.id, boss);
}

const bossDescMap = {
  en: new Map<number, BossDescription>(),
  zh: new Map<number, BossDescription>(),
};
for (const boss of bossEnData.bosses as BossDescription[]) {
  bossDescMap.en.set(boss.id, boss);
}
for (const boss of bossZhData.bosses as BossDescription[]) {
  bossDescMap.zh.set(boss.id, boss);
}

export const schedules = bossInfoData.schedules as BossSchedule[];

const scheduleNameMap = {
  en: new Map<number, string>(),
  zh: new Map<number, string>(),
};
for (const s of bossEnData.schedules as ScheduleName[]) {
  scheduleNameMap.en.set(s.id, s.name);
}
for (const s of bossZhData.schedules as ScheduleName[]) {
  scheduleNameMap.zh.set(s.id, s.name);
}

export function getScheduleName(scheduleId: number, lang: Language): string {
  return scheduleNameMap[lang].get(scheduleId) ?? `Season ${scheduleId}`;
}

// Collect all unique boss IDs that appear in schedules
const allBossIdsSet = new Set<number>();
for (const s of schedules) {
  for (const id of s.boss_ids) allBossIdsSet.add(id);
}
export const allBossIds = Array.from(allBossIdsSet).sort((a, b) => a - b);

export function getBossInfo(id: number): BossInfo | undefined {
  return bossInfoMap.get(id);
}

export function getBossDesc(
  id: number,
  lang: Language
): BossDescription | undefined {
  return bossDescMap[lang].get(id);
}

/** Get the variant name for a boss at a specific tier */
export function getBossVariantName(
  id: number,
  tier: number,
  lang: Language
): string {
  const desc = getBossDesc(id, lang);
  if (!desc) return `Boss #${id}`;
  const variant = desc.variants.find((v) => v.tiers.includes(tier));
  return variant?.name ?? desc.variants[0]?.name ?? `Boss #${id}`;
}

/** Get the short display name (tier 1 variant, without suffix) */
export function getBossDisplayName(id: number, lang: Language): string {
  const desc = getBossDesc(id, lang);
  if (!desc) return `Boss #${id}`;
  // Use tier 1 variant name, strip ": Normal" / "·常形" suffix
  const name = desc.variants[0]?.name ?? `Boss #${id}`;
  return name.replace(/[:\·]?\s*(Normal|常形)$/i, "").trim();
}

/** Get bullets applicable to a given tier */
export function getBulletsForTier(
  id: number,
  tier: number,
  lang: Language
): BossBullet[] {
  const desc = getBossDesc(id, lang);
  if (!desc) return [];
  return desc.bullets.filter((b) => b.tiers.includes(tier));
}

/** Get advantage/disadvantage for a tier */
export function getAdvantageForTier(
  id: number,
  tier: number,
  lang: Language
): { advantage: string[]; disadvantage: string[] } {
  const desc = getBossDesc(id, lang);
  const advantage =
    desc?.advantage?.filter((a) => a.tiers.includes(tier)).map((a) => a.text) ??
    [];
  const disadvantage =
    desc?.disadvantage
      ?.filter((d) => d.tiers.includes(tier))
      .map((d) => d.text) ?? [];
  return { advantage, disadvantage };
}

/** Compute total resistance for a state (base + delta * 100) */
export function computeStateRes(
  baseRes: Record<ElementKey, number>,
  delta: Partial<Record<ElementKey, number>>
): Record<ElementKey, number> {
  const result = { ...baseRes };
  for (const key of ELEMENT_KEYS) {
    if (delta[key] !== undefined) {
      result[key] = baseRes[key] + delta[key]! * 100;
    }
  }
  return result;
}

/** Get current schedule based on today's date */
export function getCurrentSchedule(): BossSchedule | undefined {
  const now = new Date();
  return schedules.find((s) => {
    const open = new Date(s.open);
    const close = new Date(s.close);
    return now >= open && now <= close;
  });
}

/** Format numbers with locale separators (e.g., 13641165 → "13,641,165") */
export function formatStat(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toLocaleString("en-US");
}

// ─── Enemy Image Mapping ─────────────────────────────────────────────────────

// Build reverse lookup: enemy name → enemy resource ID (both languages)
const enemyNameToId = new Map<string, string>();
for (const [id, names] of Object.entries(i18nGameData.enemies)) {
  const { en, zh } = names as { en: string; zh: string };
  enemyNameToId.set(en, id);
  enemyNameToId.set(zh, id);
}

// Hardcoded overrides for bosses whose describe_names don't exist in i18n-game enemies.
// Maps boss ID → enemy resource ID for the closest visual match.
const BOSS_IMAGE_OVERRIDES: Record<number, string> = {
  10022: "8249", // Battle-Hardened Tent Tortoise → Cocijo (科西霍)
  10023: "8301", // Battle-Hardened Pipilpan Idol → The Last Survivor of Tenochtzitoc (最后的特诺奇兹托克人)
  10032: "3992", // Battle-Scarred Rock Crab → Emperor of Fire and Iron (same crab family)
  10071: "9266", // Hexadecatonic Battle-Hardened Mandragora → Hexadecatonic Mandragora
  10042: "8550", // Battle-Hardened Lightkeeper → Sigurd (西格德)
};

/** Find the enemy resource ID for a boss using describe_names from both languages. */
function findEnemyId(bossId: number): string | null {
  // Check hardcoded overrides first
  if (BOSS_IMAGE_OVERRIDES[bossId]) return BOSS_IMAGE_OVERRIDES[bossId];

  // Try exact match against enemy names from both language files
  for (const lang of ["en", "zh"] as const) {
    const desc = bossDescMap[lang].get(bossId);
    if (!desc?.describe_names) continue;
    for (const dn of desc.describe_names) {
      const id = enemyNameToId.get(dn.name);
      if (id) return id;
    }
  }

  return null;
}

// Pre-compute boss ID → image path
const bossImageCache = new Map<number, string | null>();

export function getBossImagePath(bossId: number): string | null {
  if (bossImageCache.has(bossId)) return bossImageCache.get(bossId)!;
  const enemyId = findEnemyId(bossId);
  const path = enemyId ? `/enemy/${enemyId}.webp` : null;
  bossImageCache.set(bossId, path);
  return path;
}

/** Check if a boss matches a search query (searches names, advantages, disadvantages, mechanics, params, states) */
export function bossMatchesSearch(bossId: number, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  // Names (both languages)
  if (getBossDisplayName(bossId, "en").toLowerCase().includes(q)) return true;
  if (getBossDisplayName(bossId, "zh").toLowerCase().includes(q)) return true;

  // Advantage / disadvantage (both languages)
  for (const lang of ["en", "zh"] as const) {
    const desc = getBossDesc(bossId, lang);
    if (!desc) continue;
    for (const a of desc.advantage ?? []) {
      if (a.text.toLowerCase().includes(q)) return true;
    }
    for (const d of desc.disadvantage ?? []) {
      if (d.text.toLowerCase().includes(q)) return true;
    }
    // Mechanic bullets
    for (const b of desc.bullets) {
      if (b.title?.toLowerCase().includes(q)) return true;
      if (b.short?.toLowerCase().includes(q)) return true;
      if (b.detail?.toLowerCase().includes(q)) return true;
    }
  }

  // Info: states, params
  const info = getBossInfo(bossId);
  if (info) {
    if (info.states) {
      for (const s of info.states) {
        if (s.state.toLowerCase().includes(q)) return true;
      }
    }
    if (info.params) {
      for (const params of Object.values(info.params)) {
        for (const key of Object.keys(params)) {
          if (key.toLowerCase().includes(q)) return true;
        }
      }
    }
  }

  return false;
}
