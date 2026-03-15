import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ComputeOptions } from "@/data/types";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";

interface ComputeSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  computeOptions: ComputeOptions;
  onComputeOptionChange: <K extends keyof ComputeOptions>(
    key: K,
    value: ComputeOptions[K]
  ) => void;
  isInSidePanel?: boolean;
}

export function ComputeSidebar({
  searchQuery,
  onSearchChange,
  computeOptions,
  onComputeOptionChange,
  isInSidePanel = false,
}: ComputeSidebarProps) {
  const { t } = useLanguage();

  const sidebarContent = (
    <CardContent className="flex-1 overflow-y-auto space-y-4 p-6">
      {/* Search */}
      <div className="space-y-2">
        <Label className="text-foreground text-base font-medium">
          {t.ui("computeFilters.searchSets")}
        </Label>
        <Input
          placeholder={t.ui("computeFilters.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-input border-border h-9"
        />
      </div>

      {/* Compute Options */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <Label className="text-foreground text-base font-medium">
          {t.ui("computeFilters.computeOptions")}
        </Label>

        {/* Merge Algorithm */}
        <div className="space-y-2 p-2 rounded-md">
          <Label className="text-foreground text-sm">
            {t.ui("computeFilters.mergeAlgorithm")}
          </Label>
          <div className="space-y-2">
            {(
              [
                {
                  value: "smartMerge" as const,
                  name: t.ui("computeFilters.algorithmSmartMerge"),
                  desc: t.ui("computeFilters.algorithmSmartMergeDesc"),
                },
                {
                  value: "greedyMerge" as const,
                  name: t.ui("computeFilters.algorithmGreedyMerge"),
                  desc: t.ui("computeFilters.algorithmGreedyMergeDesc"),
                },
                {
                  value: "bruteForce" as const,
                  name: t.ui("computeFilters.algorithmBruteForce"),
                  desc: t.ui("computeFilters.algorithmBruteForceDesc"),
                },
              ] as const
            ).map((option) => {
              const isSelected =
                (computeOptions.mergeAlgorithm ?? "bruteForce") ===
                option.value;
              const id = `${isInSidePanel ? "mobile-" : ""}algo-${option.value}`;
              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors",
                    isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 hover:bg-muted/30"
                  )}
                >
                  <input
                    type="radio"
                    id={id}
                    name={`${isInSidePanel ? "mobile-" : ""}merge-algorithm`}
                    value={option.value}
                    checked={isSelected}
                    onChange={() =>
                      onComputeOptionChange("mergeAlgorithm", option.value)
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {option.name}
                    </div>
                    <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                      {option.desc}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Expand Elemental DMG */}
        <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
          <Checkbox
            id={`${isInSidePanel ? "mobile-" : ""}expand-elemental`}
            checked={computeOptions.expandElementalGoblet}
            onCheckedChange={(checked) =>
              onComputeOptionChange("expandElementalGoblet", checked as boolean)
            }
            className="h-4 w-4 mt-0.5"
          />
          <Label
            htmlFor={`${isInSidePanel ? "mobile-" : ""}expand-elemental`}
            className="text-foreground text-base flex-1 leading-tight cursor-pointer"
          >
            {t.ui("computeFilters.expandElementalGoblet")}
          </Label>
        </div>

        {/* Expand Crit Circlet */}
        <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
          <Checkbox
            id={`${isInSidePanel ? "mobile-" : ""}expand-crit`}
            checked={computeOptions.expandCritCirclet}
            onCheckedChange={(checked) =>
              onComputeOptionChange("expandCritCirclet", checked as boolean)
            }
            className="h-4 w-4 mt-0.5"
          />
          <Label
            htmlFor={`${isInSidePanel ? "mobile-" : ""}expand-crit`}
            className="text-foreground text-base flex-1 leading-tight cursor-pointer"
          >
            {t.ui("computeFilters.expandCritCirclet")}
          </Label>
        </div>

        {/* Normalize Flat Stats */}
        <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
          <Checkbox
            id={`${isInSidePanel ? "mobile-" : ""}normalize-flat`}
            checked={computeOptions.normalizeFlatStats}
            onCheckedChange={(checked) =>
              onComputeOptionChange("normalizeFlatStats", checked as boolean)
            }
            className="h-4 w-4 mt-0.5"
          />
          <Label
            htmlFor={`${isInSidePanel ? "mobile-" : ""}normalize-flat`}
            className="text-foreground text-base flex-1 leading-tight cursor-pointer"
          >
            {t.ui("computeFilters.normalizeFlatStats")}
          </Label>
        </div>

        {/* Substat Weight Threshold */}
        <div className="space-y-1.5 p-2 rounded-md">
          <Label
            htmlFor={`${isInSidePanel ? "mobile-" : ""}substat-weight`}
            className="text-foreground text-sm font-medium"
          >
            {t.ui("computeFilters.substatWeightThreshold")}
          </Label>
          <p className="text-xs text-muted-foreground leading-snug">
            {t.ui("computeFilters.substatWeightThresholdDesc")}
          </p>
          <Input
            id={`${isInSidePanel ? "mobile-" : ""}substat-weight`}
            type="number"
            min={0}
            max={100}
            value={computeOptions.substatWeightThreshold ?? 70}
            onChange={(e) =>
              onComputeOptionChange(
                "substatWeightThreshold",
                Number(e.target.value)
              )
            }
            className="bg-input border-border h-9 sm:w-32"
          />
        </div>

        {/* Must-Present Weight Threshold */}
        <div className="space-y-1.5 p-2 rounded-md">
          <Label
            htmlFor={`${isInSidePanel ? "mobile-" : ""}must-present-weight`}
            className="text-foreground text-sm font-medium"
          >
            {t.ui("computeFilters.mustPresentWeightThreshold")}
          </Label>
          <p className="text-xs text-muted-foreground leading-snug">
            {t.ui("computeFilters.mustPresentWeightThresholdDesc")}
          </p>
          <Input
            id={`${isInSidePanel ? "mobile-" : ""}must-present-weight`}
            type="number"
            min={0}
            max={100}
            value={computeOptions.mustPresentWeightThreshold ?? 100}
            onChange={(e) =>
              onComputeOptionChange(
                "mustPresentWeightThreshold",
                Number(e.target.value)
              )
            }
            className="bg-input border-border h-9 sm:w-32"
          />
        </div>
      </div>
    </CardContent>
  );

  return (
    <Card className="bg-card/50 border-border/50 h-full flex flex-col overflow-hidden">
      {sidebarContent}
    </Card>
  );
}

interface ComputeSidebarMobileProps extends ComputeSidebarProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  hasActiveFilters: boolean;
}

export function ComputeSidebarMobile({
  searchQuery,
  onSearchChange,
  isOpen,
  onOpenChange,
  hasActiveFilters,
  computeOptions,
  onComputeOptionChange,
}: ComputeSidebarMobileProps) {
  const { t } = useLanguage();

  return (
    <>
      {/* Mobile Filter Button */}
      <div className="lg:hidden flex items-center justify-between mb-4">
        <Button
          variant="outline"
          onClick={() => onOpenChange(true)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          {t.ui("filters.title")}
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {searchQuery.length > 0 ? "1" : "0"}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile Filter Sheet */}
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>{t.ui("filters.title")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <div className="h-full">
              <ComputeSidebar
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                computeOptions={computeOptions}
                onComputeOptionChange={onComputeOptionChange}
                isInSidePanel={true}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
