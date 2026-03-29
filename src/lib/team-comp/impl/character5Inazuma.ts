import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
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
import type { OptionDef } from "../damageModels";
import { cbs } from "../helpers";
import type { ComboDescriptor } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Inazuma Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("yumemizuki_mizuki")
class YumemizukiMizuki extends CharacterBase {
  readonly buffs = (() => {
    const eReactDmg = this.param("E", 2);
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
    // Swirl against marked enemy deals +1100% EM as additional flat DMG (U4)
    if (this.constellation >= 1) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C1", ["passive"]),
          { receiver: "self", filter: { reactions: ["swirl"] } },
          [],
          "em",
          "baseDmg",
          11.0
        )
      );
    }

    if (this.constellation >= 2) {
      // C2: per EM point → 0.04% Pyro/Hydro/Cryo/Electro DMG to party (excl Mizuki)
      // "队伍中所有其他角色" → other (no on-field restriction)
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["E"]),
          {
            receiver: "other",
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

  // Rotation: Q > E (Dreamdrifter ~10s with P1 extension); ~6 ticks during float
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "mizuki-skill-swirl", count: 6 }];
  }

  protected readonly formulaMap = (() => {
    const eTickMult = this.param("E", 1);
    const canSwirl = this.teamMeta.hasReaction("swirl");

    return {
      "mizuki-skill-swirl": {
        label: {
          zh: "E伤害+扩散",
          en: "E",
        },
        when: canSwirl,
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
    };
  })();
}

@RegisterCharacter("chiori")
class Chiori extends CharacterBase {
  readonly buffs = [
    // P2: When team creates Geo construct → Chiori Geo DMG +20%
    // No on-field restriction; Tamoto attacks off-field → receiver: "self"
    new StatBuff(cbs(this, "P2", []), { receiver: "self" }, [
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

  // Rotation: EE (Tapestry swap) > Q; off-field Tamoto + Kinu procs per window
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "chiori-e-combo", count: 1 },
      { id: "chiori-burst", count: 1 },
      { id: "chiori-burst-kinu", count: 0, bonus: [{ minC: 2, delta: 1 }] },
      { id: "chiori-na", count: 1 },
    ];
  }

