import { WeaponBase } from "../core/implModel";
import {
  createCharacter,
  RegisterWeapon,
  resolveOption,
} from "../core/registry";
import { ScalingBuff, StatBuff } from "../core/statBuff";
import type { TeamMeta } from "../core/teamMeta";
import type { OptionDef, OptionMap } from "../types";
import { r, wbs } from "./helpers";

@RegisterWeapon("torrents_of_spring")
class TorrentsOfSpring extends WeaponBase {
  readonly buffs: StatBuff[];

  constructor(
    weaponId: string,
    refinement: number,
    charId: string,
    teamMeta: TeamMeta,
    combatOpts: OptionMap = {}
  ) {
    super(weaponId, refinement, charId, teamMeta, combatOpts);
    const atk = r(refinement, [0.16, 0.2, 0.24, 0.28, 0.32]);
    const reactionDmg = r(refinement, [0.2, 0.25, 0.3, 0.35, 0.4]);
    const buffs = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "atk%", value: atk },
      ]),
    ];
    const character = createCharacter(
      charId,
      teamMeta.charLevels[charId] ?? 90,
      teamMeta.constellations[charId] ?? 0,
      teamMeta,
      combatOpts
    );
    // Inspect enabled own hits, preserving each kit's option/constellation
    // gates. Teammates' Electro attacks cannot grant the wearer a Decree.
    const tags = Object.keys(character.formulaIds).flatMap(
      (id) =>
        character.getFormulaEntry(id)?.parts.map((p) => p.formula.tag) ?? []
    );
    if (tags.some((tag) => tag.element === "Electro")) {
      // ZH beta: triggering Stellar-Conduct OR landing a Stellar-Conduct
      // attack completes the Decree; EN incorrectly requires an Electro SC hit.
      // Native SC attacks (e.g. Mitya's Prisms) need no Cryo teammate.
      const completed =
        teamMeta.hasReaction("stellarConduct", charId) ||
        tags.some((tag) => tag.reaction === "stellarConduct");
      buffs.push(
        new StatBuff(
          wbs(
            this,
            completed ? ["electro-hit", "stellarConduct"] : ["electro-hit"],
            "torrents-of-spring-decree"
          ),
          {
            receiver: "teamOnField",
            filter: { reactions: ["stellarConduct"] },
          },
          [{ key: "reactionDmg%", value: reactionDmg * (completed ? 2 : 1) }]
        )
      );
      if (completed) {
        buffs.push(
          new StatBuff(
            wbs(this, ["electro-hit", "stellarConduct"]),
            { receiver: "self" },
            [{ key: "atk%", value: atk }]
          )
        );
      }
    }
    this.buffs = buffs;
  }
}

