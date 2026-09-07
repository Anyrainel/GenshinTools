// Standalone design study: deliberately independent of either production app.
const concepts = [
  {
    name: "Prism aperture",
    tag: "01 / Closest evolution",
    description:
      "Keep the currency silhouettes, then give both a generous diamond window. Three broad color planes replace tiny facets. The shared cut-out becomes the GG signature.",
    gi: "Primogem-inspired four-point silhouette, shortened side tips, and a new open center.",
    hsr: "The supplied crystal cluster becomes one tilted prism with a stepped foot and matching diamond window.",
  },
  {
    name: "Split facets",
    tag: "02 / Most graphic",
    description:
      "Separate each gem into three bold pieces. A diagonal seam ties the pair together; the GI mark spreads outward while the HSR mark rises upward. Flat color keeps the divisions visible.",
    gi: "An asymmetric star made from three pieces instead of the original eight triangular facets.",
    hsr: "Three ascending shards simplify the crystal cluster. Wide seams replace the original small crystal details.",
  },
  {
    name: "Gem seals",
    tag: "03 / Strongest shared frame",
    description:
      "A chamfered dark seal contains a luminous gem. The identical frame anchors the brand across busy backgrounds, while the inner silhouette identifies the game.",
    gi: "A compact Primogem-inspired star inset into an original chamfered seal.",
    hsr: "A tall crystal inset into the same seal. The framing improves contrast but reduces the inner mark at 16 px.",
  },
  {
    name: "Petal & point",
    tag: "04 / Softer alternative",
    description:
      "Pair a softened four-point star with the four-petal HSR reference. Both use the same diamond aperture and broad diagonal color division. This moves farther from the current sharp-faceted look.",
    gi: "Concave curved shoulders soften the Primogem outline; a diamond window changes the center.",
    hsr: "The supplied four-petal gem loses its tiny central ornament and faceting, gaining the same open diamond as GI.",
  },
];
const backgrounds = [
  ["Ink", "#202633", "#f3f4f8"],
  ["Paper", "#faf8f3", "#262a35"],
  ["Lavender", "#e4daf8", "#352a48"],
  ["Deep plum", "#452946", "#fff0fb"],
  ["Mint", "#caeadd", "#173e34"],
  ["Forest", "#173f39", "#e7fff5"],
  ["Apricot", "#f7d5b7", "#513224"],
  ["Cobalt", "#24489b", "#eff4ff"],
];
let selected = 0;
let mono = false;
let canvasText = backgrounds[0][2];
let renderVersion = 0;
let serial = 0;
const $ = (id) => document.getElementById(id);
const path = (d, fill, extra = "") =>
  `<path d="${d}" fill="${fill}" ${extra}/>`;

