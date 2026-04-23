import { Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { StatSelect } from "@/components/artifact-builds/StatSelect";
import { Button } from "@/components/ui/button";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { statPools } from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import {
  buildCustomFlexPattern,
  sortSubs,
} from "@/lib/account-data/triage/flexRegistry";
import type {
  CustomFlexInput,
  FlexPattern,
  TriageSettings,
} from "@/lib/account-data/triage/types";
import { cn } from "@/lib/utils";

export function FlexPatternDialog({
  open,
  onOpenChange,
  flexPatterns,
  settings,
  onSettingsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flexPatterns: FlexPattern[];
  settings: TriageSettings;
  onSettingsChange: (s: TriageSettings) => void;
}) {
  const { t } = useLanguage();
  const isPatternEnabled = (fp: FlexPattern) =>
    fp.defaultOff
      ? settings.enabledFlexPatterns.includes(fp.key)
      : !settings.disabledFlexPatterns.includes(fp.key);

  const togglePattern = (fp: FlexPattern) => {
    if (fp.defaultOff) {
      const enabled = settings.enabledFlexPatterns;
      const next = enabled.includes(fp.key)
        ? enabled.filter((k) => k !== fp.key)
        : [...enabled, fp.key];
      onSettingsChange({ ...settings, enabledFlexPatterns: next });
    } else {
      const disabled = settings.disabledFlexPatterns;
      const next = disabled.includes(fp.key)
        ? disabled.filter((k) => k !== fp.key)
        : [...disabled, fp.key];
      onSettingsChange({ ...settings, disabledFlexPatterns: next });
    }
  };

  // --- Custom patterns ---
  const officialPatterns = flexPatterns.filter((fp) => !fp.custom);
  const officialKeys = useMemo(
    () => new Set(officialPatterns.map((fp) => fp.key)),
    [officialPatterns]
  );

  const customPatterns = useMemo(
    () =>
      (settings.customFlexInputs ?? [])
        .map(buildCustomFlexPattern)
        .filter((fp): fp is FlexPattern => fp !== null),
    [settings.customFlexInputs]
  );

  const removeCustom = (input: CustomFlexInput) => {
    const sorted = sortSubs(input.requiredSubs);
    const key = `flex:${input.slot}:${input.mainStat}:${sorted.join(",")}`;
    onSettingsChange({
      ...settings,
      customFlexInputs: settings.customFlexInputs.filter((ci) => {
        const ciSorted = sortSubs(ci.requiredSubs);
        const ciKey = `flex:${ci.slot}:${ci.mainStat}:${ciSorted.join(",")}`;
        return ciKey !== key;
      }),
    });
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
          <div className="text-sm font-medium text-muted-foreground px-1">
            {t.ui("triage.globalRules")}
          </div>
          {(
            [
              ["doubleCritLockEnabled", t.ui("triage.doubleCritLock")],
              ["erHoardingEnabled", t.ui("triage.erHoarding")],
              ["erHoardingAllEnabled", t.ui("triage.erHoardingAll")],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                settings[key]
                  ? "border-purple-500/20 bg-purple-500/5"
                  : "border-border"
              )}
            >
              <Switch
                checked={settings[key] as boolean}
                onCheckedChange={(v) =>
                  onSettingsChange({ ...settings, [key]: v })
                }
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  !settings[key] && "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          ))}

          {/* Custom patterns section */}
          <div className="border-t border-border my-1" />
          <div className="text-sm font-medium text-muted-foreground px-1">
            {t.ui("triage.customPatterns")}
          </div>

          {/* Existing custom patterns */}
          {customPatterns.map((fp) => {
            const input = settings.customFlexInputs.find((ci) => {
              const sorted = sortSubs(ci.requiredSubs);
              return (
                `flex:${ci.slot}:${ci.mainStat}:${sorted.join(",")}` === fp.key
              );
            });
            return (
              <div
                key={fp.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5"
              >
                <div className="flex-1 min-w-0">
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
                {input && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCustom(input)}
                    aria-label={t.ui("triage.removeCustomFlex")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}

          {/* Inline add form */}
          <CustomFlexAddForm
            settings={settings}
            onSettingsChange={onSettingsChange}
            officialKeys={officialKeys}
            customPatterns={customPatterns}
          />

          {/* Built-in patterns section */}
          {officialPatterns.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <div className="text-sm font-medium text-muted-foreground px-1">
                {t.ui("triage.builtInPatterns")}
              </div>
            </>
          )}
          {officialPatterns.map((fp) => {
            const enabled = isPatternEnabled(fp);
            return (
              <div
                key={fp.key}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  enabled
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-border"
                )}
              >
                <Switch
                  checked={enabled}
                  onCheckedChange={() => togglePattern(fp)}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium whitespace-nowrap",
                      !enabled && "text-muted-foreground"
                    )}
                  >
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

function CustomFlexAddForm({
  settings,
  onSettingsChange,
  officialKeys,
  customPatterns,
}: {
  settings: TriageSettings;
  onSettingsChange: (s: TriageSettings) => void;
  officialKeys: Set<string>;
  customPatterns: FlexPattern[];
}) {
  const { t } = useLanguage();
  const [slot, setSlot] = useState<Slot>("flower");
  const [mainStat, setMainStat] = useState<MainStat>("hp");
  const [subs, setSubs] = useState<string[]>([""]);

  // Enforce at least one sub slot is always visible
  const handleSubsChange = useCallback((values: string[]) => {
    setSubs(values.length === 0 ? [""] : values);
  }, []);

  const mainStatOptions = statPools[slot] as readonly string[];

  // Reset mainStat when slot changes if current value is invalid
  const handleSlotChange = (newSlot: string) => {
    const s = newSlot as Slot;
    setSlot(s);
    const newPool = statPools[s] as readonly string[];
    if (!newPool.includes(mainStat)) {
      setMainStat(newPool[0] as MainStat);
    }
    setSubs([""]);
  };

  // Filter substats: remove mainStat if it's also a substat
  const subOptions = useMemo(() => {
    return statPools.substat.filter((s) => s !== mainStat);
  }, [mainStat]);

  // Filter out empty placeholders for validation/submission
  const filledSubs = useMemo(() => subs.filter((s) => s !== ""), [subs]);

  // Validation
  const validation = useMemo(() => {
    if (filledSubs.length < 1) return { valid: false, error: null };

    const sorted = sortSubs(filledSubs as SubStat[]);
    const key = `flex:${slot}:${mainStat}:${sorted.join(",")}`;

    // Check official duplicates
    if (officialKeys.has(key)) {
      return { valid: false, error: "duplicate" as const };
    }

    // Check custom duplicates
    if (customPatterns.some((fp) => fp.key === key)) {
      return { valid: false, error: "duplicate" as const };
    }

    // Check validity via buildCustomFlexPattern
    const fp = buildCustomFlexPattern({
      slot,
      mainStat,
      requiredSubs: filledSubs as SubStat[],
    });
    if (!fp) {
      return { valid: false, error: "invalid" as const };
    }

    return { valid: true, error: null };
  }, [slot, mainStat, filledSubs, officialKeys, customPatterns]);

  const handleAdd = () => {
    if (!validation.valid) return;
    const input: CustomFlexInput = {
      slot,
      mainStat,
      requiredSubs: filledSubs as SubStat[],
    };
    onSettingsChange({
      ...settings,
      customFlexInputs: [...settings.customFlexInputs, input],
    });
    setSubs([""]);
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Slot select */}
        <LightweightSelect value={slot} onValueChange={handleSlotChange}>
          <LightweightSelectTrigger className="w-auto min-w-[5rem] h-7 text-sm bg-gradient-select">
            <LightweightSelectValue />
          </LightweightSelectTrigger>
          <LightweightSelectContent>
            {allSlots.map((s) => (
              <LightweightSelectItem key={s} value={s} className="text-sm">
                {t.slot(s)}
              </LightweightSelectItem>
            ))}
          </LightweightSelectContent>
        </LightweightSelect>

        {/* MainStat select */}
        <span className="text-xs text-muted-foreground">
          {t.ui("triage.mainLabel")}
        </span>
        <LightweightSelect
          value={mainStat}
          onValueChange={(v) => {
            setMainStat(v as MainStat);
            // Clear subs that now overlap with mainStat
            setSubs((prev) => {
              const filtered = prev.filter((s) => s !== v);
              return filtered.length === 0 ? [""] : filtered;
            });
          }}
        >
          <LightweightSelectTrigger className="w-auto min-w-[4.5rem] h-7 text-sm bg-gradient-select">
            <span>{t.statShort(mainStat)}</span>
          </LightweightSelectTrigger>
          <LightweightSelectContent>
            {mainStatOptions.map((ms) => (
              <LightweightSelectItem key={ms} value={ms} className="text-sm">
                {t.stat(ms)}
              </LightweightSelectItem>
            ))}
          </LightweightSelectContent>
        </LightweightSelect>

        {/* SubStat multi-select */}
        <span className="text-xs text-muted-foreground">
          {t.ui("triage.subLabel")}
        </span>
        <StatSelect
          values={subs}
          onValuesChange={handleSubsChange}
          options={subOptions}
          maxLength={4}
          compact
        />

        {/* Add button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={!validation.valid}
          onClick={handleAdd}
        >
          {t.ui("triage.addCustomFlex")}
        </Button>
      </div>

      {/* Error messages */}
      {validation.error === "duplicate" && (
        <p className="text-xs text-destructive">
          {t.ui("triage.customFlexDuplicate")}
        </p>
      )}
      {validation.error === "invalid" && (
        <p className="text-xs text-destructive">
          {t.ui("triage.customFlexInvalid")}
        </p>
      )}
    </div>
  );
}
