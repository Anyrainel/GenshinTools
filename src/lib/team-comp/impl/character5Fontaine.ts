import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import {
  CharacterBase,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import type { OptionDef, TeamMeta } from "../damageModels";
import { cbs } from "../helpers";
import type { ComboDescriptor, ReactionType } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Fontaine Characters
// ═══════════════════════════════════════════════════════════════

// Skirk P3 / Tartaglia P3 talent level bonuses handled by CharacterBase._effectiveLevels

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
    // Max 5 triggers per Skill cast
    if (this.constellation >= 2) {
      buffs.push(
        new ScalingBuff(
          { ...cbs(this, "C2", ["E"]), maxStacks: 5 },
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

  // E param1: Skill DMG, E param2: Parfait DMG
  // Skirk P3 E+1 handled by CharacterBase._effectiveLevels
  protected readonly formulaMap = (() => {
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
            formula: new DirectFormula(this.param("E", 1), skillTag),
          },
          {
            formula: new DirectFormula(this.param("E", 2), skillTag),
            hits: 21,
            offField: true,
          },
        ],
      },
      "escoffier-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "escoffier-c6-parfait": {
        label: {
          zh: "E芭菲×6",
          en: "E Parfait (×6)",
        },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(5.0, skillTag),
            hits: 6,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E + Q (Cryo healer/support, off-field); formulas already bake in hit counts
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "escoffier-skill-parfait", count: 1 },
      { id: "escoffier-burst", count: 1 },
      { id: "escoffier-c6-parfait", count: 1 },
    ];
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
      // "通过这种方式产生4枚香韵" → 4 procs per activation.
      // Self buff → modeled via formula hit counts, not maxStacks.
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
    const hasPyro = this.teamMeta.countByElement("Pyro") > 0;

    const normalTag = {
      element: "Dendro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const normalParts = [
      { formula: new DirectFormula(this.param("A", 1), normalTag) },
      { formula: new DirectFormula(this.param("A", 2), normalTag) },
      { formula: new DirectFormula(this.param("A", 3), normalTag) },
      { formula: new DirectFormula(this.param("A", 4), normalTag) },
    ];

    return {
      "emilie-skill-cast": {
        label: { zh: "E释放伤害", en: "E Cast DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "emilie-skill-burning": {
        label: {
          zh: "E伤害×28+清露×5",
          en: "E Lv2 (×28) + Cleardew (×5)",
        },
        when: hasPyro,
        parts: [
          {
            formula: new DirectFormula(this.param("E", 3), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 28,
            offField: true,
          },
          {
            formula: new DirectFormula(6.0, {
              element: "Dendro",
              ability: "special",
              reaction: "none",
            }),
            hits: 5,
            offField: true,
          },
        ],
      },
      "emilie-burst-9hit": {
        label: { zh: "Q伤害×9", en: "Q (×9)" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 9,
            offField: true,
          },
        ],
      },
      "emilie-c6-normal": {
        label: { zh: "普攻（4段）", en: "Normal (4-hit)" },
        minC: 6,
        parts: normalParts,
      },
    };
  })();

  // Rotation: E + Q (off-field Dendro sub-DPS in Burning teams); formulas bake in hit counts
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "emilie-skill-cast", count: 1 },
      { id: "emilie-skill-burning", count: 1 },
      { id: "emilie-burst-9hit", count: 1 },
      { id: "emilie-c6-normal", count: 1 },
    ];
  }
}