  protected readonly formulaMap = (() => {
    // Tamoto: E param1 ATK + E param2 DEF
    const tAtk = this.param("E", 1);
    const tDef = this.param("E", 2);
    // Upward Sweep / P1 coordinated: E param5 ATK + E param6 DEF
    const sweepAtk = this.param("E", 5);
    const sweepDef = this.param("E", 6);
    // C2/C4 Kinu: 170% of Tamoto DMG (baked into multiplier)
    const kinuAtk = tAtk * 1.7;
    const kinuDef = tDef * 1.7;

    const geoSkill = {
      element: "Geo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const geoNormal = {
      element: "Geo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    // Pet count: base 1 + 1 extra if teammate has geo construct (C0) or geo element (C1+)
    const geoConstructChars = [
      "arataki_itto",
      "albedo",
      "zhongli",
      "kachina",
      "ningguang",
      "traveler_geo",
      "columbina",
    ];
    const teammates = this.teamMeta.characters.filter(
      (id) => id !== this.charId
    );
    const hasGeoConstruct = teammates.some((id) =>
      geoConstructChars.includes(id)
    );
    const hasExtraPet =
      this.constellation >= 1
        ? hasGeoConstruct ||
          teammates.some((id) => this.teamMeta.elements[id] === "Geo")
        : hasGeoConstruct;
    const numPets = 1 + (hasExtraPet ? 1 : 0);

    return {
      // E sweep + P1 coordinated (sweep mult) + Tamoto hits + C4 Kinu (170% Tamoto)
      "chiori-e-combo": {
        label: {
          zh: `E (${numPets}人偶)`,
          en: `E (${numPets} pet${numPets > 1 ? "s" : ""})`,
        },
        parts: [
          {
            formula: new DirectFormula(sweepAtk, geoSkill, "atk", {
              key: "def",
              multiplier: sweepDef,
            }),
            hits: 3, // 1 sweep + 2 P1 coordinated
          },
          {
            formula: new DirectFormula(tAtk, geoSkill, "atk", {
              key: "def",
              multiplier: tDef,
            }),
            hits: 5 * numPets,
            offField: true,
          },
          ...(this.constellation >= 4
            ? [
                {
                  formula: new DirectFormula(kinuAtk, geoSkill, "atk", {
                    key: "def",
                    multiplier: kinuDef,
                  }),
                  hits: 3,
                  offField: true,
                },
              ]
            : []),
        ],
      },
      // Q Hiyoku: Twin Blades — Q param1 ATK + Q param2 DEF
      "chiori-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Geo", ability: "burst", reaction: "none" },
              "atk",
              {
                key: "def",
                multiplier: this.param("Q", 2),
              }
            ),
          },
        ],
      },
      // C2: Q triggers 4 Kinu attacks (170% of Tamoto DMG, skill DMG, off-field)
      "chiori-burst-kinu": {
        label: { zh: "Q犬奴×4", en: "Q Kinu (×4)" },
        minC: 2,
        parts: [
          {
            formula: new DirectFormula(kinuAtk, geoSkill, "atk", {
              key: "def",
              multiplier: kinuDef,
            }),
            hits: 4,
            offField: true,
          },
        ],
      },
      // Pet attacks only (on-field) — Tamoto procs + C4 Kinu, on-field stats
      "chiori-pets-onfield": {
        label: {
          zh: `人偶×${numPets}(前台)`,

          en: `Pets (on-field, ${numPets})`,
        },
        parts: [
          {
            formula: new DirectFormula(tAtk, geoSkill, "atk", {
              key: "def",
              multiplier: tDef,
            }),
            hits: 5 * numPets,
          },
          ...(this.constellation >= 4
            ? [
                {
                  formula: new DirectFormula(kinuAtk, geoSkill, "atk", {
                    key: "def",
                    multiplier: kinuDef,
                  }),
                  hits: 3,
                },
              ]
            : []),
        ],
      },
      // Pet attacks only (off-field) — Tamoto procs + C4 Kinu, off-field stats
      "chiori-pets-offfield": {
        label: { zh: `人偶×${numPets}`, en: `Pets (${numPets})` },
        parts: [
          {
            formula: new DirectFormula(tAtk, geoSkill, "atk", {
              key: "def",
              multiplier: tDef,
            }),
            hits: 5 * numPets,
            offField: true,
          },
          ...(this.constellation >= 4
            ? [
                {
                  formula: new DirectFormula(kinuAtk, geoSkill, "atk", {
                    key: "def",
                    multiplier: kinuDef,
                  }),
                  hits: 3,
                  offField: true,
                },
              ]
            : []),
        ],
      },
      // C6: Geo-infused normal combo — N1 97.7%, N2 92.6%, N3 60.1%×2, N4 148.5%
      "chiori-na": {
        label: {
          zh: "普攻（4段）",
          en: "Normal (4-hit)",
        },
        minC: 6,
        parts: [
          { formula: new DirectFormula(0.977, geoNormal) },
          { formula: new DirectFormula(0.926, geoNormal) },
          { formula: new DirectFormula(0.601, geoNormal), hits: 2 },
          { formula: new DirectFormula(1.485, geoNormal) },
        ],
      },
    };
  })();
}

