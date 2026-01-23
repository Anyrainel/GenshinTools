import { AppBar, type AppBarProps } from "@/components/layout/AppBar";
import { cn } from "@/lib/utils";

interface PageLayoutProps extends Omit<AppBarProps, "className"> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Standard page container for all pages.
 * Enforces full viewport height, gradient background, and flex column layout.
 *
 * Automatically renders the standard AppBar at the top.
 * Children are rendered in a flex-1 container that fills the remaining space.
 */
export function PageLayout({
  children,
  className,
  ...appBarProps
}: PageLayoutProps) {
  return (
    <div
      className={cn(
        "h-dvh bg-gradient-page text-foreground flex flex-col overflow-hidden",
        className
      )}
    >
      <AppBar {...appBarProps} />
      <div className="flex-1 min-h-0 flex flex-col relative w-full">
        {children}
      </div>
    </div>
  );
}
