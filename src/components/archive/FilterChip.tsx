import { cn } from "@/lib/utils";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs leading-none font-medium transition-all border",
        active
          ? "bg-card/50 border-border/50 text-foreground"
          : "border-transparent opacity-40 hover:opacity-70 text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}
