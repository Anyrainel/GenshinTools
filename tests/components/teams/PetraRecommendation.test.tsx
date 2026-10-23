import "@/domain/combat/damage/index";
import { describe, expect, it, vi } from "vitest";
import { WeaponChoiceResultCard } from "@/components/teams/WeaponChoiceResultCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import { teamCompInputToComp } from "@/domain/team/teamDeltas";
import type { TeamSetupConfig, WeaponChoiceResult } from "@/domain/team/types";
import { fireEvent, render, screen } from "../../utils/render";

const team = teamCompInputToComp({
  id: "petra",
  name: "Petra",
  characters: ["lisa", "zhongli", null, null],
  weapons: ["skyward_atlas", "favonius_lance", null, null],
  artifacts: [null, null, null, null],
  reactions: [],
});
const setup: TeamSetupConfig = {
  combatOptions: { archaic_petra: "Pyro", berserker: "low" },
};
const petra = { type: "4pc" as const, setId: "archaic_petra" };
const options = { archaic_petra: "Electro" };
const result: WeaponChoiceResult = {
  mode: "artifact",
  timestamp: 1,
  perCharacter: {
    zhongli: [
      {
        type: "artifact",
        artifactSet: petra,
        artifactSetIds: ["archaic_petra"],
        damage: 135,
        percentOfBest: 100,
        combatOptions: options,
      },
    ],
  },
};

describe("Petra recommendation activation choices", () => {
  function setupCard(withAssignment = false) {
    const onTeamCompChange = vi.fn();
    const onSetupConfigChange = vi.fn();
    function Card() {
      const { t } = useLanguage();
      return (
        <WeaponChoiceResultCard
          teamComp={team}
          setupConfig={setup}
          characters={["lisa", "zhongli"]}
          weapons={["skyward_atlas", "favonius_lance"]}
          artifacts={[null, null]}
          teamMeta={new TeamMeta(["lisa", "zhongli"])}
          onTeamCompChange={onTeamCompChange}
          onSetupConfigChange={onSetupConfigChange}
          setChoiceResult={vi.fn()}
          charIds={["lisa", "zhongli"]}
          isComputing={false}
          choiceMode="artifact"
          result={
            withAssignment
              ? {
                  ...result,
                  artifactAssignmentSuggestion: {
                    currentDamage: 100,
                    bestDamage: 135,
                    percentImprovement: 35,
                    assignments: [
                      { charId: "lisa", artifactSet: null },
                      { charId: "zhongli", artifactSet: petra },
                    ],
                    combatOptions: options,
                  },
                }
              : result
          }
          error={null}
          onRun={vi.fn()}
          onStop={vi.fn()}
          t={t}
        />
      );
    }
    render(<Card />);
    return { onTeamCompChange, onSetupConfigChange };
  }

  it("shows the selected element and applies it with an individual set choice", () => {
    const callbacks = setupCard();
    fireEvent.click(screen.getByRole("button", { name: "Archaic Petra" }));
    expect(screen.getByText(/Electro/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply to roster" }));
    expect(
      callbacks.onTeamCompChange.mock.calls[0][0].slots[1].artifactSet
    ).toEqual(petra);
    expect(
      callbacks.onSetupConfigChange.mock.calls[0][0](setup).combatOptions
    ).toEqual({
      archaic_petra: "Electro",
      berserker: "low",
    });
  });

  it("applies the chosen element with an artifact reassignment", () => {
    const callbacks = setupCard(true);
    fireEvent.click(screen.getByRole("button", { name: "Apply to team" }));
    expect(
      callbacks.onTeamCompChange.mock.calls[0][0].slots[1].artifactSet
    ).toEqual(petra);
    expect(
      callbacks.onSetupConfigChange.mock.calls[0][0](setup).combatOptions
        .archaic_petra
    ).toBe("Electro");
  });
});
