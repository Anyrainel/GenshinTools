import type { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { BarChart3, Box, Lightbulb, Lock, Users } from "lucide-react";
import { useAutoRotate } from "./useAutoRotate";

type PreviewProps = { t: ReturnType<typeof useLanguage>["t"] };

const tabs = [
  {
    icon: Users,
    labelKey: "accountData.characters",
    previewKey: "greeting.previewCharacters",
  },
  {
    icon: Box,
    labelKey: "accountData.inventory",
    previewKey: "greeting.previewInventory",
  },
  {
    icon: Lightbulb,
    labelKey: "accountData.recommendations",
    previewKey: "greeting.previewRecommendations",
  },
  {
    icon: BarChart3,
    labelKey: "evaluation.tabLabel",
    previewKey: "greeting.previewEvaluation",
  },
  {
    icon: Lock,
    labelKey: "triage.tabLabel",
    previewKey: "greeting.previewTriage",
  },
] as const;

export default function AccountDataPreview({ t }: PreviewProps) {
  const { index, setIndex, onMouseEnter, onMouseLeave } = useAutoRotate(
    tabs.length
  );

  return (
    <div
      className="flex-1 rounded-lg border border-border overflow-hidden bg-card"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Tab bar */}
      <div className="flex border-b border-border bg-muted/30 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button
            key={tab.labelKey}
            type="button"
            onClick={() => setIndex(i)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
              i === index
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="size-3.5" />
            {t.ui(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Preview content */}
      <div className="p-4 min-h-[120px] flex items-center">
        <TabPreview tabIndex={index} t={t} />
      </div>
    </div>
  );
}

function TabPreview({
  tabIndex,
  t,
}: { tabIndex: number; t: PreviewProps["t"] }) {
  const tab = tabs[tabIndex];

  // Characters tab: character icon + score badge mockup
  if (tabIndex === 0) {
    return (
      <div className="flex items-center gap-4 w-full">
        {/* Mock character icon */}
        <div className="size-12 rounded-lg bg-gradient-to-br from-purple-500/30 to-purple-700/30 border border-purple-500/30 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <div className="h-3 w-20 rounded bg-foreground/20" />
            <div className="flex items-baseline gap-1">
              <span className="text-muted-foreground font-bold text-[10px]">
                SCORE
              </span>
              <span className="bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent text-lg font-black italic">
                87
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full bg-muted rounded-full">
            <div className="h-full w-[87%] bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground shrink-0">
          {t.ui(tab.previewKey)}
        </p>
      </div>
    );
  }

  // Inventory tab: artifact slot icons
  if (tabIndex === 1) {
    return (
      <div className="flex items-center gap-4 w-full">
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="size-10 rounded-md bg-muted/80 border border-border"
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          {t.ui(tab.previewKey)}
        </p>
      </div>
    );
  }

  // Recommendations tab: upgrade arrow + stat
  if (tabIndex === 2) {
    return (
      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Lightbulb className="size-5 text-emerald-400" />
          <div className="text-sm font-medium text-emerald-300">+12.4%</div>
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          {t.ui(tab.previewKey)}
        </p>
      </div>
    );
  }

  // Evaluation tab: mini ranking bars
  if (tabIndex === 3) {
    return (
      <div className="flex items-center gap-4 w-full">
        <div className="space-y-1.5 w-32">
          {[85, 72, 61].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="size-4 rounded bg-muted/80 shrink-0" />
              <div className="h-2 flex-1 bg-muted rounded-full">
                <div
                  className="h-full bg-primary/60 rounded-full"
                  style={{ width: `${w}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          {t.ui(tab.previewKey)}
        </p>
      </div>
    );
  }

  // Triage tab: lock/unlock icons
  if (tabIndex === 4) {
    return (
      <div className="flex items-center gap-4 w-full">
        <div className="flex gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Lock className="size-4 text-emerald-400" />
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Lock className="size-4 text-amber-400" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          {t.ui(tab.previewKey)}
        </p>
      </div>
    );
  }

  return null;
}
