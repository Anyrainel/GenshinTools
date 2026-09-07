import { concepts, shapes } from "./geometry-studies.js";

let serial = 0;
const path = (d, fill, extra = "") =>
  `<path d="${d}" fill="${fill}" ${extra}/>`;
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
    shapes[
      game === "gi"
        ? family === 0
          ? "angular"
          : "curved"
        : family === 0
          ? "cluster"
          : "flower"
    ][variant];
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
    if (variant === 1 || tiny)
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
  const simplified = tiny || variant === 1;
  if (variant === 1 && !tiny) {
    // The chamfer style keeps the same deliberately low facet count at all sizes.
    if (game === "gi" || family === 1)
      faces = [
        ["M0 0H32V32H0Z", "light"],
        ["M32 0H64V32H32Z", "warm"],
        ["M0 32H32V64H0Z", "lower"],
        ["M32 32H64V64H32Z", "dark"],
      ];
    else
      faces = [
        ["M0 0H36L30 44 0 32Z", "warm"],
        ["M36 0H64V32L30 44Z", "middle"],
        ["M0 32 30 44 26 64H0Z", "lower"],
        ["M30 44 64 32V64H26Z", "dark"],
      ];
  }
  let interior = faces
    .map(([d, tone]) =>
      path(
        d,
        paint(tone),
        variant === 3 && !tiny
          ? `stroke="${c[5]}" stroke-width="1.1" stroke-linejoin="round"`
          : ""
      )
    )
    .join("");
  if (variant === 2) {
    // Continuous volume and two broad curved reflections instead of triangles.
    defs += `<radialGradient id="${id}-volume" cx="32%" cy="18%" r="90%"><stop stop-color="${c[1]}"/><stop offset=".45" stop-color="${c[2]}"/><stop offset=".75" stop-color="${c[3]}"/><stop offset="1" stop-color="${c[4]}"/></radialGradient>`;
    interior =
      path(shape, fill("volume")) +
      path(
        game === "hsr" && family === 0
          ? "M24 10Q36 8 40 15Q34 23 31 38Q21 24 24 10Z"
          : "M21 12Q33 8 40 18Q33 26 30 36Q19 30 21 12Z",
        fill("warm")
      ) +
      path(
        game === "hsr" && family === 0
          ? "M8 39Q31 52 58 39L59 54 24 62Z"
          : "M5 34Q30 45 59 32Q41 40 32 61Q25 44 5 34Z",
        fill("lower")
      );
  }
  if (variant === 0 && !tiny)
    interior += path(
      game === "hsr" && family === 0
        ? "M37 8 39 27 32 47 36 27Z"
        : "M32 8 33 30 53 32 32 33 31 52 30 32 12 32 31 30Z",
      c[0],
      'opacity=".4"'
    );
  if (variant === 4) {
    // A filled table facet changes the construction, not just the lighting.
    interior += path(
      game === "hsr" && family === 0
        ? "M31 14 42 19 38 37 29 43 26 31Z"
        : "M32 19 43 30 34 44 21 34Z",
      fill("warm"),
      `stroke="${c[4]}" stroke-width="${tiny ? 1.5 : 1}"`
    );
    if (!tiny)
      interior += path(
        game === "hsr" && family === 0
          ? "M31 14 42 19 35 22 26 31Z"
          : "M32 19 43 30 33 29 21 34Z",
        fill("light")
      );
  }
  const outerWidth = variant === 3 ? (tiny ? 4 : 3.4) : tiny ? 2.4 : 1.2;
  const edge = variant === 1 ? c[4] : fill("rim");
  let body =
    path(
      shape,
      edge,
      `stroke="${c[5]}" stroke-width="${outerWidth}" stroke-linejoin="round"`
    ) +
    `<g clip-path="url(#${id}-clip)">${path(shape, paint("middle"))}${interior}</g>`;
  if (variant === 3)
    body += path(
      shape,
      "none",
      `stroke="${c[5]}" stroke-width="${tiny ? 2.5 : 2.8}" stroke-linejoin="round"`
    );
  else if (!simplified && variant !== 2)
    body += path(
      shape,
      "none",
      `stroke="${edge}" stroke-width=".8" stroke-linejoin="round"`
    );
  if (oneColor) body = path(shape, foreground);
  const label = `${study.code} ${study.name} GGArtifact [${game === "gi" ? "Genshin" : "Star Rail"}]`;
  // Fixed inset leaves clear pixels around all four edges, including strokes.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${label}"><defs>${defs}</defs><g transform="translate(4 4) scale(.875)">${body}</g></svg>`;
}
