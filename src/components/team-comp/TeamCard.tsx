import { ItemPicker } from "@/components/shared/ItemPicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LightweightMultiSelect } from "@/components/ui/lightweight-multiselect";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  charactersById,
  elementResourcesByName,
  weaponsById,
} from "@/data/constants";
import {
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
} from "@/data/gameStatsLoader";
import {
  type ReactionType,
  TEAM_REACTION_OPTIONS,
  type WeaponResource,
} from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { cn, getAssetUrl } from "@/lib/utils";
import type { Team } from "@/stores/useTeamStore";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Diamond,
  MoreVertical,
  Sparkles,
  Swords,
  Trash2,
  User2,
} from "lucide-react";
import { useMemo } from "react";

// Reaction tag color palette
const REACTION_COLORS: Partial<Record<ReactionType, string>> = {
  melt: "#E57373", // Pyro + Cryo (coral red)
  vaporize: "#81D4FA", // Pyro + Hydro (steam blue)
  spread: "#A8E063", // Dendro green
  aggravate: "#BB86FC", // Electro purple
  overloaded: "#FF6347", // Pyro-Electro explosion (tomato red-orange)
  electroCharged: "#9370DB", // Electro-Hydro (purple-blue)
  superconduct: "#B8C4FF", // Cryo-Electro (icy blue-purple)
  swirl: "#64FFDA", // Anemo teal
  frozen: "#B8C4FF", // Cryo-Hydro (icy blue-purple)
  bloom: "#7CB342", // Dendro core green
  hyperbloom: "#7C4DFF", // Electro purple (hitting core)
  burgeon: "#FF7043", // Pyro orange-red (hitting core)
  burning: "#FF9800", // Pyro flame orange
  lunarCharged: "#B8A5E3", // Lighter electro-charged purple
  lunarBloom: "#A5D86E", // Lighter bloom green
  lunarCrystallize: "#FFE082", // Lighter Geo golden
};

