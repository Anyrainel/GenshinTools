import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getAvailablePresets,
  loadPreset,
} from "@/lib/artifact-builds/buildPresetRegistry";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function BuildsDefaultPresetPrompt() {
  const { t } = useLanguage();
  const activePresetId = useBuildsStore((state) => state.activePresetId);
  const hasPrompted = useBuildsStore((state) => state.hasPromptedForPreset);
  const setHasPromptedForPreset = useBuildsStore(
    (state) => state.setHasPromptedForPreset
  );
  const subscribePreset = useBuildsStore((state) => state.subscribePreset);

  const [dialog1Open, setDialog1Open] = useState(false);
  const [dialog2Open, setDialog2Open] = useState(false);

  useEffect(() => {
    // Only prompt if they have never been prompted AND they have no active preset
    if (!hasPrompted && !activePresetId) {
      setDialog1Open(true);
      setHasPromptedForPreset(true);
    }
  }, [hasPrompted, activePresetId, setHasPromptedForPreset]);

  const handleYes = async () => {
    setDialog1Open(false);
    try {
      const presets = getAvailablePresets();
      if (presets.length > 0) {
        const id = presets[0]!;
        const payload = await loadPreset(id);
        subscribePreset(id, payload);
        toast.success(t.ui("app.presetLoaded"));
      }
    } catch (e) {
      console.error("Failed to load default preset:", e);
      toast.error("Failed to load default preset");
    }
  };

  const handleNo = () => {
    setDialog1Open(false);
    setDialog2Open(true);
  };

  return (
    <>
      <ResponsiveDialog
        open={dialog1Open}
        onOpenChange={(open) => {
          if (!open) handleNo();
        }}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t.ui("app.presetPromptTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t.ui("app.presetPromptDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="flex justify-end gap-2 p-4 pt-2 pb-6 sm:pb-4">
            <Button variant="outline" onClick={handleNo}>
              {t.ui("app.presetPromptNo")}
            </Button>
            <Button onClick={handleYes}>{t.ui("app.presetPromptYes")}</Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={dialog2Open} onOpenChange={setDialog2Open}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t.ui("app.presetPromptNoticeTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t.ui("app.presetPromptNoticeDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="flex justify-end p-4 pt-2 pb-6 sm:pb-4">
            <Button onClick={() => setDialog2Open(false)}>
              {t.ui("app.presetPromptGotIt")}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
