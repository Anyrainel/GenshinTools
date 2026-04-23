import type { Tour, TourLabels } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Download,
  Filter,
  Settings,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useMemo } from "react";

export function useTourLabels(): TourLabels {
  const { t } = useLanguage();
  return useMemo<TourLabels>(
    () => ({
      guideTitle: t.ui("tour.guide.title"),
      gotIt: t.ui("common.gotIt"),
      previous: t.ui("common.previous"),
      next: t.ui("common.next"),
      finish: t.ui("common.finish"),
      stepOf: (current, total) => t.format("common.stepOf", current, total),
    }),
    [t]
  );
}

export function useTours(): Tour[] {
  const { t } = useLanguage();
  return useMemo<Tour[]>(() => {
    // Render a guide content string with `{token}` placeholders replaced by
    // icon+label chips. Closed over `t` so it doesn't need to be a prop.
    const renderGuideContent = (content: string): React.ReactNode => {
      const parts = content.split(/({[^}]+})/g);
      return (
        <span>
          {parts.map((part, index) => {
            const match = part.match(/{([^}]+)}/);
            if (!match) return part;
            const key = match[1];
            let icon: React.ReactNode = null;
            let label = "";
            switch (key) {
              case "import":
                icon = <Download className="size-3.5 mr-1" />;
                label = t.ui("import.action");
                break;
              case "customize":
                icon = <Wrench className="size-3.5 mr-1" />;
                label = t.ui("buttons.customize");
                break;
              case "builds":
                icon = <Settings className="size-3.5 mr-1" />;
                label = t.ui("navigation.configure");
                break;
              case "filters":
                icon = <Filter className="size-3.5 mr-1" />;
                label = t.ui("navigation.computeFilters");
                break;
              case "characters":
                icon = <Users className="size-3.5 mr-1" />;
                label = t.ui("accountData.characters");
                break;
              case "optimize":
                icon = <Sparkles className="size-3.5 mr-1" />;
                label = t.ui("teamComp.teamOptimization");
                break;
              default:
                return part;
            }
            return (
              <span
                key={index}
                className="inline-flex items-center mx-1 font-medium text-foreground bg-muted px-1.5 py-0.5 rounded-md border text-sm align-baseline transform translate-y-[2px]"
              >
                {icon}
                {label}
              </span>
            );
          })}
        </span>
      );
    };

    return [
      {
        id: "artifact-filter",
        guideContent: renderGuideContent(t.ui("tour.guide.artifactFilter")),
        steps: [
          {
            id: "af-presets",
            title: t.ui("computeFilters.importPreset"),
            content: t.ui("tour.artifactFilter.presetsContent"),
            side: "bottom",
          },
          {
            id: "af-build-card",
            title: t.ui("evaluation.goToBuilds"),
            content: t.ui("tour.artifactFilter.buildCardContent"),
            side: "right",
          },
          {
            id: "af-compute-tab",
            title: t.ui("tour.artifactFilter.computeTabTitle"),
            content: t.ui("tour.artifactFilter.computeTabContent"),
            side: "bottom",
          },
          {
            id: "af-weights-tab",
            title: t.ui("navigation.autoTune"),
            content: t.ui("tour.artifactFilter.weightsTabContent"),
            side: "bottom",
          },
        ],
      },
      {
        id: "tier-list",
        guideContent: renderGuideContent(t.ui("tour.guide.tierList")),
        steps: [
          {
            id: "tl-unassigned",
            title: t.ui("tour.tierList.unassignedTitle"),
            content: t.ui("tour.tierList.unassignedContent"),
            side: "bottom",
          },
          {
            id: "tl-tier-row",
            title: t.ui("tour.tierList.tierRowTitle"),
            content: t.ui("tour.tierList.tierRowContent"),
            side: "right",
          },
          {
            id: "tl-customize",
            title: t.ui("customizeDialog.title"),
            content: t.ui("tour.tierList.customizeContent"),
            side: "left",
          },
          {
            id: "tl-export",
            title: t.ui("tour.tierList.exportTitle"),
            content: t.ui("tour.tierList.exportContent"),
            side: "left",
          },
          {
            id: "tl-weapons-tab",
            title: t.ui("app.weaponTierListTitle"),
            content: t.ui("tour.tierList.weaponsTabContent"),
            side: "bottom",
          },
        ],
      },
      {
        id: "team-comp",
        guideContent: renderGuideContent(t.ui("tour.guide.teamComp")),
        steps: [
          {
            id: "tc-team-card",
            title: t.ui("tour.teamComp.teamCardTitle"),
            content: t.ui("tour.teamComp.teamCardContent"),
            side: "bottom",
          },
          {
            id: "tc-optimize",
            title: t.ui("app.ctaCalculateDamage"),
            content: t.ui("tour.teamComp.optimizeContent"),
            side: "top",
          },
          {
            id: "tc-import",
            title: t.ui("computeFilters.importPreset"),
            content: t.ui("tour.teamComp.importContent"),
            side: "bottom",
          },
        ],
      },
      {
        id: "team-opt-detail",
        guideContent: renderGuideContent(t.ui("tour.guide.teamOptDetail")),
        steps: [
          {
            id: "tod-roster",
            title: t.ui("tour.teamOptDetail.rosterTitle"),
            content: t.ui("tour.teamOptDetail.rosterContent"),
            side: "bottom",
          },
          {
            id: "tod-formula",
            title: t.ui("teamComp.formulaSelect"),
            content: t.ui("tour.teamOptDetail.formulaContent"),
            side: "bottom",
          },
          {
            id: "tod-damage",
            title: t.ui("tour.teamOptDetail.damageTitle"),
            content: t.ui("tour.teamOptDetail.damageContent"),
            side: "top",
          },
        ],
      },
      {
        id: "account-data",
        guideContent: renderGuideContent(t.ui("tour.guide.accountData")),
        steps: [
          {
            id: "ad-import",
            title: t.ui("tour.accountData.importTitle"),
            content: t.ui("tour.accountData.importContent"),
            side: "bottom",
          },
          {
            id: "ad-characters",
            title: t.ui("tour.accountData.charactersTitle"),
            content: t.ui("tour.accountData.charactersContent"),
            side: "bottom",
          },
          {
            id: "ad-recommendations",
            title: t.ui("accountData.recommendations"),
            content: t.ui("tour.accountData.recommendationsContent"),
            side: "bottom",
          },
          {
            id: "ad-evaluation",
            title: t.ui("evaluation.tabLabel"),
            content: t.ui("tour.accountData.evaluationContent"),
            side: "bottom",
          },
          {
            id: "ad-triage",
            title: t.ui("triage.tabLabel"),
            content: t.ui("tour.accountData.triageContent"),
            side: "bottom",
          },
        ],
      },
    ];
  }, [t]);
}
