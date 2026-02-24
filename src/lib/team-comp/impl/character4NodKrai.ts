import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Nod-Krai Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("illuga")
class Illuga extends CharacterBase {
  private readonly hydroGeo =
    this.teamMeta.countByElement("Hydro") + this.teamMeta.countByElement("Geo");

  readonly buffs = (() => {
    const isC6 = this.constellation >= 6;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1 (C6 enhanced): After E/Q, team Geo CR/CD + EM
      new StatBuff(
        cbs(this, "P1", ["E", "Q"]),
        { receiver: "team", filter: { elements: ["Geo"] } },
        [
          { key: "cr", value: isC6 ? 0.1 : 0.05 },
          { key: "cd", value: isC6 ? 0.3 : 0.1 },
        ]
      ),
      new StatBuff(cbs(this, "P1", ["E", "Q"]), { receiver: "team" }, [
        { key: "em", value: isC6 ? 80 : 50 },
      ]),
      // Q: Nightingale's Song — EM → Geo baseDmg
      // Lv10: 60.5% EM, Lv13 (C3+): 71.4% EM
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "onField", filter: { elements: ["Geo"] } },
        [],
        "em",
        "baseDmg",
        this.constellation >= 3 ? 0.714 : 0.605
      ),
    ];
    // P2: Hydro/Geo count enhances Nightingale's Song
    // 1/2/3 → +7%/14%/24% EM as additional Geo baseDmg
    const p2Tiers = [0, 0.07, 0.14, 0.24] as const;
    const p2Scale = p2Tiers[Math.min(this.hydroGeo, 3)];
    if (p2Scale > 0) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "P2", ["Q"]),
          { receiver: "onField", filter: { elements: ["Geo"] } },
          [],
          "em",
          "baseDmg",
          p2Scale
        )
      );
    }
    // C4: During Q, on-field DEF +200
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "onField" }, [
          { key: "def", value: 200 },
        ])
      );
    }
    return buffs;
  })();

  // E/Q scale with EM+DEF — complex dual scaling, skip formulas for support
  protected readonly formulaMap = {};
}

@RegisterCharacter("jahoda")
class Jahoda extends CharacterBase {
  readonly buffs = [
    // P2: After Q heals at >70% HP, on-field EM +100
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "onField" }, [
      { key: "em", value: 100 },
    ]),
    // C6: After E flask full, Moonsign characters CR +5%, CD +40%
    new StatBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "team" },
      this.constellation >= 6
        ? [
            { key: "cr", value: 0.05 },
            { key: "cd", value: 0.4 },
          ]
        : []
    ),
  ];

  // Healer/support — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("aino")
class Aino extends CharacterBase {
  readonly buffs = [
    // P2: Burst DMG increased by 50% of EM → flat baseDmg on burst
    new ScalingBuff(
      cbs(this, "P2", []),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [],
      "em",
      "baseDmg",
      0.5
    ),
    // C1: After E/Q, self EM +80, other active party members EM +80 (non-stacking)
    ...(() => {
      if (this.constellation < 1) return [];
      return [
        new StatBuff(cbs(this, "C1", ["E", "Q"]), { receiver: "self" }, [
          { key: "em", value: 80 },
        ]),
        new StatBuff(cbs(this, "C1", ["E", "Q"]), { receiver: "onField" }, [
          { key: "em", value: 80 },
        ]),
      ];
    })(),
    // C6: After Q, electroCharged/bloom/lunarCharged/lunarBloom/lunarCrystallize DMG +15%
    // Ascendant Gleam (≥2 Nod-Krai): +20% more (total 35%)
    ...(() => {
      if (this.constellation < 6) return [];
      const nodKrai = this.teamMeta.countByRegion("Nod-Krai");
      const bonus = nodKrai >= 2 ? 0.35 : 0.15;
      const reactions = [
        "electroCharged" as const,
        "bloom" as const,
        "lunarCharged" as const,
        "lunarBloom" as const,
        "lunarCrystallize" as const,
      ];
      return [
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "onField", filter: { reactions } },
          [{ key: "reactionDmg%", value: bonus }]
        ),
      ];
    })(),
  ];

  // E: Musecatcher — Stage 1 + Stage 2
  // Lv10: 118.1% + 339.8% = 457.9%, Lv13 (C5+): 139.4% + 401.2% = 540.6%
  // Q: Water Ball DMG Lv10: 36.2%, Lv13 (C3+): 42.7%
  // ~14 hits over 14s duration
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 5.406 : 4.579;
    const qMult = this.constellation >= 3 ? 0.427 : 0.362;
    return {
      "aino-skill": {
        label: { zh: "元素战技", en: "Skill Total" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "aino-burst-total": {
        label: { zh: "水弹总伤", en: "Water Balls Total" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 14,
          },
        ],
      },
    };
  })();
}
