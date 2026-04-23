/**
 * Hand-maintained resource maps that don't belong in the auto-generated
 * resources.ts / i18n-game.ts. Edit by hand when leyline bosses are added.
 *
 * Previously the boss → image lookup walked the full enemy i18n table
 * (~30KB inlined in i18n-game.ts) and matched describe_names back to enemy
 * IDs. The enemy table is now removed and this map is the only thing the
 * leyline view needs.
 */

/**
 * Leyline boss ID → enemy resource ID (under /enemy/<id>.webp).
 * Generated once via scripts/dev/extract-boss-enemy-map.ts; refresh that
 * script and re-run when new boss schedules ship.
 */
export const LEYLINE_BOSS_IMAGE_ENEMY_ID: Record<number, string> = {
  10011: "4571", // Hydro Tulpa
  10012: "7597", // Lava Dragon Statue
  10013: "7671", // Secret Source Automaton: Overseer Device
  10021: "7125", // Tenebrous Papilla: Type I
  10022: "8249", // Battle-Hardened Tent Tortoise → Cocijo
  10023: "8301", // Battle-Hardened Pipilpan Idol → Last Survivor of Tenochtzitoc
  10031: "2857", // Aeonblight Drake
  10032: "3992", // Battle-Scarred Rock Crab → Emperor of Fire and Iron
  10033: "8539", // Oprichniki Fireblade Shock Trooper
  10041: "8992", // Frostnight Herra
  10042: "8550", // Battle-Hardened Lightkeeper → Sigurd
  10043: "4346", // Frost Operative
  10051: "3705", // Iniquitous Baptist
  10052: "7139", // Iktomisaurus
  10053: "4343", // Experimental Field Generator
  10061: "9261", // Lord of the Hidden Depths: Whisperer of Nightmares
  10063: "3992", // Emperor of Fire and Iron
  10071: "9266", // Hexadecatonic Battle-Hardened Mandragora
  10072: "8522", // Knuckle Duckle
  10081: "9478", // Radiant Moongecko
};
