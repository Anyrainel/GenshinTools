import {
  AmplifyFormula,
  type DamageFormula,
  DirectFormula,
  StellarDirectFormula,
} from "../core/damageFormula";
import { E, type Expr, simplify } from "../core/expr";
import type { ExprStatSheet } from "../core/exprStatSheet";
import { CharacterBase } from "../core/implModel";
import { RegisterCharacter, resolveOption } from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { StatSheet } from "../core/statSheet";
import type {
  BuffTarget,
  CalcContext,
  ComboTemplate,
  DamageTag,
  DamageTagFilter,
  DisplayPart,
  OptionDef,
} from "../types";
import { cbs } from "./helpers";

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

  protected override getBaseDmgExpr(stats: ExprStatSheet): Expr {
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

  protected override getBaseDmgExpr(stats: ExprStatSheet): Expr {
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

  protected override getBaseDmgExpr(stats: ExprStatSheet): Expr {
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

  protected override getBaseDmgExpr(stats: ExprStatSheet): Expr {
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

// 5★ Snezhnaya Characters

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
  protected override get comboDescriptor(): ComboTemplate {
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
    const initialBol = Number.parseInt(this.initialBolStr, 10) / 100;
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
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "tartaglia-melee-combo", count: 4 },
      { id: "tartaglia-burst-melee", count: 1 },
      // C4: triggers an additional Riptide Slash every 4s, not bound by the 1.5s
      // base proc CD. Approximate as doubling the proc count over a ~9s rotation
      // (delta: 6). This is an approximation — real C4 yield depends on field timing.
      {
        id: "tartaglia-riptide-slash",
        count: 6,
        bonus: [{ minC: 4, delta: 6 }],
      },
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

const sandroneOption = {
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

@RegisterCharacter("sandrone", sandroneOption)
class Sandrone extends CharacterBase {
  private readonly rState = resolveOption(
    sandroneOption,
    this.option,
    this.teamMeta
  );

  private readonly radianceOn = this.rState !== "off";

  // Peak model: max 10 Refined Tactics stacks consumed on burst (P1)
  private readonly refinedTacticsStacks = this.radianceOn ? 10 : 0;

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // Polestar Field: recorded applications grant 29%-40% ordinary
      // Cryo/Electro DMG Bonus. The marker lets Direct/Catalyze formulas resolve
      // the selected attach count from CalcContext; Stellar Direct ignores dmg%.
      ...(this.teamMeta.hasReaction("stellarConduct")
        ? [
            new StatBuff(
              cbs(this, "P3", ["stellarConduct"]),
              {
                receiver: "team",
                filter: { elements: ["Cryo", "Electro"] },
              },
              [{ key: "polestarField", value: 1 }]
            ),
          ]
        : []),
      // P3: Per 100 ATK → +0.7% reactionBaseDmg% of 星超导/星扩散, cap 14%
      new ScalingBuff(
        cbs(this, "P3", ["passive"]),
        {
          receiver: "team",
          filter: { reactions: ["stellarConduct", "stellarSwirl"] },
        },
        [],
        "atk",
        "reactionBaseDmg%",
        0.00007,
        0.14
      ),
    ];

    // P2 (ZH/U0b): EM = 8% ATK (cap 160) — no 辉映 gate
    buffs.push(
      new ScalingBuff(
        cbs(this, "P2", ["passive"]),
        { receiver: "self" },
        [],
        "atk",
        "em",
        0.08,
        160
      )
    );

    // C1: Team 星烁 reaction DMG +30% in Decoding mode (peak: always on).
    // Decoding mode is a Fagio state entered by Sandrone's own Charged Attack and
    // carries no Radiance requirement, so this is NOT gated on radianceOn.
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["charge"]),
          {
            receiver: "team",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [{ key: "reactionDmg%", value: 0.3 }]
        )
      );
    }

    // C6 (ZH/U0b): 星烁 reaction DMG elevated 20% — unconditional at C6
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", []),
          {
            receiver: "self",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [{ key: "elevated%", value: 0.2 }]
        )
      );
    }

    if (this.radianceOn) {
      // P1: Refined Tactics cleared on burst → ray deals 100% + stacks×10% of original
      if (this.refinedTacticsStacks > 0) {
        buffs.push(
          new StatBuff(
            cbs(this, "P1", ["Q"]),
            {
              receiver: "selfOnField",
              filter: {
                abilities: ["burst"],
                reactions: ["stellarConduct", "stellarSwirl"],
              },
            },
            [{ key: "baseDmg%", value: this.refinedTacticsStacks * 0.1 }]
          )
        );
      }

      // C2 (ZH/U0b): CA condensed beam CRIT DMG +40%; +20% per beam this Decoding (max 3)
      if (this.constellation >= 2) {
        buffs.push(
          new StatBuff(
            cbs(this, "C2", ["charge"]),
            {
              receiver: "selfOnField",
              filter: {
                abilities: ["charge"],
                reactions: ["stellarConduct", "stellarSwirl"],
              },
            },
            [{ key: "reactionCd", value: 0.4 }]
          ),
          new StatBuff(
            cbs(this, "C2", ["charge"]),
            {
              receiver: "selfOnField",
              filter: {
                abilities: ["charge"],
                reactions: ["stellarConduct", "stellarSwirl"],
              },
            },
            // Peak Decoding: 3 beam stacks × 20%
            [{ key: "reactionCd", value: 0.6 }]
          )
        );
      }
    }

    return buffs;
  })();

  // Rotation: NA > CA decoding (~5 beams) > E > Q; ~2 C4 coord procs per rotation
  protected override get comboDescriptor(): ComboTemplate {
    const lines: ComboTemplate = [
      { id: "sandrone-normal", count: 1 },
      { id: "sandrone-charge-sweep", count: 1 },
      { id: "sandrone-charge-beam", count: 5 },
      { id: "sandrone-skill", count: 1 },
      { id: "sandrone-burst", count: 1 },
    ];
    if (this.radianceOn) {
      lines.push({
        id: "sandrone-c4-coord",
        count: 0,
        bonus: [{ minC: 4, delta: 2 }],
      });
    }
    // C6 converts the 3rd and every later Decoding beam into a cluster beam, so
    // with the 5-beam "sandrone-charge-beam" assumption above beams 3/4/5 each
    // convert → 3 activations. Keep in sync if the beam count is retuned.
    lines.push({
      id: "sandrone-c6-cluster",
      count: 0,
      bonus: [{ minC: 6, delta: 3 }],
    });
    return lines;
  }

  protected readonly formulaMap = (() => {
    // Claymore user: the NA chain and plunge rows carry no elemental tag in the
    // talent text and no passive/constellation adds an infusion → Physical (S10).
    const physNormal = {
      element: "Physical" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const physPlunge = {
      element: "Physical" as const,
      ability: "plunge" as const,
      reaction: "none" as const,
    };
    const cryoCharge = {
      element: "Cryo" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const cryoSkill = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const cryoBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const scCharge = {
      element: "Cryo" as const,
      ability: "charge" as const,
      reaction: "stellarConduct" as const,
    };
    const scSkill = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "stellarConduct" as const,
    };
    const scBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "stellarConduct" as const,
    };
    const swCharge = {
      element: "Cryo" as const,
      ability: "charge" as const,
      reaction: "stellarSwirl" as const,
    };
    const swSkill = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "stellarSwirl" as const,
    };
    const swBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "stellarSwirl" as const,
    };

    const onSwirl = this.rState === "stellarSwirl";

    const radianceSuffix = onSwirl
      ? { zh: "·星扩散", en: " (SSw)" }
      : this.rState === "stellarConduct"
        ? { zh: "·星超导", en: " (SC)" }
        : { zh: "", en: "" };

    const eSecondShotBespoke =
      this.radianceOn && this.refinedTacticsStacks > 0
        ? {
            bespokeBuffs: [
              new StatBuff(
                { ...cbs(this, "P1", ["E"]), maxStacks: 1 },
                {
                  receiver: "selfOnField",
                  filter: {
                    abilities: ["skill"],
                    reactions: ["stellarConduct", "stellarSwirl"],
                  },
                },
                // Peak: Decoding Power > 50 → second shot deals 400% of original
                [{ key: "baseDmg%", value: 3.0 }]
              ),
            ],
          }
        : {};

    return {
      "sandrone-normal": {
        label: { zh: "普攻", en: "NA" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), physNormal) },
          { formula: new DirectFormula(this.param("A", 2), physNormal) },
          { formula: new DirectFormula(this.param("A", 3), physNormal) },
        ],
      },
      // param8 = 下坠期间伤害, param9/param10 = 低空/高空坠地冲击伤害. Only the
      // high-impact row is modeled — the during-fall and low-impact rows are
      // intentionally left out.
      "sandrone-plunge-high": {
        label: { zh: "下落·高", en: "Plunge High" },
        parts: [
          { formula: new DirectFormula(this.param("A", 10), physPlunge) },
        ],
      },
      "sandrone-charge-sweep": {
        label: { zh: "重击扫射", en: "CA Sweep" },
        parts: [{ formula: new DirectFormula(this.param("A", 4), cryoCharge) }],
      },
      "sandrone-charge-beam": {
        label: {
          zh: `重击冷凝射线${radianceSuffix.zh}`,
          en: `CA Beam${radianceSuffix.en}`,
        },
        parts: [
          {
            formula: onSwirl
              ? new StellarDirectFormula(this.param("A", 11), swCharge)
              : this.radianceOn
                ? new StellarDirectFormula(this.param("A", 6), scCharge)
                : new DirectFormula(this.param("A", 5), cryoCharge),
          },
        ],
      },
      "sandrone-charge-overdrive": {
        label: { zh: "功率过载射击", en: "Power Overdrive" },
        parts: [{ formula: new DirectFormula(this.param("A", 7), cryoCharge) }],
      },
      "sandrone-skill": {
        label: { zh: "E棱晶弹", en: "E Prism Shots" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), cryoSkill) },
          {
            formula: onSwirl
              ? new StellarDirectFormula(this.param("E", 4), swSkill)
              : this.radianceOn
                ? new StellarDirectFormula(this.param("E", 2), scSkill)
                : new DirectFormula(this.param("E", 1), cryoSkill),
            ...eSecondShotBespoke,
          },
        ],
      },
      "sandrone-burst": {
        label: { zh: "Q", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), cryoBurst),
            hits: 3,
          },
          {
            formula: onSwirl
              ? new StellarDirectFormula(this.param("Q", 6), swBurst)
              : this.radianceOn
                ? new StellarDirectFormula(this.param("Q", 3), scBurst)
                : new DirectFormula(this.param("Q", 2), cryoBurst),
          },
        ],
      },
      "sandrone-c4-coord": {
        label: { zh: "C4协同炮击", en: "C4 Coordinated Cannon" },
        minC: 4,
        when: this.radianceOn,
        parts: [
          {
            // C4: 125% ATK under Stellar-Conduct, 187.5% under Stellar Swirl
            // Do NOT add offField here — intentional: C4 responds to Sandrone's
            // OWN stellar reaction damage, and every source of that (charge beam,
            // E second shot, Q ray, C6 cluster) is modeled as on-field.
            formula: onSwirl
              ? new StellarDirectFormula(1.875, swSkill, "atk")
              : new StellarDirectFormula(1.25, scSkill, "atk"),
          },
        ],
      },
      "sandrone-c6-cluster": {
        label: { zh: "C6集束射线", en: "C6 Cluster Beam" },
        minC: 6,
        parts: [
          {
            // C6: 80% ATK under Stellar-Conduct, 120% under Stellar Swirl,
            // 100% outside a Radiance state
            formula: onSwirl
              ? new StellarDirectFormula(1.2, swCharge, "atk")
              : this.radianceOn
                ? new StellarDirectFormula(0.8, scCharge, "atk")
                : new DirectFormula(1.0, cryoCharge, "atk"),
            hits: 4,
          },
        ],
      },
    };
  })();
}

