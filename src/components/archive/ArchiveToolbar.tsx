import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { isArchiveSearchActive } from "@/lib/archiveFilters";

interface ArchiveToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  /** Filter chip groups rendered below the search bar */
  children?: React.ReactNode;
}

export function ArchiveToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  children,
}: ArchiveToolbarProps) {
  const filtersDisabled = isArchiveSearchActive(searchQuery);

  return (
    <div className="space-y-3">
      {/* Search bar — centered, prominent */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-11 text-base rounded-xl bg-card/50 border-border/50 focus:border-primary/50 shadow-sm"
        />
      </div>

      {/* Filter chips — rendered by parent */}
      {children && (
        <fieldset
          disabled={filtersDisabled}
          className="m-0 flex min-w-0 flex-wrap items-center justify-center gap-1.5 border-0 p-0"
        >
          {children}
        </fieldset>
      )}
    </div>
  );
}
