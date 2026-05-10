import { useLogto } from "@logto/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getLogtoPostSignInRedirectUri,
  getLogtoPostSignOutRedirectUri,
  getLogtoRedirectUri,
  rememberLogtoReturnPath,
} from "@/cloud/authConfig";
import {
  AppSessionError,
  type AppSessionUser,
  clearAppSession,
  createAppSession,
  getAppSessionUser,
} from "@/cloud/session";

export type AppSessionContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | undefined;
  account: AppSessionUser | null;
  accountError: string | null;
  refresh: () => Promise<AppSessionUser | null>;
  ensureSession: () => Promise<AppSessionUser | null>;
  createSession: () => Promise<AppSessionUser | null>;
  signIn: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);
const missingProviderSession: AppSessionContextValue = {
  isAuthenticated: false,
  isLoading: false,
  error: undefined,
  account: null,
  accountError: null,
  refresh: async () => null,
  ensureSession: async () => null,
  createSession: async () => null,
  signIn: async () => undefined,
  signOut: async () => undefined,
};

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated: isLogtoAuthenticated,
    isLoading: isLogtoLoading,
    error,
    signIn: logtoSignIn,
    signOut: logtoSignOut,
    getIdToken,
  } = useLogto();
  const [account, setAccount] = useState<AppSessionUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);

  const establishSession =
    useCallback(async (): Promise<AppSessionUser | null> => {
      try {
        const session = await createAppSession({ getIdToken });
        setAccount(session.user);
        setAccountError(null);
        return session.user;
      } catch (sessionError) {
        setAccount(null);
        setAccountError(toSessionErrorMessage(sessionError));
        return null;
      }
    }, [getIdToken]);

  const refresh = useCallback(async (): Promise<AppSessionUser | null> => {
    setIsLoadingSession(true);
    try {
      const user = await getAppSessionUser();
      setAccount(user);
      setAccountError(null);
      return user;
    } catch (sessionError) {
      setAccount(null);
      if (isAppSessionUnauthenticatedError(sessionError)) {
        setAccountError(null);
      } else {
        setAccountError(toSessionErrorMessage(sessionError));
      }
      return null;
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  const ensureSession =
    useCallback(async (): Promise<AppSessionUser | null> => {
      setIsLoadingSession(true);
      try {
        const user = await getAppSessionUser();
        setAccount(user);
        setAccountError(null);
        return user;
      } catch (sessionError) {
        if (
          isAppSessionUnauthenticatedError(sessionError) &&
          isLogtoAuthenticated
        ) {
          return establishSession();
        }
        setAccount(null);
        setAccountError(
          isAppSessionUnauthenticatedError(sessionError)
            ? null
            : toSessionErrorMessage(sessionError)
        );
        return null;
      } finally {
        setIsLoadingSession(false);
      }
    }, [establishSession, isLogtoAuthenticated]);

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
    setAccount(null);
    setAccountError(null);
    await logtoSignOut(getLogtoPostSignOutRedirectUri());
  }, [logtoSignOut]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingSession(true);
    void (async () => {
      const user = await ensureSession();
      if (cancelled) return;
      setAccount(user);
      setIsLoadingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureSession]);

  const value = useMemo<AppSessionContextValue>(
    () => ({
      isAuthenticated: account !== null,
      isLoading: isLoadingSession || (!account && isLogtoLoading),
      error,
      account,
      accountError,
      refresh,
      ensureSession,
      createSession: establishSession,
      signIn,
      signOut,
    }),
    [
      account,
      accountError,
      ensureSession,
      error,
      establishSession,
      isLoadingSession,
      isLogtoLoading,
      refresh,
      signIn,
      signOut,
    ]
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession(): AppSessionContextValue {
  const value = useContext(AppSessionContext);
  return value ?? missingProviderSession;
}

export function isAppSessionUnauthenticatedError(error: unknown): boolean {
  return (
    error instanceof AppSessionError &&
    error.status === 401 &&
    !!error.payload &&
    typeof error.payload === "object" &&
    "error" in error.payload &&
    error.payload.error === "unauthenticated"
  );
}

function toSessionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
