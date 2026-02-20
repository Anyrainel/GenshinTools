import { LUNAR_REACTIONS } from "../constants";
import {
  ScalingBuff,
  ScalingMultiBuff,
  ScalingSkillBuff,
  StatBuff,
  StaticSkillBuff,
} from "../damageBuffs";
import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarFormula,
  TransformFormula,
} from "../damageFormulas";
import {
  CharacterBase,
  type FormulaEntry,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import { cbs } from "../helpers";
import type { OptionDef } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Inazuma Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("yumemizuki_mizuki")
class YumemizukiMizuki extends CharacterBase {
  readonly buffs = (() => {
    const eReactDmg = this.constellation >= 3 ? 0.0054 : 0.0045;
    const buffs: StatBuff[] = [
      // E: Dreamdrifter — increases team Swirl DMG by 0.45% per EM (lv10) / 0.54% (lv13, C3+)
      new ScalingBuff(
        cbs(this, ["E"]),
        { receiver: "team", filter: { reactions: ["swirl"] } },
        [],
        "em",
        "reactionDmg%",
        eReactDmg
      ),
      // P2: EM +100 when teammates hit with Pyro/Hydro/Cryo/Electro
      new StatBuff(cbs(this, ["A4", "E"], "P2"), { receiver: "self" }, [
        { key: "em", value: 100 },
      ]),
    ];

    if (this.constellation >= 2) {
      // C2: per EM point → 0.04% Pyro/Hydro/Cryo/Electro DMG to team
      buffs.push(
        new ScalingMultiBuff(
          cbs(this, ["E"], "C2"),
          { receiver: "team" },
          [],
          "em",
          ["pyro%", "hydro%", "cryo%", "electro%"],
          0.0004
        )
      );
    }
    if (this.constellation >= 6) {
      // C6: Swirl can crit — fixed CR 30%, CD 100%
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C6"),
          { receiver: "team", filter: { reactions: ["swirl"] } },
          [
            { key: "reactionCr", value: 0.3 },
            { key: "reactionCd", value: 1.0 },
          ]
        )
      );
    }
    return buffs;
  })();

  protected readonly formulaMap = (() => {
    const eLevel = this.constellation >= 3 ? 13 : 10;
    const qLevel = this.constellation >= 5 ? 13 : 10;

    const eInitialMult = eLevel === 13 ? 1.227 : 1.039;
    const eTickMult = eLevel === 13 ? 0.954 : 0.808;

    const qInitialMult = qLevel === 13 ? 1.999 : 1.693;
    const qShockwaveMult = qLevel === 13 ? 1.499 : 1.27;

    return {
      "mizuki-skill-initial": {
        label: {
          zh: "秋沙歌枕巡礼(爆发伤害)",
          en: "Aisa Utamakura Pilgrimage (Initial)",
        },
        parts: [
          {
            formula: new DirectFormula(eInitialMult, {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "mizuki-skill-tick": {
        label: { zh: "梦浮(持续伤害)", en: "Dreamdrifter (Tick)" },
        parts: [
          {
            formula: new DirectFormula(eTickMult, {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "mizuki-burst-initial": {
        label: {
          zh: "安乐秘汤疗法(爆发)",
          en: "Anraku Secret Spring Therapy (Initial)",
        },
        parts: [
          {
            formula: new DirectFormula(qInitialMult, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "mizuki-burst-shockwave": {
        label: { zh: "梦念冲击波", en: "Munen Shockwave" },
        parts: [
          {
            formula: new DirectFormula(qShockwaveMult, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "mizuki-swirl": {
        label: { zh: "扩散反应", en: "Swirl" },
        parts: [
          {
            formula: new TransformFormula(1.0, {
              element: "Anemo",
              ability: "skill", // or "burst" etc
              reaction: "swirl",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("chiori")
class Chiori extends CharacterBase {
  readonly buffs = [
    // P2: When team creates Geo construct → Chiori Geo DMG +20%
    new StatBuff(cbs(this, [], "P2"), { receiver: "selfOnField" }, [
      { key: "geo%", value: 0.2 },
    ]),
    // C6: Normal ATK baseDmg +235% DEF (additive, not formula dual-scaling)
    new ScalingSkillBuff(
      cbs(this, ["E"], "C6"),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [],
      "def",
      "baseDmg",
      this.constellation,
      (c) => ({ scale: c >= 6 ? 2.35 : 0 })
    ),
  ];

  protected readonly formulaMap = (() => {
    // Tamoto: Lv10 148% ATK + 185% DEF, C3+: 174% ATK + 218% DEF
    // ~5 hits over 17s (3.6s interval)
    const tAtk = this.constellation >= 3 ? 1.74 : 1.48;
    const tDef = this.constellation >= 3 ? 2.18 : 1.85;
    // Burst: Lv10 461% ATK + 577% DEF, C5+: 545% ATK + 681% DEF
    const qAtk = this.constellation >= 5 ? 5.45 : 4.61;
    const qDef = this.constellation >= 5 ? 6.81 : 5.77;
    return {
      "chiori-tamoto": {
        label: { zh: "袖攻击总伤", en: "Tamoto Total" },
        parts: [
          {
            formula: new DirectFormula(
              tAtk,
              { element: "Geo", ability: "skill", reaction: "none" },
              "atk",
              { key: "def", multiplier: tDef }
            ),
            hits: 5,
          },
        ],
      },
      "chiori-burst": {
        label: { zh: "二刀之形", en: "Twin Blades" },
        parts: [
          {
            formula: new DirectFormula(
              qAtk,
              { element: "Geo", ability: "burst", reaction: "none" },
              "atk",
              { key: "def", multiplier: qDef }
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("raiden_shogun")
class RaidenShogun extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<
      typeof StatBuff | typeof StaticSkillBuff | typeof ScalingBuff
    >[] = [
      // P2: Each 1% ER above 100% → 0.4% Electro DMG Bonus
      new ScalingBuff(
        cbs(this, [], "P2"),
        { receiver: "selfOnField" },
        [],
        "er",
        "electro%",
        0.004,
        undefined,
        1.0
      ),
      // E: Team Burst DMG bonus based on energy cost (0.3%/0.36% per energy)
      // Assume average 70 energy cost Q
      new StaticSkillBuff(
        cbs(this, ["E"]),
        { receiver: "onField", filter: { abilities: ["burst"] } },
        this.constellation,
        (c) => {
          const pctPerEnergy = c >= 5 ? 0.0036 : 0.003;
          return [{ key: "dmg%", value: pctPerEnergy * 70 }];
        }
      ),
    ];
    // C2: Q attacks ignore 60% DEF
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C2"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "defIgnore%", value: 0.6 }]
        )
      );
    }
    // C4: After Q, team (excl self) ATK +30%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C4"), { receiver: "team" }, [
          { key: "atk%", value: 0.3 },
        ])
      );
    }
    return buffs;
  })();

  // Q initial slash: Lv10 721% + 7.98%×60 = 1199.8%
  // Lv13 (C3+): 851% + 9.42%×60 = 1416.2%
  protected readonly formulaMap = (() => {
    const initialMult =
      this.constellation >= 3 ? 8.51 + 0.0942 * 60 : 7.21 + 0.0798 * 60;
    return {
      "raiden-initial": {
        label: { zh: "梦想一刀(60愿力)", en: "Musou Shinsetsu (60 Resolve)" },
        parts: [
          {
            formula: new DirectFormula(initialMult, {
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

@RegisterCharacter("arataki_itto")
class AratakiItto extends CharacterBase {
  readonly buffs = [
    // Q: Royal Descent — DEF → ATK conversion
    // Lv10: 103.7% DEF → ATK, Lv13 (C5+): 122.4% DEF → ATK
    new ScalingSkillBuff(
      cbs(this, ["Q"]),
      { receiver: "selfOnField" },
      [],
      "def",
      "atk",
      this.constellation,
      (c) => ({ scale: c >= 5 ? 1.224 : 1.037 })
    ),
    // P2: Arataki Kesagiri DMG +35% of DEF → flat baseDmg on charge
    new ScalingBuff(
      cbs(this, [], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [],
      "def",
      "baseDmg",
      0.35
    ),
    // C4: After Q ends, team +20% DEF, +20% ATK for 10s
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "team" },
      this.constellation,
      (c) =>
        c >= 4
          ? [
              { key: "def%", value: 0.2 },
              { key: "atk%", value: 0.2 },
            ]
          : []
    ),
    // C6: Charged ATK CD +70%
    new StaticSkillBuff(
      cbs(this, [], "C6"),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "cd", value: 0.7 }] : [])
    ),
    // P1: Kesagiri ATK SPD (assume max +30%)
    new StatBuff(
      cbs(this, [], "P1"),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "atkSpd%", value: 0.3 }]
    ),
    // Q: Raging Oni King State Normal ATK SPD +10%
    new StatBuff(
      cbs(this, ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [{ key: "atkSpd%", value: 0.1 }]
    ),
  ];

  protected readonly formulaMap = (() => {
    // Arataki Kesagiri: 4 combo slashes + 1 final slash
    // Combo Lv10: 180.2%, Lv13 (C3+ via N): 229.1%
    // Final Lv10: 377.4%, Lv13 (C3+ via N): 479.7%
    const combo = this.constellation >= 3 ? 2.291 : 1.802;
    const final_ = this.constellation >= 3 ? 4.797 : 3.774;
    const totalMult = combo * 4 + final_;
    return {
      "itto-kesagiri": {
        label: { zh: "荒泷逆袈裟连斩", en: "Arataki Kesagiri (4+Final)" },
        parts: [
          {
            formula: new DirectFormula(totalMult, {
              element: "Geo",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("kamisato_ayaka")
class KamisatoAyaka extends CharacterBase {
  readonly buffs = [
    // P2: After E, Normal/Charged DMG +30% for 6s
    new StatBuff(cbs(this, ["E"], "P2"), { receiver: "selfOnField" }, [
      { key: "dmg%", value: 0.3 },
    ]),
    // P3: After alternate sprint hit, Cryo DMG +18%
    new StatBuff(cbs(this, ["dash"], "P3"), { receiver: "selfOnField" }, [
      { key: "cryo%", value: 0.18 },
    ]),
    // C4: Enemies hit by Q: DEF -30% for 6s
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "defReduction%", value: 0.3 }] : [])
    ),
    // C6: Charged ATK DMG +298% every 10s
    new StaticSkillBuff(
      cbs(this, [], "C6"),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "dmg%", value: 2.98 }] : [])
    ),
  ];

  // Charged ATK: Lv10 109.0%×3 (Normal talent, no constellation boost)
  // Q cutting: Lv10 202%, Lv13 (C3+) 239%, ~19 cuts + bloom 303%/358%
  // C2: +2 smaller storms at 20% → effectively +40%
  protected readonly formulaMap = (() => {
    const cutMult = this.constellation >= 3 ? 2.39 : 2.02;
    const bloomMult = this.constellation >= 3 ? 3.58 : 3.03;
    const c2Bonus = this.constellation >= 2 ? 1.4 : 1.0;
    const cryoBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "ayaka-charged": {
        label: { zh: "重击(×3)", en: "Charged ATK (×3)" },
        parts: [
          {
            formula: new DirectFormula(1.09 * 3, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "ayaka-burst": {
        label: { zh: "霜灭(19切+绽)", en: "Soumetsu (19 cuts + bloom)" },
        parts: [
          {
            formula: new DirectFormula(cutMult * c2Bonus, cryoBurst),
            hits: 19,
          },
          {
            formula: new DirectFormula(bloomMult * c2Bonus, cryoBurst),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("kamisato_ayato")
class KamisatoAyato extends CharacterBase {
  readonly buffs = (() => {
    const ibuffs: StatBuff[] = [
      // Q: Normal ATK DMG +20% for characters in field
      new StatBuff(
        cbs(this, ["Q"]),
        { receiver: "onField", filter: { abilities: ["normal"] } },
        [{ key: "dmg%", value: 0.2 }]
      ),
    ];
    // C2: At ≥3 Namisen stacks, HP +50%
    if (this.constellation >= 2) {
      ibuffs.push(
        new StatBuff(cbs(this, ["E"], "C2"), { receiver: "selfOnField" }, [
          { key: "hp%", value: 0.5 },
        ])
      );
    }
    // C4: After Q, nearby party members Normal ATK SPD +15%
    if (this.constellation >= 4) {
      ibuffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C4"),
          { receiver: "team", filter: { abilities: ["normal"] } },
          [{ key: "atkSpd%", value: 0.15 }]
        )
      );
    }
    return ibuffs;
  })();

  // Shunsuiken 3-hit combo: ATK + Namisen HP scaling
  // ATK total Lv10: 349.5%, Lv13 (C3+): 423.3%
  // Namisen per hit: 4 stacks × 1.11% HP (C2: 5 stacks), ×3 hits
  // Q Bloomwater: Lv10 119.6%, Lv13 (C5+) 141.2%, ~30 hits over 18s
  readonly formulaMap = (() => {
    const atkTotal = this.constellation >= 3 ? 4.233 : 3.495;
    const stacks = this.constellation >= 2 ? 5 : 4;
    const namisenPerHit = this.constellation >= 3 ? 0.0134 : 0.0111;
    const hpExtra = stacks * namisenPerHit * 3;
    const qMult = this.constellation >= 5 ? 1.412 : 1.196;
    const hydroTag = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    return {
      "ayato-shunsuiken": {
        label: { zh: "瞬水剑连击", en: "Shunsuiken Combo (×3)" },
        parts: [
          {
            formula: new DirectFormula(atkTotal, hydroTag, "atk", {
              key: "hp",
              multiplier: hpExtra,
            }),
          },
        ],
      },
      "ayato-bloomwater": {
        label: { zh: "水花剑(×30)", en: "Bloomwater Blades (×30)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 30,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("sangonomiya_kokomi")
class SangonomiyaKokomi extends CharacterBase {
  readonly buffs = [
    // P4 (Flawless Strategy): CR -100%, Healing Bonus +25%
    new StatBuff(cbs(this, [], "P4"), { receiver: "selfOnField" }, [
      { key: "cr", value: -1.0 },
      { key: "heal%", value: 0.25 },
    ]),
    // P2 (Song of Pearls): During Q, 15% of heal% → Normal/Charged DMG baseDmg%
    new ScalingBuff(
      cbs(this, ["Q"], "P2"),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge"] },
      },
      [],
      "heal%",
      "baseDmg%",
      0.15
    ),
    // Q: Nereid's Ascension — HP → baseDmg for Normal/Charged
    // Lv10: 10.63% HP, Lv13 (C3+): 12.55% HP
    new ScalingSkillBuff(
      cbs(this, ["Q"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge"] },
      },
      [],
      "hp",
      "baseDmg",
      this.constellation,
      (c) => ({ scale: c >= 3 ? 0.1255 : 0.1063 })
    ),
    // C6: Q heal on 80%+ HP → Hydro DMG +40%
    new StaticSkillBuff(
      cbs(this, ["Q"], "C6"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "hydro%", value: 0.4 }] : [])
    ),
  ];

  // On-field healer DPS — damage comes from Normal ATKs during Q
  protected readonly formulaMap = {};
}

@RegisterCharacter("kaedehara_kazuha")
class KaedeharaKazuha extends CharacterBase {
  readonly buffs = [
    // P2: Poetics of Fuubutsu — after Swirl, grant 0.04% elemental DMG% per EM
    new ScalingBuff(
      cbs(this, ["swirl"], "P2"),
      { receiver: "onField" },
      [],
      "em",
      "dmg%",
      0.0004
    ),
    // C2: Q field grants 200 EM to the party
    new StaticSkillBuff(
      cbs(this, ["Q"], "C2"),
      { receiver: "team" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "em", value: 200 }] : [])
    ),
  ];

  // E press: Lv10 346%, Lv13 (C3+) 408%
  // Plunge (Midare Ranzan): Normal ATK talent, no constellation boost. High plunge Lv10 404%
  // Q slash: Lv10 472%, Lv13 (C5+) 558% + DoT Lv10 216%, Lv13 (C5+) 255% ×5
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 4.08 : 3.46;
    const qSlash = this.constellation >= 5 ? 5.58 : 4.72;
    const qDot = this.constellation >= 5 ? 2.55 : 2.16;
    return {
      "kazuha-skill": {
        label: { zh: "千早振", en: "Chihayaburu (Press)" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "kazuha-plunge": {
        label: { zh: "乱岚拨止", en: "Midare Ranzan (Plunge)" },
        parts: [
          {
            formula: new DirectFormula(4.04, {
              element: "Anemo",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      "kazuha-burst": {
        label: { zh: "万叶之一刀", en: "Kazuha Slash + DoT (×5)" },
        parts: [
          {
            formula: new DirectFormula(qSlash, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(qDot, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 5,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("yoimiya")
class Yoimiya extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: During E, Pyro DMG +2% per Normal ATK hit (max 10 stacks = 20%)
      new StatBuff(cbs(this, ["A1"], "P1"), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.2 },
      ]),
      // P2: Q explosion grants party (except Yoimiya) +20% ATK for 15s (10% base + 1% per P1 stack)
      new StatBuff(cbs(this, ["A4", "Q"], "P2"), { receiver: "team" }, [
        { key: "atk%", value: 0.2 },
      ]),
    ];

    if (this.constellation >= 1) {
      // C1: Defeating Aurous Blaze marked enemy -> +20% ATK
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C1"), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.2 },
        ])
      );
    }
    if (this.constellation >= 2) {
      // C2: CRIT Hit -> +25% Pyro DMG
      buffs.push(
        new StatBuff(
          cbs(this, ["normal", "charge", "skill", "burst"], "C2"),
          { receiver: "selfOnField" },
          [{ key: "pyro%", value: 0.25 }]
        )
      );
    }

    return buffs;
  })();

  protected readonly formulaMap = (() => {
    // NA Lv10 base total: 1-Hit(63.6*2) + 2-Hit(122) + 3-Hit(158.6) + 4-Hit(82.8*2) + 5-Hit(188.9) = 762.3%
    const naTotal = 7.623;
    // Vape hits (N1a, N3, N5): 63.6 + 158.6 + 188.9 = 411.1%
    const vapeHits = 4.111;
    const nonVapeHits = naTotal - vapeHits; // 3.512

    const eMult = this.constellation >= 3 ? 1.706 : 1.617;
    // C6: 50% chance of an extra blazing arrow dealing 60% DMG = average +30% motion value
    const c6AvgProd = this.constellation >= 6 ? 1.3 : 1.0;

    const qInitialMult = this.constellation >= 5 ? 2.7 : 2.29;
    const qExplosionMult = this.constellation >= 5 ? 2.59 : 2.2;

    return {
      "yoimiya-normal": {
        label: { zh: "首轮普攻(E强化/无反应)", en: "N1-N5 Combo (E active)" },
        parts: [
          {
            formula: new DirectFormula(naTotal * eMult * c6AvgProd, {
              element: "Pyro",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "yoimiya-vape": {
        label: {
          zh: "首轮普攻(E强化/含蒸发)",
          en: "N1-N5 Combo (Vape N1a, N3, N5)",
        },
        parts: [
          {
            formula: new AmplifyFormula(vapeHits * eMult * c6AvgProd, {
              element: "Pyro",
              ability: "normal",
              reaction: "vaporize",
            }),
          },
          {
            formula: new DirectFormula(nonVapeHits * eMult * c6AvgProd, {
              element: "Pyro",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "yoimiya-burst": {
        label: {
          zh: "琉金云间草(爆发+2次爆炸)",
          en: "Ryuukin Saxifrage (Initial + 2 Explosions)",
        },
        parts: [
          {
            formula: new DirectFormula(qInitialMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(qExplosionMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 2,
          },
        ],
      },
      "yoimiya-burst-vape": {
        label: {
          zh: "琉金云间草(次次蒸发)",
          en: "Ryuukin Saxifrage (All Vapes)",
        },
        parts: [
          {
            formula: new AmplifyFormula(qInitialMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "vaporize",
            }),
          },
          {
            formula: new AmplifyFormula(qExplosionMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "vaporize",
            }),
            hits: 2,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("yae_miko")
class YaeMiko extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: Each point of EM → Sesshou Sakura DMG +0.15%
      new ScalingBuff(
        cbs(this, ["A4"], "P2"),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [],
        "em",
        "dmg%",
        0.0015
      ),
    ];

    if (this.constellation >= 4) {
      // C4: Totem hit -> Team Electro DMG +20%
      buffs.push(
        new StatBuff(cbs(this, ["E"], "C4"), { receiver: "team" }, [
          { key: "electro%", value: 0.2 },
        ])
      );
    }
    if (this.constellation >= 6) {
      // C6: Sesshou Sakura attacks ignore 60% of opponents' DEF
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C6"),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "defIgnore%", value: 0.6 }]
        )
      );
    }
    return buffs;
  })();

  protected readonly formulaMap = (() => {
    let eMult = 0;
    if (this.constellation >= 3) {
      eMult = this.constellation >= 2 ? 2.518 : 2.014; // Lv13 (Lv4 or Lv3)
    } else {
      eMult = this.constellation >= 2 ? 2.133 : 1.706; // Lv10 (Lv4 or Lv3)
    }

    const qInitialMult = this.constellation >= 5 ? 5.53 : 4.68;
    const qThunderboltMult = this.constellation >= 5 ? 7.09 : 6.01;

    return {
      "yae_miko-skill": {
        label: { zh: "杀生樱(单次)", en: "Sesshou Sakura (Single Hit)" },
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
      "yae_miko-skill-aggravate": {
        label: { zh: "杀生樱(超激化)", en: "Sesshou Sakura (Aggravate)" },
        parts: [
          {
            formula: new CatalyzeFormula(eMult, {
              element: "Electro",
              ability: "skill",
              reaction: "aggravate",
            }),
          },
        ],
      },
      "yae_miko-burst": {
        label: { zh: "天狐显真(总伤害)", en: "Tenko Kenshin (Complete)" },
        parts: [
          {
            formula: new DirectFormula(qInitialMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(qThunderboltMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
      "yae_miko-burst-aggravate": {
        label: {
          zh: "天狐显真(一次超激化)",
          en: "Tenko Kenshin (1 Aggravate)",
        },
        parts: [
          {
            formula: new CatalyzeFormula(qInitialMult, {
              element: "Electro",
              ability: "burst",
              reaction: "aggravate",
            }),
          },
          {
            formula: new DirectFormula(qThunderboltMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
    };
  })();
}
