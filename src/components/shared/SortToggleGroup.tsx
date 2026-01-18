import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SortDirection } from "@/data/types";
import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";

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

  const toggleGroup = (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v: string) => {
        // ToggleGroup returns empty string when deselecting, but we handle clicks explicitly
        if (v && !disabled) onChange(v as SortDirection);
      }}
      className={`gap-0 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <ToggleGroupItem
        value="off"
        aria-label="No sorting"
        disabled={disabled}
        className="h-7 w-12 rounded-l-sm rounded-r-none border border-r-0 text-[10px] gap-0.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground disabled:opacity-100"
      >
        <Minus className="h-3 w-3" />
        {t.ui("filters.sortOff")}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="asc"
        aria-label="Sort ascending"
        disabled={disabled}
        className="h-7 w-12 rounded-none border border-r-0 text-[10px] gap-0.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground disabled:opacity-100"
      >
        <ArrowUp className="h-3 w-3" />
        {t.ui("filters.sortAsc")}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="desc"
        aria-label="Sort descending"
        disabled={disabled}
        className="h-7 w-12 rounded-l-none rounded-r-sm border text-[10px] gap-0.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground disabled:opacity-100"
      >
        <ArrowDown className="h-3 w-3" />
        {t.ui("filters.sortDesc")}
      </ToggleGroupItem>
    </ToggleGroup>
  );

  // If no label provided, just return the toggle group (for use in grid layouts)
  if (!label) {
    return toggleGroup;
  }

  const labelContent = (
    <Label
      className={`text-foreground text-sm font-medium min-w-[4rem] flex items-center gap-1 ${disabled ? "text-muted-foreground" : ""}`}
    >
      {label}
      {disabled && (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
      )}
    </Label>
  );

  return (
    <div className="flex items-center gap-2">
      {disabled && disabledTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{labelContent}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{disabledTooltip}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        labelContent
      )}
      {toggleGroup}
    </div>
  );
}
