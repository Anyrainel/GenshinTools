import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 5★ Fontaine Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("escoffier")
class Escoffier extends CharacterBase {
  private readonly hydroCryo =
    this.teamMeta.countByElement("Hydro") +
    this.teamMeta.countByElement("Cryo");

  readonly buffs = (() => {
    const shredTiers = [0, 0.05, 0.1, 0.15, 0.55] as const;
    const shred = shredTiers[Math.min(this.hydroCryo, 4)];
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: Hydro/Cryo RES shred based on # Hydro+Cryo in party
      new StatBuff(
        cbs(this, "P2", ["E", "Q"]),
        { receiver: "team", filter: { elements: ["Hydro", "Cryo"] } },
        [{ key: "resReduction%", value: shred }]
      ),
    ];
    // C1: All 4 Hydro/Cryo → team Cryo DMG CD +60%
    if (this.constellation >= 1 && this.hydroCryo >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E", "Q"]),
          { receiver: "team", filter: { elements: ["Cryo"] } },
          [{ key: "cd", value: 0.6 }]
        )
      );
    }
    // C2: Cold Storage → on-field (others) Cryo DMG gets baseDmg from Escoffier's ATK ×240%
    if (this.constellation >= 2) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["E"]),
          {
            receiver: "otherOnField",
            filter: {
              elements: ["Cryo"],
              abilities: ["normal", "charge", "plunge", "skill", "burst"],
            },
          },
          [],
          "atk",
          "baseDmg",
          2.4
        )
      );
    }
    return buffs;
  })();

  // E: Skill cast Lv10: 90.7%, Lv13 (C3+): 107.1%
  // E: Frosty Parfait Lv10: 216.0%, Lv13 (C3+): 255.0%, 21 ticks over 20s
  // Q: Scoring Cuts Lv10: 1067.0%, Lv13 (C5+): 1259.7%
  // C6: Special-Grade Frosty Parfait 500% ATK, triggered by active NA/CA/Plunge,
  //     max 6× per Cold Storage mode duration. DmgTODO listed as "per-hit tracking
  //     limitation" but this is wrong: the per-trigger damage is fixed (500% ATK,
  //     Skill DMG) and the cap is 6 per duration — modeled identically to Q1/Q5
  //     "per-rotation counter → add formula with hits:6".
  protected readonly formulaMap = (() => {
    const skillCastMult = this.constellation >= 3 ? 1.071 : 0.907;
    const parfaitMult = this.constellation >= 3 ? 2.55 : 2.16;
    const qMult = this.constellation >= 5 ? 12.597 : 10.67;
    const skillTag = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "escoffier-skill-parfait": {
        label: {
          zh: "E伤害+芭菲×21",
          en: "E Cast + Parfait (×21)",
        },
        parts: [
          {
            formula: new DirectFormula(skillCastMult, skillTag),
          },
          {
            formula: new DirectFormula(parfaitMult, skillTag),
            hits: 21,
          },
        ],
      },
      "escoffier-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "escoffier-c6-parfait": {
              label: {
                zh: "6命 E芭菲×6",
                en: "C6 E Parfait (×6)",
              },
              parts: [
                {
                  formula: new DirectFormula(5.0, skillTag),
                  hits: 6,
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: E + Q (Cryo healer/support, off-field); formulas already bake in hit counts
  protected override get defaultRotation() {
    return {
      "escoffier-skill-parfait": 1,
      "escoffier-burst": 1,
      "escoffier-c6-parfait": 1,
    };
  }
}

@RegisterCharacter("emilie")
class Emilie extends CharacterBase {
  readonly buffs = (() => {
    const hasPyro = this.teamMeta.countByElement("Pyro") > 0;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: vs Burning enemies, per 1000 ATK → DMG +15% (cap 36%)
      // Game text: "对处于燃烧状态下的敌人造成的伤害" — requires Burning (Pyro teammate)
      ...(hasPyro
        ? [
            new ScalingBuff(
              cbs(this, "P2", ["burning"]),
              { receiver: "self" },
              [],
              "atk",
              "dmg%",
              0.00015,
              0.36
            ),
          ]
        : []),
      // C1: E and P1 Cleardew DMG +20%
      ...(this.constellation >= 1
        ? [
            new StatBuff(
              cbs(this, "C1", ["E"]),
              {
                receiver: "self",
                filter: { abilities: ["skill", "special"] },
              },
              [{ key: "dmg%", value: 0.2 }]
            ),
          ]
        : []),
      // C2: E/Q/Cleardew hit → enemies' Dendro RES -30%
      ...(this.constellation >= 2
        ? [
            new StatBuff(
              cbs(this, "C2", ["E", "Q"]),
              { receiver: "team", filter: { elements: ["Dendro"] } },
              [{ key: "resReduction%", value: 0.3 }]
            ),
          ]
        : []),
      // C6: After E/Q, Normal/Charged become Dendro + flat baseDmg from ATK ×300%
      ...(this.constellation >= 6
        ? [
            new ScalingBuff(
              cbs(this, "C6", ["E"]),
              {
                receiver: "selfOnField",
                filter: { abilities: ["normal", "charge"] },
              },
              [],
              "atk",
              "baseDmg",
              3.0
            ),
          ]
        : []),
    ];
    return buffs;
  })();

  // E Lv2 Case: 151.2%×2 shots per tick (Lv10), 178.5%×2 (Lv13 C3+), 14 ticks × 2 shots = 28 hits
  // P1 Cleardew Cologne: 600% ATK (not skill DMG), fires every 2 scent collections
  // Q Lv3 Case: 391.0% (Lv10), 461.6% (Lv13 C5+), ~4 drops over 2.8s
  protected readonly formulaMap = (() => {
    const lv2ShotMult = this.constellation >= 3 ? 1.785 : 1.512;
    const qMult = this.constellation >= 5 ? 4.616 : 3.91;
    const hasPyro = this.teamMeta.countByElement("Pyro") > 0;

    const normalParts = [
      {
        formula: new DirectFormula(0.96, {
          element: "Dendro",
          ability: "normal",
          reaction: "none",
        }),
      },
      {
        formula: new DirectFormula(0.887, {
          element: "Dendro",
          ability: "normal",
          reaction: "none",
        }),
      },
      {
        formula: new DirectFormula(1.172, {
          element: "Dendro",
          ability: "normal",
          reaction: "none",
        }),
      },
      {
        formula: new DirectFormula(1.485, {
          element: "Dendro",
          ability: "normal",
          reaction: "none",
        }),
      },
    ];

    return {
      ...(hasPyro
        ? {
            "emilie-skill-burning": {
              label: {
                zh: "E伤害×28+清露×5",
                en: "E Lv2 (×28) + Cleardew (×5)",
              },
              parts: [
                {
                  formula: new DirectFormula(lv2ShotMult, {
                    element: "Dendro",
                    ability: "skill",
                    reaction: "none",
                  }),
                  hits: 28,
                },
                {
                  formula: new DirectFormula(6.0, {
                    element: "Dendro",
                    ability: "special",
                    reaction: "none",
                  }),
                  hits: 5,
                },
              ],
            },
          }
        : {}),
      "emilie-burst-9hit": {
        label: { zh: "Q伤害×9", en: "Q (×9)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 9,
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "emilie-c6-normal": {
              label: { zh: "6命 普攻一套", en: "C6 Normal Combo" },
              parts: normalParts,
            },
          }
        : {}),
    };
  })();

  // Rotation: E + Q (off-field Dendro sub-DPS in Burning teams); formulas bake in hit counts
  protected override get defaultRotation() {
    return {
      "emilie-skill-burning": 1,
      "emilie-burst-9hit": 1,
      "emilie-c6-normal": 1,
    };
  }
}

@RegisterCharacter("sigewinne")
class Sigewinne extends CharacterBase {
  readonly buffs = (() => {
    const isC1 = this.constellation >= 1;
    const buffs: StatBuff[] = [
      // P1: HP > 30k → E baseDmg +80 (C1: 100) per 1000 HP. Max 2800 (C1: 3500)
      // Game text: off-field party members only, excluding Sigewinne.
      // Approximated as otherOnField — see DmgTODO.
      new ScalingBuff(
        cbs(this, "P1", ["E"]),
        { receiver: "otherOnField", filter: { abilities: ["skill"] } },
        [],
        "hp",
        "baseDmg",
        isC1 ? 0.1 : 0.08,
        isC1 ? 3500 : 2800,
        30000
      ),
      // P1: Sigewinne herself gains +8% Hydro DMG Bonus
      new StatBuff(cbs(this, "P1", ["E"]), { receiver: "self" }, [
        { key: "hydro%", value: 0.08 },
      ]),
    ];

    // C2: E or Q hit → Hydro RES -35%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E", "Q"]),
          { receiver: "team", filter: { elements: ["Hydro"] } },
          [{ key: "resReduction%", value: 0.35 }]
        )
      );
    }

    // C6: HP → Q CR+20%, CD+110% (0.4% CR, 2.2% CD per 1000 HP)
    if (this.constellation >= 6) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "hp",
          "cr",
          0.000004,
          0.2
        ),
        new ScalingBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "hp",
          "cd",
          0.000022,
          1.1
        )
      );
    }

    return buffs;
  })();

  // Q: Super Saturated Syringing Lv10: 21.2% HP, Lv13 (C5+): 25.0% HP
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 5 ? 0.25 : 0.212;
    return {
      "sigewinne-burst": {
        label: { zh: "Q伤害×6", en: "Q (×6)" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
            hits: 6,
          },
        ],
      },
      ...(this.constellation >= 4
        ? {
            "sigewinne-burst-c4": {
              label: { zh: "4命Q伤害×14", en: "C4 Q (×14)" },
              parts: [
                {
                  formula: new DirectFormula(
                    qMult,
                    { element: "Hydro", ability: "burst", reaction: "none" },
                    "hp"
                  ),
                  hits: 14,
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: E + Q (Hydro healer/support); Q used to fill downtime
  protected override get defaultRotation() {
    return { "sigewinne-burst": 1, "sigewinne-burst-c4": 1 };
  }
}

@RegisterCharacter("clorinde")
class Clorinde extends CharacterBase {
  readonly buffs = [
    // P1: After Electro-related reaction, +20% ATK (C2: 30%) × 3 stacks as baseDmg
    // on Normal ATK and Q Electro DMG; max increase 1800 (C2: 2700)
    new ScalingBuff(
      cbs(this, "P1", ["elemental-reaction"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "burst"], elements: ["Electro"] },
      },
      [],
      "atk",
      "baseDmg",
      this.constellation >= 2 ? 0.9 : 0.6,
      this.constellation >= 2 ? 2700 : 1800
    ),
    // P2: BoL ≥100% + changes → CR +10% × 2 stacks = +20%
    // Game text: "克洛琳德的暴击率提升" — generic personal buff, lasts 15s
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "self" }, [
      { key: "cr", value: 0.2 },
    ]),
    // C4: Q DMG +2% per 1% BoL (max 200%) — at full BoL ~120%+
    ...(this.constellation >= 4
      ? [
          new StatBuff(
            cbs(this, "C4", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "dmg%", value: 2.0 }]
          ),
        ]
      : []),
    // C6: After E, +10% CR, +70% CD for 12s
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["E"]), { receiver: "selfOnField" }, [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.7 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // Q Last Lightfall: Lv10 228.4%×5, Lv13 (C5+) 269.6%×5
    const qMult = this.constellation >= 5 ? 2.696 : 2.284;
    // Swift Hunt rotation: 3× piercing shot (76.7%) + Impale Pact (49.6%×3)
    const swiftMult = this.constellation >= 3 ? 0.929 : 0.767;
    const impaleMult = this.constellation >= 3 ? 0.602 : 0.496;

    const normalBaseTag = {
      element: "Electro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    const normalParts = [
      { formula: new DirectFormula(swiftMult, normalBaseTag), hits: 3 },
      { formula: new DirectFormula(impaleMult, normalBaseTag), hits: 3 },
      ...(this.constellation >= 1
        ? [{ formula: new DirectFormula(0.3, normalBaseTag), hits: 2 }]
        : []),
      ...(this.constellation >= 6
        ? [{ formula: new DirectFormula(2.0, normalBaseTag), hits: 1 }]
        : []),
    ];

    return {
      "clorinde-normal": {
        label: { zh: "E普攻", en: "E Normal" },
        parts: normalParts,
      },
      "clorinde-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 5,
          },
        ],
      },
    };
  })();

  // Rotation: Q > E 6[N3E] — 6 N3E cycles per E window + Q (Electro carry, KQM)
  protected override get defaultRotation() {
    return { "clorinde-normal": 6, "clorinde-burst": 1 };
  }
}

