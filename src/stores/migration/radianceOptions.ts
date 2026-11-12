import type {
  BuffActivationMap,
  ComboFormula,
  OptionMap,
} from "@/domain/combat/damage/types";
import type { TeamSetupConfig } from "@/domain/team/types";

// Before team v27 / cloud v9, these options could override team-determined
// Radiance, including its fixed Stellar-Conduct priority. Composite values
// also encoded real form/resource choices, which must survive the cleanup.
const REMOVED_OPTIONS = new Set([
  "alyosha",
  "beidou",
  "cyno",
  "odette",
  "qiqi",
  "sandrone",
  "traveler_cryo",
  "vesna",
  "wriothesley",
  "yae_miko",
  "yumemizuki_mizuki",
  "new_bough",
  "winters_heavy_heart",
]);

function migrateOptions(options: OptionMap): OptionMap {
  const next = { ...options };
  for (const id of REMOVED_OPTIONS) delete next[id];
  if (["on", "off", "stellarConduct", "stellarSwirl"].includes(next.diona)) {
    // The displaced HP option had been hardcoded to its high-HP branch.
    next.diona = "above50";
  }
  if (next.danica === "battle-stellar") next.danica = "battle";
  if (next.danica === "defense-stellar") next.danica = "defense";
  const charge = /^(?:stellar|normal)-(40|100|130)$/.exec(next.valeriy ?? "");
  if (charge) next.valeriy = charge[1];
  const blessing =
    /^(love|honor)-(?:stellarConduct|stellarSwirl|off)-(sealed|unsealed)$/.exec(
      next.anastasya ?? ""
    );
  if (blessing) next.anastasya = `${blessing[1]}-${blessing[2]}`;
  return next;
}

function migrateCynoFormula(formulaId: string): string {
  if (formulaId === "cyno-p1-starsame") return "cyno-p1-bolts";
  if (formulaId === "cyno-c6-starsame") return "cyno-c6-bolts";
  return formulaId;
}

function migrateCountOverrides(
  overrides: Record<string, number> | undefined
): Record<string, number> | undefined {
  if (!overrides) return overrides;
  const next = { ...overrides };
  for (const [key, value] of Object.entries(overrides)) {
    if (!key.startsWith("cyno|")) continue;
    const separator = key.lastIndexOf("|");
    const lineKey = key.slice(separator + 1);
    const [formulaId] = lineKey.split(":");
    const migrated = migrateCynoFormula(formulaId);
    if (migrated === formulaId) continue;
    const current = `${key.slice(0, separator + 1)}${migrated}${lineKey.slice(formulaId.length)}`;
    // Both IDs described mutually exclusive versions of the same action.
    // An explicitly authored canonical count wins instead of doubling it.
    if (!(current in overrides)) next[current] = value;
    delete next[key];
  }
  return next;
}

function migrateCountEntries<
  T extends { charId: string; formulaId: string; constellation: number },
>(entries: T[] | undefined): T[] | undefined {
  if (!Array.isArray(entries)) return entries;
  return entries?.flatMap((entry) => {
    if (entry?.charId !== "cyno") return [entry];
    const formulaId = migrateCynoFormula(entry.formulaId);
    if (formulaId === entry.formulaId) return [entry];
    if (
      entries.some(
        (other) =>
          other?.charId === entry.charId &&
          other.constellation === entry.constellation &&
          other.formulaId === formulaId
      )
    )
      return [];
    return [{ ...entry, formulaId }];
  });
}

