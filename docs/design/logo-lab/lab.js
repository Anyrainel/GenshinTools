import { concepts } from "./geometry-studies.js";
import { icon as drawIcon } from "./icon-art.js";

let refined = true;
const icon = (index, game, mono, foreground, size, revision = refined) =>
  drawIcon(index, game, mono, foreground, size, revision);

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
let selected = 10;
let mono = false;
let canvasText = backgrounds[0][2];
let renderVersion = 0;
const $ = (id) => document.getElementById(id);

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
  return `GGArtifact [${game === "gi" ? "Genshin" : "Star Rail"}]`;
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
  const index = selected;
  const oneColor = mono;
  const foreground = canvasText;
  const revision = refined;
  const concept = concepts[selected];
  $("direction-number").textContent = concept.tag;
  $("direction-title").textContent = `${concept.code} · ${concept.name}`;
  $("direction-description").textContent = concept.description;
  $("palette").innerHTML =
    `<strong>${refined ? "Refined study" : "Previous version"} · ${concept.material}</strong>${(refined && [0, 2].includes(concept.variant) ? concept.refinedColors : concept.colors).map((color) => `<span style="background:${color}" title="${color}"></span>`).join("")}`;
  for (const button of document.querySelectorAll(".concept")) {
    const cardIndex = Number(button.dataset.index);
    button.setAttribute("aria-pressed", String(cardIndex === selected));
    const ink = document.body.classList.contains("light")
      ? "#202633"
      : "#f2f4f8";
    button.querySelector(".concept-icons").innerHTML =
      icon(cardIndex, "gi", mono, ink) + icon(cardIndex, "hsr", mono, ink);
  }
  $("hero-pair").innerHTML = ["gi", "hsr"]
    .map(
      (game) =>
        `<div class="hero">${icon(selected, game, mono, canvasText)}<div class="wordmark">GGArtifact <span>[${game === "gi" ? "Genshin" : "Star Rail"}]</span></div></div>`
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
    const atSize = (size) =>
      icon(index, game, oneColor, foreground, size, revision);
    const card = document.createElement("div");
    card.className = "size-card";
    card.innerHTML = `<div class="size-row"></div><div class="pixel-view"><p>16 × 16, enlarged 6×.<br />${name(game)}<br />Look for a clear silhouette and readable light and shadow.</p></div>`;
    for (const size of [16, 20, 24, 32, 48, 64]) {
      const canvas = await raster(atSize(size), size);
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
    const pixelCanvas = await raster(atSize(16), 16);
    if (version !== renderVersion) return;
    card.querySelector(".pixel-view").prepend(pixelCanvas);
    $("sizes").append(card);
    const tabColumn = document.createElement("div");
    for (const dark of [false, true]) {
      const tabSvg = icon(
        selected,
        game,
        mono,
        dark ? "#f2f4f8" : "#202633",
        16
      );
      const favicon = await raster(tabSvg, 16);
      if (version !== renderVersion) return;
      const browser = document.createElement("div");
      browser.className = dark ? "browser dark" : "browser";
      browser.innerHTML = `<div class="browser-tabs"><div class="browser-tab"><span>${name(game)}</span>×</div>＋</div><div class="address">GGArtifact / ${game === "gi" ? "Genshin" : "Star Rail"} / team tools</div>`;
      browser.querySelector(".browser-tab").prepend(favicon);
      tabColumn.append(browser);
    }
    const actions = document.createElement("div");
    actions.className = "actions";
    const download = document.createElement("a");
    download.textContent = "SVG · full detail";
    download.href = dataUrl(svg);
    download.download = `ggartifact-${game}-${concept.code}${mono ? "-mono" : ""}.svg`;
    actions.append(download);
    const microDownload = document.createElement("a");
    microDownload.textContent = "SVG · favicon";
    microDownload.href = dataUrl(atSize(16));
    microDownload.download = `ggartifact-${game}-${concept.code}-favicon.svg`;
    actions.append(microDownload);
    for (const size of [16, 32, 48, 96, 180]) {
      const button = document.createElement("button");
      button.textContent = `PNG ${size}`;
      button.onclick = async () => {
        try {
          const canvas = await raster(atSize(size), size);
          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = `ggartifact-${game}-${concept.code}-${size}.png`;
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
      $("favicon").href = dataUrl(atSize(16));
      document.title = `${name(game)} · ${concept.name}`;
      notify(`Tab icon: ${name(game)} / ${concept.name}`);
    };
    actions.append(tryButton);
    tabColumn.append(actions);
    $("tabs").append(tabColumn);
  }
}
$("concepts").innerHTML = [0]
  .map(
    (family) =>
      `<section class="family"><div class="family-heading"><h2>${family === 0 ? "A / Option 1 silhouette" : "B / Option 4 silhouette"}</h2><span>A1 and A5 references · A6 proposed pair</span></div><div class="family-grid">${[
        0, 10, 4,
      ]
        .map((i) => {
          const concept = concepts[i];
          return concept.family === family
            ? `<button class="concept" aria-pressed="${i === selected}" data-index="${i}"><div class="concept-icons">${icon(i, "gi")}${icon(i, "hsr")}</div><strong>${concept.code} · ${concept.name}</strong><small>${concept.material}</small><div class="card-tiny" aria-label="16 pixel previews" data-preview="${i}"><span>16 px</span><div class="mini-dark"></div><div class="mini-light"></div></div></button>`
            : "";
        })
        .join("")}</div></section>`
  )
  .join("");
async function renderCardFavicons() {
  const revision = refined;
  for (const [index] of concepts.entries()) {
    const target = document.querySelector(`[data-preview="${index}"]`);
    if (!target) continue;
    for (const theme of ["dark", "light"]) {
      target.querySelector(`.mini-${theme}`).replaceChildren();
      for (const game of ["gi", "hsr"]) {
        const canvas = await raster(
          icon(index, game, false, "#202633", 16, revision),
          16
        );
        if (revision !== refined) return;
        canvas.setAttribute(
          "aria-label",
          `${concepts[index].code} ${name(game)} 16 px ${theme} background`
        );
        target.querySelector(`.mini-${theme}`).append(canvas);
      }
    }
  }
}
renderCardFavicons().catch(showError);
for (const button of document.querySelectorAll(".concept")) {
  button.onclick = () => {
    selected = Number(button.dataset.index);
    render().catch(showError);
  };
}
$("swatches").innerHTML = backgrounds
  .map(
    ([label, color], i) =>
      `<button class="swatch" style="background:${color}" data-color="${color}" aria-label="${label} canvas" title="${label}" aria-pressed="${i === selected}"></button>`
  )
  .join("");
for (const [i, button] of document.querySelectorAll(".swatch").entries()) {
  button.onclick = () => setCanvas(backgrounds[i][1], backgrounds[i][2]);
}
$("mono").onchange = (event) => {
  mono = event.target.checked;
  render().catch(showError);
};
$("previous").onchange = (event) => {
  refined = !event.target.checked;
  render().catch(showError);
  renderCardFavicons().catch(showError);
};
$("light-page").onchange = (event) => {
  document.body.classList.toggle("light", event.target.checked);
  render().catch(showError);
};
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
$("favicon").href = dataUrl(icon(0, "gi", false, "#202633", 16));
render().catch(showError);
