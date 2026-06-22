import { fireEvent, screen } from "@testing-library/react";
import { FlexPatternDialog } from "@/components/account-data/FlexPatternDialog";
import type {
  CustomFlexInput,
  TriageSettings,
} from "@/lib/account-data/triage/types";
import { render } from "../../utils/render";

function makeSettings(
  customFlexInputs: CustomFlexInput[] = []
): TriageSettings {
  return {
    triageMode: "strict",
    mainStatThreshold: 0.1,
    optionalSubThreshold: 0.1,
    fillerKeep: 1,
    qualityMargin: 0,
    backupAmountMode: "normal",
    alwaysLockSolidArtifacts: false,
    setSlotKeep: 1,
    ownedOnly: false,
    erHoardingEnabled: true,
    erHoardingAllEnabled: false,
    doubleCritLockEnabled: true,
    levelProtection: 16,
    highLevelProtection: true,
    equippedProtection: true,
    disabledFlexPatterns: [],
    enabledFlexPatterns: [],
    customFlexInputs,
  };
}

describe("FlexPatternDialog", () => {
  it("allows removing a custom pattern that requires four initial substats", () => {
    const fourLineInput: CustomFlexInput = {
      slot: "goblet",
      mainStat: "pyro%",
      requiredSubs: ["cd", "cr"],
      requiresFourInitialSubstats: true,
    };
    const onSettingsChange = vi.fn();

    render(
      <FlexPatternDialog
        open
        onOpenChange={vi.fn()}
        flexPatterns={[]}
        settings={makeSettings([fourLineInput])}
        onSettingsChange={onSettingsChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /remove custom pattern/i })
    );

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ customFlexInputs: [] })
    );
  });

  it("restores Flex registry defaults without changing other triage settings", () => {
    const customInput: CustomFlexInput = {
      slot: "sands",
      mainStat: "em",
      requiredSubs: ["cr", "cd"],
    };
    const onSettingsChange = vi.fn();

    render(
      <FlexPatternDialog
        open
        onOpenChange={vi.fn()}
        flexPatterns={[]}
        settings={{
          ...makeSettings([customInput]),
          mainStatThreshold: 95,
          erHoardingEnabled: false,
          disabledFlexPatterns: ["flex:flower:hp:cr,cd,atk%"],
          enabledFlexPatterns: ["flex:sands:er:atk%,atk"],
        }}
        onSettingsChange={onSettingsChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /restore flex defaults/i })
    );

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mainStatThreshold: 95,
        erHoardingEnabled: false,
        disabledFlexPatterns: [],
        enabledFlexPatterns: [],
        customFlexInputs: [],
      })
    );
  });
});
