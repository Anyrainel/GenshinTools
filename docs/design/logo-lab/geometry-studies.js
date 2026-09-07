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
const refinedColors = [
  "#f4dfde",
  "#ed91c4",
  "#ac79ce",
  "#66afdf",
  "#435ca0",
  "#303653",
];
const studies = [
  [
    "Precision cut",
    "Crisp shoulders, clear planes",
    "The refinement preserves the silhouette, strengthens rose and blue, and retains a small pale highlight. In group A, the Star Rail cluster is consolidated into seven broad faces. Compare with the previous version to judge the change.",
  ],
  [
    "First light",
    "Slender proportions, long uninterrupted faces",
    "A quieter, more vertical composition. Long rose-lit faces lead into blue shadows, with only one narrow highlight. The smaller side forms support the main gem without competing with it.",
  ],
  [
    "Silken prism",
    "Gentle shoulders, softly modeled facets",
    "Fuller shoulders and pointed ends give this direction a softer silhouette. The refinement removes the translucent wash and restores clearer facet contrast. In group A, the Star Rail cluster uses seven faces while keeping its layered base.",
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
    "The leaning cluster retains its silhouette; the refinement merges secondary face divisions.",
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
    refinedColors,
    code: `${family === 0 ? "A" : "B"}${variant + 1}`,
    tag: `${family === 0 ? "Star + cluster" : "Curved star + petals"} / study ${variant + 1}`,
    gi: notes[variant][family * 2],
    hsr: notes[variant][family * 2 + 1],
  }))
);
concepts.push({
  name: "Balanced cut",
  material: "A1–A5 midpoint · A5 crystal",
  description:
    "The proposed pair: a four-point star with more body than A5 and deeper shoulders than A1, paired with the unchanged A5 crystal. Shared rose, violet, and blue facets establish the family. The forms should read as considered gem emblems even without knowing the games.",
  family: 0,
  variant: 4,
  hybrid: true,
  colors,
  refinedColors: colors,
  code: "A6",
  tag: "Group A / proposed pairing",
  gi: "An intermediate shoulder depth keeps the star substantial without a square-looking center.",
  hsr: "A5 retained: the same silhouette, palette, facets, and inner highlight.",
});
for (const [refinement, name, material, description] of [
  [
    1,
    "Clear planes",
    "A6 outline · clearer crystal faces",
    "The A6 silhouette and colors are retained. Three continuous faces describe the main crystal; each side crystal meets a single shared bottom edge. Removing the floating inner highlight gives the eye fewer competing shapes to interpret.",
  ],
  [
    2,
    "Gathered crystal",
    "A6 proportions · more distinct side crystals",
    "A small change to the cluster: the left shard rises to a clearer tip, the right shard has a more upright face, and the underside is shallower. The faces meet as a single solid cluster. The Genshin star and shared palette remain exactly A6.",
  ],
]) {
  concepts.push({
    ...concepts[10],
    hybrid: false,
    crystalRefinement: refinement,
    code: `A${6 + refinement}`,
    name,
    material,
    description,
    tag: "A6 baseline / crystal clarity",
    gi: "A6 star retained without changes.",
    hsr:
      refinement === 1
        ? "A6 outline retained; continuous faces replace the overlapping internal patches."
        : "More legible side tips and a shallower base reduce the impression of a ribbon or stand.",
  });
}
concepts.push({
  ...concepts[10],
  hybrid: false,
  crystalRefinement: 3,
  code: "A9",
  name: "Low-set crystal",
  material: "Low base · broad, offset crystal faces",
  description:
    "An A6 refinement informed by the reference's proportions: a broad leaning crystal carries the visual weight, with small supporting fragments kept low. Offset face junctions replace the continuous central split. The Genshin star and palette stay at A6.",
  tag: "A6 baseline / revised crystal construction",
  gi: "A6 star retained without changes.",
  hsr: "A low, shallow base supports a broad crystal with a light cap and staggered rose–violet faces.",
});
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
