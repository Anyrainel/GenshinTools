/** Shorten a character name to its last word (e.g. "Kamisato Ayaka" → "Ayaka") */
function shortenName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

export function buildTeamLabel(
  team: { characters: (string | null)[] },
  t: { character: (id: string) => string }
): string {
  return team.characters
    .filter(Boolean)
    .map((cid) => shortenName(t.character(cid!)))
    .join("/");
}
