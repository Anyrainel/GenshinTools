import { DirectFormula, TransformFormula } from "../core/damageFormula";
import { CharacterBase } from "../core/implModel";
import { RegisterCharacter } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { ComboTemplate } from "../types";
import { cbs } from "./helpers";

@RegisterCharacter("sethos")
class Sethos extends CharacterBase {
  readonly buffs = [
    // P2: EM × 700% → baseDmg for Shadowpiercing Shot only (applied via bespokeBuff)
    // C1: Shadowpiercing Shot CR +15% (applied via bespokeBuff, not here — see formulaMap)
    // C2: Self Electro DMG +30% (2 stacks × 15%), no on-field restriction
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", []), { receiver: "self" }, [
            { key: "electro%", value: 0.3 },
          ]),
        ]
      : []),
    // C4: Team EM +80 on multi-hit
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["charge"]), { receiver: "team" }, [
            { key: "em", value: 80 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    return {
      "sethos-shadowpiercer": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("A", 7),
              { element: "Electro", ability: "charge", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("A", 8) }
            ),
            // P2: EM × 700% → baseDmg for Shadowpiercing Shot only
            // "4枚贯影箭命中敌人后" → removed after 4 hits.
            // Self buff → modeled as formula nuance (formula already has ≤4 shots).
            // C1: Shadowpiercing Shot CR +15% (merged here to avoid leaking to Dusk Bolts)
            bespokeBuffs: [
              new ScalingBuff(
                cbs(this, "P2/C1", ["charge"]),
                { receiver: "selfOnField", filter: { abilities: ["charge"] } },
                this.constellation >= 1
                  ? [{ key: "cr" as const, value: 0.15 }]
                  : [],
                "em",
                "baseDmg",
                7.0
              ),
            ],
          },
        ],
      },
      "sethos-dusk-bolt": {
        label: { zh: "Q瞑弦矢 (普攻一段)", en: "Q Dusk Bolt (N1)" },
        parts: [
          {
            // Q Dusk Bolt converts a Normal Attack into a piercing bolt:
            // base = N1% × ATK, with Q's EM-based DMG increase added on top.
            // Models the most common single-hit Dusk Bolt (one NA tap = one bolt).
            // The Q-induced EM scaling (Q param1) is added as a flat extraTerm.
            formula: new DirectFormula(
              this.param("A", 1),
              { element: "Electro", ability: "charge", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("Q", 1) }
            ),
          },
        ],
      },
    };
  })();

  // Rotation: C E 3[C] — 4 Shadowpiercing Shots per 15s cycle (KQM)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "sethos-shadowpiercer", count: 4 },
      { id: "sethos-dusk-bolt", count: 0 },
    ];
  }
}

@RegisterCharacter("kaveh")
class Kaveh extends CharacterBase {
  readonly buffs = [
    // P2: During Q, self EM +100 (25×4 stacks)
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "selfOnField" }, [
      { key: "em", value: 100 },
    ]),
    // C1: After E, heal% +25% for 3s
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["E"]), { receiver: "self" }, [
            { key: "heal%", value: 0.25 },
          ]),
        ]
      : []),
    // C2: Normal ATK SPD +15%
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["normal"] } },
            [{ key: "atkSpd%", value: 0.15 }]
          ),
        ]
      : []),
    // Q: Bloom burst DMG bonus (team Dendro Cores)
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { reactions: ["bloom", "lunarBloom"] } },
      [
        {
          key: "reactionDmg%",
          value: this.param("Q", 3),
        },
      ]
    ),
    // C4: Self-triggered Bloom DMG +60%
    ...(this.constellation >= 4
      ? [
          new StatBuff(
            cbs(this, "C4", []),
            {
              receiver: "self",
              filter: { reactions: ["bloom", "lunarBloom"] },
            },
            [{ key: "reactionDmg%", value: 0.6 }]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // Kaveh is an on-field Bloom DPS who attacks during Painted Dome (Q). Q
    // converts his Normal/Charged/Plunging Attacks to Dendro DMG that cannot be
    // overridden (S10 infusion exception), so these formulas are Dendro and are
    // modeled in the Q-infused state — the window where he actually attacks. The
    // existing C2 atkSpd, P2 EM-per-hit, and C6 Pairidaeza buffs land here.
    const naTag = {
      element: "Dendro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const caTag = {
      element: "Dendro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    return {
      // Q-infused Normal Attack chain (N1-N4)
      "kaveh-normal": {
        label: { zh: "Q普攻（4段）", en: "Q Normal (4-hit)" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), naTag) },
          { formula: new DirectFormula(this.param("A", 2), naTag) },
          { formula: new DirectFormula(this.param("A", 3), naTag) },
          { formula: new DirectFormula(this.param("A", 4), naTag) },
        ],
      },
      // Q-infused Charged Attack — cyclic slashes (A5) then a final slash (A6).
      // Cyclic tick count is an estimate (~2 per CA action before the final
      // slash); the exact count is stamina/duration dependent.
      "kaveh-charge": {
        label: { zh: "Q重击", en: "Q Charged" },
        parts: [
          { formula: new DirectFormula(this.param("A", 5), caTag), hits: 2 },
          { formula: new DirectFormula(this.param("A", 6), caTag) },
        ],
      },
      "kaveh-core": {
        label: { zh: "Q绽放", en: "Q Bloom" },
        parts: [
          {
            formula: new TransformFormula(0, {
              element: "Dendro",
              ability: "special",
              reaction: "bloom",
            }),
          },
        ],
      },
      // C6: Pairidaeza's Light — 61.8% ATK as Dendro DMG every 3s during Q
      "kaveh-c6-pairidaeza": {
        label: { zh: "天园之光", en: "Pairidaeza's Light" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(0.618, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: Q E N# E N# E — on-field Bloom driver, ~5 cores detonated (KQM).
  // He drives Blooms with Normal Attacks during Q; C6 Pairidaeza procs once per
  // 3s off those N/C/P hits (~2 procs per rotation when C6 is unlocked).
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "kaveh-core", count: 5 },
      { id: "kaveh-normal", count: 2 },
      { id: "kaveh-c6-pairidaeza", count: 0, bonus: [{ minC: 6, delta: 2 }] },
    ];
  }
}

