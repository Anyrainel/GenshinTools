import type { Rarity } from "@/data/types";

/**
 * Base interface for items displayed in the TierTable.
 * Each domain (Character, Weapon) must ensure their items conform to this.
 */
export interface TierItemData {
  id: string;
  rarity: Rarity;
  imagePath: string;
}

/**
 * Configuration for rendering a group header (element column for characters, weapon type for weapons).
 */
export interface TierGroupConfig {
  /** Tailwind background class for the header cell */
  bgClass: string;
  /** Asset path to the group icon (element icon, weapon type icon) */
  iconPath: string;
}
