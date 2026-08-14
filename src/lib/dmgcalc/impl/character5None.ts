import type { Element } from "@/data/enums";
import { i18nBetaData } from "@/data/i18n-beta";
import { i18nGameData } from "@/data/i18n-game";

import { resolveComboDescriptor } from "../core/combo";
import { DirectFormula, StellarDirectFormula } from "../core/damageFormula";
import { CharacterBase } from "../core/implModel";
import { RegisterCharacter, resolveOption } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { TeamMeta } from "../core/teamMeta";
import type {
  BuffTarget,
  ComboTemplate,
  ComboTemplateEntry,
  FormulaEntry,
  OptionDef,
} from "../types";
import { cbs, TRAVELER_RESONANCE_ENTRIES, travelerP3Buff } from "./helpers";

// Eligible elements for P1 虚境裂隙: Frozen(Hydro), Superconduct(Electro),
// Cryo Swirl(Anemo), Cryo Crystallize(Geo), plus other Cryo teammates
const skirkRiftEligible = (tm: TeamMeta): number =>
  tm.countByElement("Hydro") +
  Math.max(0, tm.countByElement("Cryo") - 1) + // exclude Skirk
  tm.countByElement("Electro") +
  tm.countByElement("Anemo") +
  tm.countByElement("Geo");

const skirkOption = {
  label: { zh: "虚境裂隙", en: "Void Rifts" },
  choices: [
    {
      value: "3",
      label: { zh: "3枚", en: "3 Rifts" },
      when: (tm) => skirkRiftEligible(tm) >= 3,
    },
    {
      value: "2",
      label: { zh: "2枚", en: "2 Rifts" },
      when: (tm) => skirkRiftEligible(tm) >= 2,
    },
    {
      value: "1",
      label: { zh: "1枚", en: "1 Rift" },
      when: (tm) => skirkRiftEligible(tm) >= 1,
    },
    { value: "0", label: { zh: "0枚", en: "0 Rifts" } },
  ] as const,
} satisfies OptionDef;

const nicoleOption = {
  label: { zh: "E攻击加成", en: "E ATK Buff" },
  choices: [
    {
      value: "all-theosis",
      label: { zh: "全队圣祝之引", en: "All Theosis" },
    },
    {
      value: "hexerei-theosis",
      label: { zh: "仅魔导圣祝之引", en: "Hexerei Theosis" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("skirk", skirkOption)
class Skirk extends CharacterBase {
  private readonly riftCount = Number.parseInt(
    resolveOption(skirkOption, this.option),
    10
  );

  // P2 死河渡断: 1 per Hydro teammate + 1 per non-Skirk Cryo teammate (max 3)
  // Always active (20s duration covers rotation)
  private readonly deathCrossingStacks = Math.min(
    this.teamMeta.countByElement("Hydro") +
      Math.max(0, this.teamMeta.countByElement("Cryo") - 1),
    3
  );

  // P3: +1 E level handled by CharacterBase._effectiveLevels via TeamMeta.talentPassiveBonuses()

  readonly buffs = (() => {
    const stacks = this.deathCrossingStacks;
    const riftCount = this.riftCount;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // P2 死河渡断: Normal ATK baseDmg% (110%/120%/170% → +10%/+20%/+70%)
    if (stacks > 0) {
      const normalPct = [0, 0.1, 0.2, 0.7][stacks];
      const burstPct = [0, 0.05, 0.15, 0.6][stacks];
      buffs.push(
        new StatBuff(
          cbs(this, "P2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [{ key: "baseDmg%", value: normalPct }]
        ),
        new StatBuff(
          cbs(this, "P2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "baseDmg%", value: burstPct }]
        )
      );
    }

    // Q 凋尽 "All Shall Wither": per-NA-hit baseDmg% from Extinction rift absorption
    // Q params 4-7: 0/1/2/3 rift absorption DMG bonus
    const witherPct = [
      this.param("Q", 4),
      this.param("Q", 5),
      this.param("Q", 6),
      this.param("Q", 7),
    ][riftCount];
    // Game text: "该效果将在触发次数达到10次时解除" — Wither cancels after 10
    // NA-hit triggers per cast. This 10-stack cap spans 3 NA formulas
    // (skirk-e-normal/-2/-c6-normal-coord) so it must be a self buff with
    // maxStacks (bespokeBuffs cap per-part, which couldn't share a global cap).
    // Skirk is allowlisted in instantiation.test.ts for this reason.
    buffs.push(
      new StatBuff(
        { ...cbs(this, "Q", ["Q"]), maxStacks: 10 },
        { receiver: "selfOnField", filter: { abilities: ["normal"] } },
        [{ key: "baseDmg%", value: witherPct }]
      )
    );

    // Q 蛇之狡谋 bonus: ATK per point over 50 → baseDmg for burst hits
    // Subtlety: 45 base + C2(10) + 8 per rift; bonus capped at 12 (C2: 22)
    const subtletyTotal =
      45 + (this.constellation >= 2 ? 10 : 0) + 8 * riftCount;
    const subtletyCap = this.constellation >= 2 ? 22 : 12;
    const subtletyBonusPts = Math.min(
      Math.max(subtletyTotal - 50, 0),
      subtletyCap
    );
    if (subtletyBonusPts > 0) {
      const subtletyPerPt = this.param("Q", 3);
      buffs.push(
        new ScalingBuff(
          cbs(this, this.constellation >= 2 ? "Q/C2" : "Q", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "atk",
          "baseDmg",
          subtletyBonusPts * subtletyPerPt
        )
      );
    }

    // C2: After 极恶技·尽 (Extinction), ATK +70% for 12.5s (all abilities)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.7 },
        ])
      );
    }

    // C4: Death's Crossing also grants ATK +10%/20%/40%
    if (this.constellation >= 4 && stacks > 0) {
      const c4Pct = [0, 0.1, 0.2, 0.4][stacks];
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: c4Pct },
        ])
      );
    }

    return buffs;
  })();

  // E Normal Combo: 5-hit (Lv10/11/13/14)
  //   N1: 262.6/281.1/318.2/336.7, N2: 236.8/253.5/287.0/303.7
  //   N3: 149.7×2/160.3×2/181.4×2/191.9×2, N4: 159.2×2/170.4×2/192.9×2/204.2×2
  //   N5: 388.7/416.1/471.0/498.4
  // E CA: 88.1×3/94.3×3/106.7×3/112.9×3
  // Q Burst: 5×slash + final slash
  protected readonly formulaMap = (() => {
    const riftCount = this.riftCount;
    const n1 = this.param("E", 1);
    const n2 = this.param("E", 2);
    const cryoNormal = {
      element: "Cryo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const cryoBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "skirk-e-normal": {
        label: { zh: "EQ后 普攻x5", en: "E+Q NA Combo (x5)" },
        parts: [
          { formula: new DirectFormula(n1, cryoNormal) },
          { formula: new DirectFormula(n2, cryoNormal) },
          {
            formula: new DirectFormula(this.param("E", 3), cryoNormal),
            hits: 2,
          },
          {
            formula: new DirectFormula(this.param("E", 5), cryoNormal),
            hits: 2,
          },
          { formula: new DirectFormula(this.param("E", 7), cryoNormal) },
        ],
      },
      "skirk-e-normal-2": {
        label: { zh: "EQ后 普攻x2", en: "E+Q NAx2" },
        parts: [
          { formula: new DirectFormula(n1, cryoNormal) },
          { formula: new DirectFormula(n2, cryoNormal) },
        ],
      },
      "skirk-e-charge": {
        label: { zh: "EQ后 重击", en: "E+Q CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 8), {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
      "skirk-burst": {
        label: { zh: "满蛇谋 Q", en: "Full Subtlety Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), cryoBurst),
            hits: 5,
          },
          { formula: new DirectFormula(this.param("Q", 2), cryoBurst) },
        ],
      },
      // C1: Each 虚境裂隙 absorbed → 晶刃 (500% ATK, Cryo, CA DMG)
      "skirk-c1-blade": {
        label: {
          zh: `晶刃×${riftCount || 1}`,
          en: `Crystal Blade ×${riftCount || 1}`,
        },
        minC: 1,
        when: riftCount > 0,
        parts: [
          {
            formula: new DirectFormula(5.0, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
            hits: riftCount || 1,
          },
        ],
      },
      // C6 极恶技·斩: one Havoc: Sever stack per Void Rift absorbed (max 3), and
      // the two branches below draw from that same pool — a stack spent on the
      // Normal Attack branch is not available to the Burst branch. The rotation
      // absorbs `riftCount` rifts (the same budget C1's crystal blades use), so
      // each branch below models spending the WHOLE pool; only one of them can
      // be in the default combo.
      // Burst branch: Havoc: Ruin consumes all stacks, 750% ATK each.
      "skirk-c6-burst-coord": {
        label: {
          zh: `Q协同×${riftCount || 1}`,
          en: `Q Coord ×${riftCount || 1}`,
        },
        minC: 6,
        when: riftCount > 0,
        parts: [
          {
            formula: new DirectFormula(7.5, cryoBurst),
            hits: riftCount || 1,
          },
        ],
      },
      // Normal Attack branch: N3/N5 hits each consume 1 stack for 3 coordinated
      // attacks at 180% ATK. Worth less per stack than the Burst branch, so it is
      // left out of the default rotation (the rotation absorbs its rifts with the
      // Charged Attack right before Havoc: Ruin).
      "skirk-c6-normal-coord": {
        label: {
          zh: `普攻协同×${(riftCount || 1) * 3}`,
          en: `NA Coord ×${(riftCount || 1) * 3}`,
        },
        minC: 6,
        when: riftCount > 0,
        parts: [
          {
            formula: new DirectFormula(1.8, cryoNormal),
            hits: (riftCount || 1) * 3,
          },
        ],
      },
    };
  })();

  // Rotation: tE > sQ (Extinction) > 4×N5D > 1 CA (rift absorb) > Q (Ruin) (freeze carry)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "skirk-e-normal", count: 4 },
      { id: "skirk-e-normal-2", count: 4 },
      { id: "skirk-e-charge", count: 3 },
      { id: "skirk-burst", count: 1 },
      { id: "skirk-c1-blade", count: 1 },
      // The Havoc: Sever pool is spent entirely on the Burst branch; the Normal
      // Attack branch would consume the same stacks, so it is not in the combo.
      { id: "skirk-c6-burst-coord", count: 1 },
    ];
  }
}

