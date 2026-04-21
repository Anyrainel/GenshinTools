import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

export function ResourceHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("evaluation.helpTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("evaluation.helpDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Baseline */}
          <section>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1.5">
              {t.ui("evaluation.helpBaselineTitle")}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.ui("evaluation.helpBaselineDesc")}
            </p>
          </section>

          {/* Expected score */}
          <section>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1.5">
              {t.ui("evaluation.helpExpectedTitle")}
            </h4>
            <div className="space-y-1.5">
              <div className="rounded-md border border-violet-500/25 px-2.5 py-1.5">
                <span className="text-xs font-bold text-violet-400">
                  {t.ui("evaluation.suggestCraft")}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {t.ui("evaluation.helpExpectedCraftDesc")}
                </p>
              </div>
              <div className="rounded-md border border-amber-500/25 px-2.5 py-1.5">
                <span className="text-xs font-bold text-amber-400">
                  {t.ui("evaluation.suggestReroll")}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {t.ui("evaluation.helpExpectedRerollDesc")}
                </p>
              </div>
              <div className="rounded-md border border-sky-500/25 px-2.5 py-1.5">
                <span className="text-xs font-bold text-sky-400">
                  {t.ui("evaluation.suggestLevelup")}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {t.ui("evaluation.helpExpectedLevelupDesc")}
                </p>
              </div>
            </div>
          </section>

          {/* Metrics */}
          <section>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1.5">
              {t.ui("evaluation.helpMetricsTitle")}
            </h4>
            <div className="space-y-1.5">
              <div className="rounded-md border border-emerald-500/25 px-2.5 py-1.5">
                <span className="text-xs font-bold text-emerald-400">
                  {t.ui("evaluation.gainLabel")}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {t.ui("evaluation.helpGainDesc")}
                </p>
              </div>
              <div className="rounded-md border border-amber-500/25 px-2.5 py-1.5">
                <span className="text-xs font-bold text-amber-400">
                  {t.ui("evaluation.pUpgradeLabel")}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {t.ui("evaluation.helpPUpgradeDesc")}
                </p>
              </div>
            </div>
          </section>

          {/* Filtering */}
          <section>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1.5">
              {t.ui("evaluation.helpThresholdsTitle")}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.ui("evaluation.helpThresholdsDesc")}
            </p>
          </section>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
