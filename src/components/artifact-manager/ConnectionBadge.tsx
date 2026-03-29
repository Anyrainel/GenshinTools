import type { ConnectionState } from "@/hooks/useArtifactManagerConnection";
import { cn } from "@/lib/utils";

interface ConnectionBadgeProps {
  connection: ConnectionState;
  className?: string;
}

export function ConnectionBadge({
  connection,
  className,
}: ConnectionBadgeProps) {
  const isReady =
    connection.status === "connected" &&
    connection.health.enabled &&
    connection.health.gameAlive &&
    !connection.health.busy;

  const isConnectedButBusy =
    connection.status === "connected" &&
    (!connection.health.enabled ||
      !connection.health.gameAlive ||
      connection.health.busy);

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isReady
            ? "bg-green-500"
            : isConnectedButBusy
              ? "bg-yellow-500"
              : "bg-muted-foreground"
        )}
      />
      {isReady
        ? "Manager ready"
        : isConnectedButBusy
          ? connection.health.busy
            ? "Busy"
            : !connection.health.gameAlive
              ? "Game not running"
              : "Paused"
          : "Manager offline"}
    </span>
  );
}
