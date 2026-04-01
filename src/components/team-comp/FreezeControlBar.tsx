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
import { Flame, Monitor, Snowflake } from "lucide-react";

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
    <div className="flex items-center justify-center gap-3 px-1 py-0">
      <div className="flex items-center gap-2">
        <span className="text-sm md:text-base font-bold text-foreground whitespace-nowrap">
          {t.ui("teamComp.reuseLabel")}
        </span>
        <Select
          value={reuseMode}
          onValueChange={(v) => onReuseModeChange(v as ArtifactReuseMode)}
        >
          <SelectTrigger className="w-auto text-sm md:text-base font-bold h-7 md:h-8 gap-1.5 px-3 border-primary/30 bg-primary/10 text-foreground ring-1 ring-primary/15 hover:bg-primary/15">
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
          className="gap-1.5 text-sm leading-none h-8 border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
          className="gap-1.5 text-sm leading-none h-8 border-cyan-400/40 text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10"
          onClick={onRefreezeAll}
        >
          <Snowflake className="w-3 h-3" />
          <span>{t.ui("teamComp.freezeTeam")}</span>
        </Button>
      )}
      {import.meta.env.DEV && onEquipAll && (
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
