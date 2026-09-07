// Two accepted silhouettes, five material studies each. Tiny exports use fewer
// faces and a stronger contour; all outputs retain a transparent square canvas.
const treatments = [
  {
    name: "Apricot glass",
    material: "Warm beveled glass",
    colors: ["#ffe0ad", "#ed9b7c", "#b56887", "#7976ad", "#49477e", "#2f294b"],
    description:
      "Apricot light gives way to dusty violet shadows. A restrained bevel keeps the gemstone character, while a darker lower half gives the tab icon more weight.",
    adjustment:
      "Replace ice-blue reflections with peach and violet; keep only the broadest facet junctions at tab size.",
  },
  {
    name: "Vermilion enamel",
    material: "Opaque enamel with a fine gilt edge",
    colors: ["#ffdda2", "#f18565", "#c84646", "#a6314e", "#742840", "#412332"],
    description:
      "An opaque coral-red gem with a fine warm edge. A small satin highlight replaces the large white flare. This feels like a crafted emblem, with distinct faces that hold up without glass effects.",
    adjustment:
      "Trade translucent noise for four to six opaque planes. The warm rim separates the silhouette from dark tabs.",
  },
  {
    name: "Amber alloy",
    material: "Brushed gold and bronze",
    colors: ["#ffe3a0", "#e5b65f", "#c2863f", "#a96438", "#77422e", "#452b25"],
    description:
      "Gold-lit faces and bronze recesses turn the gem into a small cast object. Light follows the sculpted faces; a narrow highlight suggests polished metal without a white outline.",
    adjustment:
      "Use a strong gold-to-bronze value range instead of a rainbow. Broad modeled faces survive the reduction to 16 px.",
  },
  {
    name: "Rose tourmaline",
    material: "Satin mineral, rose and olive",
    colors: ["#f4d8ae", "#d68d92", "#aa617b", "#9d9b68", "#686646", "#393a30"],
    description:
      "Muted rose above, olive-gold below. Two mineral colors share the same quiet satin surface, with broad asymmetric reflections and no brilliant white core.",
    adjustment:
      "Give the symbol a memorable warm mineral palette; preserve a solid center and separate its few large faces by value.",
  },
  {
    name: "Ember garnet",
    material: "Deep jewel with copper-lit faces",
    colors: ["#ffd2a0", "#e39a72", "#ac5571", "#874361", "#5b304c", "#352439"],
    description:
      "Copper light catches a deep wine-colored gem. Dark interior faces make the small highlights feel intentional. A continuous warm edge keeps the darker body visible on dark backgrounds.",
    adjustment:
      "Make highlights scarce, not icy. Retain a warm perimeter and one copper-lit face in the tiny version.",
  },
];

export const concepts = [0, 1].flatMap((family) =>
  treatments.map((treatment, variant) => ({
    ...treatment,
    family,
    variant,
    code: `${family === 0 ? "A" : "B"}${variant + 1}`,
    tag: `${family === 0 ? "Option 1 · bevel" : "Option 4 · petal"} / ${variant + 1} of 5`,
    gi: `${family === 0 ? "The accepted angular star silhouette, with its clipped shoulders and longer lower point." : "The accepted curved star silhouette, with softly sculpted shoulders."} ${treatment.adjustment}`,
    hsr: `${family === 0 ? "The accepted leaning crystal cluster, with its joined base." : "The accepted four-petal crystal, with a full center."} Same palette, edge weight, and surface finish as Genshin.`,
  }))
);

let serial = 0;
const path = (d, fill, extra = "") =>
  `<path d="${d}" fill="${fill}" ${extra}/>`;
const angularStar =
  "M32 3 40 20 43 24 60 32 43 40 39 45 32 62 25 45 21 40 4 32 21 24 24 20Z";
const curvedStar =
  "M32 3C36 12 38 21 43 24L60 32C49 37 42 39 39 45L32 62C28 51 25 43 20 40L4 32C15 27 22 25 25 19Z";
const cluster =
  "M37 3 51 13 46 37 55 33 60 45 48 56 25 62 7 46 10 29 22 35 24 12Z";
const flower =
  "M32 3C42 10 48 19 41 24C50 19 57 25 62 32C55 42 48 47 41 41C46 49 39 57 32 62C23 55 18 48 24 41C16 47 8 40 2 32C9 22 17 18 24 24C18 16 24 8 32 3Z";