@RegisterCharacter("sigewinne")
class Sigewinne extends CharacterBase {
  readonly buffs = (() => {
    const isC1 = this.constellation >= 1;
    const buffs: StatBuff[] = [
      // P1: HP > 30k → E baseDmg +80 (C1: 100) per 1000 HP. Max 2800 (C1: 3500)
      // Game text: off-field party members only, excluding Sigewinne.
      // "10层静养计数" → maxStacks: 10 (C1: +8 bounces = 18)
      new ScalingBuff(
        { ...cbs(this, "P1", ["E"]), maxStacks: isC1 ? 18 : 10 },
        { receiver: "otherOffField", filter: { abilities: ["skill"] } },
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

  // E: Bolstering Bubblebalm — 5 bounces (C1: 8 bounces), HP scaling
  // Q: Super Saturated Syringing Lv10: 21.2% HP, Lv13 (C5+): 25.0% HP
  protected readonly formulaMap = (() => {
    const qMult = this.param("Q", 1);
    const eBounces = this.constellation >= 1 ? 8 : 5;
    return {
      "sigewinne-skill": {
        label: {
          zh: `E伤害×${eBounces}`,
          en: `E (×${eBounces})`,
        },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 1),
              { element: "Hydro", ability: "skill", reaction: "none" },
              "hp"
            ),
            hits: eBounces,
          },
        ],
      },
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
      "sigewinne-burst-c4": {
        label: { zh: "Q伤害×14", en: "Q (×14)" },
        minC: 4,
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
    };
  })();

  // Rotation: E + Q (Hydro healer/support); Q used to fill downtime
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "sigewinne-skill", count: 1 },
      { id: "sigewinne-burst", count: 1 },
      { id: "sigewinne-burst-c4", count: 1 },
    ];
  }
}

@RegisterCharacter("clorinde")
class Clorinde extends CharacterBase {
  private readonly hasElectroReaction =
    this.teamMeta.hasReaction("overloaded") ||
    this.teamMeta.hasReaction("electroCharged") ||
    this.teamMeta.hasReaction("superconduct") ||
    this.teamMeta.hasReaction("aggravate") ||
    this.teamMeta.hasReaction("lunarCharged");

  readonly buffs = [
    // P1: After Electro-related reaction, +20% ATK (C2: 30%) × 3 stacks as baseDmg
    // on Normal ATK and Q Electro DMG; max increase 1800 (C2: 2700)
    // Requires team to be able to trigger an Electro-related reaction
    ...(this.hasElectroReaction
      ? [
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
        ]
      : []),
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
    const normalBaseTag = {
      element: "Electro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    return {
      "clorinde-normal": {
        label: { zh: "E普攻", en: "E Normal" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), normalBaseTag),
            hits: 3,
          },
          {
            formula: new DirectFormula(this.param("E", 7), normalBaseTag),
            hits: 3,
          },
          ...(this.constellation >= 1
            ? [{ formula: new DirectFormula(0.3, normalBaseTag), hits: 2 }]
            : []),
          ...(this.constellation >= 6
            ? [{ formula: new DirectFormula(2.0, normalBaseTag), hits: 1 }]
            : []),
        ],
      },
      "clorinde-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
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
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "clorinde-normal", count: 6 },
      { id: "clorinde-burst", count: 1 },
    ];
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
    const burstTag = {
      element: "Geo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "navia-crystalshot": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Geo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "navia-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), burstTag),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), burstTag),
            hits: 4,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: Q > teammates > 2[E combo] — 2 E charges per ~16.5s rotation (Geo carry, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "navia-burst", count: 1 },
      { id: "navia-crystalshot", count: 2 },
    ];
  }
}

