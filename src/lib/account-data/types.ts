import type { AccountData } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";

/**
 * Persisted account slot shape. One entry per profile (UID or "default").
 * Defined here so pure account-data logic across src/lib/ can depend on it
 * without reaching into the stores layer.
 */
export type AccountState = {
  /** Storage key. Either a Genshin UID string (e.g. "800000000") or the sentinel "default". */
  id: string;
  name: string;
  data: AccountData;
  scores: Record<string, ArtifactScoreResult | null>;
  lastUpdate: number;
};