@RegisterCharacter("faruzan")
class Faruzan extends CharacterBase {
  readonly buffs = [
    // Q: Anemo RES decrease (Q param4)
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { elements: ["Anemo"] } },
      [{ key: "resReduction%", value: this.param("Q", 4) }]
    ),
    // Q: Anemo DMG Bonus — Lv10 32.4%, Lv13 (C5+) 38.2%
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { elements: ["Anemo"] } },
      [{ key: "anemo%", value: this.param("Q", 2) }]
    ),
    // P2: Under Q, Anemo DMG gets flat baseDmg from 32% of Faruzan's BASE ATK (not total ATK)
    // Game text: "基于珐露珊基础攻击力的32%，提高造成的伤害"
    // "每0.8秒至多产生一次…生效1次后消失" — each 烈风护持 fires once then disappears,
    // but regenerates every 0.8s during Q. Effectively unlimited over a rotation.
    // Prayerful Wind's Benefit is granted to all nearby party members, so the
    // buff reaches off-field Anemo damage from affected teammates → receiver "team".
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "team",
        filter: {
          elements: ["Anemo"],
          abilities: ["normal", "charge", "plunge", "skill", "burst"],
        },
      },
      [],
      "baseAtk",
      "baseDmg",
      0.32
    ),
    // C6: Under Q, Anemo CRIT DMG +40%
    // Game text: "处于...效果影响下的角色" = all characters under Q buff (team-wide)
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: ["Anemo"] } },
            [{ key: "cd", value: 0.4 }]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    const eTag = {
      element: "Anemo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "faruzan-vortex": {
        label: { zh: "E风压坍陷风涡", en: "E Collapse Vortex" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), eTag),
          },
        ],
      },
      "faruzan-polyhedron": {
        label: { zh: "E多方面体", en: "E Polyhedron" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), eTag),
          },
        ],
      },
      // C6: While affected by Prayerful Wind's Benefit, the active character's
      // damage applies Pressurized Collapse, creating an extra vortex (Anemo
      // Skill DMG, same multiplier as the E vortex). Shared 3s CD party-wide.
      "faruzan-c6-collapse": {
        label: { zh: "C6风压坍陷风涡", en: "C6 Collapse Vortex" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), eTag),
          },
        ],
      },
    };
  })();

  // Rotation: E charged-shot Q — Anemo support, 1 vortex per rotation (KQM)
  // C6: active character's damage applies an extra Pressurized Collapse vortex
  // (shared 3s CD party-wide) — model 1 proc per rotation when C6 is unlocked.
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "faruzan-vortex", count: 1 },
      { id: "faruzan-c6-collapse", count: 0, bonus: [{ minC: 6, delta: 1 }] },
    ];
  }
}

