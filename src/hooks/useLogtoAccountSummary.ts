import { useLogto } from "@logto/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getLogtoPostSignInRedirectUri,
  getLogtoPostSignOutRedirectUri,
  getLogtoRedirectUri,
  rememberLogtoReturnPath,
} from "@/cloud/authConfig";
import { clearAppSession } from "@/cloud/session";

export type LogtoAccountSummary = {
  subject: string;
  displayName?: string;
  email?: string;
};

export type LogtoAccountSummaryHook = {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | undefined;
  account: LogtoAccountSummary | null;
  accountError: string | null;
  signIn: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export function useLogtoAccountSummary(): LogtoAccountSummaryHook {
  const {
    isAuthenticated,
    isLoading,
    error,
    signIn: logtoSignIn,
    signOut: logtoSignOut,
    getIdTokenClaims,
  } = useLogto();
  const [account, setAccount] = useState<LogtoAccountSummary | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccount(null);
      setAccountError(null);
      return;
    }

    let cancelled = false;
    void getIdTokenClaims()
      .then((claims) => {
        if (cancelled) return;
        if (!claims) {
          setAccount(null);
          setAccountError(null);
          return;
        }
        setAccount({
          subject: claims.sub,
          displayName: claims.name ?? claims.username ?? undefined,
          email: claims.email ?? undefined,
        });
        setAccountError(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setAccount(null);
        setAccountError(
          loadError instanceof Error ? loadError.message : String(loadError)
        );
      });

    return () => {
      cancelled = true;
    };
  }, [getIdTokenClaims, isAuthenticated]);

  const signIn = useCallback(
    async (returnTo?: string) => {
      const returnPath = rememberLogtoReturnPath(
        returnTo ?? window.location.href
      );
      await logtoSignIn({
        redirectUri: getLogtoRedirectUri(),
        postRedirectUri: getLogtoPostSignInRedirectUri(returnPath),
      });
    },
    [logtoSignIn]
  );

  const signOut = useCallback(async () => {
    await clearAppSession().catch(() => undefined);
    await logtoSignOut(getLogtoPostSignOutRedirectUri());
  }, [logtoSignOut]);

  return useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      error,
      account,
      accountError,
      signIn,
      signOut,
    }),
    [account, accountError, error, isAuthenticated, isLoading, signIn, signOut]
  );
}
