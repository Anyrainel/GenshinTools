import type {
  CharacterEffect,
  CharacterKit,
  CharacterSkill,
  CharacterSkillDetail,
  Language,
} from "@/data/types";

// Raw JSON shape before transformation
type RawSkill = {
  name: string;
  descHtml: string;
  details: string[][];
};

type RawKit = {
  skills: RawSkill[];
  passives: CharacterEffect[];
  constellations: CharacterEffect[];
  glossary: CharacterEffect[] | null;
};

type RawBundle = Record<string, RawKit>;

// Module-level cache: one entry per language
const cache = new Map<Language, Record<string, CharacterKit>>();
const pending = new Map<Language, Promise<Record<string, CharacterKit>>>();

const modules = import.meta.glob<RawBundle>("../data/character_*.json", {
  eager: false,
});

function transformDetails(raw: string[][]): CharacterSkillDetail[] {
  return raw.map((row) => {
    // Support both 3-column (label, lv10, lv13) and 4-column (label, lv6, lv10, lv13)
    if (row.length >= 4) {
      return { label: row[0], lv6: row[1], lv10: row[2], lv13: row[3] };
    }
    return { label: row[0], lv6: "", lv10: row[1], lv13: row[2] };
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

  const path = `../data/character_${lang}.json`;
  const loader = modules[path];
  if (!loader) {
    return Promise.reject(new Error(`No character kit bundle for: ${lang}`));
  }

  const promise = loader().then((mod) => {
    // Vite JSON dynamic imports return { default: T }
    const raw =
      (mod as unknown as { default: RawBundle }).default ??
      (mod as unknown as RawBundle);
    const transformed = transformBundle(raw);
    cache.set(lang, transformed);
    pending.delete(lang);
    return transformed;
  });

  pending.set(lang, promise);
  return promise;
}

export function getCachedKit(
  characterId: string,
  lang: Language
): CharacterKit | null {
  return cache.get(lang)?.[characterId] ?? null;
}

export function getCachedSkills(
  characterId: string,
  lang: Language
): CharacterSkill[] | null {
  return getCachedKit(characterId, lang)?.skills ?? null;
}

export function getCachedPassives(
  characterId: string,
  lang: Language
): CharacterEffect[] | null {
  return getCachedKit(characterId, lang)?.passives ?? null;
}

export function getCachedConstellations(
  characterId: string,
  lang: Language
): CharacterEffect[] | null {
  return getCachedKit(characterId, lang)?.constellations ?? null;
}

export function getCachedGlossary(
  characterId: string,
  lang: Language
): CharacterEffect[] | null {
  return getCachedKit(characterId, lang)?.glossary ?? null;
}
