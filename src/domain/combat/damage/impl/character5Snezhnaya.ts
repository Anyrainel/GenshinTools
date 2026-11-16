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
import type { TeamMeta } from "../core/teamMeta";
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

const danicaOption = {
  label: { zh: "侍者形态", en: "Maid Form" },
  choices: [
    {
      value: "battle",
      label: { zh: "女仆·清扫者", en: "Battle Maid" },
    },
    {
      value: "defense",
      label: { zh: "女仆·御前护卫", en: "Defense Maid" },
      when: (tm) => tm.characters.length >= 2,
    },
    {
      value: "opener",
      label: { zh: "C2战斗开场", en: "C2 Combat Opener" },
      when: (tm) => (tm.constellations.danica ?? 0) >= 2,
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("danica", danicaOption)
class Danica extends CharacterBase {
  private readonly state = resolveOption(
    danicaOption,
    this.option,
    this.teamMeta
  );
  private readonly defense = this.state === "defense";
  private readonly opening = this.state === "opener";
  private readonly radianceOn =
    this.teamMeta.getRadianceState(this.charId) === "stellarConduct";
  private readonly hasCoordinatedTrigger = Object.entries(
    this.teamMeta.elements
  ).some(
    ([id, element]) =>
      id !== this.charId && (element === "Cryo" || element === "Electro")
  );

  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      new StatBuff(
        cbs(this, "P1", ["E"]),
        {
          receiver: "team",
          filter: { elements: ["Electro"] },
        },
        [{ key: "resReduction%", value: this.radianceOn ? 0.3 : 0.15 }]
      ),
      // 7.2.51 ZH grants 0.7% per 100 ATK. EN still says per point.
      new ScalingBuff(
        cbs(this, "P3", []),
        {
          receiver: "team",
          filter: { reactions: ["stellarConduct"] },
        },
        [],
        "atk",
        "reactionBaseDmg%",
        0.00007,
        0.14
      ),
      new StatBuff(cbs(this, "P2", ["E"]), { receiver: "self" }, [
        // Only the On-Field E2 effects stack to three in 7.2.51 ZH.
        {
          key: this.defense ? "atk%" : "atkSpd%",
          value: this.defense ? 0.2 : 0.6,
        },
      ]),
    ];
    if (this.teamMeta.hasPolestarField()) {
      buffs.push(
        new StatBuff(
          cbs(this, "P3", ["stellarConduct"]),
          {
            receiver: "team",
            filter: { elements: ["Cryo", "Electro"] },
          },
          [{ key: "polestarField", value: 1 }]
        )
      );
    }
    if (this.radianceOn) {
      buffs.push(
        new StatBuff(
          cbs(this, "P1", ["E"]),
          {
            receiver: "team",
            filter: { elements: ["Cryo"] },
          },
          [{ key: "resReduction%", value: 0.3 }]
        )
      );
      if (this.defense) {
        const c1 = this.constellation >= 1 ? 2 : 1;
        buffs.push(
          new ScalingBuff(
            cbs(this, "Q", ["E", "Q"]),
            { receiver: "team" },
            [],
            "atk",
            "atk",
            this.param("Q", 6) * c1,
            this.param("Q", 7) * c1
          )
        );
      }
    }
    if (this.constellation >= 2) {
      // 7.2.52 ZH grants ten stacks per character. Cleaner's two-stack
      // consumption is budgeted across its Purge and Burst entries below.
      for (const charId of this.teamMeta.characters) {
        const cleaner = !this.defense && charId === this.charId;
        if (cleaner && this.opening) continue;
        buffs.push(
          new ScalingBuff(
            { ...cbs(this, "C2", ["E"]), maxStacks: cleaner ? 5 : 10 },
            {
              receiver: "team",
              charId,
              filter: { reactions: ["stellarConduct"] },
            },
            [],
            "atk",
            "baseDmg",
            cleaner ? 3.5 : 0.8
          )
        );
      }
    }
    if (this.constellation >= 6) {
      // ZH says 擢升 (Elevation); EN's generic DMG wording is less precise.
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          {
            receiver: "team",
            filter: { reactions: ["stellarConduct"] },
          },
          [{ key: "elevated%", value: 0.15 }]
        )
      );
      if (this.defense) {
        buffs.push(
          new ScalingBuff(
            cbs(this, "C6", ["E"]),
            {
              receiver: "teamOnField",
              filter: { reactions: ["stellarConduct"] },
            },
            [],
            "atk",
            "reactionDmg%",
            0.0001,
            0.4
          )
        );
      }
    }
    return buffs;
  })();

  protected override get comboDescriptor(): ComboTemplate {
    if (this.opening)
      return [
        { id: "danica-c2-entry", count: 1 },
        { id: "danica-c2-purge", count: 1 },
      ];
    if (this.defense)
      return [
        { id: "danica-skill", count: 1 },
        // Before choosing a form, four Anchor stages fill 100 Excitement.
        // With no Cryo/Electro teammate this is the only Defense-entry path;
        // after entry, Defense prevents repeating the own-normal precharge.
        ...(!this.hasCoordinatedTrigger
          ? [1, 2, 3, 4].map((stage) => ({
              id: `danica-anchor-n${stage}`,
              count: 1,
            }))
          : []),
        { id: "danica-entry", count: 1 },
        { id: "danica-burst", count: 1 },
        // A refreshed Anchor lasts 25s: floor(25 / 1.5) coordinated attacks.
        {
          id: "danica-coordinated",
          count: this.hasCoordinatedTrigger ? 16 : 0,
        },
      ];
    // Four stages initially grant 100 Excitement. After E2 #1, N2+N3
    // supply 100; after #2, N3+N4 supply 150; then each N4 supplies 100.
    // N3's two damage hits grant Excitement only once per normal stage.
    // Five E2 uses destroy the Anchor. Q's instant refill is not needed by
    // this conservative rotation; peak buffs assume the enhanced form.
    return [
      { id: "danica-skill", count: 1 },
      { id: "danica-anchor-n1", count: 1 },
      { id: "danica-anchor-n2", count: 2 },
      { id: "danica-anchor-n3", count: 3 },
      { id: "danica-anchor-n4", count: 4 },
      { id: "danica-e2-first", count: 1 },
      { id: "danica-burst", count: 1 },
      { id: "danica-e2-battle", count: 4 },
    ];
  }

  protected readonly formulaMap = (() => {
    const normal: DamageTag = {
      element: "Physical",
      ability: "normal",
      reaction: "none",
    };
    const anchor: DamageTag = { ...normal, element: "Electro" };
    const skill: DamageTag = {
      element: "Electro",
      ability: "skill",
      reaction: "none",
    };
    const stellarSkill: DamageTag = { ...skill, reaction: "stellarConduct" };
    const burst: DamageTag = {
      element: "Electro",
      ability: "burst",
      reaction: "none",
    };
    const battleBuffs: StatBuff[] = [];
    // Only Purge receives C6 CRIT, even when opening Protect is selected
    // alongside a Cleaner rotation. These buffs have no Toast stack limit.
    const purgeCrit =
      this.constellation >= 6 && !this.defense
        ? (
            [
              ["reactionCr", 0.00005, 0.1],
              ["reactionCd", 0.0005, 1],
            ] as const
          ).map(
            ([key, scale, cap]) =>
              new ScalingBuff(
                cbs(this, "C6", ["E"]),
                {
                  receiver: "selfOnField",
                  filter: {
                    abilities: ["skill"],
                    reactions: ["stellarConduct"],
                  },
                },
                [],
                "atk",
                key,
                scale,
                cap
              )
          )
        : [];
    if (this.radianceOn)
      battleBuffs.push(
        new StatBuff(
          cbs(this, "Q", ["E", "Q"]),
          { receiver: "self", filter: { reactions: ["stellarConduct"] } },
          [
            {
              key: "reactionDmg%",
              value: this.param("Q", 8) * (this.constellation >= 1 ? 2.2 : 1),
            },
          ]
        )
      );
    // Per-part scopes keep Q's damage bonus exclusive to On-Field E2.
    return {
      // The active Anchor replaces NAs and prevents CA/plunge. Keep these
      // base actions for use outside the Anchor window.
      "danica-normal": {
        label: { zh: "普攻四段（无锚）", en: "N4 (Without Anchor)" },
        parts: [1, 2, 3, 4].map((i) => ({
          formula: new DirectFormula(this.param("A", i), normal),
          hits: i === 3 ? 2 : 1,
        })),
      },
      "danica-charge": {
        label: { zh: "重击循环（无锚）", en: "CA Cycle (No Anchor)" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 5), {
              ...normal,
              ability: "charge",
            }),
          },
        ],
      },
      "danica-charge-final": {
        label: { zh: "重击终结（无锚）", en: "CA End (No Anchor)" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 6), {
              ...normal,
              ability: "charge",
            }),
          },
        ],
      },
      "danica-plunge-high": {
        label: { zh: "高空下落（无锚）", en: "Plunge (No Anchor)" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 9), {
              ...normal,
              ability: "plunge",
            }),
          },
        ],
      },
      "danica-skill": {
        label: { zh: "涤尘准锚·施放", en: "E Initial Hit" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), skill) }],
      },
      "danica-entry": {
        label: { zh: "护持之志", en: "Entry Skill E2" },
        when: this.defense,
        parts: [
          {
            formula: new StellarDirectFormula(this.param("E", 2), stellarSkill),
          },
        ],
      },
      "danica-e2-first": {
        label: { zh: "荡除之志·首次", en: "On-Field E2 (First)" },
        when: !this.defense && !this.opening,
        parts: [
          {
            formula: new StellarDirectFormula(this.param("E", 3), stellarSkill),
            bespokeBuffs: [...battleBuffs, ...purgeCrit],
          },
        ],
      },
      "danica-e2-battle": {
        label: { zh: "荡除之志·后续", en: "On-Field E2 (Later)" },
        when: !this.defense && !this.opening,
        parts: [
          {
            formula: new StellarDirectFormula(this.param("E", 3), stellarSkill),
            bespokeBuffs: [...battleBuffs, ...purgeCrit],
          },
        ],
      },
      "danica-coordinated": {
        label: { zh: "准雷定锚协同攻击", en: "Anchor Coordinated Attack" },
        // Swapping out can trigger the Anchor in either form while it lasts.
        when: this.hasCoordinatedTrigger,
        parts: [
          {
            formula: new DirectFormula(this.param("E", 4), skill),
            offField: true,
          },
        ],
      },
      // Optional once-per-combat opener. These are separate actions from the
      // ordinary Purge; existing authored rotations keep their action units.
      "danica-c2-entry": {
        label: { zh: "C2开场·护持之志", en: "C2 Combat Entry: Protect" },
        minC: 2,
        when: this.opening,
        parts: [
          {
            formula: new StellarDirectFormula(this.param("E", 2), stellarSkill),
            // Defense's regular pool already supplies ordinary one-stack Toast.
            bespokeBuffs: !this.defense
              ? [
                  new ScalingBuff(
                    cbs(this, "C2", ["E"]),
                    {
                      receiver: "self",
                      filter: { reactions: ["stellarConduct"] },
                    },
                    [],
                    "atk",
                    "baseDmg",
                    0.8
                  ),
                ]
              : [],
          },
        ],
      },
      "danica-c2-purge": {
        label: { zh: "C2清扫御令·荡除之志", en: "C2 Cleaning Order: Purge" },
        minC: 2,
        when: this.opening,
        parts: [
          {
            formula: new StellarDirectFormula(this.param("E", 3), stellarSkill),
            bespokeBuffs: [
              ...purgeCrit,
              // This once-per-combat long-press Purge explicitly resets Toast.
              new ScalingBuff(
                cbs(this, "C2", ["E"]),
                { receiver: "self", filter: { reactions: ["stellarConduct"] } },
                [],
                "atk",
                "baseDmg",
                3.5
              ),
              new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
                { key: "baseDmg%", value: 0.5 },
              ]),
            ],
          },
        ],
      },
      ...Object.fromEntries(
        [7, 8, 9, 10].map((param, i) => [
          `danica-anchor-n${i + 1}`,
          {
            label: { zh: `准雷定锚·${i + 1}段`, en: `Anchor Normal N${i + 1}` },
            parts: [
              {
                formula: new DirectFormula(this.param("E", param), anchor),
                hits: i === 2 ? 2 : 1,
              },
            ],
          },
        ])
      ),
      "danica-burst": {
        label: { zh: "净世卫仪", en: "Q Five-Hit Attack" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), burst) },
          { formula: new DirectFormula(this.param("Q", 3), burst), hits: 3 },
          { formula: new DirectFormula(this.param("Q", 4), burst) },
          ...(this.radianceOn
            ? [2, 5].map((param) => ({
                formula: new StellarDirectFormula(this.param("Q", param), {
                  ...burst,
                  reaction: "stellarConduct",
                }),
              }))
            : []),
        ],
      },
    };
  })();
}

