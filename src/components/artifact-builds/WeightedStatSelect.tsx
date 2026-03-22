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
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { memo, useCallback, useState } from "react";

/** Generic weighted stat item — works for both substats and main stats. */
type WeightedItem = { stat: string; weight: number };

interface WeightedStatSelectProps {
  values: WeightedItem[];
  onValuesChange: (values: WeightedItem[]) => void;
  options: readonly string[]; // All available stats
  maxLength: number;
  label?: string;
  compact?: boolean;
  weightPresets?: number[];
}

// Helper to sort weights descending
const sortWeights = (items: WeightedItem[]) => {
  return [...items].sort((a, b) => b.weight - a.weight);
};

interface WeightedStatItemProps {
  item: WeightedItem;
  onUpdate: (newItem: WeightedItem | null) => void; // null to remove
  availableOptions: string[];
  weightPresets?: number[];
}

function WeightedStatItem({
  item,
  onUpdate,
  availableOptions,
  weightPresets,
}: WeightedStatItemProps) {
  const { t } = useLanguage();

  const handleStatChange = (newStat: string) => {
    if (newStat === "__DESELECT__") {
      onUpdate(null);
    } else {
      onUpdate({ ...item, stat: newStat });
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
        weightPresets={weightPresets}
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
  weightPresets,
}: WeightedStatSelectProps) {
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddItem = useCallback(
    (stat: string) => {
      if (stat === "__DESELECT__") {
        setIsAdding(false);
        return;
      }

      // Default weight logic: use last item's weight, or 100
      const lastWeight =
        values.length > 0 ? values[values.length - 1].weight : 100;

      const newItem: WeightedItem = {
        stat,
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
      return options.filter(
        (opt) => opt === currentStat || !selectedStats.includes(opt)
      );
    },
    [values, options]
  );

  const handleUpdateItem = useCallback(
    (index: number, newItem: WeightedItem | null) => {
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
              className="p-0 h-5 w-5 text-primary/70 hover:text-primary bg-primary/5 hover:bg-primary/10 transition-transform hover:scale-[1.2]"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap min-h-8">
        {values.map((item, index) => (
          <WeightedStatItem
            key={item.stat}
            item={item}
            onUpdate={(newItem) => handleUpdateItem(index, newItem)}
            availableOptions={getAvailableOptions(item.stat)}
            weightPresets={weightPresets}
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
      prev.compact === next.compact &&
      prev.weightPresets === next.weightPresets
    );
  }
);
