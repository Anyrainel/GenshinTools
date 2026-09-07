// Each material uses the same lighting and facet treatment across both games.
// Geometry remains contiguous so the small raster retains a readable silhouette.
export const concepts = [
  {
    name: "Luminous bevel",
    tag: "05 / Cut glass",
    description:
      "A fuller evolution of the first silhouettes. Broad inner faces sit inside a narrow luminous bevel, with rose and pearl light above and deeper blue refraction below. The center is solid.",
    gi: "A four-point gem with clipped shoulders and a slightly elongated lower tip. Eight inner faces meet at an off-center highlight.",
    hsr: "A leaning main crystal with two joined side crystals. Larger faces and a beveled edge keep the cluster dimensional without its tiny fragments.",
  },
  {
    name: "Opal polish",
    tag: "06 / Soft iridescence",
    description:
      "Gently curved outlines and translucent overlapping planes give both gems a polished, opalescent finish. Color flows through the volume rather than forming stripes; a cool edge keeps the pale highlights defined.",
    gi: "A softly shouldered star with a pearly upper face and a curved aqua reflection through the lower half.",
    hsr: "A rounded crystal cluster with the same pearly illumination and flowing aqua reflection. Its fused base feels smoother than a pile of shards.",
  },
  {
    name: "Aurora cut",
    tag: "07 / Rich refraction",
    description:
      "A more saturated jewel treatment: champagne highlights, violet side faces, and a deep cyan core. Offset face junctions and a second tier of facets bring the reference artwork’s richness into a compact silhouette.",
    gi: "A broad star with a tiny secondary shoulder on each arm and an inset kite-shaped face. The pale upper edge contrasts with the blue lower tip.",
    hsr: "A slightly wider, asymmetric cluster with a long central face. Violet side planes separate the main crystal from its aqua base.",
  },
  {
    name: "Petal crystal",
    tag: "08 / Sculpted softness",
    description:
      "The flower reference returns with sculpted facets instead of color bands. Both icons have rounded shoulders, pointed tips, and a full luminous center. Pale rim light and translucent blue shadows create the family resemblance.",
    gi: "A softly curved four-point star, modeled with petal-like inner faces while retaining the Primogem-inspired silhouette.",
    hsr: "Four plump crystal petals with alternating rose and aqua faces. A small solid center replaces the original central ornament.",
  },
];

let serial = 0;
const p = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const palettes = [
  ["#fff4dc", "#f2b5e1", "#b599eb", "#78ecf4", "#299edc", "#3459b1"],
  ["#fffae9", "#f2d0ef", "#b6b5ee", "#a7f2ed", "#57bfe1", "#638dcc"],
  ["#fff0ba", "#f5addd", "#9162d2", "#65eff9", "#159bdd", "#354b9e"],
  ["#fff4eb", "#edb1e5", "#b794dc", "#8cecf4", "#399fdc", "#4962ad"],
];

