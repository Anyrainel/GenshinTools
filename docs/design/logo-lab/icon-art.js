import { concepts, shapes } from "./geometry-studies.js";

let serial = 0;
const path = (d, fill, extra = "") =>
  `<path d="${d}" fill="${fill}" ${extra}/>`;
export function icon(
  index,
  game,
  oneColor = false,
  foreground = "#202633",
  size = 64,
  refined = true
) {
  const study = concepts[index];
  if (study.hybrid && (!refined || game === "hsr"))
    return icon(game === "hsr" ? 4 : 0, game, oneColor, foreground, size, true);
  const { family, variant } = study;
  const improving = refined && (variant === 0 || variant === 2);
  const c = improving ? study.refinedColors : study.colors;
  const tiny = size <= 24;
  const id = `gem-${serial++}`;
  let shape =
    shapes[
      game === "gi"
        ? family === 0
          ? "angular"
          : "curved"
        : family === 0
          ? "cluster"
          : "flower"
    ][variant];
  if (refined && variant === 4 && game === "gi")
    shape =
      family === 0
        ? "M32 4 39 25 60 32 39 39 32 60 25 39 4 32 25 25Z"
        : "M32 4Q35 26 60 32Q38 35 32 60Q29 38 4 32Q26 29 32 4Z";
  if (study.hybrid)
    shape =
      "M32 3 39.5 21.5 41 24.5 60 32 41 39.5 38 44 32 61 26 44 23 39.5 4 32 23 24.5 24.5 21.5Z";
  const gradient = (key, colors, x2 = "80%", y2 = "100%") =>
    `<linearGradient id="${id}-${key}" x1="15%" y1="0%" x2="${x2}" y2="${y2}">${colors.map((color, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${color}"/>`).join("")}</linearGradient>`;
  const fill = (key) => `url(#${id}-${key})`;
  let defs = gradient("rim", [c[0], c[1], c[3], c[5]]);
  defs += gradient("light", [c[0], c[1]]);
  defs += gradient("warm", [c[1], c[2]]);
  defs += gradient("middle", [c[2], c[3]]);
  defs += gradient("lower", [c[3], c[4]]);
  defs += gradient("dark", [c[3], c[5]]);
  defs += `<clipPath id="${id}-clip">${path(shape, "white")}</clipPath>`;

  const paint = (tone) => {
    if (tiny)
      return { light: c[0], warm: c[1], middle: c[2], lower: c[3], dark: c[4] }[
        tone
      ];

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
  if (variant > 0 && game === "gi") {
    const rings = [
      [],
      [
        [32, 3],
        [39, 23],
        [56, 32],
        [39, 40],
        [32, 61],
        [25, 40],
        [8, 32],
        [25, 23],
      ],
      [
        [32, 4],
        [43, 23],
        [59, 32],
        [41, 43],
        [32, 60],
        [21, 41],
        [5, 32],
        [23, 21],
      ],
      [
        [36, 4],
        [41, 22],
        [60, 29],
        [42, 39],
        [28, 60],
        [24, 41],
        [4, 35],
        [23, 24],
      ],
      [
        [32, 4],
        [42, 22],
        [60, 32],
        [42, 42],
        [32, 60],
        [22, 42],
        [4, 32],
        [22, 22],
      ],
    ];
    const ring = study.hybrid
      ? [
          [32, 3],
          [41, 24.5],
          [60, 32],
          [41, 39.5],
          [32, 61],
          [23, 39.5],
          [4, 32],
          [23, 24.5],
        ]
      : refined && variant === 4
        ? [
            [32, 4],
            [39, 25],
            [60, 32],
            [39, 39],
            [32, 60],
            [25, 39],
            [4, 32],
            [25, 25],
          ]
        : rings[variant];
    const center =
      variant === 3 ? [30, 31] : variant === 1 ? [32, 34] : [32, 32];
    const tones = [
      "warm",
      "middle",
      "lower",
      "dark",
      "lower",
      "dark",
      "warm",
      "light",
    ];
    faces = ring.map((point, i) => [
      `M${point} ${ring[(i + 1) % 8]} ${center}Z`,
      tones[i],
    ]);
    if (variant === 1) {
      // A continuous pale face on the upper left, with a longer blue lower face.
      faces[7][1] = "warm";
      faces[0][1] = "light";
      faces[4][1] = "middle";
    }
  }
  if (improving && game === "hsr" && family === 0 && !tiny) {
    // Three main-crystal planes, two left-shard planes, one right face, one base.
    // Preserve the overlapping cluster while merging incidental subdivisions.
    const soft = variant === 2;
    const top = soft ? "37 4" : "37 3";
    const shoulder = soft ? "51 15" : "51 13";
    const foot = soft ? "25 60" : "25 62";
    faces = [
      [`M${top} 24 12 22 35 32 46 40 25Z`, "warm"],
      [`M${top} ${shoulder} 40 25Z`, "light"],
      [`M${shoulder} 46 37 32 46 40 25Z`, "dark"],
      ["M10 29 22 35 32 46 24 50 7 46Z", "middle"],
      [`M7 46 24 50 ${foot}Z`, "dark"],
      ["M32 46 46 37 55 33 60 45 44 50Z", "lower"],
      [`M24 50 32 46 44 50 60 45 48 56 ${foot}Z`, "middle"],
    ];
  }
  let interior = faces.map(([d, tone]) => path(d, paint(tone))).join("");
  if (variant === 1 && game === "hsr" && family === 0) {
    interior =
      path("M35 3 25 12 23 39 31 46Z", fill("warm")) +
      path("M35 3 47 13 31 46Z", fill("light")) +
      path("M47 13 43 39 31 46Z", fill("dark")) +
      path("M12 34 23 39 31 46 25 60 9 46Z", fill("lower")) +
      path("M31 46 43 39 53 35 58 45 46 55 25 60Z", fill("dark")) +
      path("M31 46 53 35 46 47 25 53Z", fill("lower"));
  }
  if (variant === 2 && !improving) {
    // Preserve a cut object: gently soften the facet contrast, not the outline.
    interior = `<g opacity=".86">${interior}</g>`;
  }
  if (variant === 3 && game === "hsr") {
    interior = `<g transform="rotate(7 32 32)">${interior}</g>`;
  }
  if (variant === 4 && !tiny) {
    // A low-contrast inner cut, never a separate badge or a heavy outline.
    const inset =
      game === "hsr" && family === 0
        ? "M33 13 42 18 37 38 30 43 27 31Z"
        : refined && game === "gi"
          ? "M32 12 36 28 52 32 36 36 32 52 28 36 12 32 28 28Z"
          : "M32 17Q35 28 47 32Q36 35 32 47Q29 36 17 32Q28 29 32 17Z";
    interior += path(inset, fill("middle"), 'opacity=".48"');
  }
  if (!tiny) {
    const glint =
      game === "hsr" && family === 0
        ? "M35 8 37 24 31 45 35 24Z"
        : "M32 9 32.7 31 52 32 32.5 32.7 32 54 31.4 32.6 11 32 31.4 31.3Z";
    if (variant === 0 || variant === 4)
      interior += path(
        glint,
        c[0],
        `opacity="${variant === 0 ? ".4" : ".24"}"`
      );
    if (variant === 1)
      interior += path(
        game === "hsr" && family === 0
          ? "M35 7 35 28 31 45 33 26Z"
          : "M32 8 33 33 32 55 31.5 33Z",
        c[0],
        'opacity=".3"'
      );
  }
  const outerWidth = tiny ? 2.4 : 1.2;
  let body =
    path(
      shape,
      fill("rim"),
      `stroke="${c[5]}" stroke-width="${outerWidth}" stroke-linejoin="round"`
    ) +
    `<g clip-path="url(#${id}-clip)">${path(shape, fill("middle"))}${interior}</g>`;
  if (!tiny)
    body += path(
      shape,
      "none",
      `stroke="${fill("rim")}" stroke-width=".8" stroke-linejoin="round"`
    );
  if (oneColor) body = path(shape, foreground);
  const label = `${study.code} ${study.name} GGArtifact [${game === "gi" ? "Genshin" : "Star Rail"}]`;
  // Fixed inset leaves clear pixels around all four edges, including strokes.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${label}"><defs>${defs}</defs><g transform="translate(4 4) scale(.875)">${body}</g></svg>`;
}
