import { DirectFormula } from "../core/damageFormula";
import { CharacterBase } from "../core/implModel";
import { RegisterCharacter, resolveOption } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { ComboTemplate, OptionDef } from "../types";
import { cbs } from "./helpers";

// 4★ Snezhnaya Characters

const alyoshaOption = {
  label: { zh: "辉映·星超导", en: "Radiance: Stellar-Conduct" },
  choices: [
    {
      value: "on",
      label: { zh: "开启 (极星辉域)", en: "On (Polestar Field)" },
      when: (tm) => tm.hasReaction("stellarConduct"),
    },
    { value: "off", label: { zh: "关闭", en: "Off" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("alyosha", alyoshaOption)
class Alyosha extends CharacterBase {
  private readonly radianceOn =
    resolveOption(alyoshaOption, this.option, this.teamMeta) === "on";

  readonly buffs = (() => {
    const isC6 = this.constellation >= 6;
    // C6 stacks 猎者之准 itself ("该效果至多叠加2层"), so every property the
    // effect carries is granted twice — the E ATK% and the P3 Stellar-Conduct
    // rider alike. The separate "叠加至2层时…元素精通提升100点" clause is the
    // non-per-stack bonus, which is why it needs its own threshold wording.
    const precisionStacks = isC6 ? 2 : 1;
    const precisionAtk = this.param("E", 5) * precisionStacks;

    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // E: Hunter's Precision ATK% buff — granted to the whole party but only
      // effective "处于场上时" (while on the field), so teamOnField per U1.
      new StatBuff(
        cbs(this, isC6 ? "E/C6" : "E", ["E"]),
        { receiver: "teamOnField" },
        [{ key: "atk%", value: precisionAtk }]
      ),
      // P2: Farewell, Winter Wheat and Fallen Leaves (0.35% DMG per 1% ER, max 70%)
      new ScalingBuff(
        cbs(this, "P2", []),
        { receiver: "self", filter: { abilities: ["skill", "burst"] } },
        [],
        "er",
        "dmg%",
        0.35,
        0.7
      ),
    ];

    // P3: Radiance: Stellar-Conduct buff (Stellar-Conduct reaction DMG +20%)
    // "使角色处于场上时造成的星超导反应伤害提升" → teamOnField.
    // P3 adds this to the 猎者之准 effect rather than creating a parallel buff,
    // so it rides the same stack count as the ATK% half → 40% at C6.
    if (this.radianceOn) {
      buffs.push(
        new StatBuff(
          cbs(this, isC6 ? "P3/C6" : "P3", ["E"]),
          {
            receiver: "teamOnField",
            filter: { reactions: ["stellarConduct"] },
          },
          [{ key: "reactionDmg%", value: 0.2 * precisionStacks }]
        )
      );
    }

    // C6: Max stacks Hunter's Precision EM +100
    // "使处于该效果影响下的当前场上角色的元素精通提升100点" → teamOnField.
    if (isC6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", ["E"]), { receiver: "teamOnField" }, [
          { key: "em", value: 100 },
        ])
      );
    }

    return buffs;
  })();

  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "alyosha-e-press", count: 1 },
      { id: "alyosha-q-field", count: 1 },
      { id: "alyosha-q-tugarin", count: 1 },
    ];
  }

  protected readonly formulaMap = (() => {
    const physNormal = {
      element: "Physical" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const physCharge = {
      element: "Physical" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const physPlunge = {
      element: "Physical" as const,
      ability: "plunge" as const,
      reaction: "none" as const,
    };
    const electroSkill = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const electroBurst = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    const qHits = this.constellation >= 2 ? 10 : 7;

    return {
      "alyosha-na": {
        label: { zh: "普通攻击", en: "Normal Attack" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), physNormal) },
          { formula: new DirectFormula(this.param("A", 2), physNormal) },
          { formula: new DirectFormula(this.param("A", 3), physNormal) },
          { formula: new DirectFormula(this.param("A", 4), physNormal) },
          { formula: new DirectFormula(this.param("A", 5), physNormal) },
        ],
      },
      "alyosha-charge": {
        label: { zh: "重击", en: "Charged Attack" },
        parts: [{ formula: new DirectFormula(this.param("A", 6), physCharge) }],
      },
      // param7 is the Charged Attack Stamina Cost, not a multiplier:
      // param8 = plunge DMG during fall, param9/param10 = low/high impact.
      // Only the high-impact row is modeled — the during-fall and low-impact
      // rows are intentionally left out.
      "alyosha-plunge-high": {
        label: { zh: "下落·高", en: "Plunge High" },
        parts: [
          { formula: new DirectFormula(this.param("A", 10), physPlunge) },
        ],
      },
      "alyosha-e-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), electroSkill) },
        ],
      },
      "alyosha-e-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), electroSkill) },
        ],
      },
      "alyosha-q-field": {
        label: { zh: "轰霆猎场伤害", en: "Hunting Field DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), electroBurst),
            hits: qHits,
            offField: true,
          },
        ],
      },
      "alyosha-q-tugarin": {
        label: { zh: "图加林伤害", en: "Tugarin DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), electroBurst),
            hits: qHits,
            offField: true,
          },
        ],
      },
    };
  })();
}