const furinaOption = {
  label: { zh: "气氛值", en: "Fanfare" },
  choices: [
    {
      value: "400",
      label: { zh: "400层", en: "400" },
      when: (tm: TeamMeta) => (tm.constellations.furina ?? 0) >= 1,
    },
    {
      value: "350",
      label: { zh: "350层", en: "350" },
      when: (tm: TeamMeta) => (tm.constellations.furina ?? 0) >= 1,
    },
    { value: "300", label: { zh: "300层", en: "300" } },
    { value: "250", label: { zh: "250层", en: "250" } },
    { value: "200", label: { zh: "200层", en: "200" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("furina", furinaOption)
class Furina extends CharacterBase {
  private readonly o = resolveOption(furinaOption, this.option, this.teamMeta);
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
      // Max stacks: 300 (C1: 400). Default: max stacks for constellation.
      new StatBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "team" },
        (() => {
          const perStack = this.param("Q", 5);
          const cap = this.constellation >= 1 ? 400 : 300;
          const picked = Number(this.o);
          // Clamp: C0 can't exceed 300; nobody can exceed their cap
          const stacks = Math.min(picked, cap);
          return [{ key: "dmg%", value: perStack * stacks }];
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
      // "上述效果至多触发6次" → self buff, modeled via C6 formula hit count (6 hits).
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
  // Salon member multipliers — Skirk P3 E+1 handled by CharacterBase._effectiveLevels
  protected readonly formulaMap = (() => {
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
      "furina-skill-bubble": {
        label: { zh: "E泡沫伤害", en: "E Bubble DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), hydroTag, "hp"),
          },
        ],
      },
      "furina-salon-total": {
        label: {
          zh: "E ×(18+9+5)",
          en: "E ×(18+9+5)",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 4), hydroTag, "hp"),
            hits: 18,
            offField: true,
          },
          {
            formula: new DirectFormula(this.param("E", 3), hydroTag, "hp"),
            hits: 9,
            offField: true,
          },
          {
            formula: new DirectFormula(this.param("E", 5), hydroTag, "hp"),
            hits: 5,
            offField: true,
          },
        ],
      },
      "furina-burst": {
        label: { zh: "Q伤害", en: "Q DMG" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
          },
        ],
      },
      "furina-c6-normal": {
        label: {
          zh: "普攻（4段）",
          en: "Normal (4-hit)",
        },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(this.param("A", 1), c6HydroTag),
          },
          {
            formula: new DirectFormula(this.param("A", 2), c6HydroTag),
          },
          {
            formula: new DirectFormula(this.param("A", 3), c6HydroTag),
          },
          {
            formula: new DirectFormula(this.param("A", 4), c6HydroTag),
          },
        ],
      },
      "furina-c6-plunge": {
        label: {
          zh: "下落攻击",
          en: "Plunge",
        },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(this.param("A", 9), {
              element: "Hydro",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E + Q then swap off (off-field support); salon formula bakes in 32 hits
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "furina-skill-bubble", count: 1 },
      { id: "furina-salon-total", count: 1 },
      { id: "furina-burst", count: 1 },
      { id: "furina-c6-normal", count: 1 },
      { id: "furina-c6-plunge", count: 0 },
    ];
  }
}

@RegisterCharacter("neuvillette")
class Neuvillette extends CharacterBase {
  // P1 "Heir to the Ancient Sea's Authority": each independent reaction type
  // grants 1 stack of Past Draconic Glories (max 3). Base/lunar variants share
  // a slot (e.g. EC and Lunar-EC are the same reaction type).
  // C1: +1 stack on swap-in (always active in rotation).
  // 1 stack → 110% (+10%), 2 → 125% (+25%), 3 → 160% (+60%).
  private readonly p1Stacks = (() => {
    const P1_STACK_GROUPS: ReactionType[][] = [
      ["vaporize"],
      ["frozen"],
      ["electroCharged", "lunarCharged"],
      ["bloom", "lunarBloom"],
      ["swirl"],
      ["crystallize", "lunarCrystallize"],
    ];
    const reactionStacks = P1_STACK_GROUPS.filter((group) =>
      group.some((r) => this.teamMeta.hasReaction(r))
    ).length;
    const c1Bonus = this.constellation >= 1 ? 1 : 0;
    return Math.min(3, reactionStacks + c1Bonus);
  })();

  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    const stacks = this.p1Stacks;