@RegisterCharacter("aloy")
class Aloy extends CharacterBase {
  // No constellations available — collab-exclusive character
  readonly buffs = [
    // P1: Self ATK +16% when gaining Coil, other party members ATK +8% (10s)
    // "队伍中附近的其他角色" → receiver: "other"
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "self" }, [
      { key: "atk%", value: 0.16 },
    ]),
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "other" }, [
      { key: "atk%", value: 0.08 },
    ]),
    // P2: During Rushing Ice, Cryo DMG +3.5%/s for max 10s = +35%
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "selfOnField" }, [
      { key: "cryo%", value: 0.35 },
    ]),
  ];

  protected readonly formulaMap = {
    "aloy-burst": {
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
  };

  // Rotation: E > Q (sub-DPS, minimal field time)
  protected override get comboDescriptor(): ComboTemplate {
    return [{ id: "aloy-burst", count: 1 }];
  }
}

// Traveler (Anemo)
// P3 cross-resonance: Anemo resonance -> self +10% CRIT Rate
// C6: Enemies hit by Gust Surge have Anemo/absorbed element RES -20%
@RegisterCharacter("traveler_anemo")
class TravelerAnemo extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P3 cross-resonance: all elements Traveler has resonated with
      travelerP3Buff(this),
      // C2: Energy Recharge +16%
      ...(this.constellation >= 2
        ? [
            new StatBuff(cbs(this, "C2", ["passive"]), { receiver: "self" }, [
              { key: "er", value: 0.16 },
            ]),
          ]
        : []),
      // C6: Enemies hit by Gust Surge have Anemo RES -20%
      ...(this.constellation >= 6
        ? [
            new StatBuff(
              cbs(this, "C6", ["Q"]),
              { receiver: "team", filter: { elements: ["Anemo"] } },
              [{ key: "resReduction%", value: 0.2 }]
            ),
          ]
        : []),
    ];
    // C6: Absorbed element also gets -20% RES (S10 pattern)
    if (this.constellation >= 6) {
      const absorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
      const teamEls = new Set(Object.values(this.teamMeta.elements));
      for (const el of absorbElements) {
        if (!teamEls.has(el)) continue;
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: [el] } },
            [{ key: "resReduction%", value: 0.2 }]
          )
        );
      }
    }
    return buffs;
  })();

  // E Palm Vortex: Press = cutting ticks + storm explosion; Hold = stronger versions
  // param1: Initial Cutting DMG, param2: Max Cutting DMG
  // param3: Initial Storm DMG, param4: Max Storm DMG
  // Q Gust Surge: 8 ticks Anemo + 8 ticks absorbed element
  // param1: Tornado DMG, param2: Additional Elemental DMG
  protected readonly formulaMap = (() => {
    const qTick = this.param("Q", 1);
    const absorbTick = this.param("Q", 2);
    const anemoSkill = {
      element: "Anemo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const anemoBurst = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    const absorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
    const teamEls = new Set(Object.values(this.teamMeta.elements));
    // P3 grants 1 Blade of the Dawn Breeze stack per Elemental Type among nearby
    // party members (Pyro/Hydro/Cryo/Electro, 1 stack each), so only elements
    // actually present in the team can be consumed into a Blade Wind.
    const bladeElements = absorbElements.filter((el) => teamEls.has(el));

    const formulas: Record<string, FormulaEntry> = {
      "traveler-anemo-skill-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), anemoSkill) },
          { formula: new DirectFormula(this.param("E", 3), anemoSkill) },
        ],
      },
      "traveler-anemo-skill-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), anemoSkill) },
          { formula: new DirectFormula(this.param("E", 4), anemoSkill) },
        ],
      },
      "traveler-anemo-burst": {
        label: { zh: "Q伤害×8", en: "Q (×8)" },
        parts: [
          {
            formula: new DirectFormula(qTick, anemoBurst),
            hits: 8,
            offField: true,
          },
        ],
      },
      // P3 special CA: Whirlwind (风旋) — requires at least 2 Blade of the Dawn
      // Breeze stacks, then consumes them all. Two Anemo CA hits each +60% ATK,
      // plus one 50% ATK Blade Wind per consumed stack (counted as CA DMG).
      "traveler-anemo-blade-ca": {
        label: {
          zh: `晨风之刃${bladeElements.length}层重击`,
          en: `Dawn Breeze Blade CA (${bladeElements.length})`,
        },
        when: bladeElements.length >= 2,
        parts: [
          {
            formula: new DirectFormula(this.param("A", 6) + 0.6, {
              element: "Anemo",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("A", 7) + 0.6, {
              element: "Anemo",
              ability: "charge",
              reaction: "none",
            }),
          },
          ...bladeElements.map((el) => ({
            formula: new DirectFormula(0.5, {
              element: el,
              ability: "charge" as const,
              reaction: "none" as const,
            }),
          })),
        ],
      },
    };
    // Add absorbed-element variant formulas (S10 pattern)
    for (const el of absorbElements) {
      if (!teamEls.has(el)) continue;
      formulas[`traveler-anemo-burst-${el.toLowerCase()}`] = {
        label: {
          zh: `Q伤害×8+吸收(${el})`,
          en: `Q (×8) + Absorbed (${el})`,
        },
        parts: [
          {
            formula: new DirectFormula(qTick, anemoBurst),
            hits: 8,
            offField: true,
          },
          {
            formula: new DirectFormula(absorbTick, {
              element: el,
              ability: "burst",
              reaction: "none",
            }),
            hits: 8,
            offField: true,
          },
        ],
      };
    }
    return formulas;
  })();

  // Rotation: E (hold) > Q (Anemo support, quickswap)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "traveler-anemo-skill-hold", count: 1 },
      { id: "traveler-anemo-burst", count: 1 },
    ];
  }
}

