import { ScalingBuff, StatBuff, StaticSkillBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Natlan Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("ifa")
class Ifa extends CharacterBase {
  readonly buffs = [
    // P1: Rescue Essentials — ~80 Nightsoul pts → Swirl/EC +120% reactionDmg
    // (Also Lunar-Charged +16%, not separately modeled)
    new StatBuff(cbs(this, ["E"], "P1"), { receiver: "team" }, [
      { key: "reactionDmg%", value: 1.2 },
    ]),
    // P2: After Nightsoul Burst, self EM +80
    new StatBuff(cbs(this, ["nightsoul"], "P2"), { receiver: "self" }, [
      { key: "em", value: 80 },
    ]),
    // C4: After Q, self EM +100
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "self" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "em", value: 100 }] : [])
    ),
  ];

  // Pure healer/support — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("iansan")
class Iansan extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<
      typeof StatBuff | typeof ScalingBuff | typeof StaticSkillBuff
    >[] = [
      // P1: After Swift Stormflight hit, self ATK +20%
      new StatBuff(
        cbs(this, ["E", "charge"], "P1"),
        { receiver: "selfOnField" },
        [{ key: "atk%", value: 0.2 }]
      ),
      // Q: Kinetic Energy Scale — 27% of Iansan's ATK to on-field (at ≥42 Nightsoul)
      new ScalingBuff(
        cbs(this, ["Q"]),
        { receiver: "onField" },
        [],
        "atk",
        "atk",
        0.27
      ),
    ];
    // C2: While off-field with Precise Movement, on-field ATK +30%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C2"), { receiver: "onField" }, [
          { key: "atk%", value: 0.3 },
        ])
      );
    }
    // C6: Extreme Force — on-field DMG +25%
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C6"), { receiver: "onField" }, [
          { key: "dmg%", value: 0.25 },
        ])
      );
    }
    return buffs;
  })();

  // E: Lv10 515.5%, Lv13 (C3+) 608.6%
  // Q: Lv10 774.7%, Lv13 (C5+) 914.6%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 6.086 : 5.155;
    const qMult = this.constellation >= 5 ? 9.146 : 7.747;
    return {
      "iansan-skill": {
        label: { zh: "电掣雷驰", en: "Thunderbolt Rush" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "iansan-burst": {
        label: { zh: "力的三原理", en: "Three Principles of Power" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("ororon")
class Ororon extends CharacterBase {
  readonly buffs = [
    // C6: After Hypersense, on-field ATK +30% (3 stacks × 10%)
    new StaticSkillBuff(
      cbs(this, ["E"], "C6"),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "atk%", value: 0.3 }] : [])
    ),
  ];

  // E: Lv10 355.7%, Lv13 (C5+) 419.9%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 4.199 : 3.557;
    return {
      "ororon-skill": {
        label: { zh: "暝色缒索", en: "Night's Sling" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("kachina")
class Kachina extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof StaticSkillBuff>[] = [
      // P1: After Nightsoul Burst, self Geo DMG +20%
      new StatBuff(cbs(this, ["nightsoul"], "P1"), { receiver: "self" }, [
        { key: "geo%", value: 0.2 },
      ]),
    ];
    // C4: In Q field, on-field DEF% +8/12/16/20% (by enemy count, assume 2 → 12%)
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C4"), { receiver: "onField" }, [
          { key: "def%", value: 0.12 },
        ])
      );
    }
    return buffs;
  })();

  // Turbo Twirly Mounted: Lv10 158.0% DEF, Lv13 (C3+) 186.5% DEF
  // Q: Lv10 692.6% DEF, Lv13 (C5+) 817.7% DEF
  protected readonly formulaMap = (() => {
    const mountMult = this.constellation >= 3 ? 1.865 : 1.58;
    const qMult = this.constellation >= 5 ? 8.177 : 6.926;
    return {
      "kachina-twirly": {
        label: { zh: "冲天转转搭乘", en: "Turbo Twirly Mounted" },
        parts: [
          {
            formula: new DirectFormula(
              mountMult,
              {
                element: "Geo",
                ability: "skill",
                reaction: "none",
              },
              "def"
            ),
          },
        ],
      },
      "kachina-burst": {
        label: { zh: "认真时间", en: "Time to Get Serious!" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
              {
                element: "Geo",
                ability: "burst",
                reaction: "none",
              },
              "def"
            ),
          },
        ],
      },
    };
  })();
}
