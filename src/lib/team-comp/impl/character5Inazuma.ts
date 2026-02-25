import { ScalingBuff, StatBuff } from "../damageBuffs";
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
        cbs(this, "E", ["E"]),
        { receiver: "team", filter: { reactions: ["swirl"] } },
        [],
        "em",
        "reactionDmg%",
        eReactDmg
      ),
      // P2: EM +100 when teammates hit with Pyro/Hydro/Cryo/Electro
      new StatBuff(cbs(this, "P2", ["A4", "E"]), { receiver: "self" }, [
        { key: "em", value: 100 },
      ]),
    ];

    // C1: 二十三夜待 mark — peak-damage model assumes mark always active;
    // Swirl against marked enemy deals +1100% EM as additional DMG (EM × 11.0)
    if (this.constellation >= 1) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C1", ["passive"]),
          { receiver: "self", filter: { reactions: ["swirl"] } },
          [],
          "em",
          "reactionDmg%",
          11.0
        )
      );
    }

    if (this.constellation >= 2) {
      // C2: per EM point → 0.04% Pyro/Hydro/Cryo/Electro DMG to team
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["E"]),
          {
            receiver: "team",
            filter: { elements: ["Pyro", "Hydro", "Cryo", "Electro"] },
          },
          [],
          "em",
          "dmg%",
          0.0004
        )
      );
    }
    if (this.constellation >= 6) {
      // C6: Swirl can crit — fixed CR 30%, CD 100%
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
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
    const eTickMult = this.constellation >= 3 ? 0.954 : 0.808;
    const canSwirl = this.teamMeta.hasReaction("swirl");

    return {
      ...(canSwirl
        ? {
            "mizuki-skill-swirl": {
              label: {
                zh: "E 梦浮持续攻击+一次扩散伤害",
                en: "E Dreamdrifter Tick + Swirl",
              },
              parts: [
                {
                  formula: new DirectFormula(eTickMult, {
                    element: "Anemo",
                    ability: "skill",
                    reaction: "none",
                  }),
                },
                {
                  formula: new TransformFormula(1.0, {
                    element: "Anemo",
                    ability: "skill",
                    reaction: "swirl",
                  }),
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("chiori")
class Chiori extends CharacterBase {
  readonly buffs = [
    // P2: When team creates Geo construct → Chiori Geo DMG +20%
    new StatBuff(cbs(this, "P2", []), { receiver: "selfOnField" }, [
      { key: "geo%", value: 0.2 },
    ]),
    // C6: Normal ATK baseDmg +235% DEF (additive, not formula dual-scaling)
    new ScalingBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [],
      "def",
      "baseDmg",
      this.constellation >= 6 ? 2.35 : 0
    ),
  ];

  protected readonly formulaMap = (() => {
    // Tamoto: Lv10 148% ATK + 185% DEF, C3+: 174% ATK + 218% DEF
    // ~5 hits over 17s (3.6s interval)
    const tAtk = this.constellation >= 3 ? 1.74 : 1.48;
    const tDef = this.constellation >= 3 ? 2.18 : 1.85;
    // Upward Sweep: Lv10 269% ATK + 336% DEF, C3+: 317% ATK + 397% DEF
    const sweepAtk = this.constellation >= 3 ? 3.17 : 2.69;
    const sweepDef = this.constellation >= 3 ? 3.97 : 3.36;
    // C6 Normal Attack: 5 hits total, 459% ATK total at Lv10. We average the mult per hit so 'hits: 5' applies baseDmg 5 times.
    const naTotalArg = 4.59 / 5;

    return {
      "chiori-sweep": {
        label: { zh: "E 上挑攻击伤害", en: "E Upward Sweep" },
        parts: [
          {
            formula: new DirectFormula(
              sweepAtk,
              { element: "Geo", ability: "skill", reaction: "none" },
              "atk",
              { key: "def", multiplier: sweepDef }
            ),
          },
        ],
      },
      "chiori-tamoto": {
        label: { zh: "E 袖攻击总伤", en: "E Tamoto Total" },
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
      // P1 Tapestry "Seize the Moment": Tamoto coordinated attack = 100% of upward sweep DMG.
      // Fires up to 2× per Tapestry activation (once every 2s, 8s duration).
      // Considered Elemental Skill DMG. The per-hit multiplier is identical to chiori-sweep.
      "chiori-p1-coordinated": {
        label: { zh: "P1 织锦协同攻击", en: "P1 Tapestry Coordinated Attack" },
        parts: [
          {
            formula: new DirectFormula(
              sweepAtk,
              { element: "Geo", ability: "skill", reaction: "none" },
              "atk",
              { key: "def", multiplier: sweepDef }
            ),
          },
        ],
      },
      // Q Hiyoku: Twin Blades — Lv10 461% ATK + 577% DEF, Lv13 (C5+) 544% ATK + 681% DEF
      "chiori-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          {
            formula: new DirectFormula(
              this.constellation >= 5 ? 5.442 : 4.61,
              { element: "Geo", ability: "burst", reaction: "none" },
              "atk",
              {
                key: "def",
                multiplier: this.constellation >= 5 ? 6.801 : 5.763,
              }
            ),
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "chiori-na": {
              label: {
                zh: "C6普攻一套",
                en: "A Normal ATK Combo (C6)",
              },
              parts: [
                {
                  formula: new DirectFormula(naTotalArg, {
                    element: "Geo",
                    ability: "normal",
                    reaction: "none",
                  }),
                  hits: 5,
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("raiden_shogun")
class RaidenShogun extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: Each 1% ER above 100% → 0.4% Electro DMG Bonus
      // At 240% ER: (2.4 - 1.0) × 0.4 = 0.56 → 56% Electro DMG
      new ScalingBuff(
        cbs(this, "P2", []),
        { receiver: "selfOnField" },
        [],
        "er",
        "electro%",
        0.4,
        undefined,
        1.0
      ),
      // E: Team Burst DMG bonus based on energy cost (0.3%/0.36% per energy)
      // Assume average 70 energy cost Q
      new StatBuff(
        cbs(this, "E", ["E"]),
        { receiver: "onField", filter: { abilities: ["burst"] } },
        (() => {
          const pctPerEnergy = this.constellation >= 5 ? 0.0036 : 0.003;
          return [{ key: "dmg%", value: pctPerEnergy * 70 }];
        })()
      ),
    ];
    // C2: Q attacks ignore 60% DEF
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "defIgnore%", value: 0.6 }]
        )
      );
    }
    // C4: After Q, team (excl self) ATK +30%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
          { key: "atk%", value: 0.3 },
        ])
      );
    }
    return buffs;
  })();

  // Q initial slash: Lv10 721% + 7.98%×60 = 1199.8%
  // Lv13 (C3+): 851% + 9.42%×60 = 1416.2%
  // Q Charged ATK (Musou Isshin): two hits at different multipliers (S3 requires separate parts)
  //   Lv10: 109.9% + 132.7% + 7.98%×60 each = (1.099 + 1.327 + Resolve) × 2 parts
  //   Lv13 (C3+): 128.8% + 155.5% + 9.42%×60 each
  protected readonly formulaMap = (() => {
    const initialMult =
      this.constellation >= 3 ? 8.51 + 0.0942 * 60 : 7.21 + 0.0798 * 60;
    const resolveMult = this.constellation >= 3 ? 0.0942 * 60 : 0.0798 * 60;
    // Charged ATK: hit1 + resolve, hit2 + resolve
    const chargeHit1 = this.constellation >= 3 ? 1.288 : 1.099;
    const chargeHit2 = this.constellation >= 3 ? 1.555 : 1.327;
    const electroBurst = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "raiden-initial": {
        label: {
          zh: "Q初始斩",
          en: "Q Initial Slash (60 Resolve)",
        },
        parts: [
          {
            formula: new DirectFormula(initialMult, electroBurst),
          },
        ],
      },
      "raiden-charge": {
        label: {
          zh: "Q后梦想一心重击伤害",
          en: "Q CA (60 Resolve)",
        },
        parts: [
          {
            // Charged hit 1: base% + resolve bonus (Lv10: 109.9% + 479%@60stacks)
            formula: new DirectFormula(chargeHit1 + resolveMult, electroBurst),
          },
          {
            // Charged hit 2: base% + resolve bonus (Lv10: 132.7% + 479%@60stacks)
            formula: new DirectFormula(chargeHit2 + resolveMult, electroBurst),
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
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "selfOnField" },
      [],
      "def",
      "atk",
      this.constellation >= 5 ? 1.224 : 1.037
    ),
    // P2: Arataki Kesagiri DMG +35% of DEF → flat baseDmg on charge
    new ScalingBuff(
      cbs(this, "P2", []),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [],
      "def",
      "baseDmg",
      0.35
    ),
    // C4: After Q ends, team +20% DEF, +20% ATK for 10s
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "team" },
      this.constellation >= 4
        ? [
            { key: "def%", value: 0.2 },
            { key: "atk%", value: 0.2 },
          ]
        : []
    ),
    // C6: Charged ATK CD +70%
    new StatBuff(
      cbs(this, "C6", []),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      this.constellation >= 6 ? [{ key: "cd", value: 0.7 }] : []
    ),
    // P1: Kesagiri ATK SPD (assume max +30%)
    new StatBuff(
      cbs(this, "P1", []),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "atkSpd%", value: 0.3 }]
    ),
    // Q: Raging Oni King State Normal ATK SPD +10%
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [{ key: "atkSpd%", value: 0.1 }]
    ),
  ];

  protected readonly formulaMap = (() => {
    // Arataki Kesagiri: combo slashes + 1 final slash
    // C6: Ushi assists each slash → doubles combo count from 4 to 8
    // Combo Lv10: 180.2%, Final Lv10: 377.4%
    const combo = 1.802;
    const final_ = 3.774;
    const comboCount = this.constellation >= 6 ? 8 : 4;
    const geoCharge = {
      element: "Geo" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    return {
      "itto-kesagiri": {
        label: {
          zh: `重击${comboCount}+终`,
          en: `A Arataki Kesagiri (${comboCount}+Final)`,
        },
        parts: [
          { formula: new DirectFormula(combo, geoCharge), hits: comboCount },
          { formula: new DirectFormula(final_, geoCharge) },
        ],
      },
    };
  })();
}

