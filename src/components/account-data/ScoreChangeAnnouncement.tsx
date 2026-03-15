import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useEffect, useState } from "react";

const DISMISS_KEY = "score-v1-300-announced";

function ScoreChangeDialog({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();

  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <ResponsiveDialogHeader className="sr-only">
          <ResponsiveDialogTitle>
            {t.ui("accountData.scoreChangeAnnouncement.title")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("accountData.scoreChangeAnnouncement.detail")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col items-center text-center px-6 pt-8 pb-4 gap-5">
          <span className="text-lg font-bold tracking-wide text-amber-400">
            {t.ui("accountData.scoreChangeAnnouncement.title")}
          </span>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm text-foreground">
              {t.ui("accountData.scoreChangeAnnouncement.headline")}
            </span>
            <span className="text-4xl font-black tracking-tighter bg-gradient-to-b from-amber-200 via-orange-300 to-amber-500 bg-clip-text text-transparent leading-none select-none">
              300
            </span>
          </div>

          <p className="text-sm text-foreground leading-relaxed max-w-[260px]">
            {t.ui("accountData.scoreChangeAnnouncement.detail")}
          </p>

          <p className="text-xs text-muted-foreground">
            {t.ui("accountData.scoreChangeAnnouncement.note")}
          </p>
        </div>

        <ResponsiveDialogFooter className="px-6 pb-6 pt-0">
          <Button onClick={onClose} className="w-full">
            {t.ui("common.gotIt")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/**
 * Auto-shows once for existing users who have account data.
 */
export function ScoreChangeAnnouncement() {
  const [open, setOpen] = useState(false);
  const activeAccount = useAccountStore(getActiveAccount);

  useEffect(() => {
    if (!activeAccount?.data?.characters?.length) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setOpen(true);
  }, [activeAccount]);

  const handleClose = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  return <ScoreChangeDialog open={open} onClose={handleClose} />;
}

/**
 * Manual trigger for the score change dialog (e.g. from settings panel).
 */
export function ScoreChangeDialogTrigger() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
      >
        {t.ui("accountData.scoreChangeAnnouncement.title")}
      </button>
      <ScoreChangeDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
