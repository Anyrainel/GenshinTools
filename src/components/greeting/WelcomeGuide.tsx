import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useGreetingStore } from "@/stores/useGreetingStore";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Database,
  Filter,
  HelpCircle,
  Lightbulb,
  Lock,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Suspense, lazy, useState } from "react";

const AccountDataPreview = lazy(() => import("./previews/AccountDataPreview"));
const TeamCompPreview = lazy(() => import("./previews/TeamCompPreview"));

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

  const handleClose = () => {
    completeOnboarding(latestDate);
    onDismiss();
  };

  const totalSteps = 6;

  const next = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else handleClose();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && handleClose()}>
      <ResponsiveDialogContent className="max-w-xl p-0 gap-0">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-10 size-7"
          onClick={handleClose}
        >
          <X className="size-4" />
        </Button>

        {/* Content area */}
        <div className="px-6 pt-6 pb-4 min-h-[280px] flex flex-col">
          {step === 0 && <StepImport t={t} />}
          {step === 1 && (
            <Suspense fallback={<StepLoading />}>
              <StepAccountOverview t={t} />
            </Suspense>
          )}
          {step === 2 && <StepCustomize t={t} />}
          {step === 3 && <StepTeams t={t} />}
          {step === 4 && (
            <Suspense fallback={<StepLoading />}>
              <StepTeamsOverview t={t} />
            </Suspense>
          )}
          {step === 5 && <StepHelp t={t} />}
        </div>

        {/* Footer: dots + nav */}
        <div className="flex items-center justify-between px-6 pb-5 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            {t.ui("common.previous")}
          </Button>

          {/* Step dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i === step
                    ? "bg-primary"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          <Button size="sm" onClick={next} className="gap-1">
            {step === totalSteps - 1
              ? t.ui("greeting.letsGo")
              : t.ui("common.next")}
            {step < totalSteps - 1 && <ChevronRight className="size-4" />}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function StepLoading() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      ...
    </div>
  );
}

// ── Step Components ──

type StepProps = { t: ReturnType<typeof useLanguage>["t"] };

function StepImport({ t }: StepProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Database className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">
          {t.ui("greeting.importTitle")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.ui("greeting.importDesc")}
      </p>
      <div className="space-y-3 flex-1">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <Upload className="size-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {t.ui("greeting.importGoodLabel")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <Users className="size-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {t.ui("greeting.importUidLabel")}
            </p>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {t.ui("greeting.importLater")}
      </p>
    </>
  );
}

function StepAccountOverview({ t }: StepProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Database className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">{t.ui("app.navAccountData")}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.ui("greeting.accountOverviewDesc")}
      </p>
      <AccountDataPreview t={t} />
    </>
  );
}

function StepCustomize({ t }: StepProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Filter className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">
          {t.ui("app.navArtifactFilter")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.ui("greeting.customizeDesc")}
      </p>
      <div className="space-y-2.5 flex-1">
        {[
          { icon: BarChart3, label: t.ui("greeting.customizeBenefitScoring") },
          {
            icon: Lightbulb,
            label: t.ui("greeting.customizeBenefitRecommendations"),
          },
          { icon: Lock, label: t.ui("greeting.customizeBenefitLock") },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
          >
            <Icon className="size-5 text-primary shrink-0" />
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function StepTeams({ t }: StepProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Crosshair className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">{t.ui("app.navTeamComp")}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.ui("greeting.teamsDesc")}
      </p>
      {/* Simplified 4-character team slot layout */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="size-16 rounded-xl bg-muted/50 border-2 border-dashed border-border flex items-center justify-center"
            >
              <Users className="size-6 text-muted-foreground/50" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StepTeamsOverview({ t }: StepProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Crosshair className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">
          {t.ui("greeting.teamsOverviewTitle")}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.ui("greeting.teamsOverviewDesc")}
      </p>
      <TeamCompPreview t={t} />
    </>
  );
}

function StepHelp({ t }: StepProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">{t.ui("greeting.helpTitle")}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.ui("greeting.helpDesc")}
      </p>
      <div className="flex-1 flex items-center justify-center">
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-foreground">
            {t.ui("greeting.helpMenuHint")}
          </p>
        </div>
      </div>
    </>
  );
}
