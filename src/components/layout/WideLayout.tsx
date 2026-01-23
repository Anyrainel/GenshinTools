import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";
import { useState } from "react";

interface FilterGroup {
  key: string;
  content: React.ReactNode;
}

interface WideLayoutProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  filters?: FilterGroup[];
  children: React.ReactNode;
  className?: string;
}

/**
 * WideLayout - For dense tabular data with inline filters.
 *
 * Provides a sticky header with title, actions, and optional filter groups.
 * On desktop, filters are displayed inline with flex-wrap.
 * On mobile, filters are accessible via a Sheet.
 */
export function WideLayout({
  title,
  actions,
  filters,
  children,
  className,
}: WideLayoutProps) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const hasFilters = filters && filters.length > 0;

  return (
    <div className={cn("w-full flex-1 min-h-0 flex flex-col", className)}>
      {/* Header - Sticky, uses container for constrained width */}
      <header className="shrink-0 sticky top-0 z-10 pt-4 pb-3">
        <div className="container flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="text-xl md:text-2xl font-bold truncate">
              {title}
            </div>
            {actions}
          </div>

          {/* Desktop filter bar */}
          {hasFilters && (
            <div className="hidden md:flex items-center gap-4 flex-wrap">
              {filters.map((group, index) => (
                <div key={group.key} className="flex items-center gap-4">
                  {index > 0 && (
                    <div className="h-6 w-px bg-border" aria-hidden="true" />
                  )}
                  {group.content}
                </div>
              ))}
            </div>
          )}

          {/* Mobile filter trigger */}
          {hasFilters && (
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden shrink-0"
                >
                  <Filter className="h-4 w-4" />
                  <span className="sr-only">Filters</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  {filters.map((group) => (
                    <div key={group.key} className="space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {group.content}
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      {/* Content - Full width for dense tabular data */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 xl:px-8 2xl:px-12">
        {children}
      </div>
    </div>
  );
}