function icon(index, game, oneColor = false, foreground = "#202633") {
  const id = `gem-${serial++}`;
  const pink = oneColor ? foreground : "#ed9fcd";
  const cyan = oneColor ? foreground : "#42cfe0";
  const blue = oneColor ? foreground : "#3b68c7";
  const hole = "M32 24 40 32 32 40 24 32Z";
  const star = "M32 3 42 22 59 32 42 42 32 61 22 42 5 32 22 22Z";
  const crystal = "M36 3 49 12 44 39 57 38 52 53 24 61 8 47 12 33 22 37 24 12Z";
  let body = "";
  let defs = "";
  if (index === 0 || index === 3) {
    const softStar = "M32 3Q38 23 59 32Q38 40 32 61Q25 41 5 32Q25 23 32 3Z";
    const flower =
      "M32 3C44 11 47 19 41 24C49 18 57 24 61 32C54 43 47 47 40 40C46 49 39 57 32 61C22 54 18 48 24 40C16 47 9 41 3 32C10 22 17 18 24 24C18 16 24 8 32 3Z";
    const shape =
      index === 0
        ? game === "gi"
          ? star
          : crystal
        : game === "gi"
          ? softStar
          : flower;
    defs = `<clipPath id="${id}">${path(`${shape}${hole}`, "white", 'fill-rule="evenodd" clip-rule="evenodd"')}</clipPath>`;
    body = `<g clip-path="url(#${id})">${path("M0 0H64V64H0Z", cyan)}${path(index === 0 ? "M0 0H64V32H0Z" : "M0 0H64V12L0 48Z", pink)}${path(index === 0 ? "M32 32H64V64H32Z" : "M0 64 64 20V64Z", blue)}</g>`;
  } else if (index === 1) {
    body =
      game === "gi"
        ? path("M32 3 42 23 29 29 17 23Z", pink) +
          path("M5 32 22 26 28 33 23 45Z", cyan) +
          path("M34 33 46 25 59 32 42 42 32 61 27 47Z", blue)
        : path("M34 3 49 12 42 32 25 39 24 13Z", pink) +
          path("M9 32 20 37 23 46 31 56 21 61 7 47Z", cyan) +
          path("M29 44 44 37 57 31 53 51 35 59Z", blue);
  } else {
    body = path(
      "M17 3H47L61 18V46L47 61H17L3 46V18Z",
      oneColor ? foreground : "#29344d"
    );
    const inner =
      game === "gi"
        ? "M32 12 39 25 51 32 39 39 32 52 25 39 13 32 25 25Z"
        : "M34 11 45 20 40 42 29 53 19 43 22 21Z";
    defs = `<clipPath id="${id}">${path(inner, "white")}</clipPath>`;
    if (oneColor) {
      // A true single-ink seal uses an open center, not a second fill color.
      body = path(
        `M17 3H47L61 18V46L47 61H17L3 46V18Z${inner}`,
        foreground,
        'fill-rule="evenodd"'
      );
    } else
      body += `<g clip-path="url(#${id})">${path("M0 0H64V64H0Z", cyan)}${path("M0 0H64V15L0 48Z", pink)}${path("M32 32 64 19V64H32Z", "#7fa2f5")}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${concepts[index].name.replaceAll("&", "&amp;")} ${game === "gi" ? "GGArtifact" : "GGStarRail"}"><defs>${defs}</defs>${body}</svg>`;
}
function dataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function notify(message) {
  $("status").textContent = message;
}
async function raster(svg, size) {
  const image = new Image();
  image.src = dataUrl(svg);
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d").drawImage(image, 0, 0, size, size);
  return canvas;
}
function name(game) {
  return game === "gi" ? "GGArtifact" : "GGStarRail";
}
function setCanvas(color, text) {
  canvasText = text;
  document.documentElement.style.setProperty("--canvas", color);
  document.documentElement.style.setProperty("--canvas-text", text);
  for (const button of document.querySelectorAll(".swatch")) {
    button.setAttribute("aria-pressed", String(button.dataset.color === color));
  }
  render().catch(showError);
}
function showError(error) {
  notify(`Preview failed: ${error.message}`);
}
async function render() {
  const version = ++renderVersion;
  const concept = concepts[selected];
  $("direction-number").textContent = concept.tag;
  $("direction-title").textContent = concept.name;
  $("direction-description").textContent = concept.description;
  for (const button of document.querySelectorAll(".concept")) {
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.index) === selected)
    );
  }
  $("hero-pair").innerHTML = ["gi", "hsr"]
    .map(
      (game) =>
        `<div class="hero">${icon(selected, game, mono, canvasText)}<div class="wordmark">GG<span>${game === "gi" ? "Artifact" : "StarRail"}</span></div></div>`
    )
    .join("");
  $("notes").innerHTML =
    `<p><strong>GI / </strong>${concept.gi}</p><p><strong>HSR / </strong>${concept.hsr}</p>`;
  $("sizes").replaceChildren();
  $("tabs").replaceChildren();
  $("backgrounds").innerHTML = backgrounds
    .map(
      ([label, color, foreground]) =>
        `<div class="background" style="background:${color};color:${foreground}"><div>${icon(selected, "gi", mono, foreground)}${icon(selected, "hsr", mono, foreground)}</div><span>${label} / 48 px</span></div>`
    )
    .join("");
  for (const game of ["gi", "hsr"]) {
    const svg = icon(selected, game, mono, canvasText);
    const card = document.createElement("div");
    card.className = "size-card";
    card.innerHTML = `<div class="size-row"></div><div class="pixel-view"><p>16 × 16, enlarged 6×.<br />${name(game)}<br />Look for a clear silhouette and an open center.</p></div>`;
    for (const size of [16, 20, 24, 32, 48, 64]) {
      const canvas = await raster(svg, size);
      if (version !== renderVersion) return;
      canvas.setAttribute("aria-label", `${name(game)} at ${size} pixels`);
      const sample = document.createElement("div");
      sample.className = "sample";
      sample.append(
        canvas,
        Object.assign(document.createElement("span"), {
          textContent: `${size} px`,
        })
      );
      card.querySelector(".size-row").append(sample);
    }
    const pixelCanvas = await raster(svg, 16);
    if (version !== renderVersion) return;
    card.querySelector(".pixel-view").prepend(pixelCanvas);
    $("sizes").append(card);
    const tabColumn = document.createElement("div");
    for (const dark of [false, true]) {
      const tabSvg = icon(selected, game, mono, dark ? "#f2f4f8" : "#202633");
      const favicon = await raster(tabSvg, 16);
      if (version !== renderVersion) return;
      const browser = document.createElement("div");
      browser.className = dark ? "browser dark" : "browser";
      browser.innerHTML = `<div class="browser-tabs"><div class="browser-tab"><span>${name(game)}</span>×</div>＋</div><div class="address">${game === "gi" ? "ggartifact.com" : "ggstarrail"} / team tools</div>`;
      browser.querySelector(".browser-tab").prepend(favicon);
      tabColumn.append(browser);
    }
    const actions = document.createElement("div");
    actions.className = "actions";
    const download = document.createElement("a");
    download.textContent = "Download SVG";
    download.href = dataUrl(svg);
    download.download = `gg-${game}-${selected + 1}${mono ? "-mono" : ""}.svg`;
    actions.append(download);
    for (const size of [16, 32, 180]) {
      const button = document.createElement("button");
      button.textContent = `PNG ${size}`;
      button.onclick = async () => {
        try {
          const canvas = await raster(svg, size);
          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = `gg-${game}-${concept.name.toLowerCase().replaceAll(" ", "-")}-${size}.png`;
          link.click();
          notify(`${name(game)} ${size} px PNG exported.`);
        } catch (error) {
          showError(error);
        }
      };
      actions.append(button);
    }
    const tryButton = document.createElement("button");
    tryButton.textContent = "Try in this tab";
    tryButton.onclick = () => {
      $("favicon").href = dataUrl(svg);
      document.title = `${name(game)} · ${concept.name}`;
      notify(`Tab icon: ${name(game)} / ${concept.name}`);
    };
    actions.append(tryButton);
    tabColumn.append(actions);
    $("tabs").append(tabColumn);
  }
}
$("concepts").innerHTML = concepts
  .map(
    (concept, i) =>
      `<button class="concept" aria-pressed="${i === 0}" data-index="${i}"><div class="concept-icons">${icon(i, "gi")}${icon(i, "hsr")}</div><strong>${concept.name}</strong><small>${concept.tag}</small></button>`
  )
  .join("");
