import { Button } from "@/components/ui/button";

import {
  type ArtifactConfig,
  ItemPicker,
} from "@/components/shared/ItemPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  artifactHalfSetsById,
  getGobletPool,
  statPools,
} from "@/data/constants";
import {
  type Build,
  type BuildConstellation,
  type BuildRole,
  type BuildStyle,
  type Element,
  type MainStat,
  type MainStatSlot,
  type SubStat,
  buildConstellations,
  buildRoles,
  buildStyles,
  mainStatSlots,
} from "@/data/types";

// Subtle color hints — high lightness, moderate saturation for cross-theme legibility
const STYLE_COLORS: Record<BuildStyle, string> = {
  "on-field": "hsl(35, 80%, 75%)",
  "off-field": "hsl(200, 75%, 78%)",
};
const ROLE_COLORS: Record<BuildRole, string> = {
  dps: "hsl(350, 70%, 78%)",
  support: "hsl(275, 70%, 78%)",
  sustain: "hsl(155, 60%, 72%)",
};
const CONS_COLORS: Record<BuildConstellation, string | undefined> = {
  0: undefined,
  1: "hsl(45, 40%, 82%)",
  2: "hsl(45, 75%, 75%)",
  4: "hsl(45, 75%, 75%)",
  6: "hsl(25, 85%, 72%)",
};
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { AlertCircle, Check, Copy, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatSelect } from "./StatSelect";

interface BuildCardProps {
  buildId: string;
  onDelete: () => void;
  onDuplicate: () => void;
  element: Element;
}

// Managed popover: show on hover, pin on click, dismiss on click-outside
function ValidationPopover({
  isValid,
  message,
  isMobile,
}: {
  isValid: boolean;
  message: string | undefined;
  isMobile: boolean;
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
    <Check className={cn(isMobile ? "w-5 h-5" : "w-6 h-6", "text-green-500")} />
  ) : (
    <AlertCircle
      className={cn(isMobile ? "w-5 h-5" : "w-6 h-6", "text-amber-500")}
    />
  );

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
        className="w-auto max-w-64 px-3 py-2"
        side="top"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="whitespace-pre-line text-sm">
          {isValid ? message : message}
        </span>
      </PopoverContent>
    </Popover>
  );
}

