import type { AccountState } from "@/domain/game-account/types";

/** Keep a player's custom profile label when enriching a default or UID profile. */
export function identifiedAccountName(
  account: AccountState | undefined,
  identity: { uid: string; nickname?: string }
): string {
  const name = account?.name;
  const generated =
    !name ||
    name === "Default Account" ||
    name === "默认账号" ||
    name === "Account 0" ||
    name === "0" ||
    name === identity.uid ||
    name === `Account ${identity.uid}`;
  return generated
    ? (identity.nickname ??
        (account?.id === 0 ? identity.uid : name) ??
        identity.uid)
    : name;
}
