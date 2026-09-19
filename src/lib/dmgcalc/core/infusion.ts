import type { Element } from "@/data/enums";
import type { FormulaEntry, OptionDef } from "../types";
import type { TeamMeta } from "./teamMeta";

export function getInfusionOptionKey(charId: string): string {
  return `infusion:${charId}`;
}

/** Explicitly choose the active field; overlapping infusion priority is not inferred. */
export function getInfusionOptionDef(): OptionDef {
  return {
    label: { en: "Physical attack infusion", zh: "物理攻击附魔" },
    choices: [
      { value: "none", label: { en: "None", zh: "无" } },
      {
        value: "bennett",
        label: { en: "Bennett C6 · Pyro", zh: "班尼特六命·火" },
        when: (team) =>
          (team.constellations.bennett ?? 0) >= 6 &&
          team.characters.includes("bennett"),
      },
      {
        value: "candace",
        label: { en: "Candace · Hydro", zh: "坎蒂丝·水" },
        when: (team) => team.characters.includes("candace"),
      },
      {
        value: "chongyun",
        label: { en: "Chongyun · Cryo", zh: "重云·冰" },
        when: (team) => team.characters.includes("chongyun"),
      },
    ],
  };
}

export function canReceiveInfusion(charId: string, team: TeamMeta): boolean {
  const weapon = team.weaponTypes[charId];
  return weapon === "Sword" || weapon === "Claymore" || weapon === "Polearm";
}

/** Called once after character construction, before the shared formula catalog is built. */
export function applyPhysicalAttackInfusion(
  entries: Record<string, FormulaEntry>,
  charId: string,
  source: string | undefined,
  team: TeamMeta
): void {
  if (!canReceiveInfusion(charId, team)) return;
  const choice = getInfusionOptionDef().choices.find((c) => c.value === source);
  if (!choice?.when?.(team)) return;
  const elements: Record<string, Element> = {
    bennett: "Pyro",
    candace: "Hydro",
    chongyun: "Cryo",
  };
  const element = elements[choice.value];
  for (const entry of Object.values(entries)) {
    for (const part of entry.parts) {
      const tag = part.formula.tag;
      if (
        part.offField ||
        (part.statsCharId && part.statsCharId !== charId) ||
        tag.element !== "Physical"
      )
        continue;
      if (
        tag.ability !== "normal" &&
        tag.ability !== "charge" &&
        tag.ability !== "plunge"
      )
        continue;
      // Preserve the concrete formula class and all scaling terms without mutating shared tags.
      part.formula = Object.assign(
        Object.create(Object.getPrototypeOf(part.formula)),
        part.formula,
        { tag: { ...tag, element } }
      );
    }
  }
}
