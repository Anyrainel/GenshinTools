import { cn } from "@/lib/utils";

interface ScrollLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ScrollLayout - For card grids, single-column content, and other simple scrollable layouts.
 *
 * Provides a centered container with responsive padding and scrollable content area.
 * Uses Tailwind container class for consistent max-widths.
 */
export function ScrollLayout({ children, className }: ScrollLayoutProps) {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className={cn("container min-h-full", className)}>{children}</div>
    </div>
  );
}
