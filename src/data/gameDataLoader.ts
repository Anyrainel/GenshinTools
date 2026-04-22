/**
 * Lazy-loaded per-language game data bundles.
 *
 * This file merges what would otherwise be five separate modules:
 * - Shared plumbing (cache + dedup + beta-gzip merge) that every domain reuses
 * - Character kits (skills/passives/constellations by language)
 * - Weapon game data (name + effect templates by language)
 * - Artifact game data (name + 2pc/4pc effect text by language)
 * - Leyline boss data (tiered info + per-language descriptions)
 *
 * All bundles are async; JSON payloads are resolved via ``import.meta.glob``
 * with ``{ eager: false }`` and only fetched on first call. Each loader
 * caches its result (per language where applicable) and dedups concurrent
 * in-flight loads.
 *
 * Beta merge semantics: **released wins** — entries present in both released
 * and beta keep their released value; beta-only entries are added. Beta
 * content is gated behind ``betaEnabled()``; when false, only released data
 * is loaded.
 */

import { betaEnabled } from "@/data/useBetaStore";
import { fetchGzipJson } from "./gzipJson";
import { i18nGameData } from "./i18n-game";
import type {
  ArtifactGameData,
  BossDescription,
  BossInfo,
  BossSchedule,
  CharacterEffect,
  CharacterKit,
  CharacterSkill,
  CharacterSkillDetail,
  ElementKey,
  Language,
  LeylineBossData,
  WeaponGameData,
} from "./types";
import { ELEMENT_KEYS } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// Shared plumbing
// ═══════════════════════════════════════════════════════════════════════════

type ModuleMap<T> = Record<string, () => Promise<{ default: T }>>;
type UrlMap = Record<string, () => Promise<string>>;

export type LanguageLoader<T> = (lang: Language) => Promise<T>;

/**
 * Create a loader for per-language JSON data with optional beta gzipped merge.
 *
 * ``loadReleased`` and ``loadBeta`` are responsible for how the raw bytes are
 * obtained (single file / multiple files / transformed). This helper layers
 * cache + dedup + beta merge on top.
 */
export function createLanguageDataLoader<T extends Record<string, unknown>>({
  loadReleased,
  loadBeta,
}: {
  loadReleased: LanguageLoader<T>;
  loadBeta?: LanguageLoader<T>;
}): LanguageLoader<T> {
  const cache = new Map<Language, T>();
  const pending = new Map<Language, Promise<T>>();

  return (lang) => {
    const cached = cache.get(lang);
    if (cached) return Promise.resolve(cached);
    const inflight = pending.get(lang);
    if (inflight) return inflight;

    const betaPromise =
      betaEnabled() && loadBeta
        ? loadBeta(lang).catch(() => ({}) as T)
        : Promise.resolve({} as T);

    const promise = Promise.all([loadReleased(lang), betaPromise]).then(
      ([released, beta]) => {
        const merged = { ...beta, ...released } as T;
        cache.set(lang, merged);
        pending.delete(lang);
        return merged;
      }
    );

    pending.set(lang, promise);
    return promise;
  };
}

/** Fetch a single per-language JSON from a glob module map. */
function loadFromGlob<T>(modules: ModuleMap<T>, path: string): Promise<T> {
  const loader = modules[path];
  if (!loader) {
    return Promise.reject(new Error(`No module registered at path: ${path}`));
  }
  return loader().then((mod) => mod.default);
}

/**
 * Fetch a gzipped beta bundle via its URL glob entry. Missing entries resolve
 * to an empty object so callers don't need to handle "no beta for this lang".
 */
function loadBetaGzip<T extends Record<string, unknown>>(
  urlModules: UrlMap,
  path: string
): Promise<T> {
  const urlLoader = urlModules[path];
  if (!urlLoader) return Promise.resolve({} as T);
  return urlLoader().then((url) => fetchGzipJson<T>(url));
}

/**
 * One-shot async cache: runs the loader at most once, returns the same
 * promise on every call. Used for bundles that aren't per-language.
 */
export function cachePromise<T>(loader: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => {
    if (!cached) cached = loader();
    return cached;
  };
}

/**
 * Convenience for the common "single JSON per language + optional beta gzip
 * URL per language" shape. Used by weapon and artifact game data.
 */