@RegisterCharacter("kamisato_ayaka")
class KamisatoAyaka extends CharacterBase {
  readonly buffs = [
    // P1: After E, Normal/Charged DMG +30% for 6s
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["normal", "charge"] } },
      [{ key: "dmg%", value: 0.3 }]
    ),
    // P2: After alternate sprint hit, Cryo DMG +18%
    new StatBuff(cbs(this, "P2", ["dash"]), { receiver: "selfOnField" }, [
      { key: "cryo%", value: 0.18 },
    ]),
    // C2: 2 smaller Frostflake Seki no To → effectively +40% burst DMG (baseDmg%)
    new StatBuff(
      cbs(this, "C2", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      this.constellation >= 2 ? [{ key: "baseDmg%", value: 0.4 }] : []
    ),
    // C4: Enemies hit by Q: DEF -30% for 6s
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "team" },
      this.constellation >= 4 ? [{ key: "defReduction%", value: 0.3 }] : []
    ),
    // C6: Charged ATK DMG +298% every 10s
    new StatBuff(
      cbs(this, "C6", []),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      this.constellation >= 6 ? [{ key: "dmg%", value: 2.98 }] : []
    ),
  ];

  // Charged ATK: Lv10 109.0%×3 (Normal talent, no constellation boost)
  // Q cutting: Lv10 202%, Lv13 (C3+) 239%, ~19 cuts + bloom 303%/358%
  // C2: +2 smaller storms → +40% burst baseDmg% (handled via StatBuff, not pre-multiplied)
  protected readonly formulaMap = (() => {
    const cutMult = this.constellation >= 3 ? 2.39 : 2.02;
    const bloomMult = this.constellation >= 3 ? 3.58 : 3.03;
    const cryoBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "ayaka-charged": {
        label: { zh: "重击×3", en: "CA (×3)" },
        parts: [
          {
            formula: new DirectFormula(1.09, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
      "ayaka-burst": {
        label: { zh: "Q(19切+绽)", en: "Q (19 slashes + Bloom)" },
        parts: [
          { formula: new DirectFormula(cutMult, cryoBurst), hits: 19 },
          { formula: new DirectFormula(bloomMult, cryoBurst) },
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
        cbs(this, "Q", ["Q"]),
        { receiver: "onField", filter: { abilities: ["normal"] } },
        [{ key: "dmg%", value: 0.2 }]
      ),
    ];
    // C2: At ≥3 Namisen stacks, HP +50%
    if (this.constellation >= 2) {
      ibuffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "selfOnField" }, [
          { key: "hp%", value: 0.5 },
        ])
      );
    }
    // C4: After Q, nearby party members Normal ATK SPD +15%
    if (this.constellation >= 4) {
      ibuffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          { receiver: "team", filter: { abilities: ["normal"] } },
          [{ key: "atkSpd%", value: 0.15 }]
        )
      );
    }
    return ibuffs;
  })();

  // Shunsuiken 3-hit combo (S3: separate parts per different multiplier)
  // N1: Lv10 104.6%, Lv13 (C3+) 126.7%
  // N2: Lv10 116.5%, Lv13 (C3+) 141.1%
  // N3: Lv10 128.4%, Lv13 (C3+) 155.5%
  // Namisen per hit: 4 stacks × 1.11% HP (C2: 5 stacks)
  // Q Bloomwater: Lv10 119.6%, Lv13 (C5+) 141.2%, ~30 hits over 18s
  protected readonly formulaMap = (() => {
    const n1Mult = this.constellation >= 3 ? 1.267 : 1.046;
    const n2Mult = this.constellation >= 3 ? 1.411 : 1.165;
    const n3Mult = this.constellation >= 3 ? 1.555 : 1.284;
    const stacks = this.constellation >= 2 ? 5 : 4;
    const namisenPerHit = this.constellation >= 3 ? 0.0134 : 0.0111;
    const hpPerHit = stacks * namisenPerHit;
    const qMult = this.constellation >= 5 ? 1.412 : 1.196;
    const hydroTag = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    return {
      "ayato-shunsuiken": {
        label: { zh: "E普攻三段连击", en: "E NA Combo (N1+N2+N3)" },
        parts: [
          {
            formula: new DirectFormula(n1Mult, hydroTag, "atk", {
              key: "hp",
              multiplier: hpPerHit,
            }),
          },
          {
            formula: new DirectFormula(n2Mult, hydroTag, "atk", {
              key: "hp",
              multiplier: hpPerHit,
            }),
          },
          {
            formula: new DirectFormula(n3Mult, hydroTag, "atk", {
              key: "hp",
              multiplier: hpPerHit,
            }),
          },
        ],
      },
      "ayato-bloomwater": {
        label: { zh: "Q 水花剑(×30)", en: "Q Bloomwater Blades (×30)" },
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
    new StatBuff(cbs(this, "P4", []), { receiver: "selfOnField" }, [
      { key: "cr", value: -1.0 },
      { key: "heal%", value: 0.25 },
    ]),
    // P2 (Song of Pearls): During Q, 15% of heal% → Normal/Charged DMG baseDmg%
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge"] },
      },
      [],
      "heal%",
      "baseDmg%",
      0.15
    ),
    // Q: Nereid's Ascension — HP → baseDmg for Normal Attacks
    // Lv10: 8.7% HP, Lv13 (C3+): 10.3% HP
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal"] },
      },
      [],
      "hp",
      "baseDmg",
      this.constellation >= 3 ? 0.103 : 0.087
    ),
    // Q: Nereid's Ascension — HP → baseDmg for Charged Attacks
    // Lv10: 12.2% HP, Lv13 (C3+): 14.4% HP
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["charge"] },
      },
      [],
      "hp",
      "baseDmg",
      this.constellation >= 3 ? 0.144 : 0.122
    ),
    // C6: Q heal on 80%+ HP → Hydro DMG +40%
    new StatBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "selfOnField" },
      this.constellation >= 6 ? [{ key: "hydro%", value: 0.4 }] : []
    ),
  ];

  // On-field healer DPS — damage comes from Normal ATKs during Q
  protected readonly formulaMap = {};
}

