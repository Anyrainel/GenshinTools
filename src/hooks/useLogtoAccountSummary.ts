import { useLogto } from "@logto/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getLogtoPostSignInRedirectUri,
  getLogtoPostSignOutRedirectUri,
  getLogtoRedirectUri,
} from "@/cloud/authConfig";

export type LogtoAccountSummary = {
  subject: string;
  displayName?: string;
  email?: string;
};

export function useLogtoAccountSummary() {
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

  const signIn = useCallback(async () => {
    await logtoSignIn({
      redirectUri: getLogtoRedirectUri(),
      postRedirectUri: getLogtoPostSignInRedirectUri(),
    });
  }, [logtoSignIn]);

  const signOut = useCallback(async () => {
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