const odetteOption = {
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

@RegisterCharacter("odette", odetteOption)
class Odette extends CharacterBase {
  private readonly rState = resolveOption(
    odetteOption,
    this.option,
    this.teamMeta
  );

  readonly buffs = (() => {
    const maxSplendorStacks = this.constellation >= 1 ? 6 : 4;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      ...(this.teamMeta.hasReaction("stellarConduct")
        ? [
            new StatBuff(
              cbs(this, "P3", ["stellarConduct"]),
              {
                receiver: "team",
                filter: { elements: ["Cryo", "Electro"] },
              },
              [{ key: "polestarField", value: 1 }]
            ),
          ]
        : []),
      // P1: Marvelous Splendor stacks -> Stellar Glimmer reaction DMG +15% per stack
      new StatBuff(
        cbs(this, "P1", []),
        {
          receiver: "team",
          filter: { reactions: ["stellarConduct", "stellarSwirl"] },
        },
        [{ key: "reactionDmg%", value: maxSplendorStacks * 0.15 }]
      ),
      // P2: ATK-to-reaction DMG scaling (baseDmg% +1.5% per 100 ATK over 1000, cap 30%)
      new ScalingBuff(
        cbs(this, "P2", []),
        {
          receiver: "self",
          filter: { reactions: ["stellarConduct", "stellarSwirl"] },
        },
        [],
        "atk",
        "baseDmg%",
        0.00015,
        0.3,
        1000
      ),
      // P3: ATK-to-reaction base DMG scaling (reactionBaseDmg% +0.7% per 100 ATK, cap 14%)
      new ScalingBuff(
        cbs(this, "P3", []),
        {
          receiver: "team",
          filter: { reactions: ["stellarConduct", "stellarSwirl"] },
        },
        [],
        "atk",
        "reactionBaseDmg%",
        0.00007,
        0.14
      ),
      // Q: Snow Swan's Dream self buff
      new StatBuff(
        cbs(this, "Q", ["Q"]),
        {
          receiver: "self",
          filter: { reactions: ["stellarConduct", "stellarSwirl"] },
        },
        [{ key: "reactionDmg%", value: this.param("Q", 3) }]
      ),
    ];

    // C2: Marvelous Splendor ATK buff (+7% per stack)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", []), { receiver: "team" }, [
          { key: "atk%", value: maxSplendorStacks * 0.07 },
        ])
      );

      // C2: RES reduction based on active Radiance state
      if (this.rState === "stellarConduct") {
        buffs.push(
          new StatBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "team", filter: { elements: ["Cryo", "Electro"] } },
            [{ key: "resReduction%", value: 0.2 }]
          )
        );
      } else if (this.rState === "stellarSwirl") {
        buffs.push(
          new StatBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "team", filter: { elements: ["Cryo", "Anemo"] } },
            [{ key: "resReduction%", value: 0.2 }]
          )
        );
      }
    }

    // C4: Snow Swan's Dream teammate buff
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          {
            receiver: "other",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [{ key: "reactionDmg%", value: this.param("Q", 3) * 0.5 }]
        )
      );
    }

    // C6: Elevated reaction DMG (25% team, 20% self additional)
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", []),
          {
            receiver: "team",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [{ key: "elevated%", value: 0.25 }]
        ),
        new StatBuff(
          cbs(this, "C6", []),
          {
            receiver: "self",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [{ key: "elevated%", value: 0.2 }]
        )
      );
    }

    return buffs;
  })();

  protected override get comboDescriptor(): ComboTemplate {
    const lines: ComboTemplate = [
      { id: "odette-normal", count: 1 },
      { id: "odette-charge", count: 1 },
      { id: "odette-skill-initial", count: 1 },
      { id: "odette-coda-dot", count: 6 },
      { id: "odette-coda-end", count: 1 },
      { id: "odette-plume-move", count: 4 },
      { id: "odette-wing-move", count: 4 },
      { id: "odette-burst", count: 1 },
    ];
    if (this.constellation >= 1) {
      lines.push({ id: "odette-c1-extra", count: 1 });
    }
    if (this.constellation >= 4) {
      lines.push({ id: "odette-c4-coord", count: 4 });
    }
    return lines;
  }

  protected readonly formulaMap = (() => {
    const physNormal = {
      element: "Physical" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const physCharge = {
      element: "Physical" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const physPlunge = {
      element: "Physical" as const,
      ability: "plunge" as const,
      reaction: "none" as const,
    };
    const cryoSkill = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const cryoBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    return {
      "odette-normal": {
        label: { zh: "普通攻击", en: "Normal Attack" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), physNormal) },
          { formula: new DirectFormula(this.param("A", 2), physNormal) },
          { formula: new DirectFormula(this.param("A", 3), physNormal) },
          { formula: new DirectFormula(this.param("A", 4), physNormal) },
          { formula: new DirectFormula(this.param("A", 5), physNormal) },
          { formula: new DirectFormula(this.param("A", 6), physNormal) },
        ],
      },
      "odette-charge": {
        label: { zh: "重击", en: "Charged Attack" },
        parts: [{ formula: new DirectFormula(this.param("A", 7), physCharge) }],
      },
      // param8 is the Charged Attack Stamina Cost, not a multiplier:
      // param9 = plunge DMG during fall, param10/param11 = low/high impact.
      // Only the high-impact row is modeled — the during-fall and low-impact
      // rows are intentionally left out.
      "odette-plunge-high": {
        label: { zh: "下落·高", en: "Plunge High" },
        parts: [
          { formula: new DirectFormula(this.param("A", 11), physPlunge) },
        ],
      },
      "odette-skill-initial": {
        label: { zh: "E技能伤害", en: "E Skill DMG" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), cryoSkill) }],
      },
      "odette-coda-dot": {
        label: { zh: "E共舞持续伤害", en: "E Coda DoT" },
        parts: [{ formula: new DirectFormula(this.param("E", 2), cryoSkill) }],
      },
      "odette-coda-end": {
        label: { zh: "E共舞结束伤害", en: "E Coda End DMG" },
        parts: [
          {
            formula:
              this.rState === "stellarSwirl"
                ? new StellarDirectFormula(this.param("E", 4), {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarSwirl",
                  })
                : new StellarDirectFormula(this.param("E", 3), {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarConduct",
                  }),
          },
        ],
      },
      "odette-plume-move": {
        label: { zh: "独舞·拂羽舞步", en: "Plume Dance Move" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 5), cryoSkill),
            offField: true,
          },
          ...(this.rState === "stellarConduct"
            ? [
                {
                  formula: new StellarDirectFormula(this.param("E", 6), {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarConduct",
                  }),
                  offField: true,
                },
              ]
            : []),
          ...(this.rState === "stellarSwirl"
            ? [
                {
                  formula: new StellarDirectFormula(this.param("E", 7), {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarSwirl",
                  }),
                  offField: true,
                },
              ]
            : []),
        ],
      },
      "odette-wing-move": {
        label: { zh: "独舞·旋翼舞步", en: "Wing Dance Move" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 8), cryoSkill),
            offField: true,
          },
          ...(this.rState === "stellarConduct"
            ? [
                {
                  formula: new StellarDirectFormula(this.param("E", 9), {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarConduct",
                  }),
                  offField: true,
                },
              ]
            : []),
          ...(this.rState === "stellarSwirl"
            ? [
                {
                  formula: new StellarDirectFormula(this.param("E", 10), {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarSwirl",
                  }),
                  offField: true,
                },
              ]
            : []),
        ],
      },
      "odette-burst": {
        label: { zh: "Q斩击", en: "Q Slashes" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), cryoBurst),
            hits: 3,
          },
          {
            formula: new DirectFormula(this.param("Q", 2), cryoBurst),
          },
        ],
      },
      "odette-c1-extra": {
        label: { zh: "C1额外冰伤", en: "C1 Extra DMG" },
        minC: 1,
        parts: [
          {
            // Note: ZH text specifies 300% and 450% multipliers; EN is lower (200%/300%).
            // Following Rule U0b, we use the ZH source of truth.
            formula:
              this.rState === "stellarSwirl"
                ? new StellarDirectFormula(4.5, {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarSwirl",
                  })
                : new StellarDirectFormula(3.0, {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarConduct",
                  }),
          },
        ],
      },
      "odette-c4-coord": {
        label: { zh: "C4协同攻击", en: "C4 Coordinated Attack" },
        minC: 4,
        parts: [
          {
            // Note: ZH text specifies 66% and 99% multipliers; EN is lower (50%/75%).
            // Following Rule U0b, we use the ZH source of truth.
            formula:
              this.rState === "stellarSwirl"
                ? new StellarDirectFormula(0.99, {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarSwirl",
                  })
                : new StellarDirectFormula(0.66, {
                    element: "Cryo",
                    ability: "skill",
                    reaction: "stellarConduct",
                  }),
            offField: true,
          },
        ],
      },
    };
  })();
}

