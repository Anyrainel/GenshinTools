import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
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
import { ArtifactSelect, ArtifactSelectHalf } from "./ArtifactSelect";
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

  const minCountInput = (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className="text-xs text-muted-foreground select-none">
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
        className="w-10 h-6 text-xs border border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        placeholder={Math.min(build.substats.length, 4).toString()}
      />
      <span className="text-xs text-muted-foreground select-none">
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
            className="h-8 rounded-full text-base bg-transparent border-none px-3 mx-1 md:mx-6 py-0 text-foreground flex-1"
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-shrink-0">
              {validation.isValid ? (
                <Check className="w-6 h-6 text-green-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-500" />
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

        <LightweightSelect
          value={build.composition}
          onValueChange={(value) => {
            const composition = value as "4pc" | "2pc+2pc";
            // Clear opposite composition fields when switching
            if (composition === "4pc") {
              handleBuildChange({
                composition,
                halfSet1: undefined,
                halfSet2: undefined,
              });
            } else {
              handleBuildChange({ composition, artifactSet: undefined });
            }
          }}
        >
          <LightweightSelectTrigger className="w-24 md:w-28 h-7 text-sm bg-gradient-select">
            <LightweightSelectValue />
          </LightweightSelectTrigger>
          <LightweightSelectContent>
            <LightweightSelectItem value="4pc">
              {t.ui("buildCard.4pc")}
            </LightweightSelectItem>
            <LightweightSelectItem value="2pc+2pc">
              {t.ui("buildCard.2pc+2pc")}
            </LightweightSelectItem>
          </LightweightSelectContent>
        </LightweightSelect>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDuplicate}
          className="p-1 h-8 w-8"
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="p-1 h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>

      {/* Build Details */}
      <div className="px-3 py-2">
        <div className="pt-1 border-t border-border/30">
          <div
            className={cn(
              "flex gap-3",
              isMobile
                ? "flex-col items-center"
                : "flex-row items-center justify-center"
            )}
          >
            {/* Artifact Set Selection - Left Side */}
            <div className={cn("flex-shrink-0", isMobile ? "w-full" : "w-28")}>
              {build.composition === "4pc" ? (
                <div className="w-full h-full flex items-center justify-center">
                  <ArtifactSelect
                    value={build.artifactSet || ""}
                    onValueChange={(value) =>
                      handleBuildChange({ artifactSet: value })
                    }
                    placeholder={t.ui("buildCard.selectSet")}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <ArtifactSelectHalf
                    value={build.halfSet1}
                    onValueChange={(value) =>
                      handleBuildChange({ halfSet1: value })
                    }
                    placeholder={t.ui("buildCard.effect1")}
                  />

                  <div className="flex justify-center">
                    <span className="text-lg text-muted-foreground select-none">
                      +
                    </span>
                  </div>

                  <ArtifactSelectHalf
                    value={build.halfSet2}
                    onValueChange={(value) =>
                      handleBuildChange({ halfSet2: value })
                    }
                    placeholder={t.ui("buildCard.effect2")}
                  />
                </div>
              )}
            </div>

            {/* Vertical Divider (Hidden on Mobile) */}
            <div
              className={cn(
                "w-px h-full bg-border/70 min-h-32",
                isMobile ? "hidden" : "block"
              )}
            />

            {/* Stats Section - Right Side */}
            <div className={cn("space-y-1", isMobile ? "w-full" : "flex-1")}>
              {/* Main Stats Row - 3 Units */}
              <div className="grid grid-cols-3 gap-2">
                {mainStatSlots.map((slot) => (
                  <div key={slot} className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground select-none">
                      {mainStatLabel(slot)}
                    </Label>
                    <StatSelect
                      values={build[slot]}
                      onValuesChange={(values) =>
                        handleBuildChange({ [slot]: values as MainStat[] })
                      }
                      options={localStatPools[slot]}
                      maxLength={3}
                    />
                  </div>
                ))}
              </div>

              {/* Substats Row - Bottom Unit */}
              <div className="space-y-1">
                <div className="flex items-center gap-4 lg:gap-12 2xl:gap-20">
                  <Label className="text-xs font-medium text-muted-foreground select-none whitespace-nowrap">
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
