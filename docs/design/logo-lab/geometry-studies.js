// A single restrained rose/violet/blue palette keeps the comparisons about
// proportion, facet composition and the placement of light.
const colors = [
  "#efd9ce",
  "#e5a1c6",
  "#af83c4",
  "#6ba6cc",
  "#4d639f",
  "#343957",
];
const studies = [
  [
    "Precision cut",
    "The retained baseline",
    "The reference point for this round: a fine rim, clear facets, and familiar elongated proportions.",
  ],
  [
    "First light",
    "Slender proportions, long uninterrupted faces",
    "A quieter, more vertical composition. Long rose-lit faces lead into blue shadows, with only one narrow highlight. The smaller side forms support the main gem without competing with it.",
  ],
  [
    "Silken prism",
    "Gentle shoulders, softly modeled facets",
    "A little more fullness through the middle, balanced by pointed ends. Soft transitions sit inside clearly defined faces; the gem remains cut and dimensional rather than becoming a rounded blob.",
  ],
  [
    "Lightfold",
    "A slight lean, an offset meeting of facets",
    "A subtle directional composition, as if the gem has turned toward the light. Facets converge off-center and leave one broad, quiet face. Its asymmetry is carried through both icons.",
  ],
  [
    "Inner glow",
    "A luminous inner cut and a shaded perimeter",
    "A small inner cut catches the light while the surrounding faces turn into muted blue. The contour is clean and continuous; depth comes from the bevel rather than an added outline or ornament.",
  ],
];
const notes = [
  [
    "The original fine-cut star is retained.",
    "The original leaning cluster is retained.",
    "The original curved star is retained.",
    "The original pointed petals are retained.",
  ],
  [
    "Longer vertical emphasis and shorter side points.",
    "A slender main crystal rests between two modest side faces.",
    "A slender star with smooth, gently drawn shoulders.",
    "Long almond petals, with the vertical pair slightly emphasized.",
  ],
  [
    "Fuller shoulders flow into precise tips.",
    "A broad main crystal with gently eased corners and an integrated base.",
    "Curved shoulders give the star a softer tension without rounding its tips.",
    "Full petals taper to clean points, with no extra central symbol.",
  ],
  [
    "A slight diagonal lean shifts the facet meeting point.",
    "A leaning main prism and an asymmetric base share the star’s direction.",
    "A slight turn creates a more flowing star silhouette.",
    "A small clockwise turn gives the petals the same directional feel.",
  ],
  [
    "A balanced four-point silhouette with a restrained inner bevel.",
    "A compact crystal with a lit inner face and low supporting shards.",
    "Broad, smooth shoulders hold a small luminous center.",
    "A compact pointed flower with a quiet bevel inside each petal.",
  ],
];
export const concepts = [0, 1].flatMap((family) =>
  studies.map(([name, material, description], variant) => ({
    name,
    material,
    description,
    family,
    variant,
    colors,
    code: `${family === 0 ? "A" : "B"}${variant + 1}`,
    tag: `${family === 0 ? "Star + cluster" : "Curved star + petals"} / study ${variant + 1}`,
    gi: notes[variant][family * 2],
    hsr: notes[variant][family * 2 + 1],
  }))
);
export const shapes = {
  angular: [
    "M32 3 40 20 43 24 60 32 43 40 39 45 32 62 25 45 21 40 4 32 21 24 24 20Z",
    "M32 3 39 23 56 32 39 40 32 61 25 40 8 32 25 23Z",
    "M32 4Q38 19 43 23L59 32Q45 38 41 43L32 60Q26 45 21 41L5 32Q19 26 23 21Z",
    "M36 4 41 22 60 29 42 39 28 60 24 41 4 35 23 24Z",
    "M32 4 42 22 60 32 42 42 32 60 22 42 4 32 22 22Z",
  ],
  curved: [
    "M32 3C36 12 38 21 43 24L60 32C49 37 42 39 39 45L32 62C28 51 25 43 20 40L4 32C15 27 22 25 25 19Z",
    "M32 3Q36 23 55 32Q37 39 32 61Q27 40 9 32Q27 25 32 3Z",
    "M32 4C37 16 39 22 45 25L59 32C46 37 40 40 37 48L32 60C27 47 24 41 16 37L5 32C18 27 24 24 27 16Z",
    "M36 4Q39 22 59 29Q40 38 28 60Q25 42 5 35Q24 26 36 4Z",
    "M32 4Q39 23 60 32Q41 39 32 60Q25 41 4 32Q23 25 32 4Z",
  ],
  cluster: [
    "M37 3 51 13 46 37 55 33 60 45 48 56 25 62 7 46 10 29 22 35 24 12Z",
    "M35 3 47 13 43 39 53 35 58 45 46 55 25 60 9 46 12 34 23 39 25 12Z",
    "M35 4Q37 3 39 5L50 13Q52 15 51 18L45 37 54 34 59 45 47 55 25 60 8 46 11 31 23 37 24 14Q24 12 27 10Z",
    "M40 4 52 15 43 39 54 34 59 45 44 55 24 60 7 46 12 32 22 38 28 13Z",
    "M35 4 49 14 45 38 53 33 59 45 46 55 25 60 8 46 11 31 22 37 24 13Z",
  ],
  flower: [
    "M32 3C42 10 48 19 41 24C50 19 57 25 62 32C55 42 48 47 41 41C46 49 39 57 32 62C23 55 18 48 24 41C16 47 8 40 2 32C9 22 17 18 24 24C18 16 24 8 32 3Z",
    "M32 3Q46 16 39 25Q48 21 58 32Q47 45 39 39Q44 49 32 61Q19 48 25 39Q16 44 6 32Q18 20 25 25Q19 14 32 3Z",
    "M32 4C43 11 46 18 40 25C48 20 55 24 60 32C53 43 47 45 39 39C44 48 39 56 32 60C21 53 19 46 25 39C16 44 9 39 4 32C11 21 18 19 25 25C20 17 25 9 32 4Z",
    "M36 4Q48 17 40 25Q52 22 60 36Q47 48 39 40Q42 52 28 60Q16 47 24 39Q12 42 4 28Q17 16 25 24Q22 12 36 4Z",
    "M32 4Q47 15 40 24Q51 19 60 32Q49 47 40 40Q45 51 32 60Q17 49 24 40Q13 45 4 32Q15 17 24 24Q19 13 32 4Z",
  ],
};
