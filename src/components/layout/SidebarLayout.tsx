import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";
import { cn } from "@/lib/utils";
import { Filter, type LucideIcon } from "lucide-react";
import { type RefObject, useRef, useState } from "react";

interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  triggerIcon?: LucideIcon;
  triggerLabel?: string;
  /** Number of active filters to display as a badge on the mobile trigger button. */
  activeFilterCount?: number;
  children: React.ReactNode;
  /**
   * Ref to the scrollable content area. Required when `contentScrollsInternally`
   * is true so the layout can forward wheel events from margin areas.
   * When `contentScrollsInternally` is false, the layout creates its own ref.
   */
  contentScrollRef?: RefObject<HTMLDivElement>;
  /**
   * When true, render children directly without the outer scroll container.
   * Use this when children manage their own scrolling (e.g., virtualized lists).
   */
  contentScrollsInternally?: boolean;
}

/**
 * SidebarLayout - For filtering + browsing workflows.
 *
 * Renders a sidebar on desktop (md+) and a Sheet trigger on mobile.
 * The sidebar is hidden on mobile and slides in from the left via Sheet.
 *
 * Automatically forwards wheel events from margin/padding areas to the
 * main content scroll container.
 */
export function SidebarLayout({
  sidebar,
  triggerIcon: TriggerIcon = Filter,
  triggerLabel = "Filters",
  activeFilterCount = 0,
  children,
  contentScrollRef,
  contentScrollsInternally = false,
}: SidebarLayoutProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalMainRef = useRef<HTMLDivElement>(null);

  // Scroll target: external ref (virtualized children) or internal main ref
  const scrollTarget = contentScrollsInternally
    ? contentScrollRef
    : internalMainRef;

  // Forward wheel events from margin/padding areas to main content
  useGlobalScroll(containerRef, scrollTarget);

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full overflow-hidden flex flex-col lg:flex-row wide-container gap-2 lg:gap-3"
      )}
    >
      {/* Mobile/Tablet trigger button */}
      <div className="lg:hidden shrink-0">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <TriggerIcon className="h-4 w-4" />
              {triggerLabel}
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary/50 text-primary-foreground text-xs font-medium">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="flex items-center gap-2">
                <TriggerIcon className="h-4 w-4" />
                {triggerLabel}
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto h-[calc(100%-4rem)]">{sidebar}</div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-sidebar-narrow xl:w-sidebar 2xl:w-sidebar-narrow 3xl:w-sidebar shrink-0 overflow-y-auto">
        {sidebar}
      </aside>

      {/* Main panel - handles scrolling or delegates to children */}
      {contentScrollsInternally ? (
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {children}
        </main>
      ) : (
        <main ref={internalMainRef} className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      )}
    </div>
  );
}
