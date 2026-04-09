import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

interface StatSelectProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: readonly string[];
  maxLength: number;
  compact?: boolean;
  label?: string;
}

interface StatSelectItemProps {
  value: string;
  onValueChange: (value: string) => void;
  availableOptions: string[];
  autoOpen?: boolean;
  compact?: boolean;
}

function StatSelectItem({
  value,
  onValueChange,
  availableOptions,
  autoOpen = false,
  compact = false,
}: StatSelectItemProps) {
  const { t } = useLanguage();

  return (
    <LightweightSelect
      value={value}
      onValueChange={onValueChange}
      defaultOpen={autoOpen}
    >
      <LightweightSelectTrigger
        className={cn(
          "w-auto hover:brightness-110 bg-gradient-select h-7 text-sm",
          compact ? "min-w-[3rem]" : "min-w-[4.5rem]"
        )}
      >
        {value && value !== "__DESELECT__" ? (
          <span>{t.statShort(value)}</span>
        ) : (
          <LightweightSelectValue />
        )}
      </LightweightSelectTrigger>
      <LightweightSelectContent>
        <LightweightSelectItem
          value="__DESELECT__"
          className="text-muted-foreground text-sm"
        >
          {t.ui("buildCard.deselect")}
        </LightweightSelectItem>
        {availableOptions.map((option) => (
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
  );
}

function StatSelectComponent({
  values,
  onValuesChange,
  options,
  maxLength,
  compact = false,
  label,
}: StatSelectProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddValue = useCallback(
    (value: string) => {
      if (value === "__DESELECT__") {
        // Do nothing, just ignore
      } else if (value && !values.includes(value)) {
        onValuesChange([...values, value]);
      }
      setIsAdding(false);
    },
    [values, onValuesChange]
  );

  const handlePlusClick = useCallback(() => {
    setIsAdding(true);
  }, []);

  const handleUpdateValue = useCallback(
    (index: number, value: string) => {
      if (value === "__DESELECT__") {
        // Remove the value
        const newValues = values.filter((_, i) => i !== index);
        onValuesChange(newValues);
      } else if (value) {
        const newValues = [...values];
        newValues[index] = value;
        onValuesChange(newValues);
      }
    },
    [values, onValuesChange]
  );

  // Memoize available options computation
  const availableOptions = useMemo(
    () => options.filter((option) => !values.includes(option)),
    [options, values]
  );

  const canAddMore = useMemo(
    () => values.length < maxLength && availableOptions.length > 0,
    [values.length, maxLength, availableOptions.length]
  );

  // Get available options for a specific select (excludes all other selected values)
  const getAvailableOptionsForSelect = useCallback(
    (currentIndex: number) => {
      const otherValues = values.filter((_, index) => index !== currentIndex);
      return options.filter((option) => !otherValues.includes(option));
    },
    [values, options]
  );

  return (
    <div className={cn(label && (compact ? "space-y-0.5" : "space-y-1"))}>
      {label && (
        <div className="flex items-center gap-1">
          <Label
            className={cn(
              "font-medium text-muted-foreground select-none",
              compact ? "text-[10px]" : "text-xs"
            )}
          >
            {label}
          </Label>
          {canAddMore && !isAdding && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlusClick}
              className="p-0 h-5 w-5 text-primary/70 hover:text-primary bg-primary/5 hover:bg-primary/10 transition-transform hover:scale-[1.2]"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
      <div className={cn("flex items-center gap-1 flex-wrap text-sm min-h-7")}>
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-1">
            <StatSelectItem
              value={value}
              onValueChange={(newValue) => handleUpdateValue(index, newValue)}
              availableOptions={getAvailableOptionsForSelect(index)}
              compact={compact}
            />
          </div>
        ))}

        {!label && canAddMore && !isAdding && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlusClick}
            className={cn(
              "p-0 text-muted-foreground",
              compact ? "h-5 w-5" : "h-6 w-6"
            )}
          >
            <Plus className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </Button>
        )}

        {isAdding && (
          <StatSelectItem
            value=""
            onValueChange={handleAddValue}
            availableOptions={availableOptions}
            autoOpen={true}
            compact={compact}
          />
        )}
      </div>
    </div>
  );
}

export const StatSelect = memo(StatSelectComponent);
