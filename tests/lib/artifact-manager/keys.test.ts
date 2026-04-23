import {
  artifactIdToGOODKey,
  charIdToGOODKey,
} from "@/lib/account-data/manager/keys";
import { describe, expect, it } from "vitest";

describe("charIdToGOODKey", () => {
  it("converts single-word character name", () => {
    expect(charIdToGOODKey("furina")).toBe("Furina");
  });

  it("converts multi-word character name", () => {
    expect(charIdToGOODKey("raiden_shogun")).toBe("RaidenShogun");
  });

  it("converts multi-word character name (hu_tao)", () => {
    expect(charIdToGOODKey("hu_tao")).toBe("HuTao");
  });

  it("converts multi-word character name (kamisato_ayaka)", () => {
    expect(charIdToGOODKey("kamisato_ayaka")).toBe("KamisatoAyaka");
  });

  it("strips parentheses from traveler variants", () => {
    expect(charIdToGOODKey("traveler_pyro")).toBe("TravelerPyro");
  });

  it("returns undefined for unknown character ID", () => {
    expect(charIdToGOODKey("nonexistent_character")).toBeUndefined();
  });
});

describe("artifactIdToGOODKey", () => {
  it("strips apostrophe from artifact name", () => {
    expect(artifactIdToGOODKey("gladiators_finale")).toBe("GladiatorsFinale");
  });

  it("capitalizes all words including 'of'", () => {
    expect(artifactIdToGOODKey("emblem_of_severed_fate")).toBe(
      "EmblemOfSeveredFate"
    );
  });

  it("converts artifact with multiple 'of' words", () => {
    expect(artifactIdToGOODKey("flower_of_paradise_lost")).toBe(
      "FlowerOfParadiseLost"
    );
  });

  it("handles hyphenated name (Ocean-Hued Clam)", () => {
    expect(artifactIdToGOODKey("oceanhued_clam")).toBe("OceanHuedClam");
  });

  it("returns undefined for unknown artifact ID", () => {
    expect(artifactIdToGOODKey("nonexistent_artifact")).toBeUndefined();
  });
});
