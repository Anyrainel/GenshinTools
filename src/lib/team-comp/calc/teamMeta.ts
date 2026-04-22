import { charInfo } from "@/data/charInfo";
import { charactersById } from "@/data/constants";
import type {
  Element,
  Faction,
  Rarity,
  Region,
  WeaponType,
} from "@/data/types";
import { getCharacterStatsSync } from "@/lib/gameStatsLoader";
import {
  LUNAR_SUPERSEDES,
  REACTION_AURA_TRIGGER,
  REACTION_ELEMENT_REQUIREMENTS,
} from "../constants";
import type { ReactionType } from "../types";

/**
 * Immutable team metadata: elements, regions, rarities, factions.
 * Constructed once per team configuration. Provides query helpers
 * for conditional buff evaluation.
 */

export class TeamMeta {
  readonly characters: string[];
  readonly constellations: Record<string, number>;
  readonly charLevels: Record<string, number>;
  /** From character_stats.json when loaded; undefined if character not in stats. */
  readonly elements: Record<string, Element | undefined>;
  readonly regions: Record<string, Region | undefined>;
  /** Rarity from stats when present, else from CharacterResource. */
  readonly rarities: Record<string, Rarity>;
  readonly factions: Record<string, Faction>;
  readonly weaponTypes: Record<string, WeaponType | undefined>;
  readonly energies: Record<string, number>;
  readonly isHealer: Record<string, boolean>;
  readonly isShielder: Record<string, boolean>;
  /** 4pc artifact set IDs equipped by each character (charId → setId) */
  readonly artifactSets: Record<string, string>;
  /** Persistent element aura on the enemy, injected into reaction checks. */
  readonly enemyAura?: Element;

  constructor(
    characterIds: string[],
    constellations: Record<string, number> = {},
    artifactSets: Record<string, string> = {},
    enemyAura?: Element,
    charLevels: Record<string, number> = {}
  ) {
    this.characters = characterIds;
    this.constellations = constellations;
    this.charLevels = charLevels;
    this.elements = {};
    this.regions = {};
    this.rarities = {};
    this.factions = {};
    this.weaponTypes = {};
    this.energies = {};
    this.isHealer = {};
    this.isShielder = {};
    this.artifactSets = artifactSets;
    this.enemyAura = enemyAura;

    const charStatsData = getCharacterStatsSync();
    for (const id of characterIds) {
      const resource = charactersById[id];
      if (!resource) throw new Error(`Unknown character ID: ${id}`);
      const stats = charStatsData?.[id];
      this.elements[id] = stats?.element;
      this.regions[id] = stats?.region;
      this.rarities[id] = (stats?.rarity ?? resource.rarity) as Rarity;
      this.weaponTypes[id] = stats?.weaponType;

      const info = charInfo[id];
      const cons = constellations[id] ?? 0;
      this.factions[id] = info?.faction ?? "None";
      this.energies[id] = info?.energy ?? 0;
      this.isHealer[id] = info?.healerC !== undefined && cons >= info.healerC;
      this.isShielder[id] =
        info?.shielderC !== undefined && cons >= info.shielderC;
    }
  }

  hasHealer(): boolean {
    return Object.values(this.isHealer).some(Boolean);
  }

  hasShielder(): boolean {
    return Object.values(this.isShielder).some(Boolean);
  }

  countByElement(element: Element): number {
    return Object.values(this.elements).filter(
      (e): e is Element => e === element
    ).length;
  }

  countByRegion(region: Region): number {
    return Object.values(this.regions).filter((r): r is Region => r === region)
      .length;
  }

  countByFaction(faction: Faction): number {
    return Object.values(this.factions).filter((f) => f === faction).length;
  }

