import { describe, expect, it } from "vitest";
import {
  buildExactAuthoredEnergyDeferralCatalog,
  requireExactAuthoredEnergyDeferralMatches,
  type ExactAuthoredEnergyDeferralOccurrence,
} from "../src/exactAuthoredEnergyDeferralCatalog";
import { sha256Text, stableJson } from "../src/io";

describe("exact authored energy deferral catalog", () => {
  it("pins nine exact ordered condition arrays without prose classification", () => {
    const entries = buildExactAuthoredEnergyDeferralCatalog();
    expect(entries).toHaveLength(9);
    expect(new Set(entries.map(({ occurrenceId }) => occurrenceId)).size).toBe(
      9,
    );
    expect(
      entries.every(
        (entry) =>
          entry.conditionsSha256 ===
            sha256Text(stableJson(entry.orderedConditions)) &&
          entry.occurrenceKey ===
            `${entry.occurrenceId}:${entry.conditionsSha256}` &&
          entry.category.length > 0 &&
          entry.reason.length > 0,
      ),
    ).toBe(true);
  });

  it("fails closed on partial, duplicate, orphan, hash-mismatched, or payload-mismatched catalogs", () => {
    const entries = buildExactAuthoredEnergyDeferralCatalog();
    const occurrences = entries.map(
      (entry) =>
        ({
          occurrenceId: entry.occurrenceId,
          conditionsSha256: entry.conditionsSha256,
          subject: entry.subject,
          conditions: [...entry.orderedConditions],
          structuralEnergyDimension: "not-structural-er",
        }) satisfies ExactAuthoredEnergyDeferralOccurrence,
    );
    expect(
      requireExactAuthoredEnergyDeferralMatches(occurrences, entries).size,
    ).toBe(9);

    expect(() =>
      requireExactAuthoredEnergyDeferralMatches(
        occurrences,
        entries.slice(0, -1),
      ),
    ).toThrow("Expected 9");

    const duplicate = structuredClone(entries);
    duplicate[duplicate.length - 1] = structuredClone(duplicate[0]!);
    expect(() =>
      requireExactAuthoredEnergyDeferralMatches(occurrences, duplicate),
    ).toThrow("Duplicate or conflicting");

    expect(() =>
      requireExactAuthoredEnergyDeferralMatches(occurrences.slice(0, -1), entries),
    ).toThrow("Orphan authored energy deferral");

    const hashMismatch = structuredClone(occurrences);
    hashMismatch[0]!.conditionsSha256 = "0".repeat(64);
    expect(() =>
      requireExactAuthoredEnergyDeferralMatches(hashMismatch, entries),
    ).toThrow("ordered-condition hash mismatch");

    const payloadMismatch = structuredClone(occurrences);
    payloadMismatch[0]!.subject = "not-diona";
    expect(() =>
      requireExactAuthoredEnergyDeferralMatches(payloadMismatch, entries),
    ).toThrow("payload mismatch");
  });
});
