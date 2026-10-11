import type { ComponentProps } from "react";
import { AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export function FocusSafeAccordionContent({
  className,
  ...props
}: ComponentProps<typeof AccordionContent>) {
  return <AccordionContent className={cn("px-1 pt-1", className)} {...props} />;
}