// Traveler (Geo)
// P3 cross-resonance: Geo resonance -> self +20% DEF
// C1: Party within Wake of Earth gets +10% CRIT Rate
@RegisterCharacter("traveler_geo")
class TravelerGeo extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff>[] = [
    // P3 cross-resonance: all elements Traveler has resonated with
    travelerP3Buff(this),
    // C1: Inside Wake of Earth, party CRIT Rate +10% (on-field only, requires proximity)
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["Q"]), { receiver: "teamOnField" }, [
            { key: "cr", value: 0.1 },
          ]),
        ]
      : []),
  ];

  // E Starfell Sword: 446% Geo DMG (Lv10), 527% (Lv13 C5+)
  // Q Wake of Earth: 266% per shockwave x 4 (Lv10), 314% x 4 (Lv13 C3+)
  protected readonly formulaMap = {
    "traveler-geo-skill": {
      label: { zh: "E伤害", en: "E" },
      parts: [
        {
          formula: new DirectFormula(this.param("E", 1), {
            element: "Geo",
            ability: "skill",
            reaction: "none",
          }),
          // C2: Meteorite explosion deals additional Geo DMG equal to Starfell Sword DMG
          hits: this.constellation >= 2 ? 2 : 1,
        },
      ],
    },
    "traveler-geo-burst": {
      label: {
        zh: "Q伤害×4",
        en: "Q (×4)",
      },
      parts: [
        {
          formula: new DirectFormula(this.param("Q", 1), {
            element: "Geo",
            ability: "burst",
            reaction: "none",
          }),
          hits: 4,
        },
      ],
    },
    // P3 special CA: Rockfell (岩坠) — consumes 3 Blade of Archaic Petra stacks.
    // Two Geo CA hits each +120% ATK. Shield strength boost is utility, skipped.
    "traveler-geo-blade-ca": {
      label: { zh: "古岩之刃3层重击", en: "Archaic Petra Blade CA" },
      parts: [
        {
          formula: new DirectFormula(this.param("A", 6) + 1.2, {
            element: "Geo",
            ability: "charge",
            reaction: "none",
          }),
        },
        {
          formula: new DirectFormula(this.param("A", 7) + 1.2, {
            element: "Geo",
            ability: "charge",
            reaction: "none",
          }),
        },
      ],
    },
  };

  // Rotation: 3×E > Q (Geo sub-DPS, 6s CD with P1)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "traveler-geo-skill", count: 3 },
      { id: "traveler-geo-burst", count: 1 },
    ];
  }
}