@RegisterCharacter("kaedehara_kazuha")
class KaedeharaKazuha extends CharacterBase {
  readonly buffs = (() => {
    // P2: Poetics of Fuubutsu — after Swirl, grant 0.04% elemental DMG% per EM per absorbed element
    // Game text: "触发扩散反应后，每点元素精通，会为队伍中所有角色提供0.04%对应元素伤害加成"
    // One ScalingBuff per element present in the team (Swirl can absorb Hydro/Pyro/Cryo/Electro).
    const absorbable = ["Hydro", "Pyro", "Cryo", "Electro"] as const;
    const teamElements = new Set(Object.values(this.teamMeta.elements));
    const p2Buffs = absorbable
      .filter((el) => teamElements.has(el))
      .map(
        (el) =>
          new ScalingBuff(
            cbs(this, "P2", ["swirl"]),
            { receiver: "team", filter: { elements: [el] } },
            [],
            "em",
            "dmg%",
            0.0004
          )
      );

    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      ...p2Buffs,
    ];

    // C2: Q field grants 200 EM to the party
    buffs.push(
      new StatBuff(
        cbs(this, "C2", ["Q"]),
        { receiver: "team" },
        this.constellation >= 2 ? [{ key: "em", value: 200 }] : []
      )
    );

    // C6: Crimson Momiji — each point of EM increases NA/CA/Plunge DMG by 0.2%
    // "每点元素精通，都会使他的普通攻击、重击、下落攻击造成的伤害提高0.2%"
    if (this.constellation >= 6) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", ["E", "Q"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge", "plunge"] },
          },
          [],
          "em",
          "dmg%",
          0.002
        )
      );
    }

    return buffs;
  })();

  // E press: Lv10 346%, Lv13 (C3+) 408%
  // C6 High Plunge (Midare Ranzan): Normal ATK talent, no constellation boost. High plunge Lv10 404%
  // Q slash: Lv10 472%, Lv13 (C5+) 558% + DoT Lv10 216%, Lv13 (C5+) 255% ×5
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 4.08 : 3.46;
    const qSlash = this.constellation >= 5 ? 5.58 : 4.72;
    const qDot = this.constellation >= 5 ? 2.55 : 2.16;
    return {
      "kazuha-skill": {
        label: { zh: "E 千早振", en: "E Chihayaburu (Press)" },
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
      ...(this.constellation >= 6
        ? {
            "kazuha-plunge-c6": {
              label: { zh: "C6高空下落", en: "C6 High Plunge" },
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
          }
        : {}),
      "kazuha-burst": {
        label: { zh: "Q 万叶之一刀", en: "Q Kazuha Slash + DoT (×5)" },
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
      new StatBuff(cbs(this, "P1", ["A1"]), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.2 },
      ]),
      // P2: Q explosion grants party (except Yoimiya) +20% ATK for 15s (10% base + 1% per P1 stack)
      new StatBuff(cbs(this, "P2", ["A4", "Q"]), { receiver: "team" }, [
        { key: "atk%", value: 0.2 },
      ]),
    ];

    if (this.constellation >= 1) {
      // C1: Defeating Aurous Blaze marked enemy -> +20% ATK
      buffs.push(
        new StatBuff(cbs(this, "C1", ["Q"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.2 },
        ])
      );
    }
    if (this.constellation >= 2) {
      // C2: CRIT Hit -> +25% Pyro DMG
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["normal", "charge", "skill", "burst"]),
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

    return {
      "yoimiya-normal": {
        label: {
          zh: "E普攻(无反应)",
          en: "A N1-N5 Combo (E active)",
        },
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
          zh: "E普攻(蒸发)",
          en: "A N1-N5 Combo (Vape N1a, N3, N5)",
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
    };
  })();
}

@RegisterCharacter("yae_miko")
class YaeMiko extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: Each point of EM → Sesshou Sakura DMG +0.15%
      // Sakura fires even when Yae is off-field → receiver: "self" (not selfOnField)
      new ScalingBuff(
        cbs(this, "P2", ["A4"]),
        { receiver: "self", filter: { abilities: ["skill"] } },
        [],
        "em",
        "dmg%",
        0.0015
      ),
    ];

    if (this.constellation >= 4) {
      // C4: Totem hit -> Team Electro DMG +20%
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E"]), { receiver: "team" }, [
          { key: "electro%", value: 0.2 },
        ])
      );
    }
    if (this.constellation >= 6) {
      // C6: Sesshou Sakura attacks ignore 60% of opponents' DEF
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
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
        label: { zh: "E 杀生樱(单次)", en: "E Sesshou Sakura (Single Hit)" },
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
        label: { zh: "E 杀生樱(超激化)", en: "E Sesshou Sakura (Aggravate)" },
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
        label: { zh: "Q总伤害", en: "Q Tenko Kenshin (Complete)" },
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
          zh: "Q(单次超激)",
          en: "Q Tenko Kenshin (1 Aggravate)",
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
