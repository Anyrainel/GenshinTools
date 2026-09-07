// Palette is intentionally held constant: this round compares structure.
const colors = [
  "#efd9ce",
  "#e5a1c6",
  "#af83c4",
  "#6ba6cc",
  "#4d639f",
  "#343957",
];
const styles = [
  [
    "Precision cut",
    "Sharp tips · eight faces · fine rim",
    "Long, crisp tips and slim shoulders retain the familiar gem character. Eight broad faces make this the detailed baseline; the rim stays fine rather than becoming a white flare.",
  ],
  [
    "Broad chamfer",
    "Clipped tips · low facet count · flat planes",
    "Clip the needle-like tips, widen the body, and replace small bevels with broad flat planes. This is a compact, graphic gem whose silhouette carries more weight at tab size.",
  ],
  [
    "Soft cast",
    "Rounded tips · curved surface · minimal seams",
    "Round the points as well as the shoulders. Continuous modeled surfaces replace triangular shards, creating a smooth solid object rather than a faceted illustration.",
  ],
  [
    "Ink edge",
    "Bold contour · compact body · drawn seams",
    "Use a thicker indigo contour and fewer, deliberately drawn interior seams. Shorter proportions and deep shoulders give the silhouette a crisp illustrated-emblem character.",
  ],
  [
    "Crown facets",
    "Stepped shoulders · inset face · layered cut",
    "Build a second tier into the silhouette and give the gem a broad inset face. Its stepped construction changes the geometry itself, while a filled center preserves continuity.",
  ],
];
const geometryNotes = [
  [
    "A narrow four-point star with a longer lower tip.",
    "A tall leaning crystal with a low, joined pair of side crystals.",
    "A slender curved star with pointed ends.",
    "Four pointed almond petals meet in a solid center.",
  ],
  [
    "Flat-cut tips and wider shoulder notches give the star more mass.",
    "A clipped hexagonal main crystal and a compact trapezoidal base replace small shards.",
    "A wide, clipped-tip star with short curved shoulders.",
    "Four chamfered, polygonal petals replace the soft flower lobes.",
  ],
  [
    "Rounded arm ends and concave shoulders turn the star into a smooth cast gem.",
    "A rounded fused cluster with a broad base and softened corners.",
    "A pillowy star with rounded points and fuller shoulders.",
    "Four round petals create a compact clover-like gem, with no sharp tips.",
  ],
  [
    "A squat broad star with short tips, held by a thick dark contour.",
    "An upright central prism and blocky side faces create a compact outlined cluster.",
    "A broad curved star with short, assertive tips and a drawn border.",
    "Four teardrop lobes with deep valleys and a heavier outer line.",
  ],
  [
    "Stepped shoulders surround a filled kite-shaped central face.",
    "A double-tier crown and staggered side crystals give the cluster a new profile.",
    "A stepped star combines curved shoulders with flat secondary corners.",
    "Four crown-cut petals use small flat caps and stepped side shoulders.",
  ],
];
export const concepts = [0, 1].flatMap((family) =>
  styles.map(([name, material, description], variant) => ({
    name,
    material,
    description,
    family,
    variant,
    colors,
    code: `${family === 0 ? "A" : "B"}${variant + 1}`,
    tag: `${family === 0 ? "Star + cluster" : "Curved star + petals"} / geometry ${variant + 1} of 5`,
    gi: geometryNotes[variant][family * 2],
    hsr: geometryNotes[variant][family * 2 + 1],
  }))
);

// Shapes are authored independently so variant differences survive one-color
// rendering. All stay connected and inside the same 64-unit design canvas.
export const shapes = {
  angular: [
    "M32 3 40 20 43 24 60 32 43 40 39 45 32 62 25 45 21 40 4 32 21 24 24 20Z",
    "M28 5H36L42 22 59 28V36L42 42 36 59H28L22 42 5 36V28L22 22Z",
    "M28 9Q32 2 36 9L42 23 56 28Q63 32 56 36L42 42 36 56Q32 63 28 56L22 42 8 36Q1 32 8 28L22 22Z",
    "M32 6 43 22 58 32 43 42 32 58 21 42 6 32 21 22Z",
    "M29 3H35L39 17 45 19 45 25 59 29V35L45 39 43 45 38 45 35 61H29L25 45 19 43 19 38 5 35V29L19 25 21 19 26 19Z",
  ],
  curved: [
    "M32 3C36 12 38 21 43 24L60 32C49 37 42 39 39 45L32 62C28 51 25 43 20 40L4 32C15 27 22 25 25 19Z",
    "M28 5H36Q39 22 45 24L59 28V36L45 40Q39 43 36 59H28Q25 43 19 40L5 36V28L19 24Q25 21 28 5Z",
    "M26 10Q32 2 38 10Q40 21 44 23L54 26Q62 32 54 38Q42 40 40 44L38 54Q32 62 26 54Q24 42 20 40L10 38Q2 32 10 26Q22 24 24 20Z",
    "M32 6Q39 23 45 25L58 32Q42 39 39 44L32 58Q25 41 20 39L6 32Q22 25 25 20Z",
    "M29 4H35L39 17Q40 21 46 21V26L59 29V35L46 39V44Q40 44 38 48L35 60H29L25 47Q24 43 18 43V38L5 35V29L18 25V20Q24 20 26 16Z",
  ],
  cluster: [
    "M37 3 51 13 46 37 55 33 60 45 48 56 25 62 7 46 10 29 22 35 24 12Z",
    "M29 6H42L50 15 44 37 53 34 59 43 53 54 25 59 7 47 10 33 20 36 23 15Z",
    "M31 6Q37 2 43 7L48 12Q52 15 50 22L45 36 53 33Q58 32 59 39L60 43Q61 48 55 52L29 59Q24 61 19 57L9 48Q5 45 7 39L10 32Q12 28 18 32L21 34 23 16Q24 10 31 6Z",
    "M29 6H40L48 16V36L55 32 59 43 52 55H20L6 43 11 29 21 35 22 16Z",
    "M32 3H40L46 10 43 17 51 22 45 38 53 34 60 43 55 50 48 50 45 57 25 61 9 48 6 37 15 28 22 35 25 18 23 12Z",
  ],
  flower: [
    "M32 3C42 10 48 19 41 24C50 19 57 25 62 32C55 42 48 47 41 41C46 49 39 57 32 62C23 55 18 48 24 41C16 47 8 40 2 32C9 22 17 18 24 24C18 16 24 8 32 3Z",
    "M27 5H37L44 14V24H50L59 27V37L50 44H40V50L37 59H27L20 50V40H14L5 37V27L14 20H24V14Z",
    "M32 5C44 5 48 16 42 23C51 18 60 23 60 32C60 44 48 47 41 41C47 50 43 60 32 60C20 60 17 48 23 41C14 47 4 43 4 32C4 20 16 17 23 23C18 14 22 5 32 5Z",
    "M32 5Q49 15 40 24Q50 17 59 32Q49 49 40 40Q47 50 32 59Q15 49 24 40Q14 47 5 32Q15 15 24 24Q17 14 32 5Z",
    "M27 4H37L42 11V19L39 24 46 21H53L60 28V36L53 42H45L40 39 43 46V53L36 60H28L22 53V45L25 40 18 43H11L4 36V28L11 22H19L24 25 21 18V11Z",
  ],
};