// Traveler (Electro)
// E: Abundance Amulets grant ER +20% to absorbing party members
// P2: Increases amulet ER bonus by 10% of Traveler's ER
// P3 cross-resonance: Electro resonance -> self +20% ER
// C2: Falling Thunder hits -> enemies Electro RES -15%
@RegisterCharacter("traveler_electro")
class TravelerElectro extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
    // E: Abundance Amulets grant ER bonus to absorbing characters (E param4)
    // Amulets are pickup objects — only the on-field character can absorb them
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "teamOnField" }, [
      { key: "er", value: this.param("E", 4) },
    ]),
    // P2: Increases amulet ER bonus by 10% of Traveler's ER
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "teamOnField" },
      [],
      "er",
      "er",
      0.1
    ),
    // P3 cross-resonance: all elements Traveler has resonated with
    travelerP3Buff(this),
    // C2: Falling Thunder hits -> Electro RES -15% for 8s
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["Q"]),
            { receiver: "team", filter: { elements: ["Electro"] } },
            [{ key: "resReduction%", value: 0.15 }]
          ),
        ]
      : []),
  ];

  // E Lightning Blade: 142% per hit x 3 (Lv10), 167% x 3 (Lv13 C5+)
  // Q Bellowing Thunder: 205.9% initial + 59% per Falling Thunder x 12 (Lv10)
  // Q (C3+, Lv13): 243.1% initial + 69.7% x 12
  protected readonly formulaMap = (() => {
    const electroBurst = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "traveler-electro-skill": {
        label: { zh: "E伤害×3", en: "E (×3)" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
      "traveler-electro-burst": {
        label: {
          zh: "Q伤害×12",
          en: "Q (×12)",
        },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), electroBurst) },
          {
            formula: new DirectFormula(this.param("Q", 2), electroBurst),
            hits: 12,
            offField: true,
          },
        ],
      },
      // P3 special CA: Detonate (雷岚) — consumes 3 Blade of Resounding Thunder
      // stacks. Two Electro CA hits each +100% ATK, plus a delayed 200% ATK
      // lightning strike counted as CA DMG. Abundance Amulet is utility only.
      "traveler-electro-blade-ca": {
        label: { zh: "万雷之刃3层重击", en: "Thunder Blade CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 6) + 1.0, {
              element: "Electro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("A", 7) + 1.0, {
              element: "Electro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(2.0, {
              element: "Electro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (Electro battery/support, 13.5s CD)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "traveler-electro-skill", count: 1 },
      { id: "traveler-electro-burst", count: 1 },
    ];
  }
}

// Traveler (Dendro)
// P1: Lea Lotus Lamp grants on-field character EM +6/s, max 10 stacks = +60 EM
// P2: Every point of Traveler's EM -> E DMG +0.15%, Q DMG +0.1%
// P3 cross-resonance: Dendro resonance -> self +60 EM
// C6: Lotuslight Transfiguration → +12% DMG for corresponding element
const travelerDendroOption = {
  label: { zh: "莲光遍照", en: "Lotuslight" },
  choices: [
    { value: "60", label: { zh: "满层+60", en: "Max +60 EM" } },
    { value: "30", label: { zh: "均值+30", en: "Avg +30 EM" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("traveler_dendro", travelerDendroOption)
class TravelerDendro extends CharacterBase {
  private readonly lotusEM = Number.parseInt(
    resolveOption(travelerDendroOption, this.option),
    10
  );
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: Lea Lotus Lamp - Overflowing Lotuslight (max 10 stacks) -> on-field char EM
      // Ramps +6 EM/s over 10s; option selects max (60) or average (30)
      new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "teamOnField" }, [
        { key: "em", value: this.lotusEM },
      ]),
      // P2: Verdant Luxury — Traveler's own EM boosts E DMG by 0.15% per EM point
      new ScalingBuff(
        cbs(this, "P2", ["A4"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [],
        "em",
        "dmg%",
        0.0015
      ),
      // P2: Verdant Luxury — Traveler's own EM boosts Q DMG by 0.1% per EM point
      new ScalingBuff(
        cbs(this, "P2", ["A4"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "em",
        "dmg%",
        0.001
      ),
      // P3 cross-resonance: all elements Traveler has resonated with
      travelerP3Buff(this),
      // C6: Lotuslight Transfiguration → +12% DMG for corresponding element
      // Base Dendro (when no transfiguration occurs)
      ...(this.constellation >= 6
        ? [
            new StatBuff(
              cbs(this, "C6", ["Q"]),
              { receiver: "teamOnField", filter: { elements: ["Dendro"] } },
              [{ key: "dmg%", value: 0.12 }]
            ),
          ]
        : []),
    ];
    // C6: Transfigured element also gets +12% DMG (S10 pattern: Hydro/Electro/Pyro)
    if (this.constellation >= 6) {
      const transfigElements = ["Hydro", "Electro", "Pyro"] as const;
      const teamEls = new Set(Object.values(this.teamMeta.elements));
      for (const el of transfigElements) {
        if (!teamEls.has(el)) continue;
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "teamOnField", filter: { elements: [el] } },
            [{ key: "dmg%", value: 0.12 }]
          )
        );
      }
    }
    return buffs;
  })();

  // E Razorgrass Blade: 415% Dendro (Lv10), 490% (Lv13 C3+)
  // Q Lea Lotus Lamp: 144.3% per tick x 12 (Lv10), 170.3% x 12 (Lv13 C5+)
  protected readonly formulaMap = (() => {
    return {
      "traveler-dendro-skill": {
        label: { zh: "E伤害", en: "E" },
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
      "traveler-dendro-burst": {
        label: {
          zh: "Q伤害×12",
          en: "Q (×12)",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 12,
            offField: true,
          },
        ],
      },
      "traveler-dendro-burst-explosion": {
        label: {
          zh: "Q火幻变爆发",
          en: "Q Pyro Explosion",
        },
        when: this.teamMeta.countByElement("Pyro") > 0,
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      // P3 special CA: Verdessence (草惠) — consumes 3 Blade of Verdant Viridis
      // stacks. Two Dendro CA hits each +80% ATK, plus 2 Vinecores that explode
      // at 120% ATK each, counted as CA DMG.
      "traveler-dendro-blade-ca": {
        label: { zh: "兰草之刃3层重击", en: "Verdant Blade CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 6) + 0.8, {
              element: "Dendro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("A", 7) + 0.8, {
              element: "Dendro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(1.2, {
              element: "Dendro",
              ability: "charge",
              reaction: "none",
            }),
            hits: 2,
          },
        ],
      },
    };
  })();

  // Rotation: 2×E > Q (Dendro support, 8s CD)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "traveler-dendro-skill", count: 2 },
      { id: "traveler-dendro-burst", count: 1 },
    ];
  }
}

