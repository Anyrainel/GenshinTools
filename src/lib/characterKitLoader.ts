import type {
  CharacterEffect,
  CharacterKit,
  CharacterSkill,
  CharacterSkillDetail,
  Language,
} from "@/data/types";
import { SKILL_LEVELS } from "@/data/types";

// Raw JSON shape before transformation
type RawSkill = {
  name: string;
  descHtml: string;
  details: string[][];
};

type RawKit = {
  name: string; // Present in JSON but not propagated to CharacterKit
  skills: RawSkill[];
  passives: CharacterEffect[];
  constellations: CharacterEffect[];
  glossary: CharacterEffect[] | null;
};

type RawBundle = Record<string, RawKit>;

// Module-level cache: one entry per language
const cache = new Map<Language, Record<string, CharacterKit>>();
const pending = new Map<Language, Promise<Record<string, CharacterKit>>>();

// Split by rarity: character_4_*.json and character_5_*.json (loaded in parallel per language)
const CHAR_RARITIES = ["4", "5"] as const;
const modules = import.meta.glob<{ default: RawBundle }>(
  "../data/game/character_*_*.json",
  { eager: false }
);

/** Detail row: [label, Lv6, Lv7, …, Lv15] — 1 label + 10 values. */
function transformDetails(raw: string[][]): CharacterSkillDetail[] {
  return raw.map((row) => {
    const label = row[0] ?? "";
    const out: CharacterSkillDetail = { label };
    // New format: 11 columns (label + Lv6..Lv15)
    if (row.length >= 11) {
      for (let i = 0; i < SKILL_LEVELS.length; i++) {
        const level = SKILL_LEVELS[i];
        const value = row[i + 1];
        if (value !== undefined && value !== "") out[level] = value;
      }
      return out;
    }
    // Legacy 4-column (label, lv6, lv10, lv13)
    if (row.length >= 4) {
      out["6"] = row[1];
      out["10"] = row[2];
      out["13"] = row[3];
      return out;
    }
    // Legacy 3-column (label, lv10, lv13)
    if (row.length >= 3) {
      out["10"] = row[1] ?? "";
      out["13"] = row[2] ?? "";
    }
    return out;
  });
}

function transformSkill(raw: RawSkill): CharacterSkill {
  return {
    name: raw.name,
    descHtml: raw.descHtml,
    details: transformDetails(raw.details),
  };
}

function transformBundle(raw: RawBundle): Record<string, CharacterKit> {
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

export function loadCharacterKits(
  lang: Language
): Promise<Record<string, CharacterKit>> {
  const cached = cache.get(lang);
  if (cached) return Promise.resolve(cached);

  // Deduplicate concurrent loads for the same language
  const inflight = pending.get(lang);
  if (inflight) return inflight;

  const paths = CHAR_RARITIES.map(
    (r) => `../data/game/character_${r}_${lang}.json`
  );
  const loaders = paths.map((p) => modules[p]).filter(Boolean);
  if (loaders.length !== paths.length) {
    return Promise.reject(
      new Error(`Missing character kit bundle(s) for: ${lang}`)
    );
  }

  const promise = Promise.all(loaders.map((loader) => loader!())).then(
    (mods) => {
      const raw: RawBundle = {};
      for (const mod of mods) {
        Object.assign(raw, mod.default);
      }
      const transformed = transformBundle(raw);
      cache.set(lang, transformed);
      pending.delete(lang);
      return transformed;
    }
  );

  pending.set(lang, promise);
  return promise;
}
