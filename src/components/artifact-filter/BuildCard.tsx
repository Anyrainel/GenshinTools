import {
  Build,
  MainStat,
  SubStat,
  mainStatSlots,
  Element,
  MainStatSlot,
} from "@/data/types";
import {
  statPools,
  getGobletPool,
  artifactHalfSetsById,
} from "@/data/constants";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  LightweightSelect,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectContent,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import {
  Check,
  ChevronDown,
  Copy,
  AlertCircle,
  Trash2,
  ChevronUp,
} from "lucide-react";
import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const build = useBuildsStore((state) => state.builds[buildId]);
  const setBuild = useBuildsStore((state) => state.setBuild);

  const [isExpanded, setIsExpanded] = useState(true);
  // Only keep local state for the name field (for typing smoothness)
  const [localName, setLocalName] = useState("");
  const nameUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
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
    [buildId, setBuild],
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
    [buildId, setBuild],
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

  const compositionLabel = useMemo(() => {
    if (!build) return "";

    if (build.composition === "2pc+2pc") {
      return t.ui("buildCard.2pc+2pc");
    }

    if (build.artifactSet) {
      return t.artifact(build.artifactSet);
    }

    return t.ui("buildCard.4pc");
  }, [build, t]);

  const localStatPools = useMemo(
    () => ({
      sands: statPools.sands,
      goblet: getGobletPool(element),
      circlet: statPools.circlet,
    }),
    [element],
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

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border border-border/50 rounded-lg bg-muted/30">
        {/* Build Header - More Compact */}
        <div className="flex items-center gap-2 px-3 pt-2">
          <Switch
            checked={build.visible}
            onCheckedChange={handleToggleVisibility}
            className="data-[state=checked]:bg-primary"
          />

          <div className="flex-1 min-w-0 flex items-center gap-3 px-6">
            <span className="text-sm text-muted-foreground italic flex-shrink-0 select-none">
              {t.ui("buildCard.buildLabel")} {buildIndex}
            </span>
            <Input
              value={localName}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              placeholder=""
              className="h-9 rounded-full text-lg bg-transparent border-none px-3 mx-8 py-0 text-foreground flex-1"
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

          {isExpanded ? (
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
              <LightweightSelectTrigger className="w-32 h-8 text-base bg-gradient-select">
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
          ) : (
            <span
              className="w-32 h-8 text-base flex items-center justify-center rounded-md border border-border/40 px-2 select-none text-muted-foreground"
              title={compositionLabel}
            >
              {compositionLabel}
            </span>
          )}

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

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-1 h-8 w-8">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Build Details */}
        <CollapsibleContent className="px-3 py-2">
          <div className="pt-1 border-t border-border/30">
            <div className="flex gap-3 items-center justify-center">
              {/* Artifact Set Selection - Left Side */}
              <div className="flex-shrink-0 w-36">
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
                  <div className="w-full h-full flex-col items-center justify-center">
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

              {/* Vertical Divider */}
              <div className="w-px h-full bg-border/70 min-h-32"></div>

              {/* Stats Section - Right Side */}
              <div className="flex-1 space-y-1">
                {/* Main Stats Row - 3 Units */}
                <div className="grid grid-cols-3 gap-2">
                  {mainStatSlots.map((slot) => (
                    <div key={slot} className="space-y-1">
                      <Label className="text-sm font-medium text-muted-foreground select-none">
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
                  <Label className="text-sm font-medium text-muted-foreground select-none">
                    {t.ui("buildCard.substats")}
                  </Label>
                  <div className="flex items-center justify-between">
                    <StatSelect
                      values={build.substats}
                      onValuesChange={(values) =>
                        handleBuildChange({ substats: values as SubStat[] })
                      }
                      options={statPools.substat}
                      maxLength={5}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground select-none">
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
                              ? parseInt(e.target.value)
                              : undefined,
                          })
                        }
                        className="w-12 h-7 text-sm border-2 border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder={Math.min(
                          build.substats.length,
                          4,
                        ).toString()}
                      />
                      <span className="text-sm text-muted-foreground select-none">
                        {t.ui("buildCard.affixes")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
