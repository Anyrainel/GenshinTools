import { useEffect, useState } from "react";
import type { AccountData } from "@/domain/models";
import {
  ArtifactManagerError,
  fetchContinuous,
} from "@/providers/scanner/companion/client";
import { readGOODIdentity } from "@/providers/scanner/formats/goodIdentity";
import { prepareContinuousImport } from "@/services/game-account/continuousImport";
import { identifiedAccountName } from "@/services/game-account/goodIdentity";
import { resolveIdentifiedImportTarget } from "@/services/game-account/importRouting";
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
  details?: string;
  updatedAt?: number;
  warnings?: number;
  targetProfileId?: number;
  routing?: "uid" | "profile";
}

/** Enabling authorizes the chosen fallback profile and automatic routing of detected UIDs. */
export function useContinuousInventorySync(
  fallbackProfileId: number | null,
  port: number
) {
  const [state, setState] = useState<ContinuousState>({ status: "off" });
  useEffect(() => {
    if (fallbackProfileId === null) {
      setState({ status: "off" });
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
    setState({ status: "connecting" });
    const poll = async () => {
      try {
        const snapshot = await fetchContinuous(port, controller.signal);
        if (disposed) return;
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
        const target = identity
          ? resolveIdentifiedImportTarget(accounts, identity.uid)
          : { accountId: fallbackProfileId };
        const profileId = target.promoteToId ?? target.accountId;
        const account = accounts[target.accountId];
        if (!identity && !account)
          throw new Error("The selected sync profile no longer exists.");
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
            accountId: target.accountId,
            data: result.data,
            artifactIdMap: result.artifactIdMap,
            earnedAchievementIds: result.earnedAchievementIds,
            ...(target.promoteToId !== undefined
              ? { promoteToId: target.promoteToId }
              : {}),
            ...(identity
              ? { name: identifiedAccountName(account, identity) }
              : {}),
          });
          imported = {
            profileId,
            content,
            data: useAccountStore.getState().accounts[profileId]?.data,
          };
          setState({
            status: "synced",
            updatedAt: snapshot.updatedAt,
            warnings: result.warnings.length,
            targetProfileId: profileId,
            routing: identity ? "uid" : "profile",
          });
        } else
          setState((previous) => ({
            ...previous,
            status: "synced",
            updatedAt: snapshot.updatedAt,
            targetProfileId: profileId,
            routing: identity ? "uid" : "profile",
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
  }, [fallbackProfileId, port]);
  return state;
}
