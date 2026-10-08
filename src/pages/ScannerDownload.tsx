import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  FileJson,
  Monitor,
  ScanLine,
  Wifi,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  SCANNER_CAPTURE_URL,
  SCANNER_OCR_URL,
  SCANNER_RELEASES_URL,
} from "@/data/scannerDownloads";
import { cn, getAssetUrl } from "@/lib/utils";

export default function ScannerDownload() {
  const { t } = useLanguage();
  const sharedFeatures = [
    t.ui("scannerDownload.ocrFeature"),
    t.ui("scannerDownload.exportFeature"),
    t.ui("scannerDownload.managerFeature"),
  ];
  const editions = [
    {
      name: "GGScanner",
      recommended: true,
      icon: Wifi,
      description: t.ui("scannerDownload.captureDescription"),
      url: SCANNER_CAPTURE_URL,
      features: [t.ui("scannerDownload.captureFeature"), ...sharedFeatures],
    },
    {
      name: "GGScannerOCR",
      recommended: false,
      icon: ScanLine,
      description: t.ui("scannerDownload.ocrDescription"),
      url: SCANNER_OCR_URL,
      features: sharedFeatures,
    },
  ];
  const steps = [
    {
      title: t.ui("scannerDownload.stepOneTitle"),
      body: t.ui("scannerDownload.stepOneBody"),
    },
    {
      title: t.ui("scannerDownload.stepTwoTitle"),
      body: t.ui("scannerDownload.stepTwoBody"),
    },
    {
      title: t.ui("scannerDownload.stepThreeTitle"),
      body: t.ui("scannerDownload.stepThreeBody"),
    },
  ];
  const resources = [
    { title: t.ui("scannerDownload.gameData"), path: "/good/data_cache.json" },
    { title: t.ui("scannerDownload.ocrNames"), path: "/good/mappings.json" },
    {
      title: t.ui("scannerDownload.achievementData"),
      path: "/good/mapping_achievements.json",
    },
  ];

  return (
    <PageLayout>
      <ScrollLayout bodyClassName="px-4 py-6 md:py-8">
        <div className="mx-auto w-full max-w-5xl space-y-8 md:space-y-10">
          <header className="mx-auto max-w-3xl space-y-3 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground">
              <Monitor className="size-4" aria-hidden />
              {t.ui("scannerDownload.platform")}
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              GGScanner
            </h1>
            <p className="text-xl font-medium sm:text-2xl">
              {t.ui("scannerDownload.tagline")}
            </p>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-foreground/80">
              {t.ui("scannerDownload.introduction")}
            </p>
          </header>

          <section
            aria-label={t.ui("scannerDownload.editions")}
            className="grid gap-5 md:grid-cols-2"
          >
            {editions.map((edition) => {
              const Icon = edition.icon;
              return (
                <article
                  key={edition.name}
                  className={cn(
                    "flex flex-col rounded-2xl bg-gradient-card p-6 sm:p-7",
                    edition.recommended
                      ? "border-2 border-primary shadow-lg"
                      : "border border-border shadow-sm"
                  )}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <Icon className="size-7 text-primary" aria-hidden />
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        edition.recommended
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "bg-secondary font-medium text-secondary-foreground"
                      )}
                    >
                      {edition.recommended
                        ? t.ui("scannerDownload.recommended")
                        : t.ui("scannerDownload.ocrEdition")}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold">{edition.name}</h2>
                  <p className="mt-2 min-h-[3rem] text-sm leading-6 text-foreground/80">
                    {edition.description}
                  </p>
                  <ul className="my-5 flex-1 space-y-3">
                    {edition.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-sm leading-6"
                      >
                        <Check
                          className="mt-1 size-4 shrink-0 text-primary"
                          aria-hidden
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    size="lg"
                    variant={edition.recommended ? "default" : "secondary"}
                    className="w-full gap-2"
                  >
                    <a href={edition.url}>
                      <Download className="size-4" />
                      {edition.recommended
                        ? t.ui("scannerDownload.menu")
                        : t.ui("scannerDownload.downloadOcr")}
                    </a>
                  </Button>
                </article>
              );
            })}
          </section>

          <div className="flex flex-col items-center gap-3 text-center text-sm">
            <p className="text-foreground/80">
              {t.ui("scannerDownload.choiceNote")}
            </p>
            <a
              href={SCANNER_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
            >
              {t.ui("scannerDownload.allReleases")}
              <ExternalLink className="size-4" />
            </a>
          </div>

          <section
            aria-labelledby="scanner-setup"
            className="border-t border-border pt-8"
          >
            <h2 id="scanner-setup" className="mb-6 text-xl font-semibold">
              {t.ui("scannerDownload.setupTitle")}
            </h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="space-y-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="text-sm leading-6 text-foreground/80">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="scanner-resources"
            className="border-t border-border pt-8"
          >
            <h2 id="scanner-resources" className="text-lg font-semibold">
              {t.ui("scannerDownload.resourcesTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground/80">
              {t.ui("scannerDownload.resourcesDescription")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {resources.map((resource) => (
                <a
                  key={resource.path}
                  href={getAssetUrl(resource.path)}
                  download
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm transition-colors hover:bg-secondary"
                >
                  <FileJson
                    className="size-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 font-medium">
                    {resource.title}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      JSON
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </a>
              ))}
            </div>
          </section>
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
