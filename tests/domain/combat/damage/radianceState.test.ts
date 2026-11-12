import "@/providers/reference/statLoaders";
import { describe, expect, it } from "vitest";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import { characterStatsResource } from "@/domain/reference/stats";

await characterStatsResource.preload();

describe("TeamMeta — automatic Radiance state", () => {
  it.each([
    "alyosha",
    "beidou",
    "cyno",
    "danica",
    "mitya",
    "valeriy",
    "wriothesley",
    "yae_miko",
  ])("resolves %s's Conduct capability from an available field", (charId) => {
    const meta = new TeamMeta([...new Set([charId, "mitya"])]);

    expect(meta.getRadianceState(charId)).toBe("stellarConduct");
  });

  it.each(["yumemizuki_mizuki", "vesna"])(
    "resolves %s's Swirl capability from a party Stellar reaction",
    (charId) => {
      const meta = new TeamMeta([...new Set([charId, "vesna", "kaeya"])]);

      expect(meta.hasPolestarField()).toBe(false);
      expect(meta.getRadianceState(charId)).toBe("stellarSwirl");
    }
  );

  it.each([
    "anastasya",
    "diona",
    "odette",
    "qiqi",
    "sandrone",
    "traveler_cryo",
  ])("gives Conduct priority for dual-capability %s", (charId) => {
    const meta = new TeamMeta([
      ...new Set([charId, "sandrone", "fischl", "kaedehara_kazuha"]),
    ]);

    expect(meta.hasReaction("stellarConduct")).toBe(true);
    expect(meta.hasReaction("stellarSwirl")).toBe(true);
    expect(meta.getRadianceState(charId)).toBe("stellarConduct");
  });

  it("allows a dual carrier's Swirl path when no field is available", () => {
    const meta = new TeamMeta(["diona", "vesna"]);

    expect(meta.getRadianceState("diona")).toBe("stellarSwirl");
  });

  it("does not confuse an ordinary reaction, carrier, or unrelated teammate with an enabler", () => {
    const meta = new TeamMeta(["diona", "yumemizuki_mizuki", "fischl"]);

    expect(meta.hasReaction("stellarSwirl")).toBe(false);
    expect(meta.hasReaction("stellarConduct")).toBe(false);
    expect(meta.getRadianceState("diona")).toBeNull();
    expect(meta.getRadianceState("yumemizuki_mizuki")).toBeNull();
    expect(meta.getRadianceState("fischl")).toBeNull();
  });

  it("distinguishes a burst-created field from reaction eligibility", () => {
    const meta = new TeamMeta(["mitya", "yae_miko", "yumemizuki_mizuki"]);

    expect(meta.hasReaction("stellarConduct")).toBe(false);
    expect(meta.getRadianceState("yae_miko")).toBe("stellarConduct");
    expect(meta.getRadianceState("yumemizuki_mizuki")).toBeNull();
  });

  it("does not assign unsupported variants or Radiance to noncarriers", () => {
    const meta = new TeamMeta(["wriothesley", "vesna", "kaeya"]);

    expect(meta.hasReaction("stellarSwirl")).toBe(true);
    expect(meta.getRadianceState("wriothesley")).toBeNull();
    expect(meta.getRadianceState("kaeya")).toBeNull();
    expect(meta.getRadianceState("diona")).toBeNull();
    expect(meta.getRadianceState("unknown")).toBeNull();
  });

  it("respects a Swirl-only carrier's capability when a field is also available", () => {
    const meta = new TeamMeta(["mitya", "vesna", "kaeya", "yumemizuki_mizuki"]);

    expect(meta.hasPolestarField()).toBe(true);
    expect(meta.getRadianceState("yumemizuki_mizuki")).toBe("stellarSwirl");
  });
});
