import {
  ArtifactManagerError,
  checkHealth,
} from "@/lib/account-data/manager/client";
import type { HealthResponse } from "@/lib/account-data/manager/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionState =
  | { status: "disconnected" }
  | { status: "connected"; health: HealthResponse }
  | { status: "error"; httpStatus: number; body: string }
  | { status: "cors-blocked" };

const POLL_INTERVAL = 5000;
const PROBE_TIMEOUT_MS = 3000;

/**
 * Probe whether the server is reachable at all using a no-cors fetch.
 * Returns true if the server responds (even if CORS blocks reading it).
 */
async function isServerReachable(port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`http://127.0.0.1:${port}/health`, {
      mode: "no-cors",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

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
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof ArtifactManagerError) {
        setState({
          status: "error",
          httpStatus: err.status,
          body: err.body,
        });
      } else {
        const reachable = await isServerReachable(port);
        if (!mountedRef.current) return;
        setState(
          reachable ? { status: "cors-blocked" } : { status: "disconnected" }
        );
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
