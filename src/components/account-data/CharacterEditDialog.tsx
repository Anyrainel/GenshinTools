import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { statPools } from "@/data/constants";
import { artifactsById, charactersById, weaponsById } from "@/data/constants";
import { isPctStat } from "@/data/constants";
import type {
  AccountData,
  ArtifactData,
  CharacterData,
  MainStat,
  Slot,
  SubStat,
} from "@/data/types";
import { allSlots } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import {
  changeWeapon,
  createAndEquipArtifact,
  deleteArtifact,
  equipArtifactFromInventory,
  getInventoryArtifactsForSlot,
  stripIncompleteNewArtifacts,
  swapArtifactWithCharacter,
  unequipArtifact,
  unequipWeapon,
  updateArtifactStats,
  updateCharacterStats,
  updateWeaponStats,
} from "@/lib/account-data/characterEditor";
import { validateAndSolveArtifact } from "@/lib/artifact/validation";
import { cn } from "@/lib/utils";
import { getAssetUrl } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowLeftRight,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type React from "react";
import { forwardRef, useCallback, useMemo, useRef, useState } from "react";
import { ArtifactDataHoverCard } from "./ArtifactDataHoverCard";

type DialogView =
  | { kind: "overview" }
  | { kind: "weapon-pick" }
  | { kind: "artifact-pick"; slot: Slot; mode: "equip" | "create" };

interface CharacterEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  char: CharacterData;
  accountData: AccountData;
  onSave: (newData: AccountData) => void;
}

const mainStatsForSlot = (slot: Slot): readonly string[] => statPools[slot];

const ALL_SUBSTATS: SubStat[] = [
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "em",
  "er",
  "atk",
  "hp",
  "def",
];

