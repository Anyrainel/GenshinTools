import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download, SlidersHorizontal } from "lucide-react";

interface BuildsEmptyStateProps {
  onOpenImport?: () => void;
}

export function BuildsEmptyState({ onOpenImport }: BuildsEmptyStateProps) {
  const { t } = useLanguage();

  return (
    <EmptyState
      icon={SlidersHorizontal}
      title={t.ui("computeFilters.noConfig")}
      description={t.ui("computeFilters.noConfigDesc")}
      action={
        onOpenImport
          ? {
              label: t.ui("computeFilters.importPreset"),
              icon: Download,
              onClick: onOpenImport,
            }
          : undefined
      }
    />
  );
}
