import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  MoreVertical,
  RotateCcw,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ItemPicker } from "@/components/shared/ItemPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LightweightMultiSelect } from "@/components/ui/lightweight-multiselect";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { getGobletPool, statPools } from "@/data/constants";
import type {
  BuildConstellation,
  BuildRole,
  BuildStyle,
  Element,
  MainStatSlot,
} from "@/data/enums";
import {
  buildConstellations,
  buildRoles,
  buildStyles,
  mainStatSlots,
} from "@/data/enums";
import type {
  ArtifactSetConfig,
  Build,
  WeightedMainStat,
  WeightedSubStat,
} from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { AutoTuneOutput } from "@/lib/artifact-builds/auto-tune/pipeline";
import { parseBuildConstellation } from "@/lib/typeValidation";
import { cn } from "@/lib/utils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { WeightedStatSelect } from "./WeightedStatSelect";

const AutoTuneDialog = lazy(() =>
  import("./AutoTuneDialog").then((m) => ({ default: m.AutoTuneDialog }))
);

const MAIN_STAT_PRESETS = [80, 85, 90, 95, 100];

// Local constants for UI colors
const STYLE_COLORS: Record<BuildStyle, string> = {
  "on-field": "#f59e0b", // amber-500
  "off-field": "#8b5cf6", // violet-500
};

const ROLE_COLORS: Record<BuildRole, string> = {
  dps: "#e06c75", // soft red
  support: "#3b82f6", // blue-500
  sustain: "#10b981", // emerald-500
};

const CONS_COLORS: Record<BuildConstellation, string> = {
  0: "#9ca3af", // gray-400
  1: "#10b981", // emerald-500
  2: "#3b82f6", // blue-500
  4: "#a855f7", // purple-500
  6: "#f59e0b", // amber-500
};

