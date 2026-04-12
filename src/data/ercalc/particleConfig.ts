/**
 * Particle generation classification for the timeline-based ER calculator.
 *
 * Characters fall into three categories:
 * 1. **Simple E** — press E, particles arrive instantly (Bennett, Sucrose)
 *    → particles.json press.avgParticles is the total per use
 * 2. **Multi-hit instant** — E fires multiple hits at once (Diona's 5 paws)
 *    → particles.json has per-hit data; we store the corrected total here
 * 3. **Periodic deployer** — E deploys something that generates particles over time
 *    (Guoba, Oz, Raiden E coordinated attacks, pillar resonance, infusion attacks)
 *    → E action produces 0 particles; periodicE uses per-proc from particles.json
 *
 * The distinction matters for the timeline UI: periodic characters need individual
 * periodicE actions placed at the right points in the rotation.
 */

/**
 * Characters whose E deploys a periodic particle generator.
 * Their E/holdE actions produce 0 particles in the timeline model.
 * Use `periodicE` actions (one per proc) instead.
 */
export const periodicGenerators = new Set([
  // Deployable skill generators
  "fischl", // Oz: ~10 hits, 0.67/hit (1.5s CD)
  "xiangling", // Guoba: 4 hits, 1 particle/hit
  "albedo", // Transient Blossom: ~6 procs, 0.67/proc
  "sangonomiya_kokomi", // Jellyfish: ~6 hits, 0.67/hit
  "furina", // Salon members: ~5 hits, 1/hit
  "kuki_shinobu", // Ring: ~7-8 hits, 0.45/hit
  "yae_miko", // Totem: 3 hits, 1/hit (2.5s CD)
  "yaoyao", // Yuegui: ~3 hits, 1/hit
  "chiori", // Tamoto: 3 hits, 1.2/hit
  "layla", // Night Stars: 3 stars, 1.33/star
  "emilie", // Lumidouce Case: ~4 hits, 1/hit (2.5s CD)
  "nahida", // Tri-Karma: ~1 proc, 3/proc (7s CD)
  "yumemizuki_mizuki", // Max 4 per skill, 1/hit (0.5s CD)

  // Construct / periodic generators
  "raiden_shogun", // Coordinated attacks: ~10 procs, 0.5/proc
  "zhongli", // Pillar: ~6 hits, 0.5/hit (1.5s CD)
  "kachina", // ~6 procs, 0.667/proc
  "ningguang", // Screen: 1 proc, 3.33/proc (6s CD)

  // Infusion / converted attack generators
  "hu_tao", // Blood Blossom: ~1 proc, 2.5/proc (5s CD)
  "kamisato_ayato", // Converted attack: ~3 procs, 1.5/proc (2.5s CD)
  "wanderer", // NA during hover: ~4 procs, 1/proc (2s CD)
  "wriothesley", // NA during E: ~4 procs, 1/proc (2s CD)
  "clorinde", // Swift Hunt: ~4 procs, 1/proc (2s CD)
  "yoimiya", // Converted attack: ~4 procs, 1/proc (2s CD)
  "tartaglia", // Riptide: ~3 procs, 1/proc (3s CD)

  // Other periodic
  "gaming", // Charmed Cloudstrider: 1 hit, 2/hit (3s CD)
  "faruzan", // Pressurized Collapse: 1 vortex, 2/proc (5.5s CD)
  "alhaitham", // Projection Attack: ~3 waves, 1/wave
  "traveler_pyro", // Blazing Threshold: ~3 procs, 1/proc (2.9s CD)
  "lauma", // Frostgrove Sanctuary: ~3 procs, 1.3/proc (3.3s CD)
  "zibai", // Lunar Phase Shift: ~4 procs, 1/proc (2s CD)
]);

/**
 * Expected number of periodicE procs per deployment for common deployers.
 * Used by the UI to suggest how many periodicE blocks to place.
 * These represent typical proc counts during a standard rotation window (~15-20s).
 */
export const expectedPeriodicProcs: Record<string, number> = {
  fischl: 7, // Oz: ~10 hits total but 7 during typical rotation window
  xiangling: 4, // Guoba: 4 breaths
  albedo: 5, // Transient Blossom: 5-6 procs in 20s window
  sangonomiya_kokomi: 5, // Jellyfish: 5-6 hits in 12s
  furina: 5, // Salon members: ~5 hits
  kuki_shinobu: 6, // Ring: 6-7 hits
  yae_miko: 3, // Totems: 3 combined hits
  yaoyao: 3, // Yuegui: 3 hits
  chiori: 3, // Tamoto: 3 hits
  layla: 3, // Night Stars: 3 stars
  emilie: 4, // Lumidouce Case: 4 hits
  nahida: 1, // Tri-Karma: 1 proc per 7s rotation
  raiden_shogun: 5, // Coordinated attacks: ~5 in typical rotation
  zhongli: 4, // Pillar: 4 procs in typical rotation
  hu_tao: 1, // Blood Blossom: 1 proc per 5s
  kamisato_ayato: 3, // Converted NA: 3 procs
  wanderer: 4, // NA during hover: 4 procs
  wriothesley: 4, // NA during E: 4 procs
  clorinde: 4, // Swift Hunt: 4 procs
  yoimiya: 4, // Converted NA: 4 procs
  tartaglia: 3, // Riptide: 3 procs
  yumemizuki_mizuki: 4, // Max 4 per skill
  kachina: 5, // ~6 procs, conservative
  ningguang: 1, // Screen: 1 proc per 6s CD
  gaming: 1, // Charmed Cloudstrider: 1 hit
  faruzan: 1, // Pressurized Collapse: 1 vortex
  alhaitham: 3, // Projection Attack: 3 waves
  traveler_pyro: 3, // Blazing Threshold: 3 procs
  lauma: 3, // Frostgrove Sanctuary: 3 procs
  zibai: 4, // Lunar Phase Shift: 4 procs
};

/**
 * Total particles per E use for multi-hit instant characters.
 * These are NOT periodic — all particles arrive at once on E press.
 * Used when particles.json stores per-hit data instead of per-use totals.
 */
export const multiHitETotal: Record<string, number> = {
  diona: 4, // 5 paws × 0.8/paw (press)
  diluc: 1.33, // Per E hit — place 3 E actions in timeline for full combo
  sigewinne: 4, // Bubblebalm hit, once per Bubblebalm
  skirk: 4, // On Any Cryo Hit, 15s CD
  xianyun: 5, // Driftcloud Wave Hit
  chasca: 5, // Converted Charged Attack Hit
  chevreuse: 4, // 10s CD
};
