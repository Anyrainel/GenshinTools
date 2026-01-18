import { ItemPicker } from "@/components/shared/ItemPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  charactersById,
  elementResourcesByName,
  weaponsById,
} from "@/data/constants";
import type { Weapon } from "@/data/types";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import { Copy, Flower, Sword, Trash2, User } from "lucide-react";

interface TeamCardProps {
  team: Team;
  index: number;
  onUpdate: (patch: Partial<Team>) => void;
  onDelete?: () => void;
  onCopy?: () => void;
  isGhost?: boolean;
}

export function TeamCard({
  team,
  index,
  onUpdate,
  onDelete,
  onCopy,
  isGhost,
}: TeamCardProps) {
  const { t } = useLanguage();

  const renderElementDisplay = (charId: string | null) => {
    if (!charId)
      return (
        <div
          className={cn(
            "w-8 h-8 rounded-full bg-secondary/50 border border-border/50"
          )}
        />
      );
    const char = charactersById[charId];
    if (!char) return null;

    const element = elementResourcesByName[char.element];
    if (!element) return null;

    return (
      <img
        src={getAssetUrl(element.imagePath)}
        alt={t.element(char.element)}
        className="w-8 h-8 object-contain"
      />
    );
  };

  return (
    <div
      className={cn(
        "bg-card/40 backdrop-blur-md rounded-lg p-6 space-y-4 w-fit mx-auto"
      )}
    >
      {/* Row 1: Header */}
      <div className="flex items-center gap-2">
        <div className="flex justify-start items-center w-12">
          <span className="font-semibold text-muted-foreground text-sm select-none">
            {t.ui("teamBuilder.teamLabel")} {index + 1}
          </span>
        </div>
        <Input
          value={team.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={t.ui("teamBuilder.teamName")}
          className="font-bold text-lg bg-transparent border-none px-2 h-auto focus-visible:ring-1 text-foreground placeholder:text-muted-foreground/50 flex-1 min-w-0"
        />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopy}
            title={t.ui("teamBuilder.copy")}
            disabled={isGhost}
          >
            <Copy className="w-4 h-4 select-none" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            title={t.ui("teamBuilder.delete")}
            disabled={isGhost}
          >
            <Trash2 className="w-4 h-4 select-none" />
          </Button>
        </div>
      </div>

      {/* Grid for Pickers and Display */}
      <div className="grid grid-cols-[auto_repeat(4,auto)] gap-3 justify-center justify-items-center items-center pr-1">
        {/* Row Header: Elements */}
        <div className="w-6" />
        {/* Row 2: Element Display (Thin row) */}
        {team.characters.map((charId, idx) => (
          <div
            key={`elem-disp-${idx}`}
            className="flex justify-center items-center h-8 w-8"
          >
            {renderElementDisplay(charId)}
          </div>
        ))}

        {/* Row Header: Character */}
        <div
          className="flex justify-center items-center text-muted-foreground w-8"
          title={t.ui("teamBuilder.character")}
        >
          <User className="w-6 h-6 select-none" />
        </div>
        {/* Row 3: Character Picker */}
        {team.characters.map((charId, idx) => (
          <div
            key={`char-picker-wrapper-${idx}`}
            className="flex justify-center items-center"
          >
            <ItemPicker
              type="character"
              value={charId}
              onChange={(val) => {
                const newChars = [...team.characters];
                newChars[idx] = val;

                const newWeapons = [...team.weapons];
                const char = charactersById[val];
                const weaponId = newWeapons[idx];
                if (weaponId && char) {
                  const weapon = weaponsById[weaponId];
                  if (weapon && weapon.type !== char.weaponType) {
                    newWeapons[idx] = null;
                  }
                }

                onUpdate({ characters: newChars, weapons: newWeapons });
              }}
              onClear={() => {
                const newChars = [...team.characters];
                newChars[idx] = null;
                const newWeapons = [...team.weapons];
                newWeapons[idx] = null;
                const newArts = [...team.artifacts];
                newArts[idx] = null;
                onUpdate({
                  characters: newChars,
                  weapons: newWeapons,
                  artifacts: newArts,
                });
              }}
            />
          </div>
        ))}

        {/* Row Header: Weapon */}
        <div
          className="flex justify-center items-center text-muted-foreground w-8"
          title={t.ui("teamBuilder.weapon")}
        >
          <Sword className="w-6 h-6 select-none" />
        </div>
        {/* Row 4: Weapon Picker */}
        {team.weapons.map((weaponId, idx) => (
          <div
            key={`wpn-picker-wrapper-${idx}`}
            className="flex justify-center items-center"
          >
            <ItemPicker
              type="weapon"
              value={weaponId}
              onChange={(val) => {
                const newWeapons = [...team.weapons];
                newWeapons[idx] = val;
                onUpdate({ weapons: newWeapons });
              }}
              onClear={() => {
                const newWeapons = [...team.weapons];
                newWeapons[idx] = null;
                onUpdate({ weapons: newWeapons });
              }}
              disabled={!team.characters[idx]}
              filter={(item) => {
                const char = team.characters[idx]
                  ? charactersById[team.characters[idx]!]
                  : null;
                return char ? (item as Weapon).type === char.weaponType : true;
              }}
            />
          </div>
        ))}

        {/* Row Header: Artifact */}
        <div
          className="flex justify-center items-center text-muted-foreground w-8"
          title={t.ui("teamBuilder.artifact")}
        >
          <Flower className="w-6 h-6 select-none" />
        </div>
        {/* Row 5: Artifact Picker */}
        {team.artifacts.map((artId, idx) => (
          <div
            key={`art-picker-wrapper-${idx}`}
            className="flex justify-center items-center"
          >
            <ItemPicker
              type="artifact"
              value={artId}
              onChange={(val) => {
                const newArts = [...team.artifacts];
                newArts[idx] = val;
                onUpdate({ artifacts: newArts });
              }}
              onClear={() => {
                const newArts = [...team.artifacts];
                newArts[idx] = null;
                onUpdate({ artifacts: newArts });
              }}
              disabled={!team.characters[idx]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