@RegisterCharacter("raiden_shogun")
class RaidenShogun extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: Each 1% ER above 100% → 0.4% Electro DMG Bonus
      // At 240% ER: (2.4 - 1.0) × 0.4 = 0.56 → 56% Electro DMG
      // Passive stat, no on-field requirement → receiver: "self"
      new ScalingBuff(
        cbs(this, "P2", []),
        { receiver: "self" },
        [],
        "er",
        "electro%",
        0.4,
        undefined,
        1.0
      ),
      // E: Team Burst DMG bonus based on energy cost (0.3% per energy at all levels)
      // Each character's own burst energy cost determines the bonus.
      // e.g. 90 energy → 0.3% × 90 = 27%, 60 energy → 18%
      ...this.teamMeta.characters.map(
        (charId) =>
          new StatBuff(
            cbs(this, "E", ["E"]),
            {
              receiver: "teamOnField",
              charId,
              filter: { abilities: ["burst"] },
            },
            [{ key: "dmg%", value: 0.003 * this.teamMeta.energies[charId] }]
          )
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
    // C4: After Q, all party members (excl Raiden) ATK +30%
    // "队伍中所有角色（不包括雷电将军自己）" → other (no on-field restriction)
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "other" }, [
          { key: "atk%", value: 0.3 },
        ])
      );
    }
    return buffs;
  })();

  // Rotation: E > supports > Q 3[N3C] N1C (~20s, hypercarry)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "raiden-coordinated", count: 1 },
      { id: "raiden-initial", count: 1 },
      { id: "raiden-charge", count: 3 },
    ];
  }

  // Q initial slash: Q param1 + Q param2 × 60 resolve
  // Q Charged ATK (Musou Isshin): Q param11 + Q param12, resolve Q param3 × 60 per hit
  protected readonly formulaMap = (() => {
    const initialMult = this.param("Q", 1) + this.param("Q", 2) * 60;
    const chargeResolve = this.param("Q", 3) * 60;
    // Charged ATK: hit1 + resolve, hit2 + resolve
    const chargeHit1 = this.param("Q", 11);
    const chargeHit2 = this.param("Q", 12);
    const electroBurst = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    // E coordinated attack: E param2, every 0.9s over 25s ≈ 27 hits
    const coordMult = this.param("E", 2);
    const electroSkill = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "raiden-coordinated": {
        label: {
          zh: "E协同攻击×27",
          en: "E Coordinated (×27)",
        },
        parts: [
          {
            formula: new DirectFormula(coordMult, electroSkill),
            hits: 27,
            offField: true,
          },
        ],
      },
      "raiden-initial": {
        label: {
          zh: "Q初始斩",
          en: "Q Initial (60 Resolve)",
        },
        parts: [
          {
            formula: new DirectFormula(initialMult, electroBurst),
          },
        ],
      },
      "raiden-charge": {
        label: {
          zh: "Q重击",
          en: "Q CA (60 Resolve)",
        },
        parts: [
          {
            // Charged hit 1: base% + resolve bonus (Lv10: 109.9% + 78.6%@60stacks)
            formula: new DirectFormula(
              chargeHit1 + chargeResolve,
              electroBurst
            ),
          },
          {
            // Charged hit 2: base% + resolve bonus (Lv10: 132.7% + 78.6%@60stacks)
            formula: new DirectFormula(
              chargeHit2 + chargeResolve,
              electroBurst
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("arataki_itto")
class AratakiItto extends CharacterBase {
  readonly buffs = [
    // Q: Royal Descent — DEF → ATK conversion (Q param2)
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "selfOnField" },
      [],
      "def",
      "atk",
      this.param("Q", 2)
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
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
            { key: "def%", value: 0.2 },
            { key: "atk%", value: 0.2 },
          ]),
        ]
      : []),
    // C6: Charged ATK CD +70%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [{ key: "cd", value: 0.7 }]
          ),
        ]
      : []),
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

  // Rotation: supports > Q > N1 E > 2×Kesagiri chain > E (Geo carry)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "itto-kesagiri", count: 2 }];
  }

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
          zh: `重击×${comboCount}+终`,
          en: `CA (${comboCount}+Final)`,
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
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "baseDmg%", value: 0.4 }]
          ),
        ]
      : []),
    // C4: Enemies hit by Q: DEF -30% for 6s
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
            { key: "defReduction%", value: 0.3 },
          ]),
        ]
      : []),
    // C6: Charged ATK DMG +298% every 10s
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [{ key: "dmg%", value: 2.98 }]
          ),
        ]
      : []),
  ];

  // Rotation: D E Q N1C > 2[N2C] (freeze carry, ~20s)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "ayaka-normal", count: 1 },
      { id: "ayaka-charged", count: 3 },
      { id: "ayaka-burst", count: 1 },
    ];
  }

  // Charged ATK: Lv10 109.0%×3 (Normal talent, no constellation boost)
  // Q cutting: Q param1, bloom: Q param2
  // C2: +2 smaller storms → +40% burst baseDmg% (handled via StatBuff, not pre-multiplied)
  protected readonly formulaMap = (() => {
    const cutMult = this.param("Q", 1);
    const bloomMult = this.param("Q", 2);
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
      "ayaka-normal": {
        label: { zh: "普攻（5段）", en: "Normal (5-hit)" },
        parts: [
          { formula: new DirectFormula(0.904, cryoNormal) },
          { formula: new DirectFormula(0.962, cryoNormal) },
          { formula: new DirectFormula(1.238, cryoNormal) },
          { formula: new DirectFormula(0.448, cryoNormal), hits: 3 },
          { formula: new DirectFormula(1.545, cryoNormal) },
        ],
      },
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
      "ayaka-burst-offfield": {
        label: { zh: "Q(19切+绽)", en: "Q (19 slashes + Bloom)" },
        parts: [
          {
            formula: new DirectFormula(cutMult, cryoBurst),
            hits: 19,
            offField: true,
          },
          { formula: new DirectFormula(bloomMult, cryoBurst), offField: true },
        ],
      },
    };
  })();
}

