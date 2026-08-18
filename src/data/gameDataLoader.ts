/**
 * Lazy game-data resources.
 *
 * Each export below is a ``Resource<T>`` / ``LangResource<T>`` (see
 * ``src/data/resource.ts``). Consumers either:
 *
 *   - Call ``resource.use()`` from React to render once data is ready, or
 *   - Call ``resource.preload()`` from a worker / app-boot effect, then
 *     ``resource.peek()`` synchronously thereafter.
 *
 * Tier B (preloaded at app boot, non-blocking):
 *   - ``weaponTextResource``    (per language)
 *   - ``artifactTextResource``  (per language)
 *
 * Tier C (loaded only when their consumer route mounts):
 *   - ``characterKitsResource`` (per language; consumed by Archive)
 *   - ``leylineBossResource``   (consumed by Archive)
 *
 * Beta merge semantics (``withBetaOverlay``): "released wins" — entries
 * present in both released and beta keep their released value; beta-only
 * entries are added. The beta gzip fetch fires only when ``betaEnabled()``
 * is true at call time, so the beta files' presence is undetectable from
 * network traffic when beta is off.
 */

import { betaEnabled } from "@/data/betaState";
import { expandAchievementReferenceData } from "./achievementData";
import type { ElementalOrPhysical } from "./enums";
import { ELEMENT_KEYS } from "./enums";
import {
  makeLangResource,
  makeResource,
  withBetaOverlay,
} from "./gameDataUtil";
import { LEYLINE_BOSS_IMAGE_ENEMY_ID } from "./resources_manual";
import type {
  AchievementData,
  AchievementReferenceData,
  ArtifactGameData,
  BossDescription,
  BossInfo,
  BossSchedule,
  CharacterKit,
  LangResource,
  LeylineBossData,
  Resource,
  WeaponGameData,
} from "./types";
import { fetchGzipJson } from "./utils";

// ═══════════════════════════════════════════════════════════════════════════
// Shared raw-fetch plumbing
// ═══════════════════════════════════════════════════════════════════════════

type ModuleMap<T> = Record<string, () => Promise<{ default: T }>>;
type UrlMap = Record<string, () => Promise<string>>;

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

// ═══════════════════════════════════════════════════════════════════════════
// Character kits — character_{4,5}_{en,zh}.json (+ beta gzip per lang)
// ═══════════════════════════════════════════════════════════════════════════

type CharacterKitBundle = Record<string, CharacterKit>;

const CHAR_RARITIES = ["4", "5"] as const;
const characterModules = import.meta.glob<{ default: CharacterKitBundle }>(
  "./game/character_*_*.json",
  { eager: false }
);

// Beta character kits are gzipped so their plaintext contents don't ship in
// the released JS bundle. Resolved to a URL at build time, fetched at runtime.
const betaCharacterModules = import.meta.glob<string>(
  "./game/character_beta_*.json.gz",
  { eager: false, query: "?url", import: "default" }
);

export const characterKitsResource: LangResource<CharacterKitBundle> =
  makeLangResource((lang) =>
    withBetaOverlay<CharacterKitBundle>(
      async () => {
        const bundles = await Promise.all(
          CHAR_RARITIES.map((r) =>
            loadFromGlob(characterModules, `./game/character_${r}_${lang}.json`)
          )
        );
        const merged: CharacterKitBundle = {};
        for (const bundle of bundles) Object.assign(merged, bundle);
        return merged;
      },
      () =>
        loadBetaGzip<CharacterKitBundle>(
          betaCharacterModules,
          `./game/character_beta_${lang}.json.gz`
        ),
      betaEnabled
    )()
  );

// ═══════════════════════════════════════════════════════════════════════════
// Achievements — achievement_{en,zh}.json
// ═══════════════════════════════════════════════════════════════════════════

const achievementModules = import.meta.glob<{
  default: AchievementReferenceData;
}>("./game/achievement_{en,zh}.json", { eager: false });

/** Route-lazy, per-language achievement metadata cached for the app lifetime. */
export const achievementTextResource: LangResource<AchievementData> =
  makeLangResource(async (lang) =>
    expandAchievementReferenceData(
      await loadFromGlob(achievementModules, `./game/achievement_${lang}.json`)
    )
  );

// ═══════════════════════════════════════════════════════════════════════════
// Weapon text — weapon_{en,zh}.json (+ beta gzip per lang)
// ═══════════════════════════════════════════════════════════════════════════

// Language-scoped globs. Brace expansion ensures only ``_en`` / ``_zh`` files
// match — so unrelated neighbors like ``weapon_stats.json`` (loaded as its own
// resource) are not swept in.
const weaponModules = import.meta.glob<{ default: WeaponGameData }>(
  "./game/weapon_{en,zh}.json",
  { eager: false }
);
const betaWeaponModules = import.meta.glob<string>(
  "./game/weapon_beta_{en,zh}.json.gz",
  { eager: false, query: "?url", import: "default" }
);

export const weaponTextResource: LangResource<WeaponGameData> =
  makeLangResource((lang) =>
    withBetaOverlay<WeaponGameData>(
      () => loadFromGlob(weaponModules, `./game/weapon_${lang}.json`),
      () =>
        loadBetaGzip<WeaponGameData>(
          betaWeaponModules,
          `./game/weapon_beta_${lang}.json.gz`
        ),
      betaEnabled
    )()
  );

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
// Artifact text — artifact_{en,zh}.json (+ beta gzip per lang)
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

export const artifactTextResource: LangResource<ArtifactGameData> =
  makeLangResource((lang) =>
    withBetaOverlay<ArtifactGameData>(
      () => loadFromGlob(artifactModules, `./game/artifact_${lang}.json`),
      () =>
        loadBetaGzip<ArtifactGameData>(
          betaArtifactModules,
          `./game/artifact_beta_${lang}.json.gz`
        ),
      betaEnabled
    )()
  );

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
  baseRes: Record<ElementalOrPhysical, number>,
  delta: Partial<Record<ElementalOrPhysical, number>>
): Record<ElementalOrPhysical, number> {
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
    return name.replace(/[:·]?\s*(Normal|常形)$/i, "").trim();
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
    const enemyId = LEYLINE_BOSS_IMAGE_ENEMY_ID[bossId];
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

export const leylineBossResource: Resource<LeylineBossData> = makeResource(
  async () => {
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
