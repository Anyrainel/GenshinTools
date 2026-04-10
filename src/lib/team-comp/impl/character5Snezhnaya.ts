import type { Faction } from "@/data/types";
import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
  AmplifyFormula,
  CatalyzeFormula,
  type DamageFormula,
  DirectFormula,
  LunarDirectFormula,
  TransformFormula,
} from "../damageFormulas";
import {
  CharacterBase,
  RegisterCharacter,
  type StatSheet,
  resolveOption,
} from "../damageModels";
import type { OptionDef } from "../damageModels";
import { E, type Expr, simplify } from "../expr";
import type { ExprStats } from "../exprStats";
import { cbs } from "../helpers";
import type {
  CalcContext,
  ComboDescriptor,
  DamageTag,
  DisplayPart,
} from "../types";

class ArlecchinoNormalFormula extends DirectFormula {
  constructor(
    talentMultiplier: number,
    tag: DamageTag,
    private readonly hitIndex: number,
    private readonly initialBol: number,
    private readonly masqueScale: number
  ) {
    super(talentMultiplier, tag, "atk");
  }

  private getBol() {
    return this.initialBol * 0.925 ** this.hitIndex;
  }

  protected override getBaseDmg(stats: StatSheet): number {
    const currentBol = this.getBol();
    const talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    const extraBaseDmg =
      stats.get("atk", this.tag) * currentBol * this.masqueScale;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const currentBol = this.getBol();
    const talentDmg = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = E.mul(
      stats.get("atk", this.tag),
      E.const(currentBol * this.masqueScale)
    );
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = E.add(stats.get("baseDmg", this.tag), extraBaseDmg);
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
  }

  override createAmplified(reaction: "vaporize" | "melt"): DamageFormula {
    return new ArlecchinoNormalAmplifyFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.hitIndex,
      this.initialBol,
      this.masqueScale
    );
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const part = super.display(stats, charLevel, ctx);
    const currentBol = this.getBol();
    const extraBaseDmg =
      stats.get("atk", this.tag) * currentBol * this.masqueScale;
    part.statValues = {
      ...part.statValues,
      baseDmg: (part.statValues.baseDmg || 0) + extraBaseDmg,
    };
    return part;
  }
}

class ArlecchinoNormalAmplifyFormula extends AmplifyFormula {
  constructor(
    talentMultiplier: number,
    tag: DamageTag,
    private readonly hitIndex: number,
    private readonly initialBol: number,
    private readonly masqueScale: number
  ) {
    super(talentMultiplier, tag, "atk");
  }

  private getBol() {
    return this.initialBol * 0.925 ** this.hitIndex;
  }

  protected override getBaseDmg(stats: StatSheet): number {
    const currentBol = this.getBol();
    const talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    const extraBaseDmg =
      stats.get("atk", this.tag) * currentBol * this.masqueScale;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const currentBol = this.getBol();
    const talentDmg = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = E.mul(
      stats.get("atk", this.tag),
      E.const(currentBol * this.masqueScale)
    );
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = E.add(stats.get("baseDmg", this.tag), extraBaseDmg);
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const part = super.display(stats, charLevel, ctx);
    const currentBol = this.getBol();
    const extraBaseDmg =
      stats.get("atk", this.tag) * currentBol * this.masqueScale;
    part.statValues = {
      ...part.statValues,
      baseDmg: (part.statValues.baseDmg || 0) + extraBaseDmg,
    };
    return part;
  }
}

class ArlecchinoBurstFormula extends DirectFormula {
  constructor(
    talentMultiplier: number,
    tag: DamageTag,
    private readonly initialBol: number,
    private readonly hasC6: boolean
  ) {
    super(talentMultiplier, tag, "atk");
  }

  protected override getBaseDmg(stats: StatSheet): number {
    const talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    const extraBaseDmg = this.hasC6
      ? stats.get("atk", this.tag) * this.initialBol * 7.0
      : 0;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const talentDmg = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = this.hasC6
      ? E.mul(stats.get("atk", this.tag), E.const(this.initialBol * 7.0))
      : E.const(0);
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = E.add(stats.get("baseDmg", this.tag), extraBaseDmg);
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
  }

  override createAmplified(reaction: "vaporize" | "melt"): DamageFormula {
    return new ArlecchinoBurstAmplifyFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.initialBol,
      this.hasC6
    );
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const part = super.display(stats, charLevel, ctx);
    const extraBaseDmg = this.hasC6
      ? stats.get("atk", this.tag) * this.initialBol * 7.0
      : 0;
    part.statValues = {
      ...part.statValues,
      baseDmg: (part.statValues.baseDmg || 0) + extraBaseDmg,
    };
    return part;
  }
}

