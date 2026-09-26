import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ImportMethodItemProps {
  value: string;
  title: string;
  icon: LucideIcon;
  summary?: string;
  badge?: string;
  children: ReactNode;
}

/** Product styling stays outside the upstream shadcn primitive. */
export function ImportMethodItem({
  value,
  title,
  icon: Icon,
  summary,
  badge,
  children,
}: ImportMethodItemProps) {
  return (
    <AccordionItem
      value={value}
      className="rounded-xl border border-border bg-card text-card-foreground transition-colors data-[state=open]:border-primary/50 data-[state=open]:bg-primary/5 [&>[role=region]]:motion-reduce:animate-none"
    >
      <AccordionTrigger className="min-w-0 gap-3 rounded-xl px-4 text-left hover:bg-accent/50 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&>svg]:text-foreground">
        <span className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold sm:text-base">
                {title}
              </span>
              {badge && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  {badge}
                </span>
              )}
            </span>
            {summary && (
              <span className="block text-xs font-normal text-muted-foreground">
                {summary}
              </span>
            )}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 px-4 pb-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
