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
import { CheckCircle2 } from "lucide-react";
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

  const [confirmOpen, setConfirmOpen] = useState(false);

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

    // If a tour is currently active, wait for it to finish before applying
    if (tour.isActive) return;

    // Tour is either done or was never started — safe to apply preset
    shouldPrompt.current = false;
    setHasPromptedForPreset(true);

    (async () => {
      try {
        const presets = getAvailablePresets();
        if (presets.length > 0) {
          const id = presets[0]!;
          const payload = await loadPreset(id);
          subscribePreset(id, payload);
          toast.success(t.ui("app.presetLoaded"));
          setConfirmOpen(true);
        }
      } catch (e) {
        console.error("Failed to load default preset:", e);
        toast.error("Failed to load default preset");
      }
    })();
  }, [ready, tour.isActive, setHasPromptedForPreset, subscribePreset, t]);

  return (
    <ResponsiveDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <ResponsiveDialogContent className="md:max-w-md">
        <ResponsiveDialogHeader className="space-y-4 text-center sm:text-center">
          <div className="flex justify-center pt-2">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/15 rounded-2xl blur-xl scale-110" />
              <div className="relative bg-gradient-to-br from-green-500/10 to-green-500/5 p-4 rounded-2xl border border-green-500/20 shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            </div>
          </div>

          <ResponsiveDialogTitle className="text-xl font-bold tracking-tight">
            {t.ui("app.presetAppliedTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            {t.ui("app.presetAppliedDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="flex justify-center px-4 pt-2 pb-6 sm:pb-4">
          <Button
            onClick={() => setConfirmOpen(false)}
            className="sm:min-w-[7rem]"
          >
            {t.ui("common.gotIt")}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
