import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ChipColor } from "./colors";
import { FilterChip } from "./FilterChip";

interface FilterChipGroupProps<T> {
  options: readonly T[];
  selectedValues: ReadonlySet<T>;
  onSelectedValuesChange: (nextValues: Set<T>) => void;
  getKey: (option: T) => string;
  getLabel: (option: T, active: boolean) => React.ReactNode;
  getIcon?: (option: T, active: boolean) => React.ReactNode;
  getColor?: (option: T, active: boolean) => ChipColor | undefined;
  getValue?: (option: T) => T;
  label?: React.ReactNode;
  className?: string;
  color?: ChipColor;
  emptyMeansAll?: boolean;
}

export function FilterChipGroup<T>({
  options,
  selectedValues,
  onSelectedValuesChange,
  getKey,
  getLabel,
  getIcon,
  getColor,
  getValue = (option) => option,
  label,
  className,
  color,
  emptyMeansAll = true,
}: FilterChipGroupProps<T>) {
  const handleToggle = useCallback(
    (value: T) => {
      const nextValues = new Set(selectedValues);
      if (nextValues.has(value)) nextValues.delete(value);
      else nextValues.add(value);
      onSelectedValuesChange(nextValues);
    },
    [onSelectedValuesChange, selectedValues]
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1 px-2", className)}>
      {label && (
        <span className="text-sm font-medium text-foreground shrink-0">
          {label}
        </span>
      )}
      {options.map((option) => {
        const value = getValue(option);
        const active =
          (emptyMeansAll && selectedValues.size === 0) ||
          selectedValues.has(value);

        return (
          <FilterChip
            key={getKey(option)}
            active={active}
            onClick={() => handleToggle(value)}
            color={getColor?.(option, active) ?? color}
          >
            {getIcon?.(option, active)}
            {getLabel(option, active)}
          </FilterChip>
        );
      })}
    </div>
  );
}