const anastasyaOption = {
  label: { zh: "加护与封存", en: "Blessing and Sealing" },
  choices: ["love", "honor"].flatMap((form) =>
    ["sealed", "unsealed"].map((sealing) => ({
      value: `${form}-${sealing}`,
      label: {
        zh: `${form === "love" ? "慈爱" : "荣耀"} / ${sealing === "sealed" ? "荣勋均分" : "未封存"}`,
        en: `${form === "love" ? "Love" : "Honor"} / ${sealing === "sealed" ? "Shared Accolades" : "Unsealed"}`,
      },
      when: (tm: TeamMeta) => sealing !== "sealed" || tm.characters.length > 1,
    }))
  ),
} satisfies OptionDef;

@RegisterCharacter("anastasya", anastasyaOption)
class Anastasya extends CharacterBase {
  private readonly state = resolveOption(
    anastasyaOption,
    this.option,
    this.teamMeta
  );
  private readonly love = this.state.startsWith("love-");
  private readonly radiance = this.teamMeta.getRadianceState(this.charId);
  private readonly sealed = this.state.endsWith("-sealed");
  private readonly stellarReaction =
    this.radiance === "stellarSwirl" ? "stellarSwirl" : "stellarConduct";
  private readonly accoladeScale = this.constellation >= 4 ? 1.3 : 1;

