import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useGreetingStore } from "@/stores/useGreetingStore";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Database,
  Download,
  Filter,
  HelpCircle,
  Monitor,
  MoreVertical,
  Plus,
  Smartphone,
  Star,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Suspense, lazy, useState } from "react";

const AccountDataPreview = lazy(() => import("./previews/AccountDataPreview"));
const TeamCompPreview = lazy(() => import("./previews/TeamCompPreview"));
const BuildsPreview = lazy(() => import("./previews/BuildsPreview"));

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

  const totalSteps = 4;

  const next = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else handleClose();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && handleClose()}>
      <ResponsiveDialogContent className="max-w-3xl p-0 gap-0">
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
        <div className="px-6 pt-6 pb-4 flex flex-col overflow-y-auto max-h-[80vh]">
          {step === 0 && (
            <Suspense fallback={<StepLoading />}>
              <StepAccountData t={t} />
            </Suspense>
          )}
          {step === 1 && (
            <Suspense fallback={<StepLoading />}>
              <StepBuilds t={t} />
            </Suspense>
          )}
          {step === 2 && (
            <Suspense fallback={<StepLoading />}>
              <StepTeams t={t} />
            </Suspense>
          )}
          {step === 3 && <StepHelp t={t} />}
        </div>

        {/* Footer: dots + nav */}
        <div className="flex items-center justify-between px-6 pb-5 pt-2 border-t border-border/50">
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
                    : "bg-border hover:bg-muted-foreground"
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
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm min-h-[200px]">
      ...
    </div>
  );
}

// ── Step Components ──

type StepProps = { t: ReturnType<typeof useLanguage>["t"] };

/** Step 1: Account Data — import actions + 5-tab feature preview */
function StepAccountData({ t }: StepProps) {
  return (
    <>
      {/* Title */}
      <div className="flex items-center gap-2 mb-1">
        <Database className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">{t.ui("app.navAccountData")}</h2>
      </div>

      {/* Action area: centered buttons with amber highlight + import method cards */}
      <div className="mb-3">
        {/* Amber-outlined box with the real action buttons */}
        <div className="flex justify-center mb-2">
          <div className="inline-flex items-center gap-2 rounded-lg border-2 border-amber-500/50 bg-amber-500/5 px-4 py-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 pointer-events-none"
            >
              <Users className="size-4" />
              {t.ui("accountData.accounts")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 pointer-events-none"
            >
              <Download className="size-4" />
              {t.ui("import.action")}
            </Button>
          </div>
        </div>

        {/* Arrow pointing down to import methods */}
        <div className="flex justify-center mb-2">
          <ChevronDown className="size-5 text-amber-500/70" />
        </div>

        {/* Mini import method cards — mimicking AccountImportControl dialog */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border-2 border-amber-500/50 p-2">
          {/* GOOD import card (recommended) */}
          <div className="relative rounded-lg border border-primary/40 bg-primary/[0.04] p-2.5">
            <span className="absolute -top-2 right-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold">
              <Star className="size-2.5" />
              {t.ui("import.recommended")}
            </span>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                <Monitor className="size-4 text-primary" />
              </div>
              <span className="text-xs font-semibold">
                {t.ui("import.goodTitle")}
              </span>
            </div>
          </div>
          {/* UID import card */}
          <div className="rounded-lg border border-border bg-muted/20 p-2.5">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-muted p-1.5 shrink-0">
                <Smartphone className="size-4 text-muted-foreground" />
              </div>
              <span className="text-xs font-semibold">
                {t.ui("import.uidTitle")}
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-foreground mt-2">
          {t.ui("greeting.step1ActionHint")}
        </p>
      </div>

      {/* Benefits: auto-rotating tab previews */}
      <AccountDataPreview t={t} />
    </>
  );
}

/** Step 2: Builds — BuildCard preview + benefits */
function StepBuilds({ t }: StepProps) {
  return (
    <>
      {/* Title */}
      <div className="flex items-center gap-2 mb-1">
        <Filter className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">
          {t.ui("app.navArtifactFilter")}
        </h2>
      </div>

      {/* BuildCard preview + description + benefits */}
      <BuildsPreview t={t} />
    </>
  );
}

/** Step 3: Team DMG — team actions + 4-tab feature preview */
function StepTeams({ t }: StepProps) {
  return (
    <>
      {/* Title */}
      <div className="flex items-center gap-2 mb-1">
        <Crosshair className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">{t.ui("app.navTeamComp")}</h2>
      </div>

      {/* Action area: centered buttons with amber border + team grid */}
      <div className="mb-3">
        {/* Amber-outlined box with action buttons */}
        <div className="flex justify-center mb-2">
          <div className="inline-flex items-center gap-2 rounded-lg border-2 border-amber-500/50 bg-amber-500/5 px-4 py-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 pointer-events-none"
            >
              <Download className="size-4" />
              {t.ui("import.action")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 pointer-events-none"
            >
              <Plus className="size-4" />
              {t.ui("teamComp.newTeamStart")}
            </Button>
          </div>
        </div>

        {/* Arrow pointing down to team grid */}
        <div className="flex justify-center mb-2">
          <ChevronDown className="size-5 text-amber-500/70" />
        </div>

        {/* Example team grid — 4×3: character + weapon + artifact */}
        <div className="flex justify-center mb-2">
          <div className="inline-grid grid-cols-4 gap-2 pointer-events-none select-none justify-items-center rounded-lg border-2 border-amber-500/50 p-2">
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
            ).map(([charId, weaponId, artifactSetId]) => (
              <div key={charId} className="flex flex-col items-center gap-2">
                <ItemIcon characterId={charId} size="sm" />
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

        <p className="text-sm text-foreground">
          {t.ui("greeting.step3ActionHint")}
        </p>
      </div>

      {/* Benefits: auto-rotating tab previews */}
      <TeamCompPreview t={t} />
    </>
  );
}

/** Step 4: Need Help? — menu → help visual */
function StepHelp({ t }: StepProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">{t.ui("greeting.helpTitle")}</h2>
      </div>
      <p className="text-sm text-foreground mb-4">
        {t.ui("greeting.helpDesc")}
      </p>

      {/* Simulated AppBar actions + dropdown menu */}
      <div className="flex-1 flex items-center justify-center">
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          {/* Simulated top-right action bar */}
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 pointer-events-none"
            >
              <Download className="size-4" />
              {t.ui("import.action")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 pointer-events-none"
            >
              <Upload className="size-4" />
              {t.ui("export.action")}
            </Button>
            <div className="size-8 rounded-md bg-muted border border-border flex items-center justify-center">
              <MoreVertical className="size-4 text-foreground" />
            </div>
          </div>

          {/* Simulated open dropdown menu */}
          <div className="ml-auto w-fit rounded-md border border-border bg-popover shadow-md p-1 space-y-0.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border-2 border-amber-500/60 bg-amber-500/10">
              <HelpCircle className="size-4 text-primary" />
              <span className="text-sm font-medium">
                {t.ui("buttons.help")}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-muted-foreground">
              <span className="text-sm">{t.ui("theme.switcherButton")}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-muted-foreground">
              <span className="text-sm">{t.ui("app.language")}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
