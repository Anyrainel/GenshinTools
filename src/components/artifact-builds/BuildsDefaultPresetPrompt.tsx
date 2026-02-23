import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useTour } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getAvailablePresets,
  loadPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import { useBuildsStore } from "@/stores/useBuildsStore";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function BuildsDefaultPresetPrompt() {
  const { t } = useLanguage();
  const tour = useTour();
  const activePresetId = useBuildsStore((state) => state.activePresetId);
  const hasPrompted = useBuildsStore((state) => state.hasPromptedForPreset);
  const setHasPromptedForPreset = useBuildsStore(
    (state) => state.setHasPromptedForPreset
  );
  const subscribePreset = useBuildsStore((state) => state.subscribePreset);
  const clearAll = useBuildsStore((state) => state.clearAll);

  const [dialog1Open, setDialog1Open] = useState(false);
  const [dialog2Open, setDialog2Open] = useState(false);
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);

  // Track whether this instance should show the prompt (decided once on mount)
  const shouldPrompt = useRef(!hasPrompted && !activePresetId);

  // Wait for tours to activate before deciding (tours start after ~800ms)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!shouldPrompt.current) return;
    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!shouldPrompt.current || !ready) return;

    // If a tour is currently active, wait for it to finish before opening
    if (tour.isActive) return;

    // Tour is either done or was never started — safe to open
    setDialog1Open(true);
    setHasPromptedForPreset(true);
    shouldPrompt.current = false;
  }, [ready, tour.isActive, setHasPromptedForPreset]);

  const applyPreset = async (clearFirst: boolean) => {
    try {
      const presets = getAvailablePresets();
      if (presets.length > 0) {
        const id = presets[0]!;
        if (clearFirst) clearAll();
        const payload = await loadPreset(id);
        subscribePreset(id, payload);
        toast.success(t.ui("app.presetLoaded"));
      }
    } catch (e) {
      console.error("Failed to load default preset:", e);
      toast.error("Failed to load default preset");
    }
  };

  const handleYes = () => {
    setDialog1Open(false);

    // Check if the user already has builds
    const { builds } = useBuildsStore.getState();
    const hasExistingBuilds = Object.keys(builds).length > 0;

    if (hasExistingBuilds) {
      setMigrateDialogOpen(true);
    } else {
      applyPreset(false);
    }
  };

  const handleNo = () => {
    setDialog1Open(false);
    setDialog2Open(true);
  };

  const handleMigrateFresh = () => {
    setMigrateDialogOpen(false);
    applyPreset(true);
  };

  const handleMigrateKeep = () => {
    setMigrateDialogOpen(false);
    applyPreset(false);
  };

  return (
    <>
      {/* Dialog 1: Enable default preset? */}
      <ResponsiveDialog
        open={dialog1Open}
        onOpenChange={(open) => {
          if (!open) handleNo();
        }}
      >
        <ResponsiveDialogContent className="md:max-w-md">
          <ResponsiveDialogHeader className="space-y-4 text-center sm:text-center">
            {/* Hero icon area */}
            <div className="flex justify-center pt-2">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl scale-110" />
                <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-2xl border border-primary/20 shadow-sm">
                  <Layers className="w-8 h-8 text-primary" />
                </div>
              </div>
            </div>

            <ResponsiveDialogTitle className="text-xl font-bold tracking-tight">
              {t.ui("app.presetPromptTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {t.ui("app.presetPromptDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* Benefit callout */}
          <div className="mx-auto w-full max-w-sm px-1">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t.ui("app.presetPromptBenefit")}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-center gap-2 px-4 pt-2 pb-6 sm:pb-4">
            <Button
              variant="outline"
              onClick={handleNo}
              className="sm:min-w-[7rem]"
            >
              {t.ui("app.presetPromptNo")}
            </Button>
            <Button
              onClick={handleYes}
              className="sm:min-w-[7rem] gap-1.5 shadow-sm shadow-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t.ui("app.presetPromptYes")}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Dialog 2: Acknowledgement notice (when user declines) */}
      <ResponsiveDialog open={dialog2Open} onOpenChange={setDialog2Open}>
        <ResponsiveDialogContent className="md:max-w-md">
          <ResponsiveDialogHeader className="space-y-4 text-center sm:text-center">
            <div className="flex justify-center pt-2">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/15 rounded-2xl blur-xl scale-110" />
                <div className="relative bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4 rounded-2xl border border-blue-500/20 shadow-sm">
                  <BookOpen className="w-8 h-8 text-blue-400" />
                </div>
              </div>
            </div>

            <ResponsiveDialogTitle className="text-xl font-bold tracking-tight">
              {t.ui("app.presetPromptNoticeTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {t.ui("app.presetPromptNoticeDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="flex justify-center px-4 pt-2 pb-6 sm:pb-4">
            <Button
              onClick={() => setDialog2Open(false)}
              className="sm:min-w-[7rem]"
            >
              {t.ui("app.presetPromptGotIt")}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Dialog 3: Migration choice (when user has existing builds) */}
      <ResponsiveDialog
        open={migrateDialogOpen}
        onOpenChange={setMigrateDialogOpen}
      >
        <ResponsiveDialogContent className="md:max-w-md">
          <ResponsiveDialogHeader className="space-y-4 text-center sm:text-center">
            <div className="flex justify-center pt-2">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/15 rounded-2xl blur-xl scale-110" />
                <div className="relative bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 rounded-2xl border border-amber-500/20 shadow-sm">
                  <RefreshCw className="w-8 h-8 text-amber-400" />
                </div>
              </div>
            </div>

            <ResponsiveDialogTitle className="text-xl font-bold tracking-tight">
              {t.ui("app.presetMigrateTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {t.ui("app.presetMigrateDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex flex-col gap-2 px-4 pt-1 pb-6 sm:pb-4 max-w-sm mx-auto w-full">
            {/* Start Fresh option (default/recommended) */}
            <button
              type="button"
              onClick={handleMigrateFresh}
              className="flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-left group"
            >
              <div className="rounded-md bg-primary/10 p-1.5 mt-0.5 shrink-0">
                <RefreshCw className="w-4 h-4 text-primary transition-colors" />
              </div>
              <div className="space-y-0.5">
                <span className="text-sm font-medium text-foreground">
                  {t.ui("app.presetMigrateFresh")}
                </span>
                <p className="text-xs text-muted-foreground">
                  {t.ui("app.presetMigrateFreshDesc")}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-1.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Keep Builds option */}
            <button
              type="button"
              onClick={handleMigrateKeep}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
            >
              <div className="rounded-md bg-muted p-1.5 mt-0.5 shrink-0">
                <Layers className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="space-y-0.5">
                <span className="text-sm font-medium text-foreground">
                  {t.ui("app.presetMigrateKeep")}
                </span>
                <p className="text-xs text-muted-foreground">
                  {t.ui("app.presetMigrateKeepDesc")}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
