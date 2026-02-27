import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import {
  WeightedSelect,
  WeightedSelectContent,
  WeightedSelectItem,
  WeightedSelectTrigger,
  WeightedSelectValue,
} from "@/components/ui/weighted-select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SubStat, WeightedSubStat } from "@/data/types";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

interface WeightedStatSelectProps {
  values: WeightedSubStat[];
  onValuesChange: (values: WeightedSubStat[]) => void;
  options: readonly string[]; // All available stats
  maxLength: number;
  label?: string;
  compact?: boolean;
}

// Helper to sort weights descending
const sortWeights = (items: WeightedSubStat[]) => {
  return [...items].sort((a, b) => b.weight - a.weight);
};

interface WeightedStatItemProps {
  item: WeightedSubStat;
  onUpdate: (newItem: WeightedSubStat | null) => void; // null to remove
  availableOptions: string[];
}

function WeightedStatItem({
  item,
  onUpdate,
  availableOptions,
}: WeightedStatItemProps) {
  const { t } = useLanguage();

  const handleStatChange = (newStat: string) => {
    if (newStat === "__DESELECT__") {
      onUpdate(null);
    } else {
      onUpdate({ ...item, stat: newStat as SubStat });
    }
  };

  const handleWeightChange = (newWeight: number) => {
    onUpdate({ ...item, weight: newWeight });
  };

  return (
    <WeightedSelect value={item.stat} onValueChange={handleStatChange}>
      <WeightedSelectTrigger
        className="min-w-[3.5rem]"
        weight={item.weight}
        onWeightChange={handleWeightChange}
        weightLabel={t.ui("scoreExplanation.weight.title")}
      >
        <WeightedSelectValue>{t.statShort(item.stat)}</WeightedSelectValue>
      </WeightedSelectTrigger>
      <WeightedSelectContent>
        <WeightedSelectItem
          value="__DESELECT__"
          className="text-muted-foreground text-xs"
        >
          {t.ui("buildCard.deselect")}
        </WeightedSelectItem>
        {availableOptions.map((option) => (
          <WeightedSelectItem key={option} value={option} className="text-sm">
            {t.stat(option)}
          </WeightedSelectItem>
        ))}
      </WeightedSelectContent>
    </WeightedSelect>
  );
}

function WeightedStatSelectComponent({
  values,
  onValuesChange,
  options,
  maxLength,
  label,
  compact = false,
}: WeightedStatSelectProps) {
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);

  // Filter out flat stats from options
  const flatStats = ["hp", "atk", "def"];
  const validOptions = useMemo(
    () => options.filter((opt) => !flatStats.includes(opt)),
    [options]
  );

  const handleAddItem = useCallback(
    (stat: string) => {
      if (stat === "__DESELECT__") {
        setIsAdding(false);
        return;
      }

      // Default weight logic: use last item's weight, or 100
      const lastWeight =
        values.length > 0 ? values[values.length - 1].weight : 100;

      const newItem: WeightedSubStat = {
        stat: stat as SubStat,
        weight: lastWeight,
      };

      // Append then sort
      const newValues = [...values, newItem];
      onValuesChange(sortWeights(newValues));
      setIsAdding(false);
    },
    [values, onValuesChange]
  );

  // Available options for a specific item (exclude other selected stats)
  const getAvailableOptions = useCallback(
    (currentStat?: string) => {
      const selectedStats = values.map((v) => v.stat);
      return validOptions.filter(
        (opt) => opt === currentStat || !selectedStats.includes(opt as SubStat)
      );
    },
    [values, validOptions]
  );

  const handleUpdateItem = useCallback(
    (index: number, newItem: WeightedSubStat | null) => {
      if (newItem === null) {
        // Remove
        const newValues = values.filter((_, i) => i !== index);
        onValuesChange(newValues);
      } else {
        // Update
        const newValues = [...values];
        newValues[index] = newItem;
        // Re-sort descending by weight
        onValuesChange(sortWeights(newValues));
      }
    },
    [values, onValuesChange]
  );

  const canAddMore =
    values.length < maxLength && getAvailableOptions().length > 0;

  return (
    <div className={cn(label && (compact ? "space-y-0.5" : "space-y-1"))}>
      {label && (
        <div className="flex items-center gap-1">
          <Label
            className={cn(
              "font-medium text-muted-foreground select-none whitespace-nowrap",
              compact ? "text-[10px]" : "text-xs"
            )}
          >
            {label}
          </Label>
          {canAddMore && !isAdding && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(true)}
              className={cn(
                "p-0 text-primary/70 hover:text-primary bg-primary/5 hover:bg-primary/10 transition-transform hover:scale-[1.2]",
                compact ? "h-4 w-4" : "h-5 w-5"
              )}
            >
              <Plus className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            </Button>
          )}
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap min-h-8">
        {values.map((item, index) => (
          <WeightedStatItem
            key={`${item.stat}-${index}`}
            item={item}
            onUpdate={(newItem) => handleUpdateItem(index, newItem)}
            availableOptions={getAvailableOptions(item.stat)}
          />
        ))}

        {isAdding && (
          <div className="h-8 rounded-md bg-muted/40 border border-border/50 flex items-center px-0">
            <LightweightSelect
              value=""
              onValueChange={handleAddItem}
              defaultOpen={true}
              onOpenChange={(open) => !open && setIsAdding(false)}
            >
              <LightweightSelectTrigger className="border-none bg-transparent h-full px-2 text-sm focus:ring-0 w-24">
                <LightweightSelectValue placeholder="   " />
              </LightweightSelectTrigger>
              <LightweightSelectContent>
                {getAvailableOptions().map((option) => (
                  <LightweightSelectItem
                    key={option}
                    value={option}
                    className="text-sm"
                  >
                    {t.stat(option)}
                  </LightweightSelectItem>
                ))}
              </LightweightSelectContent>
            </LightweightSelect>
          </div>
        )}

        {!label && !isAdding && canAddMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="h-6 w-6 rounded-full border border-dashed border-border/60 p-0 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/20"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export const WeightedStatSelect = memo(
  WeightedStatSelectComponent,
  (prev, next) => {
    return (
      prev.values.length === next.values.length &&
      prev.values.every(
        (v, i) =>
          v.stat === next.values[i].stat && v.weight === next.values[i].weight
      ) &&
      prev.options === next.options &&
      prev.maxLength === next.maxLength &&
      prev.label === next.label &&
      prev.compact === next.compact
    );
  }
);