const ayatoOption = {
  label: { zh: "敌人血量（1命）", en: "Enemy HP (C1)" },
  choices: [
    { value: "below50", label: { zh: "HP≤50%", en: "HP≤50%" } },
    { value: "above50", label: { zh: "HP>50%", en: "HP>50%" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("kamisato_ayato", ayatoOption)
class KamisatoAyato extends CharacterBase {
  private readonly enemyHp = resolveOption(ayatoOption, this.option);

  readonly buffs = (() => {
    const ibuffs: StatBuff[] = [
      // Q: Normal ATK DMG +20% for characters in field
      new StatBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "teamOnField", filter: { abilities: ["normal"] } },
        [{ key: "dmg%", value: 0.2 }]
      ),
    ];
    // C1: Shunsuiken DMG +40% against enemies with HP ≤ 50%
    if (this.constellation >= 1 && this.enemyHp === "below50") {
      ibuffs.push(
        new StatBuff(
          cbs(this, "C1", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [{ key: "dmg%", value: 0.4 }]
        )
      );
    }
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

  // Rotation: Q > E (Shunsuiken ×16 baked) > swap (~20s, Hydro carry)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "ayato-shunsuiken", count: 1 },
      { id: "ayato-bloomwater", count: 1 },
      { id: "ayato-c6-strikes", count: 1 },
    ];
  }

  // Shunsuiken 3-hit combo (S3: separate parts per different multiplier)
  // N1: Lv10 104.6%, Lv13 (C3+) 126.7%
  // N2: Lv10 116.5%, Lv13 (C3+) 141.1%
  // N3: Lv10 128.4%, Lv13 (C3+) 155.5%
  // Namisen per hit: 4 stacks × 1.11% HP (C2: 5 stacks)
  // Q Bloomwater: Lv10 119.6%, Lv13 (C5+) 141.2%, ~30 hits over 18s
  protected readonly formulaMap = (() => {
    const n1Mult = this.param("E", 1);
    const n2Mult = this.param("E", 2);
    const n3Mult = this.param("E", 3);
    const stacks = this.constellation >= 2 ? 5 : 4;
    const namisenPerHit = this.param("E", 5);
    const hpPerHit = stacks * namisenPerHit;
    const qMult = this.param("Q", 1);
    const hydroTag = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    return {
      "ayato-shunsuiken": {
        label: { zh: "E瞬水剑×16", en: "E Shunsuiken (×16)" },
        parts: [
          {
            formula: new DirectFormula(n1Mult, hydroTag, "atk", {
              key: "hp",
              multiplier: hpPerHit,
            }),
            hits: 6,
          },
          {
            formula: new DirectFormula(n2Mult, hydroTag, "atk", {
              key: "hp",
              multiplier: hpPerHit,
            }),
            hits: 5,
          },
          {
            formula: new DirectFormula(n3Mult, hydroTag, "atk", {
              key: "hp",
              multiplier: hpPerHit,
            }),
            hits: 5,
          },
        ],
      },
      "ayato-bloomwater": {
        label: { zh: "Q伤害×30", en: "Q (×30)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 30,
            offField: true,
          },
        ],
      },
      "ayato-bloomwater-onfield": {
        label: { zh: "Q(前台)×30", en: "Q (on-field, ×30)" },
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
      // C6: 2 extra Shunsuiken strikes at 450% ATK each, not affected by Namisen
      "ayato-c6-strikes": {
        label: { zh: "额外瞬水剑×2", en: "Shunsuiken (×2)" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(4.5, hydroTag),
            hits: 2,
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
    // Always-active passive → receiver: "self"
    new StatBuff(cbs(this, "P4", []), { receiver: "self" }, [
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
    // Q: Nereid's Ascension — HP → baseDmg for Normal Attacks (Q param4)
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal"] },
      },
      [],
      "hp",
      "baseDmg",
      this.param("Q", 4)
    ),
    // Q: Nereid's Ascension — HP → baseDmg for Charged Attacks (Q param5)
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["charge"] },
      },
      [],
      "hp",
      "baseDmg",
      this.param("Q", 5)
    ),
    // C4: During Q, Normal ATK SPD +10%
    ...(this.constellation >= 4
      ? [
          new StatBuff(
            cbs(this, "C4", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["normal"] } },
            [{ key: "atkSpd%", value: 0.1 }]
          ),
        ]
      : []),
    // C6: Q heal on 80%+ HP → Hydro DMG +40%
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "selfOnField" }, [
            { key: "hydro%", value: 0.4 },
          ]),
        ]
      : []),
  ];

  // Rotation: E > supports > Q N2D×~5 (on-field during Q, ~3 fish procs at C1)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "kokomi-c1-fish", count: 3 }];
  }

  protected readonly formulaMap = {
    // C1: Swimming Fish — 30% Max HP as Hydro DMG (not Normal ATK DMG)
    "kokomi-c1-fish": {
      label: { zh: "游鱼", en: "Swimming Fish" },
      minC: 1,
      parts: [
        {
          formula: new DirectFormula(
            0.3,
            { element: "Hydro", ability: "special", reaction: "none" },
            "hp"
          ),
        },
      ],
    },
  };
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

    // C2: Q field — Kazuha's own EM +200 + on-field character EM +200 (don't stack)
    // "枫原万叶自己的元素精通提升200点" + "其中的场上角色的元素精通提升200点"
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "self" }, [
          { key: "em", value: 200 },
        ]),
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "otherOnField" }, [
          { key: "em", value: 200 },
        ])
      );
    }

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

  // Rotation: E (plunge) > Q > E (plunge) (VV support, ~20s)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "kazuha-skill", count: 2 },
      { id: "kazuha-plunge-c6", count: 2 },
      { id: "kazuha-burst", count: 1 },
    ];
  }

  // E press: E param1; Q slash: Q param1; Q DoT: Q param2
  // C6 High Plunge (Midare Ranzan): Normal ATK talent, no constellation boost. High plunge Lv10 404%
  protected readonly formulaMap = (() => {
    const eMult = this.param("E", 1);
    const qSlash = this.param("Q", 1);
    const qDot = this.param("Q", 2);
    return {
      "kazuha-skill": {
        label: { zh: "E伤害", en: "E" },
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
      "kazuha-plunge-c6": {
        label: { zh: "下落", en: "Plunge" },
        minC: 6,
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
        label: { zh: "Q 1斩+5风场", en: "Q (1 Slash + 5 DoT)" },
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
            offField: true,
          },
        ],
      },
    };
  })();
}