interface TeamCardProps {
  team: Team;
  index: number;
  onUpdate: (patch: Partial<Team>) => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onSelect?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function TeamCard({
  team,
  index,
  onUpdate,
  onDelete,
  onCopy,
  onSelect,
  onMoveUp,
  onMoveDown,
}: TeamCardProps) {
  const { t } = useLanguage();
  const { characterStats, weaponStats } = useGameStats();

  const isFullyConfigured =
    team.characters.every(Boolean) &&
    team.weapons.every(Boolean) &&
    team.artifacts.every(Boolean);

  const reactionOptions = useMemo(
    () =>
      TEAM_REACTION_OPTIONS.map((r) => ({
        value: r,
        label: t.reaction(r),
        color: REACTION_COLORS[r],
      })),
    [t]
  );

  const multiSelectTriggerClass = cn(
    "border-border/40 bg-foreground/5 rounded-full h-auto w-auto",
    "min-w-[7rem] pl-2 pr-1 py-1 text-sm [&>svg]:h-3 [&>svg]:w-3"
  );

  return (
    <div
      className={cn(
        "bg-card/40 backdrop-blur-md rounded-xl border border-border/30",
        "hover:border-border/60 transition-all duration-200",
        "group w-fit mx-auto"
      )}
    >
      {/* Header: Index + Reaction tags + Name + Context menu */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
        <span className="text-xs font-bold text-muted-foreground/60 select-none w-5 text-center shrink-0">
          {index + 1}
        </span>
        <LightweightMultiSelect
          options={reactionOptions}
          value={team.reactions}
          onValueChange={(value: string[]) =>
            onUpdate({ reactions: value as ReactionType[] })
          }
          placeholder={t.ui("teamComp.reactions")}
          triggerClassName={multiSelectTriggerClass}
          itemClassName="text-xs"
        />
        <Input
          value={team.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={t.ui("teamComp.teamName")}
          className="font-semibold text-sm bg-transparent border-none px-2 h-7 focus-visible:ring-1 text-foreground placeholder:text-muted-foreground/40 flex-1 min-w-0"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-60 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onMoveUp} disabled={!onMoveUp}>
              <ArrowUp className="mr-2 h-4 w-4" />
              <span>{t.ui("common.moveUp")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveDown} disabled={!onMoveDown}>
              <ArrowDown className="mr-2 h-4 w-4" />
              <span>{t.ui("common.moveDown")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="mr-2 h-4 w-4" />
              <span>{t.ui("common.duplicate")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>{t.ui("common.delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body: 5-column grid — element row + row-label + 4 pickers */}
      <div className="px-3 py-2">
        <div className="grid grid-cols-[auto_repeat(4,auto)] gap-3 w-fit mx-auto pr-2 justify-items-center items-center">
          {/* Row 0: Element icons — dim by default, bright on resonance (2+ same element) */}
          <div />
          {/* spacer for icon column */}
          {team.characters.map((charId, idx) => {
            const char = charId ? charactersById[charId] : null;
            const charMeta = char
              ? getCharacterDisplayMeta(char, characterStats?.[char.id])
              : null;
            const elRes =
              charMeta?.element != null
                ? elementResourcesByName[charMeta.element]
                : null;
            const hasResonance =
              charMeta?.element != null &&
              team.characters.filter(Boolean).filter((id) => {
                const c = charactersById[id!];
                const meta = c
                  ? getCharacterDisplayMeta(c, characterStats?.[c.id])
                  : null;
                return meta?.element === charMeta.element;
              }).length >= 2;
            return (
              <div
                key={`el-${idx}`}
                className="h-5 flex items-center justify-center"
              >
                {elRes && charMeta?.element != null && (
                  <img
                    src={getAssetUrl(elRes.imagePath)}
                    alt={charMeta.element}
                    className={cn(
                      "w-5 h-5 object-contain transition-all duration-200",
                      hasResonance
                        ? "opacity-100 scale-110 brightness-110"
                        : "opacity-50 grayscale"
                    )}
                    draggable={false}
                  />
                )}
              </div>
            );
          })}

          {/* Row 1: Character icon + Character pickers */}
          <User2 className="w-3.5 h-3.5 text-muted-foreground/80" />
          {team.characters.map((charId, idx) => (
            <ItemPicker
              key={`char-${idx}`}
              type="character"
              value={charId}
              triggerSize="md"
              onChange={(val) => {
                const newChars = [...team.characters];
                newChars[idx] = val;
                const newWeapons = [...team.weapons];
                const char = charactersById[val];
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
          ))}

          {/* Row 2: Weapon icon + Weapon pickers */}
          <Swords className="w-3.5 h-3.5 text-muted-foreground/80" />
          {team.weapons.map((weaponId, idx) => (
            <ItemPicker
              key={`wpn-${idx}`}
              type="weapon"
              value={weaponId}
              triggerSize="md"
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
                if (!char) return true;
                const charMeta = getCharacterDisplayMeta(
                  char,
                  characterStats?.[char.id]
                );
                const weaponMeta = getWeaponDisplayMeta(
                  item as WeaponResource,
                  weaponStats?.[(item as WeaponResource).id]
                );
                return (
                  charMeta.weaponType == null ||
                  weaponMeta.type === charMeta.weaponType
                );
              }}
            />
          ))}

          {/* Row 3: Artifact icon + Artifact pickers */}
          <Diamond className="w-3.5 h-3.5 text-muted-foreground/80" />
          {team.artifacts.map((artConfig, idx) => (
            <ItemPicker
              key={`art-${idx}`}
              type="artifact"
              value={artConfig}
              triggerSize="md"
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
          ))}
        </div>
      </div>

      {/* Footer: Optimize button */}
      <div className="px-3 pb-3 pt-1">
        <Button
          variant="outline"
          className="w-full font-semibold h-9 gap-2"
          onClick={onSelect}
          disabled={!isFullyConfigured}
        >
          <Sparkles className="w-4 h-4" />
          {t.ui("teamComp.teamOptimization")}
        </Button>
      </div>
    </div>
  );
}
