import { CircleHelp, RotateCcw } from "lucide-react";
import { OwnedOnlyTooltip } from "@/components/shared/OwnedOnlyTooltip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { useLanguage } from "@/contexts/LanguageContext";
import {
  DEFAULT_TRIAGE_SETTINGS,
  TRIAGE_BACKUP_AMOUNT_PRESETS,
} from "@/lib/account-data/triage/constants";
import { TRIAGE_TIER_THRESHOLDS } from "@/lib/account-data/triage/tierMath";
import type {
  TriageBackupAmountMode,
  TriageSettings,
} from "@/lib/account-data/triage/types";

type Translator = ReturnType<typeof useLanguage>["t"];

const BACKUP_AMOUNT_MODES = ["normal", "extra", "custom"] as const;

function backupAmountModeLabel(mode: TriageBackupAmountMode, t: Translator) {
  if (mode === "normal") return t.ui("triage.backupAmountNormal");
  if (mode === "extra") return t.ui("triage.backupAmountExtra");
  return t.ui("triage.backupAmountCustom");
}

function formatPercent(value: number) {
  return `${value * 100}%`;
}

function getTriageModeThresholdHint(settings: TriageSettings, t: Translator) {
  const thresholds = TRIAGE_TIER_THRESHOLDS[settings.triageMode];
  return t
    .ui("triage.triageModeThresholdHint")
    .replace("{0}", formatPercent(thresholds.flowerFeather.premium))
    .replace("{1}", formatPercent(thresholds.sandsGobletCirclet.premium))
    .replace("{2}", formatPercent(thresholds.flowerFeather.quality))
    .replace("{3}", formatPercent(thresholds.sandsGobletCirclet.quality))
    .replace("{4}", formatPercent(thresholds.flowerFeather.neutral))
    .replace("{5}", formatPercent(thresholds.sandsGobletCirclet.neutral));
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-mono">
          {prefix}
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm cursor-pointer" htmlFor={id}>
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </h4>
  );
}

export function TriageSettingsPanel({
  settings,
  onChange,
  t,
  onOpenHelp,
}: {
  settings: TriageSettings;
  onChange: (s: TriageSettings) => void;
  t: Translator;
  onOpenHelp?: () => void;
}) {
  const update = <K extends keyof TriageSettings>(
    key: K,
    value: TriageSettings[K]
  ) => onChange({ ...settings, [key]: value });

  const updateBackupAmountMode = (mode: TriageBackupAmountMode) => {
    if (mode === "custom") {
      onChange({ ...settings, backupAmountMode: mode });
      return;
    }
    onChange({
      ...settings,
      backupAmountMode: mode,
      ...TRIAGE_BACKUP_AMOUNT_PRESETS[mode],
      alwaysLockSolidArtifacts: false,
    });
  };

  return (
    <div className="space-y-3 w-72">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t.ui("triage.settings")}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-2 text-xs"
          onClick={() => onChange(structuredClone(DEFAULT_TRIAGE_SETTINGS))}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t.ui("triage.restoreDefaults")}
        </Button>
      </div>
      <div className="space-y-3">
        <SectionHeading>{t.ui("triage.settingsProtection")}</SectionHeading>
        <SwitchRow
          id="equippedProtection"
          label={t.ui("triage.equippedProtect")}
          checked={settings.equippedProtection}
          onChange={(v) => update("equippedProtection", v)}
        />
        <SwitchRow
          id="highLevelProtection"
          label={t.ui("triage.highLevelProtection")}
          checked={settings.highLevelProtection}
          onChange={(v) => update("highLevelProtection", v)}
        />
        <SliderRow
          label={t.ui("triage.levelProtection")}
          value={settings.levelProtection}
          onChange={(v) => update("levelProtection", v)}
          min={4}
          max={20}
          step={4}
          prefix="+"
        />
      </div>
      <div className="border-t border-border pt-3 space-y-3">
        <SectionHeading>{t.ui("triage.settingsThreshold")}</SectionHeading>
        <SwitchRow
          id="ownedOnly"
          label={
            <OwnedOnlyTooltip>
              <span>{t.ui("triage.ownedOnly")}</span>
            </OwnedOnlyTooltip>
          }
          checked={settings.ownedOnly}
          onChange={(v) => update("ownedOnly", v)}
        />
        <SliderRow
          label={t.ui("triage.mainStatThreshold")}
          value={settings.mainStatThreshold}
          onChange={(v) => update("mainStatThreshold", v)}
          min={50}
          max={100}
          step={5}
        />
        <SliderRow
          label={t.ui("triage.optionalSubThreshold")}
          value={settings.optionalSubThreshold}
          onChange={(v) => update("optionalSubThreshold", v)}
          min={10}
          max={80}
          step={5}
        />
      </div>
      <div className="border-t border-border pt-3 space-y-3">
        <div className="flex items-center gap-1.5">
          <SectionHeading>{t.ui("triage.settingsKeepRules")}</SectionHeading>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={onOpenHelp}
            aria-label={t.ui("triage.help.title")}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-1">
          <SwitchRow
            id="triageMode"
            label={t.ui("triage.triageMode")}
            checked={settings.triageMode === "loose"}
            onChange={(v) => update("triageMode", v ? "loose" : "strict")}
          />
          <p className="text-xs text-muted-foreground">
            {getTriageModeThresholdHint(settings, t)}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm shrink-0">
              {t.ui("triage.backupAmount")}
            </Label>
            <ToggleGroup
              type="single"
              value={settings.backupAmountMode}
              onValueChange={(value) => {
                if (!value) return;
                updateBackupAmountMode(value as TriageBackupAmountMode);
              }}
              className="grid grid-cols-3 justify-stretch flex-1"
              size="sm"
              variant="outline"
            >
              {BACKUP_AMOUNT_MODES.map((mode) => (
                <ToggleGroupItem
                  key={mode}
                  value={mode}
                  className="w-full px-2"
                >
                  {backupAmountModeLabel(mode, t)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {settings.backupAmountMode === "normal" && (
            <p className="text-xs text-muted-foreground">
              {t.ui("triage.backupAmountNormalDesc")}
            </p>
          )}
          {settings.backupAmountMode === "extra" && (
            <p className="text-xs text-muted-foreground">
              {t.ui("triage.backupAmountExtraDesc")}
            </p>
          )}
        </div>
        {settings.backupAmountMode === "custom" && (
          <>
            <SwitchRow
              id="alwaysLockSolidArtifacts"
              label={t.ui("triage.alwaysLockSolidArtifacts")}
              checked={settings.alwaysLockSolidArtifacts}
              onChange={(v) => update("alwaysLockSolidArtifacts", v)}
            />
            <SliderRow
              label={t.ui("triage.qualityMargin")}
              value={settings.qualityMargin}
              onChange={(v) => update("qualityMargin", v)}
              min={1}
              max={10}
              step={1}
            />
            <SliderRow
              label={t.ui("triage.fillerKeep")}
              value={settings.fillerKeep}
              onChange={(v) => update("fillerKeep", v)}
              min={1}
              max={10}
              step={1}
            />
            <SliderRow
              label={t.ui("triage.setSlotKeep")}
              value={settings.setSlotKeep}
              onChange={(v) => update("setSlotKeep", v)}
              min={1}
              max={10}
              step={1}
            />
          </>
        )}
      </div>
    </div>
  );
}
