import { describe, expect, it } from "vitest";
import {
  ARTIFACT_SET_ROLE_IDS,
  DPS_ARTIFACT_SET_IDS,
  TIER_LIST_OTHER_ARTIFACT_SETS,
  TIER_LIST_SUPPORT_ARTIFACT_SETS,
  TRIAGE_SUPPORT_ARTIFACT_SETS,
} from "@/data/constants";
import { artifacts } from "@/data/resources";

describe("artifact support set constants", () => {
  it("assigns every released artifact set exactly one role", () => {
    const assignments = Object.values(ARTIFACT_SET_ROLE_IDS).flat();
    expect(new Set(assignments).size).toBe(assignments.length);
    expect(new Set(assignments)).toEqual(
      new Set(artifacts.map((artifact) => artifact.id))
    );
  });

  it("includes 4-star support sets for artifact tier list grouping only", () => {
    for (const setId of ["the_exile", "instructor", "scholar"]) {
      expect(TIER_LIST_SUPPORT_ARTIFACT_SETS.has(setId)).toBe(true);
      expect(TRIAGE_SUPPORT_ARTIFACT_SETS.has(setId)).toBe(false);
    }
  });

  it("classifies the latest released sets from their effects", () => {
    for (const setId of ["celestial_gift", "heart_of_the_furnace"]) {
      expect(TRIAGE_SUPPORT_ARTIFACT_SETS.has(setId)).toBe(true);
    }
    for (const setId of [
      "a_day_carved_from_rising_winds",
      "disenchantment_in_deep_shadow",
      "scarlet_proof",
    ]) {
      expect(DPS_ARTIFACT_SET_IDS).toContain(setId);
    }
  });

  it("keeps explicit other sets separate from support grouping", () => {
    for (const setId of ["retracing_bolide", "lavawalker", "thundersoother"]) {
      expect(TIER_LIST_OTHER_ARTIFACT_SETS.has(setId)).toBe(true);
      expect(TIER_LIST_SUPPORT_ARTIFACT_SETS.has(setId)).toBe(false);
      expect(TRIAGE_SUPPORT_ARTIFACT_SETS.has(setId)).toBe(false);
    }
  });
});
