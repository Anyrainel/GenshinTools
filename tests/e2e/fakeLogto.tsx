import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type LogtoConfig = {
  endpoint: string;
  appId: string;
  resources?: string[];
  scopes?: string[];
};

export const UserScope = {
  Email: "email",
  Profile: "profile",
} as const;

type E2eLogtoUser = {
  sub: string;
  name?: string;
  email?: string;
};

const STORAGE_KEY = "gg_e2e_logto_user";
const DEFAULT_USER: E2eLogtoUser = {
  sub: "e2e-default-user",
  name: "E2E User",
  email: "e2e@example.test",
};

export function LogtoProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useLogto() {
  const [user, setUser] = useState<E2eLogtoUser | null>(() => readUser());

  useEffect(() => {
    const onAuthChanged = () => setUser(readUser());
    window.addEventListener("storage", onAuthChanged);
    window.addEventListener("gg-e2e-logto-change", onAuthChanged);
    return () => {
      window.removeEventListener("storage", onAuthChanged);
      window.removeEventListener("gg-e2e-logto-change", onAuthChanged);
    };
  }, []);

  const signIn = useCallback(async () => {
    writeUser(readNextUser() ?? DEFAULT_USER);
  }, []);

  const signOut = useCallback(async () => {
    window.localStorage.removeItem(STORAGE_KEY);
    dispatchAuthChanged();
  }, []);

  const getIdTokenClaims = useCallback(async () => {
    const current = readUser();
    if (!current) return null;
    return {
      sub: current.sub,
      name: current.name,
      email: current.email,
    };
  }, []);

  const getAccessToken = useCallback(async () => {
    const current = readUser();
    if (!current) return null;
    return fetchToken(current);
  }, []);

  const getIdToken = useCallback(async () => {
    const current = readUser();
    if (!current) return null;
    return fetchToken(current);
  }, []);

  return useMemo(
    () => ({
      isAuthenticated: user !== null,
      isLoading: false,
      error: undefined,
      signIn,
      signOut,
      getIdTokenClaims,
      getIdToken,
      getAccessToken,
    }),
    [getAccessToken, getIdToken, getIdTokenClaims, signIn, signOut, user]
  );
}

export function useHandleSignInCallback(callback?: () => void) {
  useEffect(() => {
    callback?.();
  }, [callback]);
  return { isLoading: false, error: undefined };
}

function readUser(): E2eLogtoUser | null {
  return readStoredUser(STORAGE_KEY);
}

function readNextUser(): E2eLogtoUser | null {
  return readStoredUser("gg_e2e_next_logto_user");
}

function readStoredUser(key: string): E2eLogtoUser | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<E2eLogtoUser>;
    if (!parsed.sub || typeof parsed.sub !== "string") return null;
    return {
      sub: parsed.sub,
      ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
      ...(typeof parsed.email === "string" ? { email: parsed.email } : {}),
    };
  } catch {
    return null;
  }
}

function writeUser(user: E2eLogtoUser): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  dispatchAuthChanged();
}

function dispatchAuthChanged(): void {
  window.dispatchEvent(new Event("gg-e2e-logto-change"));
}

async function fetchToken(current: E2eLogtoUser): Promise<string> {
  const params = new URLSearchParams({ sub: current.sub });
  if (current.name) params.set("name", current.name);
  if (current.email) params.set("email", current.email);
  const response = await fetch(`/__e2e__/token?${params}`);
  if (!response.ok) {
    throw new Error(`E2E token fixture failed with HTTP ${response.status}`);
  }
  const body = (await response.json()) as { accessToken?: string };
  if (!body.accessToken) throw new Error("E2E token fixture returned no token");
  return body.accessToken;
}
