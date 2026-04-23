import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionButton } from "@/components/ui/option-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { Element } from "@/data/enums";
import { elements } from "@/data/enums";
import type { StatKey } from "@/data/enums";
import { envBuffs } from "@/data/envBuffs";
import { charactersById, elementResourcesByName } from "@/data/gameResources";
import type { EnvBuff } from "@/data/types";
import { isPctStat } from "@/data/utils";
import type { ExtraBuff } from "@/lib/dmgcalc/types";
import { CUSTOM_STAT_OPTIONS } from "@/lib/team-comp/constants";
import { formatBuffStats } from "@/lib/team-comp/displayFormatter";
import type { Team } from "@/lib/team-comp/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { ChefHat, Globe, Plus, Settings, Swords, Wand2, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { getElementColor } from "../shared/colors";

/** Food preset IDs are stored as "food:<foodId>" to distinguish from other presets. */
const FOOD_PREFIX = "food:";

interface ExtraBuffsPanelProps {
  team: Team;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  enemyAura: Element | undefined;
  onEnemyAuraChange: (el: Element | undefined) => void;
  t: ReturnType<typeof useLanguage>["t"];
}

export function ExtraBuffsPanel({
  team,
  updateTeam,
  enemyAura,
  onEnemyAuraChange,
  t,
}: ExtraBuffsPanelProps) {
  const extraBuffs: ExtraBuff[] = team.extraBuffs ?? [];
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const setExtraBuffs = (buffs: ExtraBuff[]) => {
    updateTeam(team.id, { extraBuffs: buffs } as Partial<Team>);
  };

  // ── Food toggles ──

  const isFoodActive = (foodId: string) =>
    extraBuffs.some((b) => b.presetId === `${FOOD_PREFIX}${foodId}`);

  const toggleFood = (foodId: string) => {
    const presetId = `${FOOD_PREFIX}${foodId}`;
    if (isFoodActive(foodId)) {
      setExtraBuffs(extraBuffs.filter((b) => b.presetId !== presetId));
    } else {
      const food = envBuffs.find((f) => f.id === foodId);
      if (!food) return;
      // Remove other food in the same slot (one per slot)
      const sameSlotIds = new Set(
        envBuffs
          .filter((f) => f.category === "food" && f.foodSlot === food.foodSlot)
          .map((f) => `${FOOD_PREFIX}${f.id}`)
      );
      const withoutSlot = extraBuffs.filter(
        (b) => !b.presetId || !sameSlotIds.has(b.presetId)
      );
      setExtraBuffs([
        ...withoutSlot,
        {
          id: `extra-${Date.now()}`,
          presetId,
          target: "team",
          stats: food.stats,
        },
      ]);
    }
  };

  // ── Environment / status preset toggles ──

  const isPresetActive = (presetId: string) =>
    extraBuffs.some((b) => b.presetId === presetId && b.target === "team");

  const isStatusActiveForChar = (presetId: string, charId: string) =>
    extraBuffs.some((b) => b.presetId === presetId && b.target === charId);

  const toggleTeamPreset = (preset: EnvBuff) => {
    if (isPresetActive(preset.id)) {
      setExtraBuffs(extraBuffs.filter((b) => b.presetId !== preset.id));
    } else {
      setExtraBuffs([
        ...extraBuffs,
        {
          id: `extra-${Date.now()}`,
          presetId: preset.id,
          target: "team",
          stats: preset.stats,
        },
      ]);
    }
  };

  const toggleStatusForChar = (preset: EnvBuff, charId: string) => {
    if (isStatusActiveForChar(preset.id, charId)) {
      setExtraBuffs(
        extraBuffs.filter(
          (b) => !(b.presetId === preset.id && b.target === charId)
        )
      );
    } else {
      setExtraBuffs([
        ...extraBuffs,
        {
          id: `extra-${Date.now()}-${charId}`,
          presetId: preset.id,
          target: charId,
          stats: preset.stats,
        },
      ]);
    }
  };

  const removeBuff = (id: string) => {
    setExtraBuffs(extraBuffs.filter((b) => b.id !== id));
  };

  const activeCount = extraBuffs.length;
  const characters = team.characters.filter((c): c is string => c != null);

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <OptionButton
            selected={activeCount > 0 || !!enemyAura}
            icon={<Settings className="w-4 h-4 text-amber-400" />}
            title={t.ui("teamComp.extraBuffs")}
            titleClassName="text-foreground/80"
            selectedClassName="border-amber-600/50 bg-amber-900/20"
            unselectedClassName="border-slate-500/30 bg-slate-700/15 hover:border-slate-500/40 hover:bg-slate-700/25"
            subtitle={
              (enemyAura || activeCount > 0) && (
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {enemyAura && (
                    <span className="flex items-center gap-1">
                      <img
                        src={getAssetUrl(
                          elementResourcesByName[enemyAura]?.imagePath
                        )}
                        alt={enemyAura}
                        className="w-4 h-4"
                      />
                      <span
                        className={cn(
                          "text-xs md:text-sm font-bold",
                          getElementColor(enemyAura, "text")
                        )}
                      >
                        {t.element(enemyAura)}
                      </span>
                    </span>
                  )}
                  {activeCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-600/30 text-amber-200 text-xs md:text-sm"
                    >
                      {activeCount}
                    </Badge>
                  )}
                </div>
              )
            }
          />
        </PopoverTrigger>
        <PopoverContent
          className="w-72 md:w-[36rem] lg:w-[54rem] 2xl:w-[72rem] p-0"
          align="start"
          collisionPadding={8}
        >
          <div className="max-h-[calc(var(--radix-popover-content-available-height,60vh)-16px)] overflow-y-auto py-3">
            {/* Enemy Element Aura */}
            <div className="border-b border-border/20 px-3 py-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Swords className="w-4 h-4 text-red-400" />
                <span className="text-sm font-bold">
                  {t.ui("teamComp.enemyAura")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onEnemyAuraChange(undefined)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer transition-colors text-sm font-medium",
                    !enemyAura
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/30 bg-black/5 hover:bg-black/10"
                  )}
                >
                  {t.ui("common.none")}
                </button>
                {elements.map((el) => (
                  <button
                    type="button"
                    key={el}
                    onClick={() => onEnemyAuraChange(el)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer transition-colors",
                      enemyAura === el
                        ? "border-primary/50 bg-primary/10"
                        : "border-border/30 bg-black/5 hover:bg-black/10"
                    )}
                  >
                    <img
                      src={getAssetUrl(elementResourcesByName[el]?.imagePath)}
                      alt={el}
                      className="w-5 h-5"
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        getElementColor(el, "text")
                      )}
                    >
                      {t.element(el)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Food (one per slot, stackable across slots) */}
            <div className="border-b border-border/20 px-3 py-1">
              <div className="flex items-center gap-2 mb-0.5">
                <ChefHat className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold">
                  {t.ui("teamComp.extraBuffsFood")}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {envBuffs
                  .filter((b) => b.category === "food")
                  .map((food) => {
                    const active = isFoodActive(food.id);
                    return (
                      // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a controlled component inside the label
                      <label
                        key={food.id}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors",
                          active ? "bg-primary/10" : "hover:bg-black/5"
                        )}
                      >
                        <Checkbox
                          checked={active}
                          onCheckedChange={() => toggleFood(food.id)}
                          className="shrink-0"
                        />
                        {food.imagePath && (
                          <img
                            src={getAssetUrl(food.imagePath)}
                            alt={food.id}
                            className="w-7 h-7 rounded object-contain shrink-0"
                          />
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs lg:text-sm font-semibold leading-tight">
                            {t.envBuff(food.id)}
                          </span>
                          <span className="text-[10px] lg:text-xs text-muted-foreground leading-tight">
                            {formatBuffStats(food.stats, t)}
                          </span>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>

            {/* Environment */}
            <PresetSection
              icon={<Globe className="w-4 h-4 text-emerald-400" />}
              title={t.ui("teamComp.extraBuffsEnv")}
              presets={envBuffs.filter((b) => b.category === "enemy")}
              isActive={isPresetActive}
              onToggle={toggleTeamPreset}
              t={t}
            />

            {/* Status (per-character) */}
            <div className="border-b border-border/20 px-3 py-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Wand2 className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold">
                  {t.ui("teamComp.extraBuffsStatus")}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                {envBuffs
                  .filter((b) => b.category === "status")
                  .map((preset) => (
                    <div key={preset.id} className="mb-1 last:mb-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold mb-0.5">
                        {preset.imagePath && (
                          <img
                            src={getAssetUrl(preset.imagePath)}
                            alt={preset.id}
                            className="w-5 h-5 object-contain shrink-0"
                          />
                        )}
                        {t.envBuff(preset.id)}
                      </div>
                      <div className="text-xs text-muted-foreground mb-0.5">
                        {formatBuffStats(preset.stats, t)}
                      </div>
                      {characters.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {characters.map((charId) => {
                            const charRes = charactersById[charId];
                            const checked = isStatusActiveForChar(
                              preset.id,
                              charId
                            );
                            return (
                              // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a controlled component inside the label
                              <label
                                key={charId}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer transition-colors",
                                  checked
                                    ? "border-primary/50 bg-primary/10"
                                    : "border-border/30 bg-black/5 hover:bg-black/10"
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() =>
                                    toggleStatusForChar(preset, charId)
                                  }
                                  className="w-3.5 h-3.5"
                                />
                                {charRes && (
                                  <img
                                    src={getAssetUrl(charRes.imagePath)}
                                    alt={charId}
                                    className="w-5 h-5 rounded-full bg-secondary/40"
                                  />
                                )}
                                <span className="text-xs font-medium truncate max-w-[60px]">
                                  {t.character(charId)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          {t.ui("teamComp.extraBuffsNoChars")}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Custom */}
            <div className="px-3 py-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Settings className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-bold">
                  {t.ui("teamComp.extraBuffsCustom")}
                </span>
              </div>
              {extraBuffs.filter((b) => !b.presetId).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {extraBuffs
                    .filter((b) => !b.presetId)
                    .map((buff) => (
                      <span
                        key={buff.id}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full border border-border/40 bg-black/5 text-xs"
                      >
                        {formatBuffStats(buff.stats, t)}
                        <span className="text-muted-foreground">
                          →{" "}
                          {buff.target === "team"
                            ? t.receiver("team")
                            : t.character(buff.target)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBuff(buff.id)}
                          className="text-muted-foreground hover:text-destructive p-0.5 rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={() => {
                  setPopoverOpen(false);
                  setCustomDialogOpen(true);
                }}
              >
                <Plus className="w-3 h-3" />
                {t.ui("teamComp.extraBuffsAdd")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <CustomBuffDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        extraBuffs={extraBuffs}
        setExtraBuffs={setExtraBuffs}
        characters={characters}
        t={t}
      />
    </>
  );
}

// ─── PresetSection ───

function PresetSection({
  icon,
  title,
  presets,
  isActive,
  onToggle,
  t,
}: {
  icon: ReactNode;
  title: string;
  presets: EnvBuff[];
  isActive: (id: string) => boolean;
  onToggle: (preset: EnvBuff) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="border-b border-border/20 px-3 py-1">
      <div className="flex items-center gap-2 mb-0.5">
        {icon}
        <span className="text-sm font-bold">{title}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {presets.map((preset) => {
          const active = isActive(preset.id);
          return (
            // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a controlled component inside the label
            <label
              key={preset.id}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors",
                active ? "bg-primary/10" : "hover:bg-black/5"
              )}
            >
              <Checkbox
                checked={active}
                onCheckedChange={() => onToggle(preset)}
                className="shrink-0"
              />
              {preset.imagePath && (
                <img
                  src={getAssetUrl(preset.imagePath)}
                  alt={preset.id}
                  className="w-7 h-7 rounded object-contain shrink-0"
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs lg:text-sm font-semibold leading-tight">
                  {t.envBuff(preset.id)}
                </span>
                <span className="text-[10px] lg:text-xs text-muted-foreground leading-tight">
                  {formatBuffStats(preset.stats, t)}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── CustomBuffDialog ───

function CustomBuffDialog({
  open,
  onOpenChange,
  extraBuffs,
  setExtraBuffs,
  characters,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraBuffs: ExtraBuff[];
  setExtraBuffs: (buffs: ExtraBuff[]) => void;
  characters: string[];
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const [target, setTarget] = useState<string>("team");
  const [statKey, setStatKey] = useState<StatKey>("atk%");
  const [value, setValue] = useState("");
  const [maxStacks, setMaxStacks] = useState("");

  const handleAdd = () => {
    const numValue = Number.parseFloat(value);
    if (Number.isNaN(numValue) || numValue === 0) return;

    const engineValue = isPctStat(statKey) ? numValue / 100 : numValue;

    const newBuff: ExtraBuff = {
      id: `custom-${Date.now()}`,
      target,
      stats: [{ key: statKey, value: engineValue }],
      ...(maxStacks && Number.parseInt(maxStacks) > 0
        ? { maxStacks: Number.parseInt(maxStacks) }
        : {}),
    };

    setExtraBuffs([...extraBuffs, newBuff]);
    setValue("");
    setMaxStacks("");
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("teamComp.extraBuffsCustomTitle")}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4 px-1">
          {/* Target */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              {t.ui("teamComp.extraBuffsTarget")}
            </Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">{t.receiver("team")}</SelectItem>
                {characters.map((charId) => (
                  <SelectItem key={charId} value={charId}>
                    <div className="flex items-center gap-2">
                      {charactersById[charId] && (
                        <img
                          src={getAssetUrl(charactersById[charId].imagePath)}
                          alt={charId}
                          className="w-5 h-5 rounded-full bg-secondary/40"
                        />
                      )}
                      {t.character(charId)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stat Key */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              {t.ui("teamComp.extraBuffsStat")}
            </Label>
            <Select value={statKey} onValueChange={(v) => setStatKey(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_STAT_OPTIONS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t.stat(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              {t.ui("teamComp.extraBuffsValue")}
              <span className="text-muted-foreground font-normal ml-1">
                {isPctStat(statKey)
                  ? t.ui("teamComp.extraBuffsValuePct")
                  : t.ui("teamComp.extraBuffsValueFlat")}
              </span>
            </Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isPctStat(statKey) ? "20" : "372"}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>

          {/* Max Stacks */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              {t.ui("teamComp.extraBuffsMaxStacks")}
              <span className="text-muted-foreground font-normal ml-1">
                ({t.ui("teamComp.extraBuffsOptional")})
              </span>
            </Label>
            <Input
              type="number"
              value={maxStacks}
              onChange={(e) => setMaxStacks(e.target.value)}
              placeholder="—"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>

          <Button
            onClick={handleAdd}
            disabled={!value || Number.parseFloat(value) === 0}
            className="w-full gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.ui("teamComp.extraBuffsAdd")}
          </Button>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.ui("common.cancel")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
