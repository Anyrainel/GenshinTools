import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { ComputeOptions } from "@/data/types";

interface ComputeSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  computeOptions: ComputeOptions;
  onComputeOptionChange: <K extends keyof ComputeOptions>(
    key: K,
    value: ComputeOptions[K],
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
        <Label className="text-foreground text-sm font-medium">
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
        <Label className="text-foreground text-sm font-medium">
          {t.ui("computeFilters.computeOptions")}
        </Label>

        {/* Skip CR+CD builds */}
        <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
          <Checkbox
            id={`${isInSidePanel ? "mobile-" : ""}skip-crit`}
            checked={computeOptions.skipCritBuilds}
            onCheckedChange={(checked) =>
              onComputeOptionChange("skipCritBuilds", checked as boolean)
            }
            className="h-4 w-4 mt-0.5"
          />
          <Label
            htmlFor={`${isInSidePanel ? "mobile-" : ""}skip-crit`}
            className="text-foreground text-sm flex-1 leading-tight cursor-pointer"
          >
            {t.ui("computeFilters.skipCritBuilds")}
          </Label>
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
            className="text-foreground text-sm flex-1 leading-tight cursor-pointer"
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
            className="text-foreground text-sm flex-1 leading-tight cursor-pointer"
          >
            {t.ui("computeFilters.expandCritCirclet")}
          </Label>
        </div>

        {/* Merge single-flex variants */}
        <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
          <Checkbox
            id={`${isInSidePanel ? "mobile-" : ""}pick-one-merge`}
            checked={!!computeOptions.mergeSingleFlexVariants}
            onCheckedChange={(checked) =>
              onComputeOptionChange("mergeSingleFlexVariants", !!checked)
            }
            className="h-4 w-4 mt-0.5"
          />
          <Label
            htmlFor={`${isInSidePanel ? "mobile-" : ""}pick-one-merge`}
            className="text-foreground text-sm flex-1 leading-tight cursor-pointer"
          >
            {t.ui("computeFilters.mergeSingleFlexVariants")}
          </Label>
        </div>

        {/* Find rigid common subset */}
        <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
          <Checkbox
            id={`${isInSidePanel ? "mobile-" : ""}rigid-promotion`}
            checked={!!computeOptions.findRigidCommonSubset}
            onCheckedChange={(checked) =>
              onComputeOptionChange("findRigidCommonSubset", !!checked)
            }
            className="h-4 w-4 mt-0.5"
          />
          <Label
            htmlFor={`${isInSidePanel ? "mobile-" : ""}rigid-promotion`}
            className="text-foreground text-sm flex-1 leading-tight cursor-pointer"
          >
            {t.ui("computeFilters.findRigidCommonSubset")}
          </Label>
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
          {t.ui("computeFilters.title")}
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
            <SheetTitle>{t.ui("computeFilters.title")}</SheetTitle>
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
