import { cn } from "@/lib/utils";
import { CHIP_COLORS, type ChipColor } from "./colors";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: ChipColor;
  disabled?: boolean;
}

export function FilterChip({
  active,
  onClick,
  children,
  color,
  disabled = false,
}: FilterChipProps) {
  const scheme = color ? CHIP_COLORS[color] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
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
