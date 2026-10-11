import { Portal } from "@radix-ui/react-hover-card";
import type { ComponentProps } from "react";
import { HoverCardContent } from "@/components/ui/hover-card";

export function PortalHoverCardContent(
  props: ComponentProps<typeof HoverCardContent>
) {
  return (
    <Portal>
      <HoverCardContent {...props} />
    </Portal>
  );
}