  readonly buffs = (() => {
    const buffs: StatBuff[] = [
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
      // This changes the inherent Swirl reaction coefficient, independently
      // of P3's reaction base-DMG bonus and the direct talent multipliers.
      new StatBuff(
        cbs(this, "P2", []),
        {
          receiver: "team",
          filter: { reactions: ["stellarSwirl"] },
        },
        [{ key: "reactionCoeff%", value: 0.1 }]
      ),
    ];
    if (this.teamMeta.hasPolestarField())
      buffs.push(
        new StatBuff(
          cbs(this, "P3", ["stellarConduct"]),
          {
            receiver: "team",
            filter: { elements: ["Cryo", "Electro"] },
          },
          [{ key: "polestarField", value: 1 }]
        )
      );
    // P2 raises newly created Vortices to level 2, which the reaction engine
    // already uses for peak damage. 7.2.52 still gives no Polestar enhancement value.
    const count = this.teamMeta.characters.length;
    for (const charId of this.teamMeta.characters) {
      const isSelf = charId === this.charId;
      const donor = this.sealed && (this.love ? isSelf : !isSelf);
      let accolades = donor && this.constellation < 1 ? 0 : 1;
      if (this.sealed && this.love && !isSelf)
        accolades += this.constellation >= 1 ? 3 : 1 / (count - 1);
      if (this.sealed && !this.love && isSelf) accolades += count - 1;
      if (accolades === 0) continue;
      const magnitude = accolades * this.accoladeScale;
      const entries = [{ key: "cd" as const, value: 0.12 * magnitude }];
      buffs.push(
        new StatBuff(
          cbs(this, this.constellation >= 4 ? "P1/C4" : "P1", [
            "E",
            ...(this.sealed ? ["Q"] : []),
          ]),
          { receiver: "team", charId },
          entries
        )
      );
      if (this.constellation >= 1)
        buffs.push(
          new StatBuff(
            cbs(this, this.constellation >= 4 ? "C1/C4" : "C1", [
              "E",
              ...(this.sealed ? ["Q"] : []),
            ]),
            { receiver: "team", charId },
            [
              {
                key: this.teamMeta.elements[charId] === "Cryo" ? "atk%" : "em",
                value:
                  (this.teamMeta.elements[charId] === "Cryo" ? 0.15 : 60) *
                  magnitude,
              },
            ]
          )
        );
    }
    if (this.love)
      buffs.push(
        new StatBuff(
          cbs(this, "Q", ["Q"]),
          {
            receiver: "team",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [{ key: "reactionDmg%", value: this.param("Q", 2) }]
        )
      );
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", []),
          {
            receiver: "team",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [{ key: "elevated%", value: 0.05 }]
        )
      );
      if (this.love)
        buffs.push(
          new StatBuff(
            cbs(this, "C2", ["E"]),
            {
              receiver: "team",
              filter: { reactions: ["stellarConduct", "stellarSwirl"] },
            },
            [{ key: "reactionCd", value: 0.5 }]
          )
        );
    }
    if (this.constellation >= 6 && this.love)
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          {
            receiver: "team",
            filter: { reactions: ["stellarConduct", "stellarSwirl"] },
          },
          [{ key: "elevated%", value: 0.1 }]
        )
      );
    return buffs;
  })();

  protected override get comboDescriptor(): ComboTemplate {
    if (this.love)
      return [
        { id: "anastasya-e-tap", count: 1 },
        { id: "anastasya-q-love", count: 1 },
        // During the 20s Love burst, the frozen Crown attacks every 2s.
        { id: "anastasya-crown", count: 10 },
        { id: "anastasya-triumph", count: 1 },
        {
          id: "anastasya-c6-triumph",
          count: 0,
          bonus: [{ minC: 6, delta: 1 }],
        },
      ];
    // The source provides no animation timings. Two full N5 chains are a
    // conservative editable starter during the 14s Honor burst, not a DPS cap.
    return [
      { id: "anastasya-e-hold", count: 1 },
      { id: "anastasya-q-honor", count: 1 },
      ...[1, 2, 3, 4, 5].map((i) => ({
        id: `anastasya-honor-n${i}`,
        count: 2,
      })),
      { id: "anastasya-doom-1", count: 1 },
      { id: "anastasya-doom-2", count: 1 },
      { id: "anastasya-doom-3", count: 1 },
      { id: "anastasya-c6-doom", count: 0, bonus: [{ minC: 6, delta: 1 }] },
    ];
  }

  protected readonly formulaMap = (() => {
    const normal: DamageTag = {
      element: "Physical",
      ability: "normal",
      reaction: "none",
    };
    const cryoNormal: DamageTag = { ...normal, element: "Cryo" };
    const skill: DamageTag = {
      element: "Cryo",
      ability: "skill",
      reaction: "none",
    };
    const burst: DamageTag = { ...skill, ability: "burst" };
    const stellarSkill: DamageTag = {
      ...skill,
      reaction: this.stellarReaction,
    };
    const stellarBurst: DamageTag = {
      ...burst,
      reaction: this.stellarReaction,
    };
    const reaction = this.radiance !== null;
    const c2Honor =
      !this.love && this.constellation >= 2
        ? [
            new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
              { key: "baseDmg%", value: 0.25 },
            ]),
          ]
        : [];
    const c6Honor =
      !this.love && this.constellation >= 6
        ? [
            new StatBuff(
              cbs(this, "C6", ["E"]),
              {
                receiver: "self",
                filter: { reactions: ["stellarConduct", "stellarSwirl"] },
              },
              [{ key: "elevated%", value: 0.2 }]
            ),
          ]
        : [];
    // 7.2.52 ZH places Honor's Elevation after the seal-expiry clause;
    // it lasts through the ordinary Doom sequence as well.
    const normalBuffs = [...c2Honor, ...c6Honor];
    const c6Accolades =
      this.constellation >= 6 && !this.sealed
        ? [
            new StatBuff(cbs(this, "C6", ["E"]), { receiver: "self" }, [
              {
                key: "cd",
                value:
                  0.12 *
                  (this.teamMeta.characters.length - 1) *
                  this.accoladeScale,
              },
              {
                key: "atk%",
                value:
                  0.15 *
                  (this.teamMeta.characters.length - 1) *
                  this.accoladeScale,
              },
            ]),
          ]
        : [];
    return {
      "anastasya-normal": {
        label: { zh: "普通攻击五段", en: "Normal Attack (N5)" },
        parts: [1, 2, 3, 4, 5].map((i) => ({
          formula: new DirectFormula(this.param("A", i), normal),
          hits: i === 3 ? 2 : i === 4 ? 3 : 1,
        })),
      },
      "anastasya-charge": {
        label: { zh: "满蓄力瞄准射击", en: "Charged Aimed Shot" },
        when: this.love,
        parts: [
          {
            formula: new DirectFormula(this.param("A", 7), {
              ...cryoNormal,
              ability: "charge",
            }),
          },
        ],
      },
      "anastasya-plunge-high": {
        label: { zh: "下落·高", en: "High Plunge" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 10), {
              ...normal,
              ability: "plunge",
            }),
          },
        ],
      },
      "anastasya-e-tap": {
        label: { zh: "E点按瞬时伤害", en: "E Tap Initial Hit" },
        when: this.love,
        parts: [{ formula: new DirectFormula(this.param("E", 1), skill) }],
      },
      "anastasya-e-hold": {
        label: { zh: "E长按瞬时伤害", en: "E Hold Initial Hit" },
        when: !this.love,
        parts: [{ formula: new DirectFormula(this.param("E", 2), skill) }],
      },
      "anastasya-crown": {
        label: { zh: "苍星圣冕·爆发期间", en: "Crown (During Burst)" },
        when: this.love,
        parts: [
          {
            formula: new DirectFormula(this.param("E", 3), skill),
            hits: reaction ? 1 : 2,
            offField: true,
          },
          ...(reaction
            ? [
                {
                  formula: new StellarDirectFormula(
                    this.param(
                      "E",
                      this.stellarReaction === "stellarSwirl" ? 5 : 4
                    ),
                    stellarSkill
                  ),
                  offField: true,
                },
              ]
            : []),
          {
            formula: new StellarDirectFormula(
              this.param("Q", this.stellarReaction === "stellarSwirl" ? 4 : 3),
              stellarSkill
            ),
            offField: true,
          },
        ],
      },
      ...Object.fromEntries(
        [1, 2, 3, 4, 5].map((stage) => {
          const hits = stage === 2 ? 2 : stage >= 4 ? 3 : 1;
          return [
            `anastasya-honor-n${stage}`,
            {
              label: {
                zh: `圣佑之枪·${stage}段`,
                en: `Blessed Spear N${stage}`,
              },
              when: !this.love,
              parts: [
                ...(!reaction || hits > 1
                  ? [
                      {
                        formula: new DirectFormula(
                          this.param("E", stage + 5),
                          cryoNormal
                        ),
                        hits: hits - (reaction ? 1 : 0),
                        bespokeBuffs: normalBuffs,
                      },
                    ]
                  : []),
                ...(reaction
                  ? [
                      {
                        formula: new StellarDirectFormula(
                          this.param(
                            "E",
                            9 +
                              stage * 2 +
                              (this.stellarReaction === "stellarSwirl" ? 1 : 0)
                          ),
                          { ...cryoNormal, reaction: this.stellarReaction }
                        ),
                        bespokeBuffs: normalBuffs,
                      },
                    ]
                  : []),
              ],
            },
          ];
        })
      ),
      "anastasya-q-love": {
        label: { zh: "Q致新世界", en: "Q To the New World" },
        when: this.love,
        parts: [{ formula: new DirectFormula(this.param("Q", 1), burst) }],
      },
      "anastasya-q-honor": {
        label: { zh: "Q永夜将明", en: "Q Evernight to Dawn" },
        when: !this.love,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param("Q", this.stellarReaction === "stellarSwirl" ? 8 : 7),
              stellarBurst
            ),
            bespokeBuffs: normalBuffs,
          },
        ],
      },
      "anastasya-triumph": {
        label: { zh: "苍星圣敕·凯旋", en: "Edict: Triumph" },
        when: this.love && this.teamMeta.characters.length > 1,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param("Q", this.stellarReaction === "stellarSwirl" ? 6 : 5),
              stellarSkill
            ),
          },
        ],
      },
      "anastasya-doom-1": {
        label: { zh: "苍星圣敕·裁灭一段", en: "Edict: Doom I" },
        when: !this.love && this.teamMeta.characters.length > 1,
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 9), skill),
            hits: 5,
            bespokeBuffs: normalBuffs,
          },
          {
            formula: new StellarDirectFormula(
              this.param(
                "Q",
                this.stellarReaction === "stellarSwirl" ? 11 : 10
              ),
              stellarSkill
            ),
            bespokeBuffs: normalBuffs,
          },
        ],
      },
      "anastasya-doom-2": {
        label: { zh: "苍星圣敕·裁灭二段", en: "Edict: Doom II" },
        when: !this.love && this.teamMeta.characters.length > 1,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param(
                "Q",
                this.stellarReaction === "stellarSwirl" ? 13 : 12
              ),
              stellarSkill
            ),
            bespokeBuffs: normalBuffs,
          },
        ],
      },
      "anastasya-doom-3": {
        label: { zh: "苍星圣敕·裁灭三段", en: "Edict: Doom III" },
        when: !this.love && this.teamMeta.characters.length > 1,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param(
                "Q",
                this.stellarReaction === "stellarSwirl" ? 15 : 14
              ),
              stellarSkill
            ),
            bespokeBuffs: normalBuffs,
          },
        ],
      },
      "anastasya-c6-triumph": {
        label: { zh: "C6切人·凯旋", en: "C6 Switch-In Triumph" },
        minC: 6,
        when: this.love && this.teamMeta.characters.length > 1,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param("Q", this.stellarReaction === "stellarSwirl" ? 6 : 5),
              stellarSkill
            ),
            offField: true,
            bespokeBuffs: [
              new StatBuff(cbs(this, "C6", ["E"]), { receiver: "self" }, [
                { key: "baseDmg%", value: 1 },
              ]),
            ],
          },
        ],
      },
      "anastasya-c6-doom": {
        label: { zh: "C6点按·裁灭三段", en: "C6 Tap Doom III" },
        minC: 6,
        when: !this.love,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param(
                "Q",
                this.stellarReaction === "stellarSwirl" ? 15 : 14
              ),
              stellarSkill
            ),
            bespokeBuffs: [
              ...normalBuffs,
              ...c6Accolades,
              new StatBuff(cbs(this, "C6", ["E"]), { receiver: "self" }, [
                { key: "baseDmg%", value: 1.5 },
              ]),
            ],
          },
        ],
      },
    };
  })();
}

