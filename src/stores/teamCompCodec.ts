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

import {
  allArtifacts,
  allCharacters,
  allHalfSets,
  allWeapons,
} from "@/data/gameResources";
import { characterStatsResource } from "@/data/gameStatsLoader";
import type { ArtifactSetConfig } from "@/data/types";
import { toBase64 } from "@/lib/base64";

// ── Index maps (built once at module load) ──
// Indexes are 1-based, oldest entity = 1, newest = N. New entries (prepended
// to the source lists) get N+1 without shifting existing indexes.

const charToIdx = new Map(allCharacters.map((c, i, a) => [c.id, a.length - i]));
const weaponToIdx = new Map(allWeapons.map((w, i, a) => [w.id, a.length - i]));
const artSetToIdx = new Map(
  allArtifacts.map((a, i, arr) => [a.id, arr.length - i])
);
const halfSetToIdx = new Map(
  allHalfSets.map((h, i, a) => [h.id, a.length - i])
);

// ── Sorting ──

// Build release-date sort key lazily from the already-loaded character stats cache.
// By the time teams are sorted, gameStatsLoader has always loaded character_stats.json.
let charReleaseSortKey: Map<string, number> | null = null;

function ensureSortKeys(): Map<string, number> {
  if (charReleaseSortKey) return charReleaseSortKey;
  charReleaseSortKey = new Map();
  const stats = characterStatsResource.peek();
  if (stats) {
    for (const [id, entry] of Object.entries(stats)) {
      const d = (entry as { releaseDate?: string }).releaseDate
        ? new Date((entry as { releaseDate?: string }).releaseDate!).getTime()
        : 0;
      charReleaseSortKey.set(id, d > 0 ? -d : 0);
    }
  }
  return charReleaseSortKey;
}

/**
 * Sort key for a character by release date descending (newest first).
 * Callers sort ascending (`a - b`), so newer characters get smaller keys.
 * Null/unknown characters sort last (large positive number).
 */
export function charSortKey(charId: string | null | undefined): number {
  if (!charId) return Number.MAX_SAFE_INTEGER;
  return ensureSortKeys().get(charId) ?? Number.MAX_SAFE_INTEGER - 1;
}

const BITS_PER_MEMBER = 27n;

/**
 * Encode a team composition (4 slots) into a single stable base64 ID.
 * Packs all 4 members into one BigInt (27 bits each = 108 bits total).
 */
export function encodeTeamId(
  characters: (string | null)[],
  weapons: (string | null)[],
  artifacts: (ArtifactSetConfig | null)[]
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
  artifact: ArtifactSetConfig | null
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
      const h1 = halfSetToIdx.get(String(artifact.halfSetIds[0])) ?? 0;
      const h2 = halfSetToIdx.get(String(artifact.halfSetIds[1])) ?? 0;
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
