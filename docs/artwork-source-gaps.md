# Artwork source gaps

- **Open — HoYoWiki artifact slot identity (2026-11-16).** Aggregate cards expose
  five unlabelled images with inconsistent order. Live acquisition mapped goblet
  to circlet and sands to plume for Heart of the Furnace and seven other recent
  sets. DOM `alt` attributes are empty, so position is not reliable slot evidence.
  Existing local slot art remains authoritative until a source with explicit
  piece/slot identity is connected. Refresh downloads and decodes each live card
  thumbnail for coverage, preserves valid local slot art, and fails on missing
  local assets instead of acquiring an image under an unverified slot. Next:
  derive explicit slot/icon relationships from structured game data or a labelled
  detail source, then verify all five pieces and enable replacement.
- **Open — boss artwork source URLs (2026-11-16).** The local images for monster
  IDs `25139001` and `25134601` are valid, but the live HoYoWiki enemy catalog has
  no matching entry IDs. Current raw game data identifies icons
  `UI_MonsterIcon_Karzelek_Tsereteli_01` and `UI_MonsterIcon_Volkodlak_Whale`.
  A reliable acquisition URL is still required; existing images are preserved.
- **Preserved — higher-resolution character portraits (2026-11-16).** HoYoWiki
  currently provides 256px images for several characters with larger, differently
  cropped local portraits. Acquisition checks the live response but retains a
  larger valid local asset. This proves source availability, not byte equality.