  hasReaction(reaction: ReactionType, charId?: string): boolean {
    const req = REACTION_ELEMENT_REQUIREMENTS[reaction];
    if (!req) return false;

    const charEl = charId ? this.elements[charId] : undefined;
    if (charId && !charEl) return false;

    const teamElements = Object.values(this.elements).filter(
      (e): e is Element => e != null
    );

    // For reactions with aura/trigger semantics, when enemy aura is set it
    // fixes the aura side — the character must supply the trigger element.
    const auraTrigger = REACTION_AURA_TRIGGER[reaction];
    if (auraTrigger && this.enemyAura) {
      // Find pairings where the enemy aura matches the aura side
      const matchingPairs = auraTrigger.filter(
        (p) => p.aura === this.enemyAura
      );
      if (matchingPairs.length === 0) return false;

      if (charEl) {
        // Character's element must be the trigger
        return matchingPairs.some((p) => p.trigger === charEl);
      }
      // No charId — check if any team member can be the trigger
      return matchingPairs.some((p) => teamElements.includes(p.trigger));
    }

    // Fallback: check basic element requirements for the team
    if (this.enemyAura && !teamElements.includes(this.enemyAura)) {
      teamElements.push(this.enemyAura);
    }
    let charParticipates = !charId;
    const hasElements = req.requiredElements.every((group) => {
      if (charEl && group.includes(charEl)) {
        charParticipates = true;
        return true;
      }
      return group.some((el) => teamElements.includes(el));
    });

    if (!hasElements || !charParticipates) return false;

    // Check a 5-star Moonsign faction member participates in lunar reactions
    if (req.requiresMoonsign5StarParticipant) {
      const validMoonsign5 = this.characters.some((id) => {
        const isMoonsign5 =
          this.factions[id] === "Moonsign" && this.rarities[id] === 5;
        if (!isMoonsign5) return false;
        const charEl = this.elements[id];
        return (
          charEl != null &&
          req.requiredElements.some((group) => group.includes(charEl))
        );
      });
      if (!validMoonsign5) return false;
    }

    if (req.requiresGeoOrClaymore) {
      const hasGeoOrClaymore = this.characters.some(
        (id) =>
          this.elements[id] === "Geo" || this.weaponTypes[id] === "Claymore"
      );
      if (!hasGeoOrClaymore) return false;
    }

    // Lunar reactions supersede base reactions when possible.
    // e.g. lunarCharged replaces electroCharged on teams with a Moonsign 5★.
    const supersede = LUNAR_SUPERSEDES[reaction];
    if (supersede && this.hasReaction(supersede.lunar)) {
      // Full supersede unless team has elements that still trigger the base
      if (!supersede.survivalElements) return false;
      return supersede.survivalElements.some((el) => teamElements.includes(el));
    }

    return true;
  }

  /**
   * Compute passive talent level bonuses.
   * - Tartaglia P3 "Master of Weaponry": +1 Normal Attack (A) for all party members (unconditional)
   * - Skirk P3 "Mutual Weapons Mentorship": +1 Skill (E) for all party members
   *   (only when all characters are Hydro or Cryo, with at least 1 of each)
   * - Lohen P3 "When the Mood Strikes": +1 Skill (E) for Lohen himself while
   *   High Spirits is active. Under the peak-damage model the 9s/15s window
   *   is assumed to cover a typical post-E rotation.
   *
   * `targetCharId` scopes self-only bonuses. Team-wide bonuses ignore it.
   */
  talentPassiveBonuses(targetCharId?: string): {
    A: number;
    E: number;
    Q: number;
  } {
    const bonus = { A: 0, E: 0, Q: 0 };
    if (this.characters.includes("tartaglia")) {
      bonus.A += 1;
    }
    if (this.characters.includes("skirk")) {
      const elements = Object.values(this.elements).filter(
        (e): e is Element => e != null
      );
      const allHydroOrCryo = elements.every(
        (e) => e === "Hydro" || e === "Cryo"
      );
      const hasHydro = elements.some((e) => e === "Hydro");
      const hasCryo = elements.some((e) => e === "Cryo");
      if (allHydroOrCryo && hasHydro && hasCryo) {
        bonus.E += 1;
      }
    }
    // Lohen P3: self-only +1 E (High Spirits) — applies only to Lohen himself.
    if (targetCharId === "lohen" && this.characters.includes("lohen")) {
      bonus.E += 1;
    }
    return bonus;
  }
}
