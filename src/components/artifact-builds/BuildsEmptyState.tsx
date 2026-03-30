import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download, SlidersHorizontal } from "lucide-react";

interface BuildsEmptyStateProps {
  onOpenImport?: () => void;
}

export function BuildsEmptyState({ onOpenImport }: BuildsEmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
        <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
          <SlidersHorizontal className="w-10 h-10 text-primary opacity-80" />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {t.ui("computeFilters.noConfig")}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {t.ui("computeFilters.noConfigDesc")}
      </p>
      {onOpenImport && (
        <Button
          onClick={onOpenImport}
          className="gap-2 shadow-lg shadow-primary/10"
          size="lg"
        >
          <Download className="w-4 h-4" />
          {t.ui("computeFilters.importPreset")}
        </Button>
      )}
    </div>
  );
}