for (const button of document.querySelectorAll(".concept")) {
  button.onclick = () => {
    selected = Number(button.dataset.index);
    render().catch(showError);
  };
}
$("swatches").innerHTML = backgrounds
  .map(
    ([label, color], i) =>
      `<button class="swatch" style="background:${color}" data-color="${color}" aria-label="${label} canvas" title="${label}" aria-pressed="${i === 0}"></button>`
  )
  .join("");
for (const [i, button] of document.querySelectorAll(".swatch").entries()) {
  button.onclick = () => setCanvas(backgrounds[i][1], backgrounds[i][2]);
}
$("mono").onchange = (event) => {
  mono = event.target.checked;
  render().catch(showError);
};
$("light-page").onchange = (event) =>
  document.body.classList.toggle("light", event.target.checked);
$("custom-color").oninput = (event) => {
  const color = event.target.value;
  const rgb = [1, 3, 5]
    .map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  setCanvas(
    color,
    rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
      ? "#202633"
      : "#f3f4f8"
  );
};
const references = [
  ["GI / Primogem", "https://static.nanoka.cc/assets/gi/UI_ItemIcon_201.webp"],
  [
    "GI / Genesis Crystal",
    "https://static.nanoka.cc/assets/gi/UI_ItemIcon_203.webp",
  ],
  [
    "HSR / 900001",
    "https://static.nanoka.cc/assets/hsr/itemfigures/900001.webp",
  ],
  ["HSR / 3", "https://static.nanoka.cc/assets/hsr/itemfigures/3.webp"],
  ["Current GI logo", "../../../public/logo_gt.svg"],
];
$("references").innerHTML = references
  .map(
    ([label, url]) =>
      `<a class="reference" href="${url}" target="_blank" rel="noreferrer"><img src="${url}" alt="${label}" loading="lazy" />${label}</a>`
  )
  .join("");
$("favicon").href = dataUrl(icon(0, "gi"));
render().catch(showError);
