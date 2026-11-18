import { Radio } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">
          <Radio aria-hidden />
          {t.ui("continuous.import")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        aria-label={t.ui("continuous.import")}
        className="w-64 space-y-3 text-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-enabled`} className="flex items-center gap-2">
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
      </PopoverContent>
    </Popover>
  );
}
