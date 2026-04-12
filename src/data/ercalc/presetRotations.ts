import type { TeamMember, Timeline } from "@/lib/ercalc/erCalculator";

export interface TeamPreset {
  id: string;
  nameEn: string;
  nameZh: string;
  team: TeamMember[];
  timeline: Timeline;
  /** Optional description of the rotation pattern. */
  noteEn?: string;
  noteZh?: string;
}

/**
 * Preset team rotations for common comps.
 * These serve as starting points — users can customize after loading.
 *
 * Timeline conventions:
 * - Place periodicE procs where the summon would fire during the rotation
 * - Interleave periodicE with the on-field character's actions
 * - Use realistic number of E casts per rotation
 */
export const TEAM_PRESETS: TeamPreset[] = [
  {
    id: "national",
    nameEn: "National (Bennett + Xiangling + Xingqiu + Sucrose)",
    nameZh: "国家队 (班尼特 + 香菱 + 行秋 + 砂糖)",
    team: [
      { id: "bennett", element: "Pyro", burstCost: 60 },
      { id: "xiangling", element: "Pyro", burstCost: 80 },
      { id: "xingqiu", element: "Hydro", burstCost: 80 },
      { id: "sucrose", element: "Anemo", burstCost: 80 },
    ],
    timeline: [
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "Q" }, // XL absorbs Bennett E (funnel)
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "E" }, // deploy Guoba
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "E" }, // sac sword
      { char: "xingqiu", action: "Q" },
      { char: "sucrose", action: "E" },
      { char: "sucrose", action: "E" }, // sac fragments
      { char: "sucrose", action: "Q" },
    ],
    noteEn:
      "Bennett funnels Pyro particles to Xiangling. Sac Sword on XQ, Sac Fragments on Sucrose.",
    noteZh: "班尼特给香菱充能。行秋带祭礼剑，砂糖带祭礼残章。",
  },
  {
    id: "raiden-national",
    nameEn: "Raiden National",
    nameZh: "雷国家队",
    team: [
      { id: "raiden_shogun", element: "Electro", burstCost: 90 },
      { id: "bennett", element: "Pyro", burstCost: 60 },
      { id: "xiangling", element: "Pyro", burstCost: 80 },
      { id: "xingqiu", element: "Hydro", burstCost: 80 },
    ],
    timeline: [
      { char: "raiden_shogun", action: "E" }, // deploy
      { char: "bennett", action: "E" },
      { char: "raiden_shogun", action: "periodicE" },
      { char: "bennett", action: "Q" },
      { char: "xiangling", action: "E" },
      { char: "raiden_shogun", action: "periodicE" },
      { char: "xiangling", action: "Q" },
      { char: "xiangling", action: "periodicE" },
      { char: "raiden_shogun", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xingqiu", action: "E" },
      { char: "raiden_shogun", action: "periodicE" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "Q" },
      { char: "raiden_shogun", action: "periodicE" },
      { char: "raiden_shogun", action: "Q" },
    ],
    noteEn:
      "Raiden E procs during teammates' field time. Raiden Q last for energy recovery.",
    noteZh: "雷神E在队友场上期间触发。雷神Q最后释放恢复能量。",
  },
  {
    id: "fav-national",
    nameEn: "Fav National (Fav Sword Bennett)",
    nameZh: "西风国家队 (西风剑班尼特)",
    team: [
      {
        id: "bennett",
        element: "Pyro",
        burstCost: 60,
        weaponId: "favonius_sword",
        refinement: 0, // R1
      },
      { id: "xiangling", element: "Pyro", burstCost: 80 },
      {
        id: "xingqiu",
        element: "Hydro",
        burstCost: 80,
        constellation: 6,
      },
      { id: "sucrose", element: "Anemo", burstCost: 80 },
    ],
    timeline: [
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "E" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "Q" },
      { char: "sucrose", action: "E" },
      { char: "sucrose", action: "E" },
      { char: "sucrose", action: "Q" },
    ],
    noteEn:
      "Same as National but with Favonius Sword on Bennett and C6 Xingqiu.",
    noteZh: "与国家队相同，班尼特装备西风剑，行秋六命。",
  },
  {
    id: "mono-geo",
    nameEn: "Mono Geo (Itto + Gorou + Albedo + Zhongli)",
    nameZh: "纯岩 (荒的一斗 + 五郎 + 阿贝多 + 钟离)",
    team: [
      { id: "arataki_itto", element: "Geo", burstCost: 70 },
      { id: "gorou", element: "Geo", burstCost: 80 },
      { id: "albedo", element: "Geo", burstCost: 40 },
      { id: "zhongli", element: "Geo", burstCost: 40 },
    ],
    timeline: [
      { char: "zhongli", action: "holdE" },
      { char: "albedo", action: "E" },
      { char: "gorou", action: "E" },
      { char: "gorou", action: "Q" },
      { char: "arataki_itto", action: "E" },
      { char: "arataki_itto", action: "Q" },
      // Periodic procs during Itto's field time
      { char: "albedo", action: "periodicE" },
      { char: "albedo", action: "periodicE" },
      { char: "albedo", action: "periodicE" },
      { char: "zhongli", action: "periodicE" },
      { char: "zhongli", action: "periodicE" },
    ],
    noteEn:
      "Mono Geo: all same-element particles. Albedo + Zhongli procs during Itto Q.",
    noteZh: "纯岩队：全同元素粒子。阿贝多和钟离在一斗Q期间触发。",
  },
  {
    id: "freeze-ayaka",
    nameEn: "Freeze (Ayaka + Shenhe + Kokomi + Kazuha)",
    nameZh: "冻结 (神里绫华 + 申鹤 + 心海 + 万叶)",
    team: [
      { id: "kamisato_ayaka", element: "Cryo", burstCost: 80 },
      { id: "shenhe", element: "Cryo", burstCost: 80 },
      {
        id: "sangonomiya_kokomi",
        element: "Hydro",
        burstCost: 70,
      },
      { id: "kaedehara_kazuha", element: "Anemo", burstCost: 60 },
    ],
    timeline: [
      { char: "sangonomiya_kokomi", action: "E" }, // deploy jellyfish
      { char: "shenhe", action: "E" },
      { char: "shenhe", action: "Q" },
      { char: "kaedehara_kazuha", action: "E" },
      { char: "kaedehara_kazuha", action: "Q" },
      { char: "kamisato_ayaka", action: "E" },
      { char: "sangonomiya_kokomi", action: "periodicE" },
      { char: "sangonomiya_kokomi", action: "periodicE" },
      { char: "kamisato_ayaka", action: "Q" },
      { char: "sangonomiya_kokomi", action: "periodicE" },
      { char: "sangonomiya_kokomi", action: "periodicE" },
      { char: "sangonomiya_kokomi", action: "periodicE" },
      { char: "sangonomiya_kokomi", action: "Q" },
    ],
    noteEn:
      "Freeze: Kokomi jellyfish procs during Ayaka field time for Hydro application.",
    noteZh: "冻结队：心海水母在绫华场上期间触发。",
  },
  {
    id: "hu-tao-double-hydro",
    nameEn: "Hu Tao Double Hydro",
    nameZh: "胡桃双水",
    team: [
      { id: "hu_tao", element: "Pyro", burstCost: 60 },
      { id: "xingqiu", element: "Hydro", burstCost: 80 },
      { id: "yelan", element: "Hydro", burstCost: 70 },
      { id: "zhongli", element: "Geo", burstCost: 40 },
    ],
    timeline: [
      { char: "zhongli", action: "holdE" },
      { char: "zhongli", action: "Q" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "Q" },
      { char: "yelan", action: "E" },
      { char: "yelan", action: "Q" },
      { char: "hu_tao", action: "E" },
      { char: "hu_tao", action: "NA" }, // field time NAs
      { char: "zhongli", action: "periodicE" }, // pillar proc while Hu Tao on-field
      { char: "hu_tao", action: "NA" },
      { char: "hu_tao", action: "periodicE" }, // blood blossom proc
      { char: "zhongli", action: "periodicE" },
      { char: "hu_tao", action: "NA" },
      { char: "zhongli", action: "periodicE" },
      { char: "hu_tao", action: "Q" },
    ],
    noteEn:
      "Hu Tao vape: Zhongli shield → supports burst → Hu Tao field time with blood blossom procs.",
    noteZh: "胡桃蒸发：钟离盾 → 辅助爆发 → 胡桃上场输出。",
  },
  {
    id: "neuvillette-furina",
    nameEn: "Neuvillette Furina",
    nameZh: "那维莱特芙宁娜",
    team: [
      { id: "neuvillette", element: "Hydro", burstCost: 70 },
      { id: "furina", element: "Hydro", burstCost: 60 },
      { id: "kaedehara_kazuha", element: "Anemo", burstCost: 60 },
      { id: "zhongli", element: "Geo", burstCost: 40 },
    ],
    timeline: [
      { char: "zhongli", action: "holdE" },
      { char: "furina", action: "E" },
      { char: "furina", action: "Q" },
      { char: "kaedehara_kazuha", action: "E" },
      { char: "kaedehara_kazuha", action: "Q" },
      { char: "neuvillette", action: "E" },
      { char: "neuvillette", action: "Q" },
      { char: "furina", action: "periodicE" },
      { char: "furina", action: "periodicE" },
      { char: "furina", action: "periodicE" },
      { char: "zhongli", action: "periodicE" },
      { char: "zhongli", action: "periodicE" },
    ],
    noteEn:
      "Neuvillette main DPS with Furina HP drain + buff. Kazuha VV support.",
    noteZh: "那维莱特主C配芙宁娜增伤。万叶风套辅助。",
  },
];