export function icon(index, game, oneColor = false, foreground = "#202633") {
  const id = `crystal-${serial++}`;
  const [pearl, rose, lilac, ice, aqua, deep] = palettes[index];
  const soft = index === 1 || index === 3;
  const star =
    index === 2
      ? "M32 2 41 20 44 24 61 31 44 39 40 43 32 62 24 43 20 39 3 31 20 24 23 20Z"
      : soft
        ? "M32 3C36 12 38 21 43 24L60 32C49 37 42 39 39 45L32 62C28 51 25 43 20 40L4 32C15 27 22 25 25 19Z"
        : "M32 3 40 20 43 24 60 32 43 40 39 45 32 62 25 45 21 40 4 32 21 24 24 20Z";
  const cluster = soft
    ? "M37 3Q39 2 41 4L51 13Q52 15 51 18L45 37 53 34Q56 33 57 37L59 44Q60 46 57 49L47 56 26 61Q23 62 21 59L8 47Q6 45 7 42L10 31Q11 28 14 30L22 35 24 14Q24 11 27 10Z"
    : "M37 3 51 13 46 37 55 33 60 45 48 56 25 62 7 46 10 29 22 35 24 12Z";
  const flower =
    "M32 3C42 10 48 19 41 24C50 19 57 25 62 32C55 42 48 47 41 41C46 49 39 57 32 62C23 55 18 48 24 41C16 47 8 40 2 32C9 22 17 18 24 24C18 16 24 8 32 3Z";
  const shape = game === "gi" ? star : index === 3 ? flower : cluster;
  const gradient = (
    key,
    colors,
    x1 = "10%",
    y1 = "0%",
    x2 = "85%",
    y2 = "100%"
  ) =>
    `<linearGradient id="${id}-${key}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${colors.map((color, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${color}"/>`).join("")}</linearGradient>`;
  const fill = (key) => `url(#${id}-${key})`;
  let defs = gradient("body", [pearl, rose, ice, aqua, deep]);
  defs += gradient("warm", [pearl, rose, lilac]);
  defs += gradient("pink", ["#ffffff", rose, lilac], "0%", "0%", "100%", "80%");
  defs += gradient("cool", ["#eaffff", ice, aqua], "0%", "0%", "90%", "100%");
  defs += gradient("shade", [lilac, aqua, deep]);
  defs += gradient(
    "rim",
    [pearl, "#e9f6ff", aqua, deep],
    "15%",
    "0%",
    "80%",
    "100%"
  );
  defs += gradient("shine", ["#ffffff", ice], "0%", "0%", "100%", "100%");
  defs += `<radialGradient id="${id}-opal" cx="35%" cy="24%" r="76%"><stop stop-color="#fffdf3"/><stop offset=".3" stop-color="${rose}"/><stop offset=".62" stop-color="${ice}"/><stop offset="1" stop-color="${deep}"/></radialGradient>`;
  defs += `<clipPath id="${id}-clip">${p(shape, "white")}</clipPath>`;
  let body = p(
    shape,
    fill("rim"),
    `stroke="${deep}" stroke-width=".7" stroke-linejoin="round"`
  );
  let faces = "";
  if (game === "gi") {
    const center = index === 2 ? "30 30" : "32 31";
    faces =
      p(`M32 6 25 22 ${center}Z`, fill("shine")) +
      p(`M32 6 40 24 ${center}Z`, fill("warm")) +
      p(`M25 22 8 32 ${center}Z`, fill("pink")) +
      p(`M8 32 23 39 ${center}Z`, fill("shade")) +
      p(`M40 24 56 32 ${center}Z`, fill("cool")) +
      p(`M56 32 41 39 ${center}Z`, fill("shade")) +
      p(`M23 39 32 57 ${center}Z`, fill("cool")) +
      p(`M32 57 41 39 ${center}Z`, fill("shade"));
    if (index === 2)
      faces +=
        p("M32 10 36 25 30 30 27 24Z", fill("pink")) +
        p("M30 30 38 39 32 54 29 40Z", fill("cool"));
    faces += p(
      "M8 32 30 30 32 6 33 31 56 32 33 33 32 57 30 33Z",
      "#f1ffff",
      'opacity=".55"'
    );
  } else if (index === 3) {
    faces =
      p("M32 6Q21 16 26 25L32 32Z", fill("pink")) +
      p("M32 6Q45 16 39 25L32 32Z", fill("warm")) +
      p("M59 32Q49 21 39 26L32 32Z", fill("pink")) +
      p("M59 32Q49 44 40 38L32 32Z", fill("shade")) +
      p("M32 59Q44 48 38 40L32 32Z", fill("shade")) +
      p("M32 59Q21 49 26 40L32 32Z", fill("cool")) +
      p("M5 32Q16 45 25 38L32 32Z", fill("shade")) +
      p("M5 32Q16 21 25 26L32 32Z", fill("cool")) +
      p(
        "M32 11 34 29 54 32 34 34 32 55 30 34 10 32 30 30Z",
        "#e8ffff",
        'opacity=".48"'
      );
  } else {
    faces =
      p("M37 6 27 14 31 35 39 27Z", fill("warm")) +
      p("M37 6 48 15 39 27Z", fill("pink")) +
      p("M48 15 43 39 32 48 39 27Z", fill("shade")) +
      p("M27 14 24 38 32 48 31 35Z", fill("shine")) +
      p("M12 32 22 38 25 50 11 44Z", fill("cool")) +
      p("M11 44 25 50 25 58 10 46Z", fill("shade")) +
      p("M32 48 43 39 54 36 55 44 43 49Z", fill("cool")) +
      p("M55 44 47 53 43 49Z", fill("shade")) +
      p("M25 50 32 48 43 49 47 53 25 58Z", fill("cool")) +
      p("M37 6 39 27 32 48 37 26Z", "#fffaff", 'opacity=".7"');
    if (index === 2)
      faces +=
        p("M29 17 35 22 31 38Z", fill("pink")) +
        p("M28 51 40 51 31 57Z", fill("shade"));
  }
  if (index === 1) {
    body = p(shape, `url(#${id}-opal)`, `stroke="${deep}" stroke-width=".8"`);
    faces =
      `<g opacity=".48">${faces}</g>` +
      p(
        "M7 37C23 45 36 18 57 25L61 35C38 25 29 53 9 48Z",
        fill("cool"),
        'opacity=".52"'
      ) +
      p(
        "M16 13Q29 3 43 9Q29 12 26 30Q22 27 16 13Z",
        "#fffdf5",
        'opacity=".48"'
      );
  }
  body += `<g clip-path="url(#${id}-clip)">${faces}</g>`;
  if (oneColor) body = p(shape, foreground);
  const label = `${concepts[index].name} GGArtifact [${game === "gi" ? "Genshin" : "Star Rail"}]`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${label}"><defs>${defs}</defs>${body}</svg>`;
}