// Traveler (Hydro)
// P3 cross-resonance: Hydro resonance -> self +20% HP
// Primarily a self-sustain / utility character - no notable team buff passives
@RegisterCharacter("traveler_hydro")
class TravelerHydro extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff>[] = [
    // P3 cross-resonance: all elements Traveler has resonated with
    travelerP3Buff(this),
  ];

  // E Aquacrest Saber (Torrent Surge): 340.7% Hydro (Lv10), 402.2% (Lv13 C3+)
  // Q Rising Waters: 183.4% per tick x 4 (Lv10), 216.5% x 4 (Lv13 C5+)
  protected readonly formulaMap = (() => {
    return {
      "traveler-hydro-skill": {
        label: {
          zh: "E伤害",
          en: "E",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      // E Spiritbreath Thorn (Pneuma-aligned Hydro DMG, fires after Torrent Surge)
      "traveler-hydro-thorn": {
        label: { zh: "E灵息之刺", en: "E Spiritbreath Thorn" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 3), {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "traveler-hydro-burst": {
        label: { zh: "Q伤害×4", en: "Q (×4)" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 4,
            offField: true,
          },
        ],
      },
      // P3 special CA: Tidebound (水狱) — consumes 3 Blade of Many Waters stacks.
      // Two Hydro CA hits each +150% ATK. At HP ≥ 50% (assumed), consumes 10%
      // max HP for an additional +100% ATK per hit (DMG branch). HP < 50% branch
      // is pure healing, skipped.
      "traveler-hydro-blade-ca": {
        label: { zh: "众水之刃3层重击", en: "Many Waters Blade CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 6) + 1.5 + 1.0, {
              element: "Hydro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("A", 7) + 1.5 + 1.0, {
              element: "Hydro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: 2×E > Q (Hydro sub-DPS, 10s CD)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "traveler-hydro-skill", count: 2 },
      { id: "traveler-hydro-thorn", count: 2 },
      { id: "traveler-hydro-burst", count: 1 },
    ];
  }
}

// Traveler (Pyro)
// C1: While Blazing/Scorching Threshold active, on-field character deals +6% DMG
// P3 cross-resonance: Pyro resonance -> self +20% ATK
// C4: After Q Plains Scorcher, self +20% Pyro DMG% for 9s
// C6: During Nightsoul's Blessing, NA/CA/Plunge → Pyro + CD +40%
@RegisterCharacter("traveler_pyro")
class TravelerPyro extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff>[] = [
    // P3 cross-resonance: all elements Traveler has resonated with
    travelerP3Buff(this),
    // C1: While Threshold active, on-field character deals +6% DMG
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["E"]), { receiver: "teamOnField" }, [
            { key: "dmg%", value: 0.06 },
          ]),
        ]
      : []),
    // C1: If on-field character is in Nightsoul's Blessing, +9% more DMG
    // Single teamOnField buff with Nightsoul faction filter covers all Nightsoul characters including Traveler Pyro
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", ["E"]),
            { receiver: "teamOnField", factions: ["Nightsoul"] },
            [{ key: "dmg%", value: 0.09 }]
          ),
        ]
      : []),
    // C4: After Q, self +20% Pyro DMG Bonus (火元素伤害加成)
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "selfOnField" }, [
            { key: "pyro%", value: 0.2 },
          ]),
        ]
      : []),
    // C6: During Nightsoul's Blessing, NA/CA/Plunge CRIT DMG +40%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E"]),
            {
              receiver: "selfOnField",
              filter: { abilities: ["normal", "charge", "plunge"] },
            },
            [{ key: "cd", value: 0.4 }]
          ),
        ]
      : []),
  ];

  // E Flowfire Blade (Blazing Threshold): 50.5% per tick x 12 (Lv10), 59.7% x 12 (Lv13 C3+)
  // Q Plains Scorcher: 769% Nightsoul-Pyro (Lv10), 907.8% (Lv13 C5+)
  protected readonly formulaMap = (() => {
    return {
      "traveler-pyro-skill": {
        label: {
          zh: "E伤害×12",
          en: "E (×12)",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 12,
            offField: true,
          },
        ],
      },
      "traveler-pyro-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      // Plunge (High): param11. Element is Physical normally, but C6 converts
      // NA/CA/Plunge to Pyro during Nightsoul's Blessing.
      "traveler-pyro-plunge": {
        label: {
          zh: "下落攻击(高空)",
          en: "Plunge (High)",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 11), {
              element: this.constellation >= 6 ? "Pyro" : "Physical",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      // P3 special CA: Inferno (火噬) — consumes 2 Blade of the Sacred Flame
      // stacks. Two Nightsoul-aligned Pyro CA hits each +200% ATK. Nightsoul
      // property is handled by the existing C6 CD buff filter when applicable.
      "traveler-pyro-blade-ca": {
        label: { zh: "圣火之刃2层重击", en: "Sacred Flame Blade CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 6) + 2.0, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("A", 7) + 2.0, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: hE > Q > swap (off-field Pyro support)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "traveler-pyro-skill", count: 1 },
      { id: "traveler-pyro-burst", count: 1 },
    ];
  }
}

// Traveler (Cryo)
// P4 cross-resonance: Cryo resonance -> self +20% CRIT DMG (all 7 elements)
// P3 makes the Traveler a Stellar-Conduct / Stellar Swirl enabler (see TeamMeta)
// and enters Radiance: Stellar-Conduct (Polestar Field) or Radiance: Stellar Swirl.
const travelerCryoOption = {
  label: { zh: "辉映状态", en: "Radiance State" },
  choices: [
    {
      value: "stellarConduct",
      label: {
        zh: "辉映·星超导 (极星辉域)",
        en: "Radiance: Stellar-Conduct (Polestar Field)",
      },
      when: (tm) => tm.hasReaction("stellarConduct"),
    },
    {
      value: "stellarSwirl",
      label: { zh: "辉映·星扩散", en: "Radiance: Stellar Swirl" },
      when: (tm) => tm.hasReaction("stellarSwirl"),
    },
    { value: "off", label: { zh: "关闭", en: "Off" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("traveler_cryo", travelerCryoOption)
class TravelerCryo extends CharacterBase {
  private readonly rState = resolveOption(
    travelerCryoOption,
    this.option,
    this.teamMeta
  );

  // P1 only converts/boosts NA/CA/Plunge inside Radiance: Stellar-Conduct.
  private readonly scRadiance = this.rState === "stellarConduct";

  // P4 grants 凝冰之刃 (the stacks that turn a Charged Attack into 重击·冰凝)
  // only when a nearby party member deals Stellar-Conduct or Stellar Swirl DMG.
  // P3 converts the party's Superconduct/Cryo Swirl into those stellar variants,
  // so any Electro or Anemo teammate satisfies this — deliberately wider than
  // the Radiance option (Polestar Field, or 8s after a Stellar Swirl), which
  // gates the Traveler's own state rather than the party's reactions.
  private readonly hasStellarGlimmer =
    this.teamMeta.hasReaction("stellarConduct") ||
    this.teamMeta.hasReaction("stellarSwirl");

  // Ice crystal count per rotation — see the note on comboDescriptor for the
  // two firing models. Declared here so the Frostglow derivation below and the
  // rotation entry read the same source.
  private readonly crystalCombo: ComboTemplateEntry = this.scRadiance
    ? { id: "traveler-cryo-crystal", count: 15 }
    : {
        id: "traveler-cryo-crystal",
        count: 6,
        bonus: [{ minC: 4, delta: 1 }],
      };

  // Frostglow (max 8) accrues 1 per ice crystal hit, plus 2 from 重击·冰凝 when
  // the team can produce it. Derived rather than assumed, so the Burst's stack
  // count — and with it the param4 "at max stacks" strike bonus — follows the
  // crystal count instead of a separate hardcode.
  private readonly frostglowStacks = Math.min(
    8,
    resolveComboDescriptor([this.crystalCombo], this.constellation)[
      this.crystalCombo.id
    ] + (this.hasStellarGlimmer ? 2 : 0)
  );

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P4 cross-resonance: all elements the Traveler has resonated with.
      // Unlike the other variants this sits on P4 (异邦的层冰), not P3.
      new StatBuff(
        cbs(this, "P4", ["passive"]),
        { receiver: "self" },
        TRAVELER_RESONANCE_ENTRIES
      ),
      // P2 通明的冽冰: EM +8% of ATK, capped at +160 EM
      new ScalingBuff(
        cbs(this, "P2", ["passive"]),
        { receiver: "self" },
        [],
        "atk",
        "em",
        0.08,
        160
      ),
      // P3 星耀祝礼: +0.35% Stellar-Conduct/Stellar Swirl base DMG per 100 ATK,
      // cap +7%. Applies to the whole party's stellar reactions.
      new ScalingBuff(
        cbs(this, "P3", ["passive"]),
        {
          receiver: "team",
          filter: { reactions: ["stellarConduct", "stellarSwirl"] },
        },
        [],
        "atk",
        "reactionBaseDmg%",
        0.000035,
        0.07
      ),
    ];

    // P1 自锐的凛冰: inside Radiance: Stellar-Conduct, NA/CA/Plunge DMG is
    // increased by 80% of ATK. The Charged Attack half is attached per formula
    // (bespoke) because P4 excludes Charged Attack: Freezing Ice from it.
    if (this.scRadiance) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "P1", ["E"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "plunge"] },
          },
          [],
          "atk",
          "baseDmg",
          0.8
        )
      );
    }

    // C2 嗡鸣的陨冰: ice crystal hits grant the active character +60 EM, raised
    // to +120 while that character can trigger/deal Stellar Glimmer DMG.
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "teamOnField" }, [
          { key: "em", value: this.hasStellarGlimmer ? 120 : 60 },
        ])
      );
    }

    // C6 肃杀的熙冰: each Frostglow stack consumed by Q gives other party
    // members +5% Stellar Glimmer reaction DMG, capped at +40%.
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          {
            receiver: "other",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [
            {
              key: "reactionDmg%",
              value: Math.min(this.frostglowStacks * 0.05, 0.4),
            },
          ]
        )
      );
    }

    return buffs;
  })();

  // A: 5-hit NA chain, 2-strike CA (param6+param7), plunge param9/10/11
  // E 冰雾剑: param1 skill hit, param2 Frostpierce Star ice crystal
  // Q 聚冰成锋: param1 per strike + param2 per Frostglow stack, param3 strikes
  //   (+param4 at 8 stacks); param8/9 are the Stellar-Conduct values and
  //   param10/11 the Stellar Swirl values.
  protected readonly formulaMap = (() => {
    // Sword user: NA/CA/Plunge are Physical unless P1's uncoverable Cryo
    // infusion is active (Radiance: Stellar-Conduct only).
    const naElement = this.scRadiance
      ? ("Cryo" as const)
      : ("Physical" as const);
    const infusedNormal = {
      element: naElement,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const infusedCharge = {
      element: naElement,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const infusedPlunge = {
      element: naElement,
      ability: "plunge" as const,
      reaction: "none" as const,
    };
    const cryoSkill = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };

    const radianceSuffix =
      this.rState === "stellarSwirl"
        ? { zh: "·星扩散", en: " (SSw)" }
        : this.scRadiance
          ? { zh: "·星超导", en: " (SC)" }
          : { zh: "", en: "" };

    // P1's +80% ATK for the ordinary Charged Attack only (P4 excludes 冰凝).
    const p1ChargeBuff = this.scRadiance
      ? [
          new ScalingBuff(
            cbs(this, "P1", ["E"]),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [],
            "atk",
            "baseDmg",
            0.8
          ),
        ]
      : undefined;

    // P4 重击·冰凝: always Cryo, +140% ATK, and reclassified as Stellar Glimmer
    // reaction DMG while a Radiance state is active.
    const freezingIceBonus = [
      new ScalingBuff(
        cbs(this, "P4", ["charge"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [],
        "atk",
        "baseDmg",
        1.4
      ),
    ];
    const freezingIceFormula = (mult: number) =>
      this.rState === "stellarSwirl"
        ? new StellarDirectFormula(mult, {
            element: "Cryo",
            ability: "charge",
            reaction: "stellarSwirl",
          })
        : this.scRadiance
          ? new StellarDirectFormula(mult, {
              element: "Cryo",
              ability: "charge",
              reaction: "stellarConduct",
            })
          : new DirectFormula(mult, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            });

    // Q strikes: param3 base, plus param4 only when the full 8 Frostglow stacks
    // are consumed ("满层寒辉额外攻击段数").
    const burstStrikes =
      this.param("Q", 3) + (this.frostglowStacks >= 8 ? this.param("Q", 4) : 0);
    const burstMult =
      this.rState === "stellarSwirl"
        ? this.param("Q", 10) + this.frostglowStacks * this.param("Q", 11)
        : this.scRadiance
          ? this.param("Q", 8) + this.frostglowStacks * this.param("Q", 9)
          : this.param("Q", 1) + this.frostglowStacks * this.param("Q", 2);
    const burstFormula =
      this.rState === "stellarSwirl"
        ? new StellarDirectFormula(burstMult, {
            element: "Cryo",
            ability: "burst",
            reaction: "stellarSwirl",
          })
        : this.scRadiance
          ? new StellarDirectFormula(burstMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "stellarConduct",
            })
          : new DirectFormula(burstMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            });

    return {
      "traveler-cryo-normal": {
        label: { zh: "普攻×5", en: "NA (×5)" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), infusedNormal) },
          { formula: new DirectFormula(this.param("A", 2), infusedNormal) },
          { formula: new DirectFormula(this.param("A", 3), infusedNormal) },
          { formula: new DirectFormula(this.param("A", 4), infusedNormal) },
          { formula: new DirectFormula(this.param("A", 5), infusedNormal) },
        ],
      },
      "traveler-cryo-charge": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 6), infusedCharge),
            ...(p1ChargeBuff ? { bespokeBuffs: p1ChargeBuff } : {}),
          },
          {
            formula: new DirectFormula(this.param("A", 7), infusedCharge),
            ...(p1ChargeBuff ? { bespokeBuffs: p1ChargeBuff } : {}),
          },
        ],
      },
      "traveler-cryo-charge-freezing": {
        label: {
          zh: `重击·冰凝${radianceSuffix.zh}`,
          en: `Freezing Ice CA${radianceSuffix.en}`,
        },
        // P4: needs 3 凝冰之刃, which only accrue off party Stellar-Conduct /
        // Stellar Swirl DMG — unavailable to a team that can land neither.
        when: this.hasStellarGlimmer,
        parts: [
          {
            formula: freezingIceFormula(this.param("A", 6)),
            bespokeBuffs: freezingIceBonus,
          },
          {
            formula: freezingIceFormula(this.param("A", 7)),
            bespokeBuffs: freezingIceBonus,
          },
        ],
      },
      // param9 = during-fall, param10/param11 = low/high impact. Only the
      // high-impact row is modeled — the during-fall and low-impact rows are
      // intentionally left out.
      "traveler-cryo-plunge-high": {
        label: { zh: "下落·高", en: "Plunge High" },
        parts: [
          { formula: new DirectFormula(this.param("A", 11), infusedPlunge) },
        ],
      },
      "traveler-cryo-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), cryoSkill) }],
      },
      // Frostpierce Star: fires on its own timer normally (off-field), but
      // under Radiance: Stellar-Conduct it only fires as a coordinated attack
      // when the Traveler's own NA/CA/Plunge connects — i.e. on-field.
      "traveler-cryo-crystal": {
        label: { zh: "E冰晶伤害", en: "E Ice Crystal" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), cryoSkill),
            offField: !this.scRadiance,
          },
        ],
      },
      "traveler-cryo-burst": {
        label: {
          zh: `Q投矛${radianceSuffix.zh}`,
          en: `Q Javelin${radianceSuffix.en}`,
        },
        parts: [{ formula: burstFormula, hits: burstStrikes }],
      },
    };
  })();

  // Rotation: E > NA chains (feeding ice crystals) > 重击·冰凝 (only when the
  // team can produce Stellar Glimmer DMG) > Q on the Frostglow accrued above.
  protected override get comboDescriptor(): ComboTemplate {
    // The ice crystal count depends on the Radiance state, which a
    // ConstellationDelta cannot express — combo deltas resolve against
    // constellation only. Both modes are modelled by branching the descriptor
    // on the already-resolved option, so each selection reports its own count.
    //
    // Radiance: Stellar-Conduct replaces the timer with a coordinated attack on
    // every NA/CA/Plunge hit (once per 0.2s). The Traveler's sword cadence is
    // well above that ICD, so effectively every on-field attack hit inside the
    // star's lifetime fires a crystal: 3 Normal chains x 5 hits = 15. The two
    // 重击·冰凝 strikes land inside one 0.2s window, so they add at most one
    // more and are left out. C4's longer star does not raise this — the count
    // is bound by attack hits, not by star duration.
    //
    // Otherwise (no Radiance, and Radiance: Stellar Swirl, where the game text
    // leaves the timer untouched) the star fires on its own timer once every
    // 2s. That interval is community data (Icy Veins / Prydwen), not a talent
    // param — E ships only 4 params (skill DMG, crystal DMG, 15s CD, 12s star
    // duration). One star per rotation (15s CD vs 12s duration): 12s / 2s = 6,
    // and C4's +25% duration gives 15s / 2s = 7.5 → +1.
    const combo: ComboTemplate = [
      { id: "traveler-cryo-skill", count: 1 },
      { id: "traveler-cryo-normal", count: 3 },
      this.crystalCombo,
    ];
    if (this.hasStellarGlimmer) {
      combo.push({ id: "traveler-cryo-charge-freezing", count: 1 });
    }
    combo.push({ id: "traveler-cryo-burst", count: 1 });
    return combo;
  }
}