const vesnaOption = {
  label: { zh: "辉映·星扩散", en: "Radiance: Stellar Swirl" },
  choices: [
    {
      value: "on",
      label: { zh: "开启", en: "On" },
      when: (tm) => tm.hasReaction("stellarSwirl"),
    },
    { value: "off", label: { zh: "关闭", en: "Off" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("vesna", vesnaOption)
class Vesna extends CharacterBase {
  // P3 only converts 冰元素扩散 → 星扩散; Vesna never unlocks Stellar-Conduct.
  private readonly radianceOn =
    resolveOption(vesnaOption, this.option, this.teamMeta) === "on";

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P3: +0.7% Stellar Swirl base DMG per 100 ATK for the whole party, cap 14%.
      new ScalingBuff(
        cbs(this, "P3", ["passive"]),
        { receiver: "team", filter: { reactions: ["stellarSwirl"] } },
        [],
        "atk",
        "reactionBaseDmg%",
        0.00007,
        0.14
      ),
    ];

    // P2 Effortless: only active under 辉映·星扩散. Counts every party member
    // (Vesna included); C4 raises the effect by 200% → ×3.
    if (this.radianceOn) {
      const elements = Object.values(this.teamMeta.elements).filter(
        (e) => e != null
      );
      const cryoAnemo = elements.filter(
        (e) => e === "Cryo" || e === "Anemo"
      ).length;
      const otherElements = elements.length - cryoAnemo;
      const p2Origin = this.constellation >= 4 ? "P2/C4" : "P2";
      const p2Mult = this.constellation >= 4 ? 3 : 1;
      if (cryoAnemo > 0) {
        buffs.push(
          new StatBuff(cbs(this, p2Origin, ["passive"]), { receiver: "self" }, [
            { key: "atk%", value: cryoAnemo * 0.06 * p2Mult },
          ])
        );
      }
      if (otherElements > 0) {
        buffs.push(
          new StatBuff(cbs(this, p2Origin, ["passive"]), { receiver: "self" }, [
            { key: "em", value: otherElements * 25 * p2Mult },
          ])
        );
      }
    }

    // C1: Vesna's own Stellar Swirl DMG +20% while in the Spirit Blade state.
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E"]),
          { receiver: "selfOnField", filter: { reactions: ["stellarSwirl"] } },
          [{ key: "reactionDmg%", value: 0.2 }]
        )
      );
    }

    // C2: Unruffled is granted at max stacks on entering the Spirit Blade
    // state, and being at max stacks additionally grants ATK +60%.
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
          { key: "atk%", value: 0.6 },
        ])
      );
    }

    // C6: Vesna's Stellar Swirl reaction DMG is elevated by 20%.
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", []),
          { receiver: "self", filter: { reactions: ["stellarSwirl"] } },
          [{ key: "elevated%", value: 0.2 }]
        )
      );
    }

    return buffs;
  })();

  /**
   * P1 Unruffled — each stack makes a spirit blade deal "+10% of the original"
   * (cap 160% of the original) → `baseDmg%` +0.1 per stack. It covers only the
   * spirit blade / Stellar spirit blade hits, not Vesna's own strikes, the
   * Spirit Feather or the E cast, so it is attached per formula part instead
   * of as a tag-filtered self buff.
   *
   * 「施放灵剑·刺、灵剑·落、灵剑·舞或元素爆发灵剑·爆后，获得1层」 — the stack is
   * granted AFTER the cast, and 「施放元素战技灵剑·起…时，所有「从容」将被清除」
   * means the E cast that opens the Spirit Blade state wipes the counter. So
   * below C2 a cast never buffs itself and 6 stacks is structurally
   * unreachable: 灵剑·刺 lands at 0 stacks, 灵剑·落 at 1, the 灵剑·舞 casts at
   * 2/3/4 (5 for the extra C1 dance) and Q 灵剑·爆 at 5 (6 at C1).
   *
   * At C2「进入「灵剑武装」状态时，立刻获得满层的「从容」」grants all 6 on entry,
   * so every blade hit sits at the flat 60%.
   */
  private unruffled(stacks: number): StatBuff[] {
    const maxOnEntry = this.constellation >= 2;
    return [
      new StatBuff(
        cbs(this, maxOnEntry ? "P1/C2" : "P1", ["E", "Q"]),
        { receiver: "selfOnField" },
        [{ key: "baseDmg%", value: (maxOnEntry ? 6 : stacks) / 10 }]
      ),
    ];
  }

  // Rotation: E > NA (feathers) > 灵剑·刺 > 灵剑·落 > 灵剑·舞 x3 (+1 at C1) > Q
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "vesna-skill", count: 1 },
      { id: "vesna-normal", count: 1 },
      // The Spirit Feather fires on Normal/Charged/Plunging Attacks in the
      // Spirit Blade state; its ICD is unknown, so this is a moderate estimate.
      { id: "vesna-feather", count: 5 },
      { id: "vesna-blade-pierce", count: 1 },
      { id: "vesna-blade-plunge", count: 1 },
      // The E text caps 灵剑·舞 at 3 uses per Spirit Blade state and ends the
      // state on the third, and C1 adds a 4th use plus a free first cast. One
      // state per rotation (15s state vs 18s CD), so the cap is the rotation
      // count. 3 is the intended peak, not just a nominal ceiling: P1 Unruffled
      // caps at 6 stacks (one per 刺/落/舞/Q, cleared by the E cast) and
      // 刺 + 落 + 3x舞 + Q lands exactly on 6 (160% of the original). Spirit
      // Blade Force is not binding either — 2 orbs from E + 1 from Q + one per
      // 灵羽 covers the 5 special-skill casts needed to reach the third 舞.
      { id: "vesna-blade-dance", count: 3, bonus: [{ minC: 1, delta: 1 }] },
      { id: "vesna-burst", count: 1 },
      // C6 opens a 5s 灵剑·踏 window after every 灵剑·舞, with no per-state cap
      // or cooldown of its own, so the count is one per dance — keep it in step
      // with "vesna-blade-dance" above (3 + 1 from C1, which any C6 account has).
      { id: "vesna-c6-tread", count: 0, bonus: [{ minC: 6, delta: 4 }] },
    ];
  }

  protected readonly formulaMap = (() => {
    // The Spirit Blade state converts Vesna's Normal/Charged/Plunging Attacks
    // to Anemo DMG that "cannot be overridden by another elemental infusion".
    // The peak model assumes the state is up, so no Physical variants exist.
    const anemoNormal = {
      element: "Anemo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const anemoCharge = {
      element: "Anemo" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const anemoPlunge = {
      element: "Anemo" as const,
      ability: "plunge" as const,
      reaction: "none" as const,
    };
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
    const swSkill = {
      element: "Anemo" as const,
      ability: "skill" as const,
      reaction: "stellarSwirl" as const,
    };
    const swBurst = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "stellarSwirl" as const,
    };

    const on = this.radianceOn;
    const suffix = on ? { zh: "·星扩散", en: " (SSw)" } : { zh: "", en: "" };

    // 灵剑·舞 is a single formula entry that the combo consumes 3 times (4 at
    // C1), so it cannot carry the 2/3/4(/5) per-cast Unruffled counts. It takes
    // their mean instead, which is exact for the rotation total: `baseDmg%`
    // enters the damage as (1 + value), so summing across casts is linear in
    // the stack count and only the per-row split differs.
    const danceStacks = this.constellation >= 1 ? 3.5 : 3;
    const burstStacks = this.constellation >= 1 ? 6 : 5;

    return {
      "vesna-normal": {
        label: { zh: "普通攻击", en: "Normal Attack" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), anemoNormal) },
          { formula: new DirectFormula(this.param("A", 2), anemoNormal) },
          // 三段伤害 lands twice.
          {
            formula: new DirectFormula(this.param("A", 3), anemoNormal),
            hits: 2,
          },
          { formula: new DirectFormula(this.param("A", 4), anemoNormal) },
          { formula: new DirectFormula(this.param("A", 5), anemoNormal) },
          { formula: new DirectFormula(this.param("A", 6), anemoNormal) },
        ],
      },
      "vesna-charge": {
        label: { zh: "重击", en: "Charged Attack" },
        parts: [
          { formula: new DirectFormula(this.param("A", 7), anemoCharge) },
        ],
      },
      // The Charged Attack Stamina Cost row carries no param, so param8 is the
      // during-fall DMG and param9/param10 are the low/high impact rows. Only
      // the high-impact row is modeled — the during-fall and low-impact rows
      // are intentionally left out.
      "vesna-plunge-high": {
        label: { zh: "下落·高", en: "Plunge High" },
        parts: [
          { formula: new DirectFormula(this.param("A", 10), anemoPlunge) },
        ],
      },
      "vesna-skill": {
        label: { zh: "E灵剑·起", en: "E Blade Inception" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), anemoSkill) }],
      },
      "vesna-feather": {
        label: { zh: "灵羽", en: "Spirit Feather" },
        parts: [
          { formula: new DirectFormula(this.param("E", 10), anemoSkill) },
        ],
      },
      // 灵剑·刺 has a single talent row — Vesna's own strike. Separate blade
      // rows only appear from 灵剑·落 onwards.
      "vesna-blade-pierce": {
        label: { zh: "灵剑·刺", en: "Blade Pierce" },
        parts: [{ formula: new DirectFormula(this.param("E", 2), anemoSkill) }],
      },
      "vesna-blade-plunge": {
        label: {
          zh: `灵剑·落${suffix.zh}`,
          en: `Blade Plunge${suffix.en}`,
        },
        parts: [
          // Vesna's own strike — not a spirit blade, so no Unruffled bonus.
          { formula: new DirectFormula(this.param("E", 3), anemoSkill) },
          {
            formula: on
              ? new StellarDirectFormula(this.param("E", 5), swSkill)
              : new DirectFormula(this.param("E", 4), anemoSkill),
            // 灵剑·刺 has landed and granted its stack → 1.
            bespokeBuffs: this.unruffled(1),
          },
        ],
      },
      "vesna-blade-dance": {
        label: {
          zh: `灵剑·舞${suffix.zh}`,
          en: `Blade Dance${suffix.en}`,
        },
        parts: [
          {
            formula: on
              ? new StellarDirectFormula(this.param("E", 7), swSkill)
              : new DirectFormula(this.param("E", 6), anemoSkill),
            hits: 4,
            bespokeBuffs: this.unruffled(danceStacks),
          },
          {
            formula: on
              ? new StellarDirectFormula(this.param("E", 9), swSkill)
              : new DirectFormula(this.param("E", 8), anemoSkill),
            bespokeBuffs: this.unruffled(danceStacks),
          },
        ],
      },
      // 元素爆发灵剑/星灵剑伤害 is one talent row holding both values, so
      // param1 is the plain spirit blade and param2 the Stellar one — the same
      // pairing the 灵剑·落 and 灵剑·舞 rows use above.
      "vesna-burst": {
        label: {
          zh: `Q灵剑·爆${suffix.zh}`,
          en: `Q Blade Burst${suffix.en}`,
        },
        parts: [
          {
            formula: on
              ? new StellarDirectFormula(this.param("Q", 2), swBurst)
              : new DirectFormula(this.param("Q", 1), anemoBurst),
            bespokeBuffs: this.unruffled(burstStacks),
          },
        ],
      },
      "vesna-c6-tread": {
        label: { zh: "C6灵剑·踏", en: "C6 Blade Tread" },
        minC: 6,
        parts: [
          // Vesna's own kick — 150% ATK Anemo, not a spirit blade.
          { formula: new DirectFormula(1.5, anemoSkill, "atk") },
          {
            // The Stellar spirit blade it drives (200% ATK) is explicitly
            // covered by Ascension Talent 1. C6 implies C2, so the stack count
            // passed here is always overridden by the max-on-entry branch.
            formula: new StellarDirectFormula(2.0, swSkill, "atk"),
            bespokeBuffs: this.unruffled(6),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("vodyanitsa")
class Vodyanitsa extends CharacterBase {
  /**
   * P1 turns the party's 星辉风旋 into 「流荡风旋」 during her Elemental Skill,
   * and every 异化 clause in her kit ("若场上存在或最近存在过「流荡风旋」")
   * keys off those. Whether they exist is fully decided by the team being able
   * to produce Stellar Swirl, so there is no user-facing option here.
   */
  private readonly stellarMode = this.teamMeta.hasReaction("stellarSwirl");

  readonly buffs = (() => {
    const isC6 = this.constellation >= 6;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // E: microphone attacks shred Hydro and Cryo RES.
      new StatBuff(
        cbs(this, "E", ["E"]),
        { receiver: "team", filter: { elements: ["Hydro", "Cryo"] } },
        [{ key: "resReduction%", value: this.param("E", 5) }]
      ),
      // Q: Microphone Resonance Bonus while the microphone is playing. The
      // talent text ("使本次伤害获得额外提升") names no multiplicative zone, so
      // it is read as a plain DMG bonus scoped to the burst.
      new StatBuff(
        cbs(this, "Q", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [{ key: "dmg%", value: this.param("Q", 2) }]
      ),
    ];

    // P2 + 独奏/协奏: flat DMG per 1000 Max HP above 40,000. 独奏 (17 stacks)
    // feeds the active character, 协奏 (10 stacks) the off-field ones. With
    // 「流荡风旋」 up both are 异化 into 星·独奏/星·协奏, which only boost
    // Stellar Swirl reactions but for a much larger amount.
    const scoreFilter: DamageTagFilter = this.stellarMode
      ? { reactions: ["stellarSwirl"] }
      : { elements: ["Hydro", "Cryo"] };
    const soloTarget: BuffTarget = {
      receiver: "teamOnField",
      filter: scoreFilter,
    };
    const ensembleTarget: BuffTarget = {
      receiver: "teamOffField",
      filter: scoreFilter,
    };
    const perHp = this.stellarMode ? 0.26 : 0.14;
    const hpCap = this.stellarMode ? 6500 : 3500;
    buffs.push(
      new ScalingBuff(
        { ...cbs(this, "P2", ["E"]), maxStacks: 17 },
        soloTarget,
        [],
        "hp",
        "baseDmg",
        perHp,
        hpCap,
        40000
      ),
      new ScalingBuff(
        { ...cbs(this, "P2", ["E"]), maxStacks: 10 },
        ensembleTarget,
        [],
        "hp",
        "baseDmg",
        perHp,
        hpCap,
        40000
      )
    );

    // P1: 「流荡风旋」 shred Anemo RES on generation and detonation.
    if (this.stellarMode) {
      buffs.push(
        new StatBuff(
          cbs(this, "P1", ["E"]),
          { receiver: "team", filter: { elements: ["Anemo"] } },
          [{ key: "resReduction%", value: 0.3 }]
        )
      );
    }

    // C2: 合奏 on every microphone attack, 异化 into 变奏 while 「流荡风旋」
    // are around. C6 widens both from the active character to the whole party.
    if (this.constellation >= 2) {
      const receiver = isC6 ? ("team" as const) : ("teamOnField" as const);
      buffs.push(
        this.stellarMode
          ? new StatBuff(
              cbs(this, isC6 ? "C2/C6" : "C2", ["E"]),
              { receiver, filter: { reactions: ["stellarSwirl"] } },
              [{ key: "reactionCd", value: 0.6 }]
            )
          : new StatBuff(
              cbs(this, isC6 ? "C2/C6" : "C2", ["E"]),
              { receiver, filter: { elements: ["Hydro", "Cryo"] } },
              [{ key: "cd", value: 0.5 }]
            )
      );
    }

    // C1: every heal grants flat ATK worth 0.7% of Vodyanitsa's Max HP.
    if (this.constellation >= 1) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C1", ["heal"]),
          { receiver: "team" },
          [],
          "hp",
          "atk",
          0.007
        )
      );
    }

    // C4: healing a target above 40% HP grants Vodyanitsa +20% Max HP,
    // 3 stacks. (The below-40% branch is a healing bonus only.)
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["heal"]), { receiver: "self" }, [
          { key: "hp%", value: 0.6 },
        ])
      );
    }

    // C6: during the microphone summon the party's Stellar Swirl DMG is
    // elevated and their Hydro/Cryo DMG is boosted.
    if (isC6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "team", filter: { reactions: ["stellarSwirl"] } },
          [{ key: "elevated%", value: 0.25 }]
        ),
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "team", filter: { elements: ["Hydro", "Cryo"] } },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
    }

    return buffs;
  })();

  // Off-field support rotation: E (microphone field) > Q.
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "vodyanitsa-skill", count: 1 },
      // 16s duration / 3s summon interval ≈ 5 microphones; C2 extends the
      // summon window by 9s → 3 more.
      { id: "vodyanitsa-mic", count: 5, bonus: [{ minC: 2, delta: 3 }] },
      { id: "vodyanitsa-burst", count: 1 },
    ];
  }

  protected readonly formulaMap = (() => {
    // Catalyst user — every Normal/Charged/Plunging Attack is Hydro (S10),
    // and the talent text spells out Hydro for the plunge impact as well.
    // The NA rows carry no "Max HP" annotation, so they scale off ATK while
    // the E/Q rows scale off Max HP.
    const hydroNormal = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const hydroCharge = {
      element: "Hydro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const hydroPlunge = {
      element: "Hydro" as const,
      ability: "plunge" as const,
      reaction: "none" as const,
    };
    const hydroSkill = {
      element: "Hydro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const hydroBurst = {
      element: "Hydro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    return {
      "vodyanitsa-normal": {
        label: { zh: "普通攻击", en: "Normal Attack" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), hydroNormal) },
          { formula: new DirectFormula(this.param("A", 2), hydroNormal) },
          { formula: new DirectFormula(this.param("A", 3), hydroNormal) },
          { formula: new DirectFormula(this.param("A", 4), hydroNormal) },
        ],
      },
      "vodyanitsa-charge": {
        label: { zh: "重击", en: "Charged Attack" },
        parts: [
          { formula: new DirectFormula(this.param("A", 5), hydroCharge) },
        ],
      },
      // The Charged Attack Stamina Cost row carries no param, so param6 is the
      // during-fall DMG and param7/param8 are the low/high impact rows. Only
      // the high-impact row is modeled — the during-fall and low-impact rows
      // are intentionally left out.
      "vodyanitsa-plunge-high": {
        label: { zh: "下落·高", en: "Plunge High" },
        parts: [
          { formula: new DirectFormula(this.param("A", 8), hydroPlunge) },
        ],
      },
      "vodyanitsa-skill": {
        label: { zh: "E水妖序曲", en: "E Overture" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), hydroSkill, "hp") },
        ],
      },
      "vodyanitsa-mic": {
        label: { zh: "麦克风伤害", en: "Microphone DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), hydroSkill, "hp"),
            offField: true,
          },
        ],
      },
      "vodyanitsa-burst": {
        label: { zh: "Q水妖咏叹调", en: "Q Aria" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), hydroBurst, "hp") },
        ],
      },
    };
  })();
}
