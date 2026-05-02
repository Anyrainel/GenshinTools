import { Lock, ShieldAlert, Unlock, Zap } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { SENTIMENT_BADGE, TRIAGE_TIER_COLORS } from "../shared/colors";

const TIER_KEY = {
  prime: "triage.tier.prime",
  solid: "triage.tier.solid",
  filler: "triage.tier.filler",
  fodder: "triage.tier.fodder",
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
      tier: "prime" as const,
      border: "border-amber-500/25",
      descKey: "triage.help.tierPrime",
      badges: [
        { key: "triage.help.badgeAlwaysLock", cls: SENTIMENT_BADGE.positive },
      ],
    },
    {
      tier: "solid" as const,
      border: "border-purple-500/25",
      descKey: "triage.help.tierSolid",
      badges: [
        { key: "triage.label.lock", cls: SENTIMENT_BADGE.positive },
        { key: "triage.help.badgeOverSupply", cls: SENTIMENT_BADGE.negative },
      ],
    },
    {
      tier: "filler" as const,
      border: "border-blue-500/25",
      descKey: "triage.help.tierFiller",
      badges: [
        { key: "triage.label.unlock", cls: SENTIMENT_BADGE.negative },
        { key: "triage.help.badgeUnderSupply", cls: SENTIMENT_BADGE.positive },
      ],
    },
    {
      tier: "fodder" as const,
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
                    {t.ui("triage.tier.prime")}
                  </div>
                  <div className="flex-[5] bg-purple-500/25 text-purple-300 flex items-center justify-center">
                    {t.ui("triage.tier.solid")}
                  </div>
                  <div className="flex-[5] bg-blue-500/20 text-blue-300 flex items-center justify-center">
                    {t.ui("triage.tier.filler")}
                  </div>
                  <div className="flex-[2] bg-zinc-500/15 text-zinc-400 flex items-center justify-center">
                    {t.ui("triage.tier.fodder")}
                  </div>
                </div>
              </div>
              {/* Row 2: over-supply — demand mid-bar, small margin after */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 w-14 text-right text-foreground">
                  {t.ui("triage.help.supplyOver")}
                </span>
                <div className="relative flex-1 h-6 rounded overflow-hidden bg-zinc-500/10">
                  <div
                    className="absolute inset-y-0 left-0 bg-green-500/20 text-green-300 flex items-center justify-center"
                    style={{ width: "39.286%" }}
                  >
                    <Lock className="w-2.5 h-2.5" />
                  </div>
                  <div
                    className="absolute inset-y-0 border-l border-foreground"
                    style={{ left: "39.286%" }}
                  />
                  <div
                    className="absolute inset-y-0 bg-emerald-500/10 text-emerald-400 flex items-center justify-center px-1 whitespace-nowrap"
                    style={{ left: "39.286%", width: "21.428%" }}
                  >
                    {t.ui("triage.help.supplyMargin")}
                  </div>
                  <div
                    className="absolute inset-y-0 border-l border-dashed border-foreground"
                    style={{ left: "60.714%" }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-red-500/20 text-red-400 flex items-center justify-center"
                    style={{ left: "60.714%" }}
                  >
                    <Unlock className="w-2.5 h-2.5" aria-hidden="true" />
                    <span className="sr-only">
                      {t.ui("triage.help.supplyRecycle")}
                    </span>
                  </div>
                </div>
              </div>
              {/* Row 3: under-supply — all locked, filler cap, demand line past it */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 w-14 text-right text-foreground">
                  {t.ui("triage.help.supplyUnder")}
                </span>
                <div className="relative flex-1 h-6 rounded overflow-hidden bg-zinc-500/10">
                  <div
                    className="absolute inset-y-0 left-0 bg-green-500/20 text-green-300 flex items-center justify-center"
                    style={{ width: "50%" }}
                  >
                    <Lock className="w-2.5 h-2.5" />
                  </div>
                  <div
                    className="absolute inset-y-0 bg-emerald-500/10 text-emerald-400 flex items-center justify-center px-1 whitespace-nowrap"
                    style={{ left: "50%", width: "14.286%" }}
                  >
                    {t.ui("triage.help.supplyBackup")}
                  </div>
                  <div
                    className="absolute inset-y-0 border-l border-dashed border-foreground"
                    style={{ left: "64.286%" }}
                  />
                  <div
                    className="absolute inset-y-0 bg-red-500/20"
                    style={{ left: "64.286%", width: "14.285%" }}
                  />
                  <div
                    className="absolute inset-y-0 border-l border-foreground"
                    style={{ left: "78.571%" }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-red-500/20 text-red-400 flex items-center justify-center"
                    style={{ left: "78.571%" }}
                  >
                    <Unlock className="w-2.5 h-2.5" aria-hidden="true" />
                    <span className="sr-only">
                      {t.ui("triage.help.supplyRecycle")}
                    </span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-0.5 h-3 bg-foreground rounded-full" />
                  = {t.ui("triage.help.supplyDemand")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-0.5 h-3 border-r border-dashed border-foreground" />
                  = {t.ui("triage.help.supplyKeep")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {t.ui("triage.help.setSlotFloorDetail")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.ui("triage.help.backupAmountDetail")}
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
                      { key: "triage.sp.supportSetErHoard" },
                      { key: "triage.sp.doubleCrit" },
                      { key: "triage.sp.offPiecePattern" },
                    ] as const
                  ).map(({ key }) => (
                    <span key={key} className="text-xs text-muted-foreground">
                      · {t.ui(key)}
                    </span>
                  ))}
                </div>
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
                      { key: "triage.sp.levelProtected" },
                      { key: "triage.sp.equippedProtected" },
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
