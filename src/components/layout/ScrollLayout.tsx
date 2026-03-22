import { cn } from "@/lib/utils";

interface ScrollLayoutProps {
  /** Fixed header content that stays at top (omit for header-less scrollable content) */
  header?: React.ReactNode;
  /** Scrollable body content */
  children: React.ReactNode;
  /** Optional className for the outer container */
  className?: string;
  /** Optional className for the header section */
  headerClassName?: string;
  /** Optional className for the scrollable body */
  bodyClassName?: string;
  /** Optional ref to the scrollable body container */
  bodyRef?: React.Ref<HTMLDivElement>;
}

/**
 * ScrollLayout - Standard scrollable content layout.
 *
 * Optionally renders a fixed header at the top with consistent padding.
 * The body content scrolls beneath it within a centered container.
 */
export function ScrollLayout({
  header,
  children,
  className,
  headerClassName,
  bodyClassName,
  bodyRef,
}: ScrollLayoutProps) {
  return (
    <div className={cn("h-full w-full flex flex-col", className)}>
      {/* Fixed header - not scrollable */}
      {header && (
        <div
          className={cn(
            "flex-shrink-0 container pb-2 2xl:pb-4",
            headerClassName
          )}
        >
          {header}
        </div>
      )}
      {/* Scrollable body */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className={cn("container min-h-full pb-4", bodyClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
