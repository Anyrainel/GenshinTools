import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { CharacterWeaponPanel } from "@/components/teams/WeaponChoiceResultCard";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ChoiceRanking } from "@/domain/team/types";
import {
  artifactTextResource,
  weaponTextResource,
} from "@/providers/reference/gameDataLoader";
import { render, screen, within } from "../../utils/render";

const weaponEntry: ChoiceRanking = {
  weaponId: "staff_of_homa",
  refinement: 3,
  damage: 123456,
  percentOfBest: 100,
  artifactSetIds: ["emblem_of_severed_fate"],
};

function HomaTooltip({ refinement = 3 }: { refinement?: number }) {
  return (
    <WeaponTooltip
      weaponId="staff_of_homa"
      inventoryWeapon={{
        id: "homa",
        key: "staff_of_homa",
        level: 90,
        refinement,
        lock: true,
      }}
    />
  );
}

function Panel({
  entry,
  isMobile = false,
  reference,
  otherEffect,
}: {
  entry: ChoiceRanking;
  isMobile?: boolean;
  reference: ReactNode;
  otherEffect: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <>
      <div data-testid="rankings">
        <CharacterWeaponPanel
          charId="raiden_shogun"
          characters={["raiden_shogun"]}
          weapons={["staff_of_homa"]}
          rankings={[entry]}
          isMobile={isMobile}
          t={t}
        />
      </div>
      <div data-testid="reference">{reference}</div>
      <div data-testid="other-effect">{otherEffect}</div>
    </>
  );
}

function descriptions(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(".leading-relaxed"));
}

function expectEffectsAboveDamage(dialog: HTMLElement, totalLabel: string) {
  const total = within(dialog).getByText(totalLabel);
  const effects = descriptions(dialog);
  expect(effects.length).toBeGreaterThan(0);
  for (const effect of effects) {
    expect(
      effect.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  }
  const otherText = descriptions(screen.getByTestId("other-effect"))
    .map((effect) => effect.textContent)
    .join("");
  expect(otherText.length).toBeGreaterThan(0);
  expect(dialog.textContent).not.toContain(otherText);
}

beforeAll(async () => {
  await Promise.all(
    (["en", "zh"] as const).flatMap((language) => [
      weaponTextResource.preload(language),
      artifactTextResource.preload(language),
    ])
  );
});

beforeEach(() => localStorage.setItem("app_language", "en"));
afterEach(() => localStorage.removeItem("app_language"));

describe("weapon and artifact choice details", () => {
  it.each([
    ["en", "Total Damage:"],
    ["zh", "总伤害："],
  ] as const)(
    "matches the weapon tooltip at the ranked refinement in %s",
    async (language, totalLabel) => {
      localStorage.setItem("app_language", language);
      const user = userEvent.setup();
      render(
        <Panel
          entry={weaponEntry}
          reference={<HomaTooltip />}
          otherEffect={<ArtifactTooltip setId="emblem_of_severed_fate" />}
        />
      );

      // Rankings without stat allocations still expose their effect and damage.
      const row = within(screen.getByTestId("rankings")).getByRole("button");
      expect(row).toBeEnabled();
      await user.click(row);
      const dialog = await screen.findByRole("dialog");
      const expected = descriptions(screen.getByTestId("reference"))[0];
      expect(descriptions(dialog)[0].innerHTML).toBe(expected.innerHTML);
      expect(expected.textContent!.length).toBeGreaterThan(20);
      expectEffectsAboveDamage(dialog, totalLabel);

      // R3 must show its actual values rather than the baseline R1 values.
      const r1 = render(<HomaTooltip refinement={1} />);
      expect(descriptions(dialog)[0].innerHTML).not.toBe(
        descriptions(r1.container)[0].innerHTML
      );
    }
  );

  it("matches both artifact set bonuses and omits the equipped weapon effect", async () => {
    const user = userEvent.setup();
    render(
      <Panel
        entry={{
          type: "artifact",
          artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
          artifactSetIds: ["emblem_of_severed_fate"],
          damage: 123456,
          percentOfBest: 100,
        }}
        reference={<ArtifactTooltip setId="emblem_of_severed_fate" />}
        otherEffect={<HomaTooltip />}
      />
    );
    await user.click(
      within(screen.getByTestId("rankings")).getByRole("button")
    );
    const dialog = await screen.findByRole("dialog");
    const actual = descriptions(dialog);
    const expected = descriptions(screen.getByTestId("reference"));
    expect(actual).toHaveLength(2);
    expect(actual.map((effect) => effect.textContent)).toEqual(
      expected.map((effect) => effect.textContent)
    );
    for (let index = 0; index < expected.length; index++) {
      expect(actual[index].lastElementChild!.innerHTML).toBe(
        expected[index].lastElementChild!.innerHTML
      );
    }
    expectEffectsAboveDamage(dialog, "Total Damage:");
  });

  it("matches mixed-set tooltip bonuses in the mobile detail drawer", async () => {
    const user = userEvent.setup();
    render(
      <Panel
        isMobile
        entry={{
          type: "artifact",
          artifactSet: { type: "2pc+2pc", halfSetIds: ["atk%-18", "er-20"] },
          artifactSetIds: ["gladiators_finale", "emblem_of_severed_fate"],
          damage: 123456,
          percentOfBest: 100,
        }}
        reference={<MixedSetTooltip id1="atk%-18" id2="er-20" />}
        otherEffect={<HomaTooltip />}
      />
    );
    await user.click(
      within(screen.getByTestId("rankings")).getByRole("button")
    );
    const dialog = await screen.findByRole("dialog");
    expect(descriptions(dialog).map((effect) => effect.textContent)).toEqual(
      descriptions(screen.getByTestId("reference")).map(
        (effect) => effect.textContent
      )
    );
    expect(within(dialog).queryByText("[4]")).not.toBeInTheDocument();
    expectEffectsAboveDamage(dialog, "Total Damage:");
  });
});