@RegisterWeapon("a_thousand_blazing_suns")
class AThousandBlazingSuns extends WeaponBase {
  // Scorching Brilliance (E/Q triggers), +75% if wielder is in Nightsoul's Blessing
  get buffs() {
    const isNightsoul = this.teamMeta.factions[this.charId] === "Nightsoul";
    const mult = isNightsoul ? 1.75 : 1;
    return [
      new StatBuff(wbs(this, ["E", "Q"]), { receiver: "self" }, [
        {
          key: "cd",
          value: mult * r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
        },
        {
          key: "atk%",
          value: mult * r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("fang_of_the_mountain_king")
class FangOfTheMountainKing extends WeaponBase {
  // 6-stack Canopy's Favor: max E Skill + E Burst DMG
  readonly buffs = [
    new StatBuff(
      wbs(this, ["E", "burning"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [
        {
          key: "dmg%",
          value: 6 * r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["E", "burning"]),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [
        {
          key: "dmg%",
          value: 6 * r(this.refinement, [0.1, 0.125, 0.15, 0.175, 0.2]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("gest_of_the_mighty_wolf")
class GestOfTheMightyWolf extends WeaponBase {
  // ATK SPD +10% (passive)
  // Four Winds' Hymn: max 4 stacks DMG% (normal/E/charge triggers)
  // Hexerei: Secret Rite: max 4 stacks CD (requires 2+ Hexerei faction members)
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "atkSpd%", value: 0.1 },
    ]),
    new StatBuff(wbs(this, ["normal", "E", "charge"]), { receiver: "self" }, [
      {
        key: "dmg%",
        value: 4 * r(this.refinement, [0.075, 0.095, 0.115, 0.135, 0.155]),
      },
    ]),
    ...(() => {
      const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
      return isHexerei
        ? [
            new StatBuff(
              wbs(this, ["normal", "E", "charge"]),
              { receiver: "self" },
              [
                {
                  key: "cd",
                  value:
                    4 * r(this.refinement, [0.075, 0.095, 0.115, 0.135, 0.155]),
                },
              ]
            ),
          ]
        : [];
    })(),
  ];
}

@RegisterWeapon("verdict")
class Verdict extends WeaponBase {
  // ATK% (passive) + 2-stack Seal → Elemental Skill DMG (requires Crystallize)
  get buffs() {
    const buffs = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        { key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) },
      ]),
    ];
    if (
      this.teamMeta.hasReaction("crystallize") ||
      this.teamMeta.hasReaction("lunarCrystallize")
    ) {
      buffs.push(
        new StatBuff(
          wbs(this, ["crystallize"]),
          { receiver: "self", filter: { abilities: ["skill"] } },
          [
            {
              key: "dmg%",
              value: 2 * r(this.refinement, [0.18, 0.225, 0.27, 0.315, 0.36]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

const wolfsGravestoneOption = {
  label: { zh: "敌人血量", en: "Enemy HP" },
  choices: [
    {
      value: "below30",
      label: { zh: "HP<30%", en: "HP<30%" },
    },
    {
      value: "above30",
      label: { zh: "HP≥30%", en: "HP≥30%" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterWeapon("wolfs_gravestone", wolfsGravestoneOption)
class WolfsGravestone extends WeaponBase {
  private readonly o = resolveOption(wolfsGravestoneOption, this.option);

  get buffs() {
    const buffs = [
      new StatBuff(wbs(this), { receiver: "self" }, [
        {
          key: "atk%",
          value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
        },
      ]),
    ];
    if (this.o === "below30") {
      buffs.push(
        new StatBuff(
          wbs(this, ["enemy-low-hp"], "wolfs-gravestone-team-atk"),
          { receiver: "team" },
          [
            {
              key: "atk%",
              value: r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8]),
            },
          ]
        )
      );
    }
    return buffs;
  }
}

@RegisterWeapon("redhorn_stonethresher")
class RedhornStonethresher extends WeaponBase {
  // DEF% + DEF × scale → additive base DMG for NA/CA
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "def%",
        value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
      },
    ]),
    new ScalingBuff(
      wbs(this),
      { receiver: "self", filter: { abilities: ["normal", "charge"] } },
      [],
      "def",
      "baseDmg",
      r(this.refinement, [0.4, 0.5, 0.6, 0.7, 0.8])
    ),
  ];
}

@RegisterWeapon("song_of_broken_pines")
class SongOfBrokenPines extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "atk%", value: r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]) },
    ]),
    // Banner-Hymn: ATK SPD + ATK% for team
    new StatBuff(
      wbs(this, ["on-hit"], "millennial-movement-atkSpd"),
      { receiver: "team" },
      [
        {
          key: "atkSpd%",
          value: r(this.refinement, [0.12, 0.15, 0.18, 0.21, 0.24]),
        },
      ]
    ),
    new StatBuff(
      wbs(this, ["on-hit"], "millennial-movement-atk"),
      { receiver: "team" },
      [{ key: "atk%", value: r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]) }]
    ),
  ];
}

@RegisterWeapon("the_unforged")
class TheUnforged extends WeaponBase {
  get buffs() {
    const mult = this.teamMeta.hasShielder() ? 2 : 1;
    return [
      new StatBuff(wbs(this, ["shield"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: 5 * mult * r(this.refinement, [0.04, 0.05, 0.06, 0.07, 0.08]),
        },
      ]),
    ];
  }
}

@RegisterWeapon("skyward_pride")
class SkywardPride extends WeaponBase {
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      { key: "dmg%", value: r(this.refinement, [0.08, 0.1, 0.12, 0.14, 0.16]) },
    ]),
  ];
}

@RegisterWeapon("a_teaspoon_of_transcendence")
class ATeaspoonOfTranscendence extends WeaponBase {
  // ATK% + Surmount (ZH/U0b): max 3 stacks of Stellar-Conduct DMG after CA hits
  readonly buffs = [
    new StatBuff(wbs(this), { receiver: "self" }, [
      {
        key: "atk%",
        value: r(this.refinement, [0.28, 0.35, 0.42, 0.49, 0.56]),
      },
    ]),
    new StatBuff(
      wbs(this, ["charge"]),
      { receiver: "self", filter: { reactions: ["stellarConduct"] } },
      [
        {
          key: "reactionDmg%",
          value: 3 * r(this.refinement, [0.16, 0.2, 0.24, 0.28, 0.32]),
        },
      ]
    ),
  ];
}

@RegisterWeapon("beacon_of_the_reed_sea")
class BeaconOfTheReedSea extends WeaponBase {
  // Both ATK buffs assumed active; HP% only when NOT shielded
  get buffs() {
    const buffs = [
      new StatBuff(wbs(this, ["E", "take-dmg"]), { receiver: "self" }, [
        {
          key: "atk%",
          value: 2 * r(this.refinement, [0.2, 0.25, 0.3, 0.35, 0.4]),
        },
      ]),
    ];
    if (!this.teamMeta.hasShielder()) {
      buffs.push(
        new StatBuff(wbs(this), { receiver: "self" }, [
          {
            key: "hp%",
            value: r(this.refinement, [0.32, 0.4, 0.48, 0.56, 0.64]),
          },
        ])
      );
    }
    return buffs;
  }
}
