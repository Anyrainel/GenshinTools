import { characters } from "@/data/resources";

/**
 * Character IDs that are always owned — all players are guaranteed to have
 * every Traveler, Manekin, and Manekina variant even though only one element
 * is active at a time in the GOOD export.
 */
export const ALWAYS_OWNED_CHARACTER_IDS = new Set(
  characters
    .filter((c) => /^(traveler|manekin|manekina)_/.test(c.id))
    .map((c) => c.id)
);