interface BuildCardProps {
  build: Build;
  buildId: string;
  onDuplicate: (buildId: string, build: Build) => void;
  onMove?: (buildId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  element: Element;
}

function BuildCardComponent({
  build,
  buildId,
  onDuplicate,
  onMove,
  canMoveUp,
  canMoveDown,
  element,
}: BuildCardProps) {
  const { t } = useLanguage();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const setBuild = useBuildsStore((state) => state.setBuild);
  const deleteBuild = useBuildsStore((state) => state.deleteBuild);
  const revertBuild = useBuildsStore((state) => state.revertBuild);
  // source is derived in useResolvedBuilds
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "revert" | null
  >(null);
  const [autoTuneOpen, setAutoTuneOpen] = useState(false);

  // ... (localName logic, handleNameChange, handleBuildChange ...)
  const [localName, setLocalName] = useState("");
  const nameUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    if (build?.name !== undefined) {
      setLocalName(build.name);
    }
  }, [build?.name]);

  const handleNameChange = useCallback(
    (newName: string) => {
      setLocalName(newName);
      if (nameUpdateTimeoutRef.current) {
        clearTimeout(nameUpdateTimeoutRef.current);
      }
      nameUpdateTimeoutRef.current = setTimeout(() => {
        setBuild(buildId, { name: newName }, build);
      }, 300);
    },
    [buildId, setBuild, build]
  );

  const handleNameBlur = useCallback(() => {
    if (nameUpdateTimeoutRef.current) {
      clearTimeout(nameUpdateTimeoutRef.current);
    }
    setBuild(buildId, { name: localName }, build);
  }, [buildId, localName, setBuild, build]);

  const handleBuildChange = useCallback(
    (changes: Partial<Build>) => {
      setBuild(buildId, changes, build);
    },
    [buildId, setBuild, build]
  );

  const handleToggleVisibility = useCallback(() => {
    if (build) {
      setBuild(buildId, { visible: !build.visible }, build);
    }
  }, [build, buildId, setBuild]);

  const handleConstellationChange = useCallback(
    (value: string) => {
      const cons = parseBuildConstellation(Number(value));
      setBuild(buildId, { minCons: cons === 0 ? undefined : cons }, build);
    },
    [buildId, setBuild, build]
  );

  const handleConfirmAction = () => {
    if (confirmAction === "delete") {
      deleteBuild(build.characterId, buildId);
    } else if (confirmAction === "revert") {
      revertBuild(build.characterId, buildId);
    }
    setConfirmAction(null);
  };

  const handleAutoTuneApply = useCallback(
    (result: AutoTuneOutput) => {
      // Preserve existing ER weights — autotune ignores ER so we carry them over
      const oldErSands = build.sandsWeights.find((w) => w.stat === "er");
      const oldErSub = build.substats.find((s) => s.stat === "er");

      const newSandsWeights = oldErSands
        ? [...result.sandsWeights.filter((w) => w.stat !== "er"), oldErSands]
        : result.sandsWeights;

      const newSubstats = oldErSub
        ? [...result.substats.filter((s) => s.stat !== "er"), oldErSub]
        : result.substats;

      handleBuildChange({
        substats: newSubstats,
        sandsWeights: newSandsWeights,
        gobletWeights: result.gobletWeights,
        circletWeights: result.circletWeights,
        normalizer: result.normalizer,
      });
    },
    [handleBuildChange, build.sandsWeights, build.substats]
  );

  const validationErrors = useBuildsStore(
    (state) => state.validationErrors?.[buildId]
  );

  // ... (validation logic, localStatPools, options ...)
  const validation = useMemo(() => {
    if (!build) return { isValid: false };
    const warnings = (validationErrors || []).map((key) => t.ui(key));
    return {
      isValid: warnings.length === 0,
      warningMessage: warnings.length > 0 ? warnings.join("\n") : undefined,
    };
  }, [build, validationErrors, t]);

  const localStatPools = useMemo(
    () => ({
      sands: statPools.sands,
      goblet: getGobletPool(element),
      circlet: statPools.circlet,
    }),
    [element]
  );

  const mainStatLabel = (slot: MainStatSlot) => {
    if (isMobile) {
      return t.slot(slot);
    }
    switch (slot) {
      case "sands":
        return t.ui("buildCard.sandsMain");
      case "goblet":
        return t.ui("buildCard.gobletMain");
      case "circlet":
        return t.ui("buildCard.circletMain");
    }
  };

  const styleOptions = useMemo(
    () =>
      buildStyles.map((s) => ({
        value: s,
        label: t.style(s),
        color: STYLE_COLORS[s],
      })),
    [t]
  );
  const roleOptions = useMemo(
    () =>
      buildRoles.map((r) => ({
        value: r,
        label: t.role(r),
        color: ROLE_COLORS[r],
      })),
    [t]
  );

  if (!build) return null;

  const pickerValue =
    build.composition === "4pc"
      ? build.artifactSet
        ? { type: "4pc" as const, setId: build.artifactSet }
        : null
      : build.halfSet1 && build.halfSet2
        ? {
            type: "2pc+2pc" as const,
            halfSetIds: [build.halfSet1, build.halfSet2] as [string, string],
          }
        : null;

  const handlePickerChange = (val: ArtifactSetConfig) => {
    if (val.type === "4pc") {
      handleBuildChange({
        composition: "4pc",
        artifactSet: val.setId,
        halfSet1: undefined,
        halfSet2: undefined,
      });
    } else {
      handleBuildChange({
        composition: "2pc+2pc",
        halfSet1: val.halfSetIds[0],
        halfSet2: val.halfSetIds[1],
        artifactSet: undefined,
      });
    }
  };

  const currentStyles = build.styles ?? [];
  const currentRoles = build.roles ?? [];
  const currentCons = build.minCons ?? 0;

  const multiSelectTriggerClass = cn(
    "border-border/40 bg-foreground/5 rounded-full h-auto w-auto",
    "min-w-10 pl-2 pr-1 py-1 text-xs [&>svg]:h-3 [&>svg]:w-3",
    "md:min-w-12 md:pl-3 md:pr-1.5 md:text-sm md:[&>svg]:h-3.5 md:[&>svg]:w-3.5",
    "lg:pl-4 lg:pr-2"
  );
  const multiSelectItemClass = "text-xs md:text-sm";

  const labelsRow = (
    <div className="flex items-center flex-wrap gap-1 md:gap-3 lg:gap-4">
      <LightweightMultiSelect
        className="ml-1 md:ml-3 lg:ml-4"
        options={styleOptions}
        value={currentStyles}
        onValueChange={(value: string[]) =>
          handleBuildChange({ styles: value as BuildStyle[] })
        }
        placeholder={t.ui("buildCard.stylesLabel")}
        triggerClassName={multiSelectTriggerClass}
        itemClassName={multiSelectItemClass}
      />
      <LightweightMultiSelect
        options={roleOptions}
        value={currentRoles}
        onValueChange={(value: string[]) =>
          handleBuildChange({ roles: value as BuildRole[] })
        }
        placeholder={t.ui("buildCard.rolesLabel")}
        triggerClassName={multiSelectTriggerClass}
        itemClassName={multiSelectItemClass}
      />
      <LightweightSelect
        value={currentCons.toString()}
        onValueChange={handleConstellationChange}
      >
        <LightweightSelectTrigger
          className={multiSelectTriggerClass}
          style={{ color: CONS_COLORS[currentCons] }}
        >
          <LightweightSelectValue />
        </LightweightSelectTrigger>
        <LightweightSelectContent>
          {buildConstellations.map((cons) => (
            <LightweightSelectItem
              key={cons}
              value={cons.toString()}
              className={multiSelectItemClass}
            >
              <span style={{ color: CONS_COLORS[cons] }}>
                {t.format("common.constellationFormat", cons)}
                {cons < 6 ? "+" : ""}
              </span>
            </LightweightSelectItem>
          ))}
        </LightweightSelectContent>
      </LightweightSelect>
    </div>
  );

  return (
    <>
      <div className="border border-border/50 rounded-lg bg-muted/30">
        <div className="px-2 md:px-3 pt-2 space-y-1.5 md:space-y-0">
          <div className="flex items-center gap-2">
            <Switch
              checked={build.visible}
              onCheckedChange={handleToggleVisibility}
              className="data-[state=checked]:bg-primary flex-shrink-0"
            />
            {labelsRow}
            {!isMobile && (
              <div className="flex-1 min-w-0 px-2">
                <Input
                  value={localName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={handleNameBlur}
                  placeholder=""
                  className="rounded-full bg-transparent border-none py-0 text-primary flex-1 h-8 text-base px-3"
                />
              </div>
            )}
            <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
              <ValidationPopover
                isValid={validation.isValid}
                message={
                  validation.isValid
                    ? t.ui("buildCard.buildComplete")
                    : validation.warningMessage
                }
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-7 w-7 md:h-8 md:w-8"
                  >
                    <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {build.source === "preset"
                      ? t.ui("buildCard.presetBuild") || "Preset Build"
                      : build.source === "modified"
                        ? t.ui("buildCard.modifiedPreset") || "Modified Preset"
                        : t.ui("buildCard.customBuild") || "Custom Build"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDuplicate(buildId, build)}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>{t.ui("common.duplicate") || "Duplicate"}</span>
                  </DropdownMenuItem>
                  {onMove && (
                    <>
                      <DropdownMenuItem
                        onClick={() => onMove(buildId, "up")}
                        disabled={!canMoveUp}
                      >
                        <ArrowUp className="mr-2 h-4 w-4" />
                        <span>{t.ui("common.moveUp")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onMove(buildId, "down")}
                        disabled={!canMoveDown}
                      >
                        <ArrowDown className="mr-2 h-4 w-4" />
                        <span>{t.ui("common.moveDown")}</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  {isMobile && currentRoles.includes("dps") && (
                    <DropdownMenuItem onClick={() => setAutoTuneOpen(true)}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      <span>{t.ui("buildCard.autoTune")}</span>
                    </DropdownMenuItem>
                  )}

                  {build.source === "modified" && (
                    <DropdownMenuItem
                      onClick={() => setConfirmAction("revert")}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      <span>{t.ui("common.revert") || "Revert Changes"}</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirmAction("delete")}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>{t.ui("common.delete")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {isMobile && (
            <div className="flex items-center gap-2 px-1">
              <Input
                value={localName}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={handleNameBlur}
                placeholder=""
                className="rounded-full bg-transparent border-none py-0 text-primary flex-1 h-7 text-sm px-2"
              />
            </div>
          )}
        </div>
        <div className={cn("px-2 py-1.5 md:py-2")}>
          <div className="pt-1 border-t border-border/30">
            <div
              className={cn("flex items-center justify-center gap-2 md:gap-3")}
            >
              <div className={cn("flex-shrink-0 md:pl-1")}>
                <div className="h-full flex items-center justify-center">
                  <ItemPicker
                    type="artifact"
                    value={pickerValue}
                    onChange={handlePickerChange}
                    triggerSize={isMobile ? "sm" : "lg"}
                    showItemName={true}
                    className="w-16"
                  />
                </div>
              </div>
              <div className={cn("flex-1 min-w-0", "space-y-0.5 md:space-y-1")}>
                <div className={cn("grid grid-cols-3 gap-1")}>
                  {mainStatSlots.map((slot) => {
                    const weightsKey = `${slot}Weights` as const;
                    return (
                      <WeightedStatSelect
                        key={slot}
                        label={mainStatLabel(slot)}
                        values={build[weightsKey]}
                        onValuesChange={(values) =>
                          handleBuildChange({
                            [weightsKey]: values as WeightedMainStat[],
                          })
                        }
                        options={localStatPools[slot]}
                        maxLength={3}
                        compact={isMobile}
                        weightPresets={MAIN_STAT_PRESETS}
                      />
                    );
                  })}
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <WeightedStatSelect
                      label={t.ui("buildCard.substats")}
                      values={build.substats}
                      onValuesChange={(values) =>
                        handleBuildChange({
                          substats: values as WeightedSubStat[],
                        })
                      }
                      options={statPools.substat}
                      maxLength={5}
                      compact={isMobile}
                    />
                  </div>
                  {currentRoles.includes("dps") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 flex-shrink-0 hidden md:inline-flex"
                      onClick={() => setAutoTuneOpen(true)}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span className="text-xs">
                        {t.ui("buildCard.autoTune")}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "delete"
                ? t.ui("common.deleteTitle") || "Delete Build?"
                : t.ui("common.revertTitle") || "Revert Changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "delete"
                ? t.ui("common.deleteConfirm") ||
                  "This will delete this build configuration. If it belongs to a preset, it will be hidden."
                : t.ui("common.revertConfirm") ||
                  "This will discard your local changes and restore the original preset configuration."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmAction === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmAction === "delete"
                ? t.ui("common.delete") || "Delete"
                : t.ui("common.revert") || "Revert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {autoTuneOpen && (
        <Suspense fallback={null}>
          <AutoTuneDialog
            open={autoTuneOpen}
            onOpenChange={setAutoTuneOpen}
            characterId={build.characterId}
            element={element}
            build={build}
            onApply={handleAutoTuneApply}
          />
        </Suspense>
      )}
    </>
  );
}

// ... BuildCard memo export

// Managed popover: show on hover, pin on click, dismiss on click-outside
function ValidationPopover({
  isValid,
  message,
}: {
  isValid: boolean;
  message: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (pinned) return;
    hoverTimeout.current = setTimeout(() => setOpen(true), 100);
  }, [pinned]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    if (!pinned) setOpen(false);
  }, [pinned]);

  const handleClick = useCallback(() => {
    if (pinned) {
      setPinned(false);
      setOpen(false);
    } else {
      setPinned(true);
      setOpen(true);
    }
  }, [pinned]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    // Only allow closing via our managed logic
    if (!newOpen) {
      setPinned(false);
      setOpen(false);
    }
  }, []);

  const icon = isValid ? (
    <Check className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
  ) : (
    <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
  );

  if (isValid) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex-shrink-0 cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-64 px-3 py-2 bg-destructive text-destructive-foreground border-destructive/50"
        side="top"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="whitespace-pre-line text-sm font-medium">
          {message}
        </span>
      </PopoverContent>
    </Popover>
  );
}

// Relies on reference-stable Build objects from useResolvedBuilds and stable
// callbacks from the parent — default shallow compare is sufficient.
export const BuildCard = memo(BuildCardComponent);