export function CharacterEditDialog({
  open,
  onOpenChange,
  char: initialChar,
  accountData: initialData,
  onSave,
}: CharacterEditDialogProps) {
  const { t } = useLanguage();
  const [view, setView] = useState<DialogView>({ kind: "overview" });
  const [data, setData] = useState(initialData);
  const [newlyCreatedIds, setNewlyCreatedIds] = useState<Set<string>>(
    new Set()
  );
  const [initialActiveSlot, setInitialActiveSlot] = useState<Slot | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const char = useMemo(
    () => data.characters.find((c) => c.key === initialChar.key) ?? initialChar,
    [data, initialChar]
  );

  const charInfo = charactersById[char.key];

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setData(initialData);
        setView({ kind: "overview" });
        setNewlyCreatedIds(new Set());
        setInitialActiveSlot(null);
        setSaveError(null);
      }
      // Closing via X / backdrop discards changes (same as Cancel)
      onOpenChange(open);
    },
    [initialData, onOpenChange]
  );

  // ── Mutators ──

  const updateStats = useCallback(
    (updates: Parameters<typeof updateCharacterStats>[2]) => {
      setData((d) => updateCharacterStats(d, char.key, updates));
    },
    [char.key]
  );

  const handleWeaponStats = useCallback(
    (updates: Parameters<typeof updateWeaponStats>[2]) => {
      setData((d) => updateWeaponStats(d, char.key, updates));
    },
    [char.key]
  );

  const handleUnequipWeapon = useCallback(() => {
    setData((d) => unequipWeapon(d, char.key));
  }, [char.key]);

  const handleChangeWeapon = useCallback(
    (weaponKey: string) => {
      setData((d) => changeWeapon(d, char.key, weaponKey));
      setInitialActiveSlot(null);
      setView({ kind: "overview" });
    },
    [char.key]
  );

  const handleUnequipArtifact = useCallback(
    (slot: Slot) => {
      setData((d) => unequipArtifact(d, char.key, slot));
    },
    [char.key]
  );

  const handleDeleteArtifact = useCallback(
    (slot: Slot) => {
      setData((d) => deleteArtifact(d, char.key, slot));
    },
    [char.key]
  );

  const handleEquipFromInventory = useCallback(
    (slot: Slot, artifactId: string) => {
      setData((d) => equipArtifactFromInventory(d, char.key, slot, artifactId));
      setInitialActiveSlot(null);
      setView({ kind: "overview" });
    },
    [char.key]
  );

  const handleSwapArtifact = useCallback(
    (slot: Slot, otherCharKey: string) => {
      setData((d) =>
        swapArtifactWithCharacter(d, char.key, slot, otherCharKey, slot)
      );
      setInitialActiveSlot(null);
      setView({ kind: "overview" });
    },
    [char.key]
  );

  const handleCreateArtifact = useCallback(
    (slot: Slot, setKey: string) => {
      const mainStat =
        slot === "flower" ? "hp" : slot === "plume" ? "atk" : "atk%";
      let newId = "";
      setData((d) => {
        const next = createAndEquipArtifact(
          d,
          char.key,
          slot,
          setKey,
          mainStat
        );
        const art = next.characters.find((c) => c.key === char.key)?.artifacts[
          slot
        ];
        if (art) {
          newId = art.id;
          art.rarity = (artifactsById[setKey]?.rarity ?? 5) as 3 | 4 | 5;
          art.level = 0;
        }
        return next;
      });
      if (newId) {
        setNewlyCreatedIds((prev) => {
          const next = new Set(prev);
          next.add(newId);
          return next;
        });
      }
      setInitialActiveSlot(slot);
      setView({ kind: "overview" });
    },
    [char.key]
  );

  const handleSaveNewArtifact = useCallback((id: string) => {
    setNewlyCreatedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleUpdateArtifact = useCallback(
    (slot: Slot, updates: Parameters<typeof updateArtifactStats>[3]) => {
      setData((d) => updateArtifactStats(d, char.key, slot, updates));
      setSaveError(null);
    },
    [char.key]
  );

  const handleCloseAndSave = useCallback(() => {
    const finalData = stripIncompleteNewArtifacts(data, newlyCreatedIds);

    // Run solver validation on all modified artifacts
    let solvedData = finalData;
    for (const c of finalData.characters) {
      const initialChar = initialData.characters.find((ic) => ic.key === c.key);
      for (const slot of Object.keys(c.artifacts) as Slot[]) {
        const art = c.artifacts[slot];
        if (!art) continue;
        const initialArt = initialChar?.artifacts[slot];
        if (initialArt && JSON.stringify(art) === JSON.stringify(initialArt))
          continue;

        const result = validateAndSolveArtifact(art);
        if ("error" in result) {
          const errorKey = result.error;
          if (errorKey.startsWith("charEdit.invalidSubstat:")) {
            const stats = errorKey
              .split(":")[1]
              .split(",")
              .map((s) => t.stat(s))
              .join(", ");
            setSaveError(t.format("charEdit.invalidSubstat", stats));
          } else {
            setSaveError(t.ui(errorKey as Parameters<typeof t.ui>[0]));
          }
          return;
        }
        // Apply solved precise values
        if (solvedData === finalData) {
          solvedData = JSON.parse(JSON.stringify(finalData));
        }
        const solvedChar = solvedData.characters.find((sc) => sc.key === c.key);
        if (solvedChar) {
          solvedChar.artifacts[slot] = result.solved;
        }
      }
    }

    if (JSON.stringify(solvedData) !== JSON.stringify(initialData)) {
      onSave(solvedData);
    }
    onOpenChange(false);
  }, [data, initialData, newlyCreatedIds, onSave, onOpenChange, t]);

  const handleCloseAndCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!charInfo) return null;

  // ── Title ──

  const titleContent = (() => {
    if (view.kind === "overview")
      return (
        <span className="flex items-center gap-2.5">
          <ItemIcon characterId={char.key} size="sm" className="shadow-sm" />
          <span>{t.character(char.key)}</span>
        </span>
      );
    if (view.kind === "weapon-pick") return t.ui("teamComp.weapon");
    // artifact-pick
    if (view.kind === "artifact-pick") {
      return `${t.slot(view.slot)} — ${view.mode === "equip" ? t.ui("common.equip") : t.ui("charEdit.createNew")}`;
    }
    return "";
  })();

  const canGoBack = view.kind !== "overview";
  const goBack = () => setView({ kind: "overview" });

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="md:max-w-xl lg:max-w-2xl gap-0 p-0 overflow-hidden bg-background">
        {canGoBack ? (
          <ResponsiveDialogHeader className="p-4 md:p-5 lg:p-6 pb-4 border-b bg-card/50 backdrop-blur-sm z-10 shrink-0 flex-row items-center gap-2 space-y-0 relative text-left">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:h-9 lg:w-9 -ml-2 shrink-0"
              onClick={goBack}
            >
              <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
            </Button>
            <ResponsiveDialogTitle className="lg:text-lg">
              {titleContent}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              {t.ui("charEdit.description")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
        ) : (
          <div className="sr-only">
            <ResponsiveDialogTitle>
              {t.character(char.key)}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t.ui("charEdit.description")}
            </ResponsiveDialogDescription>
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-2 sm:p-4 md:p-5 lg:p-6 max-h-[85vh] md:max-h-[75vh]">
          {view.kind === "overview" && (
            <OverviewPanel
              char={char}
              t={t}
              initialActiveSlot={initialActiveSlot}
              newlyCreatedIds={newlyCreatedIds}
              onSaveNewArtifact={handleSaveNewArtifact}
              onUpdateStats={updateStats}
              onUpdateWeaponStats={handleWeaponStats}
              onPickWeapon={() => setView({ kind: "weapon-pick" })}
              onUnequipWeapon={handleUnequipWeapon}
              onUpdateArtifact={handleUpdateArtifact}
              onDeleteArtifact={handleDeleteArtifact}
              onUnequipArtifact={handleUnequipArtifact}
              onPickArtifact={(slot, mode) =>
                setView({ kind: "artifact-pick", slot, mode })
              }
              onSave={handleCloseAndSave}
              onCancel={handleCloseAndCancel}
              saveError={saveError}
            />
          )}
          {view.kind === "weapon-pick" && (
            <WeaponPickPanel
              char={char}
              data={data}
              t={t}
              onSelect={handleChangeWeapon}
              onUnequip={() => {
                handleUnequipWeapon();
                setView({ kind: "overview" });
              }}
            />
          )}
          {view.kind === "artifact-pick" && (
            <ArtifactPickPanel
              char={char}
              slot={view.slot}
              mode={view.mode}
              data={data}
              t={t}
              onEquip={(id) => handleEquipFromInventory(view.slot, id)}
              onSwap={(ownerKey) => handleSwapArtifact(view.slot, ownerKey)}
              onCreate={(setKey) => handleCreateArtifact(view.slot, setKey)}
              onUnequip={() => {
                handleUnequipArtifact(view.slot);
                setView({ kind: "overview" });
              }}
              onDelete={() => {
                handleDeleteArtifact(view.slot);
                setView({ kind: "overview" });
              }}
            />
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

function OverviewPanel({
  char,
  t,
  initialActiveSlot,
  newlyCreatedIds,
  onSaveNewArtifact,
  onUpdateStats,
  onUpdateWeaponStats,
  onPickWeapon,
  onUnequipWeapon,
  onUpdateArtifact,
  onDeleteArtifact,
  onUnequipArtifact,
  onPickArtifact,
  onSave,
  onCancel,
  saveError,
}: {
  char: CharacterData;
  t: ReturnType<typeof useLanguage>["t"];
  initialActiveSlot: Slot | null;
  newlyCreatedIds: Set<string>;
  onSaveNewArtifact: (id: string) => void;
  onUpdateStats: (u: {
    constellation?: number;
    level?: number;
    talent?: { auto: number; skill: number; burst: number };
  }) => void;
  onUpdateWeaponStats: (u: { level?: number; refinement?: number }) => void;
  onPickWeapon: () => void;
  onUnequipWeapon: () => void;
  onUpdateArtifact: (
    slot: Slot,
    updates: Partial<
      Pick<
        ArtifactData,
        | "level"
        | "rarity"
        | "mainStatKey"
        | "substats"
        | "lock"
        | "unactivatedSubstats"
      >
    >
  ) => void;
  onDeleteArtifact: (slot: Slot) => void;
  onUnequipArtifact: (slot: Slot) => void;
  onPickArtifact: (slot: Slot, mode: "equip" | "create") => void;
  onSave: () => void;
  onCancel: () => void;
  saveError: string | null;
}) {
  const [activeSlot, setActiveSlot] = useState<Slot | null>(initialActiveSlot);

  const charInfo = charactersById[char.key];
  const weapon = char.weapon;
  const weaponInfo = weapon ? weaponsById[weapon.key] : null;
  const talents = char.talent || { auto: 1, skill: 1, burst: 1 };

  return (
    <div className="space-y-5 pb-2">
      {/* ── Row 1 & 2: Character Attributes ── */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm flex flex-col gap-4">
        {/* Row 1 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-[140px] flex-1">
            {charInfo && (
              <ItemIcon characterId={char.key} size="md" className="shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="font-bold text-base">
                {t.character(char.key)}
              </span>
              <span className="text-xs text-muted-foreground">
                {charInfo && "★".repeat(charInfo.rarity)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FieldLabel>{t.ui("common.level")}</FieldLabel>
              <NumberInput
                value={char.level}
                min={1}
                max={90}
                onChange={(v) => onUpdateStats({ level: v })}
                className="w-16 lg:w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <FieldLabel>{t.ui("charEdit.constellation")}</FieldLabel>
              <Select
                value={String(char.constellation)}
                onValueChange={(v) =>
                  onUpdateStats({ constellation: Number(v) })
                }
              >
                <SelectTrigger className="w-16 lg:w-20 h-9 font-medium text-xs lg:text-sm px-2.5 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 7 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {t.format("common.constellationFormat", i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-4 pt-1 mx-auto max-w-full">
          {(["auto", "skill", "burst"] as const).map((key) => (
            <div
              key={key}
              className="flex items-center gap-1.5 sm:gap-2 shrink-0"
            >
              <div className="min-w-[28px] sm:min-w-[40px]">
                <FieldLabel>
                  {key === "auto"
                    ? t.ui("accountData.talents.auto")
                    : key === "skill"
                      ? t.ui("accountData.talents.skill")
                      : t.ui("accountData.talents.burst")}
                </FieldLabel>
              </div>
              <NumberInput
                value={talents[key]}
                min={1}
                max={15}
                onChange={(v) =>
                  onUpdateStats({ talent: { ...talents, [key]: v } })
                }
                className="w-14 sm:w-16 px-1.5 sm:px-3"
              />
            </div>
          ))}
        </div>
      </div>

      <hr className="border-border/40" />

      {/* ── Row 3: Equipment (Weapon) ── */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 shadow-sm">
        {weapon && weaponInfo ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-[140px] flex-1">
              <ItemIcon weaponId={weapon.key} size="md" className="shrink-0" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base truncate max-w-[120px] lg:max-w-full">
                    {t.weapon(weapon.key)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={onPickWeapon}
                    title={t.ui("charEdit.change")}
                  >
                    <ArrowLeftRight className="w-3 h-3 mr-1.5" />
                    {t.ui("charEdit.change")}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {"★".repeat(weaponInfo.rarity)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <FieldLabel>{t.ui("common.level")}</FieldLabel>
                <NumberInput
                  value={weapon.level}
                  min={1}
                  max={90}
                  onChange={(v) => onUpdateWeaponStats({ level: v })}
                  className="w-16 lg:w-20"
                />
              </div>
              <div className="flex items-center gap-2">
                <FieldLabel>{t.ui("charEdit.refinement")}</FieldLabel>
                <Select
                  value={String(weapon.refinement)}
                  onValueChange={(v) =>
                    onUpdateWeaponStats({ refinement: Number(v) })
                  }
                >
                  <SelectTrigger className="w-16 lg:w-20 h-9 font-medium text-xs lg:text-sm px-2.5 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {t.format("common.refinementFormat", r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-2">
            <Button
              variant="outline"
              size="sm"
              className="lg:h-9 lg:px-4 lg:text-sm"
              onClick={onPickWeapon}
            >
              <Search className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
              {t.ui("charEdit.equipWeapon")}
            </Button>
          </div>
        )}
      </div>

      <hr className="border-border/40" />

      {/* ── Row 4: Artifacts ── */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-3 shadow-sm">
        {/* Slots Row */}
        <div className="flex justify-between gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {allSlots.map((slot) => {
            const art = char.artifacts[slot];
            const isSelected = activeSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(isSelected ? null : slot)}
                className={cn(
                  "relative flex flex-col items-center flex-1 py-3 px-1 rounded-xl border",
                  isSelected
                    ? "bg-accent border-primary/40 shadow-sm ring-1 ring-primary/20"
                    : "bg-transparent border-transparent hover:bg-accent/50"
                )}
              >
                {art ? (
                  <ItemIcon
                    artifactSetId={art.setKey}
                    slot={slot}
                    rarity={art.rarity}
                    level={`+${art.level}`}
                    size="sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-dashed border-border flex items-center justify-center bg-muted/20">
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <span
                  className={cn(
                    "mt-2 text-xs uppercase font-bold tracking-wider leading-none",
                    isSelected ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {t.slot(slot)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Slot Editor View */}
        {activeSlot && (
          <div className="mt-3 pt-4 border-t border-border/40 animate-in fade-in slide-in-from-top-2 relative">
            <ArtifactEditor
              char={char}
              slot={activeSlot}
              isNew={newlyCreatedIds.has(char.artifacts[activeSlot]?.id ?? "")}
              t={t}
              onPick={(mode) => onPickArtifact(activeSlot, mode)}
              onUpdate={(u) => onUpdateArtifact(activeSlot, u)}
              onSaveNew={() =>
                onSaveNewArtifact(char.artifacts[activeSlot]!.id)
              }
            />
          </div>
        )}
      </div>

      {/* ── Row 5: Save/Cancel ── */}
      <div className="space-y-2 pt-4">
        {saveError && (
          <p className="text-sm text-destructive text-right">{saveError}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            {t.ui("common.cancel")}
          </Button>
          <Button variant="default" onClick={onSave}>
            {t.ui("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Artifact Editor ──────────────────────────────────────────────────────────

function ArtifactEditor({
  char,
  slot,
  isNew,
  t,
  onPick,
  onUpdate,
  onSaveNew,
}: {
  char: CharacterData;
  slot: Slot;
  isNew: boolean;
  t: ReturnType<typeof useLanguage>["t"];
  onPick: (mode: "equip" | "create") => void;
  onUpdate: (
    u: Partial<
      Pick<
        ArtifactData,
        | "level"
        | "rarity"
        | "mainStatKey"
        | "substats"
        | "lock"
        | "unactivatedSubstats"
      >
    >
  ) => void;
  onSaveNew?: () => void;
}) {
  const art = char.artifacts[slot];
  const validMainStats = mainStatsForSlot(slot);
  const isFixedMainStat = slot === "flower" || slot === "plume";

  // Track which substat keys are "original" (read-only key + not deletable).
  // Newly-added substats (not in lockedKeys) get an editable key selector + delete.
  const lockedKeysRef = useRef<ReadonlySet<string>>(new Set());
  const prevArtRef = useRef<{ id?: string; isNew: boolean }>({ isNew: true });
  if (art) {
    const artChanged = art.id !== prevArtRef.current.id;
    const savedNew = prevArtRef.current.isNew && !isNew;
    if (artChanged || savedNew) {
      lockedKeysRef.current = isNew
        ? new Set()
        : new Set(Object.keys(art.substats));
      prevArtRef.current = { id: art.id, isNew };
    }
  }

  if (!art) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <p className="text-sm lg:text-base text-muted-foreground">
          {t.ui("charEdit.emptySlot")}
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            className="lg:h-9 lg:px-4 lg:text-sm"
            onClick={() => onPick("equip")}
          >
            <Package className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
            {t.ui("common.equip")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="lg:h-9 lg:px-4 lg:text-sm"
            onClick={() => onPick("create")}
          >
            <Plus className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
            {t.ui("charEdit.create")}
          </Button>
        </div>
      </div>
    );
  }

  const activatedCount = Object.keys(art.substats).length;
  const unactivatedCount = Object.keys(art.unactivatedSubstats ?? {}).length;
  const totalCount = activatedCount + unactivatedCount;
  const allKeys = [
    ...Object.keys(art.substats),
    ...Object.keys(art.unactivatedSubstats ?? {}),
  ];
  const hasMainDupe = allKeys.includes(art.mainStatKey);
  const isLegal = totalCount === 4 && !hasMainDupe;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 px-1">
        <div className="flex-1 min-w-0 lg:pl-1">
          <div className="text-sm lg:text-base font-bold truncate">
            {t.artifact(art.setKey)}
          </div>
          <div className="text-xs lg:text-sm text-muted-foreground mt-0.5">
            {"★".repeat(art.rarity)}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-8 lg:h-9 text-muted-foreground hover:text-foreground"
            onClick={() => onPick("equip")}
            title={t.ui("charEdit.change")}
          >
            <ArrowLeftRight className="w-4 h-4 lg:w-4 lg:h-4 mr-1.5" />
            {t.ui("charEdit.change")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 flex-[2]">
          <FieldLabel>{t.ui("charEdit.mainStat")}</FieldLabel>
          {isFixedMainStat || !isNew ? (
            <div className="h-9 lg:h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-xs lg:text-sm font-semibold text-muted-foreground shadow-sm">
              {t.stat(art.mainStatKey)}
            </div>
          ) : (
            <Select
              value={art.mainStatKey}
              onValueChange={(v) => onUpdate({ mainStatKey: v })}
            >
              <SelectTrigger className="h-9 lg:h-10 font-medium text-xs lg:text-sm px-2.5 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validMainStats.map((stat) => (
                  <SelectItem key={stat} value={stat}>
                    {t.stat(stat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5 flex-1">
          <FieldLabel>{t.ui("common.level")}</FieldLabel>
          <NumberInput
            value={art.level}
            min={0}
            max={
              art.rarity === 5
                ? 20
                : art.rarity === 4
                  ? 16
                  : art.rarity === 3
                    ? 12
                    : 4
            }
            onChange={(v) => {
              const wasBelow4 = art.level < 4;
              const isNow4Plus = v >= 4;
              if (
                wasBelow4 &&
                isNow4Plus &&
                art.rarity === 5 &&
                art.unactivatedSubstats
              ) {
                const entries = Object.entries(art.unactivatedSubstats);
                if (entries.length > 0) {
                  const newSubstats = { ...art.substats };
                  for (const [key, val] of entries) {
                    if (val !== undefined)
                      (newSubstats as Record<string, number>)[key] = val;
                  }
                  onUpdate({
                    level: v,
                    substats: newSubstats as typeof art.substats,
                    unactivatedSubstats: {},
                  });
                  return;
                }
              }
              onUpdate({ level: v });
            }}
          />
        </div>
      </div>

      <SubstatsEditor
        substats={art.substats}
        unactivatedSubstat={
          art.unactivatedSubstats
            ? ((Object.entries(art.unactivatedSubstats)[0] as
                | [SubStat, number]
                | undefined) ?? null)
            : null
        }
        mainStatKey={art.mainStatKey}
        rarity={art.rarity}
        level={art.level}
        maxCount={4}
        isNew={isNew}
        lockedKeys={lockedKeysRef.current}
        t={t}
        onChange={(s) => onUpdate({ substats: s })}
        onChangeUnactivated={(u) =>
          onUpdate({ unactivatedSubstats: u ? { [u[0]]: u[1] } : {} })
        }
      />

      {isNew && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={onSaveNew}
            disabled={!isLegal}
            className="w-full sm:w-auto"
          >
            {t.ui("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Substats Editor ──────────────────────────────────────────────────────────

function SubstatsEditor({
  substats,
  unactivatedSubstat,
  mainStatKey,
  rarity,
  level,
  maxCount,
  isNew,
  lockedKeys,
  t,
  onChange,
  onChangeUnactivated,
}: {
  substats: Partial<Record<SubStat, number>>;
  unactivatedSubstat: [SubStat, number] | null;
  mainStatKey: string;
  rarity: number;
  level: number;
  maxCount: number;
  isNew: boolean;
  lockedKeys: ReadonlySet<string>;
  t: ReturnType<typeof useLanguage>["t"];
  onChange: (s: Partial<Record<SubStat, number>>) => void;
  onChangeUnactivated: (u: [SubStat, number] | null) => void;
}) {
  const entries = Object.entries(substats) as [SubStat, number][];
  const usedKeys = new Set(entries.map(([k]) => k));
  if (unactivatedSubstat) usedKeys.add(unactivatedSubstat[0]);

  const totalCount = entries.length + (unactivatedSubstat ? 1 : 0);
  const canAdd = totalCount < maxCount;

  // For 5★ lv0-3: the 4th substat can be toggled unactivated
  const show4thToggle = rarity === 5 && level < 4;

  return (
    <div className="space-y-3 pt-5 border-t border-border/40">
      <FieldLabel>{t.ui("charEdit.substats")}</FieldLabel>
      <div className="space-y-2.5">
        {entries.map(([key, value], idx) => {
          const isEditable = isNew || !lockedKeys.has(key);
          // Show unactivated toggle on 4th activated row for 5★ lv0-3
          const is4thRow = idx === 3;
          const showToggle = show4thToggle && is4thRow;
          return (
            <SubstatRow
              key={key}
              statKey={key}
              value={value}
              isEditable={isEditable}
              usedKeys={usedKeys}
              mainStatKey={mainStatKey}
              t={t}
              dimmed={false}
              onChangeKey={(v) => {
                const next: Partial<Record<SubStat, number>> = {};
                for (const [k, val] of entries) {
                  next[k === key ? v : k] = val;
                }
                onChange(next);
              }}
              onChangeValue={(v) => onChange({ ...substats, [key]: v })}
              onDelete={() => {
                const next = { ...substats };
                delete next[key];
                onChange(next);
              }}
              isUnactivated={false}
              showUnactivatedToggle={showToggle}
              onToggleUnactivated={
                showToggle
                  ? () => {
                      // Move from activated to unactivated
                      const next = { ...substats };
                      delete next[key];
                      onChange(next);
                      onChangeUnactivated([key, value]);
                    }
                  : undefined
              }
            />
          );
        })}

        {/* Unactivated 4th substat row for 5★ lv0-3 */}
        {unactivatedSubstat && (
          <SubstatRow
            statKey={unactivatedSubstat[0]}
            value={unactivatedSubstat[1]}
            isEditable={true}
            usedKeys={usedKeys}
            mainStatKey={mainStatKey}
            t={t}
            dimmed={true}
            onChangeKey={(v) => onChangeUnactivated([v, unactivatedSubstat[1]])}
            onChangeValue={(v) =>
              onChangeUnactivated([unactivatedSubstat[0], v])
            }
            onDelete={() => onChangeUnactivated(null)}
            isUnactivated={true}
            showUnactivatedToggle={true}
            onToggleUnactivated={() => {
              // Move from unactivated to activated
              onChangeUnactivated(null);
              onChange({
                ...substats,
                [unactivatedSubstat[0]]: unactivatedSubstat[1],
              });
            }}
          />
        )}
      </div>

      {canAdd && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-muted-foreground hover:text-foreground px-2 lg:h-9 lg:px-4 lg:text-sm"
          onClick={() => {
            const available = ALL_SUBSTATS.find(
              (s) => !usedKeys.has(s) && s !== mainStatKey
            );
            if (!available) return;

            // If this is the 4th substat on a 5★ lv0-3, add as unactivated
            if (show4thToggle && entries.length === 3 && !unactivatedSubstat) {
              onChangeUnactivated([available, 0]);
            } else {
              onChange({ ...substats, [available]: 0 });
            }
          }}
        >
          <Plus className="w-4 h-4 lg:w-5 lg:h-5 mr-1.5" />
          {t.ui("charEdit.addSubstat")}
        </Button>
      )}
    </div>
  );
}

/** A single substat row with key select, value input, and optional unactivated toggle. */
function SubstatRow({
  statKey,
  value,
  isEditable,
  usedKeys,
  mainStatKey,
  t,
  dimmed,
  onChangeKey,
  onChangeValue,
  onDelete,
  isUnactivated,
  showUnactivatedToggle,
  onToggleUnactivated,
}: {
  statKey: SubStat;
  value: number;
  isEditable: boolean;
  usedKeys: Set<SubStat>;
  mainStatKey: string;
  t: ReturnType<typeof useLanguage>["t"];
  dimmed: boolean;
  onChangeKey: (key: SubStat) => void;
  onChangeValue: (value: number) => void;
  onDelete: () => void;
  /** Whether this substat is currently unactivated */
  isUnactivated: boolean;
  /** Whether to show the unactivated checkbox */
  showUnactivatedToggle: boolean;
  onToggleUnactivated?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 items-center",
        dimmed &&
          "opacity-60 border border-dashed border-border rounded-lg p-1.5"
      )}
    >
      {isEditable ? (
        <Select value={statKey} onValueChange={onChangeKey}>
          <SelectTrigger className="w-auto h-9 lg:h-10 font-medium text-xs lg:text-sm px-2.5 bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_SUBSTATS.filter(
              (s) => s === statKey || (!usedKeys.has(s) && s !== mainStatKey)
            ).map((s) => (
              <SelectItem key={s} value={s}>
                {t.stat(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="h-9 lg:h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-xs lg:text-sm font-medium text-muted-foreground shadow-sm">
          {t.stat(statKey)}
        </div>
      )}
      {showUnactivatedToggle && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Checkbox
            id={`unactivated-${statKey}`}
            checked={isUnactivated}
            onCheckedChange={() => onToggleUnactivated?.()}
          />
          {/* biome-ignore lint/a11y/noLabelWithoutControl: htmlFor targets Radix Checkbox */}
          <label
            htmlFor={`unactivated-${statKey}`}
            className="text-xs text-muted-foreground select-none cursor-pointer"
          >
            {t.ui("charEdit.unactivated")}
          </label>
        </div>
      )}
      <div className="flex-1" />
      <NumberInput
        value={value}
        min={0}
        max={999}
        step={isPctStat(statKey) ? 0.1 : 1}
        onChange={onChangeValue}
        className="w-24 lg:w-32 text-right pr-3"
      />
      {isEditable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:h-10 lg:w-10 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onDelete}
          title={t.ui("common.delete")}
        >
          <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />
        </Button>
      )}
    </div>
  );
}

// ─── Weapon Pick Panel ────────────────────────────────────────────────────────

function WeaponPickPanel({
  char,
  data,
  t,
  onSelect,
  onUnequip,
}: {
  char: CharacterData;
  data: AccountData;
  t: ReturnType<typeof useLanguage>["t"];
  onSelect: (key: string) => void;
  onUnequip: () => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();

  const { characterStats, weaponStats } = useGameStats();
  const reqType = characterStats?.[char.key]?.weaponType;

  const inventory = data.extraWeapons.filter((w) => {
    const info = weaponStats?.[w.key];
    const matchesType = !reqType || !info || info.type === reqType;
    return matchesType && t.weapon(w.key).toLowerCase().includes(q);
  });

  const equipped = data.characters
    .filter((c) => c.key !== char.key && c.weapon)
    .map((c) => ({ weapon: c.weapon!, owner: c.key }))
    .filter((e) => {
      const info = weaponStats?.[e.weapon.key];
      const matchesType = !reqType || !info || info.type === reqType;
      return matchesType && t.weapon(e.weapon.key).toLowerCase().includes(q);
    });

  return (
    <div className="space-y-4 pb-2">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.ui("common.search")}
          className="pl-9 bg-card"
          autoFocus
        />
      </div>

      {char.weapon && (
        <div className="py-2">
          <Button variant="secondary" className="w-full" onClick={onUnequip}>
            <Package className="w-4 h-4 mr-2" />
            {t.ui("charEdit.stash")}
          </Button>
        </div>
      )}

      {inventory.length > 0 && (
        <PickerSection label={t.ui("accountData.inventory")}>
          {inventory.map((w) => {
            if (!weaponsById[w.key]) return null;
            return (
              <PickerItem
                key={w.id}
                label={t.weapon(w.key)}
                onClick={() => onSelect(w.key)}
              >
                <ItemIcon
                  weaponId={w.key}
                  badge={w.refinement}
                  level={`Lv. ${w.level}`}
                  size="sm"
                />
              </PickerItem>
            );
          })}
        </PickerSection>
      )}

      {equipped.length > 0 && (
        <PickerSection label={t.ui("charEdit.equippedByOthers")}>
          {equipped.map((e) => {
            if (!weaponsById[e.weapon.key]) return null;
            return (
              <PickerItem
                key={e.weapon.id}
                label={`${t.weapon(e.weapon.key)}`}
                subtitle={`${t.character(e.owner)} • ${t.ui("charEdit.willSwap")}`}
                onClick={() => onSelect(e.weapon.key)}
              >
                <div className="relative">
                  <ItemIcon
                    weaponId={e.weapon.key}
                    badge={e.weapon.refinement}
                    level={`Lv. ${e.weapon.level}`}
                    size="sm"
                  />
                </div>
              </PickerItem>
            );
          })}
        </PickerSection>
      )}

      {inventory.length === 0 && equipped.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10 bg-card rounded-xl border border-dashed border-border">
          {t.ui("common.noResults")}
        </p>
      )}
    </div>
  );
}

// ─── Artifact Pick Panel ──────────────────────────────────────────────────────

function ArtifactPickPanel({
  char,
  slot,
  mode,
  data,
  t,
  onEquip,
  onSwap,
  onCreate,
  onUnequip,
  onDelete,
}: {
  char: CharacterData;
  slot: Slot;
  mode: "equip" | "create";
  data: AccountData;
  t: ReturnType<typeof useLanguage>["t"];
  onEquip: (id: string) => void;
  onSwap: (ownerKey: string) => void;
  onCreate: (setKey: string) => void;
  onUnequip: () => void;
  onDelete: () => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"same" | "other">("same");
  const q = search.toLowerCase();

  const currentSetKey = char.artifacts[slot]?.setKey;

  // Combine inventory and equipped into a single list
  const allArtifacts = [
    ...getInventoryArtifactsForSlot(data, slot).map((a) => ({
      art: a,
      owner: undefined,
    })),
    ...data.characters
      .filter((c) => c.key !== char.key && c.artifacts[slot])
      .map((c) => ({ art: c.artifacts[slot]!, owner: c.key })),
  ].filter((item) => t.artifact(item.art.setKey).toLowerCase().includes(q));

  // Partition based on the current artifact's set
  let displayedArtifacts = allArtifacts;
  if (currentSetKey) {
    if (tab === "same") {
      displayedArtifacts = allArtifacts.filter(
        (i) => i.art.setKey === currentSetKey
      );
    } else {
      displayedArtifacts = allArtifacts.filter(
        (i) => i.art.setKey !== currentSetKey
      );
    }
  }

  const allSets = Object.values(artifactsById).filter(
    (s) => s.rarity >= 4 && t.artifact(s.id).toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5 pb-2">
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.ui("common.search")}
          className="pl-9 bg-card"
          autoFocus
        />
      </div>

      {mode === "equip" && char.artifacts[slot] && (
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" className="flex-1" onClick={onUnequip}>
            <Package className="w-4 h-4 mr-2" />
            {t.ui("charEdit.stash")}
          </Button>
          <Button
            variant="destructive-outline"
            className="flex-1"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t.ui("common.delete")}
          </Button>
        </div>
      )}

      {mode === "equip" && currentSetKey && (
        <Tabs value={tab} onValueChange={(v) => setTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="same">
              {t.ui("accountData.sameSet")}
            </TabsTrigger>
            <TabsTrigger value="other">
              {t.ui("accountData.allOther")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {mode === "equip" && displayedArtifacts.length > 0 && (
        <PickerSection label={t.ui("accountData.inventory")}>
          {displayedArtifacts.map(({ art: a, owner }) => {
            return (
              <ArtifactDataHoverCard
                key={a.id}
                artifact={a}
                slot={slot}
                side="left"
              >
                <PickerItem
                  label={`${t.artifact(a.setKey)}`}
                  subtitle={
                    owner
                      ? `${t.character(owner)} • ${t.stat(a.mainStatKey)}`
                      : t.stat(a.mainStatKey)
                  }
                  onClick={() => (owner ? onSwap(owner) : onEquip(a.id))}
                  disableTooltip
                >
                  <ItemIcon
                    artifactSetId={a.setKey}
                    slot={slot}
                    rarity={a.rarity}
                    level={`+${a.level}`}
                    size="sm"
                  >
                    {owner && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full border border-border bg-background shadow-sm overflow-hidden z-20">
                        <img
                          src={
                            charactersById[owner]?.imagePath
                              ? getAssetUrl(charactersById[owner].imagePath)
                              : ""
                          }
                          alt={t.character(owner)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </ItemIcon>
                </PickerItem>
              </ArtifactDataHoverCard>
            );
          })}
        </PickerSection>
      )}

      {mode === "equip" && displayedArtifacts.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10 bg-card rounded-xl border border-dashed border-border">
          {t.ui("common.noResults")}
        </p>
      )}

      {mode === "create" && (
        <PickerSection label={t.ui("charEdit.createNew")}>
          <div className="col-span-full grid grid-cols-4 md:grid-cols-5 gap-2 max-h-[60vh] lg:max-h-96 overflow-y-auto pr-1">
            {allSets.map((s) => (
              <PickerItem
                key={s.id}
                label={t.artifact(s.id)}
                onClick={() => onCreate(s.id)}
              >
                <ItemIcon artifactSetId={s.id} slot={slot} size="sm" />
              </PickerItem>
            ))}
          </div>
        </PickerSection>
      )}
    </div>
  );
}

// ─── Shared Primitives ────────────────────────────────────────────────────────

function SectionHeader({
  color,
  children,
}: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className={cn("w-1 h-3.5 lg:h-4 rounded-full", color)} />
      <h3 className="text-xs lg:text-sm font-bold tracking-widest text-foreground uppercase">
        {children}
      </h3>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">
      {children}
    </span>
  );
}

function NumberInput({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <Input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      className={cn(
        "h-9 lg:h-10 tabular-nums font-medium text-sm lg:text-base bg-background/50 px-3",
        className
      )}
    />
  );
}

function PickerSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader color="bg-secondary">{label}</SectionHeader>
      <div className="grid grid-cols-4 md:grid-cols-5 gap-2">{children}</div>
    </div>
  );
}

const PickerItem = forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode;
    label: string;
    subtitle?: string;
    onClick: (e?: React.MouseEvent) => void;
    disableTooltip?: boolean;
  }
>(({ children, label, subtitle, onClick, disableTooltip, ...props }, ref) => {
  const content = (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex flex-col items-center p-2 rounded-xl border border-transparent hover:border-border hover:bg-accent/40 focus-visible:outline-none focus:bg-accent ring-1 ring-transparent focus:ring-primary/20 gap-2 group w-full"
      {...props}
    >
      <div className="group-hover:scale-105">{children}</div>
      <span className="text-xs leading-tight text-center font-medium line-clamp-2 w-full text-foreground/80 group-hover:text-foreground">
        {label}
      </span>
    </button>
  );

  if (disableTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      {subtitle && (
        <TooltipContent
          side="bottom"
          className="text-xs px-2.5 py-1.5 max-w-[200px] text-center shadow-lg"
        >
          <p className="font-semibold">{label}</p>
          <p className="text-muted-foreground mt-0.5">{subtitle}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
});
PickerItem.displayName = "PickerItem";
