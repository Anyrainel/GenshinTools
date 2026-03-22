import { AppBar, type AppBarProps } from "@/components/layout/AppBar";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { cn } from "@/lib/utils";

interface PageLayoutProps extends Omit<AppBarProps, "className"> {
  children: React.ReactNode;
  className?: string;
  onClearData?: () => void;
  clearLabel?: string;
}

/**
 * Standard page container for all pages.
 * Enforces full viewport height, gradient background, and flex column layout.
 *
 * Automatically renders the standard AppBar at the top.
 * Children are rendered in a flex-1 container that fills the remaining space,
 * wrapped in a PageErrorBoundary so the AppBar remains visible on errors.
 */
export function PageLayout({
  children,
  className,
  onClearData,
  clearLabel,
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
      <div className="flex-1 min-h-0 flex flex-col relative w-full pt-2 2xl:pt-4">
        <PageErrorBoundary onClearData={onClearData} clearLabel={clearLabel}>
          {children}
        </PageErrorBoundary>
      </div>
    </div>
  );
}
