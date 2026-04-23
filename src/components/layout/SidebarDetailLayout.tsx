import { ArrowLeft } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface SidebarDetailLayoutProps {
  /** Fixed header content (e.g. toolbar / search bar) */
  header?: React.ReactNode;
  /** Sidebar content for desktop list panel */
  sidebar: React.ReactNode;
  /** Mobile grid/browse view shown when no item is selected */
  mobileGrid?: React.ReactNode;
  /** Main detail content (scrolls independently) */
  children: React.ReactNode;
  /** Whether an item is currently selected (controls mobile view) */
  hasSelection: boolean;
  /** Called when user taps back on mobile detail view */
  onBack: () => void;
  /** Back button label on mobile */
  backLabel: string;
  /** Sidebar width class, e.g. "w-1/3 max-w-[14rem]" */
  sidebarWidth?: string;
  /** Optional className for the outer container */
  className?: string;
  /** Optional className for the sidebar panel */
  sidebarClassName?: string;
  /** Content to render above the toolbar (e.g. prompts) */
  banner?: React.ReactNode;
}

/**
 * SidebarDetailLayout — responsive layout for archive-style pages.
 *
 * Desktop: fixed header + sidebar/detail split with independent scrolling.
 * Mobile: grid view (no selection) or detail view with back button (selection).
 * Uses `container` for consistent max-width.
 */
export function SidebarDetailLayout({
  header,
  sidebar,
  mobileGrid,
  children,
  hasSelection,
  onBack,
  backLabel,
  sidebarWidth = "w-1/3 max-w-[14rem]",
  className,
  sidebarClassName,
  banner,
}: SidebarDetailLayoutProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Forward wheel events from gap/padding areas to main content (desktop only)
  useGlobalScroll(containerRef, mainRef);

  // ── Mobile ──
  if (!isDesktop) {
    if (hasSelection) {
      return (
        <div className="flex flex-col h-full overflow-hidden container mx-auto px-2">
          {banner}
          <div className="shrink-0 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pb-4">{children}</div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-y-auto container mx-auto px-2">
        {banner}
        {header && <div className="shrink-0 pb-2 2xl:pb-4">{header}</div>}
        {mobileGrid ?? sidebar}
      </div>
    );
  }

  // ── Desktop ──
  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full overflow-hidden flex flex-col container mx-auto px-2 md:px-4",
        className
      )}
    >
      {banner}
      {header && <div className="shrink-0 pb-2 2xl:pb-4">{header}</div>}
      <div className="flex-1 min-h-0 flex flex-row gap-2 lg:gap-3 pb-2 lg:pb-3">
        <aside
          className={cn(
            "shrink-0 overflow-y-auto rounded-lg bg-card/50 border border-border/50 p-2 pr-1",
            sidebarWidth,
            sidebarClassName
          )}
        >
          {sidebar}
        </aside>
        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
