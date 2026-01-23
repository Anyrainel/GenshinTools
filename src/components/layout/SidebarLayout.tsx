import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Filter, type LucideIcon } from "lucide-react";
import { type RefObject, useState } from "react";

interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  triggerIcon?: LucideIcon;
  triggerLabel?: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Optional ref for the main scrollable content area.
   * Pass this when using virtualization (e.g., @tanstack/react-virtual).
   * If provided, the layout will forward this ref to the scroll container.
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
 * For virtualized content, use `contentScrollRef` to pass the scroll container ref,
 * or set `contentScrollsInternally={true}` when children handle their own scrolling.
 */
export function SidebarLayout({
  sidebar,
  triggerIcon: TriggerIcon = Filter,
  triggerLabel = "Filters",
  children,
  className,
  contentScrollRef,
  contentScrollsInternally = false,
}: SidebarLayoutProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={cn(
        "h-full overflow-hidden flex flex-col lg:flex-row gap-3",
        "w-full max-w-full lg:max-w-[90%] xl:max-w-[80%] 2xl:max-w-[70%] mx-auto",
        "px-2 md:px-4 lg:px-6",
        className
      )}
    >
      {/* Mobile/Tablet trigger button */}
      <div className="lg:hidden shrink-0">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <TriggerIcon className="h-4 w-4" />
              {triggerLabel}
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
      <aside className="hidden lg:block w-sidebar shrink-0 overflow-y-auto">
        {sidebar}
      </aside>

      {/* Main panel - handles scrolling or delegates to children */}
      {contentScrollsInternally ? (
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {children}
        </main>
      ) : (
        <main ref={contentScrollRef} className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      )}
    </div>
  );
}
