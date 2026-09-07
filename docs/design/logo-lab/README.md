# GG logo study

Temporary, standalone comparison page for ten paired GGArtifact [Genshin] / GGArtifact [Star Rail]
logo directions. No production imports or asset replacements.

From the repository root, serve locally:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/docs/design/logo-lab/.

Select a pair to compare large marks, wordmarks, rasterized 16–64 px samples,
enlarged 16 px pixels, light/dark browser tabs, and eight colorful backgrounds.
The page also supports a custom canvas, a light page theme, one-color marks,
SVG / PNG downloads, and an actual tab favicon switch.

Round five retains Precision cut as the baseline for the Luminous bevel family
(A1–A5) and Petal crystal family (B1–B5). First light, Silken prism, Lightfold,
and Inner glow explore balanced proportions, facet composition, and restrained
light. These replace the previous chamfer, swollen, heavy-outline, and crown
experiments. The shared rose–violet–blue palette remains constant. Each pair
uses related proportions and surface treatment without cut-outs or enclosing
shapes.

16–24 px use dedicated small-size artwork, removing secondary glints and inner
bevel detail and using solid facet colors. Full-detail artwork starts at 32 px.
Both exports preserve the same outer
silhouettes. Each card includes actual
16 px previews on light and dark backgrounds. The selected pair supports
full-detail SVG, favicon SVG, and 16/32/48/96/180 px PNG export. The favicon SVG
uses the simplified geometry at every display size.

The page includes a critique of the reference art as logos and links to MDN
icon selection and Google Search favicon guidance. Local design checks do not
certify hosted URL stability, crawlability, or search appearance.

Silhouettes and descriptions are authored in `geometry-studies.js`; rendering
styles live in `icon-art.js`; `lab.js` contains the preview
controls and exports. Reference artwork is loaded from
the four user-supplied URLs and the current local GI SVG; it is not included in
exports. The HSR URLs are labeled by filename because the supplied 900001 image
renders a crystal cluster and 3 renders a four-petal gem. Family A uses the
cluster; family B uses the petal reference.

This folder is outside the production Vite entry and public assets. To retire
the study, remove this folder after the selected assets have been exported.
