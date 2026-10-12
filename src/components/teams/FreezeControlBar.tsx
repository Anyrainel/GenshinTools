import { Flame, Monitor, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactReuseMode } from "@/stores/useFreezeStore";

interface FreezeControlBarProps {
  reuseMode: ArtifactReuseMode;
  onReuseModeChange: (mode: ArtifactReuseMode) => void;
  hasActiveFrozen: boolean;
  hasPendingAnything: boolean;
  onClearAll: () => void;
  onRefreezeAll: () => void;
  onEquipAll?: () => void;
}

export function FreezeControlBar({
  reuseMode,
  onReuseModeChange,
  hasActiveFrozen,
  hasPendingAnything,
  onClearAll,
  onRefreezeAll,
  onEquipAll,
}: FreezeControlBarProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-foreground/20 bg-gradient-card p-3">
      <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm md:text-base font-bold text-foreground whitespace-nowrap">
          {t.ui("teamComp.reuseLabel")}
        </span>
        <Select
          value={reuseMode}
          onValueChange={(v) => onReuseModeChange(v as ArtifactReuseMode)}
        >
          <SelectTrigger className="h-8 w-auto max-w-full min-w-0 gap-1.5 border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-foreground hover:bg-primary/15 [&>span]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t.ui("teamComp.reuseNone")}</SelectItem>
            <SelectItem value="sameChar">
              {t.ui("teamComp.reuseSameChar")}
            </SelectItem>
            <SelectItem value="forceReuse">
              {t.ui("teamComp.reuseForce")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasActiveFrozen && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-destructive/50 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onClearAll}
        >
          <Flame className="w-3 h-3" />
          <span>{t.ui("teamComp.unfreezeAll")}</span>
        </Button>
      )}
      {hasPendingAnything && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-primary/40 bg-primary/10 text-sm text-foreground hover:bg-primary/20"
          onClick={onRefreezeAll}
        >
          <Snowflake className="w-3 h-3" />
          <span>{t.ui("teamComp.freezeTeam")}</span>
        </Button>
      )}
      {onEquipAll && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-sm leading-none h-8"
          onClick={onEquipAll}
        >
          <Monitor className="w-3 h-3" />
          <span>{t.ui("manager.equipAll")}</span>
        </Button>
      )}
    </div>
  );
}
