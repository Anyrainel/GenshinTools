import { X } from "lucide-react";
import type { ReactNode } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

function RuleSection({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t border-border/50 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[2rem_1fr]">
      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
        {index}
      </div>
      <div className="min-w-0 space-y-1.5">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        {children}
      </div>
    </section>
  );
}

function PriorityOrder({ poolLabel }: { poolLabel: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {["S", "A", "B", "C", "D"].map((tier, index) => (
        <div key={tier} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-muted-foreground">{"->"}</span>}
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-semibold text-primary">
            {tier}
          </span>
        </div>
      ))}
      <span className="ml-3 rounded-md border border-border bg-muted/30 px-2 py-1 font-semibold text-muted-foreground">
        <X className="mr-1 inline h-3 w-3 align-[-2px]" />
        {poolLabel}
      </span>
    </div>
  );
}

function PoolSourceFlow({
  poolLabel,
  rankedLabel,
}: {
  poolLabel: string;
  rankedLabel: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-md border border-border bg-muted/30 px-2 py-1 font-semibold text-muted-foreground">
        {poolLabel}
      </span>
      <span className="text-muted-foreground">{"->"}</span>
      <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-semibold text-primary">
        {rankedLabel}
      </span>
    </div>
  );
}

export function ScoreUpHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("accountData.recommendationsHelpTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("accountData.recommendationsHelpDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <RuleSection
            index={1}
            title={t.ui("accountData.recommendationsHelpPriorityTitle")}
            description={t.ui("accountData.recommendationsHelpPriorityDesc")}
          >
            <PriorityOrder
              poolLabel={t.ui("accountData.recommendationsHelpPoolLabel")}
            />
          </RuleSection>

          <RuleSection
            index={2}
            title={t.ui("accountData.recommendationsHelpPoolTitle")}
            description={t.ui("accountData.recommendationsHelpPoolDesc")}
          >
            <PoolSourceFlow
              poolLabel={t.ui("accountData.recommendationsHelpPoolLabel")}
              rankedLabel={t.ui(
                "accountData.recommendationsHelpRankedTierRange"
              )}
            />
          </RuleSection>

          <RuleSection
            index={3}
            title={t.ui("accountData.recommendationsHelpAllocationTitle")}
            description={t.ui("accountData.recommendationsHelpAllocationDesc")}
          />

          <RuleSection
            index={4}
            title={t.ui("accountData.recommendationsHelpUpgradeTitle")}
            description={t.ui("accountData.recommendationsHelpUpgradeDesc")}
          />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
