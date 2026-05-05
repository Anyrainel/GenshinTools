import type { CharacterData } from "@/data/types";

export function createLocatedCharacterPlaceholder(
  characterKey: string
): CharacterData {
  return {
    key: characterKey,
    level: 1,
    constellation: 0,
    talent: {
      auto: 1,
      skill: 1,
      burst: 1,
    },
    artifacts: {},
  };
}

export function ensureLocatedCharacter(
  characters: Map<string, CharacterData>,
  characterKey: string
): CharacterData {
  const existing = characters.get(characterKey);
  if (existing) return existing;
  const placeholder = createLocatedCharacterPlaceholder(characterKey);
  characters.set(characterKey, placeholder);
  return placeholder;
}
