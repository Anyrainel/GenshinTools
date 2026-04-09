import { BuildCard } from "@/components/artifact-builds/BuildCard";
import { Button } from "@/components/ui/button";
import type { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { ArrowLeft, BarChart3, Lightbulb, Lock } from "lucide-react";
import { PREVIEW_BUILD } from "./previewData";

type PreviewProps = { t: ReturnType<typeof useLanguage>["t"] };

/** Step 2 benefits: tab icon+label → left arrow → benefit description */
const benefits = [
  {
    tabIcon: BarChart3,
    tabLabelKey: "evaluation.tabLabel",
    benefitKey: "greeting.customizeBenefitScoring",
  },
  {
    tabIcon: Lightbulb,
    tabLabelKey: "accountData.recommendations",
    benefitKey: "greeting.customizeBenefitRecommendations",
  },
  {
    tabIcon: Lock,
    tabLabelKey: "triage.tabLabel",
    benefitKey: "greeting.customizeBenefitLock",
  },
] as const;

export default function BuildsPreview({ t }: PreviewProps) {
  return (
    <>
      {/* Real BuildCard — pointer-events-none to disable all interactions */}
      <div className="pointer-events-none select-none mb-3 mx-auto w-[80%] rounded-lg border-2 border-amber-500/50 p-1">
        <BuildCard
          build={PREVIEW_BUILD}
          buildId="preview-zibai"
          onDuplicate={() => {}}
          element="Geo"
        />
      </div>

      <p className="text-sm text-foreground mb-3">
        {t.ui("greeting.step2BuildHint")}
      </p>

      {/* Benefits: tab button → arrow → description */}
      <div className="space-y-2">
        {benefits.map(({ tabIcon: Icon, tabLabelKey, benefitKey }) => (
          <div
            key={benefitKey}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border"
          >
            {/* Tab button replica (matches AppBar tab style) */}
            <Button
              variant="default"
              className="bg-primary/60 text-primary-foreground gap-1.5 h-7 px-2.5 text-xs pointer-events-none shrink-0"
            >
              <Icon className="size-3.5" />
              {t.ui(tabLabelKey)}
            </Button>
            <ArrowLeft className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{t.ui(benefitKey)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
