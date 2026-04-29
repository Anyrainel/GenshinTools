import { characters } from "@/data/resources";
import { useAccountStore } from "@/stores/useAccountStore";

/** Character IDs that are always owned (Traveler, Manekin, Manekina variants). */
const ALWAYS_OWNED_CHARACTER_IDS = new Set(
  characters
    .filter((c) => /^(traveler|manekin|manekina)_/.test(c.id))
    .map((c) => c.id)
);

/**
 * Static (non-reactive) ownership check for test assertions.
 * Reads current store state at call time.
 */
export function getIsOwned(type: "character" | "weapon", id: string): boolean {
  const state = useAccountStore.getState();
  const acc =
    state.activeAccountId !== null
      ? state.accounts[state.activeAccountId]
      : null;
  if (type === "character" && ALWAYS_OWNED_CHARACTER_IDS.has(id)) return true;
  if (!acc) return false;
  if (type === "character") {
    return acc.data.characters.some((c) => c.key === id);
  }
  return (
    acc.data.characters.some((c) => c.weapon?.key === id) ||
    acc.data.extraWeapons.some((w) => w.key === id)
  );
}