// Nicole — 5★ Pyro Catalyst (Hexerei)
// Key assumptions:
// - Kenosis is treated as upgraded to Theosis by default; OptionMap can
//   restrict the Theosis uplift to Hexerei characters before C6.
// - Arcane Projections use the triggering slot's stats/element via statsCharId.
// - C4 gets one independent 8-hit budget per character, including Nicole.
// - Hexerei P4 is a bespoke projection buff and only applies to Hexerei slots.
@RegisterCharacter("nicole", nicoleOption)
class Nicole extends CharacterBase {
  private readonly eAtkBuffMode = resolveOption(nicoleOption, this.option);

  private readonly isHexereiActive =
    this.teamMeta.countByFaction("Hexerei") >= 2;

  private readonly useHexereiOnlyTheosis =
    this.eAtkBuffMode === "hexerei-theosis" && this.constellation < 6;

  private readonly theosisTarget: BuffTarget = this.useHexereiOnlyTheosis
    ? { receiver: "team", factions: ["Hexerei"] }
    : { receiver: "team" };

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    const kenosisRatio = this.param("E", 5);
    const kenosisCap = this.param("E", 6);
    buffs.push(
      new ScalingBuff(
        cbs(this, "E", ["E"]),
        { receiver: "team" },
        [],
        "atk",
        "atk",
        kenosisRatio,
        kenosisCap
      )
    );

    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
          { key: "atk", value: 300 },
        ])
      );
    }

    buffs.push(
      new StatBuff(cbs(this, "P1", ["E"]), this.theosisTarget, [
        { key: "atk", value: 300 },
      ])
    );

    // Approximate corresponding-element RES shred with one buff per Theosis
    // recipient element.
    if (this.constellation >= 2) {
      const theosisElements = this.useHexereiOnlyTheosis
        ? Object.entries(this.teamMeta.elements)
            .filter(([cid]) => this.teamMeta.factions[cid] === "Hexerei")
            .map(([, element]) => element)
        : Object.values(this.teamMeta.elements);
      const teamEls = Array.from(
        new Set(theosisElements.filter((e): e is Element => e !== undefined))
      );
      for (const el of teamEls) {
        buffs.push(
          new StatBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "team", filter: { elements: [el] } },
            [{ key: "resReduction%", value: 0.25 }]
          )
        );
      }
    }

    // One maxStacks:8 C4 budget per character.
    if (this.constellation >= 4) {
      for (const cid of Object.keys(this.teamMeta.elements)) {
        buffs.push(
          new ScalingBuff(
            { ...cbs(this, "C4", ["E"]), maxStacks: 8 },
            {
              receiver: "team",
              charId: cid,
              filter: {
                abilities: ["normal", "charge", "plunge", "skill", "burst"],
              },
            },
            [],
            "atk",
            "baseDmg",
            0.7
          )
        );
      }
    }

    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", ["E"]), { receiver: "team" }, [
          { key: "defReduction%", value: 0.4 },
        ])
      );
    }

    // P4 is attached per projection below so it cannot affect Q's initial hit.

    return buffs;
  })();

  // Q projection formulas are emitted per slot so statsCharId can vary.
  protected readonly formulaMap = (() => {
    const pyroNormal = {
      element: "Pyro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const pyroPlunge = {
      element: "Pyro" as const,
      ability: "plunge" as const,
      reaction: "none" as const,
    };
    const pyroSkill = {
      element: "Pyro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const pyroBurst = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const formulas: Record<string, FormulaEntry> = {
      "nicole-normal": {
        label: { zh: "普攻（3段）", en: "Normal (3-hit)" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), pyroNormal) },
          { formula: new DirectFormula(this.param("A", 2), pyroNormal) },
          { formula: new DirectFormula(this.param("A", 3), pyroNormal) },
        ],
      },
      // param6 = during-fall, param7/param8 = low/high impact. Only the
      // high-impact row is modeled — the during-fall and low-impact rows are
      // intentionally left out.
      "nicole-plunge-high": {
        label: { zh: "下落攻击(高空)", en: "Plunge (High)" },
        parts: [{ formula: new DirectFormula(this.param("A", 8), pyroPlunge) }],
      },
      "nicole-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), pyroSkill) }],
      },
      "nicole-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [{ formula: new DirectFormula(this.param("Q", 1), pyroBurst) }],
      },
    };

    const projRatio = this.param("Q", 2);
    const charNames = {
      ...i18nGameData.characters,
      ...i18nBetaData.characters,
    } as Record<string, { en: string; zh: string }>;

    for (
      let slotIdx = 0;
      slotIdx < this.teamMeta.characters.length;
      slotIdx++
    ) {
      const occupantId = this.teamMeta.characters[slotIdx];
      if (!occupantId) continue;

      const occupantElement =
        this.teamMeta.elements[occupantId] ?? ("Pyro" as Element);
      const name = charNames[occupantId] ?? { en: occupantId, zh: occupantId };

      const projTag = {
        element: occupantElement,
        ability: "burst" as const,
        reaction: "none" as const,
      };

      const occupantIsHexerei =
        this.teamMeta.factions[occupantId] === "Hexerei";

      // Hexerei slots get Nicole-scaling bonus base DMG on projections.
      const p4Buff =
        this.isHexereiActive && occupantIsHexerei
          ? new ScalingBuff(
              cbs(this, "P4", ["Q"]),
              { receiver: "team", charId: occupantId },
              [],
              "atk",
              "baseDmg",
              3.0
            )
          : undefined;

      formulas[`nicole-q-coord-slot${slotIdx + 1}`] = {
        label: {
          zh: `Q奥迹造影·${name.zh}`,
          en: `Q Arcane (${name.en})`,
        },
        parts: [
          {
            formula: new DirectFormula(projRatio, projTag),
            statsCharId: occupantId,
            offField: false,
            ...(p4Buff ? { bespokeBuffs: [p4Buff] } : {}),
          },
        ],
      };

      if (this.constellation >= 1) {
        formulas[`nicole-c1-coord-slot${slotIdx + 1}`] = {
          label: {
            zh: `合一造影·${name.zh}`,
            en: `Unity (${name.en})`,
          },
          minC: 1,
          parts: [
            {
              formula: new DirectFormula(6.0, projTag),
              statsCharId: occupantId,
              offField: false,
              ...(p4Buff ? { bespokeBuffs: [p4Buff] } : {}),
            },
          ],
        };
      }
    }

    return formulas;
  })();

  // Default combo uses slot 1 as the guaranteed occupied projection slot.
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "nicole-skill", count: 1 },
      { id: "nicole-burst", count: 1 },
      { id: "nicole-q-coord-slot1", count: 4 },
      ...(this.constellation >= 1
        ? [{ id: "nicole-c1-coord-slot1", count: 3 }]
        : []),
    ];
  }
}

