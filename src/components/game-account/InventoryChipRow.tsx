import { CategoryChip } from "@/components/shared/CategoryChip";
import type { ChipColor } from "@/components/shared/colors";
import { cn } from "@/lib/utils";

export interface InventoryChipOption {
  key: string;
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color?: ChipColor;
  separatorBefore?: boolean;
}

interface InventoryChipRowProps {
  label?: string;
  chips: InventoryChipOption[];
  className?: string;
}

export function InventoryChipRow({
  label,
  chips,
  className,
}: InventoryChipRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1 px-2", className)}>
      {label && (
        <span className="text-sm font-medium text-foreground shrink-0">
          {label}
        </span>
      )}
      {chips.map((chip) => (
        <InventoryChip key={chip.key} chip={chip} />
      ))}
    </div>
  );
}

function InventoryChip({ chip }: { chip: InventoryChipOption }) {
  const content = (
    <CategoryChip
      color={chip.color ?? "sky"}
      active={chip.active}
      onClick={chip.onClick}
    >
      {chip.label}
    </CategoryChip>
  );

  if (!chip.separatorBefore) return content;

  return (
    <>
      <span className="mx-0.5" />
      {content}
    </>
  );
}