const yoimiyaOption = {
  label: { zh: "施放Q", en: "Cast Q" },
  choices: [
    { value: "yes", label: { zh: "施放Q", en: "Cast Q" } },
    { value: "no", label: { zh: "不施放Q", en: "Skip Q" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("yoimiya", yoimiyaOption)
class Yoimiya extends CharacterBase {
  private readonly castQ = resolveOption(yoimiyaOption, this.option);

  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: During E, Pyro DMG +2% per Normal ATK hit (max 10 stacks = 20%)
      new StatBuff(cbs(this, "P1", ["A1"]), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.2 },
      ]),
    ];

    if (this.castQ === "yes") {
      // P2: Q explosion grants party (except Yoimiya) +20% ATK for 15s (10% base + 1% per P1 stack)
      // "队伍中所有其他角色" → other (no on-field restriction)
      buffs.push(
        new StatBuff(cbs(this, "P2", ["A4", "Q"]), { receiver: "other" }, [
          { key: "atk%", value: 0.2 },
        ])
      );

      if (this.constellation >= 1) {
        // C1: Defeating Aurous Blaze marked enemy -> +20% ATK
        buffs.push(
          new StatBuff(cbs(this, "C1", ["Q"]), { receiver: "selfOnField" }, [
            { key: "atk%", value: 0.2 },
          ])
        );
      }
    }

    if (this.constellation >= 2) {
      // C2: CRIT Hit -> +25% Pyro DMG (works off-field per game text)
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["normal", "charge", "skill", "burst"]),
          { receiver: "self" },
          [{ key: "pyro%", value: 0.25 }]
        )
      );
    }

    return buffs;
  })();

  // Rotation: supports > E > 3×N1-N5 string (~20s, Pyro carry)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "yoimiya-normal", count: 3 },
      { id: "yoimiya-c6-arrow", count: 0 },
    ];
  }

  protected readonly formulaMap = (() => {
    // Per-hit NA multipliers at Lv10
    const n1 = 0.636; // ×2
    const n2 = 1.22;
    const n3 = 1.586;
    const n4 = 0.828; // ×2
    const n5 = 1.889;

    const eMult = this.param("E", 4);

    const pyroNormal = {
      element: "Pyro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    // Helper: per-hit talentMult = baseNA × eMult
    const m = (base: number) => base * eMult;

    const formulas: Record<string, FormulaEntry> = {
      "yoimiya-normal": {
        label: {
          zh: "E普攻（5段）",
          en: "Normal (5-hit, E)",
        },
        parts: [
          { formula: new DirectFormula(m(n1), pyroNormal), hits: 2 },
          { formula: new DirectFormula(m(n2), pyroNormal) },
          { formula: new DirectFormula(m(n3), pyroNormal) },
          { formula: new DirectFormula(m(n4), pyroNormal), hits: 2 },
          { formula: new DirectFormula(m(n5), pyroNormal) },
        ],
      },
    };

    if (this.constellation >= 6) {
      // C6: 50% chance of firing an extra blazing arrow dealing 60% of original DMG per hit
      formulas["yoimiya-c6-arrow"] = {
        label: {
          zh: "额外炽焰箭（5段）",
          en: "Blazing Arr (5-hit)",
        },
        parts: [
          { formula: new DirectFormula(m(n1) * 0.6, pyroNormal), hits: 2 },
          { formula: new DirectFormula(m(n2) * 0.6, pyroNormal) },
          { formula: new DirectFormula(m(n3) * 0.6, pyroNormal) },
          { formula: new DirectFormula(m(n4) * 0.6, pyroNormal), hits: 2 },
          { formula: new DirectFormula(m(n5) * 0.6, pyroNormal) },
        ],
      };
    }

    return formulas;
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
      // Sakura fires off-field → receiver: "self"
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "self", filter: { abilities: ["skill"] } },
          [{ key: "defIgnore%", value: 0.6 }]
        )
      );
    }
    return buffs;
  })();

  // Rotation: 3[E] > supports > Q 3[E]; ~15 Sakura hits + 1 burst per rotation
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "yae_miko-skill", count: 15 },
      { id: "yae_miko-burst", count: 1 },
    ];
  }

  protected readonly formulaMap = (() => {
    // C2 raises Sakura from Level 3 to Level 4 → param3 vs param4
    const eMult =
      this.constellation >= 2 ? this.param("E", 4) : this.param("E", 3);

    const qInitialMult = this.param("Q", 1);
    const qThunderboltMult = this.param("Q", 2);

    return {
      "yae_miko-skill": {
        label: { zh: "E(单次)", en: "E (×1)" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      "yae_miko-burst": {
        label: { zh: "Q 1段+3落雷", en: "Q Hit + 3 Thunderbolts" },
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
    };
  })();
}
