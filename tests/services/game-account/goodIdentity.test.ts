import { describe, expect, it } from "vitest";
import type { GOODData } from "@/providers/scanner/formats/goodConversion";
import { readGOODIdentity } from "@/providers/scanner/formats/goodIdentity";
import { identifiedAccountName } from "@/services/game-account/goodIdentity";
import { resolveIdentifiedImportTarget } from "@/services/game-account/importRouting";

const good: GOODData = { format: "GOOD", version: 3, source: "GGScanner" };
const profile = (id: number, name = `Account ${id}`) => ({
  id,
  name,
  data: { characters: [], extraArtifacts: [], extraWeapons: [] },
  lastUpdate: 0,
});

describe("GOOD account identity", () => {
  it("supports legacy exports without inventing an identity", () => {
    expect(readGOODIdentity(good)).toBeNull();
    expect(readGOODIdentity({ ...good, metadata: {} })).toBeNull();
  });
  it("reads and normalizes optional account identity", () => {
    expect(
      readGOODIdentity({
        ...good,
        metadata: { uid: " 800000001 ", nickname: " Player " },
      })
    ).toEqual({ uid: "800000001", nickname: "Player" });
  });
  it.each(["", "0", "000000000", "not-a-uid", "80000000", "80000000000"])(
    "rejects invalid supplied UID %s instead of silently selecting fallback",
    (uid) => {
      expect(() => readGOODIdentity({ ...good, metadata: { uid } })).toThrow();
    }
  );
  it("always uses an existing UID profile before default, and binds only default", () => {
    expect(
      resolveIdentifiedImportTarget(
        { 0: profile(0), 800000001: profile(800000001) },
        "800000001"
      )
    ).toEqual({ accountId: 800000001 });
    expect(
      resolveIdentifiedImportTarget(
        { 0: profile(0), 800000002: profile(800000002) },
        "800000001"
      )
    ).toEqual({ accountId: 0, promoteToId: 800000001 });
    expect(
      resolveIdentifiedImportTarget(
        { 800000002: profile(800000002) },
        "800000001"
      )
    ).toEqual({ accountId: 800000001 });
  });
  it("uses nickname for a generated label while preserving a custom profile name", () => {
    const identity = { uid: "800000001", nickname: "Player" };
    expect(identifiedAccountName(profile(0, "Default Account"), identity)).toBe(
      "Player"
    );
    expect(identifiedAccountName(profile(0, "My account"), identity)).toBe(
      "My account"
    );
    expect(identifiedAccountName(undefined, identity)).toBe("Player");
  });
});