class ArlecchinoBurstAmplifyFormula extends AmplifyFormula {
  constructor(
    talentMultiplier: number,
    tag: DamageTag,
    private readonly initialBol: number,
    private readonly hasC6: boolean
  ) {
    super(talentMultiplier, tag, "atk");
  }

  protected override getBaseDmg(stats: StatSheet): number {
    const talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    const extraBaseDmg = this.hasC6
      ? stats.get("atk", this.tag) * this.initialBol * 7.0
      : 0;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const talentDmg = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = this.hasC6
      ? E.mul(stats.get("atk", this.tag), E.const(this.initialBol * 7.0))
      : E.const(0);
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = E.add(stats.get("baseDmg", this.tag), extraBaseDmg);
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const part = super.display(stats, charLevel, ctx);
    const extraBaseDmg = this.hasC6
      ? stats.get("atk", this.tag) * this.initialBol * 7.0
      : 0;
    part.statValues = {
      ...part.statValues,
      baseDmg: (part.statValues.baseDmg || 0) + extraBaseDmg,
    };
    return part;
  }
}

// ═══════════════════════════════════════════════════════════════
// 5★ Snezhnaya Characters
// ═══════════════════════════════════════════════════════════════

const arlecchinoOption = {
  label: { zh: "初始生命之契", en: "Initial BoL" },
  choices: [
    { value: "130", label: { zh: "130% 生命之契", en: "130%" } },
    { value: "155", label: { zh: "155% 生命之契", en: "155%" } },
    { value: "200", label: { zh: "200% 生命之契", en: "200%" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("arlecchino", arlecchinoOption)
class Arlecchino extends CharacterBase {
  private readonly initialBolStr = resolveOption(arlecchinoOption, this.option);

  readonly buffs = [
    // P3: In combat, unconditional Pyro DMG +40%
    new StatBuff(cbs(this, "P3", []), { receiver: "self" }, [
      { key: "pyro%", value: 0.4 },
    ]),
    // C6: After E, Normal ATK and Q: CR +10%, CD +70% for 20s
    new StatBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["normal", "burst"] } },
      this.constellation >= 6
        ? [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.7 },
          ]
        : []
    ),
  ];

  // Rotation: E > teammates > C absorb > 6[N3D] > Q (KQM, ~20s carry window)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "arlecchino-normal", count: 3 },
      { id: "arlecchino-burst", count: 1 },
      { id: "arlecchino-c2-bloodfire", count: 1 },
    ];
  }

  get formulaMap() {
    const nMults = [
      this.param("A", 1),
      this.param("A", 2),
      this.param("A", 3),
      this.param("A", 4),
      this.param("A", 4),
      this.param("A", 5),
      this.param("A", 6),
    ];
    const initialBol = Number.parseInt(this.initialBolStr) / 100;
    const masqueScale =
      this.constellation >= 1 ? this.param("A", 12) + 1.0 : this.param("A", 12);

    const normalBaseTag = {
      element: "Pyro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    const comboParts = nMults.map((mult, i) => ({
      formula: new ArlecchinoNormalFormula(
        mult,
        normalBaseTag,
        i,
        initialBol,
        masqueScale
      ),
    }));

    return {
      "arlecchino-normal": {
        label: {
          zh: "普攻6段7击",
          en: "Normal (6N 7-Hit)",
        },
        parts: comboParts,
      },
      "arlecchino-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new ArlecchinoBurstFormula(
              this.param("Q", 1),
              { element: "Pyro", ability: "burst", reaction: "none" },
              initialBol,
              this.constellation >= 6
            ),
          },
        ],
      },
      "arlecchino-e-cleave": {
        label: { zh: "E切斩", en: "E Cleave" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "arlecchino-c2-bloodfire": {
        label: { zh: "厄月血火", en: "Balemoon Bloodfire" },
        minC: 2,
        parts: [
          {
            formula: new DirectFormula(9.0, {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  }
}

@RegisterCharacter("tartaglia")
class Tartaglia extends CharacterBase {
  readonly buffs = [
    // P3: +1 Normal ATK level for party — handled by CharacterBase._effectiveLevels
    // P1: Riptide extends duration (utility)
    // C4: Riptide triggers every 4s (utility)
  ];

  // Rotation: rQ > E > 4[N3C] (~9s melee, International team, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "tartaglia-melee-combo", count: 4 },
      { id: "tartaglia-burst-melee", count: 1 },
      { id: "tartaglia-riptide-slash", count: 6 },
      { id: "tartaglia-stance-change", count: 1 },
    ];
  }

  // Burst Melee (Lv10): 835.0%
  // Burst Melee (Lv13 C5+): 986.0%
  protected readonly formulaMap = (() => {
    const meleeNormalTag = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const meleeChargeTag = {
      element: "Hydro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const meleeSkillTag = {
      element: "Hydro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "tartaglia-melee-combo": {
        label: { zh: "E普攻+重击", en: "E Melee N3C Combo" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 3), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 4), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 9), meleeChargeTag) },
          { formula: new DirectFormula(this.param("E", 10), meleeChargeTag) },
        ],
      },
      "tartaglia-melee-n4n5n6": {
        label: { zh: "E近战N4+N5+N6", en: "E Melee N4+N5+N6" },
        parts: [
          { formula: new DirectFormula(this.param("E", 5), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 6), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 7), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 8), meleeNormalTag) },
        ],
      },
      "tartaglia-burst-melee": {
        label: {
          zh: "Q斩击+断流爆发",
          en: "Q Slash + Riptide",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "tartaglia-burst-ranged": {
        label: { zh: "Q远程", en: "Q Ranged" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 3), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "tartaglia-riptide-slash": {
        label: { zh: "断流·斩", en: "Riptide Slash" },
        parts: [
          { formula: new DirectFormula(this.param("E", 11), meleeSkillTag) },
        ],
      },
      "tartaglia-stance-change": {
        label: { zh: "E状态激发", en: "E Stance Change" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), meleeSkillTag) },
        ],
      },
    };
  })();
}

