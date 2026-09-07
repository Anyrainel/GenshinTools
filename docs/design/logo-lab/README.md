# GG logo study

Temporary, standalone comparison page for paired GGArtifact [Genshin] / GGArtifact [Star Rail]
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

Round eleven returns to a silhouette close to the reference: a broad leaning
main crystal, small left fragment, and compact cluster around its foot. A11
retains the larger connected facets and warm inset front, while removing small
chips and scattered highlights. Ivory/peach stays on the main body; the base
stays blue. A6 remains the baseline and its Genshin star is unchanged. The
comparison checkbox restores A6; previews and exports follow the selection.

The design brief requires familiarity for players, standalone clarity and
quality for people unfamiliar with the games, and visibly original geometry
and adapted color. These are design criteria; no audience study is claimed.

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
