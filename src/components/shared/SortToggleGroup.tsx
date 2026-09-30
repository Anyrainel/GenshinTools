import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SortDirection } from "@/data/enums";
import { cn } from "@/lib/utils";

interface SortToggleGroupProps {
  label?: string;
  value: SortDirection;
  onChange: (value: SortDirection) => void;
  disabled?: boolean;
  disabledTooltip?: string;
}

/**
 * Tri-state sort toggle: Off, Ascending, Descending.
 */
export function SortToggleGroup({
  label,
  value,
  onChange,
  disabled = false,
  disabledTooltip,
}: SortToggleGroupProps) {
  const { t } = useLanguage();

  const options = [
    {
      value: "off" as const,
      label: t.ui("filters.sortOff"),
      icon: Minus,
      className: "rounded-l-sm rounded-r-none border-r-0",
    },
    {
      value: "asc" as const,
      label: t.ui("filters.sortAsc"),
      icon: ArrowUp,
      className: "rounded-none border-r-0",
    },
    {
      value: "desc" as const,
      label: t.ui("filters.sortDesc"),
      icon: ArrowDown,
      className: "rounded-l-none rounded-r-sm",
    },
  ];

  const toggleGroup = (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v: string) => {
        // ToggleGroup returns empty string when deselecting, but we handle clicks explicitly
        if (v && !disabled) onChange(v as SortDirection);
      }}
      className={cn("gap-0", disabled && "opacity-50 pointer-events-none")}
    >
      {options.map(({ value, label, icon: Icon, className }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value={value}
              aria-label={label}
              disabled={disabled}
              className={cn(
                "h-7 w-9 px-0 border data-[state=on]:bg-primary/70 data-[state=on]:text-primary-foreground disabled:opacity-100",
                className
              )}
            >
              <Icon className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );

  const controls =
    disabled && disabledTooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{toggleGroup}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{disabledTooltip}</p>
        </TooltipContent>
      </Tooltip>
    ) : (
      toggleGroup
    );

  // If no label provided, just return the controls (for use in grid layouts)
  if (!label) {
    return controls;
  }

  return (
    <div className="flex items-center gap-2">
      <Label
        className={cn(
          "text-sm font-medium min-w-[4rem]",
          disabled ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {label}
      </Label>
      {controls}
    </div>
  );
}
