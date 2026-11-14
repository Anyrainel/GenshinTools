import { useEffect, useState } from "react";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/domain/game-account/accountProfile";
import type { AccountData } from "@/domain/models";
import {
  ArtifactManagerError,
  fetchContinuous,
} from "@/providers/scanner/companion/client";
import { readGOODIdentity } from "@/providers/scanner/formats/goodIdentity";
import { prepareContinuousImport } from "@/services/game-account/continuousImport";
import { identifiedAccountName } from "@/services/game-account/goodIdentity";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { useAccountStore } from "@/stores/useAccountStore";

export type ContinuousStatus =
  | "off"
  | "connecting"
  | "waiting"
  | "synced"
  | "disabled"
  | "unsupported"
  | "failed"
  | "disconnected"
  | "invalid";

interface ContinuousState {
  status: ContinuousStatus;
  isRequesting: boolean;
  requestStartedAt?: number;
  lastSyncedAt?: number;
  details?: string;
  updatedAt?: number;
  warnings?: number;
  targetProfileId?: number;
  routing?: "uid" | "default";
}

/** Identified captures update their UID profile; anonymous captures only update Default. */
export function useContinuousInventorySync(enabled: boolean, port: number) {
  const [state, setState] = useState<ContinuousState>({
    status: "off",
    isRequesting: false,
  });
  useEffect(() => {
    if (!enabled) {
      setState({ status: "off", isRequesting: false });
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let latestRevision: { sessionId: string; revision: number } | null = null;
    let imported: {
      profileId: number;
      content: string;
      data: AccountData | undefined;
    } | null = null;
    setState({ status: "connecting", isRequesting: false });
    const poll = async () => {
      setState((previous) => ({
        ...previous,
        isRequesting: true,
        requestStartedAt: Date.now(),
      }));
      try {
        const snapshot = await fetchContinuous(port, controller.signal);
        if (disposed) return;
        const receivedAt = Date.now();
        if (
          latestRevision?.sessionId === snapshot.sessionId &&
          snapshot.revision < latestRevision.revision
        )
          return;
        latestRevision = {
          sessionId: snapshot.sessionId,
          revision: snapshot.revision,
        };
        const identity = readGOODIdentity(snapshot.data);
        const accounts = useAccountStore.getState().accounts;
        const profileId = identity
          ? Number(identity.uid)
          : DEFAULT_ACCOUNT_PROFILE_ID;
        const account = accounts[profileId];
        const content = JSON.stringify(snapshot.data);
        if (
          imported?.profileId !== profileId ||
          imported.content !== content ||
          imported.data !== account?.data
        ) {
          const existing = account?.data ?? {
            characters: [],
            extraWeapons: [],
            extraArtifacts: [],
          };
          const result = prepareContinuousImport(snapshot.data, existing);
          applyAccountImport({
            accountId: profileId,
            data: result.data,
            artifactIdMap: result.artifactIdMap,
            earnedAchievementIds: result.earnedAchievementIds,
            name: identity
              ? identifiedAccountName(account, identity)
              : (account?.name ?? "Default Account"),
          });
          imported = {
            profileId,
            content,
            data: useAccountStore.getState().accounts[profileId]?.data,
          };
          setState((previous) => ({
            ...previous,
            status: "synced",
            details: undefined,
            lastSyncedAt: receivedAt,
            updatedAt: snapshot.updatedAt,
            warnings: result.warnings.length,
            targetProfileId: profileId,
            routing: identity ? "uid" : "default",
          }));
        } else
          setState((previous) => ({
            ...previous,
            status: "synced",
            details: undefined,
            lastSyncedAt: receivedAt,
            updatedAt: snapshot.updatedAt,
            targetProfileId: profileId,
            routing: identity ? "uid" : "default",
          }));
      } catch (error) {
        if (disposed) return;
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
                  : [404, 405, 501].includes(error.status)
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
        setState((previous) => ({ ...previous, status, details }));
      } finally {
        if (!disposed) {
          setState((previous) => ({ ...previous, isRequesting: false }));
          timer = setTimeout(poll, 3000);
        }
      }
    };
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, port]);
  return state;
}
