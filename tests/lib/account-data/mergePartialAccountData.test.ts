import { describe, expect, it } from "vitest";
import type { AccountData, ArtifactData, WeaponData } from "@/data/types";
import type { PresentSections } from "@/lib/account-data/import/goodConversion";
import { mergePartialAccountData } from "@/lib/account-data/import/mergeAccountData";

const makeWeapon = (key: string, level = 90): WeaponData => ({
  id: "weapon-0",
  key,
  level,
  refinement: 1,
  lock: false,
});

const makeArtifact = (
  setKey: string,
  slotKey: "flower" | "plume" | "sands" | "goblet" | "circlet" = "flower"
): ArtifactData => ({
  id: "artifact-0",
  setKey,
  slotKey,
  level: 20,
  rarity: 5,
  mainStatKey: "hp",
  lock: false,
  substats: {},
});

const existing: AccountData = {
  characters: [
    {
      key: "HuTao",
      level: 90,
      constellation: 1,
      talent: { auto: 10, skill: 10, burst: 8 },
      weapon: makeWeapon("StaffOfHoma"),
      artifacts: { flower: makeArtifact("CrimsonWitchOfFlames", "flower") },
    },
    {
      key: "Xingqiu",
      level: 80,
      constellation: 6,
      talent: { auto: 1, skill: 9, burst: 12 },
      weapon: makeWeapon("SacrificialSword"),
      artifacts: { flower: makeArtifact("EmblemOfSeveredFate", "flower") },
    },
  ],
  extraArtifacts: [makeArtifact("NoblesseOblige", "plume")],
  extraWeapons: [makeWeapon("FavoniusLance")],
};

describe("mergePartialAccountData", () => {
  it("characters-only import preserves existing weapons and artifacts", () => {
    const incoming: AccountData = {
      characters: [
        {
          key: "HuTao",
          level: 90,
          constellation: 2, // changed
          talent: { auto: 10, skill: 10, burst: 10 }, // changed
          weapon: undefined,
          artifacts: {},
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };
    const sections: PresentSections = {
      characters: true,
      weapons: false,
      artifacts: false,
    };

    const { data: result } = mergePartialAccountData(
      existing,
      incoming,
      sections
    );

    // Character stats updated
    const hutao = result.characters.find((c) => c.key === "HuTao")!;
    expect(hutao.constellation).toBe(2);
    expect(hutao.talent.burst).toBe(10);

    // Weapon preserved from existing
    expect(hutao.weapon).toBeDefined();
    expect(hutao.weapon!.key).toBe("StaffOfHoma");

    // Artifacts preserved from existing
    expect(hutao.artifacts.flower).toBeDefined();
    expect(hutao.artifacts.flower!.setKey).toBe("CrimsonWitchOfFlames");

    // Xingqiu not in incoming characters-only import → dropped (section present but char absent)
    // But existing extra inventory preserved
    expect(result.extraArtifacts).toHaveLength(1);
    expect(result.extraArtifacts[0].setKey).toBe("NoblesseOblige");
    expect(result.extraWeapons).toHaveLength(1);
    expect(result.extraWeapons[0].key).toBe("FavoniusLance");
  });

  it("weapons-only import preserves existing characters and artifacts", () => {
    const incoming: AccountData = {
      characters: [
        {
          key: "HuTao",
          level: 0,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          weapon: makeWeapon("CalamityQueller", 90),
          artifacts: {},
        },
      ],
      extraArtifacts: [],
      extraWeapons: [makeWeapon("WolfsGravestone")],
    };
    const sections: PresentSections = {
      characters: false,
      weapons: true,
      artifacts: false,
    };

    const { data: result } = mergePartialAccountData(
      existing,
      incoming,
      sections
    );

    // Character stats preserved from existing
    const hutao = result.characters.find((c) => c.key === "HuTao")!;
    expect(hutao.level).toBe(90);
    expect(hutao.constellation).toBe(1);
    expect(hutao.talent.burst).toBe(8);

    // Weapon updated from incoming
    expect(hutao.weapon!.key).toBe("CalamityQueller");

    // Artifacts preserved from existing
    expect(hutao.artifacts.flower).toBeDefined();
    expect(hutao.artifacts.flower!.setKey).toBe("CrimsonWitchOfFlames");

    // Extra weapons updated, extra artifacts preserved
    expect(result.extraWeapons).toHaveLength(1);
    expect(result.extraWeapons[0].key).toBe("WolfsGravestone");
    expect(result.extraArtifacts).toHaveLength(1);
    expect(result.extraArtifacts[0].setKey).toBe("NoblesseOblige");

    // Characters not in import are still kept (characters section not present)
    expect(result.characters.find((c) => c.key === "Xingqiu")).toBeDefined();
  });

  it("artifacts-only import preserves existing characters and weapons", () => {
    const incoming: AccountData = {
      characters: [
        {
          key: "HuTao",
          level: 0,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          weapon: undefined,
          artifacts: {
            flower: makeArtifact("GildedDreams", "flower"),
            plume: makeArtifact("GildedDreams", "plume"),
          },
        },
      ],
      extraArtifacts: [makeArtifact("ViridescentVenerer", "sands")],
      extraWeapons: [],
    };
    const sections: PresentSections = {
      characters: false,
      weapons: false,
      artifacts: true,
    };

    const { data: result } = mergePartialAccountData(
      existing,
      incoming,
      sections
    );

    // Character stats preserved from existing
    const hutao = result.characters.find((c) => c.key === "HuTao")!;
    expect(hutao.level).toBe(90);
    expect(hutao.constellation).toBe(1);
    expect(hutao.talent.burst).toBe(8);

    // Weapon preserved from existing
    expect(hutao.weapon!.key).toBe("StaffOfHoma");

    // Artifacts updated from incoming
    expect(hutao.artifacts.flower!.setKey).toBe("GildedDreams");
    expect(hutao.artifacts.plume!.setKey).toBe("GildedDreams");

    // Extra artifacts updated, extra weapons preserved
    expect(result.extraArtifacts).toHaveLength(1);
    expect(result.extraArtifacts[0].setKey).toBe("ViridescentVenerer");
    expect(result.extraWeapons).toHaveLength(1);
    expect(result.extraWeapons[0].key).toBe("FavoniusLance");

    // Characters not in import are still kept (characters section not present)
    expect(result.characters.find((c) => c.key === "Xingqiu")).toBeDefined();
  });

  it("full import replaces everything", () => {
    const incoming: AccountData = {
      characters: [
        {
          key: "Nahida",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 10, burst: 7 },
          weapon: makeWeapon("AThousandFloatingDreams"),
          artifacts: {},
        },
      ],
      extraArtifacts: [],
      extraWeapons: [],
    };
    const sections: PresentSections = {
      characters: true,
      weapons: true,
      artifacts: true,
    };

    const { data: result } = mergePartialAccountData(
      existing,
      incoming,
      sections
    );

    // Full replace — only incoming data
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].key).toBe("Nahida");
    expect(result.extraArtifacts).toHaveLength(0);
    expect(result.extraWeapons).toHaveLength(0);
  });
});
