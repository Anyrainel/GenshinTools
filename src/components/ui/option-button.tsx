import { cn } from "@/lib/utils";
import { type ReactNode, forwardRef } from "react";

const ICON_HEIGHT = "h-[1.25rem] md:h-[1.5rem] lg:h-[1.75rem]";

/**
 * Shared layout for radio-style option buttons.
 *
 * Two variants:
 * - default: renders a radio circle that reflects `selected` state
 * - custom `icon`: renders a custom icon, replacing the radio circle
 *
 * Text layout: title + subtitle sit in a flex-wrap baseline container.
 * On mobile, `basis-full` on the subtitle pushes it to a second row;
 * on desktop it stays inline.
 */
export const OptionButton = forwardRef<
  HTMLButtonElement,
  {
    selected?: boolean;
    onClick?: () => void;
    /** Custom icon element. When provided, replaces the radio circle. */
    icon?: ReactNode;
    title: ReactNode;
    /** Wraps to row 2 on mobile, inline on desktop. */
    subtitle?: ReactNode;
    /** Class overrides for the selected state (border + bg). */
    selectedClassName?: string;
    /** Class overrides for the unselected state (border + bg). */
    unselectedClassName?: string;
    /** Override the title color class (defaults to selected/unselected foreground). */
    titleClassName?: string;
    className?: string;
  }
>(function OptionButton(
  {
    selected,
    onClick,
    icon,
    title,
    subtitle,
    selectedClassName,
    unselectedClassName,
    titleClassName,
    className,
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "w-full h-full flex flex-wrap md:flex-nowrap items-baseline rounded-lg border-2 px-3 py-2 text-left transition-all",
        selected
          ? (selectedClassName ?? "border-primary bg-primary/10")
          : (unselectedClassName ??
              "border-border/50 bg-black/5 hover:border-border/70 hover:bg-black/10"),
        className,
      )}
    >
      {/* Icon + title grouped so icon centers against the title line-height */}
      <span className="inline-flex items-center gap-2.5 shrink-0">
        <span className={cn("inline-flex items-center", ICON_HEIGHT)}>
          {icon ?? <RadioDot selected={selected} />}
        </span>
        <span
          className={cn(
            "text-sm md:text-base lg:text-lg font-bold",
            titleClassName ??
              (selected ? "text-foreground" : "text-foreground/70"),
          )}
        >
          {title}
        </span>
      </span>

      {/* Subtitle – basis-full forces row 2 on mobile, inline on desktop */}
      {subtitle && (
        <div className="basis-full md:basis-auto ml-2 text-[10px] md:text-xs leading-snug text-muted-foreground">
          {subtitle}
        </div>
      )}
    </button>
  );
});

function RadioDot({ selected }: { selected?: boolean }) {
  return (
    <div
      className={cn(
        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
        selected ? "border-primary" : "border-border",
      )}
    >
      {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
    </div>
  );
}

/** Container for a row of OptionButtons. */
export function OptionButtonRow({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-stretch gap-1 lg:gap-2 px-1 md:px-2 xl:px-4 py-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Flex-1 wrapper so each button stretches equally. */
export function OptionButtonCell({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex-1 min-w-0 flex", className)}>{children}</div>
  );
}
