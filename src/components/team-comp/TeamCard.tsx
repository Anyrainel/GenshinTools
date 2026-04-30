import {
  ArrowDown,
  ArrowUp,
  Copy,
  Diamond,
  Flame,
  GripVertical,
  type LucideIcon,
  MoreVertical,
  Sparkles,
  Swords,
  Trash2,
  User2,
} from "lucide-react";
import { memo, useMemo } from "react";
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
import { TEAM_REACTION_OPTIONS } from "@/data/constants";
import type { ReactionType } from "@/data/enums";
import {
  charactersById,
  elementResourcesByName,
  weaponsById,
} from "@/data/gameResources";
import {
  characterStatsResource,
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { AccountData, WeaponResource } from "@/data/types";
import { detectEquippedSets } from "@/lib/team-comp/teamConfigUtils";
import {
  teamCompInputToComp,
  teamCompToArrays,
} from "@/lib/team-comp/teamDeltas";
import type { TeamComp } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { REACTION_COLORS } from "../shared/colors";

interface TeamCardProps {
  teamComp: TeamComp;
  index: number;
  onUpdateComp: (comp: TeamComp) => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onSelect?: () => void;
  /** Override the default "伤害优化" label on the select button. */
  selectLabel?: string;
  /** Override the default icon on the select button. */
  selectIcon?: LucideIcon;
  /** Override the default className on the select button. */
  selectClassName?: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFrozen?: boolean;
  isFullyFrozen?: boolean;
  frozenCharIds?: Set<string>;
  onUnfreeze?: () => void;
  accountData?: AccountData | null;
  allUnowned?: boolean;
  /** When provided, renders a drag handle instead of the index number. Pass useSortable listeners. */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

function setsEqual(a?: Set<string>, b?: Set<string>): boolean {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export const TeamCard = memo(
  function TeamCard({
    teamComp,
    index,
    onUpdateComp,
    onDelete,
    onCopy,
    onSelect,
    selectLabel,
    selectIcon: SelectIcon,
    selectClassName,
    onMoveUp,
    onMoveDown,
    isFrozen,
    isFullyFrozen,
    frozenCharIds,
    onUnfreeze,
    accountData,
    allUnowned,
    dragHandleProps,
  }: TeamCardProps) {
    const { t } = useLanguage();
    const characterStats = characterStatsResource.use();
    const weaponStats = weaponStatsResource.use();

    const { characters, weapons, artifacts } = useMemo(
      () => teamCompToArrays(teamComp),
      [teamComp]
    );

    const updateCompArrays = (
      patch: Partial<{
        characters: (string | null)[];
        weapons: (string | null)[];
        artifacts: TeamComp["slots"][number]["artifactSet"][];
      }>
    ) => {
      onUpdateComp(
        teamCompInputToComp({
          ...teamComp,
          characters: patch.characters ?? characters,
          weapons: patch.weapons ?? weapons,
          artifacts: patch.artifacts ?? artifacts,
        })
      );
    };

    // At least one character with a weapon is enough to optimize
    const hasConfiguredMember = characters.some(
      (charId, i) => charId != null && weapons[i] != null
    );

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
      "min-w-[6rem] xl:min-w-[7rem] pl-1.5 xl:pl-2 pr-1 py-0.5 xl:py-1 text-xs xl:text-sm [&>svg]:h-3 [&>svg]:w-3"
    );

    return (
      <div
        data-tour-step-id="tc-team-card"
        className={cn(
          "bg-card/40 backdrop-blur-md rounded-xl border border-border/30",
          "hover:border-border/60",
          "group w-fit mx-auto",
          isFullyFrozen &&
            "ring-1 ring-cyan-400/30 border-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.1)]",
          isFrozen &&
            !isFullyFrozen &&
            "ring-1 ring-cyan-400/15 border-cyan-400/10",
          allUnowned &&
            "grayscale opacity-50 hover:grayscale-0 hover:opacity-100"
        )}
      >
        {/* Header: Index + Reaction tags + Name + Context menu */}
        <div className="flex items-center gap-1 xl:gap-1.5 px-2 xl:px-3 pt-2 xl:pt-3 pb-0.5 xl:pb-1">
          {dragHandleProps ? (
            <div
              {...dragHandleProps}
              className="text-muted-foreground w-4 xl:w-5 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          ) : (
            <span className="text-[11px] xl:text-xs font-bold text-muted-foreground select-none w-4 xl:w-5 text-center shrink-0">
              {index + 1}
            </span>
          )}
          <LightweightMultiSelect
            options={reactionOptions}
            value={teamComp.reactions}
            onValueChange={(value: string[]) =>
              onUpdateComp({
                ...teamComp,
                reactions: value as ReactionType[],
              })
            }
            placeholder={t.ui("teamComp.reactions")}
            triggerClassName={multiSelectTriggerClass}
            itemClassName="text-xs"
          />
          <Input
            value={teamComp.name}
            onChange={(e) =>
              onUpdateComp({ ...teamComp, name: e.target.value })
            }
            placeholder={t.ui("teamComp.teamName")}
            className="font-semibold !text-xs xl:!text-sm bg-transparent border-none px-1.5 xl:px-2 h-6 xl:h-7 focus-visible:ring-1 text-foreground placeholder:text-muted-foreground flex-1 min-w-0"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 xl:h-7 xl:w-7 p-0 opacity-60"
              >
                <MoreVertical className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
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
        <div
          className={cn(
            "px-2 xl:px-3 py-1.5 xl:py-2",
            isFrozen && "frozen-card pointer-events-none"
          )}
        >
          <div className="grid grid-cols-[auto_repeat(4,auto)] gap-1.5 xl:gap-3 w-fit mx-auto pr-1 xl:pr-2 justify-items-center items-center">
            {/* Row 0: Element icons — dim by default, bright on resonance (2+ same element) */}
            <div />
            {/* spacer for icon column */}
            {characters.map((charId, idx) => {
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
                characters.filter(Boolean).filter((id) => {
                  const c = charactersById[id!];
                  const meta = c
                    ? getCharacterDisplayMeta(c, characterStats?.[c.id])
                    : null;
                  return meta?.element === charMeta.element;
                }).length >= 2;
              return (
                <div
                  key={`el-${idx}`}
                  className="h-4 xl:h-5 flex items-center justify-center"
                >
                  {elRes && charMeta?.element != null && (
                    <img
                      src={getAssetUrl(elRes.imagePath)}
                      alt={charMeta.element}
                      className={cn(
                        "w-4 h-4 xl:w-5 xl:h-5 object-contain transition-all duration-200",
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
            <User2 className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-muted-foreground" />
            {characters.map((charId, idx) => {
              // Only allow clearing the last filled slot (enforce prefix ordering)
              const isLastFilled =
                charId != null &&
                !characters.some((c, j) => j > idx && c != null);
              return (
                <ItemPicker
                  key={`char-${idx}`}
                  type="character"
                  value={charId}
                  triggerSize="md"
                  frozen={!!(charId && frozenCharIds?.has(charId))}
                  filter={(item) => {
                    const c = item as { id: string };
                    return !characters.some(
                      (otherId, j) => j !== idx && otherId === c.id
                    );
                  }}
                  onChange={(val) => {
                    const newChars = [...characters];
                    newChars[idx] = val;
                    const newWeapons = [...weapons];
                    const newArts = [...artifacts];
                    const char = charactersById[val];

                    // Prefill weapon and artifact from account data
                    const acctChar = accountData?.characters.find(
                      (c) => c.key === val
                    );
                    if (acctChar) {
                      // Always prefill weapon from equipped data
                      if (
                        acctChar.weapon?.key &&
                        weaponsById[acctChar.weapon.key]
                      ) {
                        newWeapons[idx] = acctChar.weapon.key;
                      }

                      // Always prefill artifact set from equipped artifacts
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
                          ? getWeaponDisplayMeta(
                              weapon,
                              weaponStats?.[weapon.id]
                            )
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
                    updateCompArrays({
                      characters: newChars,
                      weapons: newWeapons,
                      artifacts: newArts,
                    });
                  }}
                  onClear={
                    isLastFilled
                      ? () => {
                          const newChars = [...characters];
                          newChars[idx] = null;
                          const newWeapons = [...weapons];
                          newWeapons[idx] = null;
                          const newArts = [...artifacts];
                          newArts[idx] = null;
                          updateCompArrays({
                            characters: newChars,
                            weapons: newWeapons,
                            artifacts: newArts,
                          });
                        }
                      : undefined
                  }
                />
              );
            })}

            {/* Row 2: Weapon icon + Weapon pickers */}
            <Swords className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-muted-foreground" />
            {weapons.map((weaponId, idx) => {
              const charId = characters[idx];
              return (
                <ItemPicker
                  key={`wpn-${idx}`}
                  type="weapon"
                  value={weaponId}
                  triggerSize="md"
                  frozen={!!(charId && frozenCharIds?.has(charId))}
                  onChange={(val) => {
                    const newWeapons = [...weapons];
                    newWeapons[idx] = val;
                    updateCompArrays({ weapons: newWeapons });
                  }}
                  onClear={() => {
                    const newWeapons = [...weapons];
                    newWeapons[idx] = null;
                    updateCompArrays({ weapons: newWeapons });
                  }}
                  disabled={!characters[idx]}
                  filter={(item) => {
                    const char = characters[idx]
                      ? charactersById[characters[idx]!]
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
              );
            })}

            {/* Row 3: Artifact icon + Artifact pickers */}
            <Diamond className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-muted-foreground" />
            {artifacts.map((artConfig, idx) => {
              const charId = characters[idx];
              const charFrozen = !!(charId && frozenCharIds?.has(charId));
              return (
                <ItemPicker
                  key={`art-${idx}`}
                  type="artifact"
                  value={artConfig}
                  triggerSize="md"
                  onChange={(val) => {
                    const newArts = [...artifacts];
                    newArts[idx] = val;
                    updateCompArrays({ artifacts: newArts });
                  }}
                  onClear={() => {
                    const newArts = [...artifacts];
                    newArts[idx] = null;
                    updateCompArrays({ artifacts: newArts });
                  }}
                  disabled={!charId}
                  frozen={charFrozen}
                />
              );
            })}
          </div>
        </div>

        {/* Footer: Optimize / Unfreeze buttons */}
        <div
          className={cn(
            "px-2 xl:px-3 pb-2 xl:pb-3 pt-1.5 xl:pt-2",
            isFrozen ? "flex gap-1.5 xl:gap-2" : ""
          )}
        >
          {isFrozen && onUnfreeze && (
            <Button
              variant="outline"
              className="flex-1 font-semibold h-8 xl:h-9 gap-1.5 xl:gap-2 text-xs xl:text-sm shadow-md border-red-400/40 bg-red-500/10 text-red-300 ring-2 ring-red-400/20 hover:!bg-red-500/15 hover:!text-red-200 hover:ring-red-400/40"
              onClick={onUnfreeze}
            >
              <Flame className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
              <span>{t.ui("teamComp.unfreezeTeam")}</span>
            </Button>
          )}
          <Button
            data-tour-step-id="tc-optimize"
            variant="outline"
            className={cn(
              "font-semibold h-8 xl:h-9 gap-1.5 xl:gap-2 text-xs xl:text-sm",
              isFrozen ? "flex-1" : "w-full",
              selectClassName
            )}
            onClick={onSelect}
            disabled={!hasConfiguredMember}
          >
            {SelectIcon ? (
              <SelectIcon className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
            )}
            <span>{selectLabel ?? t.ui("teamComp.teamOptimization")}</span>
          </Button>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.teamComp === next.teamComp &&
    prev.index === next.index &&
    prev.isFrozen === next.isFrozen &&
    prev.isFullyFrozen === next.isFullyFrozen &&
    setsEqual(prev.frozenCharIds, next.frozenCharIds) &&
    prev.accountData === next.accountData &&
    prev.allUnowned === next.allUnowned &&
    prev.dragHandleProps === next.dragHandleProps
);
