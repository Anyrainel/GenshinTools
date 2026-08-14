import type { ReactionType } from "@/data/enums";
import { DirectFormula, StellarDirectFormula } from "../core/damageFormula";
import { CharacterBase } from "../core/implModel";
import { RegisterCharacter, resolveOption } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { TeamMeta } from "../core/teamMeta";
import type { ComboTemplate, FormulaPart, OptionDef } from "../types";
import { cbs } from "./helpers";

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
      // Arkhe: Ousia — Surging Blade proc (E param4). Ousia-aligned Cryo DMG dealt
      // periodically while the Cooking Mek is in Cold Storage mode. ~10s interval
      // vs ~20s Cold Storage duration → 2 procs per E cast.
      "escoffier-surging-blade": {
        label: { zh: "E流涌之刃×2", en: "E Surging Blade (×2)" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 4), skillTag),
            hits: 2,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E + Q (Cryo healer/support, off-field); formulas already bake in hit counts
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "escoffier-skill-parfait", count: 1 },
      { id: "escoffier-burst", count: 1 },
      { id: "escoffier-c6-parfait", count: 1 },
      { id: "escoffier-surging-blade", count: 1 },
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
              cbs(this, "C6", ["E", "Q"]),
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
      // Lv1 Lumidouce Case attack (E param2). Without a Pyro teammate the Case
      // never upgrades, so it stays at Lv1 and fires single Dendro shots over the
      // case duration. Approximated as 14 ticks (matches the Lv2 hit cadence).
      "emilie-skill-lv1": {
        label: { zh: "E一阶×14", en: "E Lv1 (×14)" },
        when: !hasPyro,
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 14,
            offField: true,
          },
        ],
      },
      // Arkhe: Pneuma — Spiritbreath Thorn proc (E param5). Periodic Pneuma-aligned
      // Dendro DMG dropping while the Lumidouce Case is active. Approximated as
      // once per E cast (S8b minimum coverage; KQM treats it as a minor proc).
      "emilie-spiritbreath": {
        label: { zh: "E灵息之刺", en: "E Spiritbreath Thorn" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 5), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
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
      // C6 also converts Charged Attacks (A param5) to Dendro and applies the
      // same +300% ATK baseDmg. Abiding Fragrance caps at 4 Scents and every
      // NA or CA consumes one, so this is an alternative to the 4-hit Normal
      // entry rather than extra rotation damage → combo count 0.
      "emilie-c6-charge": {
        label: { zh: "重击", en: "Charged" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(this.param("A", 5), {
              element: "Dendro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E + Q (off-field Dendro sub-DPS in Burning teams); formulas bake in hit counts
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "emilie-skill-cast", count: 1 },
      { id: "emilie-skill-burning", count: 1 },
      { id: "emilie-skill-lv1", count: 1 },
      { id: "emilie-spiritbreath", count: 1 },
      { id: "emilie-burst-9hit", count: 1 },
      { id: "emilie-c6-normal", count: 1 },
      { id: "emilie-c6-charge", count: 0 },
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
      // Arkhe: Ousia — Surging Blade proc (E param7). Ousia-aligned Hydro DMG
      // dropping periodically while Bolstering Bubblebalm is bouncing. Scales
      // with Max HP (template suffix). Modeled as once per E cast.
      "sigewinne-surging-blade": {
        label: { zh: "E流涌之刃", en: "E Surging Blade" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 7),
              { element: "Hydro", ability: "skill", reaction: "none" },
              "hp"
            ),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E + Q (Hydro healer/support); Q used to fill downtime
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "sigewinne-skill", count: 1 },
      { id: "sigewinne-burst", count: 1 },
      { id: "sigewinne-burst-c4", count: 1 },
      { id: "sigewinne-surging-blade", count: 1 },
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
    const normalSkillTag = {
      element: "Electro" as const,
      ability: "skill" as const,
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
            // Impale the Night (E param7): "上述方式造成的伤害视为普通攻击造成的
            // 伤害" — the lunge is Normal Attack DMG, not Skill DMG.
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
      // Arkhe: Ousia — Surging Blade proc on Swift Hunt hits (E param10).
      // Ousia-aligned Electro DMG; classified as Skill DMG. Approximated as
      // firing once per initial E cast (10s CD vs 7.5s Night Vigil duration).
      "clorinde-surging-blade": {
        label: { zh: "E流涌之刃", en: "E Surging Blade" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 10), normalSkillTag),
          },
        ],
      },
    };
  })();

  // Rotation: Q > E 6[N3E] — 6 N3E cycles per E window + Q (Electro carry, KQM)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "clorinde-normal", count: 6 },
      { id: "clorinde-burst", count: 1 },
      { id: "clorinde-surging-blade", count: 1 },
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
    return buffs;
  })();

  // Modifiers scoped to a single Ceremonial Crystalshot instance
  // (「使本次典仪式晶火…」). They must not leak into other Skill DMG such as the
  // Arkhe Surging Blade, so they are attached to the navia-crystalshot part
  // rather than to all abilities: ["skill"].
  private readonly crystalshotBuffs = (() => {
    const buffs: StatBuff[] = [
      // E intrinsic modifiers (peak model: 6 shrapnel consumed, all 11 shots hit)
      // "11枚玫瑰晶弹全命中时，造成原本200%的伤害" → baseDmg% +1.0 (baseDmg% zone, not talent zone)
      // "超过3枚弹片每枚额外提升15%" (×3) → dmg% +0.45 (dmg% zone, separate from baseDmg% zone)
      new StatBuff(
        cbs(this, "E", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [
          { key: "baseDmg%", value: 1.0 },
          { key: "dmg%", value: 0.45 },
        ]
      ),
    ];
    // C2: 3 shrapnel → this Crystalshot's CR +36%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "cr", value: 0.36 }]
        )
      );
    }
    // C6: 3 extra shrapnel → this Crystalshot's CD +135% (45% × 3)
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "cd", value: 1.35 }]
        )
      );
    }
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
            bespokeBuffs: this.crystalshotBuffs,
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
      // C2: each Ceremonial Crystalshot hit calls down one extra Cannon Fire
      // Support shot (Q param2), "至多降下一次" per Crystalshot cast, and
      // 「通过这种方式触发的支援炮击的伤害视为元素爆发伤害」. Independent of
      // whether the Burst is active, so it is a separate entry rather than a
      // higher hits count on navia-burst.
      "navia-c2-support": {
        label: { zh: "C2支援炮击", en: "C2 Cannon Fire Support" },
        minC: 2,
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), burstTag),
          },
        ],
      },
      // Arkhe: Ousia — Surging Blade proc on Gunbrella firing (E param5).
      // Ousia-aligned Geo DMG. Modeled as once per E cast — minor over-count
      // when two Es are pressed back-to-back since Surging Blade has its own
      // ICD (param6).
      "navia-surging-blade": {
        label: { zh: "E流涌之刃", en: "E Surging Blade" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 5), {
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
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "navia-burst", count: 1 },
      { id: "navia-crystalshot", count: 2 },
      { id: "navia-c2-support", count: 0, bonus: [{ minC: 2, delta: 2 }] },
      { id: "navia-surging-blade", count: 2 },
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
      // C6 also converts Charged Attacks (A param5) to Hydro and applies the
      // same +18% / +25% Max HP baseDmg. Center of Attention caps at 6
      // triggers shared with the Normal entry, so this is an alternative
      // rather than extra rotation damage → combo count 0.
      "furina-c6-charge": {
        label: {
          zh: "重击",
          en: "Charged",
        },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(this.param("A", 5), {
              element: "Hydro",
              ability: "charge",
              reaction: "none",
            }),
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
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "furina-skill-bubble", count: 1 },
      { id: "furina-salon-total", count: 1 },
      { id: "furina-burst", count: 1 },
      { id: "furina-c6-normal", count: 1 },
      { id: "furina-c6-charge", count: 0 },
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
      // Arkhe: Pneuma — Spiritbreath Thorn proc (E param2). Pneuma-aligned Hydro
      // DMG dropping after Raging Waterfall hits. Unlike the E skill DMG (HP-scaled),
      // the Thorn template has no "Max HP" suffix → ATK-scaled (default scaling).
      // Modeled as once per E cast.
      "neuvillette-spiritbreath": {
        label: { zh: "E灵息之刺", en: "E Spiritbreath Thorn" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), hydroSkillTag),
          },
        ],
      },
    };
  })();

  // Rotation: E C E C Q > teammates > 2[C] — 3 CAs per rotation (Hydro carry, KQM)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "neuvillette-judgment", count: 3 },
      { id: "neuvillette-skill", count: 3 },
      { id: "neuvillette-burst", count: 1 },
      { id: "neuvillette-c6-currents", count: 3 },
      { id: "neuvillette-spiritbreath", count: 3 },
    ];
  }
}