export function icon(
  index,
  game,
  oneColor = false,
  foreground = "#202633",
  size = 64
) {
  const study = concepts[index];
  const { family, variant, colors: c } = study;
  const tiny = size <= 24;
  const id = `gem-${serial++}`;
  const shape =
    game === "gi"
      ? family === 0
        ? angularStar
        : curvedStar
      : family === 0
        ? cluster
        : flower;
  const gradient = (key, colors, x2 = "80%", y2 = "100%") =>
    `<linearGradient id="${id}-${key}" x1="15%" y1="0%" x2="${x2}" y2="${y2}">${colors.map((color, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${color}"/>`).join("")}</linearGradient>`;
  const fill = (key) => `url(#${id}-${key})`;
  let defs = gradient("rim", [c[0], c[1], c[3], c[5]]);
  defs += gradient("light", [c[0], c[1]]);
  defs += gradient("warm", [c[1], c[2]]);
  defs += gradient("middle", [c[2], c[3]]);
  defs += gradient("lower", [c[3], c[4]]);
  defs += gradient("dark", [c[3], c[5]]);
  defs += gradient("metal", [c[2], c[0], c[1], c[3]], "100%", "35%");
  defs += `<clipPath id="${id}-clip">${path(shape, "white")}</clipPath>`;

  const paint = (tone) => {
    if (variant === 1 || tiny)
      return { light: c[0], warm: c[1], middle: c[2], lower: c[3], dark: c[4] }[
        tone
      ];
    if (variant === 2 && tone === "light") return fill("metal");
    return fill(tone);
  };
  let faces;
  if (game === "gi") {
    faces = [
      ["M32 5 24 23 32 32Z", "light"],
      ["M32 5 41 24 32 32Z", "warm"],
      ["M24 23 6 32 32 32Z", "warm"],
      ["M6 32 22 40 32 32Z", "dark"],
      ["M41 24 58 32 32 32Z", "middle"],
      ["M58 32 41 40 32 32Z", "dark"],
      ["M22 40 32 59 32 32Z", "lower"],
      ["M32 59 41 40 32 32Z", "dark"],
    ];
    if (tiny)
      faces = [
        ["M32 3 43 24 60 32 32 32Z", "warm"],
        ["M32 3 24 20 21 24 4 32 32 32Z", "light"],
        ["M4 32 21 40 25 45 32 62 32 32Z", "lower"],
        ["M32 32 60 32 43 40 39 45 32 62Z", "dark"],
      ];
  } else if (family === 1) {
    faces = [
      ["M32 5Q21 16 26 25L32 32Z", "light"],
      ["M32 5Q45 16 39 25L32 32Z", "warm"],
      ["M60 32Q49 21 39 26L32 32Z", "warm"],
      ["M60 32Q49 44 40 38L32 32Z", "middle"],
      ["M32 60Q44 48 38 40L32 32Z", "dark"],
      ["M32 60Q21 49 26 40L32 32Z", "lower"],
      ["M4 32Q16 45 25 38L32 32Z", "dark"],
      ["M4 32Q16 21 25 26L32 32Z", "lower"],
    ];
    if (tiny)
      faces = [
        ["M0 0H32V32H0Z", "light"],
        ["M32 0H64V32H32Z", "warm"],
        ["M0 32H32V64H0Z", "lower"],
        ["M32 32H64V64H32Z", "dark"],
      ];
  } else {
    faces = [
      ["M37 5 26 13 31 35 39 27Z", "warm"],
      ["M37 5 49 14 39 27Z", "light"],
      ["M49 14 44 39 32 48 39 27Z", "dark"],
      ["M26 13 23 38 32 48 31 35Z", "middle"],
      ["M11 31 22 37 25 50 9 44Z", "light"],
      ["M9 44 25 50 25 60 8 46Z", "dark"],
      ["M32 48 44 39 55 34 58 45 43 49Z", "lower"],
      ["M58 45 47 55 43 49Z", "dark"],
      ["M25 50 32 48 43 49 47 55 25 60Z", "middle"],
    ];
    if (tiny)
      faces = [
        ["M37 3 24 12 22 35 32 46 39 26Z", "light"],
        ["M37 3 51 13 46 37 32 46 39 26Z", "warm"],
        ["M10 29 22 35 32 46 25 62 7 46Z", "lower"],
        ["M32 46 46 37 55 33 60 45 48 56 25 62Z", "dark"],
        ["M10 29 22 35 32 46 18 43Z", "middle"],
      ];
  }
  let interior = faces.map(([d, tone]) => path(d, paint(tone))).join("");
  // Finishes change the modeled surface as well as the palette. Micro artwork
  // deliberately omits glints, secondary facets and narrow specular ridges.
  if (!tiny) {
    const center =
      game === "hsr" && family === 0
        ? "M37 8 39 27 32 47 36 27Z"
        : "M32 8 33 30 53 32 32 33 31 52 30 32 12 32 31 30Z";
    if (variant === 0) interior += path(center, c[0], 'opacity=".45"');
    if (variant === 1)
      interior += path(
        game === "hsr" && family === 0
          ? "M28 15 35 10 31 29Z"
          : "M29 16 31 10 31 26 24 28Z",
        c[0]
      );
    if (variant === 2) interior += path(center, c[0], 'opacity=".65"');
    if (variant === 3)
      interior += path(
        game === "hsr" && family === 0
          ? "M27 15Q29 28 33 33L28 39Z"
          : "M26 22Q29 30 39 28L34 34Q26 33 22 29Z",
        c[1],
        'opacity=".6"'
      );
    if (variant === 4)
      interior += path(
        game === "hsr" && family === 0
          ? "M37 8 44 14 39 25Z"
          : "M32 10 36 24 32 30 29 25Z",
        fill("light")
      );
  }
  const outerWidth = tiny ? 2.8 : 1.6;
  const edge = variant === 1 || variant === 4 ? c[0] : fill("rim");
  let body =
    path(
      shape,
      edge,
      `stroke="${c[5]}" stroke-width="${outerWidth}" stroke-linejoin="round"`
    ) +
    `<g clip-path="url(#${id}-clip)">${path(shape, paint("middle"))}${interior}</g>` +
    path(
      shape,
      "none",
      `stroke="${edge}" stroke-width="${tiny ? 1.3 : 1}" stroke-linejoin="round"`
    );
  if (oneColor) body = path(shape, foreground);
  const label = `${study.code} ${study.name} GGArtifact [${game === "gi" ? "Genshin" : "Star Rail"}]`;
  // Fixed inset leaves clear pixels around all four edges, including strokes.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${label}"><defs>${defs}</defs><g transform="translate(4 4) scale(.875)">${body}</g></svg>`;
}
