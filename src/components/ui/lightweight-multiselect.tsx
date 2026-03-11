import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LightweightMultiSelectOption {
  value: string;
  label: string;
  color?: string;
}

interface LightweightMultiSelectProps {
  options: LightweightMultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  /** Text shown when no options are selected */
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
}

function LightweightMultiSelect({
  options,
  value,
  onValueChange,
  placeholder,
  className,
  triggerClassName,
  contentClassName,
  itemClassName,
}: LightweightMultiSelectProps) {
  const selectedOptions = options.filter((o) => value.includes(o.value));
  const isEmpty = selectedOptions.length === 0;

  const handleToggle = (optionValue: string) => {
    const next = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onValueChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-2 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName,
            className
          )}
        >
          <span
            className={cn("truncate", isEmpty && "text-muted-foreground")}
          >
            {isEmpty
              ? (placeholder ?? "—")
              : selectedOptions.map((opt, i) => (
                  <React.Fragment key={opt.value}>
                    {i > 0 && ", "}
                    <span style={opt.color ? { color: opt.color } : undefined}>
                      {opt.label}
                    </span>
                  </React.Fragment>
                ))}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 ml-1 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-auto min-w-[8rem] p-1", contentClassName)}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {options.map((option) => {
          const isSelected = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                itemClassName
              )}
            >
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected && <Check className="h-4 w-4" />}
              </span>
              <span style={option.color ? { color: option.color } : undefined}>
                {option.label}
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export { LightweightMultiSelect };
export type { LightweightMultiSelectOption };
