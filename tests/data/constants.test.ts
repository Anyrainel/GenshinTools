import { describe, expect, it } from "vitest";
import {
  TIER_LIST_OTHER_ARTIFACT_SETS,
  TIER_LIST_SUPPORT_ARTIFACT_SETS,
  TRIAGE_SUPPORT_ARTIFACT_SETS,
} from "@/data/constants";

describe("artifact support set constants", () => {
  it("includes 4-star support sets for artifact tier list grouping only", () => {
    for (const setId of ["the_exile", "instructor", "scholar"]) {
      expect(TIER_LIST_SUPPORT_ARTIFACT_SETS.has(setId)).toBe(true);
      expect(TRIAGE_SUPPORT_ARTIFACT_SETS.has(setId)).toBe(false);
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
