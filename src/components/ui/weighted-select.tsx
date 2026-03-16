import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { useState } from "react";

// Forked primitives from LightweightSelect, simplified for specific use case
const WeightedSelectPrimitive = SelectPrimitive.Root;
const WeightedSelectGroup = SelectPrimitive.Group;
const WeightedSelectValue = SelectPrimitive.Value;

const WeightedSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    weight: number;
    onWeightChange: (val: number) => void;
    weightLabel?: string;
    weightPresets?: number[];
  }
>(({ className, children, weight, onWeightChange, weightLabel = "Weight", weightPresets = [50, 75, 90, 100], ...props }, ref) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Stop propagation to prevent selecting the select trigger when clicking weight
  const handleWeightClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPopoverOpen(true);
  };

  const currentPercent = Math.round(weight);

  const getWeightColor = (val: number) => {
    if (val === 100) return "text-amber-500 font-bold";
    if (val >= 75) return "text-amber-400";
    if (val >= 50) return "text-amber-200";
    if (val >= 25) return "text-foreground";
    return "text-muted-foreground";
  };

  return (
    <div
      className={cn(
        "flex h-7 items-center rounded-md border border-input shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring hover:brightness-110 transition-all",
        // Gradient background
        "bg-gradient-select",
        className
      )}
    >
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex h-full items-center justify-between whitespace-nowrap bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 hover:bg-white/5 transition-colors rounded-l-md"
        )}
        {...props}
      >
        {children}
      </SelectPrimitive.Trigger>

      {/* Vertical Divider */}
      <div className="h-4 w-px bg-white/10 mx-0.5" />

      {/* Weight Trigger */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleWeightClick}
            className={cn(
              "h-full px-1.5 flex items-center justify-center text-xs font-mono transition-colors hover:bg-white/10 rounded-r-md min-w-[2rem]",
              getWeightColor(weight)
            )}
          >
            {currentPercent}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-4 bg-slate-950 border-slate-800 shadow-xl"
          side="bottom"
          align="end"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                {weightLabel}
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-bold text-amber-100 font-mono">
                  {currentPercent}
                </span>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>

            <Slider
              value={[weight]}
              min={1}
              max={100}
              step={1}
              onValueChange={([val]) => onWeightChange(val)}
              className="[&_.bg-primary]:bg-amber-500"
            />

            <div className="flex justify-between gap-1">
              {weightPresets.map((preset) => (
                <Button
                  key={preset}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onWeightChange(preset);
                    // setPopoverOpen(false); // keep open for tweaking
                  }}
                  className={cn(
                    "h-6 flex-1 text-xs px-0 border-slate-700 hover:bg-slate-800 hover:text-white transition-colors",
                    weight === preset &&
                      "bg-amber-500/20 text-amber-100 border-amber-500/50"
                  )}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});
WeightedSelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const WeightedSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      onWheel={(e) => e.stopPropagation()}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
WeightedSelectContent.displayName = SelectPrimitive.Content.displayName;

const WeightedSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
WeightedSelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  WeightedSelectPrimitive as WeightedSelect,
  WeightedSelectGroup,
  WeightedSelectValue,
  WeightedSelectTrigger,
  WeightedSelectContent,
  WeightedSelectItem,
};
