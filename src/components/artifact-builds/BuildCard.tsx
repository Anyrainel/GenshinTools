import { Button } from "@/components/ui/button";

import {
  type ArtifactConfig,
  ItemPicker,
} from "@/components/shared/ItemPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  getGobletPool,
  statPools,
} from "@/data/constants";
import {
  type Build,
  type Element,
  type MainStat,
  type MainStatSlot,
  type SubStat,
  mainStatSlots,
} from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { AlertCircle, Check, Copy, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatSelect } from "./StatSelect";

interface BuildCardProps {
  buildId: string;
  buildIndex: number;
  onDelete: () => void;
  onDuplicate: () => void;
  element: Element;
}

function BuildCardComponent({
  buildId,
  buildIndex,
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

  const validation = useMemo(() => {
    if (!build) return { isValid: false };

    const warnings: string[] = [];

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

  return (
    <div className="border border-border/50 rounded-lg bg-muted/30">
      {/* Build Header - More Compact */}
      <div className="flex items-center gap-2 px-2 md:px-3 pt-2">
        <Switch
          checked={build.visible}
          onCheckedChange={handleToggleVisibility}
          className="data-[state=checked]:bg-primary"
        />

        <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3 md:px-4">
          <span className="text-xs text-muted-foreground italic flex-shrink-0 select-none hidden md:block">
            {t.ui("buildCard.buildLabel")} {buildIndex}
          </span>
          <Input
            value={localName}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={handleNameBlur}
            placeholder={
              isMobile ? `${t.ui("buildCard.buildLabel")} ${buildIndex}` : ""
            }
            className={cn(
              "rounded-full bg-transparent border-none py-0 text-foreground flex-1",
              isMobile ? "h-7 text-sm px-2 mx-1" : "h-8 text-base px-3 mx-6"
            )}
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-shrink-0">
              {validation.isValid ? (
                <Check
                  className={cn(
                    isMobile ? "w-5 h-5" : "w-6 h-6",
                    "text-green-500"
                  )}
                />
              ) : (
                <AlertCircle
                  className={cn(
                    isMobile ? "w-5 h-5" : "w-6 h-6",
                    "text-amber-500"
                  )}
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <span className="whitespace-pre-line">
              {validation.isValid
                ? t.ui("buildCard.buildComplete")
                : validation.warningMessage}
            </span>
          </TooltipContent>
        </Tooltip>

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
    prevProps.buildIndex === nextProps.buildIndex &&
    prevProps.element === nextProps.element
    // onDelete and onDuplicate are not compared since they should be stable from parent
  );
});
