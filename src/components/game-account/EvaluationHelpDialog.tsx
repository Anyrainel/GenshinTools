import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Switch } from "@/components/ui/switch";
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
      <div className="min-w-0 space-y-1">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        {children}
      </div>
    </section>
  );
}

function InclusionLegend({
  onLabel,
  offLabel,
}: {
  onLabel: string;
  offLabel: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <div className="flex items-center gap-4 rounded-md border border-border/50 bg-muted/20 p-2 text-xs">
        <Switch
          checked
          aria-label={onLabel}
          className="pointer-events-none flex-shrink-0 data-[state=checked]:bg-primary/70"
        />
        <span className="flex items-center gap-1.5">
          <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
          <span className="font-medium text-foreground">{onLabel}</span>
        </span>
      </div>
      <div className="flex items-center gap-4 rounded-md border border-border/50 bg-muted/20 p-2 text-xs">
        <Switch
          checked={false}
          aria-label={offLabel}
          className="pointer-events-none flex-shrink-0 data-[state=checked]:bg-primary/70"
        />
        <span className="flex items-center gap-1.5">
          <X className="h-4 w-4 flex-shrink-0 text-destructive" />
          <span className="font-medium text-foreground">{offLabel}</span>
        </span>
      </div>
    </div>
  );
}

function NormalizationScale({ label }: { label: string }) {
  const entries = [
    ["90-100", "100"],
    ["70-89", "75"],
    ["50-69", "50"],
    ["1-50", "0"],
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <span className="text-sm font-semibold text-muted-foreground">
        {label}
      </span>
      {entries.map(([range, value]) => (
        <div key={range} className="flex items-center gap-1.5">
          <span className="rounded-md border border-border bg-muted/30 px-2 py-1.5 font-medium text-foreground">
            {range}
          </span>
          <span className="text-sm font-semibold leading-none text-muted-foreground">
            {"→"}
          </span>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 font-semibold text-primary">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EvaluationHelpDialog({
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
            {t.ui("evaluation.evalHelpTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("evaluation.evalHelpDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <RuleSection
            index={1}
            title={t.ui("evaluation.evalHelpBuildsTitle")}
            description={t.ui("evaluation.evalHelpBuildsDesc")}
          >
            <InclusionLegend
              onLabel={t.ui("evaluation.evalHelpSwitchOn")}
              offLabel={t.ui("evaluation.evalHelpSwitchOff")}
            />
          </RuleSection>

          <RuleSection
            index={2}
            title={t.ui("evaluation.evalHelpMergeTitle")}
            description={t.ui("evaluation.evalHelpMergeDesc")}
          >
            <NormalizationScale
              label={t.ui("evaluation.evalHelpWeightLabel")}
            />
          </RuleSection>

          <RuleSection
            index={3}
            title={t.ui("evaluation.evalHelpCompetitionTitle")}
            description={t.ui("evaluation.evalHelpCompetitionDesc")}
          />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
