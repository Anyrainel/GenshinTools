import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";

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

export function SlotProgressIndicator({
  slot,
  actualScore,
  maxScore,
  isMainStatWrong,
}: SlotProgressIndicatorProps) {
  const { t } = useLanguage();

  // Calculate percentage (cap at 100%)
  const percent =
    maxScore > 0 ? Math.min(100, (actualScore / maxScore) * 100) : 0;
  const colorClass = getProgressColor(percent);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="pt-1.5 px-0.5 h-[18px] flex items-center gap-1">
          {/* Warning triangle for wrong main stat */}
          {isMainStatWrong && (
            <TriangleAlert className="w-3 h-3 shrink-0 text-amber-500/80 mx-1" />
          )}
          {/* Progress bar fills remaining space */}
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full transition-all duration-300", colorClass)}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="text-xs font-mono text-center text-white bg-slate-900"
      >
        {isMainStatWrong && (
          <div className="text-amber-400 font-sans mb-1">
            {t.ui("accountData.wrongMainStat")}
          </div>
        )}
        <div>
          {t.slot(slot)} {t.ui("accountData.subStatScore")}
        </div>
        <div>
          {actualScore.toFixed(1)} / {maxScore.toFixed(1)} ({percent.toFixed(0)}
          %)
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
