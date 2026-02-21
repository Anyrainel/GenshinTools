import type { CharacterEffect, CharacterSkill } from "@/data/types";

export function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  const chunks: string[] = [];
  let i = 0;
  while (i < q.length) {
    if (q[i] >= "\u4e00" && q[i] <= "\u9fff") {
      let cjkBlock = q[i];
      i++;
      while (i < q.length && q[i] >= "\u4e00" && q[i] <= "\u9fff") {
        cjkBlock += q[i];
        i++;
      }
      chunks.push(cjkBlock);
    } else {
      chunks.push(q[i]);
      i++;
    }
  }

  let ti = 0;
  for (const chunk of chunks) {
    const matchIndex = t.indexOf(chunk, ti);
    if (matchIndex === -1) return false;
    ti = matchIndex + chunk.length; // Ensure order is maintained
  }
  return true;
}

/** Strip HTML tags for plain-text search */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function matchesEffect(query: string, effect: CharacterEffect): boolean {
  const q = query.toLowerCase();
  return (
    fuzzyMatch(query, effect.name) ||
    stripHtml(effect.descHtml).toLowerCase().includes(q)
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
