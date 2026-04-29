import type { AccountData } from "@/data/types";

/**
 * Logical account profile id. Profile 0 is the local no-UID/default profile;
 * UID-backed profiles use the numeric UID.
 */
export type AccountProfileId = number;

/**
 * Persisted account slot shape. One entry per profile (UID or profile 0).
 * Defined here so pure account-data logic across src/lib/ can depend on it
 * without reaching into the stores layer.
 */
export type AccountState = {
  /** Profile id. 0 is the no-UID/default profile; UID profiles use the numeric UID. */
  id: AccountProfileId;
  name: string;
  data: AccountData;
  lastUpdate: number;
};
