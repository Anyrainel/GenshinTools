import {
  TriageCard,
  type TriageCardSection,
} from "@/components/account-data/TriageCard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { TriageDecision } from "@/lib/account-data/triage";
import { cn } from "@/lib/utils";
import { CheckCircle2, Lock, LockOpen, ShieldAlert } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type T = ReturnType<typeof useLanguage>["t"];

export interface TriageTabContentHandle {
  expandAll: () => void;
  collapseAll: () => void;
  hasExpanded: boolean;
}

function useGridCols() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(1);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const colCount = getComputedStyle(el).gridTemplateColumns.split(" ").length;
    setCols(colCount);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return { gridRef: ref, cols };
}

const TABS = [
  {
    value: "lock",
    labelKey: "triage.recommendLock",
    descKey: "triage.recommendLockDesc",
    icon: Lock,
    color: "green",
    section: "recommendLock",
  },
  {
    value: "unlock",
    labelKey: "triage.recommendUnlock",
    descKey: "triage.recommendUnlockDesc",
    icon: LockOpen,
    color: "red",
    section: "recommendUnlock",
  },
  {
    value: "nochange",
    labelKey: "triage.noChange",
    descKey: "triage.noChangeDesc",
    icon: CheckCircle2,
    color: "slate",
    section: "noChange",
  },
  {
    value: "protected",
    labelKey: "triage.noActionNeeded",
    descKey: "triage.noActionDesc",
    icon: ShieldAlert,
    color: "amber",
    section: "protected",
  },
] as const satisfies readonly {
  value: string;
  labelKey: string;
  descKey: string;
  icon: typeof Lock;
  color: string;
  section: TriageCardSection;
}[];

const COLOR_CLASS = {
  green:
    "data-[state=inactive]:text-foreground/70 data-[state=active]:bg-green-500/30 data-[state=active]:text-green-400 data-[state=active]:border-green-500/30",
  red: "data-[state=inactive]:text-foreground/70 data-[state=active]:bg-red-500/30 data-[state=active]:text-red-400 data-[state=active]:border-red-500/30",
  amber:
    "data-[state=inactive]:text-foreground/70 data-[state=active]:bg-amber-500/30 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/30",
  slate:
    "data-[state=inactive]:text-foreground/70 data-[state=active]:bg-sky-500/30 data-[state=active]:text-sky-400 data-[state=active]:border-sky-500/30",
};

export function TriageTabContent({
  t,
  isStale,
  recommendLock,
  recommendUnlock,
  noAction,
  noChange,
  handleRef,
}: {
  t: T;
  isStale: boolean;
  recommendLock: TriageDecision[];
  recommendUnlock: TriageDecision[];
  noAction: TriageDecision[];
  noChange: TriageDecision[];
  handleRef?: React.RefObject<TriageTabContentHandle | null>;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("lock");
  const { gridRef, cols: gridCols } = useGridCols();

  const toggleRow = (tab: string, index: number) => {
    const row = Math.floor(index / gridCols);
    const key = `${tab}:${row}`;
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isRowExpanded = (tab: string, index: number) =>
    expandedRows.has(`${tab}:${Math.floor(index / gridCols)}`);

  const itemsMap: Record<string, TriageDecision[]> = {
    lock: recommendLock,
    unlock: recommendUnlock,
    protected: noAction,
    nochange: noChange,
  };

  useImperativeHandle(handleRef, () => ({
    expandAll: () => {
      const items = itemsMap[activeTab] ?? [];
      if (items.length === 0 || gridCols < 1) return;
      const totalRows = Math.ceil(items.length / gridCols);
      const keys = new Set(expandedRows);
      for (let r = 0; r < totalRows; r++) keys.add(`${activeTab}:${r}`);
      setExpandedRows(keys);
    },
    collapseAll: () => {
      setExpandedRows((prev) => {
        const next = new Set(prev);
        for (const key of prev) {
          if (key.startsWith(`${activeTab}:`)) next.delete(key);
        }
        return next;
      });
    },
    get hasExpanded() {
      for (const key of expandedRows) {
        if (key.startsWith(`${activeTab}:`)) return true;
      }
      return false;
    },
  }));

  return (
    <Tabs
      defaultValue="lock"
      onValueChange={setActiveTab}
      className={cn(
        isStale && "opacity-60 pointer-events-none transition-opacity"
      )}
    >
      <TabsList className="w-full bg-card/80 backdrop-blur-md h-auto gap-1 grid grid-cols-2 sm:grid-cols-4 sticky top-0 z-20">
        {TABS.map(({ value, labelKey, descKey, icon: Icon, color }) => (
          <TabsTrigger
            key={value}
            value={value}
            title={t.ui(descKey)}
            className={cn(
              "gap-1.5 data-[state=active]:border data-[state=active]:shadow-none rounded-md",
              COLOR_CLASS[color]
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.ui(labelKey)}
            <Badge variant="secondary" className="text-xs ml-0.5">
              {itemsMap[value].length}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map(({ value, section }) => {
        const items = itemsMap[value];
        return (
          <TabsContent key={value} value={value}>
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {t.ui("triage.noRecommendations")}
              </div>
            ) : (
              <div
                ref={gridRef}
                className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              >
                {items.map((d, i) => (
                  <TriageCard
                    key={d.artifact.id}
                    decision={d}
                    expanded={isRowExpanded(value, i)}
                    onToggle={() => toggleRow(value, i)}
                    section={section}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
