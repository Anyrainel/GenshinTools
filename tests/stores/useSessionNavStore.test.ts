import { describe, expect, it } from "vitest";
import { migrateSessionNavStorageValue } from "@/stores/migration/sessionNav";

describe("migrateSessionNavStorageValue", () => {
  it("moves old flat active team fields into per-view settings", () => {
    const result = migrateSessionNavStorageValue({
      state: {
        activeTeamId: "damage-team",
        activeInvestmentTeamId: "investment-team",
        activeWeaponChoiceTeamId: "weapon-team",
      },
    });

    expect(result.state?.viewSettings).toMatchObject({
      damage: { activeTeamId: "damage-team" },
      investment: { activeTeamId: "investment-team" },
      weaponChoice: { activeTeamId: "weapon-team" },
    });
    expect(result.state).not.toHaveProperty("activeTeamId");
    expect(result.state).not.toHaveProperty("activeInvestmentTeamId");
    expect(result.state).not.toHaveProperty("activeWeaponChoiceTeamId");
  });
});
