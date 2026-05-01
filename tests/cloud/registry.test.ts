import { describe, expect, it } from "vitest";
import {
  getCloudBackupDescriptors,
  getIncludedCloudBackupDescriptors,
} from "@/cloud/registry";

describe("cloud backup registry", () => {
  it("includes only source and selected settings descriptors in the default backup set", () => {
    const included = getIncludedCloudBackupDescriptors();
    const includedIds = new Set(included.map((descriptor) => descriptor.id));
    expect(includedIds).toEqual(
      new Set(["account", "builds", "teams", "tiers"])
    );
    expect(included.flatMap((descriptor) => descriptor.namespaces)).toEqual([
      "profile.app",
      "profile.game",
      "profile.artifacts",
      "builds",
      "teams",
      "tiers",
    ]);
    expect(included.map((descriptor) => descriptor.conflictPolicy)).toEqual([
      "profile-import-wins",
      "explicit-choice",
      "explicit-choice",
      "explicit-choice",
    ]);
  });

  it("explicitly classifies cache, session, and device-local stores as excluded", () => {
    const descriptors = getCloudBackupDescriptors();
    const excludedIds = descriptors
      .filter((descriptor) => !descriptor.includeInBackup)
      .map((descriptor) => descriptor.id);
    expect(excludedIds).toEqual(
      expect.arrayContaining([
        "account-score-cache",
        "team-result-cache",
        "preferences",
        "cloud-sync-metadata",
        "greeting",
        "session-nav",
        "archive-session",
        "analyzer-cache",
        "recommendation-cache",
        "pupgrade-cache",
        "buff-overrides",
      ])
    );
    for (const descriptor of descriptors.filter(
      (entry) => !entry.includeInBackup
    )) {
      expect(descriptor.namespaces).toEqual([]);
      expect(descriptor.conflictPolicy).toBe("excluded");
    }
  });
});
