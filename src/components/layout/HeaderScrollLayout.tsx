import { cn } from "@/lib/utils";

interface HeaderScrollLayoutProps {
  /** Fixed header content that stays at top */
  header: React.ReactNode;
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
 * HeaderScrollLayout - Layout with a fixed header and scrollable body.
 *
 * The header remains fixed at the top while the body content scrolls beneath it.
 * Unlike sticky/floating styles, the header has a solid background without blur effects.
 */
export function HeaderScrollLayout({
  header,
  children,
  className,
  headerClassName,
  bodyClassName,
  bodyRef,
}: HeaderScrollLayoutProps) {
  return (
    <div className={cn("h-full w-full flex flex-col", className)}>
      {/* Fixed header - not scrollable */}
      <div
        className={cn(
          "flex-shrink-0 border-b border-border/30",
          headerClassName
        )}
      >
        {header}
      </div>
      {/* Scrollable body */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className={cn("container min-h-full", bodyClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
