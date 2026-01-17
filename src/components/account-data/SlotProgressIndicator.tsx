import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";

interface SlotProgressIndicatorProps {
  slot: string;
  actualScore: number;
  maxScore: number;
  isMainStatWrong: boolean;
}

function getProgressColor(percent: number): string {
  if (percent >= 95) return "bg-emerald-600";
  if (percent >= 85) return "bg-green-500";
  if (percent >= 70) return "bg-lime-400";
  if (percent >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

export const SlotProgressIndicator = ({
  slot,
  actualScore,
  maxScore,
  isMainStatWrong,
}: SlotProgressIndicatorProps) => {
  const { t } = useLanguage();

  // Show warning for wrong main stat
  if (isMainStatWrong) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="pt-1.5 px-0.5 flex items-center justify-center h-[18px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t.ui("accountData.wrongMainStat")}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Calculate percentage (cap at 100%)
  const percent =
    maxScore > 0 ? Math.min(100, (actualScore / maxScore) * 100) : 0;
  const colorClass = getProgressColor(percent);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="pt-1.5 px-0.5 h-[18px] flex items-end">
          {/* Custom progress bar */}
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full transition-all duration-300", colorClass)}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs font-mono text-center">
        <div>
          {t.ui(`computeFilters.${slot}`)} {t.ui("accountData.subStatScore")}
        </div>
        <div>
          {actualScore.toFixed(1)} / {maxScore.toFixed(1)} ({percent.toFixed(0)}
          %)
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
