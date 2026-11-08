import type { GOODData } from "./goodConversion";

/** Missing identity is normal. A supplied, malformed identity must not select a fallback. */
export function readGOODIdentity(
  good: GOODData
): { uid: string; nickname?: string } | null {
  const metadata: unknown = good.metadata;
  if (metadata === undefined) return null;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    throw new Error("Invalid GOOD identity metadata");
  if (!("uid" in metadata) || metadata.uid === undefined) return null;
  if (
    typeof metadata.uid !== "string" ||
    !/^[1-9]\d{8,9}$/.test(metadata.uid.trim())
  )
    throw new Error("Invalid GOOD account UID");
  let nickname: string | undefined;
  if ("nickname" in metadata && metadata.nickname !== undefined) {
    if (
      typeof metadata.nickname !== "string" ||
      metadata.nickname.trim().length > 64
    )
      throw new Error("Invalid GOOD account nickname");
    nickname = metadata.nickname.trim() || undefined;
  }
  return { uid: metadata.uid.trim(), ...(nickname ? { nickname } : {}) };
}
