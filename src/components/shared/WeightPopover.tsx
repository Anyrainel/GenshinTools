import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface WeightPopoverProps {
  value: number;
  onChange: (val: number) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function WeightPopover({
  value,
  onChange,
  label = "Weight",
  className,
  disabled,
}: WeightPopoverProps) {
  const [open, setOpen] = useState(false);

  const handlePresetClick = (val: number) => {
    onChange(val);
    // Optional: close on preset click? User might want to tweak. Let's keep it open.
    // Actually, usually preset is a quick action. Let's keep it open to see feedback.
  };

  const currentPercent = Math.round(value);

  const getWeightColor = (val: number) => {
    if (val === 0) return "text-muted-foreground";
    if (val === 100) return "text-amber-500 font-bold";
    if (val >= 80) return "text-amber-400";
    if (val >= 50) return "text-foreground";
    return "text-muted-foreground";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "h-full px-2 flex items-center justify-center text-xs font-mono transition-colors hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed",
            getWeightColor(value),
            className
          )}
        >
          {currentPercent}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-4 bg-slate-950 border-slate-800 shadow-xl"
        side="top"
        align="center"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {label}
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-bold text-amber-100 font-mono">
                {currentPercent}
              </span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>

          <Slider
            value={[value]}
            min={0}
            max={100}
            step={5}
            onValueChange={([val]) => onChange(val)}
            className="[&_.bg-primary]:bg-amber-500"
          />

          <div className="flex justify-between gap-1">
            {[0, 30, 50, 75, 100].map((preset) => (
              <Button
                key={preset}
                size="sm"
                variant="outline"
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "h-6 flex-1 text-[10px] px-0 border-slate-700 hover:bg-slate-800 hover:text-white transition-colors",
                  value === preset &&
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
  );
}