const linneaOption = {
  label: { zh: "露米模式", en: "Lumi Mode" },
  choices: [
    { value: "tap", label: { zh: "点按 (超厉害)", en: "Tap (Super Power)" } },
    {
      value: "continuous",
      label: { zh: "连按 (究极厉害)", en: "Continuous Tap (Ultimate)" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("linnea", linneaOption)
class Linnea extends CharacterBase {
  private readonly lumiMode = resolveOption(linneaOption, this.option);

  private readonly isAscendantGleam =
    this.teamMeta.countByFaction("Moonsign") >= 2;

  readonly buffs = [
    // P3 (Moonsign Benediction): Per 100 DEF → +0.7% Lunar-Crystallize reactionBaseDmg%, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarCrystallize"] } },
      [],
      "def",
      "reactionBaseDmg%",
      0.00007,
      0.14
    ),
    // P1 (Field Observation Notes): When Lumi on field, nearby enemy Geo RES -15%; Ascendant Gleam: total -30%
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "team", filter: { elements: ["Geo"] } },
      [{ key: "resReduction%", value: this.isAscendantGleam ? 0.3 : 0.15 }]
    ),
    // P2 (Universal Naturalist Archive): EM = 5% DEF
    // Moonsign active → that character gets EM; non-Moonsign active → Linnea gets EM
    new ScalingBuff(
      cbs(this, "P2", ["passive"]),
      { receiver: "teamOnField", factions: ["Moonsign" as Faction] },
      [],
      "def",
      "em",
      0.05
    ),
    new ScalingBuff(
      cbs(this, "P2", ["passive"]),
      { receiver: "selfOffField" },
      [],
      "def",
      "em",
      0.05
    ),
    // C1: Field Catalog — team LC reaction hits gain +75% DEF baseDmg (stacks replenish, assume unlimited)
    // C6 enhances: 1.5x DMG → 112.5% DEF per hit
    ...(this.constellation >= 1
      ? [
          new ScalingBuff(
            cbs(this, this.constellation >= 6 ? "C6" : "C1", ["E"]),
            { receiver: "team", filter: { reactions: ["lunarCrystallize"] } },
            [],
            "def",
            "baseDmg",
            this.constellation >= 6 ? 0.75 * 1.5 : 0.75
          ),
        ]
      : []),
    // C2: Within 8s after Moondrift Harmony, Hydro+Geo party members gain +40% CRIT DMG
    ...(() => {
      if (this.constellation < 2) return [];
      const buffs: StatBuff[] = [];
      for (const [cid, el] of Object.entries(this.teamMeta.elements)) {
        if (el === "Hydro" || el === "Geo") {
          buffs.push(
            new StatBuff(
              cbs(this, "C2", ["E"]),
              { receiver: "team", charId: cid },
              [{ key: "cd", value: 0.4 }]
            )
          );
        }
      }
      return buffs;
    })(),
    // C2: Million Ton Crush CRIT DMG +150% — applied via bespokeBuff on the formula part
    // C4: Within 5s after Moondrift Harmony, Linnea and active character DEF +25%
    // "Linnea and active character" → self + onField
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["E"]), { receiver: "self" }, [
            { key: "def%", value: 0.25 },
          ]),
          new StatBuff(cbs(this, "C4", ["E"]), { receiver: "teamOnField" }, [
            { key: "def%", value: 0.25 },
          ]),
        ]
      : []),
    // C6: Lunar-Crystallize DMG elevated 25% (requires Ascendant Gleam)
    ...(this.constellation >= 6 && this.isAscendantGleam
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "team", filter: { reactions: ["lunarCrystallize"] } },
            [{ key: "elevated%", value: 0.25 }]
          ),
        ]
      : []),
  ];

  // Tap: Super Power Form — Pound only (no Moondrifts) or Pound + Overdrive (with Moondrifts)
  // Continuous Tap: Million Ton (on-field) then Standard Pounds
  protected override get comboDescriptor(): ComboDescriptor {
    const hasLC = this.teamMeta.hasReaction("lunarCrystallize");
    if (this.lumiMode === "tap") {
      return hasLC
        ? [
            { id: "linnea-pound", count: 5 },
            { id: "linnea-overdrive", count: 5 },
          ]
        : [{ id: "linnea-pound", count: 10 }];
    }
    return [
      { id: "linnea-million-ton", count: 1 },
      { id: "linnea-pound", count: 5 },
    ];
  }

  protected readonly formulaMap = (() => {
    const poundMult = this.param("E", 1);
    const overdriveMult = this.param("E", 2);
    const millionTonMult = this.param("E", 3);

    const geoSkillTag = {
      element: "Geo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const lcSkillTag = {
      element: "Geo" as const,
      ability: "skill" as const,
      reaction: "lunarCrystallize" as const,
    };

    const millionTonBespoke = (() => {
      const hasC1 = this.constellation >= 1;
      const hasC2 = this.constellation >= 2;
      if (!hasC1 && !hasC2) return {};
      const isC6 = this.constellation >= 6;
      // General C1 buff gives 0.75 (C6: 1.125) DEF baseDmg to all LC hits.
      // Million Ton gets 5 stacks × 1.5 (C6: 2.25) DEF each.
      // Bespoke = total − general (since general already applies).
      const generalScale = isC6 ? 0.75 * 1.5 : 0.75;
      const perStack = isC6 ? 1.5 * 1.5 : 1.5;
      const bespokeScale = perStack * 5 - generalScale;
      const stats = hasC2 ? [{ key: "cd" as const, value: 1.5 }] : [];
      return {
        bespokeBuff: new ScalingBuff(
          cbs(this, hasC1 ? "C1" : "C2", ["E"]),
          { receiver: "self" },
          stats,
          "def",
          "baseDmg",
          hasC1 ? bespokeScale : 0
        ),
      };
    })();

    return {
      // ── 捶捶乱打 (Pound-Pound Pummeler): 2× Geo hits, shared by both modes ──
      "linnea-pound": {
        label: { zh: "E捶捶乱打", en: "Pound-Pound Pummeler" },
        parts: [
          {
            formula: new DirectFormula(poundMult, geoSkillTag, "def"),
            hits: 2,
            offField: true,
          },
        ],
      },
      // ── 加力重锤 (Heavy Overdrive Hammer): LC hit, Tap mode with Moondrifts ──
      "linnea-overdrive": {
        label: { zh: "E加力重锤", en: "Heavy Overdrive Hammer" },
        parts: [
          {
            formula: new LunarDirectFormula(overdriveMult, lcSkillTag, "def"),
            offField: true,
          },
        ],
      },
      // ── 百万吨重锤 (Million Ton Crush): on-field, Continuous Tap mode ──
      // C2 Ascendant Gleam: Overdrive/Million Ton triggers Moondrift Harmony —
      // this is a team-level rx-lunarCrystallize event, added via combo lines.
      "linnea-million-ton": {
        label: { zh: "E百万吨重锤", en: "Million Ton Crush" },
        parts: [
          {
            formula: new LunarDirectFormula(millionTonMult, lcSkillTag, "def"),
            ...millionTonBespoke,
          },
        ],
      },
      // ── 百万吨重锤 off-field variant ──
      "linnea-million-ton-offfield": {
        label: { zh: "E百万吨重锤速切", en: "Million Ton quick" },
        parts: [
          {
            formula: new LunarDirectFormula(millionTonMult, lcSkillTag, "def"),
            ...millionTonBespoke,
            offField: true,
          },
        ],
      },
    };
  })();
}
