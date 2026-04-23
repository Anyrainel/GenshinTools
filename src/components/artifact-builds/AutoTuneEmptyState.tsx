import { ExternalLink, Scale } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export function AutoTuneEmptyState({
  hasBuilds,
  hasTeams,
  onShowAll,
}: {
  hasBuilds: boolean;
  hasTeams: boolean;
  onShowAll: () => void;
}) {
  const { t } = useLanguage();

  // When both builds and teams exist but no DPS builds matched,
  // show "Show All" as primary; otherwise direct to missing prerequisite
  const primary = !hasBuilds
    ? {
        label: t.ui("evaluation.goToBuilds"),
        icon: ExternalLink,
        href: "/artifact-filter/configure",
      }
    : !hasTeams
      ? {
          label: t.ui("batchAutoTune.goToTeams"),
          icon: ExternalLink,
          href: "/team-comp/damage",
        }
      : undefined;

  const secondary =
    !hasBuilds && !hasTeams
      ? {
          label: t.ui("batchAutoTune.goToTeams"),
          icon: ExternalLink,
          href: "/team-comp/damage",
        }
      : undefined;

  return (
    <EmptyState
      icon={Scale}
      title={t.ui("batchAutoTune.noBuildTitle")}
      description={t.ui("batchAutoTune.noBuildDesc")}
      action={primary}
      secondaryAction={secondary}
    >
      {hasBuilds && hasTeams && (
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={onShowAll}
        >
          {t.ui("batchAutoTune.allBuilds")}
        </Button>
      )}
    </EmptyState>
  );
}
