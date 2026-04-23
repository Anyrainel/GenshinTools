import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { charInfo } from "@/data/charInfo";
import type { Element } from "@/data/enums";
import { particles } from "@/lib/ercalc/constants";
import type { TeamSlot } from "@/lib/ercalc/types";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";
import { isElement } from "@/lib/typeValidation";
import { Plus, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { getElementColor } from "../shared/colors";

/** Get all character IDs that have particle data or charInfo */
function getAvailableCharacters(): string[] {
  const ids = new Set<string>();
  for (const id of Object.keys(charInfo)) ids.add(id);
  for (const id of Object.keys(particles)) ids.add(id);
  return Array.from(ids).sort();
}

function inferElement(charId: string): Element {
  const pe = particles[charId]?.element;
  if (pe && pe !== "Clear" && isElement(pe)) return pe;
  return "Anemo";
}

interface TeamSetupProps {
  team: TeamSlot[];
  onChange: (team: TeamSlot[]) => void;
}

export function TeamSetup({ team, onChange }: TeamSetupProps) {
  const { t, language } = useLanguage();
  const allChars = useMemo(getAvailableCharacters, []);

  const handleCharChange = useCallback(
    (index: number, charId: string) => {
      const newTeam = [...team];
      const energy = charInfo[charId]?.energy ?? 60;
      newTeam[index] = {
        charId,
        element: inferElement(charId),
        burstCost: energy,
        constellation: 0,
      };
      onChange(newTeam);
    },
    [team, onChange]
  );

  const handleConstellationChange = useCallback(
    (index: number, c: number) => {
      const newTeam = [...team];
      newTeam[index] = { ...newTeam[index], constellation: c };
      onChange(newTeam);
    },
    [team, onChange]
  );

  const handleWeaponChange = useCallback(
    (index: number, weaponId: string | undefined, refinement?: number) => {
      const newTeam = [...team];
      newTeam[index] = {
        ...newTeam[index],
        weaponId,
        refinement: weaponId ? (refinement ?? 0) : undefined,
      };
      onChange(newTeam);
    },
    [team, onChange]
  );

  const handleRemoveSlot = useCallback(
    (index: number) => {
      onChange(team.filter((_, i) => i !== index));
    },
    [team, onChange]
  );

  const handleAddSlot = useCallback(() => {
    if (team.length >= 4) return;
    const usedIds = new Set(team.map((s) => s.charId));
    const available = allChars.find((id) => !usedIds.has(id));
    if (!available) return;
    onChange([
      ...team,
      {
        charId: available,
        element: inferElement(available),
        burstCost: charInfo[available]?.energy ?? 60,
        constellation: 0,
      },
    ]);
  }, [team, allChars, onChange]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {team.map((slot, i) => (
          <TeamSlotCard
            key={`${slot.charId}-${i}`}
            slot={slot}
            index={i}
            allChars={allChars}
            usedIds={team.map((s) => s.charId)}
            onCharChange={handleCharChange}
            onConstellationChange={handleConstellationChange}
            onWeaponChange={handleWeaponChange}
            onRemove={handleRemoveSlot}
          />
        ))}
        {team.length < 4 && (
          <Button
            variant="outline"
            className="rounded-xl h-auto min-h-[60px] border-dashed"
            onClick={handleAddSlot}
          >
            <Plus className="w-4 h-4" />
            {t.ui("erCalc.addCharacter")}
          </Button>
        )}
      </div>
    </div>
  );
}

function TeamSlotCard({
  slot,
  index,
  allChars,
  usedIds,
  onCharChange,
  onConstellationChange,
  onWeaponChange,
  onRemove,
}: {
  slot: TeamSlot;
  index: number;
  allChars: string[];
  usedIds: string[];
  onCharChange: (index: number, charId: string) => void;
  onConstellationChange: (index: number, c: number) => void;
  onWeaponChange: (
    index: number,
    weaponId: string | undefined,
    refinement?: number
  ) => void;
  onRemove: (index: number) => void;
}) {
  const { t, language } = useLanguage();
  const borderColor = getElementColor(slot.element, "border");
  const textColor = getElementColor(slot.element, "text");

  return (
    <div
      className={`bg-gradient-card ${borderColor} border rounded-xl p-3 flex flex-col gap-2 relative group shadow`}
    >
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Avatar + character select */}
      <div className="flex items-center gap-2">
        <ItemIcon characterId={slot.charId} size="xs" />
        <div className="flex-1 min-w-0">
          <select
            value={slot.charId}
            onChange={(e) => onCharChange(index, e.target.value)}
            className={`text-sm font-medium bg-transparent border-none w-full cursor-pointer ${textColor} [&>option]:text-foreground [&>option]:bg-card`}
          >
            {allChars.map((id) => (
              <option
                key={id}
                value={id}
                disabled={usedIds.includes(id) && id !== slot.charId}
              >
                {t.character(id)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
            <span>{slot.burstCost}</span>
            <select
              value={slot.constellation}
              onChange={(e) =>
                onConstellationChange(index, Number.parseInt(e.target.value))
              }
              className="bg-transparent border-none text-xs cursor-pointer text-muted-foreground"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                <option key={c} value={c}>
                  C{c}
                </option>
              ))}
            </select>
            <select
              value={slot.weaponId ?? ""}
              onChange={(e) =>
                onWeaponChange(index, e.target.value || undefined)
              }
              className="bg-transparent border-none text-xs cursor-pointer text-muted-foreground max-w-[80px] truncate"
            >
              <option value="">{t.ui("erCalc.noWeapon")}</option>
              {Object.keys(weaponEnergyById).map((id) => (
                <option key={id} value={id}>
                  {t.weapon(id)}
                </option>
              ))}
            </select>
            {slot.weaponId && (
              <select
                value={slot.refinement ?? 0}
                onChange={(e) =>
                  onWeaponChange(
                    index,
                    slot.weaponId,
                    Number.parseInt(e.target.value)
                  )
                }
                className="bg-transparent border-none text-xs cursor-pointer text-muted-foreground"
              >
                {[0, 1, 2, 3, 4].map((r) => (
                  <option key={r} value={r}>
                    R{r + 1}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
