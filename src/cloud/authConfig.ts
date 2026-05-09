import { type LogtoConfig, UserScope } from "@logto/react";

export const DEFAULT_LOGTO_ENDPOINT = "https://synz8r.logto.app";
export const DEFAULT_LOGTO_APP_ID = "tglrsenlbfrfrnevjwlan";

export const LOGTO_ENDPOINT =
  import.meta.env.VITE_LOGTO_ENDPOINT?.trim() || DEFAULT_LOGTO_ENDPOINT;
export const LOGTO_APP_ID =
  import.meta.env.VITE_LOGTO_APP_ID?.trim() || DEFAULT_LOGTO_APP_ID;
export const LOGTO_API_RESOURCE =
  import.meta.env.VITE_LOGTO_API_RESOURCE?.trim() || "";
const LOGTO_RETURN_PATH_KEY = "logto:returnPath";
const FALLBACK_RETURN_PATH = "/";
const ACCOUNT_FALLBACK_RETURN_PATH = "/account/cloud-backup";

export const logtoConfig: LogtoConfig = {
  endpoint: LOGTO_ENDPOINT,
  appId: LOGTO_APP_ID,
  ...(LOGTO_API_RESOURCE ? { resources: [LOGTO_API_RESOURCE] } : {}),
  scopes: buildLogtoScopes(import.meta.env.VITE_LOGTO_SCOPES),
};

export function getLogtoRedirectUri(): string {
  return new URL("/callback", window.location.origin).toString();
}

export function getLogtoPostSignInRedirectUri(returnPath?: string): string {
  return new URL(
    normalizeLogtoReturnPath(returnPath),
    window.location.origin
  ).toString();
}

export function getLogtoPostSignOutRedirectUri(): string {
  return new URL("/", window.location.origin).toString();
}

export function getLogtoAccountCenterSecurityUrl(): string {
  const url = new URL("/account/security", LOGTO_ENDPOINT);
  url.searchParams.set("redirect", window.location.href);
  return url.toString();
}

export function rememberLogtoReturnPath(returnPath?: string): string {
  const normalized = normalizeLogtoReturnPath(returnPath);
  window.sessionStorage.setItem(LOGTO_RETURN_PATH_KEY, normalized);
  return normalized;
}

export function consumeLogtoReturnPath(): string {
  const stored = window.sessionStorage.getItem(LOGTO_RETURN_PATH_KEY);
  window.sessionStorage.removeItem(LOGTO_RETURN_PATH_KEY);
  return normalizeLogtoReturnPath(stored);
}

export function normalizeLogtoReturnPath(returnPath?: string | null): string {
  if (!returnPath) return FALLBACK_RETURN_PATH;
  let url: URL;
  try {
    url = new URL(returnPath, window.location.origin);
  } catch {
    return FALLBACK_RETURN_PATH;
  }
  if (url.origin !== window.location.origin) return FALLBACK_RETURN_PATH;
  if (url.pathname === "/callback") return FALLBACK_RETURN_PATH;
  if (url.pathname === "/account") return ACCOUNT_FALLBACK_RETURN_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildLogtoScopes(value: string | undefined): string[] {
  return [...new Set([UserScope.Email, ...parseScopes(value)])];
}

export function parseScopes(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}
