import type {
  CharacterEffect,
  CharacterKit,
  CharacterSkill,
  CharacterSkillDetail,
  Language,
} from "@/data/types";
import { betaEnabled } from "@/lib/betaFlag";
import { fetchGzipJson } from "@/lib/gzipJson";

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

// Beta character kits are gzipped (character_beta_*.json.gz) and loaded via URL
// so their plaintext contents never hit the released JS bundle. The glob
// resolves each matching file to a URL string at build time.
const betaModules = import.meta.glob<string>(
  "../data/game/character_beta_*.json.gz",
  { eager: false, query: "?url", import: "default" }
);

/** Detail row: [label, template] — 2 columns. */
function transformDetails(raw: string[][]): CharacterSkillDetail[] {
  return raw.map(([label, template]) => ({
    label: label ?? "",
    template: template ?? "",
  }));
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

  // Released kit bundles first; beta data (if enabled) is merged afterwards but
  // with setdefault semantics so released entries always win.
  const releasedPromise = Promise.all(loaders.map((loader) => loader!())).then(
    (mods) => {
      const raw: RawBundle = {};
      for (const mod of mods) {
        Object.assign(raw, mod.default);
      }
      return raw;
    }
  );

  let betaPromise: Promise<RawBundle> | null = null;
  if (betaEnabled()) {
    const betaPath = `../data/game/character_beta_${lang}.json.gz`;
    const betaUrlLoader = betaModules[betaPath];
    if (betaUrlLoader) {
      betaPromise = betaUrlLoader().then((url) =>
        fetchGzipJson<RawBundle>(url)
      );
    }
  }

  const promise = Promise.all([
    releasedPromise,
    betaPromise ?? Promise.resolve<RawBundle>({}),
  ]).then(([released, beta]) => {
    // Beta-only ids are added; released ids are preserved unchanged.
    const raw: RawBundle = { ...beta, ...released };
    const transformed = transformBundle(raw);
    cache.set(lang, transformed);
    pending.delete(lang);
    return transformed;
  });

  pending.set(lang, promise);
  return promise;
}