const mityaOption = {
  label: { zh: "侦测炉心", en: "Energy Device" },
  choices: [
    {
      value: "collapse",
      label: { zh: "过载（站场重击）", en: "Collapse (Charged Attacks)" },
    },
    {
      value: "stable",
      label: { zh: "稳态（满递变信标）", en: "Stable (Maximum Prisms)" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("mitya", mityaOption)
class Mitya extends CharacterBase {
  private readonly stable =
    resolveOption(mityaOption, this.option) === "stable";
  private readonly prismCap = this.constellation >= 1 ? 5 : 4;
  // At C0, Q supplies only three Beacons. Without Stellar-Conduct generation,
  // their ten-second lifetime cannot bridge Q's fifteen-second cooldown.
  private readonly carriedPrisms =
    this.constellation === 0 && !this.teamMeta.hasReaction("stellarConduct")
      ? 3
      : this.prismCap;

  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // Peak model: four recently generated Prisms; P2 lasts after consumption.
      new StatBuff(cbs(this, "P2", ["E", "Q"]), { receiver: "self" }, [
        { key: "cr", value: 0.2 },
      ]),
      new ScalingBuff(
        cbs(this, "P3", []),
        { receiver: "team", filter: { reactions: ["stellarConduct"] } },
        [],
        "em",
        "reactionBaseDmg%",
        0.00028,
        0.14
      ),
      // Q creates three Prisms without a reaction; carried Prisms create a
      // Polestar Field according to the ZH glossary.
      new StatBuff(
        cbs(this, "Q/P3", ["Q"]),
        { receiver: "team", filter: { elements: ["Cryo", "Electro"] } },
        [{ key: "polestarField", value: 1 }]
      ),
    ];
    if (this.stable) {
      buffs.push(
        new StatBuff(cbs(this, "P1", ["E"]), { receiver: "team" }, [
          { key: "em", value: 30 * this.carriedPrisms },
        ])
      );
    }
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(cbs(this, "C1", ["E"]), { receiver: "teamOnField" }, [
          { key: "cd", value: 0.4 },
        ])
      );
    }
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "team", filter: { elements: ["Cryo", "Electro"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: this.stable ? "team" : "teamOnField" },
          [{ key: "em", value: this.stable ? 123 : 234 }]
        )
      );
    }
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", []),
          { receiver: "team", filter: { reactions: ["stellarConduct"] } },
          [{ key: "elevated%", value: 0.2 }]
        )
      );
    }
    return buffs;
  })();

  protected override get comboDescriptor(): ComboTemplate {
    // Collapse starter: Q supplies three Prisms and E supplies one at C1.
    // Stable mode uses the attainable carried-Prism count for its single
    // device replacement explosion. Recasting E consumes the carried Prisms
    // while a device exists, satisfying C4's device-presence condition.
    // Reaction-generated Prisms and C6 random refunds
    // depend on the team's rotation; users can edit the per-hit counts.
    return this.stable
      ? [
          { id: "mitya-e-tap", count: 1 },
          { id: "mitya-burst", count: 1 },
          { id: "mitya-stable-pulse", count: 1 },
          { id: "mitya-prism-shatter", count: 1 },
          // At C4 the capped shatter consumes five Prisms, triggering C4 once.
          { id: "mitya-c4", count: 0, bonus: [{ minC: 4, delta: 1 }] },
        ]
      : [
          { id: "mitya-e-hold", count: 1 },
          { id: "mitya-burst", count: 1 },
          { id: "mitya-prism-detonation", count: 1 },
          {
            id: "mitya-prism-consume",
            count: 3,
            bonus: [{ minC: 1, delta: 1 }],
          },
        ];
  }

  protected readonly formulaMap = (() => {
    const normal: DamageTag = {
      element: "Electro",
      ability: "normal",
      reaction: "none",
    };
    const charge: DamageTag = {
      element: "Electro",
      ability: "charge",
      reaction: "none",
    };
    const skill: DamageTag = {
      element: "Electro",
      ability: "skill",
      reaction: "none",
    };
    const stellarSkill: DamageTag = { ...skill, reaction: "stellarConduct" };
    // C6: only the steady Core's own damage deals 115% of original damage.
    // Keep this in the base-damage zone, separate from the party's Elevation.
    const coreBuffs =
      this.stable && this.constellation >= 6
        ? [
            new StatBuff(cbs(this, "C6", ["E"]), { receiver: "self" }, [
              { key: "baseDmg%", value: 0.15 },
            ]),
          ]
        : [];
    return {
      "mitya-normal": {
        label: { zh: "普通攻击三段", en: "Normal Attack (N3)" },
        parts: [1, 2, 3].map((i) => ({
          formula: new DirectFormula(this.param("A", i), normal),
        })),
      },
      "mitya-charge": {
        label: { zh: "普通重击", en: "Charged Attack" },
        parts: [{ formula: new DirectFormula(this.param("A", 4), charge) }],
      },
      "mitya-plunge-high": {
        label: { zh: "下落·高", en: "High Plunge" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 8), {
              element: "Electro",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      "mitya-prism-detonation": {
        label: { zh: "递变聚爆·首击", en: "Detonation First Hit" },
        when: !this.stable,
        parts: [{ formula: new DirectFormula(this.param("A", 9), charge) }],
      },
      "mitya-prism-consume": {
        label: { zh: "递变聚爆·每枚信标", en: "Detonation Per Prism" },
        when: !this.stable,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param("A", 10),
              { ...charge, reaction: "stellarConduct" },
              "em"
            ),
          },
        ],
      },
      "mitya-e-tap": {
        label: { zh: "E短按", en: "E Tap" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), skill) }],
      },
      "mitya-e-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [{ formula: new DirectFormula(this.param("E", 2), skill) }],
      },
      "mitya-stable-pulse": {
        label: { zh: "稳态炉心·每次伤害", en: "Stabilizer Pulse" },
        when: this.stable,
        parts: [
          {
            formula: new DirectFormula(this.param("E", 3), skill),
            offField: true,
            bespokeBuffs: coreBuffs,
          },
        ],
      },
      "mitya-prism-surge": {
        label: { zh: "稳态炉心·溢出信标", en: "Prism Surge" },
        when: this.stable && this.carriedPrisms >= this.prismCap,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param("E", 4),
              stellarSkill,
              "em"
            ),
            offField: true,
            bespokeBuffs: coreBuffs,
          },
        ],
      },
      "mitya-prism-shatter": {
        label: { zh: "稳态炉心·信标引爆", en: "Core Beacon Detonation" },
        when: this.stable,
        parts: [
          {
            formula: new StellarDirectFormula(
              this.param("E", 5) * this.carriedPrisms,
              stellarSkill,
              "em"
            ),
            offField: true,
            bespokeBuffs: coreBuffs,
          },
        ],
      },
      "mitya-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Electro", ability: "burst", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("Q", 2) }
            ),
          },
        ],
      },
      "mitya-c4": {
        label: { zh: "C4炉心追加伤害", en: "C4 Device Proc" },
        minC: 4,
        parts: [
          {
            formula: new StellarDirectFormula(3, stellarSkill, "em"),
            offField: this.stable,
            bespokeBuffs: coreBuffs,
          },
        ],
      },
    };
  })();
}

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
    new StatBuff(cbs(this, "P3", ["in-combat"]), { receiver: "self" }, [
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

@RegisterCharacter("sandrone")
class Sandrone extends CharacterBase {
  private readonly rState = this.teamMeta.getRadianceState(this.charId);

  private readonly radianceOn = this.rState !== null;

  // Peak model: max 10 Refined Tactics stacks consumed on burst (P1)
  private readonly refinedTacticsStacks = this.radianceOn ? 10 : 0;

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // Polestar Field: recorded applications grant 29%-40% ordinary
      // Cryo/Electro DMG Bonus. The marker lets Direct/Catalyze formulas resolve
      // the selected attach count from CalcContext; Stellar Direct ignores dmg%.
      ...(this.teamMeta.hasPolestarField()
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
    ];

    // P2 (ZH/U0b): EM = 8% ATK (cap 160) — no 辉映 gate
    buffs.push(
      new ScalingBuff(
        cbs(this, "P2", []),
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

@RegisterCharacter("odette")
class Odette extends CharacterBase {
  private readonly rState = this.teamMeta.getRadianceState(this.charId);

  readonly buffs = (() => {
    const maxSplendorStacks = this.constellation >= 1 ? 6 : 4;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      ...(this.teamMeta.hasPolestarField()
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
        cbs(this, "P1", ["E", "Q"]),
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
        new StatBuff(cbs(this, "C2", ["E", "Q"]), { receiver: "team" }, [
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
          cbs(this, "C6", ["E", "Q"]),
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

@RegisterCharacter("vesna")
class Vesna extends CharacterBase {
  // P3 only converts 冰元素扩散 → 星扩散; Vesna never unlocks Stellar-Conduct.
  private readonly radianceOn =
    this.teamMeta.getRadianceState(this.charId) === "stellarSwirl";

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P3: +0.7% Stellar Swirl base DMG per 100 ATK for the whole party, cap 14%.
      new ScalingBuff(
        cbs(this, "P3", []),
        { receiver: "team", filter: { reactions: ["stellarSwirl"] } },
        [],
        "atk",
        "reactionBaseDmg%",
        0.00007,
        0.14
      ),
    ];

    // P2 Truth Prevails: only active under 辉映·星扩散. Counts every party member
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
          new StatBuff(
            cbs(this, p2Origin, ["stellarSwirl"]),
            { receiver: "self" },
            [{ key: "atk%", value: cryoAnemo * 0.06 * p2Mult }]
          )
        );
      }
      if (otherElements > 0) {
        buffs.push(
          new StatBuff(
            cbs(this, p2Origin, ["stellarSwirl"]),
            { receiver: "self" },
            [{ key: "em", value: otherElements * 25 * p2Mult }]
          )
        );
      }
    }

    // C1: Vesna's own Stellar Swirl DMG +20% while Armed for Action.
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E"]),
          { receiver: "selfOnField", filter: { reactions: ["stellarSwirl"] } },
          [{ key: "reactionDmg%", value: 0.2 }]
        )
      );
    }

    // C2: Disciplinary Action is granted at max stacks on entering Armed for
    // Action, and being at max stacks additionally grants ATK +40%.
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.4 },
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
   * P1 Disciplinary Action — each stack makes a spirit blade deal "+10% of the original"
   * (cap 160% of the original) → `baseDmg%` +0.1 per stack. It covers only the
   * spirit blade / Stellar spirit blade hits, not Vesna's own strikes, the
   * Wind Pinion or the E cast, so it is attached per formula part instead
   * of as a tag-filtered self buff.
   *
   * Prydwen's combo guide places Q after Lv. 2 and gives it two prior-cast
   * stacks. Following that convention, Lv. 2 uses 1 and Lv. 3 uses 3/4/5
   * (6 for the extra C1 cast). Delayed skill-blade stack timing remains
   * unverified; "after using" alone does not establish the damage event order.
   * https://www.prydwen.gg/genshin-impact/characters/vesna
   *
   * At C2「进入巡风列装模式时，会获得最大层数的整肃」grants all 6 on entry,
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

  // Prydwen: E N1C E N1C E Q E N1C E N1C E; C1 adds one free Lv. 3.
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "vesna-skill", count: 1 },
      { id: "vesna-normal-1", count: 4, bonus: [{ minC: 6, delta: -3 }] },
      { id: "vesna-charge", count: 4, bonus: [{ minC: 6, delta: -3 }] },
      // Meropide: N1C summons 3 pinions; 12 give 2 Essence, plus E's 2 + Q's 1.
      // C6's first three Transposes supply 9 pinions, leaving one N1C (3).
      // https://meropide.cn/chs/characters/薇斯纳/theorycraft/
      { id: "vesna-feather", count: 12, bonus: [{ minC: 6, delta: -9 }] },
      { id: "vesna-blade-pierce", count: 1 },
      { id: "vesna-blade-plunge", count: 1 },
      { id: "vesna-burst", count: 1 },
      // E caps Lv. 3 at 3 casts per Armed for Action mode; C1 raises it to 4.
      { id: "vesna-blade-dance", count: 3, bonus: [{ minC: 1, delta: 1 }] },
      // C6 opens a 5s Transpose window after every Lv. 3, with no per-state cap
      // or cooldown of its own, so the count is one per dance — keep it in step
      // with "vesna-blade-dance" above (3 + 1 from C1, which any C6 account has).
      { id: "vesna-c6-tread", count: 0, bonus: [{ minC: 6, delta: 4 }] },
    ];
  }

  protected readonly formulaMap = (() => {
    // Armed for Action converts Vesna's Normal/Charged/Plunging Attacks
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

    // Lv. 3 is a single formula entry that the combo consumes 3 times (4 at
    // C1), so it cannot carry the 3/4/5(/6) per-cast Disciplinary Action counts. It takes
    // their mean instead, which is exact for the rotation total: `baseDmg%`
    // enters the damage as (1 + value), so summing across casts is linear in
    // the stack count and only the per-row split differs.
    const danceStacks = this.constellation >= 1 ? 4.5 : 4;
    const burstStacks = 2;

    return {
      "vesna-normal-1": {
        label: { zh: "普通攻击·一段", en: "Normal Attack: 1-Hit" },
        parts: [
          { formula: new DirectFormula(this.param("A", 1), anemoNormal) },
        ],
      },
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
      // Release data includes charged-attack stamina at param8, so param11
      // is the high-plunge impact coefficient.
      "vesna-plunge-high": {
        label: { zh: "下落·高", en: "Plunge High" },
        parts: [
          { formula: new DirectFormula(this.param("A", 11), anemoPlunge) },
        ],
      },
      "vesna-skill": {
        label: { zh: "E操典·制胜有道", en: "E The Art of Victory" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), anemoSkill) }],
      },
      "vesna-feather": {
        label: { zh: "风翎", en: "Wind Pinion" },
        parts: [
          { formula: new DirectFormula(this.param("E", 10), anemoSkill) },
        ],
      },
      // The release description and glossary explicitly summon Spirit Blades
      // at Lv. 2 and Lv. 3 only; Lv. 1 is Vesna's ordinary skill strike.
      "vesna-blade-pierce": {
        label: { zh: "翔风剑·一阶", en: "Windborne Sword Lv. 1" },
        parts: [{ formula: new DirectFormula(this.param("E", 2), anemoSkill) }],
      },
      "vesna-blade-plunge": {
        label: {
          zh: `翔风剑·二阶${suffix.zh}`,
          en: `Windborne Sword Lv. 2${suffix.en}`,
        },
        parts: [
          // Vesna's own strike receives no Disciplinary Action bonus.
          { formula: new DirectFormula(this.param("E", 3), anemoSkill) },
          {
            formula: on
              ? new StellarDirectFormula(this.param("E", 5), swSkill)
              : new DirectFormula(this.param("E", 4), anemoSkill),
            // Prior-cast approximation: Lv. 1 has granted one stack.
            bespokeBuffs: this.unruffled(1),
          },
        ],
      },
      "vesna-blade-dance": {
        label: {
          zh: `翔风剑·三阶${suffix.zh}`,
          en: `Windborne Sword Lv. 3${suffix.en}`,
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
          zh: `Q致礼·献予女皇陛下${suffix.zh}`,
          en: `Q For the Tsaritsa!${suffix.en}`,
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
        label: { zh: "C6翔风剑·变移", en: "C6 Transpose" },
        minC: 6,
        parts: [
          // Vesna's own kick — 150% ATK Anemo, not a spirit blade.
          { formula: new DirectFormula(1.5, anemoSkill, "atk") },
          {
            // The spirit blade it drives (200% ATK) is explicitly covered by
            // Ascension Talent 1. C6 implies C2, so the stack count
            // passed here is always overridden by the max-on-entry branch.
            formula: on
              ? new StellarDirectFormula(2.0, swSkill, "atk")
              : new DirectFormula(2.0, anemoSkill, "atk"),
            bespokeBuffs: this.unruffled(6),
          },
          // Meropide: 3 pinions on each of the first 3 Transposes, none after
          // the last Lv. 3 ends stance. Average 9/4 preserves the action unit.
          {
            formula: new DirectFormula(this.param("E", 10), anemoSkill),
            hits: 9 / 4,
          },
        ],
      },
    };
  })();
}