@RegisterCharacter("layla")
class Layla extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];
    // C4: Team Normal/Charged baseDmg + 5% of Layla's HP
    // "将在造成普通攻击或重击伤害后的0.05秒后移除" → maxStacks: 1
    if (this.constellation >= 4) {
      buffs.push(
        new ScalingBuff(
          { ...cbs(this, "C4", ["E"]), maxStacks: 1 },
          { receiver: "team", filter: { abilities: ["normal", "charge"] } },
          [],
          "hp",
          "baseDmg",
          0.05
        )
      );
    }
    // C6: Shooting Stars (E skill) and Starlight Slugs (Q burst) DMG +40%
    // Scoped to skill+burst only — does not apply to normal/charged attacks
    // Both are off-field attacks, so use "self" not "selfOnField"
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", []),
          {
            receiver: "self",
            filter: { abilities: ["skill", "burst"] },
          },
          [{ key: "dmg%", value: 0.4 }]
        )
      );
    }
    return buffs;
  })();

  protected readonly formulaMap = (() => {
    return {
      // E Shooting Star DMG (off-field homing projectiles, 4 per wave)
      // P2: +1.5% Max HP as flat baseDmg on Shooting Stars
      "layla-shooting-star": {
        label: { zh: "E飞星", en: "E Shooting Star" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
            hits: 4,
            offField: true,
            bespokeBuffs: [
              new ScalingBuff(
                cbs(this, "P2", []),
                { receiver: "self", filter: { abilities: ["skill"] } },
                [],
                "hp",
                "baseDmg",
                0.015
              ),
            ],
          },
        ],
      },
      // Q Starlight Slug DMG (off-field burst projectiles)
      "layla-starlight-slug": {
        label: { zh: "Q星光弹", en: "Q Starlight Slug" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Cryo", ability: "burst", reaction: "none" },
              "hp"
            ),
            offField: true,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("candace")
class Candace extends CharacterBase {
  readonly buffs = [
    // Q: Prayer of Crimson Crown — on-field Normal ATK Elemental DMG bonus (Q param3)
    // Game text: bonus only applies when Normal Attacks deal Elemental DMG, so
    // scope to all elements except Physical.
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      {
        receiver: "teamOnField",
        filter: {
          abilities: ["normal"],
          elements: [
            "Pyro",
            "Hydro",
            "Cryo",
            "Electro",
            "Anemo",
            "Geo",
            "Dendro",
          ],
        },
      },
      [{ key: "dmg%", value: this.param("Q", 3) }]
    ),
    // P2: Per 1000 Max HP, Normal ATK Elemental DMG +0.5%
    // Game text: only when Normal Attacks deal Elemental DMG (exclude Physical).
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "teamOnField",
        filter: {
          abilities: ["normal"],
          elements: [
            "Pyro",
            "Hydro",
            "Cryo",
            "Electro",
            "Anemo",
            "Geo",
            "Dendro",
          ],
        },
      },
      [],
      "hp",
      "dmg%",
      0.000005
    ),
    // C2: After E hit, self Max HP +20% for 15s
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
            { key: "hp%", value: 0.2 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = {};
}

@RegisterCharacter("dori")
class Dori extends CharacterBase {
  // Pure healer/energy battery — no damage-relevant buffs
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = {};
}

@RegisterCharacter("collei")
class Collei extends CharacterBase {
  readonly buffs = [
    // C4: After Q, all nearby characters (not Collei) EM +60 for 12s
    // Game text: "队伍中附近的所有角色（不包括柯莱自己）的元素精通提升60点"
    // "all nearby party members excluding self" → receiver: "other"
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "other" }, [
            { key: "em", value: 60 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    const dendroSkill = {
      element: "Dendro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const dendroBurst = {
      element: "Dendro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      // E: Floral Brush — skill DMG (hits twice: throw + return)
      "collei-skill": {
        label: { zh: "E飞叶轮", en: "E Floral Brush" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), dendroSkill) },
        ],
      },
      // P1: Sprout — 40% ATK Dendro DMG per second for 3s, considered Elemental Skill DMG
      "collei-sprout": {
        label: { zh: "P1新叶", en: "P1 Sprout" },
        parts: [
          { formula: new DirectFormula(0.4, dendroSkill), offField: true },
        ],
      },
      // C6: Mini Cuilein-Anbar — 200% ATK Dendro DMG on Floral Ring hit (once per E)
      "collei-c6-mini": {
        label: { zh: "C6迷你柯里安巴", en: "C6 Mini Cuilein-Anbar" },
        minC: 6,
        parts: [{ formula: new DirectFormula(2.0, dendroSkill) }],
      },
      // Q: Trump-Card Kitty — Explosion DMG
      "collei-burst-explosion": {
        label: { zh: "Q爆发", en: "Q Explosion" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), dendroBurst) },
        ],
      },
      // Q: Trump-Card Kitty — Leap DMG (Cuilein-Anbar bounces)
      "collei-burst-leap": {
        label: { zh: "Q跃动", en: "Q Leap" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), dendroBurst),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E Q — off-field Dendro support, 2 E hits (throw+return) + 1 explosion + ~9 leaps per 12s
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "collei-skill", count: 2 },
      { id: "collei-c6-mini", count: 1 },
      { id: "collei-sprout", count: 0 },
      { id: "collei-burst-explosion", count: 1 },
      { id: "collei-burst-leap", count: 9 },
    ];
  }
}
