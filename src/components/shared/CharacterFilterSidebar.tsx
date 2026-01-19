import { SortToggleGroup } from "@/components/shared/SortToggleGroup";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  elementResourcesByName,
  weaponResourcesByName,
} from "@/data/constants";
import {
  type CharacterFilters,
  type Element,
  type Rarity,
  type SortDirection,
  type WeaponType,
  elements,
  regions,
  weaponTypes,
} from "@/data/types";
import { getAssetUrl } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface CharacterFilterSidebarProps {
  filters: CharacterFilters;
  onFiltersChange: (filters: CharacterFilters) => void;
  isInSidePanel?: boolean;
  hasTierData?: boolean;
}

export function CharacterFilterSidebar({
  filters,
  onFiltersChange,
  isInSidePanel = true,
  hasTierData = true,
}: CharacterFilterSidebarProps) {
  const { t } = useLanguage();

  // Helper functions to get image paths
  const getElementImagePath = (element: Element) => {
    return getAssetUrl(elementResourcesByName[element]?.imagePath) || "";
  };

  const getWeaponImagePath = (weapon: WeaponType) => {
    return getAssetUrl(weaponResourcesByName[weapon]?.imagePath) || "";
  };

  const handleFilterChange = <T extends string | number>(
    filterType: keyof CharacterFilters,
    value: T,
    checked: boolean
  ) => {
    const currentValues = filters[filterType] as T[];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter((v) => v !== value);

    onFiltersChange({
      ...filters,
      [filterType]: newValues,
    });
  };

  const hasAnyActiveFilters =
    filters.elements.length > 0 ||
    filters.weaponTypes.length > 0 ||
    filters.regions.length > 0 ||
    filters.rarities.length > 0;

  const handleClearAll = () => {
    onFiltersChange({
      ...filters,
      elements: [],
      weaponTypes: [],
      regions: [],
      rarities: [],
    });
  };

  const content = (
    <div className="space-y-6">
      {/* Sort Section (Level 1) */}
      <div className="flex flex-col space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t.ui("filters.sort")}
        </h2>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center">
          {/* Tier sort row - with optional disabled tooltip */}
          {hasTierData ? (
            <Label className="text-foreground text-sm font-medium">
              {t.ui("filters.sortByTier")}
            </Label>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Label className="text-muted-foreground text-sm font-medium flex items-center gap-1 cursor-help">
                  {t.ui("filters.sortByTier")}
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                </Label>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t.ui("filters.tierSortDisabled")}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <SortToggleGroup
            value={filters.tierSort}
            onChange={(v: SortDirection) =>
              onFiltersChange({ ...filters, tierSort: v })
            }
            disabled={!hasTierData}
          />
          <Label className="text-foreground text-sm font-medium">
            {t.ui("filters.sortByReleaseDate")}
          </Label>
          <SortToggleGroup
            value={filters.releaseSort}
            onChange={(v: SortDirection) =>
              onFiltersChange({ ...filters, releaseSort: v })
            }
          />
        </div>
      </div>

      {/* Filter Section (Level 1) - wrapper for header + subsections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t.ui("filters.title")}
          </h2>
          {hasAnyActiveFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearAll}
              className="text-xs rounded-full h-6 px-3 hover:bg-destructive/20 hover:text-destructive"
            >
              {t.ui("filters.clearAll")}
            </Button>
          )}
        </div>

        {/* Elements (Level 2 under Filter) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-base font-medium">
              {t.ui("filters.elements")}
            </Label>
            {filters.elements.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFiltersChange({ ...filters, elements: [] })}
                className="text-xs rounded-full h-5 px-2.5"
              >
                {t.ui("filters.clear")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {elements.map((element) => (
              <div key={element} className="flex items-center space-x-2">
                <Checkbox
                  id={`element-${element}`}
                  checked={filters.elements.includes(element)}
                  onCheckedChange={(checked) =>
                    handleFilterChange("elements", element, checked as boolean)
                  }
                  className="h-4 w-4"
                />
                <Label
                  htmlFor={`element-${element}`}
                  className="text-base text-foreground cursor-pointer flex items-center gap-1 flex-1"
                >
                  <img
                    src={getElementImagePath(element)}
                    alt={element}
                    className="w-5 h-5 flex-shrink-0"
                  />
                  <span className="truncate">{t.element(element)}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Rarity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-base font-medium">
              {t.ui("filters.rarity")}
            </Label>
            {filters.rarities.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFiltersChange({ ...filters, rarities: [] })}
                className="text-xs rounded-full h-5 px-2.5"
              >
                {t.ui("filters.clear")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[4, 5].map((rarity) => (
              <div key={rarity} className="flex items-center space-x-2">
                <Checkbox
                  id={`rarity-${rarity}`}
                  checked={filters.rarities.includes(rarity as Rarity)}
                  onCheckedChange={(checked) =>
                    handleFilterChange(
                      "rarities",
                      rarity as Rarity,
                      checked as boolean
                    )
                  }
                  className="h-4 w-4"
                />
                <Label
                  htmlFor={`rarity-${rarity}`}
                  className="text-base text-foreground cursor-pointer flex-1"
                >
                  ★ {rarity}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Weapon Types */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-base font-medium">
              {t.ui("filters.weaponTypes")}
            </Label>
            {filters.weaponTypes.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFiltersChange({ ...filters, weaponTypes: [] })}
                className="text-xs rounded-full h-5 px-2.5"
              >
                {t.ui("filters.clear")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {weaponTypes.map((weapon) => (
              <div key={weapon} className="flex items-center space-x-2">
                <Checkbox
                  id={`weapon-${weapon}`}
                  checked={filters.weaponTypes.includes(weapon)}
                  onCheckedChange={(checked) =>
                    handleFilterChange(
                      "weaponTypes",
                      weapon,
                      checked as boolean
                    )
                  }
                  className="h-4 w-4"
                />
                <Label
                  htmlFor={`weapon-${weapon}`}
                  className="text-base text-foreground cursor-pointer flex items-center gap-1 flex-1"
                >
                  <img
                    src={getWeaponImagePath(weapon)}
                    alt={weapon}
                    className="w-5 h-5 flex-shrink-0"
                  />
                  <span className="truncate">{t.weaponType(weapon)}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Regions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-base font-medium">
              {t.ui("filters.regions")}
            </Label>
            {filters.regions.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFiltersChange({ ...filters, regions: [] })}
                className="text-xs rounded-full h-5 px-2.5"
              >
                {t.ui("filters.clear")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {regions.map((region) => (
              <div key={region} className="flex items-center space-x-2">
                <Checkbox
                  id={`region-${region}`}
                  checked={filters.regions.includes(region)}
                  onCheckedChange={(checked) =>
                    handleFilterChange("regions", region, checked as boolean)
                  }
                  className="h-4 w-4"
                />
                <Label
                  htmlFor={`region-${region}`}
                  className="text-base text-foreground cursor-pointer flex-1 truncate capitalize"
                >
                  {t.region(region)}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (isInSidePanel) {
    return (
      <Card className="bg-card/50 border-border/50 h-full flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto py-6 pl-6 pr-4">
          {content}
        </CardContent>
      </Card>
    );
  }

  return <div className="w-full h-full overflow-y-auto p-6">{content}</div>;
}