function manekinFormulas(
  charId: string,
  param: (skill: "A" | "E" | "Q", paramIndex: number) => number,
  element: Element
) {
  // All 14 variants (7 elements × 2 genders) share an identical kit:
  // - No constellations
  // - P2: Off-field ER regen (utility, no damage)
  // - P3: Random cosmetic change (no combat effect)
  // Formula IDs are prefixed with charId to avoid collisions between variants.
  const tag = (ability: "skill" | "burst") =>
    ({ element, ability, reaction: "none" as const }) as const;
  return {
    [`${charId}-skill`]: {
      label: { zh: "E伤害", en: "E" },
      parts: [{ formula: new DirectFormula(param("E", 1), tag("skill")) }],
    },
    [`${charId}-burst`]: {
      label: { zh: "Q生成+踏入×16", en: "Q Summon + Trespass×16" },
      parts: [
        { formula: new DirectFormula(param("Q", 1), tag("burst")) },
        {
          formula: new DirectFormula(param("Q", 2), tag("burst")),
          hits: 16,
        },
      ],
    },
    [`${charId}-p1-explosion`]: {
      label: { zh: "P1 Q爆炸", en: "P1 Q Explosion" },
      parts: [
        { formula: new DirectFormula(2.0, tag("burst")), offField: true },
      ],
    },
  };
}

