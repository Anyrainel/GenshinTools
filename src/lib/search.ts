import type { CharacterEffect, CharacterSkill } from "@/data/types";

/** Simple fuzzy match: every character in query appears in target in order */
export function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/** Strip HTML tags for plain-text search */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function matchesEffect(query: string, effect: CharacterEffect): boolean {
  return (
    fuzzyMatch(query, effect.name) ||
    fuzzyMatch(query, stripHtml(effect.descHtml))
  );
}

export function characterMatchesSearch(
  characterId: string,
  query: string,
  characterName: string,
  skills: CharacterSkill[] | null,
  passives: CharacterEffect[] | null,
  constellations: CharacterEffect[] | null,
  glossary: CharacterEffect[] | null
): boolean {
  if (fuzzyMatch(query, characterName)) return true;
  if (fuzzyMatch(query, characterId)) return true;

  if (skills?.some((s) => matchesEffect(query, s))) return true;
  if (passives?.some((e) => matchesEffect(query, e))) return true;
  if (constellations?.some((e) => matchesEffect(query, e))) return true;
  if (glossary?.some((e) => matchesEffect(query, e))) return true;
  return false;
}
