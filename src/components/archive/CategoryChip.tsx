import { CHIP_COLORS, type ChipColor, cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Check, Minus } from "lucide-react";

interface CategoryChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color: ChipColor;
  activeIcon?: LucideIcon;
  inactiveIcon?: LucideIcon;
}

export function CategoryChip({
  active,
  onClick,
  children,
  color,
  activeIcon: ActiveIcon = Check,
  inactiveIcon: InactiveIcon = Minus,
}: CategoryChipProps) {
  const scheme = CHIP_COLORS[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm leading-none font-medium transition-all border",
        active ? scheme.active : scheme.inactive
      )}
    >
      {active ? (
        <ActiveIcon className={cn("w-3.5 h-3.5", scheme.icon)} />
      ) : (
        <InactiveIcon className="w-3.5 h-3.5" />
      )}
      {children}
    </button>
  );
}
