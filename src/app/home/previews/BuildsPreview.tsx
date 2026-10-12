import { ArrowDown, BarChart3, Lightbulb, Lock } from "lucide-react";
import { BuildCard } from "@/components/shared/BuildCard";
import type { useLanguage } from "@/contexts/LanguageContext";
import { PREVIEW_BUILD } from "./previewData";

type PreviewProps = { t: ReturnType<typeof useLanguage>["t"] };

export default function BuildsPreview({ t }: PreviewProps) {
  const benefits = [
    {
      icon: BarChart3,
      label: t.ui("evaluation.tabLabel"),
      description: t.ui("greeting.customizeBenefitScoring"),
    },
    {
      icon: Lightbulb,
      label: t.ui("accountData.recommendations"),
      description: t.ui("greeting.customizeBenefitRecommendations"),
    },
    {
      icon: Lock,
      label: t.ui("triage.tabLabel"),
      description: t.ui("greeting.customizeBenefitLock"),
    },
  ];
  return (
    <div className="grid min-w-0 items-start gap-5 md:grid-cols-[1.3fr_1fr]">
      <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-gradient-card">
        <figcaption className="border-b border-border px-4 py-3 text-xs font-semibold">
          {t.ui("greeting.examplePreview")}
        </figcaption>
        <div
          className="pointer-events-none select-none p-3"
          ref={(element) => {
            if (element) element.inert = true;
          }}
        >
          <BuildCard
            build={PREVIEW_BUILD}
            buildId="preview-zibai"
            onDuplicate={() => {}}
            element="Geo"
          />
        </div>
      </figure>
      <div className="min-w-0 space-y-4">
        <p className="text-sm leading-6">{t.ui("greeting.step2BuildHint")}</p>
        <div className="flex justify-center">
          <ArrowDown className="size-5 text-primary" aria-hidden />
        </div>
        <div className="space-y-2">
          {benefits.map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-gradient-card p-3"
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                {label}
              </p>
              <p className="mt-1 text-sm leading-6">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
