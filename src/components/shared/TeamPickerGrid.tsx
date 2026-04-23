import { ItemPicker } from "@/components/shared/ItemPicker";
import { charactersById, weaponsById } from "@/data/gameResources";
import {
  characterStatsResource,
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { ArtifactSetConfig } from "@/data/types";
import type {
  AccountData,
  CharacterResource,
  WeaponResource,
} from "@/data/types";
import { detectEquippedSets } from "@/lib/team-comp/teamConfigUtils";
import { Diamond, Swords, User } from "lucide-react";
import { useCallback } from "react";

type TriggerSize = "xs" | "sm" | "md";

interface TeamPickerGridProps {
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactSetConfig | null)[];
  onChange: (patch: {
    characters?: (string | null)[];
    weapons?: (string | null)[];
    artifacts?: (ArtifactSetConfig | null)[];
  }) => void;
  accountData?: AccountData | null;
  triggerSize?: TriggerSize;
  frozenCharIds?: Set<string>;
  /** When true, only the last filled character slot can be cleared (prefix ordering) */
  prefixOrdering?: boolean;
  /** Gap between grid items — maps to tailwind gap classes */
  gap?: "sm" | "md";
}

export function TeamPickerGrid({
  characters,
  weapons,
  artifacts,
  onChange,
  accountData,
  triggerSize = "md",
  frozenCharIds,
  prefixOrdering = false,
  gap = "md",
}: TeamPickerGridProps) {
  const characterStats = characterStatsResource.use();
  const weaponStats = weaponStatsResource.use();

  const gapClass = gap === "sm" ? "gap-x-2 gap-y-2" : "gap-3";

  const charFilter = useCallback(
    (idx: number) => (c: CharacterResource) => {
      return !characters.some((otherId, j) => j !== idx && otherId === c.id);
    },
    [characters]
  );

  const weaponFilter = useCallback(
    (idx: number) => (w: WeaponResource) => {
      const charId = characters[idx];
      if (!charId) return true;
      const char = charactersById[charId];
      if (!char) return true;
      const charMeta = getCharacterDisplayMeta(char, characterStats?.[charId]);
      const weaponMeta = getWeaponDisplayMeta(w, weaponStats?.[w.id]);
      return (
        charMeta.weaponType == null || weaponMeta.type === charMeta.weaponType
      );
    },
    [characters, characterStats, weaponStats]
  );

  const handleCharChange = useCallback(
    (idx: number, val: string | null) => {
      const newChars = [...characters];
      const newWeapons = [...weapons];
      const newArts = [...artifacts];
      newChars[idx] = val;

      if (val) {
        const char = charactersById[val];
        const acctChar = accountData?.characters.find((c) => c.key === val);
        if (acctChar) {
          // Prefill weapon
          if (acctChar.weapon?.key && weaponsById[acctChar.weapon.key]) {
            const existingWeapon = newWeapons[idx];
            const shouldPrefillWeapon =
              !existingWeapon ||
              (() => {
                if (!char) return true;
                const curWeapon = weaponsById[existingWeapon];
                if (!curWeapon) return true;
                const charMeta = getCharacterDisplayMeta(
                  char,
                  characterStats?.[val]
                );
                const wMeta = getWeaponDisplayMeta(
                  curWeapon,
                  weaponStats?.[existingWeapon]
                );
                return (
                  charMeta.weaponType != null &&
                  wMeta.type != null &&
                  charMeta.weaponType !== wMeta.type
                );
              })();
            if (shouldPrefillWeapon) {
              newWeapons[idx] = acctChar.weapon.key;
            }
          }

          // Prefill artifact set from equipped artifacts
          const equipped = Object.values(acctChar.artifacts || {});
          if (equipped.length > 0) {
            const detected = detectEquippedSets(equipped);
            if (detected) {
              newArts[idx] = detected;
            }
          }
        } else {
          // No account data — clear incompatible weapon
          const weaponId = newWeapons[idx];
          if (weaponId && char) {
            const weapon = weaponsById[weaponId];
            const charMeta = getCharacterDisplayMeta(
              char,
              characterStats?.[char.id]
            );
            const weaponMeta = weapon
              ? getWeaponDisplayMeta(weapon, weaponStats?.[weapon.id])
              : null;
            if (
              weaponMeta?.type != null &&
              charMeta.weaponType != null &&
              weaponMeta.type !== charMeta.weaponType
            ) {
              newWeapons[idx] = null;
            }
          }
        }
      } else {
        newWeapons[idx] = null;
        newArts[idx] = null;
      }

      onChange({
        characters: newChars,
        weapons: newWeapons,
        artifacts: newArts,
      });
    },
    [
      characters,
      weapons,
      artifacts,
      accountData,
      characterStats,
      weaponStats,
      onChange,
    ]
  );

  const handleWeaponChange = useCallback(
    (idx: number, val: string | null) => {
      const next = [...weapons];
      next[idx] = val;
      onChange({ weapons: next });
    },
    [weapons, onChange]
  );

  const handleArtifactChange = useCallback(
    (idx: number, val: ArtifactSetConfig | null) => {
      const next = [...artifacts];
      next[idx] = val;
      onChange({ artifacts: next });
    },
    [artifacts, onChange]
  );

  return (
    <div
      className={`grid grid-cols-[auto_repeat(4,auto)] ${gapClass} justify-items-center items-center`}
    >
      {/* Row 1: Characters */}
      <User className="w-3.5 h-3.5 text-muted-foreground" />
      {characters.map((charId, idx) => {
        const isFrozen = !!(charId && frozenCharIds?.has(charId));
        const canClear = prefixOrdering
          ? charId != null && !characters.some((c, j) => j > idx && c != null)
          : true;
        return (
          <ItemPicker
            key={`char-${idx}`}
            type="character"
            value={charId}
            triggerSize={triggerSize}
            frozen={isFrozen}
            filter={charFilter(idx)}
            onChange={(val) => handleCharChange(idx, val)}
            onClear={canClear ? () => handleCharChange(idx, null) : undefined}
          />
        );
      })}

      {/* Row 2: Weapons */}
      <Swords className="w-3.5 h-3.5 text-muted-foreground" />
      {weapons.map((weaponId, idx) => {
        const charId = characters[idx];
        const isFrozen = !!(charId && frozenCharIds?.has(charId));
        return (
          <ItemPicker
            key={`wpn-${idx}`}
            type="weapon"
            value={weaponId}
            triggerSize={triggerSize}
            frozen={isFrozen}
            onChange={(val) => handleWeaponChange(idx, val)}
            onClear={() => handleWeaponChange(idx, null)}
            disabled={!charId}
            filter={weaponFilter(idx)}
          />
        );
      })}

      {/* Row 3: Artifacts */}
      <Diamond className="w-3.5 h-3.5 text-muted-foreground" />
      {artifacts.map((artConfig, idx) => {
        const charId = characters[idx];
        const isFrozen = !!(charId && frozenCharIds?.has(charId));
        return (
          <ItemPicker
            key={`art-${idx}`}
            type="artifact"
            value={artConfig}
            triggerSize={triggerSize}
            onChange={(val) => handleArtifactChange(idx, val)}
            onClear={() => handleArtifactChange(idx, null)}
            disabled={!charId}
            frozen={isFrozen}
          />
        );
      })}
    </div>
  );
}
