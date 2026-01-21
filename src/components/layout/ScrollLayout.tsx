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
    <div className="container flex-1 min-h-0 overflow-y-auto pt-4">
      <div className={cn("h-full", className)}>{children}</div>
    </div>
  );
}
