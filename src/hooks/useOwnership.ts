import { characters } from "@/data/resources";
import { useAccountStore } from "@/stores/useAccountStore";

/** Character IDs that are always owned (Traveler, Manekin, Manekina variants). */
const ALWAYS_OWNED_CHARACTER_IDS = new Set(
  characters
    .filter((c) => /^(traveler|manekin|manekina)_/.test(c.id))
    .map((c) => c.id)
);
import { useCallback, useMemo } from "react";

/**
 * Returns a reactive `isOwned(type, id)` callback derived from the active account data.
 * A character is owned if it exists in AccountData.characters (or is always-owned).
 * A weapon is owned if it's equipped on any character or in extraWeapons.
 */
export function useIsOwned() {
  const accountData = useAccountStore((s) => {
    const acc = s.activeAccountId ? s.accounts[s.activeAccountId] : null;
    return acc?.data ?? null;
  });

  const { ownedCharacters, ownedWeapons } = useMemo(() => {
    if (!accountData) return { ownedCharacters: null, ownedWeapons: null };
    const chars = new Set(accountData.characters.map((c) => c.key));
    const weapons = new Set<string>();
    for (const c of accountData.characters) {
      if (c.weapon?.key) weapons.add(c.weapon.key);
    }
    for (const w of accountData.extraWeapons) {
      weapons.add(w.key);
    }
    return { ownedCharacters: chars, ownedWeapons: weapons };
  }, [accountData]);

  return useCallback(
    (type: "character" | "weapon", id: string) => {
      if (type === "character") {
        if (ALWAYS_OWNED_CHARACTER_IDS.has(id)) return true;
        return ownedCharacters?.has(id) ?? false;
      }
      return ownedWeapons?.has(id) ?? false;
    },
    [ownedCharacters, ownedWeapons]
  );
}

/**
 * Returns the constellation level for a character from the active account data.
 */
export function useConstellation(characterId: string): number {
  return useAccountStore((s) => {
    const acc = s.activeAccountId ? s.accounts[s.activeAccountId] : null;
    const char = acc?.data.characters.find((c) => c.key === characterId);
    return char?.constellation ?? 0;
  });
}

/**
 * Returns the refinement level for a weapon from the active account data.
 * If the weapon appears multiple times, returns the highest refinement.
 */
export function useRefinement(weaponId: string): number {
  return useAccountStore((s) => {
    const acc = s.activeAccountId ? s.accounts[s.activeAccountId] : null;
    if (!acc) return 1;
    let best = 0;
    for (const c of acc.data.characters) {
      if (c.weapon?.key === weaponId && c.weapon.refinement > best) {
        best = c.weapon.refinement;
      }
    }
    for (const w of acc.data.extraWeapons) {
      if (w.key === weaponId && w.refinement > best) {
        best = w.refinement;
      }
    }
    return best || 1;
  });
}

/**
 * Returns whether the active account has any character data (for enabling ownedOnly filters).
 */
export function useHasAccountData(): boolean {
  return useAccountStore((s) => {
    const acc = s.activeAccountId ? s.accounts[s.activeAccountId] : null;
    return acc != null && acc.data.characters.length > 0;
  });
}

/**
 * Static (non-reactive) ownership check for filter callbacks.
 * Reads current state at call time — do NOT use in render paths that need reactivity.
 */
export function getIsOwned(type: "character" | "weapon", id: string): boolean {
  if (type === "character" && ALWAYS_OWNED_CHARACTER_IDS.has(id)) return true;
  const state = useAccountStore.getState();
  const acc = state.activeAccountId
    ? state.accounts[state.activeAccountId]
    : null;
  if (!acc) return false;
  if (type === "character") {
    return acc.data.characters.some((c) => c.key === id);
  }
  return (
    acc.data.characters.some((c) => c.weapon?.key === id) ||
    acc.data.extraWeapons.some((w) => w.key === id)
  );
}
