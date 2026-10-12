import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Database,
  Download,
  Filter,
  HelpCircle,
  Monitor,
  Plus,
  Smartphone,
  Users,
} from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useGreetingStore } from "@/stores/useGreetingStore";

const AccountDataPreview = lazy(() => import("./previews/AccountDataPreview"));
const TeamCompPreview = lazy(() => import("./previews/TeamCompPreview"));
const BuildsPreview = lazy(() => import("./previews/BuildsPreview"));

type StepProps = { t: ReturnType<typeof useLanguage>["t"] };

export default function WelcomeGuide({
  latestDate,
  onDismiss,
}: {
  latestDate: string;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const completeOnboarding = useGreetingStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const chapters = [
    { id: "account", title: t.ui("app.navAccountData"), icon: Database },
    { id: "builds", title: t.ui("app.navArtifactFilter"), icon: Filter },
    { id: "teams", title: t.ui("app.navTeamComp"), icon: Crosshair },
  ];
  const handleClose = () => {
    completeOnboarding(latestDate);
    onDismiss();
  };
  function navigate(index: number) {
    setStep(index);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }
  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && handleClose()}>
      <ResponsiveDialogContent className="flex max-h-[90dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)] sm:max-w-5xl">
        <div className="shrink-0 border-b border-border px-4 pb-3 pt-5 sm:px-6">
          <ResponsiveDialogHeader className="p-0 text-left">
            <ResponsiveDialogTitle>
              {t.ui("greeting.getStarted")}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <nav
            aria-label={t.ui("greeting.guideContents")}
            className="mt-4 grid grid-cols-3 gap-2"
          >
            {chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                type="button"
                aria-current={step === index ? "step" : undefined}
                onClick={() => navigate(index)}
                className={cn(
                  "flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  step === index
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-accent"
                )}
              >
                <chapter.icon
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <span>{chapter.title}</span>
              </button>
            ))}
          </nav>
        </div>
        <div
          ref={contentRef}
          className="@container min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
        >
          <h2 className="sr-only">{chapters[step].title}</h2>
          <Suspense fallback={<div className="min-h-48" aria-busy="true" />}>
            {step === 0 && <StepAccountData t={t} />}
            {step === 1 && <BuildsPreview t={t} />}
            {step === 2 && <StepTeams t={t} />}
          </Suspense>
          {step === chapters.length - 1 && (
            <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm leading-6">
              <HelpCircle
                className="mt-1 size-4 shrink-0 text-primary"
                aria-hidden
              />
              {t.ui("greeting.helpDesc")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-4 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(step - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t.ui("common.previous")}
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {step + 1} / {chapters.length}
          </span>
          <Button
            size="sm"
            onClick={() =>
              step === chapters.length - 1 ? handleClose() : navigate(step + 1)
            }
            className="gap-1"
          >
            {step === chapters.length - 1
              ? t.ui("greeting.letsGo")
              : t.ui("common.next")}
            {step < chapters.length - 1 && (
              <ChevronRight className="size-4" aria-hidden />
            )}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function StepAccountData({ t }: StepProps) {
  return (
    <div className="grid min-w-0 items-start gap-5 @min-[56rem]:grid-cols-[1.3fr_1fr]">
      <AccountDataPreview t={t} />
      <div className="min-w-0 space-y-4">
        <div className="rounded-xl border border-border bg-gradient-card p-4">
          <div className="mb-4 flex flex-wrap gap-2" aria-hidden="true">
            <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Users className="size-4" />
              {t.ui("accountData.accounts")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm">
              <Download className="size-4" />
              {t.ui("import.action")}
            </span>
          </div>
          <p className="text-sm leading-6">
            {t.ui("greeting.step1ActionHint")}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <Monitor className="mb-2 size-5 text-primary" aria-hidden />
              <p className="text-xs font-semibold">
                {t.ui("import.goodTitle")}
              </p>
              <p className="mt-1 text-xs text-primary">
                {t.ui("import.recommended")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <Smartphone className="mb-2 size-5 text-primary" aria-hidden />
              <p className="text-xs font-semibold">{t.ui("import.uidTitle")}</p>
            </div>
          </div>
        </div>
        <p className="text-sm leading-6">{t.ui("greeting.importCoverage")}</p>
      </div>
    </div>
  );
}

function StepTeams({ t }: StepProps) {
  return (
    <div className="grid min-w-0 items-start gap-5 @min-[56rem]:grid-cols-[1.3fr_1fr]">
      <TeamCompPreview t={t} />
      <div className="min-w-0 space-y-4">
        <div className="rounded-xl border border-border bg-gradient-card p-4">
          <div className="mb-4 flex flex-wrap gap-2" aria-hidden="true">
            <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Download className="size-4" />
              {t.ui("import.action")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm">
              <Plus className="size-4" />
              {t.ui("teamComp.newTeamStart")}
            </span>
          </div>
          <p className="text-sm leading-6">
            {t.ui("greeting.step3ActionHint")}
          </p>
          <div
            className="mt-4 grid grid-cols-4 gap-2 pointer-events-none select-none justify-items-center"
            ref={(element) => {
              if (element) element.inert = true;
            }}
          >
            {(
              [
                ["mavuika", "a_thousand_blazing_suns", "obsidian_codex"],
                [
                  "citlali",
                  "starcallers_watch",
                  "scroll_of_the_hero_of_cinder_city",
                ],
                ["xilonen", "peak_patrol_song", "instructor"],
                ["kaedehara_kazuha", "freedomsworn", "viridescent_venerer"],
              ] as const
            ).map(([characterId, weaponId, artifactSetId]) => (
              <div
                key={characterId}
                className="flex flex-col items-center gap-2"
              >
                <ItemIcon characterId={characterId} size="sm" />
                <ItemIcon weaponId={weaponId} size="sm" />
                <ItemIcon
                  artifactSetId={artifactSetId}
                  slot="flower"
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm leading-6">{t.ui("greeting.teamWorkflow")}</p>
      </div>
    </div>
  );
}
