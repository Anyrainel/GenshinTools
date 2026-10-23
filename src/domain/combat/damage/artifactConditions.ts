import type { Element, ReactionType } from "@/domain/enums";
import { PHEC_ELEMENTS, REACTION_ELEMENT_REQUIREMENTS } from "./constants";
import type { TeamMeta } from "./core/teamMeta";

/** Shards can be collected by any wearer; Lunar-Crystallize must be triggered by them. */
export function getArchaicPetraElements(
  teamMeta: TeamMeta,
  wearerId?: string
): Element[] {
  if (teamMeta.countByElement("Geo") === 0) return [];
  const lunar = teamMeta.hasReaction("lunarCrystallize");
  if (!teamMeta.hasReaction("crystallize") && !lunar) return [];
  return PHEC_ELEMENTS.filter((element) => {
    const auraAvailable = teamMeta.enemyAura
      ? teamMeta.enemyAura === element
      : teamMeta.countByElement(element) > 0;
    if (!auraAvailable) return false;
    // Lunar-Crystallize replaces Hydro shards, so an unrelated wearer cannot
    // activate Petra by picking up an ordinary Hydro shard in this team.
    return (
      element !== "Hydro" ||
      !lunar ||
      !wearerId ||
      teamMeta.hasReaction("lunarCrystallize", wearerId)
    );
  });
}

/** Peak activation still requires the wearer to participate in a real reaction. */
export function canTriggerArtifactReaction(
  teamMeta: TeamMeta,
  wearerId: string
): boolean {
  return (Object.keys(REACTION_ELEMENT_REQUIREMENTS) as ReactionType[]).some(
    (reaction) => {
      if (reaction === "none") return false;
      const element = teamMeta.elements[wearerId];
      if (
        (reaction === "swirl" || reaction === "stellarSwirl") &&
        element !== "Anemo"
      )
        return false;
      if (reaction === "crystallize" && element !== "Geo") return false;
      if (reaction === "shatter") {
        return (
          teamMeta.hasReaction("frozen") &&
          (element === "Geo" || teamMeta.weaponTypes[wearerId] === "Claymore")
        );
      }
      return teamMeta.hasReaction(reaction, wearerId);
    }
  );
}
