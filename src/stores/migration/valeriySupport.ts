import type { BuffActivationMap } from "@/domain/combat/damage/types";
import type { TeamSetupConfig } from "@/domain/team/types";

// Before the unpublished team v26/cloud v8 release, Valeriy's support used
// beta A6/A7. Official data inserted stamina at A6, moving support to A7/A8.
// ScalingBuff serializes the coefficient into identityExtra. Freeze both old
// rounded beta rows and official rows here so later data refreshes cannot
// silently reinterpret authored activation overrides. Rows are levels 1–15.
const BETA_NORMAL = [
  0.2432, 0.2614, 0.2797, 0.304, 0.3222, 0.3405, 0.3648, 0.3891, 0.4134, 0.4378,
  0.4621, 0.4864, 0.5168, 0.5472, 0.5776,
];
const BETA_STELLAR = [
  0.7296, 0.7843, 0.839, 0.912, 0.9667, 1.0214, 1.0944, 1.1674, 1.2403, 1.3133,
  1.3862, 1.4592, 1.5504, 1.6416, 1.7328,
];
const OFFICIAL_NORMAL = [
  0.2432, 0.26144, 0.27968, 0.304, 0.32224, 0.34048, 0.3648, 0.38912, 0.41344,
  0.43776, 0.46208, 0.4864, 0.5168, 0.5472, 0.5776,
];
const OFFICIAL_STELLAR = [
  0.7296, 0.78432, 0.83904, 0.912, 0.96672, 1.02144, 1.0944, 1.16736, 1.24032,
  1.31328, 1.38624, 1.4592, 1.5504, 1.6416, 1.7328,
];

function migrateOverrides(buffs: BuffActivationMap): BuffActivationMap {
  const next = { ...buffs };
  for (const [key, value] of Object.entries(buffs)) {
    const fields = key.split("\u0003");
    if (fields.length !== 2 || fields[0] !== "valeriy") continue;
    const identity = fields[1].split("\u0002");
    if (
      identity.length !== 5 ||
      identity[0] !==
        ["character", "valeriy", "A/P2", "", "", "15", "", "charge"].join(
          "\u0000"
        ) ||
      identity[2] !== "" ||
      identity[3] !== "ScalingBuff"
    )
      continue;
    const target = identity[1].split("\u0000");
    const stellar = target[6] === "stellarConduct";
    if (
      identity[1] !==
      [
        "teamOnField",
        "",
        "",
        "",
        "normal,charge,plunge,skill,burst",
        "Electro",
        stellar ? "stellarConduct" : "",
      ].join("\u0000")
    )
      continue;
    const extra = identity[4].split("\u0000");
    if (
      extra.length !== 5 ||
      extra[0] !== "atk" ||
      extra[1] !== "baseDmg" ||
      extra[3] !== "" ||
      extra[4] !== ""
    )
      continue;

    const official = stellar ? OFFICIAL_STELLAR : OFFICIAL_NORMAL;
    const beta = stellar ? BETA_STELLAR : BETA_NORMAL;
    const rate = stellar ? 0.009 : 0.003;
    const currentScales = new Set(
      official.flatMap((base) =>
        [40, 100, 130].map((charge) => String(base + charge * rate))
      )
    );
    if (currentScales.has(extra[2])) continue;
    let scale: string | undefined;
    for (let level = 0; level < 15; level++) {
      for (const charge of [40, 100, 130]) {
        if (
          extra[2] === String(beta[level] + charge * rate) ||
          (stellar &&
            extra[2] === String(OFFICIAL_NORMAL[level] + charge * rate))
        ) {
          scale = String(official[level] + charge * rate);
        }
      }
    }
    // The temporary misindexed official normal branch read stamina (20),
    // erasing effective talent level from its identity. Even explicit saved
    // talents/constellation omit team passives such as Tartaglia's +1 A.
    // Preserve these unpublished mid-refresh keys rather than guessing a level.
    if (scale === undefined) continue;
    extra[2] = scale;
    identity[4] = extra.join("\u0000");
    const current = `valeriy\u0003${identity.join("\u0002")}`;
    // Explicit current identities win, independently of insertion order.
    if (!(current in buffs)) next[current] = value;
    delete next[key];
  }
  return next;
}

export function migrateValeriySupportConfig(
  config: TeamSetupConfig
): TeamSetupConfig {
  const combo = config.damage?.combo;
  if (!combo?.buffOverrides) return config;
  return {
    ...config,
    damage: {
      ...config.damage,
      combo: {
        ...combo,
        buffOverrides: Object.fromEntries(
          Object.entries(combo.buffOverrides).map(([line, buffs]) => [
            line,
            migrateOverrides(buffs),
          ])
        ),
      },
    },
  };
}

export function migrateValeriySupportConfigs(
  configs: Record<string, TeamSetupConfig>
): Record<string, TeamSetupConfig> {
  return Object.fromEntries(
    Object.entries(configs).map(([id, config]) => [
      id,
      migrateValeriySupportConfig(config),
    ])
  );
}