const vodyanitsaOption = {
  label: { zh: "受治疗角色生命值", en: "Healed Character HP" },
  choices: [
    { value: "high", label: { zh: "不低于40%", en: "40% or above" } },
    { value: "low", label: { zh: "低于40%", en: "Below 40%" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("vodyanitsa", vodyanitsaOption)
class Vodyanitsa extends CharacterBase {
  /**
   * P1 turns the party's 星辉风旋 into 「流荡风旋」 during her Elemental Skill,
   * and every 异化 clause in her kit ("若场上存在或最近存在过「流荡风旋」")
   * keys off those. Whether they exist is fully decided by the team being able
   * to produce Stellar Swirl, so there is no user-facing option here.
   */
  private readonly stellarMode = this.teamMeta.hasReaction("stellarSwirl");
  private readonly healedTargetLowHp =
    resolveOption(vodyanitsaOption, this.option, this.teamMeta) === "low";

  readonly buffs = (() => {
    const isC6 = this.constellation >= 6;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // E: the initial hit and Horn attacks shred Hydro and Cryo RES.
      new StatBuff(
        cbs(this, "E", ["E"]),
        { receiver: "team", filter: { elements: ["Hydro", "Cryo"] } },
        [{ key: "resReduction%", value: this.param("E", 8) }]
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

    // P2 + 领唱/重唱: flat DMG per 1000 Max HP above 40,000. 领唱 (25 stacks)
    // feeds the active character, 协奏 (10 stacks) the off-field ones. With
    // 「流荡风旋」 up both are 异化 into 星·独奏/星·协奏, which only boost
    // Stellar Swirl reactions but for a much larger amount.
    const scoreFilter: DamageTagFilter = this.stellarMode
      ? { reactions: ["stellarSwirl"] }
      : {
          elements: ["Hydro", "Cryo"],
          abilities: ["normal", "charge", "plunge", "skill", "burst"],
        };
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
        { ...cbs(this, "P2", ["E"]), maxStacks: 25 },
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
          [{ key: "resReduction%", value: 0.35 }]
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

    // C1: every heal grants flat ATK worth 0.8% of Vodyanitsa's Max HP.
    if (this.constellation >= 1) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C1", ["heal"]),
          { receiver: "team" },
          [],
          "hp",
          "atk",
          0.008
        )
      );
    }

    // C4: healing a target at or above 40% HP grants +20% Max HP per stack,
    // up to 3 stacks; below 40% instead increases that healing by 50%.
    if (this.constellation >= 4) {
      buffs.push(
        this.healedTargetLowHp
          ? new StatBuff(
              cbs(this, "C4", ["heal", "low-hp"]),
              { receiver: "self" },
              [{ key: "heal%", value: 0.5 }]
            )
          : new StatBuff(cbs(this, "C4", ["heal"]), { receiver: "self" }, [
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
          [{ key: "dmg%", value: 0.6 }]
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
      // Param6 is charged-attack stamina; param9 is high-plunge impact DMG.
      "vodyanitsa-plunge-high": {
        label: { zh: "下落·高", en: "Plunge High" },
        parts: [
          { formula: new DirectFormula(this.param("A", 9), hydroPlunge) },
        ],
      },
      "vodyanitsa-skill": {
        label: { zh: "E宣叙·晨声纷流", en: "E Sonorous Dawn" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), hydroSkill, "hp") },
        ],
      },
      "vodyanitsa-mic": {
        label: { zh: "唤春角笛伤害", en: "Spring's Call DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 4), hydroSkill, "hp"),
            offField: true,
          },
        ],
      },
      "vodyanitsa-burst": {
        label: { zh: "Q终奏·伴尔沉沦", en: "Q Sink With Thee" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), hydroBurst, "hp") },
        ],
      },
    };
  })();
}