@RegisterCharacter("navia")
class Navia extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    // P1: After E, self Normal/Charged/Plunge DMG +40%
    buffs.push(
      new StatBuff(
        cbs(this, "P1", ["E"]),
        {
          receiver: "selfOnField",
          filter: { abilities: ["normal", "charge", "plunge"] },
        },
        [{ key: "dmg%", value: 0.4 }]
      )
    );
    // P2: Per Pyro/Electro/Cryo/Hydro party member, ATK+20% (max 2 = 40%)
    // Game text: "娜维娅的攻击力提升" — generic personal buff, no on-field qualifier
    const nonGeoCount =
      this.teamMeta.countByElement("Pyro") +
      this.teamMeta.countByElement("Electro") +
      this.teamMeta.countByElement("Cryo") +
      this.teamMeta.countByElement("Hydro");
    buffs.push(
      new StatBuff(cbs(this, "P2", []), { receiver: "self" }, [
        { key: "atk%", value: Math.min(nonGeoCount, 2) * 0.2 },
      ])
    );
    // C2: 3 shrapnel → E CR +36%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "cr", value: 0.36 }]
        )
      );
    }
    // C4: Q hit → enemy Geo RES -20%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          { receiver: "team", filter: { elements: ["Geo"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
    }
    // C6: 3 extra shrapnel → E CD +135% (45% × 3)
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "cd", value: 1.35 }]
        )
      );
    }
    // E intrinsic modifiers (peak model: 6 shrapnel consumed, all 11 shots hit)
    // "11枚玫瑰晶弹全命中时，造成原本200%的伤害" → baseDmg% +1.0 (baseDmg% zone, not talent zone)
    // "超过3枚弹片每枚额外提升15%" (×3) → dmg% +0.45 (dmg% zone, separate from baseDmg% zone)
    buffs.push(
      new StatBuff(
        cbs(this, "E", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [
          { key: "baseDmg%", value: 1.0 },
          { key: "dmg%", value: 0.45 },
        ]
      )
    );
    return buffs;
  })();

  // E (6 shrapnel): Lv10 710.6%, Lv13 (C3+) 839.0%
  // "200% of original" and "+45% per extra shard" modeled as baseDmg%/dmg% buffs above
  protected readonly formulaMap = (() => {
    const baseMult = this.constellation >= 3 ? 8.39 : 7.106;
    return {
      "navia-crystalshot": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(baseMult, {
              element: "Geo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: Q > teammates > 2[E combo] — 2 E charges per ~16.5s rotation (Geo carry, KQM)
  protected override get defaultRotation() {
    return { "navia-crystalshot": 2 };
  }
}

@RegisterCharacter("furina")
class Furina extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: Per 1000 Max HP → salon members DMG +0.7% (cap 28%)
      new ScalingBuff(
        cbs(this, "P2", ["E"]),
        { receiver: "self", filter: { abilities: ["skill"] } },
        [],
        "hp",
        "dmg%",
        0.000007,
        0.28
      ),
      // Q: Let the People Rejoice — team DMG% based on Fanfare stacks
      // Per stack Lv10: 0.25%, Lv13 (C3+): 0.31%
      // Max stacks: 300 (C1: 400).
      // C0: starts at 0, ramps over 18s → ~250 avg stacks.
      // C1: starts at 150 (instant), cap 400, healing bonus feedback → ~350 avg stacks.
      new StatBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "team" },
        (() => {
          const perStack = this.constellation >= 3 ? 0.0031 : 0.0025;
          const avgStacks = this.constellation >= 1 ? 350 : 250;
          return [{ key: "dmg%", value: perStack * avgStacks }];
        })()
      ),
      // C2: Fanfare overflow → HP% buff (0.35% per point, cap 140%)
      ...(this.constellation >= 2
        ? [
            new StatBuff(cbs(this, "C2", []), { receiver: "self" }, [
              { key: "hp%", value: 1.4 },
            ]),
          ]
        : []),
    ];

    if (this.constellation >= 6) {
      // C6: Center of Attention — all NA/CA/Plunge converted to Hydro DMG
      // Universal part: +18% Max HP as flat baseDmg on each hit (both Arkhe alignments)
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", ["E"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge", "plunge"] },
          },
          [],
          "hp",
          "baseDmg",
          0.18
        )
      );
      // Pneuma-alignment extra: +25% Max HP additional baseDmg per hit.
      // Ousia alignment provides team healing (no damage formula) instead.
      // Peak-DPS model assumes Pneuma mode for all 6 Center of Attention triggers.
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", ["E"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge", "plunge"] },
          },
          [],
          "hp",
          "baseDmg",
          0.25
        )
      );
    }

    // E: "4 healthy party members → Salon Members deal 140% of original"
    // "造成原本140%的伤害" → baseDmg% +0.4 (baseDmg% zone, not talent zone)
    // Peak model: always assume 4 healthy members (S7 conditional buff → always active)
    buffs.push(
      new StatBuff(
        cbs(this, "E", ["E"]),
        { receiver: "self", filter: { abilities: ["skill"] } },
        [{ key: "baseDmg%", value: 0.4 }]
      )
    );

    return buffs;
  })();

  // E Salon Members: scale with HP
  // Gentilhomme Usher (乌瑟勋爵): 9 hits
  // Surintendante Chevalmarin (海薇玛夫人): 18 hits
  // Mademoiselle Crabaletta (谢贝蕾妲小姐): 5 hits
  // ×1.4 power bonus (4 healthy members) → baseDmg% +0.4 (in buffs above)
  protected readonly formulaMap = (() => {
    const isE13 = this.constellation >= 5;
    const usherMult = isE13 ? 0.1267 : 0.1073;
    const chevalmarinMult = isE13 ? 0.0687 : 0.0582;
    const crabalettaMult = isE13 ? 0.1761 : 0.1492;
    const hydroTag = {
      element: "Hydro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    // C6: Center of Attention (Pneuma mode) — NA combo converted to Hydro DMG
    // Furina NA Lv10: 95.6% / 86.4% / 109% / 144.9% (ATK-scaling)
    // +18% HP (universal) + 25% HP (Pneuma) baseDmg applied via C6 buffs above.
    // 6 triggers max per 10s Center of Attention window; 1 full 4-hit combo shown.
    // Ousia alignment triggers team healing only — no additional damage formula.
    const c6HydroTag = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    return {
      "furina-salon-total": {
        label: {
          zh: "E×32",
          en: "E (×32)",
        },
        parts: [
          {
            formula: new DirectFormula(chevalmarinMult, hydroTag, "hp"),
            hits: 18,
          },
          {
            formula: new DirectFormula(usherMult, hydroTag, "hp"),
            hits: 9,
          },
          {
            formula: new DirectFormula(crabalettaMult, hydroTag, "hp"),
            hits: 5,
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "furina-c6-normal": {
              label: {
                zh: "6命 普攻一套",
                en: "C6 Normal Combo",
              },
              parts: [
                {
                  formula: new DirectFormula(0.956, c6HydroTag),
                },
                {
                  formula: new DirectFormula(0.864, c6HydroTag),
                },
                {
                  formula: new DirectFormula(1.09, c6HydroTag),
                },
                {
                  formula: new DirectFormula(1.449, c6HydroTag),
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: E + Q then swap off (off-field support); salon formula bakes in 32 hits
  protected override get defaultRotation() {
    return { "furina-salon-total": 1, "furina-c6-normal": 1 };
  }
}

@RegisterCharacter("neuvillette")
class Neuvillette extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];

    const canP1React =
      this.teamMeta.hasReaction("vaporize") ||
      this.teamMeta.hasReaction("frozen") ||
      this.teamMeta.hasReaction("electroCharged") ||
      this.teamMeta.hasReaction("lunarCharged") ||
      this.teamMeta.hasReaction("bloom") ||
      this.teamMeta.hasReaction("lunarBloom") ||
      this.teamMeta.hasReaction("swirl") ||
      this.teamMeta.hasReaction("crystallize") ||
      this.teamMeta.hasReaction("lunarCrystallize");

    if (canP1React) {
      // P1: 3 stacks Past Draconic Glories → Charged deals 160% original DMG (+60%)
      // Triggers on: Vaporize, Frozen, EC, Lunar-Charged, Bloom, Lunar-Bloom,
      //   Hydro Swirl, Hydro Crystallize, Lunar-Crystallize
      buffs.push(
        new StatBuff(
          cbs(this, "P1", [
            "vaporize",
            "frozen",
            "electroCharged",
            "lunarCharged",
            "bloom",
            "lunarBloom",
            "swirl",
            "crystallize",
            "lunarCrystallize",
          ]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "baseDmg%", value: 0.6 }]
        )
      );
    }

    // P2: HP above 30% → Hydro DMG% (cap 30%). Assume near full HP → 30%
    // Game text: "使那维莱特获得…水元素伤害加成" — generic personal buff
    buffs.push(
      new StatBuff(cbs(this, "P2", []), { receiver: "self" }, [
        { key: "hydro%", value: 0.3 },
      ])
    );

    // C2: 3 stacks Past Draconic Glories → Charged CD +42% (14% × 3)
    if (canP1React && this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", []),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "cd", value: 0.42 }]
        )
      );
    }

    return buffs;
  })();

  // Equitable Judgment: Lv10 14.47% HP/tick × 10 ticks = 144.7% HP
  // Lv13 (C3+ via Normal): 17.53% HP/tick × 10 = 175.3% HP
  // C6: 2 currents every 2s during Equitable Judgment, each 10% Max HP Hydro DMG,
  //     counts as Equitable Judgment DMG (ability: "charge"). Base duration 3s;
  //     absorbing 3 droplets from E extends to 6s → 3 firings × 2 currents = 6 hits.
  protected readonly formulaMap = (() => {
    const tickMult = this.constellation >= 3 ? 0.1753 : 0.1447;
    const chargeTag = {
      element: "Hydro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    return {
      "neuvillette-judgment": {
        label: { zh: "重击×8", en: "CA (×8)" },
        parts: [
          {
            formula: new DirectFormula(tickMult, chargeTag, "hp"),
            hits: 8,
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "neuvillette-c6-currents": {
              label: {
                zh: "6命 额外×6",
                en: "C6 Extra (×6)",
              },
              parts: [
                {
                  // 10% Max HP per current; 3 droplets from E extend duration to 6s
                  // → 3 × 2-current firings = 6 currents total
                  formula: new DirectFormula(0.1, chargeTag, "hp"),
                  hits: 6,
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: E C E C Q > teammates > 2[C] — 3 CAs per rotation (Hydro carry, KQM)
  protected override get defaultRotation() {
    return { "neuvillette-judgment": 3, "neuvillette-c6-currents": 3 };
  }
}

@RegisterCharacter("wriothesley")
class Wriothesley extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1/C1: Gracious Rebuke → CA DMG Bonus (50% or 200%)
      new StatBuff(
        cbs(this, "P1/C1", ["charge"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [{ key: "dmg%", value: this.constellation >= 1 ? 2.0 : 0.5 }]
      ),
      // P2: Prosecution Edict (max 5 stacks * 6% = 30% ATK)
      new StatBuff(cbs(this, "P2", ["E"]), { receiver: "selfOnField" }, [
        { key: "atk%", value: 0.3 },
      ]),
      // E: Enhanced Repelling Fist deals 170.3% of Normal ATK DMG (baseDmg% zone)
      // "造成原本170.3%的伤害" → baseDmg% +0.703
      new StatBuff(
        cbs(this, "E", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["normal"] } },
        [{ key: "baseDmg%", value: 0.703 }]
      ),
    ];

    // C2: Each P2 stack gives +40% Q DMG (max 5 = 200%)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 2.0 }]
        )
      );
    }
    // C4: Heal overflow → on-field ATK SPD +20%, off-field → active character ATK SPD +10%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["heal-overflow"]),
          { receiver: "selfOnField" },
          [{ key: "atkSpd%", value: 0.2 }]
        ),
        new StatBuff(
          cbs(this, "C4", ["heal-overflow"]),
          { receiver: "otherOnField" },
          [{ key: "atkSpd%", value: 0.1 }]
        )
      );
    }
    // C6: Gracious Rebuke +10% CR, +80% CD
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["charge"]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.8 },
          ]
        )
      );
    }

    return buffs;
  })();

  // E Enhanced Normal combo: 5 distinct hits (N4 has 2 hits)
  // E enhancement (170.3%) modeled as baseDmg% buff above (U4 zone correctness)
  // Lv10 NA (no C3): N1=1.055, N2=1.024, N3=1.329, N4=0.749(×2), N5=1.794
  // Lv13 NA (C3+):   N1=1.278, N2=1.241, N3=1.610, N4=0.908(×2), N5=2.174
  // Rebuke CA (Lv10): 275.3%
  // Rebuke CA (Lv13 C3+): 325.0%
  // C6 Rebuke CA creates additional icicle at 100% base DMG → hits: 2
  // Q Burst (Lv10): 5 × 228.96% + Surging Blade 76.32%
  // Q Burst (Lv13 C5+): 5 × 270.30% + Surging Blade 90.10%
  protected readonly formulaMap = (() => {
    const isC3 = this.constellation >= 3;
    const n1 = isC3 ? 1.278 : 1.055;
    const n2 = isC3 ? 1.241 : 1.024;
    const n3 = isC3 ? 1.61 : 1.329;
    const n4 = isC3 ? 0.908 : 0.749;
    const n5 = isC3 ? 2.174 : 1.794;
    const cMult = isC3 ? 3.25 : 2.753;
    const cHits = this.constellation >= 6 ? 2 : 1; // C6: additional icicle at 100% base DMG
    const qHitMult = this.constellation >= 5 ? 2.703 : 2.2896;
    const qBladeMult = this.constellation >= 5 ? 0.901 : 0.7632;

    const normalTag = {
      element: "Cryo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    return {
      "wriothesley-normal": {
        label: {
          zh: "普攻全套",
          en: "Normal Combo",
        },
        parts: [
          { formula: new DirectFormula(n1, normalTag) },
          { formula: new DirectFormula(n2, normalTag) },
          { formula: new DirectFormula(n3, normalTag) },
          { formula: new DirectFormula(n4, normalTag), hits: 2 },
          { formula: new DirectFormula(n5, normalTag) },
        ],
      },
      "wriothesley-charge": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new DirectFormula(cMult, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
            hits: cHits,
          },
        ],
      },
      "wriothesley-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(qHitMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 5,
          },
          {
            formula: new DirectFormula(qBladeMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E 5[N3C] Q (every other rot) — ~3 normal combos + 5 CAs + Q (Cryo carry, KQM)
  protected override get defaultRotation() {
    return {
      "wriothesley-normal": 3,
      "wriothesley-charge": 5,
      "wriothesley-burst": 1,
    };
  }
}

@RegisterCharacter("lyney")
class Lyney extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];
    // P2: DMG to Pyro-affected enemies +60%, +20% per Pyro teammate (excl self), cap 100%
    const pyroCount = Math.max(this.teamMeta.countByElement("Pyro") - 1, 0);
    const p2Bonus = Math.min(0.6 + pyroCount * 0.2, 1.0);
    buffs.push(
      new StatBuff(cbs(this, "P2", []), { receiver: "self" }, [
        { key: "dmg%", value: p2Bonus },
      ])
    );
    // C2: Self CD +60% (3 stacks × 20%)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", []), { receiver: "selfOnField" }, [
          { key: "cd", value: 0.6 },
        ])
      );
    }
    // C4: Pyro charged hit → enemy Pyro RES -20%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["charge"]),
          { receiver: "team", filter: { elements: ["Pyro"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
    }
    return buffs;
  })();

  // Prop Arrow: Lv10 311.0%, Lv13 (C3+) 367.2% (C3 boosts Normal talent)
  protected readonly formulaMap = (() => {
    const propMult = this.constellation >= 3 ? 3.672 : 3.11;
    const strikeMult = this.constellation >= 3 ? 4.505 : 3.816;
    // P1: Perilous Performance → Pyrotechnic Strike gains flat baseDmg = 80% ATK
    const p1Buff = new ScalingBuff(
      cbs(this, "P1", ["charge"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [],
      "atk",
      "baseDmg",
      0.8
    );
    // E has no constellation level boost (C3=Normal, C5=Q), always use Lv10
    const eMult = 3.01 + 0.958 * 5;

    const c6StrikeMult = this.constellation >= 3 ? 3.604 : 3.0528;

    return {
      "lyney-prop": {
        label: { zh: "重击伤害", en: "CA Prop Arrow" },
        parts: [
          {
            formula: new DirectFormula(propMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "lyney-strike": {
        label: { zh: "重击礼花弹", en: "CA Strike" },
        parts: [
          {
            formula: new DirectFormula(strikeMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
            bespokeBuff: p1Buff,
          },
        ],
      },
      "lyney-skill-max": {
        label: { zh: "E(满层)", en: "E (Max Stacks)" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "lyney-c6-strike": {
              label: { zh: "6命 礼花重奏", en: "C6 Strike Reprised" },
              parts: [
                {
                  formula: new DirectFormula(c6StrikeMult, {
                    element: "Pyro",
                    ability: "charge",
                    reaction: "none",
                  }),
                  bespokeBuff: p1Buff,
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: 3[CA] Q E — 3 Prop Arrows + 3 Strikes + E max stacks + Q (Pyro carry, KQM)
  protected override get defaultRotation() {
    return {
      "lyney-prop": 3,
      "lyney-strike": 3,
      "lyney-skill-max": 1,
      "lyney-c6-strike": 3,
    };
  }
}
