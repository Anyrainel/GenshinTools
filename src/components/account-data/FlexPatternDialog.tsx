import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Switch } from "@/components/ui/switch";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { FlexPattern, TriageSettings } from "@/lib/account-data/triage";
import { cn } from "@/lib/utils";

export function FlexPatternDialog({
  open,
  onOpenChange,
  flexPatterns,
  settings,
  onSettingsChange,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flexPatterns: FlexPattern[];
  settings: TriageSettings;
  onSettingsChange: (s: TriageSettings) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const togglePattern = (fp: FlexPattern) => {
    const disabled = settings.disabledFlexPatterns;
    const next = disabled.includes(fp.key)
      ? disabled.filter((k) => k !== fp.key)
      : [...disabled, fp.key];
    onSettingsChange({ ...settings, disabledFlexPatterns: next });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("triage.flexPatterns")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("triage.flexDialogDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Special lock rules */}
          {(
            [
              ["doubleCritLockEnabled", t.ui("triage.doubleCritLock")],
              ["erHoardingEnabled", t.ui("triage.erHoarding")],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                settings[key]
                  ? "border-purple-500/20 bg-purple-500/5"
                  : "border-border opacity-50"
              )}
            >
              <Switch
                checked={settings[key] as boolean}
                onCheckedChange={(v) =>
                  onSettingsChange({ ...settings, [key]: v })
                }
              />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}

          {/* Separator */}
          {flexPatterns.length > 0 && (
            <div className="border-t border-border my-1" />
          )}

          {/* Flex patterns */}
          {flexPatterns.map((fp) => {
            const enabled = !settings.disabledFlexPatterns.includes(fp.key);
            return (
              <div
                key={fp.key}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  enabled
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-border opacity-50"
                )}
              >
                <Switch
                  checked={enabled}
                  onCheckedChange={() => togglePattern(fp)}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
                    <span>{t.slot(fp.slot)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{t.statShort(fp.mainStat)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>
                      {fp.requiredSubs.map((s) => t.statShort(s)).join("+")}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {(fp.rarity * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
