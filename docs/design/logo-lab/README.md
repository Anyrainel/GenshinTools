# GG logo study

Temporary, standalone comparison page for four paired GGArtifact [Genshin] / GGArtifact [Star Rail]
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

Round two replaces the initial four studies with Luminous bevel, Opal polish,
Aurora cut, and Petal crystal. All have solid centers and shared material
treatments rather than cut-outs, frames, or separated fragments.

All concept geometry is authored in `icon-art.js`; `lab.js` contains the preview
controls and exports. Reference artwork is loaded from
the four user-supplied URLs and the current local GI SVG; it is not included in
exports. The HSR URLs are labeled by filename because the supplied 900001 image
renders a crystal cluster and 3 renders a four-petal gem. The first three HSR
concepts use the cluster; the fourth uses the petal reference.

This folder is outside the production Vite entry and public assets. To retire
the study, remove this folder after the selected assets have been exported.
