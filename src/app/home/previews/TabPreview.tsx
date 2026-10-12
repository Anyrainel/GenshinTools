import type { LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { useLanguage } from "@/contexts/LanguageContext";

export interface TabPanel {
  content: React.ReactNode;
  description: string;
}

export interface TabDef {
  id: string;
  icon: LucideIcon;
  label: string;
}

export function TabPreview({
  tabs,
  panels,
  t,
}: {
  tabs: readonly TabDef[];
  panels: TabPanel[];
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-gradient-card">
      <figcaption className="border-b border-border px-4 py-3 text-xs font-semibold">
        {t.ui("greeting.examplePreview")}
      </figcaption>
      <Tabs defaultValue={tabs[0].id}>
        <TabsList
          aria-label={t.ui("greeting.previewTabs")}
          className="flex h-auto flex-wrap justify-start gap-1 rounded-none border-b border-border p-2"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="min-h-10 gap-1.5 whitespace-normal px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <tab.icon className="size-3.5 shrink-0" aria-hidden />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {panels.map((panel, index) => (
          <TabsContent
            key={tabs[index].id}
            value={tabs[index].id}
            className="m-0 min-w-0 p-3 focus-visible:ring-inset"
          >
            <div
              className="min-w-0"
              ref={(element) => {
                if (element) element.inert = true;
              }}
            >
              {panel.content}
            </div>
            <p className="mt-4 border-t border-border pt-3 text-sm font-medium leading-6">
              {panel.description}
            </p>
          </TabsContent>
        ))}
      </Tabs>
    </figure>
  );
}
