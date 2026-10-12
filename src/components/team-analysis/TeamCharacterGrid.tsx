import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Keep each character at least 16rem wide before adding another column. */
export function TeamCharacterGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-w-0 [container-type:inline-size] [container-name:team-characters]">
      <div
        className={cn(
          "grid grid-cols-1 gap-1 lg:gap-2",
          "[@container_team-characters_(min-width:32.5rem)]:grid-cols-2",
          "[@container_team-characters_(min-width:66rem)]:grid-cols-4",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
