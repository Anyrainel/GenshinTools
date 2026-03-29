import { checkHealth } from "@/lib/artifact-manager/client";
import type { HealthResponse } from "@/lib/artifact-manager/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionState =
  | { status: "disconnected" }
  | { status: "connected"; health: HealthResponse }
  | { status: "error"; message: string };

const POLL_INTERVAL = 5000;

/**
 * Poll artifact manager /health endpoint.
 * Only polls while `enabled` is true.
 */
export function useArtifactManagerConnection(enabled: boolean, port = 8765) {
  const [state, setState] = useState<ConnectionState>({
    status: "disconnected",
  });
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const health = await checkHealth(port);
      if (mountedRef.current) {
        setState({ status: "connected", health });
      }
    } catch {
      if (mountedRef.current) {
        setState({ status: "disconnected" });
      }
    }
  }, [port]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "disconnected" });
      return;
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [enabled, poll]);

  return { connection: state, refresh: poll };
}
