import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ExternalLink, Scale } from "lucide-react";
import { Link } from "react-router-dom";

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

  return (
    <div className="flex flex-col items-center pt-16 md:pt-24 h-full p-4">
      <div className="flex flex-col items-center text-center space-y-6 max-w-lg">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
          <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
            <Scale className="w-12 h-12 text-primary opacity-80" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">
            {t.ui("batchAutoTune.noBuildTitle")}
          </h3>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            {t.ui("batchAutoTune.noBuildDesc")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!hasBuilds && (
            <Button asChild variant="default" size="lg" className="gap-2">
              <Link to="/artifact-filter?tab=configure">
                <ExternalLink className="w-4 h-4" />
                {t.ui("evaluation.goToBuilds")}
              </Link>
            </Button>
          )}
          {!hasTeams && (
            <Button
              asChild
              variant={hasBuilds ? "default" : "outline"}
              size="lg"
              className="gap-2"
            >
              <Link to="/team-comp">
                <ExternalLink className="w-4 h-4" />
                {t.ui("batchAutoTune.goToTeams")}
              </Link>
            </Button>
          )}
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
        </div>
      </div>
    </div>
  );
}
