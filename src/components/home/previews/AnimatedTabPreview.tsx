import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useAutoRotate } from "./useAutoRotate";

type PreviewProps = { t: ReturnType<typeof useLanguage>["t"] };

/** Rose-gold gradient description text for right-side panel */
export function Desc({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold text-rose-300 shrink-0 max-w-[160px] text-center leading-snug">
      {children}
    </p>
  );
}

export interface TabPanel {
  /** Content rendered in the left 50% */
  content: React.ReactNode;
  /** i18n key for the right-side description */
  descKey: string;
}

export interface TabDef {
  icon: LucideIcon;
  labelKey: string;
}

const INTERVAL_MS = 3000;

/**
 * Reusable animated tab preview with:
 * - Auto-rotating tab bar (pauses on hover)
 * - Progress bar under the active tab
 * - Grid overlay so height = tallest tab (no shifting)
 * - Left 50% content + right 50% rose-gold description
 */
export function AnimatedTabPreview({
  tabs,
  panels,
  t,
}: {
  tabs: readonly TabDef[];
  panels: TabPanel[];
  t: PreviewProps["t"];
}) {
  const { index, setIndex, onMouseEnter, onMouseLeave, paused } = useAutoRotate(
    tabs.length,
    INTERVAL_MS
  );

  return (
    <div
      className="flex-1 rounded-lg border border-border overflow-hidden bg-card"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Tab bar — matches real AppBar tab styling */}
      <div className="relative bg-muted/30 border-b border-border">
        <div className="flex justify-center py-2">
          <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
            {tabs.map((tab, i) => (
              <Button
                key={tab.labelKey}
                variant={i === index ? "default" : "ghost"}
                onClick={() => setIndex(i)}
                className={cn(
                  "gap-1.5 h-7 px-2.5 text-xs",
                  i === index && "bg-primary/60 text-primary-foreground"
                )}
              >
                <tab.icon className="size-3.5" />
                {t.ui(tab.labelKey)}
              </Button>
            ))}
          </div>
        </div>
        {/* Progress bar — full width along bottom edge */}
        <div
          key={`progress-${index}`}
          className={cn(
            "absolute bottom-0 left-0 h-[2px] bg-primary",
            paused ? "animate-none" : "animate-tab-progress"
          )}
          style={{ animationDuration: `${INTERVAL_MS}ms` }}
        />
      </div>

      {/* Grid overlay: all panels rendered, inactive ones invisible — stable height */}
      <div className="p-3 grid [&>*]:col-start-1 [&>*]:row-start-1">
        {panels.map((panel, i) => (
          <div
            key={tabs[i].labelKey}
            className={cn(
              "flex items-center gap-4 w-full",
              i !== index && "invisible"
            )}
          >
            {/* Left 50% */}
            <div className="w-1/2 min-w-0">{panel.content}</div>
            {/* Right 50% */}
            <div className="w-1/2 flex items-center justify-center">
              <Desc>{t.ui(panel.descKey)}</Desc>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