function BuildCardComponent({
  buildId,
  onDelete,
  onDuplicate,
  element,
}: BuildCardProps) {
  const { t } = useLanguage();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const build = useBuildsStore((state) => state.builds[buildId]);
  const setBuild = useBuildsStore((state) => state.setBuild);

  // Only keep local state for the name field (for typing smoothness)
  const [localName, setLocalName] = useState("");
  const nameUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Sync local name when build name changes from store
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
        setBuild(buildId, { name: newName });
      }, 300);
    },
    [buildId, setBuild]
  );

  const handleNameBlur = useCallback(() => {
    if (nameUpdateTimeoutRef.current) {
      clearTimeout(nameUpdateTimeoutRef.current);
    }
    setBuild(buildId, { name: localName });
  }, [buildId, localName, setBuild]);

  const handleBuildChange = useCallback(
    (changes: Partial<Build>) => {
      setBuild(buildId, changes);
    },
    [buildId, setBuild]
  );

  const handleToggleVisibility = useCallback(() => {
    if (build) {
      setBuild(buildId, { visible: !build.visible });
    }
  }, [build, buildId, setBuild]);

  const handleConstellationChange = useCallback(
    (value: string) => {
      const cons = Number(value) as BuildConstellation;
      // Store undefined for C0 (default)
      setBuild(buildId, { minCons: cons === 0 ? undefined : cons });
    },
    [buildId, setBuild]
  );

  const validation = useMemo(() => {
    if (!build) return { isValid: false };

    const warnings: string[] = [];

    if (!build.styles || build.styles.length === 0) {
      warnings.push(t.ui("buildCard.missingStyle"));
    }

    if (!build.roles || build.roles.length === 0) {
      warnings.push(t.ui("buildCard.missingRole"));
    }

    // Check artifact set configuration
    if (build.composition === "4pc") {
      if (!build.artifactSet) {
        warnings.push(t.ui("buildCard.missing4pcSet"));
      }
    } else {
      // 2pc+2pc
      if (!build.halfSet1 || !build.halfSet2) {
        warnings.push(t.ui("buildCard.missing2pcSets"));
      } else {
        // Check if halfSet1 and halfSet2 are the same
        if (build.halfSet1 === build.halfSet2) {
          const halfSet = build.halfSet1
            ? artifactHalfSetsById[build.halfSet1]
            : undefined;
          if (!halfSet || halfSet.setIds.length <= 1) {
            warnings.push(t.ui("buildCard.notEnoughSame2pcSets"));
          }
        }
      }
    }

    // Check main stats
    if (build.sands.length === 0) {
      warnings.push(t.ui("buildCard.missingSandsMainStat"));
    }
    if (build.goblet.length === 0) {
      warnings.push(t.ui("buildCard.missingGobletMainStat"));
    }
    if (build.circlet.length === 0) {
      warnings.push(t.ui("buildCard.missingCircletMainStat"));
    }

    // Check substats
    if (build.substats.length === 0) {
      warnings.push(t.ui("buildCard.missingSubstat"));
    }

    return {
      isValid: warnings.length === 0,
      warningMessage: warnings.length > 0 ? warnings.join("\n") : undefined,
    };
  }, [build, t]);

  const localStatPools = useMemo(
    () => ({
      sands: statPools.sands,
      goblet: getGobletPool(element),
      circlet: statPools.circlet,
    }),
    [element]
  );

  const mainStatLabel = (slot: MainStatSlot) => {
    switch (slot) {
      case "sands":
        return t.ui("buildCard.sandsMainStat");
      case "goblet":
        return t.ui("buildCard.gobletMainStat");
      case "circlet":
        return t.ui("buildCard.circletMainStat");
    }
  };

  const styleOptions = useMemo(
    () =>
      buildStyles.map((s) => ({
        value: s,
        label: t.ui(`buildCard.styles.${s}`),
        color: STYLE_COLORS[s],
      })),
    [t]
  );
  const roleOptions = useMemo(
    () =>
      buildRoles.map((r) => ({
        value: r,
        label: t.ui(`buildCard.roles.${r}`),
        color: ROLE_COLORS[r],
      })),
    [t]
  );

  // If build is not found, don't render
  if (!build) {
    return null;
  }

  // Derive picker value from build state
  const pickerValue: ArtifactConfig | null =
    build.composition === "4pc"
      ? build.artifactSet
        ? { type: "4pc", setId: build.artifactSet }
        : null
      : build.halfSet1 && build.halfSet2
        ? { type: "2pc+2pc", id1: build.halfSet1, id2: build.halfSet2 }
        : null;

  const handlePickerChange = (val: ArtifactConfig) => {
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
        halfSet1: val.id1,
        halfSet2: val.id2,
        artifactSet: undefined,
      });
    }
  };

  const currentStyles = build.styles ?? [];
  const currentRoles = build.roles ?? [];
  const currentCons = build.minCons ?? 0;

  const constellationKeyMap: Record<BuildConstellation, string> = {
    0: "buildCard.constellation.c0",
    1: "buildCard.constellation.c1",
    2: "buildCard.constellation.c2",
    4: "buildCard.constellation.c4",
    6: "buildCard.constellation.c6",
  };

  const minCountInput = (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span
        className={cn(
          "text-muted-foreground select-none",
          isMobile ? "text-[10px]" : "text-xs"
        )}
      >
        {t.ui("buildCard.atLeast")}
      </span>
      <Input
        type="number"
        min="1"
        max={Math.min(build.substats.length, 4)}
        value={build.kOverride || ""}
        onChange={(e) =>
          handleBuildChange({
            kOverride: e.target.value
              ? Number.parseInt(e.target.value)
              : undefined,
          })
        }
        className={cn(
          "border border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          isMobile ? "w-8 h-5 text-[10px]" : "w-10 h-6 text-xs"
        )}
        placeholder={Math.min(build.substats.length, 4).toString()}
      />
      <span
        className={cn(
          "text-muted-foreground select-none",
          isMobile ? "text-[10px]" : "text-xs"
        )}
      >
        {t.ui("buildCard.affixes")}
      </span>
    </div>
  );

  const multiSelectTriggerClass = cn(
    "border-border/40 bg-foreground/5 rounded-full h-auto w-auto",
    // Mobile (default)
    "min-w-10 pl-2 pr-1 py-1 text-xs [&>svg]:h-3 [&>svg]:w-3",
    // Tablet+
    "md:min-w-12 md:pl-3 md:pr-1.5 md:text-sm md:[&>svg]:h-3.5 md:[&>svg]:w-3.5",
    // Desktop+
    "lg:pl-4 lg:pr-2"
  );

  const multiSelectItemClass = "text-xs md:text-sm";

  // Labels row: style multi-select + role multi-select + constellation select
  const labelsRow = (
    <div className="flex items-center flex-wrap gap-1 md:gap-3 lg:gap-4">
      {/* Style multi-select */}
      <LightweightMultiSelect
        className="ml-1 md:ml-3 lg:ml-4"
        options={styleOptions}
        value={currentStyles}
        onValueChange={(value) =>
          handleBuildChange({ styles: value as BuildStyle[] })
        }
        placeholder={t.ui("buildCard.styles.label")}
        triggerClassName={multiSelectTriggerClass}
        itemClassName={multiSelectItemClass}
      />

      {/* Role multi-select */}
      <LightweightMultiSelect
        options={roleOptions}
        value={currentRoles}
        onValueChange={(value) =>
          handleBuildChange({ roles: value as BuildRole[] })
        }
        placeholder={t.ui("buildCard.roles.label")}
        triggerClassName={multiSelectTriggerClass}
        itemClassName={multiSelectItemClass}
      />

      {/* Constellation select */}
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
                {t.ui(constellationKeyMap[cons])}
              </span>
            </LightweightSelectItem>
          ))}
        </LightweightSelectContent>
      </LightweightSelect>
    </div>
  );

  return (
    <div className="border border-border/50 rounded-lg bg-muted/30">
      {/* Build Header */}
      <div className={cn("px-2 md:px-3 pt-2", isMobile ? "space-y-1.5" : "")}>
        {/* Row 1: Switch + Labels + Name (desktop) / Switch + Labels + Buttons (mobile) */}
        <div className="flex items-center gap-2">
          <Switch
            checked={build.visible}
            onCheckedChange={handleToggleVisibility}
            className="data-[state=checked]:bg-primary flex-shrink-0"
          />

          {labelsRow}

          {/* Desktop: name input inline */}
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
              isMobile={isMobile}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={onDuplicate}
              className={cn("p-1", isMobile ? "h-7 w-7" : "h-8 w-8")}
            >
              <Copy />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className={cn(
                "p-1 text-destructive hover:text-destructive",
                isMobile ? "h-7 w-7" : "h-8 w-8"
              )}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        {/* Row 2 (mobile only): Name input */}
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

      {/* Build Details */}
      <div className={cn(isMobile ? "px-2 py-1.5" : "px-3 py-2")}>
        <div className="pt-1 border-t border-border/30">
          <div
            className={cn(
              "flex items-center justify-center",
              isMobile ? "gap-2" : "gap-3"
            )}
          >
            {/* Artifact Set Selection - Left Side */}
            <div className={cn("flex-shrink-0", !isMobile && "pl-2")}>
              <div className="h-full flex items-center justify-center">
                <ItemPicker
                  type="artifact"
                  value={pickerValue}
                  onChange={handlePickerChange}
                  triggerSize={isMobile ? "md" : "xl"}
                  showItemName={true}
                  className="w-20"
                />
              </div>
            </div>

            {/* Stats Section - Right Side */}
            <div
              className={cn(
                "flex-1 min-w-0",
                isMobile ? "space-y-0.5" : "space-y-1"
              )}
            >
              {/* Main Stats Row - 3 Units */}
              <div
                className={cn("grid grid-cols-3", isMobile ? "gap-1" : "gap-2")}
              >
                {mainStatSlots.map((slot) => (
                  <div
                    key={slot}
                    className={cn(isMobile ? "space-y-0.5" : "space-y-1")}
                  >
                    <Label
                      className={cn(
                        "font-medium text-muted-foreground select-none",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      {mainStatLabel(slot)}
                    </Label>
                    <StatSelect
                      values={build[slot]}
                      onValuesChange={(values) =>
                        handleBuildChange({ [slot]: values as MainStat[] })
                      }
                      options={localStatPools[slot]}
                      maxLength={3}
                      compact={isMobile}
                    />
                  </div>
                ))}
              </div>

              {/* Substats Row - Bottom Unit */}
              <div className={cn(isMobile ? "space-y-0.5" : "space-y-1")}>
                <div
                  className={cn(
                    "flex items-center",
                    isMobile ? "gap-2" : "gap-4 lg:gap-12 2xl:gap-20"
                  )}
                >
                  <Label
                    className={cn(
                      "font-medium text-muted-foreground select-none whitespace-nowrap",
                      isMobile ? "text-[10px]" : "text-xs"
                    )}
                  >
                    {t.ui("buildCard.substats")}
                  </Label>
                  {minCountInput}
                </div>
                <StatSelect
                  values={build.substats}
                  onValuesChange={(values) =>
                    handleBuildChange({ substats: values as SubStat[] })
                  }
                  options={statPools.substat}
                  maxLength={5}
                  compact={isMobile}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const BuildCard = memo(BuildCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.buildId === nextProps.buildId &&
    prevProps.element === nextProps.element
    // onDelete and onDuplicate are not compared since they should be stable from parent
  );
});
