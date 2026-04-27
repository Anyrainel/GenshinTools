import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { TriageSettings } from "@/lib/account-data/triage/types";

type Translator = ReturnType<typeof useLanguage>["t"];

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
  label: string;
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
}: {
  settings: TriageSettings;
  onChange: (s: TriageSettings) => void;
  t: Translator;
}) {
  const update = <K extends keyof TriageSettings>(
    key: K,
    value: TriageSettings[K]
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4 w-72">
      <div className="space-y-3">
        <SectionHeading>{t.ui("triage.settingsProtection")}</SectionHeading>
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
        <SwitchRow
          id="equippedProtection"
          label={t.ui("triage.equippedProtect")}
          checked={settings.equippedProtection}
          onChange={(v) => update("equippedProtection", v)}
        />
      </div>
      <div className="border-t border-border pt-3 space-y-3">
        <SectionHeading>{t.ui("triage.settingsThreshold")}</SectionHeading>
        <div className="space-y-1">
          <SwitchRow
            id="triageMode"
            label={t.ui("triage.triageMode")}
            checked={settings.triageMode === "loose"}
            onChange={(v) => update("triageMode", v ? "loose" : "strict")}
          />
          <p className="text-xs text-muted-foreground">
            {t.ui("triage.triageModeHint")}
          </p>
        </div>
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
        <SwitchRow
          id="ownedOnly"
          label={t.ui("triage.ownedOnly")}
          checked={settings.ownedOnly}
          onChange={(v) => update("ownedOnly", v)}
        />
      </div>
      <div className="border-t border-border pt-3 space-y-3">
        <SectionHeading>{t.ui("triage.settingsKeepRules")}</SectionHeading>
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
      </div>
    </div>
  );
}
