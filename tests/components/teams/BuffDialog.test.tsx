import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BuffDialog } from "@/components/teams/BuffDialog";
import { PartBuffDialog } from "@/components/teams/PartBuffDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DisplayPart, ResolvedBuff } from "@/domain/combat/damage/types";
import { useBuffOverrideStore } from "@/stores/useBuffOverrideStore";
import { render, screen } from "../../utils/render";

const BUFF: ResolvedBuff = {
  buffKey: "bennett-q",
  source: { type: "character", id: "bennett", origin: "Q" },
  providerCharId: "bennett",
  target: { receiver: "teamOnField" },
  active: true,
  activePartIndices: [0],
  staticEntries: [],
  dynamicEntries: [],
};
const FORMULA_KEY = "dehya.dehya-molten-inferno";
const COMBO_KEY = `combo:test:${FORMULA_KEY}`;
function makePart(
  hits: number,
  template: DisplayPart["template"] = "direct"
): DisplayPart {
  return {
    template,
    hits,
    sourcePartIndex: 0,
    damage: 100,
    statValues: {},
    params: {},
    scalingKeys: ["atk"],
    scalingMulti: [1],
  };
}
function Harness({
  parts,
  count,
  perPart = false,
}: {
  parts: DisplayPart[];
  count: number;
  perPart?: boolean;
}) {
  const { t } = useLanguage();
  return perPart ? (
    <PartBuffDialog
      parts={parts}
      formulaKey={FORMULA_KEY}
      buffs={[BUFF]}
      t={t}
      comboCount={count}
      comboKey={COMBO_KEY}
      initialTab={1}
    />
  ) : (
    <BuffDialog
      buff={BUFF}
      formulas={[
        {
          formulaKey: FORMULA_KEY,
          parts,
          comboCount: count,
          comboKey: COMBO_KEY,
        },
      ]}
      t={t}
    />
  );
}

const CASES = [
  {
    name: "repeated weighted rows",
    parts: [makePart(0.75), makePart(0.25)],
    count: 4,
    expected: 4,
  },
  {
    name: "reaction split rows",
    parts: [makePart(1, "amplify"), makePart(3)],
    count: 2,
    expected: 8,
  },
];

describe("buff controls share activation counts across display rows", () => {
  beforeEach(() =>
    useBuffOverrideStore.setState({ overrides: {}, comboOverrides: {} })
  );

  it.each(CASES)(
    "shows one source control with the full maximum for $name",
    ({ parts, count, expected }) => {
      render(<Harness parts={parts} count={count} />);
      fireEvent.click(
        screen.getByRole("button", { name: /Buff Activation|增益激活/i })
      );
      const sliders = screen.getAllByRole("slider");
      expect(sliders).toHaveLength(1);
      expect(sliders[0]).toHaveAttribute("aria-valuemax", String(expected));
      fireEvent.keyDown(sliders[0], { key: "Home" });
      expect(
        useBuffOverrideStore.getState().comboOverrides[COMBO_KEY]?.[
          BUFF.buffKey
        ]?.[0]
      ).toBe(0);
      fireEvent.click(
        screen.getByRole("button", { name: /Enable All|全部开启/i })
      );
      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-valuenow",
        String(expected)
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Disable All|全部关闭/i })
      );
      expect(
        useBuffOverrideStore.getState().comboOverrides[COMBO_KEY]?.[
          BUFF.buffKey
        ]
      ).toEqual({ 0: 0 });
    }
  );

  it.each(CASES)(
    "uses full source maximum in either part tab for $name",
    ({ parts, count, expected }) => {
      render(<Harness parts={parts} count={count} perPart />);
      fireEvent.click(
        screen.getByRole("button", { name: /Buff Activation|增益激活/i })
      );
      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-valuemax",
        String(expected)
      );
      fireEvent.click(screen.getByRole("button", { name: /^1\./ }));
      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-valuemax",
        String(expected)
      );
      fireEvent.keyDown(screen.getByRole("slider"), { key: "End" });
      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-valuenow",
        String(expected)
      );
    }
  );
});