    if (stacks > 0) {
      const P1_BASEDMG = [0, 0.1, 0.25, 0.6] as const;
      // All reaction triggers shown in buff label for UI display
      const p1Triggers: string[] = [
        "vaporize",
        "frozen",
        "electroCharged",
        "lunarCharged",
        "bloom",
        "lunarBloom",
        "swirl",
        "crystallize",
        "lunarCrystallize",
      ];
      buffs.push(
        new StatBuff(
          cbs(this, "P1", p1Triggers),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "baseDmg%", value: P1_BASEDMG[stacks] }]
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

    // C2: each stack of Past Draconic Glories → Charged CD +14%, max 42%
    if (stacks > 0 && this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", []),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "cd", value: stacks * 0.14 }]
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
    const chargeTag = {
      element: "Hydro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const hydroSkillTag = {
      element: "Hydro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const hydroBurstTag = {
      element: "Hydro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "neuvillette-judgment": {
        label: { zh: "重击×8", en: "CA (×8)" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 5), chargeTag, "hp"),
            hits: 8,
          },
        ],
      },
      "neuvillette-skill": {
        label: { zh: "E伤害", en: "E DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), hydroSkillTag, "hp"),
          },
        ],
      },
      "neuvillette-burst": {
        label: { zh: "Q伤害", en: "Q DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), hydroBurstTag, "hp"),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), hydroBurstTag, "hp"),
            hits: 2,
          },
        ],
      },
      "neuvillette-c6-currents": {
        label: {
          zh: "额外×6",
          en: "Extra (×6)",
        },
        minC: 6,
        parts: [
          {
            // 10% Max HP per current; 3 droplets from E extend duration to 6s
            // → 3 × 2-current firings = 6 currents total
            formula: new DirectFormula(0.1, chargeTag, "hp"),
            hits: 6,
          },
        ],
      },
    };
  })();

  // Rotation: E C E C Q > teammates > 2[C] — 3 CAs per rotation (Hydro carry, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "neuvillette-judgment", count: 3 },
      { id: "neuvillette-skill", count: 3 },
      { id: "neuvillette-burst", count: 1 },
      { id: "neuvillette-c6-currents", count: 3 },
    ];
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
      // E: Enhanced Repelling Fist deals {param1:F1P} of Normal ATK DMG (baseDmg% zone)
      // "造成原本X%的伤害" → baseDmg% = param1 - 1.0
      new StatBuff(
        cbs(this, "E", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["normal"] } },
        [{ key: "baseDmg%", value: this.param("E", 1) - 1.0 }]
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
    const cHits = this.constellation >= 6 ? 2 : 1; // C6: additional icicle at 100% base DMG

    const normalTag = {
      element: "Cryo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    return {
      "wriothesley-normal": {
        label: {
          zh: "普攻（5段）",
          en: "Normal (5-hit)",
        },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), normalTag) },
          { formula: new DirectFormula(this.param("A", 2), normalTag) },
          { formula: new DirectFormula(this.param("A", 3), normalTag) },
          {
            formula: new DirectFormula(this.param("A", 4), normalTag),
            hits: 2,
          },
          { formula: new DirectFormula(this.param("A", 6), normalTag) },
        ],
      },
      "wriothesley-charge": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 7), {
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
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 5,
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
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
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "wriothesley-normal", count: 3 },
      { id: "wriothesley-charge", count: 5 },
      { id: "wriothesley-burst", count: 1 },
    ];
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
    const strikeMult = this.param("A", 15);
    // P1: Perilous Performance → Pyrotechnic Strike gains flat baseDmg = 80% ATK
    const p1Buff = new ScalingBuff(
      cbs(this, "P1", ["charge"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [],
      "atk",
      "baseDmg",
      0.8
    );

    return {
      "lyney-prop": {
        label: { zh: "重击伤害", en: "CA Prop Arrow" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 11), {
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
            bespokeBuffs: [p1Buff],
          },
        ],
      },
      "lyney-skill-max": {
        label: { zh: "E(满层)", en: "E (Max Stacks)" },
        parts: [
          {
            // E has no constellation level boost (C3=Normal, C5=Q)
            formula: new DirectFormula(
              this.param("E", 1) + this.param("E", 2) * 5,
              {
                element: "Pyro",
                ability: "skill",
                reaction: "none",
              }
            ),
          },
        ],
      },
      "lyney-burst": {
        label: { zh: "Q伤害", en: "Q DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "lyney-c6-strike": {
        label: { zh: "礼花重奏", en: "Strike Reprised" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(strikeMult * 0.8, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
            bespokeBuffs: [p1Buff],
          },
        ],
      },
    };
  })();

  // Rotation: 3[CA] Q E — 3 Prop Arrows + 3 Strikes + E max stacks + Q (Pyro carry, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "lyney-prop", count: 3 },
      { id: "lyney-strike", count: 3 },
      { id: "lyney-skill-max", count: 1 },
      { id: "lyney-burst", count: 1 },
      { id: "lyney-c6-strike", count: 3 },
    ];
  }
}
