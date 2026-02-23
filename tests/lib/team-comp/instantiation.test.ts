import { charactersById, weaponsById } from "@/data/constants";
import {
  TeamMeta,
  createCharacter,
  createWeapon,
} from "@/lib/team-comp/damageModels";
import { describe, expect, it } from "vitest";
import "@/lib/team-comp/index";

describe("Entity Instantiation", () => {
  it("instantiates every character and reads buffs", () => {
    for (const charId of Object.keys(charactersById)) {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 90, 6, team);
        const buffs = char.buffs;
        expect(buffs).toBeDefined();
      } catch (e) {
        if (
          e instanceof Error &&
          !e.message.includes("No character registered")
        ) {
          throw new Error(`Failed on character ${charId}: ${e.message}`);
        }
      }
    }
  });

  it("instantiates every weapon and reads buffs", () => {
    for (const weaponId of Object.keys(weaponsById)) {
      try {
        const team = new TeamMeta(["amber"]);
        const weapon = createWeapon(weaponId, 5, "amber", team);
        const buffs = weapon.buffs;
        expect(buffs).toBeDefined();
      } catch (e) {
        if (e instanceof Error && !e.message.includes("No weapon registered")) {
          throw new Error(`Failed on weapon ${weaponId}: ${e.message}`);
        }
      }
    }
  });
});
