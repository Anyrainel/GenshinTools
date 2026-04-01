import type { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Crosshair,
  Lock,
  Medal,
  Snowflake,
  Sword,
  TrendingUp,
} from "lucide-react";
import { useAutoRotate } from "./useAutoRotate";

type PreviewProps = { t: ReturnType<typeof useLanguage>["t"] };

const tabs = [
  {
    icon: Crosshair,
    labelKey: "teamComp.tabDamage",
    previewKey: "greeting.previewDamage",
  },
  {
    icon: Snowflake,
    labelKey: "teamComp.tabFrozen",
    previewKey: "greeting.previewFrozen",
  },
  {
    icon: TrendingUp,
    labelKey: "teamComp.tabInvestment",
    previewKey: "greeting.previewInvestment",
  },
  {
    icon: Medal,
    labelKey: "teamComp.tabWeaponChoice",
    previewKey: "greeting.previewWeapon",
  },
] as const;

export default function TeamCompPreview({ t }: PreviewProps) {
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

  // Damage tab: damage number + formula
  if (tabIndex === 0) {
    return (
      <div className="flex items-center gap-4 w-full">
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="text-2xl font-black text-primary">42,851</div>
          <div className="text-[10px] text-muted-foreground">DPS</div>
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          {t.ui(tab.previewKey)}
        </p>
      </div>
    );
  }

  // Frozen tab: lock + artifact slots
  if (tabIndex === 1) {
    return (
      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-sky-400" />
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="size-8 rounded-md bg-sky-500/10 border border-sky-500/20"
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          {t.ui(tab.previewKey)}
        </p>
      </div>
    );
  }

  // Investment tab: graph/chart arrow
  if (tabIndex === 2) {
    return (
      <div className="flex items-center gap-4 w-full">
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <TrendingUp className="size-6 text-emerald-400" />
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          {t.ui(tab.previewKey)}
        </p>
      </div>
    );
  }

  // Weapon tab: ranked swords
  if (tabIndex === 3) {
    return (
      <div className="flex items-center gap-4 w-full">
        <div className="space-y-1">
          {[100, 85, 72].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <Sword className="size-3.5 text-amber-400" />
              <div className="h-2 w-24 bg-muted rounded-full">
                <div
                  className="h-full bg-amber-400/60 rounded-full"
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

  return null;
}
