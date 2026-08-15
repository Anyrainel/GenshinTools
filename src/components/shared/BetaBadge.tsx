import { cn } from "@/lib/utils";

/** Small "BETA" pill for entities not yet available in the official game data. */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center shrink-0 font-semibold bg-amber-600/50 text-white rounded leading-none align-middle",
        "text-[9px] px-1 py-0.5",
        className
      )}
    >
      BETA
    </span>
  );
}
