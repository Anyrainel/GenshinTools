import { memo, useState, useCallback, useMemo } from "react";
import {
  LightweightSelect,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectContent,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus } from "lucide-react";

interface StatSelectProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: readonly string[];
  maxLength: number;
}

interface StatSelectItemProps {
  value: string;
  onValueChange: (value: string) => void;
  availableOptions: string[];
  autoOpen?: boolean;
}

function StatSelectItem({
  value,
  onValueChange,
  availableOptions,
  autoOpen = false,
}: StatSelectItemProps) {
  const { t } = useLanguage();

  return (
    <LightweightSelect
      value={value}
      onValueChange={onValueChange}
      defaultOpen={autoOpen}
    >
      <LightweightSelectTrigger className="w-28 h-8 text-base hover:brightness-110 bg-gradient-select">
        {value && value !== "__DESELECT__" ? (
          <span>{t.statShort(value)}</span>
        ) : (
          <LightweightSelectValue />
        )}
      </LightweightSelectTrigger>
      <LightweightSelectContent>
        <LightweightSelectItem
          value="__DESELECT__"
          className="text-muted-foreground"
        >
          {t.ui("buildCard.deselect")}
        </LightweightSelectItem>
        {availableOptions.map((option) => (
          <LightweightSelectItem
            key={option}
            value={option}
            className="text-base"
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
    [values, onValuesChange],
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
    [values, onValuesChange],
  );

  // Memoize available options computation
  const availableOptions = useMemo(
    () => options.filter((option) => !values.includes(option)),
    [options, values],
  );

  const canAddMore = useMemo(
    () => values.length < maxLength && availableOptions.length > 0,
    [values.length, maxLength, availableOptions.length],
  );

  // Get available options for a specific select (excludes all other selected values)
  const getAvailableOptionsForSelect = useCallback(
    (currentIndex: number) => {
      const otherValues = values.filter((_, index) => index !== currentIndex);
      return options.filter((option) => !otherValues.includes(option));
    },
    [values, options],
  );

  return (
    <div className="flex text-base min-h-8 items-center gap-3 flex-wrap">
      {/* Existing value selects */}
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-1">
          <StatSelectItem
            value={value}
            onValueChange={(newValue) => handleUpdateValue(index, newValue)}
            availableOptions={getAvailableOptionsForSelect(index)}
          />
        </div>
      ))}

      {/* Add button */}
      {canAddMore && !isAdding && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlusClick}
          className="p-1 h-6 w-6 text-muted-foreground"
        >
          <Plus className="w-4 h-4" />
        </Button>
      )}

      {/* Add select */}
      {isAdding && (
        <StatSelectItem
          value=""
          onValueChange={handleAddValue}
          availableOptions={availableOptions}
          autoOpen={true}
        />
      )}
    </div>
  );
}

export const StatSelect = memo(StatSelectComponent, (prev, next) => {
  // Custom equality: only re-render if values, options, or maxLength changed
  return (
    prev.values.length === next.values.length &&
    prev.values.every((v, i) => v === next.values[i]) &&
    prev.options === next.options &&
    prev.maxLength === next.maxLength
  );
});
