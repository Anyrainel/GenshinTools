/**
 * Team comp encoding and sorting utilities.
 *
 * Encodes a team composition (4 × char+weapon+artifact) into a stable
 * base64 ID. Also provides release-date-based sort keys.
 *
 * Bit layout per member (27 bits):
 *   charIdx(8) | weaponIdx(8) | artType(1) | artPayload(10)
 *
 * artPayload when artType=0 (4pc):     setIdx(6) | padding(4)
 * artPayload when artType=1 (2pc+2pc): half1Idx(5) | half2Idx(5)
 *
 * Index 0 = null/empty for all fields.
 * Indices are 1-based into the resource arrays.
 */

import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import characterStatsJson from "@/data/game/character_stats.json";
import {
  artifactHalfSets,
  artifacts,
  characters,
  weapons,
} from "@/data/resources";
import { toBase64 } from "@/lib/base64";

// ── Index maps (built once at module load) ──

const charToIdx = new Map(characters.map((c, i) => [c.id, i + 1]));
const weaponToIdx = new Map(weapons.map((w, i) => [w.id, i + 1]));
const artSetToIdx = new Map(artifacts.map((a, i) => [a.id, i + 1]));
const halfSetToIdx = new Map(artifactHalfSets.map((h, i) => [h.id, i + 1]));

// ── Sorting ──

// Build release-date sort key: charId → negative timestamp so newer = smaller.
const charReleaseSortKey = new Map<string, number>();
for (const [id, stats] of Object.entries(
  characterStatsJson as Record<string, { releaseDate?: string }>
)) {
  const d = stats.releaseDate ? new Date(stats.releaseDate).getTime() : 0;
  // Negate so that newer dates produce smaller numbers (sort ascending = newest first)
  charReleaseSortKey.set(id, d > 0 ? -d : 0);
}

/**
 * Sort key for a character by release date descending (newest first).
 * Callers sort ascending (`a - b`), so newer characters get smaller keys.
 * Null/unknown characters sort last (large positive number).
 */
export function charSortKey(charId: string | null | undefined): number {
  if (!charId) return Number.MAX_SAFE_INTEGER;
  return charReleaseSortKey.get(charId) ?? Number.MAX_SAFE_INTEGER - 1;
}

// ── Public API ──

const BITS_PER_MEMBER = 27n;

/**
 * Encode a team composition (4 slots) into a single stable base64 ID.
 * Packs all 4 members into one BigInt (27 bits each = 108 bits total).
 */
export function encodeTeamId(
  characters: (string | null)[],
  weapons: (string | null)[],
  artifacts: (ArtifactConfig | null)[]
): string {
  let packed = 0n;
  for (let i = 0; i < 4; i++) {
    const memberBits = packMember(
      characters[i] ?? null,
      weapons[i] ?? null,
      artifacts[i] ?? null
    );
    packed = (packed << BITS_PER_MEMBER) | memberBits;
  }
  return toBase64(packed);
}

/** Pack a single member into a BigInt (no base64 conversion). */
function packMember(
  charId: string | null,
  weaponId: string | null,
  artifact: ArtifactConfig | null
): bigint {
  const ci = charId ? (charToIdx.get(charId) ?? 0) : 0;
  const wi = weaponId ? (weaponToIdx.get(weaponId) ?? 0) : 0;

  let artType = 0;
  let artPayload = 0;
  if (artifact) {
    if (artifact.type === "4pc") {
      artPayload = artSetToIdx.get(artifact.setId) ?? 0;
    } else {
      artType = 1;
      const h1 = halfSetToIdx.get(String(artifact.id1)) ?? 0;
      const h2 = halfSetToIdx.get(String(artifact.id2)) ?? 0;
      artPayload = (h1 << 5) | h2;
    }
  }

  return (
    (BigInt(ci) << 19n) |
    (BigInt(wi) << 11n) |
    (BigInt(artType) << 10n) |
    BigInt(artPayload)
  );
}
