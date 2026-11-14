import { Radio } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScannerSync } from "@/contexts/ScannerSyncContext";

export function ContinuousInventorySync() {
  const { t } = useLanguage();
  const id = useId();
  const session = useScannerSync();
  if (!session) return null;
  const { enabled, setEnabled, portInput, setPortInput, commitPort } = session;
  return (
    <section className="space-y-3 rounded-lg border border-border p-3 text-left text-sm">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`${id}-enabled`} className="flex items-center gap-2">
          <Radio className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          {t.ui("continuous.title")}
        </Label>
        <Switch
          id={`${id}-enabled`}
          aria-describedby={`${id}-description`}
          checked={enabled}
          onCheckedChange={(next) => {
            if (next) commitPort();
            setEnabled(next);
          }}
        />
      </div>
      <p id={`${id}-description`} className="text-xs text-muted-foreground">
        {t.ui("continuous.description")}
      </p>
      <div className="flex w-full items-center justify-between gap-3">
        <Label htmlFor={`${id}-port`}>{t.ui("manager.port")}</Label>
        <Input
          id={`${id}-port`}
          className="h-9 w-28 border-border"
          inputMode="numeric"
          value={portInput}
          disabled={enabled}
          onChange={(event) => setPortInput(event.target.value)}
          onBlur={commitPort}
        />
      </div>
    </section>
  );
}
