import { type LogtoConfig, UserScope } from "@logto/react";

export const DEFAULT_LOGTO_ENDPOINT = "https://synz8r.logto.app";
export const DEFAULT_LOGTO_APP_ID = "tglrsenlbfrfrnevjwlan";
export const DEFAULT_LOGTO_API_RESOURCE = "https://ggartifact.com/api";

export const LOGTO_ENDPOINT =
  import.meta.env.VITE_LOGTO_ENDPOINT?.trim() || DEFAULT_LOGTO_ENDPOINT;
export const LOGTO_APP_ID =
  import.meta.env.VITE_LOGTO_APP_ID?.trim() || DEFAULT_LOGTO_APP_ID;
export const LOGTO_API_RESOURCE =
  import.meta.env.VITE_LOGTO_API_RESOURCE?.trim() || DEFAULT_LOGTO_API_RESOURCE;

export const logtoConfig: LogtoConfig = {
  endpoint: LOGTO_ENDPOINT,
  appId: LOGTO_APP_ID,
  resources: [LOGTO_API_RESOURCE],
  scopes: buildLogtoScopes(import.meta.env.VITE_LOGTO_SCOPES),
};

export function getLogtoRedirectUri(): string {
  return new URL("/callback", window.location.origin).toString();
}

export function getLogtoPostSignInRedirectUri(): string {
  return new URL("/account", window.location.origin).toString();
}

export function getLogtoPostSignOutRedirectUri(): string {
  return new URL("/", window.location.origin).toString();
}

export function getLogtoAccountCenterSecurityUrl(): string {
  const url = new URL("/account/security", LOGTO_ENDPOINT);
  url.searchParams.set("redirect", window.location.href);
  return url.toString();
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