function manekinDefaultRotation(charId: string): ComboTemplate {
  return [
    { id: `${charId}-skill`, count: 2 },
    { id: `${charId}-burst`, count: 1 },
    { id: `${charId}-p1-explosion`, count: 1 },
  ];
}

@RegisterCharacter("manekin_anemo")
class ManekinAnemo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Anemo"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekin_cryo")
class ManekinCryo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Cryo"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekin_dendro")
class ManekinDendro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Dendro"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekin_electro")
class ManekinElectro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Electro"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekin_geo")
class ManekinGeo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Geo"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekin_hydro")
class ManekinHydro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Hydro"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekin_pyro")
class ManekinPyro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Pyro"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekina_anemo")
class ManekinaAnemo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Anemo"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekina_cryo")
class ManekinaCryo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Cryo"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekina_dendro")
class ManekinaDendro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Dendro"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekina_electro")
class ManekinaElectro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Electro"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekina_geo")
class ManekinaGeo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Geo"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekina_hydro")
class ManekinaHydro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Hydro"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}

@RegisterCharacter("manekina_pyro")
class ManekinaPyro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.charId,
    this.param.bind(this),
    "Pyro"
  );
  protected override get comboDescriptor(): ComboTemplate {
    return manekinDefaultRotation(this.charId);
  }
}
