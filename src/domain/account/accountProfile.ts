import type { AccountProfileId } from "./types";

export const DEFAULT_ACCOUNT_PROFILE_ID: AccountProfileId = 0;

export function isDefaultAccountProfile(id: AccountProfileId): boolean {
  return id === DEFAULT_ACCOUNT_PROFILE_ID;
}

export function uidToAccountProfileId(uid: string): AccountProfileId | null {
  const trimmed = uid.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function accountProfileIdToString(id: AccountProfileId): string {
  return String(id);
}

export function legacyAccountProfileIdToNumber(
  value: string | number | null | undefined
): AccountProfileId | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }
  if (value === "default") return DEFAULT_ACCOUNT_PROFILE_ID;
  return uidToAccountProfileId(value);
}

export function legacyAccountProfileIdToNumberOrDefault(
  value: string | number | null | undefined
): AccountProfileId {
  return legacyAccountProfileIdToNumber(value) ?? DEFAULT_ACCOUNT_PROFILE_ID;
}