function createLangJsonLoader<T extends Record<string, unknown>>({
  baseModules,
  betaModules,
  basePath,
  betaPath,
}: {
  baseModules: ModuleMap<T>;
  betaModules: UrlMap;
  basePath: (lang: Language) => string;
  betaPath: (lang: Language) => string;
}): LanguageLoader<T> {
  return createLanguageDataLoader<T>({
    loadReleased: (lang) => loadFromGlob(baseModules, basePath(lang)),
    loadBeta: (lang) => loadBetaGzip<T>(betaModules, betaPath(lang)),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Character kits — character_{4,5}_{en,zh}.json (+ beta gzip per lang)
// ═══════════════════════════════════════════════════════════════════════════

// Details rows can arrive in two shapes during the migration from tuple to
// object layout: older scraped JSONs have ``[label, template]`` pairs; newer
// emissions (lunaris.py + normalized released scraper) use
// ``{ label, template }``. The transform below handles both; once every
// source emits objects, the tuple path + RawSkill.details union can be dropped.
type RawSkillDetail = CharacterSkillDetail | [string, string];
type RawSkill = {
  name: string;
  descHtml: string;
  details: RawSkillDetail[];
};
type RawKit = {
  name?: string; // present in older JSON; newer emissions omit it
  skills: RawSkill[];
  passives: CharacterEffect[];
  constellations: CharacterEffect[];
  glossary: CharacterEffect[] | null;
};
type RawBundle = Record<string, RawKit>;

const CHAR_RARITIES = ["4", "5"] as const;
const characterModules = import.meta.glob<{ default: RawBundle }>(
  "./game/character_*_*.json",
  { eager: false }
);

// Beta character kits are gzipped so their plaintext contents don't ship in
// the released JS bundle. Resolved to a URL at build time, fetched at runtime.
const betaCharacterModules = import.meta.glob<string>(
  "./game/character_beta_*.json.gz",
  { eager: false, query: "?url", import: "default" }
);

function transformDetails(raw: RawSkillDetail[]): CharacterSkillDetail[] {
  return raw.map((row) => {
    if (Array.isArray(row)) {
      const [label, template] = row;
      return { label: label ?? "", template: template ?? "" };
    }
    return row;
  });
}

function transformSkill(raw: RawSkill): CharacterSkill {
  return {
    name: raw.name,
    descHtml: raw.descHtml,
    details: transformDetails(raw.details),
  };
}

function transformCharacterBundle(
  raw: RawBundle
): Record<string, CharacterKit> {
  const result: Record<string, CharacterKit> = {};
  for (const [id, kit] of Object.entries(raw)) {
    result[id] = {
      skills: kit.skills.map(transformSkill),
      passives: kit.passives,
      constellations: kit.constellations,
      glossary: kit.glossary,
    };
  }
  return result;
}

const loadCharacterRaw = createLanguageDataLoader<RawBundle>({
  loadReleased: async (lang) => {
    const bundles = await Promise.all(
      CHAR_RARITIES.map((r) =>
        loadFromGlob(characterModules, `./game/character_${r}_${lang}.json`)
      )
    );
    const merged: RawBundle = {};
    for (const bundle of bundles) Object.assign(merged, bundle);
    return merged;
  },
  loadBeta: (lang) =>
    loadBetaGzip<RawBundle>(
      betaCharacterModules,
      `./game/character_beta_${lang}.json.gz`
    ),
});

// Transformed-result cache so transformCharacterBundle only runs once per lang.
const transformedCharacterCache = new Map<
  Language,
  Record<string, CharacterKit>
>();

export async function loadCharacterKits(
  lang: Language
): Promise<Record<string, CharacterKit>> {
  const cached = transformedCharacterCache.get(lang);
  if (cached) return cached;
  const raw = await loadCharacterRaw(lang);
  const transformed = transformCharacterBundle(raw);
  transformedCharacterCache.set(lang, transformed);
  return transformed;
}

// ═══════════════════════════════════════════════════════════════════════════
// Weapon game data — weapon_{en,zh}.json (+ beta gzip per lang)
// ═══════════════════════════════════════════════════════════════════════════

// Language-scoped globs. Brace expansion ensures only ``_en`` / ``_zh`` files
// match — so unrelated neighbors like ``weapon_stats.json`` (statically
// imported elsewhere and NOT lazy-chunked) are not swept in.
const weaponModules = import.meta.glob<{ default: WeaponGameData }>(
  "./game/weapon_{en,zh}.json",
  { eager: false }
);
const betaWeaponModules = import.meta.glob<string>(
  "./game/weapon_beta_{en,zh}.json.gz",
  { eager: false, query: "?url", import: "default" }
);

export const loadWeaponGameData = createLangJsonLoader<WeaponGameData>({
  baseModules: weaponModules,
  betaModules: betaWeaponModules,
  basePath: (lang) => `./game/weapon_${lang}.json`,
  betaPath: (lang) => `./game/weapon_beta_${lang}.json.gz`,
});

/** Substitute placeholders in a weapon effect template with refinement values. */
export function formatWeaponEffect(
  tpl: string,
  refinements: string[][],
  refinement?: number
): string {
  if (!tpl || refinements.length === 0) return tpl;
  // refinements: 5 lists (R1..R5), each with N values for {0}..{N-1}
  const paramCount = refinements[0].length;
  return tpl.replace(/\{(\d+)\}/g, (match, idx) => {
    const i = Number(idx);
    if (i >= paramCount) return match;
    if (refinement !== undefined && refinement >= 1 && refinement <= 5) {
      return refinements[refinement - 1][i];
    }
    // No specific refinement → show combined: "20%/25%/30%/35%/40%"
    return refinements.map((r) => r[i]).join("/");
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Artifact game data — artifact_{en,zh}.json (+ beta gzip per lang)
// ═══════════════════════════════════════════════════════════════════════════

// Same brace-expansion reasoning as weapons — excludes ``artifact_stat.json``
// which is statically imported by ``constants.ts``.
const artifactModules = import.meta.glob<{ default: ArtifactGameData }>(
  "./game/artifact_{en,zh}.json",
  { eager: false }
);
const betaArtifactModules = import.meta.glob<string>(
  "./game/artifact_beta_{en,zh}.json.gz",
  { eager: false, query: "?url", import: "default" }
);

export const loadArtifactGameData = createLangJsonLoader<ArtifactGameData>({
  baseModules: artifactModules,
  betaModules: betaArtifactModules,
  basePath: (lang) => `./game/artifact_${lang}.json`,
  betaPath: (lang) => `./game/artifact_beta_${lang}.json.gz`,
});

// ═══════════════════════════════════════════════════════════════════════════
// Leyline boss data — leyline_boss_info.json + leyline_boss_{en,zh}.json
// ═══════════════════════════════════════════════════════════════════════════

interface ScheduleName {
  id: number;
  name: string;
}

// ─── Pure helpers (no data dependency) ───

/** Compute total resistance for a state (base + delta * 100). */
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

/**
 * Parse a schedule timestamp ("YYYY-MM-DD HH:MM:SS") as Asia/Shanghai time
 * (UTC+8, where Genshin's version/season boundaries are anchored). Using
 * `new Date(raw)` directly is unreliable: the space-separated format is
 * implementation-defined, and when accepted it's interpreted as local time,
 * so players outside UTC+8 see the "Live" label applied to the wrong
 * rotation around the boundary.
 */
function parseScheduleTimestamp(raw: string): Date {
  return new Date(`${raw.replace(" ", "T")}+08:00`);
}

/**
 * The raw `close` timestamps in leyline_boss_info.json span the entire
 * version window, but Stygian Onslaught actually goes dark roughly 8 days
 * before the next rotation opens (maintenance + pre-version gap). Shorten
 * the effective active window so "Live" is only reported when the boss is
 * actually available in-game.
 */
const EMPTY_TAIL_MS = 8 * 24 * 60 * 60 * 1000;

/** Effective start/end of a schedule's "live" window, in epoch ms. */
export function getScheduleActiveWindow(s: BossSchedule): {
  openMs: number;
  closeMs: number;
} {
  const openMs = parseScheduleTimestamp(s.open).getTime();
  const rawCloseMs = parseScheduleTimestamp(s.close).getTime();
  const closeMs = Math.max(openMs, rawCloseMs - EMPTY_TAIL_MS);
  return { openMs, closeMs };
}

/** Effective open/close Date objects, matching the active-window shift. */
export function getScheduleActiveDates(s: BossSchedule): {
  open: Date;
  close: Date;
} {
  const { openMs, closeMs } = getScheduleActiveWindow(s);
  return { open: new Date(openMs), close: new Date(closeMs) };
}

/** Format numbers with locale separators (e.g., 13641165 → "13,641,165"). */
export function formatStat(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toLocaleString("en-US");
}

// ─── Async data loading ───

interface RawInfoBundle {
  bosses: BossInfo[];
  schedules: BossSchedule[];
}
interface RawLangBundle {
  bosses: BossDescription[];
  schedules: ScheduleName[];
}

// Hardcoded overrides for bosses whose describe_names don't exist in
// i18n-game enemies. Maps boss ID → enemy resource ID for the closest
// visual match.
const BOSS_IMAGE_OVERRIDES: Record<number, string> = {
  10022: "8249", // Battle-Hardened Tent Tortoise → Cocijo (科西霍)
  10023: "8301", // Battle-Hardened Pipilpan Idol → The Last Survivor of Tenochtzitoc (最后的特诺奇兹托克人)
  10032: "3992", // Battle-Scarred Rock Crab → Emperor of Fire and Iron (same crab family)
  10071: "9266", // Hexadecatonic Battle-Hardened Mandragora → Hexadecatonic Mandragora
  10042: "8550", // Battle-Hardened Lightkeeper → Sigurd (西格德)
};

const bossInfoModules = import.meta.glob<{ default: RawInfoBundle }>(
  "./game/leyline_boss_info.json",
  { eager: false }
);
const bossLangModules = import.meta.glob<{ default: RawLangBundle }>(
  "./game/leyline_boss_*.json",
  { eager: false }
);

function buildLeylineBossData(
  infoBundle: RawInfoBundle,
  enBundle: RawLangBundle,
  zhBundle: RawLangBundle
): LeylineBossData {
  const bossInfoMap = new Map<number, BossInfo>();
  for (const boss of infoBundle.bosses) bossInfoMap.set(boss.id, boss);

  const bossDescMap = {
    en: new Map<number, BossDescription>(),
    zh: new Map<number, BossDescription>(),
  };
  for (const boss of enBundle.bosses) bossDescMap.en.set(boss.id, boss);
  for (const boss of zhBundle.bosses) bossDescMap.zh.set(boss.id, boss);

  const schedules = infoBundle.schedules;

  const scheduleNameMap = {
    en: new Map<number, string>(),
    zh: new Map<number, string>(),
  };
  for (const s of enBundle.schedules) scheduleNameMap.en.set(s.id, s.name);
  for (const s of zhBundle.schedules) scheduleNameMap.zh.set(s.id, s.name);

  const allBossIdsSet = new Set<number>();
  for (const s of schedules) {
    for (const id of s.boss_ids) allBossIdsSet.add(id);
  }
  const allBossIds = Array.from(allBossIdsSet).sort((a, b) => a - b);

  // Enemy-image reverse lookup: enemy name → enemy resource ID (both langs).
  const enemyNameToId = new Map<string, string>();
  for (const [id, names] of Object.entries(i18nGameData.enemies)) {
    const { en, zh } = names as { en: string; zh: string };
    enemyNameToId.set(en, id);
    enemyNameToId.set(zh, id);
  }

  function findEnemyId(bossId: number): string | null {
    if (BOSS_IMAGE_OVERRIDES[bossId]) return BOSS_IMAGE_OVERRIDES[bossId];
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

  const bossImageCache = new Map<number, string | null>();

  const getBossInfo: LeylineBossData["getBossInfo"] = (id) =>
    bossInfoMap.get(id);

  const getBossDesc: LeylineBossData["getBossDesc"] = (id, lang) =>
    bossDescMap[lang].get(id);

  const getScheduleName: LeylineBossData["getScheduleName"] = (
    scheduleId,
    lang
  ) => scheduleNameMap[lang].get(scheduleId) ?? `Season ${scheduleId}`;

  const getBossVariantName: LeylineBossData["getBossVariantName"] = (
    id,
    tier,
    lang
  ) => {
    const desc = getBossDesc(id, lang);
    if (!desc) return `Boss #${id}`;
    const variant = desc.variants.find((v) => v.tiers.includes(tier));
    return variant?.name ?? desc.variants[0]?.name ?? `Boss #${id}`;
  };

  const getBossDisplayName: LeylineBossData["getBossDisplayName"] = (
    id,
    lang
  ) => {
    const desc = getBossDesc(id, lang);
    if (!desc) return `Boss #${id}`;
    // Use tier 1 variant name, strip ": Normal" / "·常形" suffix.
    const name = desc.variants[0]?.name ?? `Boss #${id}`;
    return name.replace(/[:\·]?\s*(Normal|常形)$/i, "").trim();
  };

  const getBulletsForTier: LeylineBossData["getBulletsForTier"] = (
    id,
    tier,
    lang
  ) => {
    const desc = getBossDesc(id, lang);
    if (!desc) return [];
    return desc.bullets.filter((b) => b.tiers.includes(tier));
  };

  const getAdvantageForTier: LeylineBossData["getAdvantageForTier"] = (
    id,
    tier,
    lang
  ) => {
    const desc = getBossDesc(id, lang);
    const advantage =
      desc?.advantage
        ?.filter((a) => a.tiers.includes(tier))
        .map((a) => a.text) ?? [];
    const disadvantage =
      desc?.disadvantage
        ?.filter((d) => d.tiers.includes(tier))
        .map((d) => d.text) ?? [];
    return { advantage, disadvantage };
  };

  const getCurrentSchedule: LeylineBossData["getCurrentSchedule"] = () => {
    const now = Date.now();
    return schedules.find((s) => {
      const { openMs, closeMs } = getScheduleActiveWindow(s);
      return now >= openMs && now <= closeMs;
    });
  };

  const getBossImagePath: LeylineBossData["getBossImagePath"] = (bossId) => {
    if (bossImageCache.has(bossId)) return bossImageCache.get(bossId)!;
    const enemyId = findEnemyId(bossId);
    const path = enemyId ? `/enemy/${enemyId}.webp` : null;
    bossImageCache.set(bossId, path);
    return path;
  };

  const bossMatchesSearch: LeylineBossData["bossMatchesSearch"] = (
    bossId,
    query
  ) => {
    if (!query) return true;
    const q = query.toLowerCase();

    if (getBossDisplayName(bossId, "en").toLowerCase().includes(q)) return true;
    if (getBossDisplayName(bossId, "zh").toLowerCase().includes(q)) return true;

    for (const lang of ["en", "zh"] as const) {
      const desc = getBossDesc(bossId, lang);
      if (!desc) continue;
      for (const a of desc.advantage ?? []) {
        if (a.text.toLowerCase().includes(q)) return true;
      }
      for (const d of desc.disadvantage ?? []) {
        if (d.text.toLowerCase().includes(q)) return true;
      }
      for (const b of desc.bullets) {
        if (b.title?.toLowerCase().includes(q)) return true;
        if (b.short?.toLowerCase().includes(q)) return true;
        if (b.detail?.toLowerCase().includes(q)) return true;
      }
    }

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
  };

  return {
    schedules,
    allBossIds,
    getBossInfo,
    getBossDesc,
    getScheduleName,
    getBossVariantName,
    getBossDisplayName,
    getBulletsForTier,
    getAdvantageForTier,
    getCurrentSchedule,
    getBossImagePath,
    bossMatchesSearch,
  };
}

export const loadLeylineBossData = cachePromise(
  async (): Promise<LeylineBossData> => {
    const infoLoader = bossInfoModules["./game/leyline_boss_info.json"];
    const enLoader = bossLangModules["./game/leyline_boss_en.json"];
    const zhLoader = bossLangModules["./game/leyline_boss_zh.json"];
    if (!infoLoader || !enLoader || !zhLoader) {
      throw new Error("Leyline boss data modules missing");
    }
    const [infoMod, enMod, zhMod] = await Promise.all([
      infoLoader(),
      enLoader(),
      zhLoader(),
    ]);
    return buildLeylineBossData(infoMod.default, enMod.default, zhMod.default);
  }
);
