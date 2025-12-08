import { Element, Weapon, Region, Rarity, elements, weapons, regions } from '@/data/types';
import { getAssetUrl } from "@/lib/utils";
import { elementResourcesByName, weaponResourcesByName } from '@/data/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface ConfigureSidebarProps {
  filters: {
    elements: Element[];
    weaponTypes: Weapon[];
    regions: Region[];
    rarities: Rarity[];
    sortOrder: 'asc' | 'desc';
  };
  onFiltersChange: (filters: ConfigureSidebarProps['filters']) => void;
  isInSidePanel?: boolean;
}

export function ConfigureSidebar({
  filters,
  onFiltersChange,
  isInSidePanel = true,
}: ConfigureSidebarProps) {
  const { t } = useLanguage();

  // Helper functions to get image paths
  const getElementImagePath = (element: Element) => {
    return getAssetUrl(elementResourcesByName[element]?.imagePath) || '';
  };

  const getWeaponImagePath = (weapon: Weapon) => {
    return getAssetUrl(weaponResourcesByName[weapon]?.imagePath) || '';
  };
  const handleFilterChange = <T extends string | number>(
    filterType: keyof typeof filters,
    value: T,
    checked: boolean
  ) => {
    const currentValues = filters[filterType] as T[];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);

    onFiltersChange({
      ...filters,
      [filterType]: newValues
    });
  };

  const content = (
    <div className="space-y-6">
      {/* Sort Order */}
      <div className="flex flex-col space-y-3">
        <Label className="text-foreground text-sm font-medium">
          {t.ui('filters.sort')}
        </Label>
        <Button
          variant="outline"
          onClick={() => onFiltersChange({
            ...filters,
            sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc'
          })}
          className="justify-center gap-2 h-9 w-36 mx-auto"
        >
          {filters.sortOrder === 'asc' ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
          {t.ui('filters.sortByReleaseDate')}
        </Button>
      </div>

      {/* Elements */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-foreground text-sm font-medium">
            {t.ui('filters.elements')}
          </Label>
          {filters.elements.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange({ ...filters, elements: [] })}
              className="text-xs text-muted-foreground hover:text-foreground h-5 px-2"
            >
              {t.ui('filters.clear')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {elements.map(element => (
            <div key={element} className="flex items-center space-x-2">
              <Checkbox
                id={`element-${element}`}
                checked={filters.elements.includes(element)}
                onCheckedChange={(checked) =>
                  handleFilterChange('elements', element, checked as boolean)
                }
                className="h-4 w-4"
              />
              <Label
                htmlFor={`element-${element}`}
                className="text-sm text-foreground cursor-pointer flex items-center gap-1 flex-1"
              >
                <img
                  src={getElementImagePath(element)}
                  alt={element}
                  className="w-4 h-4 flex-shrink-0"
                />
                <span className="truncate">{t.element(element)}</span>
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Rarity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-foreground text-sm font-medium">
            {t.ui('filters.rarity')}
          </Label>
          {filters.rarities.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange({ ...filters, rarities: [] })}
              className="text-xs text-muted-foreground hover:text-foreground h-5 px-2 transition-colors"
            >
              {t.ui('filters.clear')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[4, 5].map(rarity => (
            <div key={rarity} className="flex items-center space-x-2">
              <Checkbox
                id={`rarity-${rarity}`}
                checked={filters.rarities.includes(rarity as Rarity)}
                onCheckedChange={(checked) =>
                  handleFilterChange('rarities', rarity as Rarity, checked as boolean)
                }
                className="h-4 w-4"
              />
              <Label
                htmlFor={`rarity-${rarity}`}
                className="text-sm text-foreground cursor-pointer flex-1"
              >
                ★ {rarity}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Weapon Types */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-foreground text-sm font-medium">
            {t.ui('filters.weaponTypes')}
          </Label>
          {filters.weaponTypes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange({ ...filters, weaponTypes: [] })}
              className="text-xs text-muted-foreground hover:text-foreground h-5 px-2 transition-colors"
            >
              {t.ui('filters.clear')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {weapons.map(weapon => (
            <div key={weapon} className="flex items-center space-x-2">
              <Checkbox
                id={`weapon-${weapon}`}
                checked={filters.weaponTypes.includes(weapon)}
                onCheckedChange={(checked) =>
                  handleFilterChange('weaponTypes', weapon, checked as boolean)
                }
                className="h-4 w-4"
              />
              <Label
                htmlFor={`weapon-${weapon}`}
                className="text-sm text-foreground cursor-pointer flex items-center gap-1 flex-1"
              >
                <img
                  src={getWeaponImagePath(weapon)}
                  alt={weapon}
                  className="w-4 h-4 flex-shrink-0"
                />
                <span className="truncate">{t.weapon(weapon)}</span>
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Regions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-foreground text-sm font-medium">
            {t.ui('filters.regions')}
          </Label>
          {filters.regions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange({ ...filters, regions: [] })}
              className="text-xs text-muted-foreground hover:text-foreground h-5 px-2 transition-colors"
            >
              {t.ui('filters.clear')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {regions.map(region => (
            <div key={region} className="flex items-center space-x-2">
              <Checkbox
                id={`region-${region}`}
                checked={filters.regions.includes(region)}
                onCheckedChange={(checked) =>
                  handleFilterChange('regions', region, checked as boolean)
                }
                className="h-4 w-4"
              />
              <Label
                htmlFor={`region-${region}`}
                className="text-sm text-foreground cursor-pointer flex-1 truncate capitalize"
              >
                {t.region(region)}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isInSidePanel) {
    return (
      <Card className="bg-card/50 border-border/50 h-full flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-6">
          {content}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      {content}
    </div>
  );
}