const wriothesleyOption = {
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

@RegisterCharacter("wriothesley", wriothesleyOption)
class Wriothesley extends CharacterBase {
  private readonly radianceOn =
    resolveOption(wriothesleyOption, this.option, this.teamMeta) === "on";

  // Peak: 5 Prosecution Edict stacks during Chilling Penalty (P2 max)
  private readonly c2RadianceEnhanced =
    this.radianceOn && this.constellation >= 2;
  private readonly scNa3Mult = this.c2RadianceEnhanced ? 0.9 : 0.6;
  private readonly scNa5Mult = this.c2RadianceEnhanced ? 1.2 : 0.8;
  private readonly lusterMult = this.c2RadianceEnhanced ? 1.5 : 1.0;

  readonly buffs = (() => {
    const buffs: StatBuff[] = [
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

    if (this.radianceOn) {
      // P4: Stellar-Conduct DMG +30%
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["passive"]),
          { receiver: "self", filter: { reactions: ["stellarConduct"] } },
          [{ key: "reactionDmg%", value: 0.3 }]
        )
      );
      // C1's Luster ↔ NA5 cross-buff is not here: each half targets one single
      // hit, so both live as bespokeBuffs on their formula part (see formulaMap).

      // C4: self ATK SPD +20%, nearby allies ATK SPD +10%
      if (this.constellation >= 4) {
        buffs.push(
          new StatBuff(
            cbs(this, "C4", ["passive"]),
            { receiver: "selfOnField" },
            [{ key: "atkSpd%", value: 0.2 }]
          ),
          new StatBuff(cbs(this, "C4", ["passive"]), { receiver: "other" }, [
            { key: "atkSpd%", value: 0.1 },
          ])
        );
      }
      // C6: 「被寒烈的惩裁强化的斥逐拳与天辉·凌跃拳」 +10% CR, +80% CD. The
      // Repelling Fist clause covers the whole enhanced NA chain, not just the
      // 3rd/5th strikes that P4 converts to Stellar-Conduct, so this is a plain
      // cr/cd buff scoped by ability — StellarDirect hits read cr/cd on top of
      // reactionCr/reactionCd, so the converted strikes are covered too.
      if (this.constellation >= 6) {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["normal", "charge"]),
            {
              receiver: "selfOnField",
              filter: { abilities: ["normal", "charge"] },
            },
            [
              { key: "cr", value: 0.1 },
              { key: "cd", value: 0.8 },
            ]
          )
        );
      }
    } else {
      // P1/C1: Gracious Rebuke → CA DMG Bonus (50% or 200%)
      // C0 requires HP < 60%; peak model assumes it, since Chilling Penalty
      // drains HP on every enhanced Repelling Fist hit (up to once per 0.1s)
      // and the modeled E 5[N3C] rotation reaches the threshold early.
      // C1 rewrites the condition to "HP < 60% OR during Chilling Penalty",
      // so the C1+ branch is unconditional within the E window.
      buffs.push(
        new StatBuff(
          cbs(
            this,
            "P1/C1",
            this.constellation >= 1 ? ["low-hp", "E"] : ["low-hp"]
          ),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "dmg%", value: this.constellation >= 1 ? 2.0 : 0.5 }]
        )
      );
      // C4: Heal overflow → on-field ATK SPD +20%, off-field → all party
      // members ATK SPD +10%. Modeled on "other" (not "team") because the two
      // boosts 「无法叠加」 and Wriothesley already takes the self +20% branch —
      // matching the Radiance branch of the same constellation.
      if (this.constellation >= 4) {
        buffs.push(
          new StatBuff(
            cbs(this, "C4", ["heal-overflow"]),
            { receiver: "selfOnField" },
            [{ key: "atkSpd%", value: 0.2 }]
          ),
          new StatBuff(
            cbs(this, "C4", ["heal-overflow"]),
            { receiver: "other" },
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
      // C2: 5 Prosecution Edict stacks → NA 125%, CA 130% of original DMG
      if (this.constellation >= 2) {
        buffs.push(
          new StatBuff(
            cbs(this, "C2", ["normal"]),
            { receiver: "selfOnField", filter: { abilities: ["normal"] } },
            [{ key: "baseDmg%", value: 0.25 }]
          ),
          new StatBuff(
            cbs(this, "C2", ["charge"]),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [{ key: "baseDmg%", value: 0.3 }]
          )
        );
      }
    }

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
    const normalTag = {
      element: "Cryo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const chargeTag = {
      element: "Cryo" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const scNormalTag = {
      element: "Cryo" as const,
      ability: "normal" as const,
      reaction: "stellarConduct" as const,
    };
    const scChargeTag = {
      element: "Cryo" as const,
      ability: "charge" as const,
      reaction: "stellarConduct" as const,
    };

    const cHits = this.constellation >= 6 ? 2 : 1;

    if (this.radianceOn) {
      // C1 Radiance cross-buff: a Luster hit boosts the next enhanced NA5 by
      // 50%, and an NA5 hit boosts Luster by 50%. Peak model assumes both legs
      // are live. Each leg names exactly one hit, so they are bespokeBuffs on
      // that hit's part — an ability-scoped buff would also catch the NA3
      // strike and the C6 icicles, which the text does not cover. Stellar
      // Direct has no dmg% zone, so 「造成的伤害提升」 lands in reactionDmg%,
      // the reaction formula's counterpart of the DMG-bonus zone (bespoke
      // receivers are inert; the filter still scopes the overlay).
      const c1CrossBuff = (trigger: string) =>
        new StatBuff(
          cbs(this, "C1", [trigger]),
          {
            receiver: "selfOnField",
            filter: { reactions: ["stellarConduct"] },
          },
          [{ key: "reactionDmg%", value: 0.5 }]
        );
      const na5Parts: FormulaPart[] = [
        {
          formula: new StellarDirectFormula(
            this.param("A", 6) * this.scNa5Mult,
            scNormalTag
          ),
          // Triggered by a preceding Luster: Vaulting Fist hit
          ...(this.constellation >= 1
            ? { bespokeBuffs: [c1CrossBuff("charge")] }
            : {}),
        },
      ];
      const lusterParts: FormulaPart[] = [
        {
          formula: new StellarDirectFormula(
            this.param("A", 7) * this.lusterMult,
            scChargeTag
          ),
          // Triggered by a preceding enhanced NA5 hit
          ...(this.constellation >= 1
            ? { bespokeBuffs: [c1CrossBuff("normal")] }
            : {}),
        },
      ];
      if (this.constellation >= 6) {
        na5Parts.push({
          formula: new StellarDirectFormula(
            this.param("A", 6) * 0.2,
            scNormalTag
          ),
        });
        lusterParts.push({
          formula: new StellarDirectFormula(
            this.param("A", 7) * 0.2,
            scChargeTag
          ),
        });
      }

      return {
        "wriothesley-normal": {
          label: {
            zh: "普攻（5段·星超导）",
            en: "Normal (5-hit SC)",
          },
          parts: [
            { formula: new DirectFormula(this.param("A", 1), normalTag) },
            { formula: new DirectFormula(this.param("A", 2), normalTag) },
            {
              formula: new StellarDirectFormula(
                this.param("A", 3) * this.scNa3Mult,
                scNormalTag
              ),
            },
            {
              formula: new DirectFormula(this.param("A", 4), normalTag),
              hits: 2,
            },
            ...na5Parts,
          ],
        },
        "wriothesley-charge": {
          label: { zh: "天辉·凌跃拳", en: "Luster: Vaulting Fist" },
          parts: lusterParts,
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
    }

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
            formula: new DirectFormula(this.param("A", 7), chargeTag),
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
  protected override get comboDescriptor(): ComboTemplate {
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
    // Crisp Focus accrues 1 stack per 2s on-field and is released on swap-out,
    // so only the opening ~6s of each on-field window (roughly the first of the
    // three aimed shots) is over-credited; it plateaus at max for the rest of
    // Lyney's ~15-20s window. Modeled at max; ramp-up not tracked.
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
        label: {
          zh: "E(满层)+引爆猫帽",
          en: "E (Max) + Hat Blast",
        },
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
          {
            // E detonates a Grin-Malkin Hat on field for damage equal to a
            // Pyrotechnic Strike (A param15), 「视为重击伤害」. The rotation's Q
            // summons a Hat immediately before E, and this detonation replaces
            // that Hat's own end-of-life Strike (so lyney-strike stays at 3).
            // No P1 baseDmg: P1 only enhances Hats summoned by a Prop Arrow
            // that consumed HP.
            formula: new DirectFormula(strikeMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
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
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "lyney-prop", count: 3 },
      { id: "lyney-strike", count: 3 },
      { id: "lyney-skill-max", count: 1 },
      { id: "lyney-burst", count: 1 },
      { id: "lyney-c6-strike", count: 3 },
    ];
  }
}