function migrateBuffs(buffs: BuffActivationMap): BuffActivationMap {
  if (!buffs || typeof buffs !== "object") return buffs;
  const next = { ...buffs };
  for (const [key, activation] of Object.entries(buffs)) {
    const separator = key.indexOf("\u0003");
    if (separator < 0) continue;
    const identity = key.slice(separator + 1).split("\u0002");
    if (identity.length !== 5 || identity[3] !== "StatBuff") continue;
    const source = identity[0].split("\u0000");
    const target = identity[1].split("\u0000");
    if (source.length !== 8 || target.length !== 7) continue;

    // Winter's old Radiance branch was unconditional and replaced its idle
    // composition bonus. The corrected model keeps that base and adds a
    // triggered replacement delta. The old key preserves refinement and total
    // Cryo/Electro count, but not their split; emit the finite possible delta
    // identities so presets need not be loaded during hydration. Only the
    // actual split/state can match a live buff. Activation now controls the
    // replacement's uptime; the corrected unconditional base stays present.
    // Opaque/ordinary keys survive.
    const refinement = /^R([1-5])$/.exec(source[2]);
    if (
      refinement &&
      source[0] === "weapon" &&
      source[1] === "winters_heavy_heart" &&
      source.slice(3).every((field) => field === "") &&
      identity[4] === ""
    ) {
      const index = Number(refinement[1]) - 1;
      const radiantEm = [20, 25, 30, 35, 40][index];
      const baseEm = [24, 30, 36, 42, 48][index];
      const baseAtk = [0.048, 0.06, 0.072, 0.084, 0.096][index];
      const reactionDmg = [0.06, 0.075, 0.09, 0.105, 0.12][index];
      let migratedWinter = false;
      for (let count = 1; count <= 4; count++) {
        const emBranch =
          identity[1] === ["self", "", "", "", "", "", ""].join("\u0000") &&
          identity[2] === `em:${count * radiantEm}`;
        const reactionBranch =
          identity[1] ===
            ["self", "", "", "", "", "", "stellarConduct,stellarSwirl"].join(
              "\u0000"
            ) && identity[2] === `reactionDmg%:${count * reactionDmg}`;
        if (!emBranch && !reactionBranch) continue;
        for (const trigger of ["polestar-field", "stellarSwirl"]) {
          const currentSource = [...source];
          currentSource[7] = trigger;
          for (let cryo = 0; cryo <= (emBranch ? count : 0); cryo++) {
            const currentIdentity = [...identity];
            currentIdentity[0] = currentSource.join("\u0000");
            if (emBranch) {
              const electro = count - cryo;
              currentIdentity[2] = [
                `em:${count * radiantEm - cryo * baseEm}`,
                ...(electro > 0 ? [`atk%:${-(electro * baseAtk)}`] : []),
              ].join("\u0001");
            }
            const current =
              key.slice(0, separator + 1) + currentIdentity.join("\u0002");
            if (!(current in buffs)) next[current] = activation;
          }
        }
        migratedWinter = true;
        break;
      }
      if (migratedWinter) {
        delete next[key];
        continue;
      }
    }

    // The old C6 field bonus reached off-field characters too. Keep authored
    // activation factors under the corrected active-character receiver.
    if (
      key.slice(0, separator) === "diona" &&
      source[0] === "character" &&
      source[1] === "diona" &&
      source[2] === "C6" &&
      source[7] === "Q" &&
      identity[2] === "reactionDmg%:0.4" &&
      identity[1] === ["team", "", "", "", "", "", target[6]].join("\u0000") &&
      ["stellarConduct,superconduct", "stellarSwirl"].includes(target[6])
    ) {
      target[0] = "teamOnField";
      identity[1] = target.join("\u0000");
    } else if (
      source[0] === "teamResonance" &&
      source[1] === "superconduct" &&
      source[7] === "" &&
      identity[2] === "resReduction%:0.4" &&
      identity[1] === ["team", "", "", "", "", "Physical", ""].join("\u0000")
    ) {
      // Superconduct is a combat reaction debuff, not an idle resonance.
      source[7] = "superconduct";
      identity[0] = source.join("\u0000");
    } else {
      continue;
    }

    const current = key.slice(0, separator + 1) + identity.join("\u0002");
    if (!(current in buffs)) next[current] = activation;
    delete next[key];
  }
  return next;
}

function migrateCombo(combo: ComboFormula): ComboFormula {
  // Corrupt optional blobs are healed by the public persistence schema.
  if (!Array.isArray(combo.lines)) return combo;
  const lines: ComboFormula["lines"] = [];
  const buffOverrides: NonNullable<ComboFormula["buffOverrides"]> = {};
  for (const [index, line] of combo.lines.entries()) {
    if (!line || typeof line.formulaId !== "string") {
      lines.push(line);
      continue;
    }
    const formulaId =
      line.charId === "cyno"
        ? migrateCynoFormula(line.formulaId)
        : line.formulaId;
    // Previously only one of these two versions could be live. Keep an
    // explicitly authored canonical line instead of activating both versions.
    if (
      formulaId !== line.formulaId &&
      combo.lines.some(
        (other) => other?.charId === "cyno" && other.formulaId === formulaId
      )
    )
      continue;
    const activation = combo.buffOverrides?.[index];
    if (activation) buffOverrides[lines.length] = migrateBuffs(activation);
    lines.push(formulaId === line.formulaId ? line : { ...line, formulaId });
  }
  return {
    ...combo,
    lines,
    ...(combo.buffOverrides ? { buffOverrides } : {}),
  };
}

export function migrateRadianceSetupConfigs(
  configs: Record<string, TeamSetupConfig>
): Record<string, TeamSetupConfig> {
  return Object.fromEntries(
    Object.entries(configs).map(([id, config]) => {
      if (!config || typeof config !== "object") return [id, config];
      const damage = config.damage;
      const combo = damage?.combo;
      const selected = damage?.selectedFormula;
      const investment = config.investment;
      return [
        id,
        {
          ...config,
          combatOptions: migrateOptions(config.combatOptions ?? {}),
          ...(damage
            ? {
                damage: {
                  ...damage,
                  ...(selected?.charId === "cyno"
                    ? {
                        selectedFormula: {
                          ...selected,
                          formulaId: migrateCynoFormula(selected.formulaId),
                        },
                      }
                    : {}),
                  ...(combo
                    ? {
                        combo: migrateCombo(combo),
                      }
                    : {}),
                },
              }
            : {}),
          ...(investment
            ? {
                investment: {
                  ...investment,
                  ...(investment.legacyCountOverrides
                    ? {
                        legacyCountOverrides: migrateCountOverrides(
                          investment.legacyCountOverrides
                        ),
                      }
                    : {}),
                  ...(investment.futureCountChanges
                    ? {
                        futureCountChanges: migrateCountEntries(
                          investment.futureCountChanges
                        ),
                      }
                    : {}),
                  ...(investment.absoluteCountTargets
                    ? {
                        absoluteCountTargets: migrateCountEntries(
                          investment.absoluteCountTargets
                        ),
                      }
                    : {}),
                },
              }
            : {}),
        } satisfies TeamSetupConfig,
      ];
    })
  );
}
