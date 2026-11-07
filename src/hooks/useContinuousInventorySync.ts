import { useEffect, useRef, useState } from "react";
import type { AccountData } from "@/domain/models";
import {
  ArtifactManagerError,
  type ContinuousSnapshot,
  fetchContinuous,
} from "@/providers/scanner/companion/client";
import { prepareContinuousImport } from "@/services/game-account/continuousImport";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { useAccountStore } from "@/stores/useAccountStore";

export type ContinuousStatus =
  | "off"
  | "connecting"
  | "waiting"
  | "confirm"
  | "synced"
  | "disabled"
  | "unsupported"
  | "failed"
  | "disconnected"
  | "invalid";

export function useContinuousInventorySync(enabled: boolean, port: number) {
  const accountId = useAccountStore((s) => s.activeAccountId);
  const [state, setState] = useState<{
    status: ContinuousStatus;
    details?: string;
    updatedAt?: number;
    warnings?: number;
  }>({ status: "off" });
  const pending = useRef<ContinuousSnapshot | null>(null);
  const approvedSession = useRef<string | null>(null);
  const lastContent = useRef<string | null>(null);
  const lastRevision = useRef<{ sessionId: string; revision: number } | null>(
    null
  );
  const reviewData = useRef<AccountData | null>(null);
  const approvedData = useRef<AccountData | null>(null);

  useEffect(() => {
    approvedSession.current = null;
    lastContent.current = null;
    pending.current = null;
    lastRevision.current = null;
    reviewData.current = null;
    approvedData.current = null;
    if (!enabled || accountId === null) {
      setState({ status: "off" });
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setState({ status: "connecting" });
    const poll = async () => {
      try {
        const snapshot = await fetchContinuous(port, controller.signal);
        if (
          disposed ||
          useAccountStore.getState().activeAccountId !== accountId
        )
          return;
        const account = useAccountStore.getState().accounts[accountId];
        if (!account) return;
        if (
          (approvedData.current && approvedData.current !== account.data) ||
          (reviewData.current && reviewData.current !== account.data)
        ) {
          approvedSession.current = null;
          approvedData.current = null;
          lastContent.current = null;
          lastRevision.current = null;
        }
        pending.current = snapshot;
        reviewData.current = account.data;
        if (approvedSession.current !== snapshot.sessionId) {
          approvedSession.current = null;
          setState({ status: "confirm" });
        } else {
          if (
            lastRevision.current?.sessionId === snapshot.sessionId &&
            snapshot.revision < lastRevision.current.revision
          )
            return;
          lastRevision.current = {
            sessionId: snapshot.sessionId,
            revision: snapshot.revision,
          };
          const content = JSON.stringify(snapshot.data);
          if (content !== lastContent.current) {
            const result = prepareContinuousImport(snapshot.data, account.data);
            applyAccountImport({
              accountId,
              data: result.data,
              artifactIdMap: result.artifactIdMap,
              earnedAchievementIds: result.earnedAchievementIds,
            });
            approvedData.current =
              useAccountStore.getState().accounts[accountId]?.data ?? null;
            reviewData.current = approvedData.current;
            lastContent.current = content;
            setState({
              status: "synced",
              updatedAt: snapshot.updatedAt,
              warnings: result.warnings.length,
            });
          } else {
            setState((previous) => ({
              ...previous,
              status: "synced",
              updatedAt: snapshot.updatedAt,
            }));
          }
        }
      } catch (error) {
        if (disposed) return;
        approvedSession.current = null;
        pending.current = null;
        approvedData.current = null;
        reviewData.current = null;
        lastRevision.current = null;
        let status: ContinuousStatus = "disconnected";
        let details: string | undefined;
        if (error instanceof ArtifactManagerError) {
          let body: { error?: string; details?: string } = {};
          try {
            const parsed = JSON.parse(error.body);
            if (parsed && typeof parsed === "object") body = parsed;
          } catch {
            /* Older scanners may return plain text. */
          }
          status =
            error.status === 409 && body.error === "continuous_capture_disabled"
              ? "disabled"
              : error.status === 503 &&
                  body.error === "continuous_capture_no_data"
                ? "waiting"
                : error.status === 503 &&
                    body.error === "continuous_capture_failed"
                  ? "failed"
                  : error.status === 404 ||
                      error.status === 405 ||
                      error.status === 501
                    ? "unsupported"
                    : "failed";
          details =
            typeof body.details === "string"
              ? body.details
              : typeof body.error === "string"
                ? body.error
                : error.body;
        } else if (
          error instanceof Error &&
          !(error instanceof TypeError) &&
          error.name !== "AbortError"
        ) {
          status = "invalid";
          details = error.message;
        }
        setState({ status, details });
      } finally {
        if (!disposed) timer = setTimeout(poll, 3000);
      }
    };
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, port, accountId]);

  return {
    ...state,
    confirm: () => {
      if (!pending.current) return;
      const currentData =
        accountId === null ||
        useAccountStore.getState().activeAccountId !== accountId
          ? null
          : useAccountStore.getState().accounts[accountId]?.data;
      if (!currentData || currentData !== reviewData.current) {
        pending.current = null;
        approvedSession.current = null;
        approvedData.current = null;
        reviewData.current = null;
        lastContent.current = null;
        lastRevision.current = null;
        setState({ status: "connecting" });
        return;
      }
      approvedSession.current = pending.current.sessionId;
      approvedData.current = currentData;
      setState({ status: "connecting" });
    },
  };
}
