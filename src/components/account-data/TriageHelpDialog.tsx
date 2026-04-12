import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { SENTIMENT_BADGE, TRIAGE_TIER_COLORS, cn } from "@/lib/utils";
import { Lock, ShieldAlert, Zap } from "lucide-react";

const TIER_KEY = {
  P: "triage.tier.P",
  Q: "triage.tier.Q",
  N: "triage.tier.N",
  T: "triage.tier.T",
} as const;

const TIER_COLOR = TRIAGE_TIER_COLORS.text;

export function TriageHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const tiers = [
    {
      tier: "P" as const,
      border: "border-amber-500/25",
      descKey: "triage.help.tierPrime",
      badges: [
        { key: "triage.help.badgeAlwaysLock", cls: SENTIMENT_BADGE.positive },
      ],
    },
    {
      tier: "Q" as const,
      border: "border-purple-500/25",
      descKey: "triage.help.tierSolid",
      badges: [
        { key: "triage.label.lock", cls: SENTIMENT_BADGE.positive },
        { key: "triage.help.badgeOverSupply", cls: SENTIMENT_BADGE.negative },
      ],
    },
    {
      tier: "N" as const,
      border: "border-blue-500/25",
      descKey: "triage.help.tierFiller",
      badges: [
        { key: "triage.label.unlock", cls: SENTIMENT_BADGE.negative },
        { key: "triage.help.badgeUnderSupply", cls: SENTIMENT_BADGE.positive },
      ],
    },
    {
      tier: "T" as const,
      border: "border-zinc-500/25",
      descKey: "triage.help.tierFodder",
      badges: [
        { key: "triage.help.badgeAlwaysFodder", cls: SENTIMENT_BADGE.negative },
      ],
    },
  ];

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("triage.help.title")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("triage.help.desc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* How it decides */}
          <section>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1.5">
              {t.ui("triage.help.howTitle")}
            </h4>
            <ul className="space-y-0.5 text-xs text-foreground/80 list-disc list-outside ml-4">
              <li>{t.ui("triage.help.howMatch")}</li>
              <li>{t.ui("triage.help.howRarity")}</li>
              <li>{t.ui("triage.help.howFactors")}</li>
            </ul>
          </section>

          {/* Rarity tiers */}
          <section>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">
              {t.ui("triage.help.tierTitle")}
            </h4>
            <div className="space-y-1">
              {tiers.map(({ tier, border, descKey, badges }) => (
                <div
                  key={tier}
                  className={cn("rounded-md border px-2.5 py-1.5", border)}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-sm font-bold", TIER_COLOR[tier])}>
                      {t.ui(TIER_KEY[tier])}
                    </span>
                    {badges.map(({ key, cls }) => (
                      <span
                        key={key}
                        className={cn(
                          "text-[10px] leading-none px-1.5 py-0.5 rounded border",
                          cls
                        )}
                      >
                        {t.ui(key)}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t.ui(descKey)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-foreground/80 mt-2">
              <span className="font-semibold text-foreground">
                {t.ui("triage.triageMode")}
              </span>{" "}
              {t.ui("triage.help.tierLooseNote")}
            </p>
          </section>

          {/* Supply & demand — visual bar diagram */}
          <section>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">
              {t.ui("triage.help.supplyTitle")}
            </h4>
            <div className="space-y-1 text-[10px] font-medium leading-none">
              {/* Row 1: full rarity spectrum */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 w-14" />
                <div className="flex-1 flex h-6 rounded overflow-hidden">
                  <div className="flex-[2] bg-amber-500/25 text-amber-300 flex items-center justify-center">
                    {t.ui("triage.tier.P")}
                  </div>
                  <div className="flex-[5] bg-purple-500/25 text-purple-300 flex items-center justify-center">
                    {t.ui("triage.tier.Q")}
                  </div>
                  <div className="flex-[5] bg-blue-500/20 text-blue-300 flex items-center justify-center">
                    {t.ui("triage.tier.N")}
                  </div>
                  <div className="flex-[2] bg-zinc-500/15 text-zinc-400 flex items-center justify-center">
                    {t.ui("triage.tier.T")}
                  </div>
                </div>
              </div>
              {/* Row 2: under-supply — all locked, small backup, demand line past it */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 w-14 text-right text-green-400">
                  {t.ui("triage.help.supplyUnder")}
                </span>
                <div className="flex-1 flex h-5 rounded overflow-hidden">
                  <div className="flex-[7] bg-green-500/20 text-green-300 flex items-center justify-center">
                    <Lock className="w-2.5 h-2.5" />
                  </div>
                  <div className="flex-[1] bg-emerald-500/10 text-emerald-400/70 border-l border-dashed border-emerald-400/30 border-r border-r-foreground flex items-center justify-center">
                    {t.ui("triage.help.supplyBackup")}
                  </div>
                  <div className="flex-[2.5] bg-zinc-500/10" />
                  <div className="flex-[3.5] bg-zinc-500/10 text-zinc-500 flex items-center justify-center border-l-2 border-foreground">
                    {t.ui("triage.help.supplyRecycle")}
                  </div>
                </div>
              </div>
              {/* Row 3: over-supply — demand mid-bar, small margin after */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 w-14 text-right text-red-400">
                  {t.ui("triage.help.supplyOver")}
                </span>
                <div className="flex-1 flex h-5 rounded overflow-hidden">
                  <div className="flex-[5] bg-green-500/20 text-green-300 flex items-center justify-center border-r-2 border-foreground">
                    <Lock className="w-2.5 h-2.5" />
                  </div>
                  <div className="flex-[1] bg-emerald-500/10 text-emerald-400/70 border-l border-dashed border-emerald-400/30 border-r border-r-foreground flex items-center justify-center">
                    {t.ui("triage.help.supplyMargin")}
                  </div>
                  <div className="flex-[8] bg-zinc-500/10 text-zinc-500 flex items-center justify-center">
                    {t.ui("triage.help.supplyRecycle")}
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground ml-[3.875rem]">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-0.5 h-3 bg-foreground rounded-full" />
                  = {t.ui("triage.help.supplyDemand")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-0.5 h-3 border-r border-dashed border-foreground" />
                  = {t.ui("triage.help.supplyKeep")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t.ui("triage.help.supplyCustomizable")}
              </p>
            </div>
          </section>

          {/* Exceptions */}
          <section>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">
              {t.ui("triage.help.spTitle")}
            </h4>
            <div className="space-y-1.5">
              <div className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">
                    {t.ui("triage.help.spOverride")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {(
                    [
                      { key: "triage.sp.SP1" },
                      { key: "triage.sp.SP5" },
                      { key: "triage.sp.FLEX" },
                    ] as const
                  ).map(({ key }) => (
                    <span key={key} className="text-xs text-muted-foreground">
                      · {t.ui(key)}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  · {t.ui("triage.help.spSP6Detail")}
                </p>
              </div>
              <div className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">
                    {t.ui("triage.help.spProtect")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {(
                    [
                      { key: "triage.sp.SP3" },
                      { key: "triage.sp.SP4" },
                    ] as const
                  ).map(({ key }) => (
                    <span key={key} className="text-xs text-muted-foreground">
                      · {t.ui(key)}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  <span className="font-medium text-foreground/80">
                    {t.ui("triage.help.spHighLevelOff")}:
                  </span>{" "}
                  {t.ui("triage.help.spHighLevelOffDetail")}
                </p>
              </div>
            </div>
          </section>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
