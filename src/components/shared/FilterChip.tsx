import { cn } from "@/lib/utils";
import { CHIP_COLORS, type ChipColor } from "./colors";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: ChipColor;
}

export function FilterChip({
  active,
  onClick,
  children,
  color,
}: FilterChipProps) {
  const scheme = color ? CHIP_COLORS[color] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs leading-none font-medium transition-all border",
        scheme
          ? active
            ? scheme.active
            : scheme.inactive
          : active
            ? "bg-card/50 border-border/50 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground/80"
      )}
    >
      {children}
    </button>
  );
}
